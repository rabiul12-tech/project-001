'use client';

import React, { useState } from 'react';
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
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { UserAvatar } from '@/components/ui/primitives';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { TeamRole } from '@/types';
import { formatCurrency } from '@/lib/export/exporter';

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const settings = useAppStore((s) => s.settings);
  const orders = useAppStore((s) => s.orders);
  const products = useAppStore((s) => s.products);
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setActiveRolePreview = useAppStore((s) => s.setActiveRolePreview);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetDemoData = useAppStore((s) => s.resetDemoData);

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const collapsed = settings.sidebarCollapsed;
  const currentTitle = ROUTE_TITLES[pathname] || 'Executive Workspace';

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
      <div className="flex flex-col h-full bg-white dark:bg-[#0F1625] border-r border-slate-200 dark:border-[#273247] select-none">
        {/* Brand & Workspace Switcher */}
        <div className="p-3.5 border-b border-slate-200 dark:border-[#273247] relative">
          <button
            type="button"
            onClick={() => setWorkspaceMenuOpen((v) => !v)}
            title="Switch workspace unit"
            className={`w-full flex items-center ${
              isIconOnly ? 'justify-center' : 'justify-between'
            } gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1B2639] transition-colors text-left`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {settings.companyLogoText || 'AX'}
              </div>
              {!isIconOnly && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate">
                    AURELIX
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {settings.workspaceName}
                  </div>
                </div>
              )}
            </div>
            {!isIconOnly && (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
          </button>

          {workspaceMenuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-40 p-1.5 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-xl space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                Select Operating Entity
              </div>
              {WORKSPACE_UNITS.map((unit) => (
                <button
                  key={unit.name}
                  type="button"
                  onClick={() => {
                    updateSettings({ workspaceName: unit.name });
                    setWorkspaceMenuOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                    settings.workspaceName === unit.name
                      ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1B2639]'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate">{unit.name}</div>
                    <div className="text-[10px] text-slate-400">{unit.region}</div>
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
                <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
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
                    onClick={() => setMobileNavOpen(false)}
                    title={isIconOnly ? item.label : undefined}
                    className={`flex items-center ${
                      isIconOnly ? 'justify-center px-2' : 'px-3'
                    } py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1B2639]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isIconOnly && <span className="ml-3 truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom User Profile & Collapse Control */}
        <div className="p-3 border-t border-slate-200 dark:border-[#273247] space-y-2">
          {!isIconOnly && (
            <div className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-[#141C2D] border border-slate-200/80 dark:border-[#273247] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  Role Preview:
                </span>
              </div>
              <select
                aria-label="Simulated role preview"
                value={settings.activeRolePreview}
                onChange={(e) => setActiveRolePreview(e.target.value as TeamRole)}
                className="bg-transparent text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
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
              className={`flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B2639] transition-colors min-w-0 flex-1 ${
                isIconOnly ? 'justify-center' : ''
              }`}
              title={`${settings.personalName} · ${settings.personalTitle}`}
            >
              <UserAvatar
                name={settings.personalName}
                src="/images/avatar_claire_vance_1794569123724.jpg"
                size="sm"
              />
              {!isIconOnly && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {settings.personalName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
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
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2639] transition-colors shrink-0"
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
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#090D18] text-slate-900 dark:text-slate-50">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-150 no-print ${
          collapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderSidebarContent(false)}</div>
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[260px] h-full">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-3 z-20 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1B2639]"
            >
              <X className="w-4 h-4" />
            </button>
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 bg-white/95 dark:bg-[#0F1625]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#273247] flex items-center justify-between gap-4 no-print">
          {/* Left: Mobile Menu + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1B2639]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs min-w-0">
              <Link
                href="/"
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors hidden sm:inline whitespace-nowrap"
              >
                Aurelix
              </Link>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {currentTitle}
              </span>
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Global Search / Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] text-xs text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Search or jump to...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-[#0F1625] rounded border border-slate-200 dark:border-[#273247] text-slate-500 dark:text-slate-400">
                ⌘K
              </kbd>
            </button>

            {/* Global Date Range Quick Filter */}
            <div className="hidden xl:block">
              <DateRangePicker />
            </div>

            {/* Notifications Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifMenuOpen((v) => !v);
                  setProfileMenuOpen(false);
                }}
                aria-label="View notifications"
                className="p-2 rounded-lg border border-slate-200 dark:border-[#273247] bg-white dark:bg-[#141C2D] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1B2639] transition-colors"
              >
                <Bell className="w-4 h-4" />
              </button>

              {notifMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-xl p-3 z-40 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Operational Alerts
                    </span>
                    <Link
                      href="/dashboard/activity"
                      onClick={() => setNotifMenuOpen(false)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View all activity
                    </Link>
                  </div>
                  <div className="space-y-2 text-xs">
                    {recentHighValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotifMenuOpen(false);
                          router.push(`/dashboard/orders?search=${recentHighValue.orderNumber}`);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-[#1B2639] transition-colors"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          High-Value Settlement: {recentHighValue.orderNumber}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {recentHighValue.customerCompany} ·{' '}
                          <span className="font-mono tabular-nums">
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
                        className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-[#1B2639] transition-colors"
                      >
                        <div className="font-semibold text-amber-600 dark:text-amber-400">
                          Inventory Threshold Alert
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
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
                        className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-[#1B2639] transition-colors"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          Simulated Credit Memo: {recentRefund.orderNumber}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Refunded{' '}
                          <span className="font-mono tabular-nums">
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
              className="p-2 rounded-lg border border-slate-200 dark:border-[#273247] bg-white dark:bg-[#141C2D] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1B2639] transition-colors"
            >
              {settings.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* User Avatar Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((v) => !v);
                  setNotifMenuOpen(false);
                }}
                aria-label="Open user menu"
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B2639] transition-colors"
              >
                <UserAvatar
                  name={settings.personalName}
                  src="/images/avatar_claire_vance_1794569123724.jpg"
                  size="sm"
                />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-xl p-2 z-40 space-y-1 text-xs">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {settings.personalName}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 truncate">
                      {settings.personalEmail}
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-blue-600 dark:text-blue-400">
                      Active Role: {settings.activeRolePreview}
                    </div>
                  </div>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2639]"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Workspace Settings</span>
                  </Link>
                  <Link
                    href="/dashboard/team"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2639]"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Team & Role Preview</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      resetDemoData();
                      setProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-left"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Demo Dataset</span>
                  </button>
                  <Link
                    href="/"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1B2639]"
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
        <div className="xl:hidden px-4 sm:px-6 py-2.5 bg-white dark:bg-[#0F1625] border-b border-slate-200 dark:border-[#273247] flex items-center justify-between gap-2 overflow-x-auto no-print">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Reporting Window:
          </span>
          <DateRangePicker />
        </div>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
