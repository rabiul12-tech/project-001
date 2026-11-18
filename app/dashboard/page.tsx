'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Plus,
  ArrowUpRight,
  RotateCcw,
  FileSpreadsheet,
  Users,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceAction } from '@/hooks/useWorkspaceAction';
import { useNowMs, useTodayLabel } from '@/lib/useClock';
import {
  buildRevenueTimeSeries,
  calculateExecutiveComparison,
  calculateProductPerformance,
  calculateSalesByChannel,
  filterOrdersByWindow,
  resolveDateWindow,
} from '@/lib/calculations/analytics';
import {
  convertRowsToCsv,
  formatCurrency,
  formatDateDisplay,
  triggerBrowserDownload,
} from '@/lib/export/exporter';
import {
  KPIStatCard,
  PageHeader,
  ProductArtwork,
  StatusBadge,
} from '@/components/ui/primitives';
import {
  ChannelDonutChart,
  OrdersAndCustomerGrowthChart,
  RevenueTrendChart,
} from '@/components/charts/AnalyticsCharts';
import { ConfirmDialog } from '@/components/ui/overlays';
import { canPerformAction, getPermissionDeniedMessage } from '@/lib/permissions';

const IS_DEV = process.env.NODE_ENV === 'development';
const ONE_DAY_MS = 86400 * 1000;

const SECONDARY_BUTTON =
  'inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-caption font-medium bg-surface-sunken text-ink-secondary hover:bg-surface-hover hover:text-ink transition-colors';

/** Shared card header: title + subtitle on the left, optional action link on the right. */
function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 className="text-heading text-ink">{title}</h2>
        <p className="mt-0.5 text-caption text-ink-muted">{subtitle}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-caption text-accent hover:underline inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-sm"
    >
      <span>{children}</span>
      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
    </Link>
  );
}

