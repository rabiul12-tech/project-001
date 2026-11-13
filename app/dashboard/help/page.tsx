'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Database,
  Keyboard,
  ShieldAlert,
  Calculator,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/primitives';

export default function HelpDocumentationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Help, Architecture & Documentation"
        subtitle="Comprehensive guide to Aurelix Analytics calculations, LocalStorage persistence, keyboard shortcuts, and portfolio demonstration boundaries."
        meta="Documentation v1.0"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs leading-relaxed">
        {/* Main Documentation Content */}
        <div className="lg:col-span-8 space-y-6">
          <section className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
              <BookOpen className="w-4 h-4" />
              <span>01. Product Introduction & Navigation Guide</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              What is Aurelix Analytics?
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              Aurelix Analytics is an Executive Business Intelligence and Commercial Ledger application designed for founders, CFOs, revenue operations teams, and enterprise analysts. Every metric displayed across the 11 application routes is computed dynamically from a unified underlying dataset of 250 customers, 80 catalog SKUs, 1,200 commercial orders, and 365 days of session telemetry.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200/70 dark:border-[#273247]">
                <div className="font-bold text-slate-900 dark:text-slate-100">Core Analytics & Ledger</div>
                <p className="text-slate-500 mt-1">
                  Use <Link href="/dashboard" className="text-blue-600 hover:underline">Overview</Link>,{' '}
                  <Link href="/dashboard/analytics" className="text-blue-600 hover:underline">Analytics</Link>, and{' '}
                  <Link href="/dashboard/revenue" className="text-blue-600 hover:underline">Revenue</Link> to inspect net revenue trends, channel share, and line-item reconciliations.
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200/70 dark:border-[#273247]">
                <div className="font-bold text-slate-900 dark:text-slate-100">Operational Workflows</div>
                <p className="text-slate-500 mt-1">
                  Use <Link href="/dashboard/customers" className="text-blue-600 hover:underline">Customers</Link>,{' '}
                  <Link href="/dashboard/orders" className="text-blue-600 hover:underline">Orders</Link>, and{' '}
                  <Link href="/dashboard/products" className="text-blue-600 hover:underline">Products</Link> to create, edit, refund, archive, and export records.
                </p>
              </div>
            </div>
          </section>

          <section className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <Calculator className="w-4 h-4" />
              <span>02. Centralized Financial Calculation Rules</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              How Revenue, Refunds, AOV, and Conversion Rates Reconcile
            </h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>
                <strong>Gross Revenue:</strong> Sum of line-item subtotals (before commercial discounts and tax) across settled (<code>Paid</code> and <code>Refunded</code>) orders. Uncollected <code>Pending</code> and <code>Failed/Canceled</code> orders are excluded from realized revenue and tracked separately.
              </li>
              <li>
                <strong>Net Realized Revenue:</strong> Calculated as <code>(Subtotal − Discount + Tax) − Refunded Amount</code> across eligible orders. Refunded amounts are never double-counted.
              </li>
              <li>
                <strong>Historical Price Locking:</strong> Each order line item stores a locked snapshot of the product’s unit price at the time of checkout. Subsequent edits to a product’s catalog price in <Link href="/dashboard/products" className="text-blue-600 hover:underline">Products</Link> never alter historical order totals.
              </li>
              <li>
                <strong>Conversion Rate:</strong> Derived by dividing non-canceled orders within the selected date window by unique visitors from the seeded daily session telemetry dataset.
              </li>
            </ul>
          </section>

          <section className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
              <Database className="w-4 h-4" />
              <span>03. LocalStorage Persistence, Backups & Troubleshooting</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              How Your Changes Are Stored
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              On first visit, Aurelix runs a deterministic Mulberry32 seed generator (`seed: 20261113`) and persists the workspace under key <code>aurelix_analytics_v1_store</code> in your browser&apos;s LocalStorage. All subsequent edits survive page refreshes without overwriting your changes.
            </p>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>
                <strong>Corrupt Data Recovery:</strong> If stored JSON is manually edited and fails Zod schema validation on startup, Aurelix preserves a snapshot under <code>aurelix_analytics_v1_corrupt_snapshot</code>, restores clean seed data, and notifies you with an alert banner.
              </li>
              <li>
                <strong>Storage Quota Limits:</strong> Browser LocalStorage typically provides ~5MB per origin. Avoid importing huge external files. You can export a full JSON backup or reset to default seed data anytime in <Link href="/dashboard/settings" className="text-blue-600 hover:underline">Settings</Link>.
              </li>
            </ul>
          </section>
        </div>

        {/* Right Column: Shortcuts, Exports & Security Boundaries */}
        <div className="lg:col-span-4 space-y-6">
          <section className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
              <Keyboard className="w-4 h-4" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Open Command Palette</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] font-mono">
                  Ctrl / ⌘ + K
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Close Active Modal / Drawer</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] font-mono">
                  ESC
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-300">Print Current Report</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] font-mono">
                  Ctrl / ⌘ + P
                </kbd>
              </div>
            </div>
          </section>

          <section className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <FileSpreadsheet className="w-4 h-4" />
              <span>How CSV & JSON Exports Work</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Every Export button generates a real RFC-4180 compliant CSV or JSON Blob directly from your currently filtered state in memory and triggers an immediate browser download.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>Data Privacy & Portfolio Limitations</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Aurelix Analytics is a client-side frontend architecture demonstration. All data stays in your local browser storage and is never transmitted to an external server. Do not store real passwords, API keys, or sensitive personal financial secrets in LocalStorage.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-3">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
              <HelpCircle className="w-4 h-4" />
              <span>Quick Troubleshooting</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              If a chart or table appears empty, verify your global Date Range quick filter in the top navigation bar or click <strong>Reset Seed Data</strong> in Settings to restore the 1,200 seeded orders.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
