'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
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
  Search,
  Bell,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ChevronDown,
  Building2,
  Shield,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceAction } from '@/hooks/useWorkspaceAction';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { UserAvatar } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/overlays';
import { CommandPalette, LayoutDialog } from '@/components/layout/CommandPalette';
import { TeamRole } from '@/types';
import { formatCurrency } from '@/lib/export/exporter';
import { canPerformAction, getPermissionDeniedMessage } from '@/lib/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Analytics', href: '/dashboard/analytics', icon: LineChart },
      { label: 'Revenue', href: '/dashboard/revenue', icon: DollarSign },
      { label: 'Customers', href: '/dashboard/customers', icon: Users },
      { label: 'Orders', href: '/dashboard/orders', icon: ShoppingCart },
      { label: 'Products', href: '/dashboard/products', icon: Package },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Reports', href: '/dashboard/reports', icon: FileSpreadsheet },
      { label: 'Activity', href: '/dashboard/activity', icon: Activity },
      { label: 'Team', href: '/dashboard/team', icon: UserCheck },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
      { label: 'Help & Docs', href: '/dashboard/help', icon: BookOpen },
    ],
  },
];

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Executive Overview',
  '/dashboard/analytics': 'Deep Analytics',
  '/dashboard/revenue': 'Revenue Intelligence',
  '/dashboard/customers': 'Customer Management',
  '/dashboard/orders': 'Order Ledger',
  '/dashboard/products': 'Product Catalog',
  '/dashboard/reports': 'Reporting Center',
  '/dashboard/activity': 'Activity & Audit Feed',
  '/dashboard/team': 'Team & Role Preview',
  '/dashboard/settings': 'Workspace Settings',
  '/dashboard/help': 'Help & Documentation',
};

const WORKSPACE_UNITS = [
  { name: 'Aurelix Global Holdings', region: 'US-East · Consolidated' },
  { name: 'Aurelix EMEA Sovereign', region: 'EU-Central · Frankfurt' },
  { name: 'Aurelix APAC Division', region: 'AP-South · Singapore' },
];

