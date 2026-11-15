'use client';

import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';

function useDialogFocusTrap(
  open: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (container) {
      const focusable = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && container) {
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open, containerRef, onClose]);
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
  const drawerRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusTrap(open, drawerRef, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-[1px]">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-xl bg-surface-raised border-l border-line h-full flex flex-col shadow-2xl focus:outline-none"
      >
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
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-line bg-surface-sunken flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
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
  const modalRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusTrap(open, modalRef, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[1px]">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full ${maxWidth} rounded-xl bg-surface-raised border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh] focus:outline-none`}
      >
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
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
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
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
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
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-xs font-medium rounded-lg text-white transition-colors whitespace-nowrap shrink-0 ${
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
