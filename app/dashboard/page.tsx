'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Download,
  Plus,
  ArrowUpRight,
  RotateCcw,
  FileSpreadsheet,
  Users,
  ShoppingCart,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
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
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-caption bg-surface-sunken text-ink-secondary hover:bg-surface-hover hover:text-ink transition-colors whitespace-nowrap shrink-0';

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
        <p className="text-xs text-ink-muted">{subtitle}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-caption text-accent hover:underline inline-flex items-center gap-1 whitespace-nowrap rounded-sm"
    >
      <span>{children}</span>
      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
    </Link>
  );
}

export default function ExecutiveOverviewPage() {
  const router = useRouter();
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const products = useAppStore((s) => s.products);
  const activities = useAppStore((s) => s.activities);
  const dailySessions = useAppStore((s) => s.dailySessions);
  const settings = useAppStore((s) => s.settings);
  const datePreset = useAppStore((s) => s.datePreset);
  const customStartDate = useAppStore((s) => s.customStartDate);
  const customEndDate = useAppStore((s) => s.customEndDate);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
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
    <div className="space-y-6">
      {/* 1. Welcome Heading with Current Date & Quick Actions */}
      <PageHeader
        title={`Welcome back, ${settings.personalName.split(' ')[0]}`}
        subtitle={`Executive command center for ${settings.workspaceName}. All KPIs reconcile directly with the active ${dateWindow.days}-day ledger window.`}
        meta={todayLabel}
        actions={
          <>
            <button
              type="button"
              onClick={handleExportOverviewCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-surface-raised border border-line text-ink hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <Link
              href="/dashboard/orders?action=new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white border border-transparent transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New Order</span>
            </Link>
          </>
        }
      />

      {/* 2. Quick Actions & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 rounded-xl bg-surface-raised border border-line">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption font-semibold text-ink mr-2">Quick actions</span>
          <Link href="/dashboard/customers?action=new" className={SECONDARY_BUTTON}>
            <Users className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Add Customer</span>
          </Link>
          <Link href="/dashboard/orders?action=new" className={SECONDARY_BUTTON}>
            <ShoppingCart className="w-4 h-4 text-success" aria-hidden="true" />
            <span>Create Order</span>
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

      {/* One 12-column grid for every row: KPIs 3/3/3/3, card rows 8/4.
          Below xl (content area under ~970px) it becomes 2 columns, below md a single column. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
        {/* 3–7. Primary KPIs with comparison deltas */}
        <div className="xl:col-span-3 grid">
          <KPIStatCard
            label="Net Realized Revenue"
            value={money(cur.netRevenue)}
            delta={deltas.netRevenue}
            secondaryMeta={`Gross ${money(cur.grossRevenue, true)}`}
            onClick={() => router.push('/dashboard/revenue')}
          />
        </div>
        <div className="xl:col-span-3 grid">
          <KPIStatCard
            label="Total Orders"
            value={cur.totalOrdersCount.toLocaleString()}
            delta={deltas.totalOrders}
            secondaryMeta={`AOV ${money(cur.averageOrderValue)}`}
            onClick={() => router.push('/dashboard/orders')}
          />
        </div>
        <div className="xl:col-span-3 grid">
          <KPIStatCard
            label="Active Purchasing Accounts"
            value={cur.activeCustomersCount.toLocaleString()}
            delta={deltas.activeCustomers}
            secondaryMeta={`Of ${customers.length} total`}
            onClick={() => router.push('/dashboard/customers')}
          />
        </div>
        <div className="xl:col-span-3 grid">
          <KPIStatCard
            label="Session Conversion Rate"
            value={`${cur.conversionRatePercent.toFixed(2)}%`}
            delta={deltas.conversionRate}
            secondaryMeta={`${cur.totalUniqueVisitors.toLocaleString()} visitors`}
            onClick={() => router.push('/dashboard/analytics')}
          />
        </div>

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
                    className={`px-3 py-1 text-caption rounded-md capitalize transition-colors ${
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
          <div className="pt-4 border-t border-line-subtle flex items-center justify-between text-xs">
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
            subtitle="Completed order volume vs. newly onboarded customer accounts"
            action={<CardLink href="/dashboard/analytics">Deep Analytics</CardLink>}
          />
          <OrdersAndCustomerGrowthChart data={timeSeries} />
        </section>

        {/* 13. Top-performing products */}
        <section className="card xl:col-span-4 space-y-4">
          <CardHeader
            title="Top-Performing Products"
            subtitle="Ranked by gross line-item revenue in selected period"
            action={<CardLink href="/dashboard/products">All {products.length} SKUs</CardLink>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[240px] text-left border-collapse table-sticky-first">
              <thead>
                <tr className="border-b border-line-subtle text-caption text-ink-muted">
                  <th scope="col" className="pb-3 font-medium">Product</th>
                  <th scope="col" className="pb-3 pl-3 font-medium text-right">Units</th>
                  <th scope="col" className="pb-3 pl-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle text-sm">
                {topProducts.map((prod) => (
                  <tr
                    key={prod.productId}
                    onClick={() => router.push(`/dashboard/products?search=${prod.sku}`)}
                    className="hover:bg-surface-hover cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-3 max-w-0 w-full">
                      <div className="flex items-center gap-3 min-w-0">
                        <ProductArtwork category={prod.category} sku={prod.sku} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium text-ink truncate" title={prod.name}>
                            {prod.name}
                          </div>
                          <div className="text-xs text-ink-muted truncate">{prod.sku}</div>
                        </div>
                      </div>
                    </td>
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
          </div>
        </section>

        {/* 12. Recent transactions */}
        <section className="card md:col-span-2 md:max-xl:order-2 xl:col-span-8 space-y-4">
          <CardHeader
            title="Recent Transactions"
            subtitle="Latest commercial settlements in the selected reporting window"
            action={<CardLink href="/dashboard/orders">Manage Orders</CardLink>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left border-collapse table-sticky-first">
              <thead>
                <tr className="border-b border-line-subtle text-caption text-ink-muted">
                  <th scope="col" className="pb-3 pr-4 font-medium">Order</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Customer</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Payment</th>
                  <th scope="col" className="pb-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle text-sm">
                {recentTransactions.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => router.push(`/dashboard/orders?search=${ord.orderNumber}`)}
                    className="hover:bg-surface-hover cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4 tabular-nums font-semibold text-accent whitespace-nowrap">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 pr-4 max-w-0 w-full">
                      <div className="min-w-0">
                        <div className="font-medium text-ink truncate" title={ord.customerCompany}>
                          {ord.customerCompany}
                        </div>
                        <div
                          className="text-xs text-ink-muted truncate"
                          title={`${ord.customerName} · ${ord.salesChannel}`}
                        >
                          {ord.customerName} · {ord.salesChannel}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-ink-secondary whitespace-nowrap">
                      {formatDateDisplay(ord.orderDate, settings.dateFormat)}
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
          </div>
        </section>

        {/* 14. Business activity feed */}
        <section className="card md:col-span-2 md:max-xl:order-3 xl:col-span-4 flex flex-col gap-4">
          <CardHeader
            title="Business Activity Feed"
            subtitle="Recent workspace mutations & exports"
            action={<CardLink href="/dashboard/activity">Full Log</CardLink>}
          />
          <ul className="flex-1 flex flex-col justify-between divide-y divide-line-subtle">
            {activities.slice(0, 6).map((act) => (
              <li key={act.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink truncate" title={act.action}>
                    {act.action}
                  </span>
                  <span className="text-xs tabular-nums text-ink-muted whitespace-nowrap">
                    {formatDateDisplay(act.timestamp, settings.dateFormat)}
                  </span>
                </div>
                <p className="text-xs text-ink-secondary line-clamp-2">{act.description}</p>
                <div className="text-xs text-ink-muted truncate">
                  {act.actorName} · {act.actorRole} · {act.category}
                </div>
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
