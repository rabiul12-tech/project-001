'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

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

  if (!open) return null;

  const navigateTo = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  const handleExportBackup = () => {
    const snap = getExportSnapshot();
    triggerBrowserDownload(
      JSON.stringify(snap, null, 2),
      `aurelix-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    addToast('Workspace backup exported', 'Downloaded JSON snapshot.', 'success');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/60 backdrop-blur-[1px]">
      <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="relative z-10 w-full max-w-xl rounded-xl bg-surface-raised border border-line shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <Search className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to page, search customers, orders, SKUs, or run command..."
            className="w-full bg-transparent text-sm text-ink placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close command palette"
            className="p-1 text-ink-muted hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-2 space-y-4">
          {filteredNav.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted">
                Pages & Workspaces
              </div>
              <div className="space-y-0.5">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => navigateTo(item.href)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-ink-secondary hover:bg-surface-hover transition-colors"
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
              <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted">
                Matching Customers
              </div>
              <div className="space-y-0.5">
                {matchedCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigateTo(`/dashboard/customers?search=${encodeURIComponent(c.company)}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-ink-secondary hover:bg-surface-hover transition-colors"
                  >
                    <span className="font-medium">
                      {c.company} <span className="text-ink-muted font-normal">· {c.name}</span>
                    </span>
                    <span className="tabular-nums text-ink-muted">{c.segment}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedOrders.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted">
                Matching Orders
              </div>
              <div className="space-y-0.5">
                {matchedOrders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => navigateTo(`/dashboard/orders?search=${encodeURIComponent(o.orderNumber)}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-ink-secondary hover:bg-surface-hover transition-colors"
                  >
                    <span className="tabular-nums font-medium">
                      {o.orderNumber}{' '}
                      <span className="font-sans text-ink-muted font-normal">
                        · {o.customerCompany}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(o.totalAmount, settings.currency, settings.numberFormat)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedProducts.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted">
                Matching Products
              </div>
              <div className="space-y-0.5">
                {matchedProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigateTo(`/dashboard/products?search=${encodeURIComponent(p.sku)}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-ink-secondary hover:bg-surface-hover transition-colors"
                  >
                    <span className="font-medium">
                      {p.name} <span className="tabular-nums text-ink-muted">· {p.sku}</span>
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(p.unitPrice, settings.currency, settings.numberFormat)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted">
              System Actions
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-ink-secondary hover:bg-surface-hover transition-colors"
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
                <span className="text-ink-muted tabular-nums">Theme</span>
              </button>

              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-ink-secondary hover:bg-surface-hover transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-success" />
                  <span>Export Full Workspace JSON Backup</span>
                </span>
                <span className="text-ink-muted tabular-nums">JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-danger hover:bg-red-500/10 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Workspace to Default Seed Data</span>
                </span>
                <span className="tabular-nums">Reset</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-line bg-surface-sunken flex items-center justify-between text-xs text-ink-muted">
          <span>Use arrow keys or click to navigate</span>
          <span className="tabular-nums">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
