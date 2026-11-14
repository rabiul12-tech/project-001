'use client';

import React, { useMemo, useState } from 'react';
import { Download, Filter, Info } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import {
  buildRevenueTimeSeries,
  calculateExecutiveComparison,
  calculateSalesByCategory,
  calculateSalesByChannel,
  filterOrdersByWindow,
  resolveDateWindow,
} from '@/lib/calculations/analytics';
import {
  convertRowsToCsv,
  formatCurrency,
  triggerBrowserDownload,
} from '@/lib/export/exporter';
import { KPIStatCard, PageHeader, TrendIndicator } from '@/components/ui/primitives';
import {
  CategoryHorizontalBars,
  ChannelDonutChart,
  OrdersAndCustomerGrowthChart,
  RevenueTrendChart,
} from '@/components/charts/AnalyticsCharts';
import { SalesChannel } from '@/types';

export default function DeepAnalyticsPage() {
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const dailySessions = useAppStore((s) => s.dailySessions);
  const settings = useAppStore((s) => s.settings);
  const datePreset = useAppStore((s) => s.datePreset);
  const customStartDate = useAppStore((s) => s.customStartDate);
  const customEndDate = useAppStore((s) => s.customEndDate);
  const addToast = useAppStore((s) => s.addToast);

  const [channelFilter, setChannelFilter] = useState<SalesChannel | 'All'>('All');
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');
  const [activeMetric, setActiveMetric] = useState<'netRevenue' | 'grossRevenue' | 'orders' | 'aov'>('netRevenue');

  const dateWindow = useMemo(
    () => resolveDateWindow(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate]
  );

  const filteredOrders = useMemo(() => {
    if (channelFilter === 'All') return orders;
    return orders.filter((o) => o.salesChannel === channelFilter);
  }, [orders, channelFilter]);

  const comparison = useMemo(
    () => calculateExecutiveComparison(filteredOrders, dailySessions, dateWindow),
    [filteredOrders, dailySessions, dateWindow]
  );

  const timeSeries = useMemo(
    () => buildRevenueTimeSeries(filteredOrders, customers, dateWindow),
    [filteredOrders, customers, dateWindow]
  );

  const windowOrders = useMemo(
    () => filterOrdersByWindow(filteredOrders, dateWindow.startMs, dateWindow.endMs),
    [filteredOrders, dateWindow]
  );

  const categoryPerformance = useMemo(
    () => calculateSalesByCategory(windowOrders),
    [windowOrders]
  );

  const channelPerformance = useMemo(
    () => calculateSalesByChannel( filterOrdersByWindow(orders, dateWindow.startMs, dateWindow.endMs)),
    [orders, dateWindow]
  );

  // Simulated Conversion Funnel calculation from dailySessions in window
  const funnelStages = useMemo(() => {
    const startIso = new Date(dateWindow.startMs).toISOString().slice(0, 10);
    const endIso = new Date(dateWindow.endMs).toISOString().slice(0, 10);
    const periodSessions = dailySessions.filter((s) => s.date >= startIso && s.date <= endIso);

    const totalSessions = periodSessions.reduce((acc, s) => acc + s.sessions, 0);
    const uniqueVisitors = periodSessions.reduce((acc, s) => acc + s.uniqueVisitors, 0);
    const demoRequests = periodSessions.reduce((acc, s) => acc + s.demoRequests, 0);
    const checkoutInitiated = periodSessions.reduce((acc, s) => acc + s.cartInitiated, 0);
    const settledOrders = windowOrders.filter(
      (o) => o.paymentStatus === 'Paid' || o.paymentStatus === 'Refunded'
    ).length;

    const topBase = Math.max(1, totalSessions);

    return [
      {
        stage: 'Total Sessions (Simulated Telemetry)',
        count: totalSessions,
        rateFromTop: 100,
        conversionNote: 'All web & partner portal visits',
      },
      {
        stage: 'Unique Qualified Visitors (Demo)',
        count: uniqueVisitors,
        rateFromTop: Math.round((uniqueVisitors / topBase) * 1000) / 10,
        conversionNote: 'De-duplicated decision makers',
      },
      {
        stage: 'Architecture Evaluation / Trial',
        count: demoRequests,
        rateFromTop: Math.round((demoRequests / topBase) * 1000) / 10,
        conversionNote: 'Interactive sandbox or quote initiated',
      },
      {
        stage: 'Commercial Proposal / Checkout',
        count: checkoutInitiated,
        rateFromTop: Math.round((checkoutInitiated / topBase) * 1000) / 10,
        conversionNote: 'Contract terms or cart configured',
      },
      {
        stage: 'Settled Commercial Orders (Actual Ledger)',
        count: settledOrders,
        rateFromTop: Math.round((settledOrders / Math.max(1, uniqueVisitors)) * 10000) / 100,
        conversionNote: 'Reconciled Paid & Refunded orders',
      },
    ];
  }, [dailySessions, dateWindow, windowOrders]);

  const handleExportAnalyticsCsv = () => {
    const headers = [
      'Period',
      'Date Key',
      'Gross Revenue',
      'Net Revenue',
      'Refunds',
      'Orders',
      'Average Order Value',
      'New Customers',
    ];
    const rows = timeSeries.map((pt) => [
      pt.label,
      pt.dateKey,
      pt.grossRevenue,
      pt.netRevenue,
      pt.refunds,
      pt.orders,
      pt.aov,
      pt.newCustomers,
    ]);
    triggerBrowserDownload(
      convertRowsToCsv(headers, rows),
      `aurelix-deep-analytics-${datePreset}-${channelFilter}.csv`
    );
    addToast('Analytics CSV exported', `Downloaded ${rows.length} period rows.`, 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deep Analytics & Cohort Telemetry"
        subtitle="Multi-dimensional performance analysis across acquisition channels, product categories, and conversion funnels."
        meta={`${dateWindow.days}-Day Window · Channel: ${channelFilter}`}
        actions={
          <button
            type="button"
            onClick={handleExportAnalyticsCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Analytics CSV</span>
          </button>
        }
      />

      {/* Filter & Metric Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-surface-raised border border-line">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Channel Filter:</span>
          </span>
          {(['All', 'Direct Enterprise', 'Self-Serve Web', 'Partner Channel', 'Marketplace'] as const).map(
            (ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  channelFilter === ch
                    ? 'bg-accent-strong text-white'
                    : 'bg-surface-sunken text-ink-muted hover:text-ink'
                }`}
              >
                {ch}
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">Primary Metric:</span>
          <select
            aria-label="Select primary chart metric"
            value={activeMetric}
            onChange={(e) =>
              setActiveMetric(
                e.target.value as 'netRevenue' | 'grossRevenue' | 'orders' | 'aov'
              )
            }
            className="px-2.5 py-1.5 rounded-lg bg-surface-sunken border border-line text-xs font-medium text-ink-secondary"
          >
            <option value="netRevenue">Net Revenue</option>
            <option value="grossRevenue">Gross Revenue</option>
            <option value="orders">Order Volume</option>
            <option value="aov">Average Order Value (AOV)</option>
          </select>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-sunken border border-line">
            {(['area', 'bar', 'line'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setChartType(m)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  chartType === m
                    ? 'bg-surface-hover text-ink shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Period Comparison KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIStatCard
          label="Period Net Revenue"
          value={formatCurrency(comparison.current.netRevenue, settings.currency, settings.numberFormat)}
          delta={comparison.deltas.netRevenue}
          secondaryMeta={`Prior: ${formatCurrency(comparison.previous.netRevenue, settings.currency, settings.numberFormat, true)}`}
        />
        <KPIStatCard
          label="Average Order Value"
          value={formatCurrency(comparison.current.averageOrderValue, settings.currency, settings.numberFormat)}
          delta={comparison.deltas.averageOrderValue}
          secondaryMeta={`Prior: ${formatCurrency(comparison.previous.averageOrderValue, settings.currency, settings.numberFormat, true)}`}
        />
        <KPIStatCard
          label="Completed Orders"
          value={comparison.current.totalOrdersCount.toLocaleString()}
          delta={comparison.deltas.totalOrders}
          secondaryMeta={`Prior: ${comparison.previous.totalOrdersCount}`}
        />
        <KPIStatCard
          label="Refund Rate (% of Gross)"
          value={`${comparison.current.refundRatePercent.toFixed(1)}%`}
          delta={comparison.deltas.refundRate}
          invertDelta={true}
          secondaryMeta={`Prior: ${comparison.previous.refundRatePercent.toFixed(1)}%`}
        />
      </div>

      {/* Primary Customizable Visualization */}
      <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-heading text-ink">
              Time-Series Performance ({activeMetric === 'netRevenue' ? 'Net Revenue' : activeMetric === 'grossRevenue' ? 'Gross Revenue' : activeMetric === 'orders' ? 'Order Count' : 'Average Order Value'})
            </h2>
            <p className="text-xs text-ink-muted">
              Interactive visualization across {timeSeries.length} time buckets
            </p>
          </div>
        </div>
        <RevenueTrendChart
          data={timeSeries}
          currency={settings.currency}
          numberFormat={settings.numberFormat}
          mode={chartType}
          metric={activeMetric}
        />
      </div>

      {/* Conversion Funnel & Category Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 p-6 rounded-xl bg-surface-raised border border-line space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-heading text-ink">
                Acquisition & Conversion Funnel
              </h2>
              <p className="text-xs text-ink-muted">
                Combines simulated session telemetry with actual settled order records
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Info className="w-3.5 h-3.5 text-accent" />
              <span>Demo Session Source</span>
            </span>
          </div>

          <div className="space-y-3.5">
            {funnelStages.map((st, idx) => (
              <div
                key={st.stage}
                className="p-3.5 rounded-xl bg-surface-sunken border border-line space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink">
                    0{idx + 1}. {st.stage}
                  </span>
                  <span className="tabular-nums font-bold text-ink">
                    {st.count.toLocaleString()}{' '}
                    <span className="text-accent font-normal">
                      ({st.rateFromTop}%)
                    </span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-strong dark:bg-blue-500"
                    style={{ width: `${Math.min(100, Math.max(6, st.rateFromTop))}%` }}
                  />
                </div>
                <div className="text-xs text-ink-muted">
                  {st.conversionNote}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 p-6 rounded-xl bg-surface-raised border border-line flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-heading text-ink">
              Product Category Performance
            </h2>
            <p className="text-xs text-ink-muted">
              Gross line-item revenue and unit volume distribution by category
            </p>
          </div>

          <CategoryHorizontalBars
            data={categoryPerformance}
            currency={settings.currency}
            numberFormat={settings.numberFormat}
          />

          <div className="pt-4 border-t border-line-subtle">
            <h3 className="text-xs font-bold text-ink mb-3">
              Sales Channel Distribution (All Channels in Period)
            </h3>
            <ChannelDonutChart
              data={channelPerformance}
              currency={settings.currency}
              numberFormat={settings.numberFormat}
            />
          </div>
        </div>
      </div>

      {/* Customer Acquisition & Period Comparison Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 p-6 rounded-xl bg-surface-raised border border-line space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Customer Acquisition & Order Velocity
            </h2>
            <p className="text-xs text-ink-muted">
              New account cohorts alongside order frequency
            </p>
          </div>
          <OrdersAndCustomerGrowthChart data={timeSeries} />
        </div>

        <div className="lg:col-span-7 p-6 rounded-xl bg-surface-raised border border-line space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Period-over-Period Benchmark Table
            </h2>
            <p className="text-xs text-ink-muted">
              Current {dateWindow.days}-day window compared against immediately preceding {dateWindow.days}-day window
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-muted">
                  <th className="pb-2.5">Financial / Operational Metric</th>
                  <th className="pb-2.5 text-right">Current Period</th>
                  <th className="pb-2.5 text-right">Previous Period</th>
                  <th className="pb-2.5 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle text-xs">
                <tr>
                  <td className="py-3 font-medium text-ink">Net Realized Revenue</td>
                  <td className="py-3 text-right tabular-nums font-semibold">
                    {formatCurrency(comparison.current.netRevenue, settings.currency, settings.numberFormat)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {formatCurrency(comparison.previous.netRevenue, settings.currency, settings.numberFormat)}
                  </td>
                  <td className="py-3 text-right">
                    <TrendIndicator value={comparison.deltas.netRevenue} comparisonLabel="" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-ink">Gross Revenue (Pre-Discount)</td>
                  <td className="py-3 text-right tabular-nums font-semibold">
                    {formatCurrency(comparison.current.grossRevenue, settings.currency, settings.numberFormat)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {formatCurrency(comparison.previous.grossRevenue, settings.currency, settings.numberFormat)}
                  </td>
                  <td className="py-3 text-right">
                    <TrendIndicator value={comparison.deltas.grossRevenue} comparisonLabel="" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-ink">Total Order Count</td>
                  <td className="py-3 text-right tabular-nums font-semibold">
                    {comparison.current.totalOrdersCount.toLocaleString()}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {comparison.previous.totalOrdersCount.toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <TrendIndicator value={comparison.deltas.totalOrders} comparisonLabel="" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-ink">Active Purchasing Customers</td>
                  <td className="py-3 text-right tabular-nums font-semibold">
                    {comparison.current.activeCustomersCount.toLocaleString()}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {comparison.previous.activeCustomersCount.toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <TrendIndicator value={comparison.deltas.activeCustomers} comparisonLabel="" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-medium text-ink">Average Order Value (AOV)</td>
                  <td className="py-3 text-right tabular-nums font-semibold">
                    {formatCurrency(comparison.current.averageOrderValue, settings.currency, settings.numberFormat)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-ink-muted">
                    {formatCurrency(comparison.previous.averageOrderValue, settings.currency, settings.numberFormat)}
                  </td>
                  <td className="py-3 text-right">
                    <TrendIndicator value={comparison.deltas.averageOrderValue} comparisonLabel="" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
