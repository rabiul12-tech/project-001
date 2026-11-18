'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { X, AlertTriangle, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';

function OverlayDialog({ title, onClose, className, children }: {
  title: string;
  onClose: () => void;
  className: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const parentDialog = trigger?.closest('dialog');
    dialog.showModal();

    return () => {
      dialog.close();
      // The action can remove its trigger, for example after a successful refund.
      queueMicrotask(() => {
        if (dialog.open || document.activeElement !== document.body) return;
        if (trigger?.isConnected && trigger !== document.body && !trigger.matches(':disabled')) {
          trigger.focus({ preventScroll: true });
        }
        if (document.activeElement === document.body && parentDialog?.open) {
          parentDialog.querySelector<HTMLElement>('[data-dialog-close]')?.focus({ preventScroll: true });
        }
      });
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-transparent text-ink open:flex backdrop:bg-slate-950/60 backdrop:backdrop-blur-[1px] ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]'
        )].filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable.at(-1);
        const boundary = event.shiftKey ? first : last;
        if (boundary && document.activeElement === boundary) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
    >
      {children}
    </dialog>
  );
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <OverlayDialog title={title} onClose={onClose} className="justify-end">
      <div className="w-full max-w-xl bg-surface-raised border-l border-line h-full flex flex-col shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-line">
          <div>
            <h2 className="text-heading text-ink">{title}</h2>
            {subtitle && (
              <p className="text-xs text-ink-muted mt-1">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            data-dialog-close
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-line bg-surface-sunken flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </OverlayDialog>
  );
}

export function ModalDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;

  return (
    <OverlayDialog title={title} onClose={onClose} className="items-center justify-center p-4">
      <div className={`w-full ${maxWidth} rounded-xl bg-surface-raised border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-line">
          <div>
            <h2 className="text-heading text-ink">{title}</h2>
            {subtitle && (
              <p className="text-xs text-ink-muted mt-1">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            data-dialog-close
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </OverlayDialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!open) return null;

  return (
    <ModalDialog open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-5">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              destructive
                ? 'bg-red-500/10 text-danger'
                : 'bg-blue-500/10 text-accent'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-ink-secondary leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-line text-ink-secondary hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={async () => {
              setConfirming(true);
              try {
                if (await onConfirm() !== false) onClose();
              } finally {
                setConfirming(false);
              }
            }}
            className={`px-4 py-2 text-xs font-medium rounded-lg text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-accent-strong hover:bg-accent-strong-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="py-12 px-6 text-center rounded-xl border border-dashed border-line bg-surface-sunken/40 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-surface-hover/70 flex items-center justify-center text-ink-muted">
        <Inbox className="w-5 h-5" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-subheading text-ink">{title}</h3>
        <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 px-4 py-2 text-xs font-medium rounded-lg bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-line text-xs text-ink-muted">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          Showing {startItem}–{endItem} of {totalItems} records
        </span>
        {onPageSizeChange && (
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 rounded-md bg-surface-chrome border border-line text-ink-secondary text-xs tabular-nums"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface-chrome text-ink-secondary disabled:opacity-40 hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>
        <span className="px-3 py-1 tabular-nums text-ink-secondary">
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface-chrome text-ink-secondary disabled:opacity-40 hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
