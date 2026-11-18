import { AurelixStorageSchema } from '@/types';
import { backupStorageSchema, getOrderFinancialError } from '@/lib/validation/schemas';
import { CURRENT_SCHEMA_VERSION, generateDeterministicSeedData } from '@/lib/demo-data/seed';
import { nowIso } from '@/lib/clock';

export const STORAGE_KEYS = {
  MAIN_STORE: 'aurelix_analytics_v1_store',
  CORRUPT_BACKUP: 'aurelix_analytics_v1_corrupt_snapshot',
} as const;

export interface StorageLoadResult {
  data: AurelixStorageSchema;
  status: 'hydrated' | 'seeded' | 'migrated' | 'corrupt_recovered' | 'recovery_pending' | 'unavailable';
  revision?: string | null;
  errorMessage?: string;
  persistenceError?: string;
}

export interface StorageWriteResult {
  ok: boolean;
  error?: string;
  conflict?: boolean;
  revision?: string;
}

const REVISION_LOCK_PREFIX = `${STORAGE_KEYS.MAIN_STORE}:revision:`;
const workspaceConflict = () => ({
  ok: false,
  conflict: true,
  error: 'The workspace changed in another tab. Review the latest data and retry.',
});
let activeTransaction: { visibilityError?: StorageWriteResult; writtenRevision?: string } | undefined;

async function revisionLockName(raw: string) {
  const bytes = new TextEncoder().encode(raw);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return REVISION_LOCK_PREFIX + Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function waitForPublishedRevision(name: string): Promise<StorageWriteResult | undefined> {
  try {
    const deadline = performance.now() + 250;
    do {
      const raw = window.localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
      if (raw !== null && await revisionLockName(raw) === name) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 16));
    } while (performance.now() < deadline);
    return workspaceConflict();
  } catch (error) {
    return { ok: false, error: storageWriteError(error) };
  }
}

// Chrome can grant the next lock before that tab's LocalStorage cache catches
// up. Publish the committed revision in the lock manager before handing off.
async function publishRevision(locks: LockManager, raw: string, previous?: string) {
  const name = await revisionLockName(raw);
  if (name === previous) return;

  await new Promise<void>((resolve, reject) => {
    void locks.request(name, () => {
      resolve();
      return new Promise<void>(() => {}); // Owned until replaced or the document closes.
    }).catch(reject);
  });
  if (previous) await locks.request(previous, { steal: true }, () => undefined);
}

export async function runWorkspaceTransaction<T>(action: () => T): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return action();

  let entered = false;
  try {
    const locks = navigator.locks;
    return await locks.request(STORAGE_KEYS.MAIN_STORE, async () => {
      entered = true;
      const previous = (await locks.query()).held?.find(({ name }) => name?.startsWith(REVISION_LOCK_PREFIX))?.name;
      activeTransaction = {
        visibilityError: previous ? await waitForPublishedRevision(previous) : undefined,
      };
      try {
        const result = action();
        if (activeTransaction.writtenRevision) {
          await publishRevision(locks, activeTransaction.writtenRevision, previous);
        }
        return result;
      } finally {
        activeTransaction = undefined;
      }
    });
  } catch (error) {
    if (entered) throw error;
    // The revision check still applies when the browser denies lock access.
    return action();
  }
}

// While recovery is blocked, regular app writes must not replace the original.
let recoveryBlocked = false;

function storageWriteError(err: unknown): string {
  const quotaExceeded = err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
  return quotaExceeded
    ? 'Browser LocalStorage quota exceeded (approx. 5MB limit). Export a backup or archive older records.'
    : 'Unable to persist changes to LocalStorage.';
}

