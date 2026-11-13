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
import { DateRangePicker } from '@/components/ui/DateRangePicker';

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
  const addToast = useAppStore((s) => s.addToast);

  const [chartMode, setChartMode] = useState<'area' | 'bar' | 'line'>('area');

  const dateWindow = useMemo(
    () => resolveDateWindow(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate]
  );

  const kpiComparison = useMemo(
    () => calculateExecutiveComparison(orders, dailySessions, dateWindow),
    [orders, dailySessions, dateWindow]
  );

  const timeSeries = useMemo(
    () => buildRevenueTimeSeries(orders, customers, dateWindow),
    [orders, customers, dateWindow]
  );

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
    () => periodOrders.slice(0, 7),
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

  return (
    <div className="space-y-6">
      {/* 1. Welcome Heading with Current Date & Quick Actions */}
      <PageHeader
        title={`Welcome back, ${settings.personalName.split(' ')[0]}`}
        subtitle={`Executive command center for ${settings.workspaceName}. All KPIs reconcile directly with the active ${dateWindow.days}-day ledger window.`}
        meta="Friday, November 13, 2026"
        actions={
          <>
            <button
              type="button"
              onClick={handleExportOverviewCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1B2639] transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <Link
              href="/dashboard/orders?action=new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Order</span>
            </Link>
          </>
        }
      />

      {/* 2. Quick Actions & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247]">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">
            Quick Actions:
          </span>
          <Link
            href="/dashboard/customers?action=new"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2639] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Add Customer</span>
          </Link>
          <Link
            href="/dashboard/orders?action=new"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2639] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Create Order</span>
          </Link>
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2639] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Generate Report</span>
          </Link>
          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1B2639] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Seed Data</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          Window: {new Date(dateWindow.startMs).toISOString().slice(0, 10)} →{' '}
          {new Date(dateWindow.endMs).toISOString().slice(0, 10)} ({dateWindow.days}d)
        </div>
      </div>

      {/* 3–7. Primary KPI Grid with Comparison Deltas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIStatCard
          label="Net Realized Revenue"
          value={formatCurrency(cur.netRevenue, settings.currency, settings.numberFormat)}
          delta={deltas.netRevenue}
          secondaryMeta={`Gross ${formatCurrency(cur.grossRevenue, settings.currency, settings.numberFormat, true)}`}
          onClick={() => router.push('/dashboard/revenue')}
        />
        <KPIStatCard
          label="Total Orders"
          value={cur.totalOrdersCount.toLocaleString()}
          delta={deltas.totalOrders}
          secondaryMeta={`AOV ${formatCurrency(cur.averageOrderValue, settings.currency, settings.numberFormat, true)}`}
          onClick={() => router.push('/dashboard/orders')}
        />
        <KPIStatCard
          label="Active Purchasing Accounts"
          value={cur.activeCustomersCount.toLocaleString()}
          delta={deltas.activeCustomers}
          secondaryMeta={`Of ${customers.length} total`}
          onClick={() => router.push('/dashboard/customers')}
        />
        <KPIStatCard
          label="Session Conversion Rate"
          value={`${cur.conversionRatePercent.toFixed(2)}%`}
          delta={deltas.conversionRate}
          secondaryMeta={`${cur.totalUniqueVisitors.toLocaleString()} visitors (Demo)`}
          onClick={() => router.push('/dashboard/analytics')}
        />
      </div>

      {/* 8–10. Main Revenue Trend & Sales by Channel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Revenue Trajectory (Net vs. Gross)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reconciled from settled orders after discounts and simulated refunds
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] self-start">
              {(['area', 'bar', 'line'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setChartMode(m)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    chartMode === m
                      ? 'bg-white dark:bg-[#1B2639] text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <RevenueTrendChart
            data={timeSeries}
            currency={settings.currency}
            numberFormat={settings.numberFormat}
            mode={chartMode}
          />
        </div>

        <div className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Revenue by Sales Channel
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Net realized share across acquisition channels
            </p>
          </div>

          <ChannelDonutChart
            data={channelBreakdown}
            currency={settings.currency}
            numberFormat={settings.numberFormat}
          />

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Pending Invoices:</span>
            <span className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrency(cur.pendingRevenue, settings.currency, settings.numberFormat)}
            </span>
          </div>
        </div>
      </div>

      {/* 11 & 13. Customer & Order Velocity + Top-Performing Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Order Volume & Customer Acquisition
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Completed order volume vs. newly onboarded customer accounts
              </p>
            </div>
            <Link
              href="/dashboard/analytics"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Deep Analytics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <OrdersAndCustomerGrowthChart data={timeSeries} />
        </div>

        <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Top-Performing Products
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranked by gross line-item revenue in selected period
              </p>
            </div>
            <Link
              href="/dashboard/products"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>All {products.length} SKUs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#273247] text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="pb-2.5">Product</th>
                  <th className="pb-2.5 text-right">Units</th>
                  <th className="pb-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {topProducts.map((prod) => (
                  <tr
                    key={prod.productId}
                    onClick={() => router.push(`/dashboard/products?search=${prod.sku}`)}
                    className="hover:bg-slate-50 dark:hover:bg-[#1B2639]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <ProductArtwork category={prod.category} sku={prod.sku} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {prod.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {prod.sku} · {prod.category}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {prod.unitsSold}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(prod.grossRevenue, settings.currency, settings.numberFormat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 12 & 14. Recent Transactions & Business Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Recent Transactions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latest commercial settlements in the selected reporting window
              </p>
            </div>
            <Link
              href="/dashboard/orders"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Manage Orders</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#273247] text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="pb-2.5">Order</th>
                  <th className="pb-2.5">Customer</th>
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5">Payment</th>
                  <th className="pb-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {recentTransactions.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => router.push(`/dashboard/orders?search=${ord.orderNumber}`)}
                    className="hover:bg-slate-50 dark:hover:bg-[#1B2639]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-3 font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {ord.customerCompany}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ord.customerName} · {ord.salesChannel}
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateDisplay(ord.orderDate, settings.dateFormat)}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={ord.paymentStatus} />
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatCurrency(ord.totalAmount, settings.currency, settings.numberFormat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Business Activity Feed
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recent workspace mutations & exports
              </p>
            </div>
            <Link
              href="/dashboard/activity"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Full Log →
            </Link>
          </div>

          <div className="space-y-3.5 flex-1">
            {activities.slice(0, 6).map((act) => (
              <div
                key={act.id}
                className="pb-3 border-b border-slate-100 dark:border-slate-800/70 last:border-none last:pb-0 space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {act.action}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {formatDateDisplay(act.timestamp, settings.dateFormat)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {act.description}
                </p>
                <div className="text-[11px] text-slate-400">
                  {act.actorName} · {act.actorRole} · {act.category}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