const TOPBAR_ICON_BUTTON =
  'grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface-raised text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink sm:size-11';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const settings = useAppStore((s) => s.settings);
  const profileAvatar = useAppStore((s) => s.team.find(
    (member) => member.email.toLowerCase() === s.settings.personalEmail.toLowerCase()
  )?.avatarUrl);
  const orders = useAppStore((s) => s.orders);
  const products = useAppStore((s) => s.products);
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const setSidebarCollapsed = useWorkspaceAction((s) => s.setSidebarCollapsed);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const toggleTheme = useWorkspaceAction((s) => s.toggleTheme);
  const setActiveRolePreview = useWorkspaceAction((s) => s.setActiveRolePreview);
  const updateSettings = useWorkspaceAction((s) => s.updateSettings);
  const resetDemoData = useWorkspaceAction((s) => s.resetDemoData);
  const addToast = useAppStore((s) => s.addToast);

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const commandTriggerRef = useRef<HTMLButtonElement>(null);

  const canManageSettings = canPerformAction(settings.activeRolePreview, 'manage_settings');
  const canManageBackups = canPerformAction(settings.activeRolePreview, 'manage_backups_and_reset');

  useEffect(() => {
    if (!workspaceMenuOpen && !notifMenuOpen && !profileMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (workspaceMenuOpen && workspaceMenuRef.current && !workspaceMenuRef.current.contains(target)) {
        setWorkspaceMenuOpen(false);
      }
      if (notifMenuOpen && notifMenuRef.current && !notifMenuRef.current.contains(target)) {
        setNotifMenuOpen(false);
      }
      if (profileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const active = document.activeElement;
        for (const menu of [workspaceMenuRef.current, notifMenuRef.current, profileMenuRef.current]) {
          if (active && menu?.contains(active)) {
            menu.querySelector('button')?.focus({ preventScroll: true });
          }
        }
        setWorkspaceMenuOpen(false);
        setNotifMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [workspaceMenuOpen, notifMenuOpen, profileMenuOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const desktop = window.matchMedia('(min-width: 64rem)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileNavOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [mobileNavOpen, setMobileNavOpen]);

  const collapsed = settings.sidebarCollapsed;
  const currentTitle = ROUTE_TITLES[pathname] || 'Executive Workspace';
  const compactTitle = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.href === pathname)?.label ?? currentTitle;

  // Build live operational alerts from actual store data
  const lowStockCount = products.filter((p) => p.status === 'Low Stock').length;
  const recentRefund = orders.find((o) => o.paymentStatus === 'Refunded');
  const recentHighValue = orders.find(
    (o) => o.paymentStatus === 'Paid' && o.totalAmount >= 5000
  );

  const isRouteActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const renderSidebarContent = (isMobile = false) => {
    const isIconOnly = !isMobile && collapsed;

    return (
      <div className="flex flex-col h-full bg-surface-chrome border-r border-line select-none">
        {/* Brand & Workspace Switcher */}
        <div ref={workspaceMenuRef} className="p-4 border-b border-line relative">
          <button
            type="button"
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((v) => !v)}
            title="Switch workspace unit"
            className={`w-full flex items-center ${
              isIconOnly ? 'justify-center' : 'justify-between'
            } gap-3 p-2 rounded-xl hover:bg-surface-hover transition-colors text-left`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent-strong text-white tabular-nums font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {settings.companyLogoText || 'AX'}
              </div>
              {!isIconOnly && (
                <div className="min-w-0">
                  <div className="text-sm font-bold tracking-tight text-ink truncate">
                    AURELIX
                  </div>
                  <div className="text-xs text-ink-muted truncate">
                    {settings.workspaceName}
                  </div>
                </div>
              )}
            </div>
            {!isIconOnly && (
              <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
            )}
          </button>

          {workspaceMenuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-40 p-2 rounded-xl bg-surface-raised border border-line shadow-xl space-y-1">
              <div className="px-3 py-1 text-xs font-semibold text-ink-muted">
                Select Operating Entity
              </div>
              {WORKSPACE_UNITS.map((unit) => (
                <button
                  key={unit.name}
                  type="button"
                  disabled={!canManageSettings}
                  title={!canManageSettings ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_settings') : undefined}
                  onClick={() => {
                    if (!canManageSettings) {
                      addToast(
                        'Permission restricted',
                        getPermissionDeniedMessage(settings.activeRolePreview, 'manage_settings'),
                        'warning'
                      );
                      return;
                    }
                    updateSettings({ workspaceName: unit.name });
                    setWorkspaceMenuOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    settings.workspaceName === unit.name
                      ? 'bg-blue-600/10 text-accent font-semibold'
                      : 'text-ink-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate">{unit.name}</div>
                    <div className="text-xs text-ink-muted">{unit.region}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav
          aria-label="Sidebar Navigation"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              {!isIconOnly && (
                <div className="px-3 pb-1 text-micro text-ink-muted">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileNavOpen(false)}
                    title={isIconOnly ? item.label : undefined}
                    className={`flex items-center ${
                      isIconOnly ? 'justify-center px-2' : 'px-3'
                    } py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-accent-strong text-white shadow-xs'
                        : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {!isIconOnly && <span className="ml-3 truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom User Profile & Collapse Control */}
        <div className="p-3 border-t border-line space-y-2">
          {!isIconOnly && (
            <div className="px-3 py-2 rounded-lg bg-surface-raised border border-line flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-xs text-ink-muted truncate">
                  Role Preview:
                </span>
              </div>
              <select
                aria-label="Simulated role preview"
                value={settings.activeRolePreview}
                onChange={(e) => setActiveRolePreview(e.target.value as TeamRole)}
                className="bg-transparent text-xs tabular-nums font-semibold text-accent cursor-pointer rounded-sm"
              >
                <option value="Owner">Owner</option>
                <option value="Admin">Admin</option>
                <option value="Analyst">Analyst</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Link
              href="/dashboard/settings"
              onClick={isMobile ? () => setMobileNavOpen(false) : undefined}
              className={`flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover transition-colors min-w-0 flex-1 ${
                isIconOnly ? 'justify-center' : ''
              }`}
              title={`${settings.personalName} · ${settings.personalTitle}`}
            >
              <UserAvatar
                name={settings.personalName}
                src={profileAvatar}
                size="sm"
              />
              {!isIconOnly && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink truncate">
                    {settings.personalName}
                  </div>
                  <div className="text-xs text-ink-muted truncate">
                    {settings.personalTitle}
                  </div>
                </div>
              )}
            </Link>

            {!isMobile && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors shrink-0"
              >
                {collapsed ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-surface text-ink">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen self-start transition-all duration-150 no-print ${
          collapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {mobileNavOpen && (
        <LayoutDialog
          label="Mobile Navigation"
          onDismiss={() => setMobileNavOpen(false)}
          returnFocusRef={mobileNavTriggerRef}
          className="justify-start"
        >
          <div className="relative h-full w-[260px]">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-1.5 top-2 z-20 grid size-10 place-items-center rounded-lg text-ink-secondary hover:bg-surface-hover"
            >
              <X className="w-4 h-4" />
            </button>
            {renderSidebarContent(true)}
          </div>
        </LayoutDialog>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-line bg-surface-chrome/95 px-3 backdrop-blur-md sm:gap-4 sm:px-4 md:px-6 lg:px-8">
          {/* Left: Mobile Menu + Breadcrumbs */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              ref={mobileNavTriggerRef}
              type="button"
              onClick={(event) => {
                event.currentTarget.focus({ preventScroll: true });
                setMobileNavOpen(true);
              }}
              aria-label="Open navigation menu"
              aria-haspopup="dialog"
              className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-secondary hover:bg-surface-hover sm:size-11 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-caption">
              <Link
                href="/"
                className="text-ink-muted hover:text-ink transition-colors hidden sm:inline whitespace-nowrap"
              >
                Aurelix
              </Link>
              <span aria-hidden="true" className="text-ink-muted hidden sm:inline">/</span>
              <span className="truncate font-semibold text-ink" aria-current="page">
                <span className="min-[400px]:hidden">{compactTitle}</span>
                <span className="hidden min-[400px]:inline">{currentTitle}</span>
              </span>
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {/* Global Search / Command Palette Trigger */}
            <button
              ref={commandTriggerRef}
              type="button"
              onClick={(event) => {
                event.currentTarget.focus({ preventScroll: true });
                setCommandPaletteOpen(true);
              }}
              aria-label="Search or jump to..."
              aria-keyshortcuts="Control+K Meta+K"
              aria-haspopup="dialog"
              className="flex size-10 items-center justify-center gap-2.5 rounded-lg border border-line bg-surface-raised text-caption text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink sm:size-11 lg:h-11 lg:w-auto lg:px-3"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Search or jump to...</span>
              <kbd aria-hidden="true" className="hidden rounded border border-line bg-surface-chrome px-2 py-1 text-xs tabular-nums text-ink-muted xl:inline-block">
                ⌘K
              </kbd>
            </button>

            {/* Global Date Range Quick Filter */}
            <div className="hidden xl:block">
              <DateRangePicker />
            </div>

            {/* Notifications Menu */}
            <div ref={notifMenuRef} className="sm:relative">
              <button
                type="button"
                aria-expanded={notifMenuOpen}
                onClick={() => {
                  setNotifMenuOpen((v) => !v);
                  setProfileMenuOpen(false);
                }}
                aria-label="View notifications"
                className={TOPBAR_ICON_BUTTON}
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
              </button>

              {notifMenuOpen && (
                <div className="absolute inset-x-3 top-full z-40 mt-2 max-h-[calc(100dvh-5rem)] space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface-raised p-3 shadow-xl sm:left-auto sm:right-0 sm:w-80">
                  <div className="flex items-center justify-between border-b border-line-subtle pb-2">
                    <span className="text-xs font-bold text-ink">
                      Operational Alerts
                    </span>
                    <Link
                      href="/dashboard/activity"
                      onClick={() => setNotifMenuOpen(false)}
                      className="text-xs text-accent hover:underline"
                    >
                      View all activity
                    </Link>
                  </div>
                  <div className="space-y-2 text-caption">
                    {recentHighValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotifMenuOpen(false);
                          router.push(`/dashboard/orders?search=${recentHighValue.orderNumber}`);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-surface-hover transition-colors"
                      >
                        <div className="font-semibold text-ink">
                          High-Value Settlement: {recentHighValue.orderNumber}
                        </div>
                        <div className="text-ink-muted mt-1">
                          {recentHighValue.customerCompany} ·{' '}
                          <span className="tabular-nums">
                            {formatCurrency(recentHighValue.totalAmount, settings.currency)}
                          </span>
                        </div>
                      </button>
                    )}

                    {lowStockCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotifMenuOpen(false);
                          router.push('/dashboard/products');
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-surface-hover transition-colors"
                      >
                        <div className="font-semibold text-warning">
                          Inventory Threshold Alert
                        </div>
                        <div className="text-ink-muted mt-1">
                          {lowStockCount} catalog SKUs are currently in Low Stock status.
                        </div>
                      </button>
                    )}

                    {recentRefund && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotifMenuOpen(false);
                          router.push(`/dashboard/orders?search=${recentRefund.orderNumber}`);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-surface-hover transition-colors"
                      >
                        <div className="font-semibold text-ink">
                          Simulated Credit Memo: {recentRefund.orderNumber}
                        </div>
                        <div className="text-ink-muted mt-1">
                          Refunded{' '}
                          <span className="tabular-nums">
                            {formatCurrency(recentRefund.refundedAmount, settings.currency)}
                          </span>{' '}
                          to {recentRefund.customerCompany}
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
              className={TOPBAR_ICON_BUTTON}
            >
              {settings.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-warning" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {/* User Avatar Dropdown */}
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                aria-expanded={profileMenuOpen}
                onClick={() => {
                  setProfileMenuOpen((v) => !v);
                  setNotifMenuOpen(false);
                }}
                aria-label="Open user menu"
                className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg p-1 transition-colors hover:bg-surface-hover sm:h-11 sm:min-w-11"
              >
                <UserAvatar
                  name={settings.personalName}
                  src={profileAvatar}
                  size="sm"
                />
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted hidden sm:block" aria-hidden="true" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl bg-surface-raised border border-line shadow-xl p-2 z-40 space-y-1 text-xs">
                  <div className="px-3 py-2 border-b border-line-subtle">
                    <div className="font-bold text-ink">
                      {settings.personalName}
                    </div>
                    <div className="text-ink-muted truncate">
                      {settings.personalEmail}
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-accent">
                      Active Role: {settings.activeRolePreview}
                    </div>
                  </div>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-ink-secondary hover:bg-surface-hover"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Workspace Settings</span>
                  </Link>
                  <Link
                    href="/dashboard/team"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-ink-secondary hover:bg-surface-hover"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Team & Role Preview</span>
                  </Link>
                  {process.env.NODE_ENV === 'development' && (
                    <button
                      type="button"
                      disabled={!canManageBackups}
                      title={!canManageBackups ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset') : undefined}
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setConfirmResetOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-warning hover:bg-amber-500/10 text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Demo Dataset</span>
                    </button>
                  )}
                  <Link
                    href="/"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-ink-muted hover:bg-surface-hover"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Return to Product Overview</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile/Tablet Date Range Bar */}
        <div className="xl:hidden px-4 md:px-6 lg:px-8 py-2 bg-surface-chrome border-b border-line flex flex-wrap items-center justify-between gap-2 no-print">
          <span className="text-caption font-medium text-ink-muted whitespace-nowrap">
            Reporting Window:
          </span>
          <DateRangePicker popoverAlign="responsive" />
        </div>

        {/* Page Viewport */}
        <main id="dashboard-main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] flex-1 scroll-mt-16 space-y-6 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <CommandPalette triggerRef={commandTriggerRef} />
      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={resetDemoData}
        title="Reset Workspace to Default Demo Data?"
        description="This will overwrite any custom customers, orders, products, or settings stored in your browser's LocalStorage and restore the original deterministic seed dataset."
        confirmLabel="Restore Default Seed"
      />
    </div>
  );
}
