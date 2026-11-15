'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { formatCurrency, triggerBrowserDownload } from '@/lib/export/exporter';
import { canPerformAction, getPermissionDeniedMessage } from '@/lib/permissions';
import { ConfirmDialog } from '@/components/ui/overlays';

export function CommandPalette() {
  const router = useRouter();
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const customers = useAppStore((s) => s.customers);
  const orders = useAppStore((s) => s.orders);
  const products = useAppStore((s) => s.products);
  const settings = useAppStore((s) => s.settings);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const getExportSnapshot = useAppStore((s) => s.getExportSnapshot);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const addToast = useAppStore((s) => s.addToast);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const canManageBackups = canPerformAction(settings.activeRolePreview, 'manage_backups_and_reset');

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, [setOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          setActiveIndex(0);
          setOpen(true);
        }
      } else if (e.key === 'Escape' && open) {
        closePalette();
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

  const selectableActions = useMemo(() => {
    const list: Array<() => void> = [];
    for (const item of filteredNav) {
      list.push(() => navigateTo(item.href));
    }
    for (const c of matchedCustomers) {
      list.push(() => navigateTo(`/dashboard/customers?search=${encodeURIComponent(c.company)}`));
    }
    for (const o of matchedOrders) {
      list.push(() => navigateTo(`/dashboard/orders?search=${encodeURIComponent(o.orderNumber)}`));
    }
    for (const p of matchedProducts) {
      list.push(() => navigateTo(`/dashboard/products?search=${encodeURIComponent(p.sku)}`));
    }
    list.push(() => {
      toggleTheme();
      closePalette();
    });
    list.push(() => handleExportBackup());
    list.push(() => handleRequestReset());
    return list;
  }, [
    filteredNav,
    matchedCustomers,
    matchedOrders,
    matchedProducts,
    navigateTo,
    toggleTheme,
    closePalette,
    handleExportBackup,
    handleRequestReset,
  ]);

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
  const clampedIndex =
    selectableActions.length > 0
      ? Math.min(activeIndex, selectableActions.length - 1)
      : -1;

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (selectableActions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % selectableActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + selectableActions.length) % selectableActions.length);
    } else if (e.key === 'Enter' && clampedIndex >= 0) {
      e.preventDefault();
      selectableActions[clampedIndex]?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/60 backdrop-blur-[1px]">
      <div className="fixed inset-0" onClick={closePalette} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onKeyDown={handleDialogKeyDown}
        className="relative z-10 w-full max-w-xl rounded-xl bg-surface-raised border border-line shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <Search className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
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

        <div className="overflow-y-auto p-2 space-y-4">
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

          <div>
            <div className="px-3 py-1.5 text-micro text-ink-muted">
              System Actions
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  closePalette();
                }}
                onMouseEnter={() => setActiveIndex(sysOffset)}
                onFocus={() => setActiveIndex(sysOffset)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  clampedIndex === sysOffset
                    ? 'bg-surface-hover text-ink'
                    : 'text-ink-secondary hover:bg-surface-hover'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {settings.theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-ink-secondary" />
                  )}
                  <span>
                    Switch to {settings.theme === 'dark' ? 'Light' : 'Dark'} Mode
                  </span>
                </span>
                <span className="text-xs text-ink-muted tabular-nums">Theme</span>
              </button>

              <button
                type="button"
                disabled={!canManageBackups}
                title={!canManageBackups ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset') : undefined}
                onClick={handleExportBackup}
                onMouseEnter={() => setActiveIndex(sysOffset + 1)}
                onFocus={() => setActiveIndex(sysOffset + 1)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  clampedIndex === sysOffset + 1
                    ? 'bg-surface-hover text-ink'
                    : 'text-ink-secondary hover:bg-surface-hover'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-success" />
                  <span>Export Full Workspace JSON Backup</span>
                </span>
                <span className="text-xs text-ink-muted tabular-nums">JSON</span>
              </button>

              <button
                type="button"
                disabled={!canManageBackups}
                title={!canManageBackups ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset') : undefined}
                onClick={handleRequestReset}
                onMouseEnter={() => setActiveIndex(sysOffset + 2)}
                onFocus={() => setActiveIndex(sysOffset + 2)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  clampedIndex === sysOffset + 2
                    ? 'bg-red-500/15'
                    : 'hover:bg-red-500/10'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Workspace to Default Seed Data</span>
                </span>
                <span className="text-xs tabular-nums">Reset</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-line bg-surface-sunken flex items-center justify-between text-xs text-ink-muted">
          <span>Use arrow keys + Enter or click to navigate</span>
          <span className="tabular-nums">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
