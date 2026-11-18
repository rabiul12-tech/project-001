import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { runWorkspaceTransaction, STORAGE_KEYS } from '@/lib/storage/repository';
import { useAppStore } from '@/stores/useAppStore';

const getState = useAppStore.getState;
const persisted = () => localStorage.getItem(STORAGE_KEYS.MAIN_STORE);

beforeEach(() => {
  localStorage.clear();
  getState().hydrateStore();
  useAppStore.setState({ toasts: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('workspace write integrity', () => {
  it.each(['QuotaExceededError', 'SecurityError'])('keeps the previous settings if save throws %s, then retries', (errorName) => {
    const original = persisted();
    const originalSettings = getState().settings;
    const originalActivities = getState().activities;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Write rejected', errorName);
    });

    expect(getState().updateSettings({ workspaceName: 'Unsaved preferences' })).toMatchObject({ ok: false });
    expect(persisted() === original).toBe(true);
    expect(getState().settings === originalSettings).toBe(true);
    expect(getState().activities === originalActivities).toBe(true);
    expect(getState().toasts.some((toast) => toast.title === 'Settings saved')).toBe(false);

    write.mockRestore();
    expect(getState().updateSettings({ workspaceName: 'Saved after retry' })).toMatchObject({ ok: true });
    getState().hydrateStore();
    expect(getState().settings.workspaceName).toBe('Saved after retry');
  });

  it('synchronizes authoritative empty reports and sessions before the next unrelated write', () => {
    const external = { ...getState().getExportSnapshot(), savedReports: [], reportHistory: [], dailySessions: [] };
    localStorage.setItem(STORAGE_KEYS.MAIN_STORE, JSON.stringify(external));
    getState().syncFromExternalStorage();
    expect(getState().savedReports.length).toBe(0);
    expect(getState().reportHistory.length).toBe(0);
    expect(getState().dailySessions.length).toBe(0);
    getState().toggleTheme();
    getState().hydrateStore();
    expect(getState().savedReports.length).toBe(0);
    expect(getState().reportHistory.length).toBe(0);
    expect(getState().dailySessions.length).toBe(0);
  });

  it('rejects a stale write before the storage event and preserves a newer tab’s settings', () => {
    const newest = getState().getExportSnapshot();
    newest.reportHistory = [];
    newest.settings = { ...newest.settings, workspaceName: 'Newer tab saved this' };
    const payload = JSON.stringify(newest);
    localStorage.setItem(STORAGE_KEYS.MAIN_STORE, payload);

    const update = getState().updateSettings({ personalTitle: 'Retry title' });
    expect(update).toMatchObject({ ok: false, conflict: true });
    expect(persisted() === payload).toBe(true);
    expect(getState().settings.workspaceName).toBe('Newer tab saved this');
    expect(getState().reportHistory.length).toBe(0);

    expect(getState().updateSettings({ personalTitle: 'Retry title' })).toMatchObject({ ok: true });
    getState().hydrateStore();
    expect(getState().settings).toMatchObject({ workspaceName: 'Newer tab saved this', personalTitle: 'Retry title' });
    expect(getState().reportHistory.length).toBe(0);
  });

  it('waits for a published revision when the next lock sees an outdated LocalStorage view', async () => {
    const newer = getState().getExportSnapshot();
    newer.settings = { ...newer.settings, workspaceName: 'Published tab revision' };
    const published = JSON.stringify(newer);
    const digest = createHash('sha256').update(published).digest('hex');
    const name = `${STORAGE_KEYS.MAIN_STORE}:revision:${digest}`;
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('navigator', {
      locks: {
        query: async () => ({ held: [{ name }], pending: [] }),
        request: async (_name: string, callback: () => unknown) => callback(),
      },
    });
    const read = Storage.prototype.getItem;
    let delayed = true;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      const value = read.call(this, key);
      if (key === STORAGE_KEYS.MAIN_STORE && delayed) {
        delayed = false;
        queueMicrotask(() => localStorage.setItem(key, published));
      }
      return value;
    });

    const result = await runWorkspaceTransaction(() => getState().updateSettings({ personalTitle: 'Rejected draft' }));
    expect(result).toMatchObject({ ok: false, conflict: true });
    expect(persisted() === published).toBe(true);
    expect(getState().settings.workspaceName).toBe('Published tab revision');
  });

  it.each(['import', 'reset'])('also guards a stale explicit %s', (operation) => {
    const original = getState().getExportSnapshot();
    const newer = JSON.stringify({ ...original, savedReports: [], reportHistory: [] });
    localStorage.setItem(STORAGE_KEYS.MAIN_STORE, newer);

    if (operation === 'import') {
      expect(getState().importBackupJson(JSON.stringify(original)).ok).toBe(false);
    } else {
      getState().resetDemoData();
      expect(getState().toasts.some((toast) => toast.title === 'Demo dataset restored')).toBe(false);
    }
    expect(persisted() === newer).toBe(true);
  });
});
