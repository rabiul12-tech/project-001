'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import {
  calculateExecutiveComparison,
  resolveDateWindow,
} from '@/lib/calculations/analytics';
import { formatCurrency } from '@/lib/export/exporter';
import { UserAvatar } from '@/components/ui/primitives';
import { TeamRole } from '@/types';

export default function LandingPage() {
  const router = useRouter();
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const products = useAppStore((s) => s.products);
  const dailySessions = useAppStore((s) => s.dailySessions);
  const team = useAppStore((s) => s.team);
  const settings = useAppStore((s) => s.settings);
  const setActiveRolePreview = useAppStore((s) => s.setActiveRolePreview);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const annualMetrics = useMemo(() => {
    const window = resolveDateWindow('12m');
    return calculateExecutiveComparison(orders, dailySessions, window);
  }, [orders, dailySessions]);

  const handleEnterAsRole = (memberName: string, memberEmail: string, memberTitle: string, role: TeamRole) => {
    setActiveRolePreview(role);
    updateSettings({
      personalName: memberName,
      personalEmail: memberEmail,
      personalTitle: memberTitle,
      activeRolePreview: role,
    });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-surface-chrome/95-chrome/95 backdrop-blur-md border-b border-line">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 md:gap-8 px-4 md:px-6 py-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-ink whitespace-nowrap shrink-0"
          >
            AURELIX Analytics
          </Link>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-ink-secondary-secondary"
          >
            <a
              href="#capabilities"
              className="hover:text-ink hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#architecture"
              className="hover:text-ink hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <a
              href="#role-preview"
              className="hover:text-ink hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Role Preview
            </a>
            <Link
              href="/dashboard/help"
              className="hover:text-ink hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Documentation
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-accent-strong hover:bg-accent-strong-hover rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <span className="hidden sm:inline">Explore Live Dashboard</span>
              <span className="sm:hidden">Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split Section */}
        <section className="max-w-[1440px] mx-auto px-6 pt-12 pb-10 lg:pt-16 lg:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="text-xs font-medium text-ink-muted-muted">
                  Executive Business Intelligence Suite · Deterministic Client-Side Ledger · Version 1.0
                </div>
                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-ink leading-[1.12]">
                  Financial clarity and operational precision for scaling enterprises.
                </h1>
                <p className="text-base text-ink-secondary-secondary max-w-2xl leading-relaxed">
                  Aurelix unifies net revenue recognition, multi-channel order workflows, cohort retention, and SKU price locking in a responsive, zero-latency executive command center.
                </p>
              </div>

              <div className="pt-2 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-accent-strong hover:bg-accent-strong-hover rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-sm"
                  >
                    <span>Explore Live Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/dashboard/revenue"
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-ink-secondary bg-surface-raised border border-line hover:bg-surface-hover rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Inspect Revenue Ledger</span>
                  </Link>
                </div>
                <p className="text-xs text-ink-muted-muted">
                  Immediate interactive access · No registration required · Changes persist locally in your browser
                </p>
              </div>
            </div>

            {/* Right Visual Carrier */}
            <div className="lg:col-span-5 flex">
              <div className="relative w-full rounded-xl overflow-hidden border border-line bg-slate-900 flex flex-col justify-end min-h-[280px] lg:h-full">
                {!heroImgFailed ? (
                  <img
                    src="/images/hero_executive_workspace_1794569121847.jpg"
                    alt="Aurelix executive analytics boardroom"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center">
                    <BarChart3 className="w-16 h-16 text-blue-400/40" />
                  </div>
                )}
                <div className="relative z-10 p-6 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-transparent text-white space-y-2">
                  <div className="text-xs text-slate-300 tabular-nums">
                    Aurelix Global Holdings · Live Seed Dataset
                  </div>
                  <div className="text-lg font-semibold">
                    Reconciled across {orders.length.toLocaleString()} orders, {customers.length} enterprise accounts, and {products.length} catalog SKUs.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Live Telemetry Strip Below Hero Split */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-surface-raised border border-line">
              <div className="text-xs text-ink-muted-muted">12-Month Net Revenue</div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {formatCurrency(annualMetrics.current.netRevenue, settings.currency, settings.numberFormat)}
              </div>
              <div className="mt-1 text-xs text-ink-muted-muted">
                Gross: {formatCurrency(annualMetrics.current.grossRevenue, settings.currency, settings.numberFormat, true)} · Refunds deducted
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-raised border border-line">
              <div className="text-xs text-ink-muted-muted">Settled & Active Orders</div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {orders.length.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-ink-muted-muted">
                AOV: {formatCurrency(annualMetrics.current.averageOrderValue, settings.currency, settings.numberFormat)} across 4 channels
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-raised border border-line">
              <div className="text-xs text-ink-muted-muted">Customer Directory</div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {customers.length.toLocaleString()} Accounts
              </div>
              <div className="mt-1 text-xs text-ink-muted-muted">
                Enterprise, Mid-Market, SMB & Startup cohorts
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-raised border border-line">
              <div className="text-xs text-ink-muted-muted">Catalog & Price Integrity</div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {products.length} Active SKUs
              </div>
              <div className="mt-1 text-xs text-ink-muted-muted">
                Historical order prices locked at checkout
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Bento Grid */}
        <section
          id="capabilities"
          className="max-w-[1440px] mx-auto px-6 py-12 border-t border-line"
        >
          <div className="max-w-2xl space-y-2 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Engineered for deep interactive workflows, not static screenshots.
            </h2>
            <p className="text-sm text-ink-secondary-muted">
              Every table, chart, filter, and modal in Aurelix Analytics operates against a unified client-side ledger with strict Zod validation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 p-6 rounded-xl bg-surface-raised border border-line flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                  <BarChart3 className="w-4 h-4" />
                  <span>01. Unified Financial Calculation Engine</span>
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Real-time reconciliation across Gross Revenue, Discounts, Taxes, and Simulated Refunds
                </h3>
                <p className="text-sm text-ink-secondary-muted leading-relaxed">
                  When you create an order, issue a simulated partial or full refund, or cancel an uncollected invoice, every executive KPI, time-series visualization, and customer lifetime value calculation updates immediately without double-counting refunded revenue.
                </p>
              </div>
              <div className="pt-3 border-t border-line-subtle flex flex-wrap items-center gap-6 text-xs text-ink-muted-muted tabular-nums">
                <span>Net = Subtotal − Discounts + Tax − Refunds</span>
                <span>·</span>
                <span>Zero-Denominator Safe</span>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-surface-raised border border-line flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-success">
                  <ShieldCheck className="w-4 h-4" />
                  <span>02. Historical Price Locking</span>
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Immutable order line-item snapshots
                </h3>
                <p className="text-sm text-ink-secondary-muted leading-relaxed">
                  Editing a product’s catalog unit price updates future orders while preserving historical order prices and prior period revenue reports untouched.
                </p>
              </div>
              <div className="pt-3 border-t border-line-subtle text-xs text-ink-muted ">
                Referential integrity enforced
              </div>
            </div>

            <div
              id="architecture"
              className="p-6 rounded-xl bg-surface-raised border border-line flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                  <Database className="w-4 h-4" />
                  <span>03. Versioned LocalStorage Persistence</span>
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Resilient client storage with JSON backup & restore
                </h3>
                <p className="text-sm text-ink-secondary-muted leading-relaxed">
                  All records persist across browser refreshes. Export full workspace snapshots as JSON, validate imported backups via Zod schemas, or reset to the deterministic seed anytime.
                </p>
              </div>
              <div className="pt-3 border-t border-line-subtle text-xs text-ink-muted ">
                Zero external database dependencies
              </div>
            </div>

            <div className="lg:col-span-2 p-6 rounded-xl bg-surface-raised border border-line flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>04. Executive Reporting & Command Palette</span>
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Configurable CSV exports, print-ready financial statements, and instant ⌘K navigation
                </h3>
                <p className="text-sm text-ink-secondary-muted leading-relaxed">
                  Build custom report templates filtered by sales channel, product category, and payment status. Download real CSV files reflecting your live filtered data or print formatted executive briefs.
                </p>
              </div>
              <div className="pt-3 border-t border-line-subtle flex items-center justify-between text-xs">
                <span className="text-ink-muted">11 complete interactive workspace routes</span>
                <Link
                  href="/dashboard/reports"
                  className="font-semibold text-accent hover:underline"
                >
                  Open Reporting Center →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Role Preview Entry Section */}
        <section
          id="role-preview"
          className="max-w-[1440px] mx-auto px-6 py-12 border-t border-line"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Interactive Persona & Role Preview</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Launch the workspace under a simulated executive profile
              </h2>
              <p className="text-sm text-ink-secondary-muted max-w-2xl">
                Select any seeded team profile below to preview how role-based UI controls and audit attributions behave across the application. Note: Role switching is a client-side UI demonstration and does not enforce backend security boundaries.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {team.slice(0, 4).map((member) => {
              const isSelected = settings.activeRolePreview === member.role && settings.personalName === member.name;
              return (
                <div
                  key={member.id}
                  className={`p-5 rounded-xl bg-surface-raised border transition-colors flex flex-col justify-between gap-4 ${
                    isSelected
                      ? 'border-accent'
                      : 'border-line'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={member.name} src={member.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-ink truncate">
                          {member.name}
                        </div>
                        <div className="text-xs text-ink-muted-muted truncate">
                          {member.title}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-ink-secondary-muted space-y-1 pt-2 border-t border-line-subtle">
                      <div>
                        Simulated Role: <span className="font-semibold text-ink">{member.role}</span>
                      </div>
                      <div>Department: {member.department}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleEnterAsRole(member.name, member.email, member.title, member.role)
                    }
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-surface-hover text-ink hover:bg-accent-strong hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enter as {member.role}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-line bg-surface-raised py-8 px-6">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted-muted">
          <div>
            <span className="font-bold text-ink">AURELIX Analytics</span> · Portfolio Case Study 001 · Client-Side Executive BI Demonstration
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-ink">
              Overview
            </Link>
            <Link href="/dashboard/analytics" className="hover:text-ink">
              Analytics
            </Link>
            <Link href="/dashboard/settings" className="hover:text-ink">
              Settings
            </Link>
            <Link href="/dashboard/help" className="hover:text-ink">
              Documentation & Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
