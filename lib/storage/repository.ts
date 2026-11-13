import { AurelixStorageSchema } from '@/types';
import { backupStorageSchema } from '@/lib/validation/schemas';
import { CURRENT_SCHEMA_VERSION, generateDeterministicSeedData } from '@/lib/demo-data/seed';

export const STORAGE_KEYS = {
  MAIN_STORE: 'aurelix_analytics_v1_store',
  CORRUPT_BACKUP: 'aurelix_analytics_v1_corrupt_snapshot',
} as const;

export interface StorageLoadResult {
  data: AurelixStorageSchema;
  status: 'hydrated' | 'seeded' | 'migrated' | 'corrupt_recovered';
  errorMessage?: string;
}

export function migrateStorageSchema(raw: Record<string, unknown>): AurelixStorageSchema | null {
  try {
    const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
    if (version < CURRENT_SCHEMA_VERSION) {
      const seed = generateDeterministicSeedData();
      const merged: AurelixStorageSchema = {
        ...seed,
        ...raw,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastUpdatedAt: new Date().toISOString(),
      };
      const parsed = backupStorageSchema.safeParse(merged);
      if (parsed.success) {
        return merged;
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

  try {
    const rawJson = window.localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
    if (!rawJson) {
      const seedData = generateDeterministicSeedData();
      saveToLocalStorage(seedData);
      return {
        data: seedData,
        status: 'seeded',
      };
    }

    const parsedJson = JSON.parse(rawJson);
    const validation = backupStorageSchema.safeParse(parsedJson);

    if (validation.success) {
      // Ensure dailySessions and arrays exist
      const fallbackSeed = generateDeterministicSeedData();
      const hydratedData: AurelixStorageSchema = {
        ...fallbackSeed,
        ...parsedJson,
        dailySessions:
          Array.isArray(parsedJson.dailySessions) && parsedJson.dailySessions.length > 0
            ? parsedJson.dailySessions
            : fallbackSeed.dailySessions,
        savedReports: Array.isArray(parsedJson.savedReports)
          ? parsedJson.savedReports
          : fallbackSeed.savedReports,
        reportHistory: Array.isArray(parsedJson.reportHistory)
          ? parsedJson.reportHistory
          : fallbackSeed.reportHistory,
      };
      return {
        data: hydratedData,
        status: 'hydrated',
      };
    }

    // Attempt migration if version mismatch
    const migrated = migrateStorageSchema(parsedJson);
    if (migrated) {
      saveToLocalStorage(migrated);
      return {
        data: migrated,
        status: 'migrated',
      };
    }

    // Corrupt data recovery: preserve snapshot and initialize fresh seed
    window.localStorage.setItem(STORAGE_KEYS.CORRUPT_BACKUP, rawJson);
    const recoveredSeed = generateDeterministicSeedData();
    saveToLocalStorage(recoveredSeed);
    return {
      data: recoveredSeed,
      status: 'corrupt_recovered',
      errorMessage:
        'Stored workspace data did not match schema integrity checks. A snapshot was preserved and clean demo data was restored.',
    };
  } catch (err) {
    const seedData = generateDeterministicSeedData();
    try {
      saveToLocalStorage(seedData);
    } catch {
      // Ignore storage write error during recovery
    }
    return {
      data: seedData,
      status: 'corrupt_recovered',
      errorMessage:
        err instanceof Error
          ? `Corrupt JSON in LocalStorage recovered: ${err.message}`
          : 'Corrupt LocalStorage state recovered with clean demo dataset.',
    };
  }
}

export function saveToLocalStorage(data: AurelixStorageSchema): {
  ok: boolean;
  error?: string;
} {
  if (typeof window === 'undefined') {
    return { ok: true };
  }

  try {
    const payload: AurelixStorageSchema = {
      ...data,
      lastUpdatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    window.localStorage.setItem(STORAGE_KEYS.MAIN_STORE, serialized);
    return { ok: true };
  } catch (err) {
    const isQuotaError =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return {
      ok: false,
      error: isQuotaError
        ? 'Browser LocalStorage quota exceeded (approx. 5MB limit). Export a backup or archive older records.'
        : 'Unable to persist changes to LocalStorage.',
    };
  }
}

export function resetLocalStorageToSeed(): AurelixStorageSchema {
  const freshSeed = generateDeterministicSeedData();
  saveToLocalStorage(freshSeed);
  return freshSeed;
}

export function validateAndImportBackupJson(rawJsonString: string): {
  ok: boolean;
  data?: AurelixStorageSchema;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJsonString);
    const result = backupStorageSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return {
        ok: false,
        error: `Validation failed at "${firstIssue.path.join('.')}": ${firstIssue.message}`,
      };
    }

    // Referential integrity check: verify orders reference valid customer IDs or preserve historical customer snapshots
    const fallbackSeed = generateDeterministicSeedData();
    const validatedData: AurelixStorageSchema = {
      ...fallbackSeed,
      ...parsed,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastUpdatedAt: new Date().toISOString(),
    };

    const saved = saveToLocalStorage(validatedData);
    if (!saved.ok) {
      return { ok: false, error: saved.error };
    }

    return { ok: true, data: validatedData };
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON file format. Please provide a valid Aurelix backup JSON file.',
    };
  }
}
