'use client';

import React, { useEffect } from 'react';
import { X, AlertTriangle, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';

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
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-[1px]">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-xl bg-white dark:bg-[#141C2D] border-l border-slate-200 dark:border-[#273247] h-full flex flex-col shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-[#273247]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2639] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-[#273247] bg-slate-50 dark:bg-[#0F1625] flex items-center justify-end gap-2.5">
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
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[1px]">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full ${maxWidth} rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-[#273247]">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2639] transition-colors"
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
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#273247] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1B2639] transition-colors whitespace-nowrap shrink-0"
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
                : 'bg-blue-600 hover:bg-blue-700'
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
    <div className="py-12 px-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-[#273247] bg-slate-50/50 dark:bg-[#0F1625]/40 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-slate-200/70 dark:bg-[#1B2639] flex items-center justify-center text-slate-500 dark:text-slate-400">
        <Inbox className="w-5 h-5" />
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-[#273247] text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center gap-3">
        <span className="font-mono tabular-nums">
          Showing {startItem}–{endItem} of {totalItems} records
        </span>
        {onPageSizeChange && (
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 rounded-md bg-white dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] text-slate-800 dark:text-slate-200 text-xs font-mono"
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
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#273247] bg-white dark:bg-[#0F1625] text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#1B2639] transition-colors whitespace-nowrap shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>
        <span className="px-3 py-1 font-mono tabular-nums text-slate-700 dark:text-slate-300">
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#273247] bg-white dark:bg-[#0F1625] text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#1B2639] transition-colors whitespace-nowrap shrink-0"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
