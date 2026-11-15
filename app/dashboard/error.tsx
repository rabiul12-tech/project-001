'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, LayoutDashboard } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Aurelix dashboard route error:', error);
  }, [error]);

  return (
    <div className="py-12 px-4 flex items-center justify-center">
      <div className="max-w-lg w-full p-6 rounded-2xl bg-surface-raised border border-line shadow-lg space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-danger flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-heading text-ink">Dashboard View Encountered an Error</h1>
            <p className="text-sm text-ink-secondary leading-relaxed">
              This section failed to render cleanly. You can retry loading the view or navigate back to the Executive Overview.
            </p>
            {error.message && (
              <p className="text-xs text-ink-muted bg-surface-sunken border border-line rounded-lg px-3 py-2 break-words mt-2">
                {error.message}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-line-subtle">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-surface-sunken border border-line text-ink-secondary hover:bg-surface-hover transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Executive Overview</span>
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