function recoverStoredWorkspace(storage: Storage, rawJson: string, reason: string): StorageLoadResult {
  const data = generateDeterministicSeedData();
  function pending(error: string): StorageLoadResult {
    recoveryBlocked = true;
    return {
      data,
      status: 'recovery_pending',
      revision: rawJson,
      errorMessage: `${reason} ${error} Demo data is available for this session. The original workspace is protected from writes.`,
    };
  }

  try {
    const snapshot = storage.getItem(STORAGE_KEYS.CORRUPT_BACKUP);
    if (snapshot !== null && snapshot !== rawJson) {
      return pending('The existing recovery snapshot was retained. Copy both stored values before freeing the recovery slot and reloading.');
    }
    if (snapshot === null) storage.setItem(STORAGE_KEYS.CORRUPT_BACKUP, rawJson);
    const saved = saveToLocalStorage(data, rawJson);
    if (!saved.ok) return pending(saved.error ?? 'The recovery workspace could not be saved.');
    return {
      data,
      status: 'corrupt_recovered',
      revision: saved.revision,
      errorMessage: `${reason} The original value was preserved in the recovery snapshot and clean demo data was restored.`,
    };
  } catch (err) {
    return pending(storageWriteError(err));
  }
}

export function sortActivitiesNewestFirst<T extends { timestamp: string; id: string }>(
  activities: T[]
): T[] {
  return [...activities].sort((a, b) => {
    const aMs = Date.parse(a.timestamp);
    const bMs = Date.parse(b.timestamp);
    const safeA = Number.isFinite(aMs) ? aMs : 0;
    const safeB = Number.isFinite(bMs) ? bMs : 0;
    if (safeB !== safeA) return safeB - safeA;
    return b.id.localeCompare(a.id);
  });
}

function validateUniqueIds(items: Array<{ id: string }>, entityName: string): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      return `Backup rejected: duplicate ${entityName} identifier "${item.id}".`;
    }
    seen.add(item.id);
  }
  return null;
}

