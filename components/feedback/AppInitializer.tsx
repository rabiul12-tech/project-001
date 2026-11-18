'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { runWorkspaceTransaction, STORAGE_KEYS } from '@/lib/storage/repository';
import { ToastContainer } from '@/components/feedback/ToastContainer';

export function AppInitializer({ children }: { children: React.ReactNode }) {
  const hydrateStore = useAppStore((s) => s.hydrateStore);
  const syncFromExternalStorage = useAppStore((s) => s.syncFromExternalStorage);
  const isHydrated = useAppStore((s) => s.isHydrated);
  const theme = useAppStore((s) => s.settings.theme);
  const recoveryAlertMessage = useAppStore((s) => s.recoveryAlertMessage);
  const storageQuotaError = useAppStore((s) => s.storageQuotaError);
  const dismissRecoveryAlert = useAppStore((s) => s.dismissRecoveryAlert);
  const dismissStorageError = useAppStore((s) => s.dismissStorageError);

  useEffect(() => {
    void runWorkspaceTransaction(() => {
      if (!useAppStore.getState().isHydrated) hydrateStore();
    });
  }, [hydrateStore]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.MAIN_STORE) {
        syncFromExternalStorage();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [syncFromExternalStorage]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <>
      {isHydrated && recoveryAlertMessage && (
        <div
          role="alert"
          className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-xs text-warning flex items-center justify-between gap-4"
        >
          <span>{recoveryAlertMessage}</span>
          <button
            type="button"
            onClick={dismissRecoveryAlert}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Acknowledge
          </button>
        </div>
      )}
      {isHydrated && storageQuotaError && (
        <div
          role="alert"
          className="bg-red-500/10 border-b border-red-500/30 px-4 py-2.5 text-xs text-danger flex items-center justify-between gap-4"
        >
          <span>{storageQuotaError}</span>
          <button
            type="button"
            onClick={dismissStorageError}
            className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
      <ToastContainer />
    </>
  );
}
