import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDeterministicSeedData } from '@/lib/demo-data/seed';
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  STORAGE_KEYS,
} from '@/lib/storage/repository';
import { useAppStore } from '@/stores/useAppStore';

describe('workspace persistence and recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retains an initialized workspace after its last customer is deleted and the backup round-trips', () => {
    const fixture = generateDeterministicSeedData();
    fixture.customers = fixture.customers.slice(0, 1);
    fixture.settings.workspaceName = 'Saved Workspace';
    const store = useAppStore.getState();
    expect(store.importBackupJson(JSON.stringify(fixture)).ok).toBe(true);
    const beforeDelete = store.getExportSnapshot();
    store.deleteCustomers([fixture.customers[0].id]);

    const reloaded = loadFromLocalStorage();
    expect(reloaded.status).toBe('hydrated');
    expect(reloaded.data).toMatchObject({
      customers: [],
      products: beforeDelete.products,
      orders: beforeDelete.orders,
      savedReports: beforeDelete.savedReports,
      reportHistory: beforeDelete.reportHistory,
      settings: beforeDelete.settings,
    });

    const exported = useAppStore.getState().getExportSnapshot();
    expect(exported.customers).toEqual([]);
    expect(store.importBackupJson(JSON.stringify(exported)).ok).toBe(true);
    expect(loadFromLocalStorage().data.customers).toEqual([]);
  });

  it('preserves the exact malformed JSON before creating the recovery workspace', () => {
    const original = '{"partial workspace":';
    localStorage.setItem(STORAGE_KEYS.MAIN_STORE, original);
    expect(loadFromLocalStorage().status).toBe('corrupt_recovered');
    expect(localStorage.getItem(STORAGE_KEYS.CORRUPT_BACKUP)).toBe(original);
    expect(loadFromLocalStorage().status).toBe('hydrated');
  });

  it('protects the original when the recovery slot already holds another snapshot', () => {
    const original = '{"schemaVersion":1,"orders":null}';
    localStorage.setItem(STORAGE_KEYS.MAIN_STORE, original);
    localStorage.setItem(STORAGE_KEYS.CORRUPT_BACKUP, 'previous snapshot');

    const result = loadFromLocalStorage();
    expect(result.status).toBe('recovery_pending');
    expect(saveToLocalStorage(result.data).ok).toBe(false);
    useAppStore.getState().hydrateStore();
    const recoveryNotice = useAppStore.getState().recoveryAlertMessage;
    useAppStore.getState().resetDemoData();
    expect(useAppStore.getState().recoveryAlertMessage).toBe(recoveryNotice);
    expect(useAppStore.getState().storageQuotaError).toMatch(/protected/);
    expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)).toBe(original);
    expect(localStorage.getItem(STORAGE_KEYS.CORRUPT_BACKUP)).toBe('previous snapshot');
  });

  it('blocks stale fallback writes after another tab restores the workspace', () => {
    localStorage.setItem(STORAGE_KEYS.MAIN_STORE, '{broken');
    localStorage.setItem(STORAGE_KEYS.CORRUPT_BACKUP, 'previous snapshot');
    const blocked = loadFromLocalStorage();
    expect(blocked.status).toBe('recovery_pending');

    const restored = generateDeterministicSeedData();
    restored.settings.workspaceName = 'Restored from another tab';
    localStorage.setItem(STORAGE_KEYS.MAIN_STORE, JSON.stringify(restored));
    expect(saveToLocalStorage(blocked.data).ok).toBe(false);
    const reloaded = loadFromLocalStorage();
    expect(reloaded.data.settings.workspaceName).toBe(restored.settings.workspaceName);
    expect(saveToLocalStorage(reloaded.data).ok).toBe(true);
  });

  it.each([STORAGE_KEYS.CORRUPT_BACKUP, STORAGE_KEYS.MAIN_STORE])(
    'retains the primary value if a recovery write for %s exceeds quota',
    (failedKey) => {
      const original = '{"schemaVersion":1,"orders":null}';
      localStorage.setItem(STORAGE_KEYS.MAIN_STORE, original);
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
        if (key === failedKey) throw new DOMException('Full', 'QuotaExceededError');
        setItem.call(this, key, value);
      });
      const result = loadFromLocalStorage();
      expect(result.status).toBe('recovery_pending');
      expect(result.errorMessage).toMatch(/quota/i);
      expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)).toBe(original);
      expect(saveToLocalStorage(result.data).ok).toBe(false);
      expect(localStorage.getItem(STORAGE_KEYS.CORRUPT_BACKUP)).toBe(
        failedKey === STORAGE_KEYS.MAIN_STORE ? original : null
      );
    }
  );

  it('distinguishes unavailable storage from malformed data without attempting writes', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const result = loadFromLocalStorage();
    expect(result.status).toBe('unavailable');
    expect(result.errorMessage).toMatch(/localstorage/i);
    expect(writes).not.toHaveBeenCalled();
  });

  it('seeds only a missing key and migrates a legacy empty collection', () => {
    expect(loadFromLocalStorage().status).toBe('seeded');
    const fixture = generateDeterministicSeedData();
    fixture.customers = [];
    fixture.settings.workspaceName = 'Legacy Workspace';
    localStorage.setItem(STORAGE_KEYS.MAIN_STORE, JSON.stringify({ ...fixture, schemaVersion: 0 }));
    const result = loadFromLocalStorage();
    expect(result.status).toBe('migrated');
    expect(result.data.customers).toEqual([]);
    expect(result.data.settings.workspaceName).toBe('Legacy Workspace');
    expect(result.data.orders).toEqual(fixture.orders);
  });
});