export function migrateStorageSchema(raw: Record<string, unknown>): AurelixStorageSchema | null {
  try {
    const version = raw.schemaVersion ?? 0;
    if (version === 0 &&
        Array.isArray(raw.customers) && Array.isArray(raw.products) &&
        Array.isArray(raw.orders) && raw.settings) {
      const seed = generateDeterministicSeedData();
      const merged: AurelixStorageSchema = {
        ...seed,
        ...raw,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastUpdatedAt: nowIso(),
      };
      const parsed = backupStorageSchema.safeParse(merged);
      if (parsed.success) {
        return {
          ...parsed.data,
          activities: sortActivitiesNewestFirst(parsed.data.activities),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function loadFromLocalStorage(): StorageLoadResult {
  if (typeof window === 'undefined') {
    return {
      data: generateDeterministicSeedData(),
      status: 'seeded',
    };
  }

  let storage: Storage;
  let rawJson: string | null;
  try {
    storage = window.localStorage;
    rawJson = storage.getItem(STORAGE_KEYS.MAIN_STORE);
  } catch {
    return {
      data: generateDeterministicSeedData(),
      status: 'unavailable',
      errorMessage: 'Browser LocalStorage is unavailable. Demo data is available for this session, but changes may not be saved.',
    };
  }
  recoveryBlocked = false;

  if (rawJson === null) {
    const data = generateDeterministicSeedData();
    const saved = saveToLocalStorage(data, null);
    return { data, status: 'seeded', revision: saved.revision ?? null, persistenceError: saved.error };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return recoverStoredWorkspace(storage, rawJson, 'Stored workspace JSON could not be read.');
  }

  if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
    const raw = parsedJson as Record<string, unknown>;
    if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > CURRENT_SCHEMA_VERSION) {
      recoveryBlocked = true;
      return {
        data: generateDeterministicSeedData(),
        status: 'recovery_pending',
        revision: rawJson,
        errorMessage: 'Stored workspace data uses a newer schema. The original was kept. Open it with a compatible version to resume saving.',
      };
    }

    const validation = backupStorageSchema.safeParse(raw);
    if (validation.success) {
      const data = { ...validation.data, activities: sortActivitiesNewestFirst(validation.data.activities) };
      return { data, status: 'hydrated', revision: rawJson };
    }

    const migrated = migrateStorageSchema(raw);
    if (migrated) {
      const saved = saveToLocalStorage(migrated, rawJson);
      return { data: migrated, status: 'migrated', revision: saved.revision ?? rawJson, persistenceError: saved.error };
    }
  }

  return recoverStoredWorkspace(storage, rawJson, 'Stored workspace data failed schema validation.');
}

export function saveToLocalStorage(data: AurelixStorageSchema, expectedRevision?: string | null): StorageWriteResult {
  if (typeof window === 'undefined') {
    return { ok: true };
  }

  try {
    if (recoveryBlocked) {
      return { ok: false, error: 'Workspace storage is protected until the workspace is reloaded and recovery succeeds.' };
    }
    if (activeTransaction?.visibilityError) return activeTransaction.visibilityError;
    const storage = window.localStorage;
    const payload: AurelixStorageSchema = {
      ...data,
      lastUpdatedAt: nowIso(),
    };
    const serialized = JSON.stringify(payload);
    if (expectedRevision !== undefined && storage.getItem(STORAGE_KEYS.MAIN_STORE) !== expectedRevision) {
      return workspaceConflict();
    }
    storage.setItem(STORAGE_KEYS.MAIN_STORE, serialized);
    if (activeTransaction) activeTransaction.writtenRevision = serialized;
    return { ok: true, revision: serialized };
  } catch (err) {
    return { ok: false, error: storageWriteError(err) };
  }
}

export function resetLocalStorageToSeed(): AurelixStorageSchema {
  const freshSeed = generateDeterministicSeedData();
  saveToLocalStorage(freshSeed);
  return freshSeed;
}

export function validateAndImportBackupJson(rawJsonString: string, expectedRevision?: string | null): StorageWriteResult & {
  data?: AurelixStorageSchema;
} {
  try {
    const parsed = JSON.parse(rawJsonString);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        error: 'Backup payload must be a JSON object.',
      };
    }

    const version = (parsed as Record<string, unknown>).schemaVersion;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      return {
        ok: false,
        error: 'Unsupported or missing schemaVersion. Expected positive integer version.',
      };
    }
    if (version > CURRENT_SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Unsupported backup schema version v${version}. This workspace supports up to v${CURRENT_SCHEMA_VERSION}.`,
      };
    }

    const result = backupStorageSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return {
        ok: false,
        error: `Validation failed at "${firstIssue.path.join('.')}": ${firstIssue.message}`,
      };
    }

    const dupCustomer = validateUniqueIds(result.data.customers, 'customer');
    if (dupCustomer) return { ok: false, error: dupCustomer };
    const dupProduct = validateUniqueIds(result.data.products, 'product');
    if (dupProduct) return { ok: false, error: dupProduct };
    const dupOrder = validateUniqueIds(result.data.orders, 'order');
    if (dupOrder) return { ok: false, error: dupOrder };
    const dupTeam = validateUniqueIds(result.data.team, 'team member');
    if (dupTeam) return { ok: false, error: dupTeam };

    // Validate order dates & activity timestamps are parseable
    for (const o of result.data.orders) {
      if (!Number.isFinite(Date.parse(o.orderDate))) {
        return {
          ok: false,
          error: `Backup rejected: order "${o.orderNumber}" has invalid orderDate "${o.orderDate}".`,
        };
      }
      const financialError = getOrderFinancialError(o);
      if (financialError) {
        return { ok: false, error: `Backup rejected: order "${o.orderNumber}" ${financialError}.` };
      }
    }
    for (const act of result.data.activities) {
      if (!Number.isFinite(Date.parse(act.timestamp))) {
        return {
          ok: false,
          error: `Backup rejected: activity "${act.id}" has invalid timestamp "${act.timestamp}".`,
        };
      }
    }

    const validatedData: AurelixStorageSchema = {
      ...result.data,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastUpdatedAt: nowIso(),
      activities: sortActivitiesNewestFirst(result.data.activities),
    };

    const saved = saveToLocalStorage(validatedData, expectedRevision);
    return saved.ok ? { ...saved, data: validatedData } : saved;
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON file format. Please provide a valid Aurelix backup JSON file.',
    };
  }
}
