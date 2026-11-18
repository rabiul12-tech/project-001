'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  LineChart,
  DollarSign,
  Users,
  ShoppingCart,
  Package,
  FileSpreadsheet,
  Activity,
  UserCheck,
  Settings,
  BookOpen,
  Sun,
  Moon,
  Download,
  RotateCcw,
  ArrowRight,
  X,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceAction } from '@/hooks/useWorkspaceAction';
import { formatCurrency, triggerBrowserDownload } from '@/lib/export/exporter';
import { canPerformAction, getPermissionDeniedMessage } from '@/lib/permissions';
import { ConfirmDialog } from '@/components/ui/overlays';

export function LayoutDialog({
  label,
  onDismiss,
  returnFocusRef,
  initialFocusRef,
  className,
  children,
}: {
  label: string;
  onDismiss: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  initialFocusRef?: React.RefObject<HTMLInputElement | null>;
  className: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const returnFocus = returnFocusRef.current;
    dialog.showModal();
    initialFocusRef?.current?.focus({ preventScroll: true });

    return () => {
      dialog.close();
      if (document.activeElement === document.body) {
        returnFocus?.focus({ preventScroll: true });
      }
    };
  }, [initialFocusRef, returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;

        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select')
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            element.getClientRects().length > 0
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        const from = event.shiftKey ? first : last;
        const to = event.shiftKey ? last : first;

        if (event.target === from && to) {
          event.preventDefault();
          to.focus();
        }
      }}
      className={`fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-transparent text-ink open:flex backdrop:bg-slate-950/60 backdrop:backdrop-blur-[1px] ${className}`}
    >
      {children}
    </dialog>
  );
}

