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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-sm leading-relaxed">
        {/* Main Documentation Content */}
        <div className="lg:col-span-8 space-y-6">
          <section className="p-6 rounded-xl bg-surface-raised border border-line space-y-3">
            <div className="flex items-center gap-2 text-micro text-accent">
              <BookOpen className="w-4 h-4" />
              <span>01. Product Introduction & Navigation Guide</span>
            </div>
            <h2 className="text-heading text-ink">
              What is Aurelix Analytics?
            </h2>
            <p className="text-ink-secondary">
              Aurelix Analytics is an Executive Business Intelligence and Commercial Ledger application designed for founders, CFOs, revenue operations teams, and enterprise analysts. Every metric displayed across the 11 application routes is computed dynamically from a unified underlying dataset of 250 customers, 80 catalog SKUs, 1,200 commercial orders, and 365 days of session telemetry.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-lg bg-surface-sunken border border-line">
                <h3 className="text-subheading text-ink">Core Analytics & Ledger</h3>
                <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">
                  Use <Link href="/dashboard" className="text-accent hover:underline">Overview</Link>,{' '}
                  <Link href="/dashboard/analytics" className="text-accent hover:underline">Analytics</Link>, and{' '}
                  <Link href="/dashboard/revenue" className="text-accent hover:underline">Revenue</Link> to inspect net revenue trends, channel share, and line-item reconciliations.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-surface-sunken border border-line">
                <h3 className="text-subheading text-ink">Operational Workflows</h3>
                <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">
                  Use <Link href="/dashboard/customers" className="text-accent hover:underline">Customers</Link>,{' '}
                  <Link href="/dashboard/orders" className="text-accent hover:underline">Orders</Link>, and{' '}
                  <Link href="/dashboard/products" className="text-accent hover:underline">Products</Link> to create, edit, refund, archive, and export records.
                </p>
              </div>
            </div>
          </section>

          <section className="p-6 rounded-xl bg-surface-raised border border-line space-y-3">
            <div className="flex items-center gap-2 text-micro text-success">
              <Calculator className="w-4 h-4" />
              <span>02. Centralized Financial Calculation Rules</span>
            </div>
            <h2 className="text-heading text-ink">
              How Revenue, Refunds, AOV, and Conversion Rates Reconcile
            </h2>
            <ul className="space-y-2 text-ink-secondary list-disc pl-6">
              <li>
                <strong>Gross Revenue:</strong> Sum of line-item subtotals (before commercial discounts and tax) across settled (<code>Paid</code> and <code>Refunded</code>) orders. Uncollected <code>Pending</code> and <code>Failed/Canceled</code> orders are excluded from realized revenue and tracked separately.
              </li>
              <li>
                <strong>Net Realized Revenue:</strong> Calculated as <code>(Subtotal − Discount + Tax) − Refunded Amount</code> across eligible orders. Refunded amounts are never double-counted.
              </li>
              <li>
                <strong>Historical Price Locking:</strong> Each order line item stores a locked snapshot of the product’s unit price at the time of checkout. Subsequent edits to a product’s catalog price in <Link href="/dashboard/products" className="text-accent hover:underline">Products</Link> never alter historical order totals.
              </li>
              <li>
                <strong>Conversion Rate:</strong> Derived by dividing non-canceled orders within the selected date window by unique visitors from the seeded daily session telemetry dataset.
              </li>
            </ul>
          </section>

          <section className="p-6 rounded-xl bg-surface-raised border border-line space-y-3">
            <div className="flex items-center gap-2 text-micro text-warning">
              <Database className="w-4 h-4" />
              <span>03. LocalStorage Persistence, Backups & Troubleshooting</span>
            </div>
            <h2 className="text-heading text-ink">
              How Your Changes Are Stored
            </h2>
            <p className="text-ink-secondary">
              On first visit, Aurelix runs a deterministic Mulberry32 seed generator (`seed: 20261113`) and persists the workspace under key <code>aurelix_analytics_v1_store</code> in your browser&apos;s LocalStorage. All subsequent edits survive page refreshes without overwriting your changes.
            </p>
            <ul className="space-y-2 text-ink-secondary list-disc pl-6">
              <li>
                <strong>Corrupt Data Recovery:</strong> If stored JSON is manually edited and fails Zod schema validation on startup, Aurelix preserves a snapshot under <code>aurelix_analytics_v1_corrupt_snapshot</code>, restores clean seed data, and notifies you with an alert banner.
              </li>
              <li>
                <strong>Storage Quota Limits:</strong> Browser LocalStorage typically provides ~5MB per origin. Avoid importing huge external files. You can export a full JSON backup or reset to default seed data anytime in <Link href="/dashboard/settings" className="text-accent hover:underline">Settings</Link>.
              </li>
            </ul>
          </section>
        </div>

        {/* Right Column: Shortcuts, Exports & Security Boundaries */}
        <div className="lg:col-span-4 space-y-6">
          <section className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
            <h2 className="flex items-center gap-2 text-subheading text-accent">
              <Keyboard className="w-4 h-4" />
              <span>Keyboard Shortcuts</span>
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-secondary">Open Command Palette</span>
                <kbd className="px-2 py-1 rounded bg-surface-sunken border border-line text-xs font-medium tabular-nums">
                  Ctrl / ⌘ + K
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-secondary">Close Active Modal / Drawer</span>
                <kbd className="px-2 py-1 rounded bg-surface-sunken border border-line text-xs font-medium tabular-nums">
                  ESC
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-ink-secondary">Print Current Report</span>
                <kbd className="px-2 py-1 rounded bg-surface-sunken border border-line text-xs font-medium tabular-nums">
                  Ctrl / ⌘ + P
                </kbd>
              </div>
            </div>
          </section>

          <section className="p-6 rounded-xl bg-surface-raised border border-line space-y-3">
            <h2 className="flex items-center gap-2 text-subheading text-success">
              <FileSpreadsheet className="w-4 h-4" />
              <span>How CSV & JSON Exports Work</span>
            </h2>
            <p className="text-ink-secondary">
              Every Export button generates a real RFC-4180 compliant CSV or JSON Blob directly from your currently filtered state in memory and triggers an immediate browser download.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-surface-raised border border-line space-y-3">
            <h2 className="flex items-center gap-2 text-subheading text-warning">
              <ShieldAlert className="w-4 h-4" />
              <span>Data Privacy & Portfolio Limitations</span>
            </h2>
            <p className="text-ink-secondary">
              Aurelix Analytics is a client-side frontend architecture demonstration. All data stays in your local browser storage and is never transmitted to an external server. Do not store real passwords, API keys, or sensitive personal financial secrets in LocalStorage.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-surface-raised border border-line space-y-3">
            <h2 className="flex items-center gap-2 text-subheading text-ink">
              <HelpCircle className="w-4 h-4 text-ink-secondary" />
              <span>Quick Troubleshooting</span>
            </h2>
            <p className="text-ink-secondary">
              If a chart or table appears empty, verify your global Date Range quick filter in the top navigation bar or click <strong>Reset Seed Data</strong> in Settings to restore the 1,200 seeded orders.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
