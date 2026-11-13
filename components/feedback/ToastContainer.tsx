'use client';

import React from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none no-print"
    >
      {toasts.map((t) => {
        const Icon =
          t.variant === 'success'
            ? CheckCircle2
            : t.variant === 'warning'
            ? AlertTriangle
            : t.variant === 'error'
            ? XCircle
            : Info;

        const iconColor =
          t.variant === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : t.variant === 'warning'
            ? 'text-amber-600 dark:text-amber-400'
            : t.variant === 'error'
            ? 'text-red-600 dark:text-red-400'
            : 'text-blue-600 dark:text-blue-400';

        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-lg text-slate-900 dark:text-slate-100 transition-all duration-150"
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight">{t.title}</p>
              {t.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
