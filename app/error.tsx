'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Aurelix root application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface text-ink flex items-center justify-center p-6">
      <div className="max-w-md w-full p-6 rounded-2xl bg-surface-raised border border-line shadow-xl space-y-5 text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 text-danger flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-heading text-ink">Unexpected Application Error</h1>
          <p className="text-sm text-ink-secondary leading-relaxed">
            A rendering error interrupted the workspace view. Your persisted LocalStorage workspace data remains untouched.
          </p>
          {error.message && (
            <p className="text-xs text-ink-muted bg-surface-sunken border border-line rounded-lg px-3 py-2 break-words">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry View</span>
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-surface-sunken border border-line text-ink-secondary hover:bg-surface-hover transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