export function CommandPalette({
  triggerRef,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const customers = useAppStore((s) => s.customers);
  const orders = useAppStore((s) => s.orders);
  const products = useAppStore((s) => s.products);
  const settings = useAppStore((s) => s.settings);
  const toggleTheme = useWorkspaceAction((s) => s.toggleTheme);
  const getExportSnapshot = useAppStore((s) => s.getExportSnapshot);
  const resetDemoData = useWorkspaceAction((s) => s.resetDemoData);
  const addToast = useAppStore((s) => s.addToast);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canManageBackups = canPerformAction(settings.activeRolePreview, 'manage_backups_and_reset');

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, [setOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!open && document.querySelector('dialog:modal, [role="dialog"][aria-modal="true"]')) return;

        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          setActiveIndex(0);
          setOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen, closePalette]);

  const navItems = useMemo(
    () => [
      { label: 'Executive Overview', href: '/dashboard', icon: LayoutDashboard, group: 'Navigation' },
      { label: 'Deep Analytics', href: '/dashboard/analytics', icon: LineChart, group: 'Navigation' },
      { label: 'Revenue Intelligence', href: '/dashboard/revenue', icon: DollarSign, group: 'Navigation' },
      { label: 'Customers Directory', href: '/dashboard/customers', icon: Users, group: 'Navigation' },
      { label: 'Order Ledger', href: '/dashboard/orders', icon: ShoppingCart, group: 'Navigation' },
      { label: 'Product Catalog', href: '/dashboard/products', icon: Package, group: 'Navigation' },
      { label: 'Reporting Center', href: '/dashboard/reports', icon: FileSpreadsheet, group: 'Navigation' },
      { label: 'Activity & Audit Log', href: '/dashboard/activity', icon: Activity, group: 'Navigation' },
      { label: 'Team & Role Preview', href: '/dashboard/team', icon: UserCheck, group: 'Navigation' },
      { label: 'Workspace Settings', href: '/dashboard/settings', icon: Settings, group: 'Navigation' },
      { label: 'Help & Documentation', href: '/dashboard/help', icon: BookOpen, group: 'Navigation' },
    ],
    []
  );

  const q = query.trim().toLowerCase();

  const filteredNav = useMemo(() => {
    if (!q) return navItems;
    return navItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [navItems, q]);

  const matchedCustomers = useMemo(() => {
    if (q.length < 2) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [customers, q]);

  const matchedOrders = useMemo(() => {
    if (q.length < 2) return [];
    return orders
      .filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerCompany.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [orders, q]);

  const matchedProducts = useMemo(() => {
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [products, q]);

  const navigateTo = useCallback(
    (href: string) => {
      closePalette();
      router.push(href);
    },
    [closePalette, router]
  );

  const handleExportBackup = useCallback(() => {
    if (!canManageBackups) {
      addToast(
        'Permission restricted',
        getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset'),
        'warning'
      );
      closePalette();
      return;
    }
    const snap = getExportSnapshot();
    triggerBrowserDownload(
      JSON.stringify(snap, null, 2),
      `aurelix-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    addToast('Workspace backup exported', 'Downloaded JSON snapshot.', 'success');
    closePalette();
  }, [canManageBackups, settings.activeRolePreview, getExportSnapshot, addToast, closePalette]);

  const handleRequestReset = useCallback(() => {
    if (!canManageBackups) {
      addToast(
        'Permission restricted',
        getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset'),
        'warning'
      );
      closePalette();
      return;
    }
    closePalette();
    setConfirmResetOpen(true);
  }, [canManageBackups, settings.activeRolePreview, addToast, closePalette]);

  if (!open) {
    return (
      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={resetDemoData}
        title="Reset Workspace to Default Demo Data?"
        description="This will overwrite any custom customers, orders, products, or settings stored in your browser's LocalStorage and restore the original deterministic seed dataset."
        confirmLabel="Restore Default Seed"
      />
    );
  }

  const navOffset = 0;
  const custOffset = filteredNav.length;
  const ordOffset = custOffset + matchedCustomers.length;
  const prodOffset = ordOffset + matchedOrders.length;
  const sysOffset = prodOffset + matchedProducts.length;
  const systemActions = [
    {
      id: 'theme',
      label: `Switch to ${settings.theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      badge: 'Theme',
      icon: settings.theme === 'dark'
        ? <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
        : <Moon className="w-4 h-4 text-ink-secondary" aria-hidden="true" />,
      run: () => {
        void toggleTheme();
        closePalette();
      },
      disabled: false,
    },
    {
      id: 'backup',
      label: 'Export Full Workspace JSON Backup',
      badge: 'JSON',
      icon: <Download className="w-4 h-4 text-success" aria-hidden="true" />,
      run: handleExportBackup,
      disabled: !canManageBackups,
    },
    {
      id: 'reset',
      label: 'Reset Workspace to Default Seed Data',
      badge: 'Reset',
      icon: <RotateCcw className="w-4 h-4" aria-hidden="true" />,
      run: handleRequestReset,
      disabled: !canManageBackups,
    },
  ].filter(({ label, badge }) => `${label} ${badge}`.toLowerCase().includes(q));
  const enabledSystemActions = systemActions.filter(({ disabled }) => !disabled);
  const selectableActions = [
    ...filteredNav.map((item) => () => navigateTo(item.href)),
    ...matchedCustomers.map((c) => () => navigateTo(`/dashboard/customers?search=${encodeURIComponent(c.company)}`)),
    ...matchedOrders.map((o) => () => navigateTo(`/dashboard/orders?search=${encodeURIComponent(o.orderNumber)}`)),
    ...matchedProducts.map((p) => () => navigateTo(`/dashboard/products?search=${encodeURIComponent(p.sku)}`)),
    ...enabledSystemActions.map(({ run }) => run),
  ];
  const clampedIndex =
    selectableActions.length > 0
      ? Math.min(activeIndex, selectableActions.length - 1)
      : -1;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || selectableActions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((clampedIndex + 1) % selectableActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((clampedIndex - 1 + selectableActions.length) % selectableActions.length);
    } else if (e.key === 'Enter' && clampedIndex >= 0) {
      e.preventDefault();
      selectableActions[clampedIndex]?.();
    }
  };

  return (
    <LayoutDialog
      label="Command Palette"
      onDismiss={closePalette}
      returnFocusRef={triggerRef}
      initialFocusRef={searchInputRef}
      className="items-start justify-center p-4 pt-16 sm:pt-24"
    >
      <div className="relative w-full max-w-xl rounded-xl bg-surface-raised border border-line shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <Search className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            name="workspaceSearch"
            aria-label="Search workspace"
            value={query}
            onKeyDown={handleSearchKeyDown}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to page, search customers, orders, SKUs, or run command..."
            className="w-full bg-transparent text-sm text-ink placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={closePalette}
            aria-label="Close command palette"
            className="p-1 text-ink-muted hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-2 space-y-4">
          {sysOffset === 0 && systemActions.length === 0 && (
            <p role="status" className="px-3 py-2 text-sm text-ink-muted">
              No matching results.
            </p>
          )}

          {filteredNav.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-micro text-ink-muted">
                Pages & Workspaces
              </div>
              <div className="space-y-0.5">
                {filteredNav.map((item, idx) => {
                  const Icon = item.icon;
                  const globalIdx = navOffset + idx;
                  const isActive = globalIdx === clampedIndex;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => navigateTo(item.href)}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onFocus={() => setActiveIndex(globalIdx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-surface-hover text-ink'
                          : 'text-ink-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-accent" />
                        <span>{item.label}</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-muted" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {matchedCustomers.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-micro text-ink-muted">
                Matching Customers
              </div>
              <div className="space-y-0.5">
                {matchedCustomers.map((c, idx) => {
                  const globalIdx = custOffset + idx;
                  const isActive = globalIdx === clampedIndex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigateTo(`/dashboard/customers?search=${encodeURIComponent(c.company)}`)}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onFocus={() => setActiveIndex(globalIdx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-surface-hover text-ink'
                          : 'text-ink-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="font-medium">
                        {c.company} <span className="text-xs text-ink-muted font-normal">· {c.name}</span>
                      </span>
                      <span className="text-xs tabular-nums text-ink-muted">{c.segment}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {matchedOrders.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-micro text-ink-muted">
                Matching Orders
              </div>
              <div className="space-y-0.5">
                {matchedOrders.map((o, idx) => {
                  const globalIdx = ordOffset + idx;
                  const isActive = globalIdx === clampedIndex;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => navigateTo(`/dashboard/orders?search=${encodeURIComponent(o.orderNumber)}`)}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onFocus={() => setActiveIndex(globalIdx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-surface-hover text-ink'
                          : 'text-ink-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="tabular-nums font-medium">
                        {o.orderNumber}{' '}
                        <span className="font-sans text-xs text-ink-muted font-normal">
                          · {o.customerCompany}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-ink-secondary">
                        {formatCurrency(o.totalAmount, settings.currency, settings.numberFormat)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {matchedProducts.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-micro text-ink-muted">
                Matching Products
              </div>
              <div className="space-y-0.5">
                {matchedProducts.map((p, idx) => {
                  const globalIdx = prodOffset + idx;
                  const isActive = globalIdx === clampedIndex;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigateTo(`/dashboard/products?search=${encodeURIComponent(p.sku)}`)}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onFocus={() => setActiveIndex(globalIdx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-surface-hover text-ink'
                          : 'text-ink-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="font-medium">
                        {p.name} <span className="text-xs tabular-nums text-ink-muted">· {p.sku}</span>
                      </span>
                      <span className="text-xs tabular-nums text-ink-secondary">
                        {formatCurrency(p.unitPrice, settings.currency, settings.numberFormat)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {systemActions.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-micro text-ink-muted">
                System Actions
              </div>
              <div className="space-y-0.5">
                {systemActions.map((action) => {
                  const index = sysOffset + enabledSystemActions.indexOf(action);
                  const isActive = !action.disabled && index === clampedIndex;
                  const isReset = action.id === 'reset';
                  const colors = isReset
                    ? `text-danger ${isActive ? 'bg-red-500/15' : 'hover:bg-red-500/10'}`
                    : isActive ? 'bg-surface-hover text-ink' : 'text-ink-secondary hover:bg-surface-hover';
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled}
                      title={action.disabled ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset') : undefined}
                      onClick={action.run}
                      onMouseEnter={() => { if (!action.disabled) setActiveIndex(index); }}
                      onFocus={() => setActiveIndex(index)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors}`}
                    >
                      <span className="flex items-center gap-2.5">
                        {action.icon}
                        <span>{action.label}</span>
                      </span>
                      <span className={`text-xs tabular-nums ${isReset ? '' : 'text-ink-muted'}`}>{action.badge}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-line bg-surface-sunken flex items-center justify-between text-xs text-ink-muted">
          <span>Use arrow keys + Enter or click to navigate</span>
          <span className="tabular-nums">ESC to close</span>
        </div>
      </div>
    </LayoutDialog>
  );
}