export default function ExecutiveOverviewPage() {
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const products = useAppStore((s) => s.products);
  const activities = useAppStore((s) => s.activities);
  const dailySessions = useAppStore((s) => s.dailySessions);
  const settings = useAppStore((s) => s.settings);
  const datePreset = useAppStore((s) => s.datePreset);
  const customStartDate = useAppStore((s) => s.customStartDate);
  const customEndDate = useAppStore((s) => s.customEndDate);
  const resetDemoData = useWorkspaceAction((s) => s.resetDemoData);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const addToast = useAppStore((s) => s.addToast);

  const [chartMode, setChartMode] = useState<'area' | 'bar' | 'line'>('area');

  const todayLabel = useTodayLabel();
  const now = useNowMs();
  const dateWindow = useMemo(
    () => resolveDateWindow(datePreset, customStartDate, customEndDate, new Date(now).toISOString()),
    [datePreset, customStartDate, customEndDate, now]
  );

  const kpiComparison = useMemo(
    () => calculateExecutiveComparison(orders, dailySessions, dateWindow),
    [orders, dailySessions, dateWindow]
  );

  const timeSeries = useMemo(
    () => buildRevenueTimeSeries(orders, customers, dateWindow),
    [orders, customers, dateWindow]
  );

  // Presentation only: the revenue trend hides the trailing daily bucket when
  // the window ends partway through that day, so an incomplete "today" does
  // not read as a revenue drop. KPIs and the CSV export still use every row.
  const { trendSeries, partialDayHidden } = useMemo(() => {
    const last = timeSeries[timeSeries.length - 1];
    const endDayKey = new Date(dateWindow.endMs).toISOString().slice(0, 10);
    const endsMidDay = (dateWindow.endMs + 1) % ONE_DAY_MS !== 0;
    const hide = timeSeries.length > 2 && endsMidDay && last?.dateKey === endDayKey;
    return {
      trendSeries: hide ? timeSeries.slice(0, -1) : timeSeries,
      partialDayHidden: hide,
    };
  }, [timeSeries, dateWindow]);

  const periodOrders = useMemo(
    () => filterOrdersByWindow(orders, dateWindow.startMs, dateWindow.endMs),
    [orders, dateWindow]
  );

  const channelBreakdown = useMemo(
    () => calculateSalesByChannel(periodOrders),
    [periodOrders]
  );

  const topProducts = useMemo(
    () => calculateProductPerformance(products, periodOrders).slice(0, 5),
    [products, periodOrders]
  );

  const recentTransactions = useMemo(
    () => periodOrders.slice(0, 9),
    [periodOrders]
  );

  const handleExportOverviewCsv = () => {
    const headers = [
      'Period Bucket',
      'Gross Revenue',
      'Net Revenue',
      'Refunds',
      'Order Count',
      'Average Order Value',
      'New Customers',
    ];
    const rows = timeSeries.map((pt) => [
      pt.label,
      pt.grossRevenue,
      pt.netRevenue,
      pt.refunds,
      pt.orders,
      pt.aov,
      pt.newCustomers,
    ]);
    const csv = convertRowsToCsv(headers, rows);
    triggerBrowserDownload(csv, `aurelix-executive-overview-${datePreset}.csv`);
    addToast('Overview CSV exported', `Exported ${rows.length} time-series rows.`, 'success');
  };

  const cur = kpiComparison.current;
  const deltas = kpiComparison.deltas;
  const money = (amount: number, compact = false) =>
    formatCurrency(amount, settings.currency, settings.numberFormat, compact);

  return (
    <div className="@container space-y-5 sm:space-y-6">
      {/* 1. Welcome Heading with Current Date & Quick Actions */}
      <PageHeader
        title={`Welcome back, ${settings.personalName.split(' ')[0]}`}
        subtitle={`Revenue, orders and customer acquisition for ${settings.workspaceName}.`}
        meta={todayLabel}
        actions={
          <>
            <button
              type="button"
              onClick={handleExportOverviewCsv}
              className="inline-flex min-h-10 items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-surface-raised border border-line text-ink hover:bg-surface-hover transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <Link
              href="/dashboard/orders?action=new"
              className="inline-flex min-h-10 items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white border border-transparent transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New Order</span>
            </Link>
          </>
        }
      />

      {/* 2. Quick Actions & Filter Bar */}
      <div className="grid items-center gap-x-4 gap-y-2.5 rounded-xl border border-line bg-surface-raised px-3.5 py-3 sm:px-5 @min-[50rem]:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption font-semibold text-ink mr-2">Quick actions</span>
          <Link href="/dashboard/customers?action=new" className={SECONDARY_BUTTON}>
            <Users className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Add Customer</span>
          </Link>
          <Link href="/dashboard/reports" className={SECONDARY_BUTTON}>
            <FileSpreadsheet className="w-4 h-4 text-warning" aria-hidden="true" />
            <span>Generate Report</span>
          </Link>
          {IS_DEV && (
            <button
              type="button"
              disabled={!canPerformAction(settings.activeRolePreview, 'manage_backups_and_reset')}
              title={
                !canPerformAction(settings.activeRolePreview, 'manage_backups_and_reset')
                  ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset')
                  : undefined
              }
              onClick={() => setConfirmResetOpen(true)}
              className={`${SECONDARY_BUTTON} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset Seed Data</span>
            </button>
          )}
        </div>

        <div className="text-caption text-ink-muted tabular-nums">
          Window: {new Date(dateWindow.startMs).toISOString().slice(0, 10)} →{' '}
          {new Date(dateWindow.endMs).toISOString().slice(0, 10)} ({dateWindow.days}d)
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12 xl:gap-6 [&>section]:min-w-0 [&>section.card]:max-sm:p-4">
        <section aria-label="Executive metrics" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:col-span-2 sm:gap-4 xl:col-span-12 xl:grid-cols-4 xl:gap-6">
          <KPIStatCard
            label="Net Realized Revenue"
            value={money(cur.netRevenue)}
            delta={deltas.netRevenue}
            secondaryMeta={`Gross ${money(cur.grossRevenue, true)}`}
            href="/dashboard/revenue"
          />
          <KPIStatCard
            label="Total Orders"
            value={cur.totalOrdersCount.toLocaleString()}
            delta={deltas.totalOrders}
            secondaryMeta={`AOV ${money(cur.averageOrderValue)}`}
            href="/dashboard/orders"
          />
          <KPIStatCard
            label="Active Purchasing Accounts"
            value={cur.activeCustomersCount.toLocaleString()}
            delta={deltas.activeCustomers}
            secondaryMeta={`Of ${customers.length} total`}
            href="/dashboard/customers"
          />
          <KPIStatCard
            label="Session Conversion Rate"
            value={`${cur.conversionRatePercent.toFixed(2)}%`}
            delta={deltas.conversionRate}
            secondaryMeta={`${cur.totalUniqueVisitors.toLocaleString()} visitors`}
            href="/dashboard/analytics"
          />
        </section>

        {/* 8. Revenue trend */}
        <section className="card md:col-span-2 xl:col-span-8 space-y-4">
          <CardHeader
            title="Revenue Trajectory (Net vs. Gross)"
            subtitle={`Reconciled from settled orders after discounts and simulated refunds${
              partialDayHidden ? ' · today (partial day) not plotted' : ''
            }`}
            action={
              <div
                role="group"
                aria-label="Chart type"
                className="flex items-center gap-1 p-1 rounded-lg bg-surface-sunken border border-line"
              >
                {(['area', 'bar', 'line'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={chartMode === m}
                    onClick={() => setChartMode(m)}
                    className={`min-h-8 px-3 text-caption rounded-md capitalize transition-colors ${
                      chartMode === m
                        ? 'bg-surface-raised text-ink shadow-xs ring-1 ring-line'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            }
          />
          <RevenueTrendChart
            data={trendSeries}
            currency={settings.currency}
            numberFormat={settings.numberFormat}
            mode={chartMode}
          />
        </section>

        {/* 9–10. Sales by channel */}
        <section className="card xl:col-span-4 flex flex-col gap-4">
          <CardHeader
            title="Revenue by Sales Channel"
            subtitle="Net realized share across acquisition channels"
          />
          <div className="flex-1 flex flex-col justify-center">
            <ChannelDonutChart
              data={channelBreakdown}
              currency={settings.currency}
              numberFormat={settings.numberFormat}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line-subtle pt-4 text-caption">
            <span className="text-ink-muted">Pending invoices</span>
            <span className="tabular-nums font-semibold text-warning">
              {money(cur.pendingRevenue)}
            </span>
          </div>
        </section>

        {/* 11. Order & customer velocity */}
        <section className="card md:col-span-2 md:max-xl:order-1 xl:col-span-8 space-y-4">
          <CardHeader
            title="Order Volume & Customer Acquisition"
            subtitle="Order volume vs. newly onboarded customer accounts"
            action={<CardLink href="/dashboard/analytics">Deep Analytics</CardLink>}
          />
          <OrdersAndCustomerGrowthChart data={timeSeries} numberFormat={settings.numberFormat} />
        </section>

        {/* 13. Top-performing products */}
        <section className="card @container min-w-0 xl:col-span-4 space-y-4">
          <CardHeader
            title="Top-Performing Products"
            subtitle="Ranked by gross line-item revenue in selected period"
            action={<CardLink href="/dashboard/products">All {products.length} SKUs</CardLink>}
          />
          {topProducts.length > 0 ? (
            <>
              <table className="hidden w-full text-left @[19rem]:table">
                <caption className="sr-only">Top-performing products by gross revenue</caption>
                <thead>
                  <tr className="border-b border-line-subtle text-caption text-ink-secondary">
                    <th scope="col" className="pb-2.5 font-medium">Product</th>
                    <th scope="col" className="pb-2.5 pl-3 text-right font-medium">Units</th>
                    <th scope="col" className="pb-2.5 pl-3 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle text-sm">
                  {topProducts.map((prod) => (
                    <tr
                      key={prod.productId}
                      className="relative hover:bg-surface-hover focus-within:bg-surface-hover transition-colors"
                    >
                      <th scope="row" className="w-full py-3 pr-2 text-left font-normal [overflow-wrap:anywhere]">
                        <Link
                          href={{ pathname: '/dashboard/products', query: { search: prod.sku } }}
                          prefetch={false}
                          className="rounded-sm font-semibold text-ink hover:text-accent after:absolute after:inset-0 after:content-['']"
                        >
                          {prod.name}
                        </Link>
                        <div className="text-caption text-ink-muted">{prod.sku}</div>
                      </th>
                      <td className="py-3 pl-3 text-right tabular-nums text-ink-secondary">
                        {prod.unitsSold.toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 text-right tabular-nums font-semibold text-ink whitespace-nowrap">
                        {money(prod.grossRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul role="list" className="divide-y divide-line-subtle border-t border-line-subtle @[19rem]:hidden">
                {topProducts.map((prod) => (
                  <li key={prod.productId} className="relative space-y-2 py-3 hover:bg-surface-hover focus-within:bg-surface-hover">
                    <div className="flex items-center gap-3">
                      <div aria-hidden="true">
                        <ProductArtwork category={prod.category} sku={prod.sku} size="sm" />
                      </div>
                      <div className="min-w-0 [overflow-wrap:anywhere]">
                        <Link
                          href={{ pathname: '/dashboard/products', query: { search: prod.sku } }}
                          prefetch={false}
                          className="rounded-sm text-sm font-semibold text-ink hover:text-accent after:absolute after:inset-0 after:content-['']"
                        >
                          {prod.name}
                        </Link>
                        <p className="text-caption text-ink-muted">{prod.sku}</p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-caption">
                      <div>
                        <dt className="text-ink-muted">Units</dt>
                        <dd className="tabular-nums text-ink-secondary">{prod.unitsSold.toLocaleString()}</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-ink-muted">Revenue</dt>
                        <dd className="text-sm font-semibold tabular-nums text-ink [overflow-wrap:anywhere]">{money(prod.grossRevenue)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="rounded-lg bg-surface-sunken px-4 py-5 text-sm text-ink-secondary">
              No product sales in this reporting window.
            </p>
          )}
        </section>

        {/* 12. Recent transactions */}
        <section className="card @container min-w-0 md:col-span-2 md:max-xl:order-2 xl:col-span-8 space-y-4">
          <CardHeader
            title="Recent Transactions"
            subtitle="Latest commercial settlements in the selected reporting window"
            action={<CardLink href="/dashboard/orders">Manage Orders</CardLink>}
          />
          {recentTransactions.length > 0 ? (
            <>
              <table className="hidden w-full text-left @[36rem]:table">
                <caption className="sr-only">Recent transactions in the reporting window</caption>
                <thead>
                  <tr className="border-b border-line-subtle text-caption text-ink-secondary">
                    <th scope="col" className="pb-2.5 pr-4 font-medium">Order</th>
                    <th scope="col" className="pb-2.5 pr-4 font-medium">Customer</th>
                    <th scope="col" className="pb-2.5 pr-4 font-medium">Date</th>
                    <th scope="col" className="pb-2.5 pr-4 font-medium">Payment</th>
                    <th scope="col" className="pb-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle text-sm">
                  {recentTransactions.map((ord) => (
                    <tr
                      key={ord.id}
                      className="relative hover:bg-surface-hover focus-within:bg-surface-hover transition-colors"
                    >
                      <th scope="row" className="min-w-32 py-3 pr-4 text-left tabular-nums [overflow-wrap:anywhere]">
                        <Link
                          href={{ pathname: '/dashboard/orders', query: { search: ord.orderNumber } }}
                          prefetch={false}
                          className="rounded-sm font-semibold text-accent hover:underline after:absolute after:inset-0 after:content-['']"
                        >
                          {ord.orderNumber}
                        </Link>
                      </th>
                      <td className="w-full py-3 pr-4 [overflow-wrap:anywhere]">
                        <div className="font-medium text-ink">{ord.customerCompany}</div>
                        <div className="text-caption text-ink-muted">{ord.customerName} · {ord.salesChannel}</div>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-ink-secondary">
                        <time dateTime={ord.orderDate}>{formatDateDisplay(ord.orderDate, settings.dateFormat)}</time>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={ord.paymentStatus} />
                      </td>
                      <td className="py-3 text-right tabular-nums font-semibold text-ink whitespace-nowrap">
                        {money(ord.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul role="list" className="divide-y divide-line-subtle border-t border-line-subtle @[36rem]:hidden">
                {recentTransactions.map((ord) => (
                  <li key={ord.id} className="relative space-y-2 py-3 hover:bg-surface-hover focus-within:bg-surface-hover">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm tabular-nums [overflow-wrap:anywhere]">
                      <Link
                        href={{ pathname: '/dashboard/orders', query: { search: ord.orderNumber } }}
                        prefetch={false}
                        className="rounded-sm font-semibold text-accent hover:underline after:absolute after:inset-0 after:content-['']"
                      >
                        {ord.orderNumber}
                      </Link>
                    <span className="min-w-0 font-semibold text-ink">
                      <span className="sr-only">Total </span>{money(ord.totalAmount)}
                    </span>
                    </div>
                    <div className="[overflow-wrap:anywhere]">
                      <p className="text-sm font-medium text-ink">{ord.customerCompany}</p>
                      <p className="text-caption text-ink-muted">{ord.customerName} · {ord.salesChannel}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <StatusBadge status={ord.paymentStatus} />
                      <time dateTime={ord.orderDate} className="text-caption tabular-nums text-ink-secondary">
                        {formatDateDisplay(ord.orderDate, settings.dateFormat)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="rounded-lg bg-surface-sunken px-4 py-5 text-sm text-ink-secondary">
              No transactions in this reporting window.
            </p>
          )}
        </section>

        {/* 14. Business activity feed */}
        <section className="card min-w-0 md:col-span-2 md:max-xl:order-3 xl:col-span-4 flex flex-col gap-4">
          <CardHeader
            title="Business Activity Feed"
            subtitle="Recent workspace mutations & exports"
            action={<CardLink href="/dashboard/activity">Full Log</CardLink>}
          />
          <ul role="list" className="divide-y divide-line-subtle border-t border-line-subtle">
            {activities.slice(0, 6).map((act) => (
              <li key={act.id} className="space-y-1.5 py-3 last:pb-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
                  <h3 className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">
                    {act.action}
                  </h3>
                  <time dateTime={act.timestamp} className="text-right text-caption tabular-nums text-ink-muted whitespace-nowrap">
                    {formatDateDisplay(act.timestamp, settings.dateFormat)}
                  </time>
                </div>
                <p className="text-sm leading-5 text-ink-secondary [overflow-wrap:anywhere]">{act.description}</p>
                <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-caption text-ink-muted [overflow-wrap:anywhere]">
                  <span>{act.actorName} ({act.actorRole})</span>
                  <span><span aria-hidden="true">· </span>{act.category}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

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
