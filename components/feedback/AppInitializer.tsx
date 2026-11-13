'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ToastContainer } from '@/components/feedback/ToastContainer';

export function AppInitializer({ children }: { children: React.ReactNode }) {
  const hydrateStore = useAppStore((s) => s.hydrateStore);
  const isHydrated = useAppStore((s) => s.isHydrated);
  const theme = useAppStore((s) => s.settings.theme);
  const recoveryAlertMessage = useAppStore((s) => s.recoveryAlertMessage);
  const dismissRecoveryAlert = useAppStore((s) => s.dismissRecoveryAlert);

  useEffect(() => {
    hydrateStore();
  }, [hydrateStore]);

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
          className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-4"
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
      {children}
      <ToastContainer />
    </>
  );
}
