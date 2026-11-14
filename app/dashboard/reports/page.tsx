'use client';

import React, { useMemo, useState } from 'react';
import {
  Download,
  Printer,
  BookmarkPlus,
  Trash2,
  FileSpreadsheet,
  Play,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useNowMs } from '@/lib/useClock';
import {
  calculateProductPerformance,
  enrichCustomersWithMetrics,
  filterOrdersByWindow,
  resolveDateWindow,
} from '@/lib/calculations/analytics';
import {
  convertRowsToCsv,
  formatCurrency,
  formatDateDisplay,
  triggerBrowserDownload,
} from '@/lib/export/exporter';
import { PageHeader, StatusBadge } from '@/components/ui/primitives';
import {
  DateRangePreset,
  PaymentStatus,
  ProductCategory,
  ReportType,
  SalesChannel,
} from '@/types';

export default function ReportingCenterPage() {
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const products = useAppStore((s) => s.products);
  const savedReports = useAppStore((s) => s.savedReports);
  const reportHistory = useAppStore((s) => s.reportHistory);
  const settings = useAppStore((s) => s.settings);
  const saveReportConfig = useAppStore((s) => s.saveReportConfig);
  const deleteReportConfig = useAppStore((s) => s.deleteReportConfig);
  const recordGeneratedReport = useAppStore((s) => s.recordGeneratedReport);
  const addToast = useAppStore((s) => s.addToast);
  const defaultStart = useAppStore((s) => s.customStartDate);
  const defaultEnd = useAppStore((s) => s.customEndDate);

  const [reportName, setReportName] = useState('Q4 Executive Revenue & Channel Audit');
  const [reportType, setReportType] = useState<ReportType>('Revenue Ledger');
  const [preset, setPreset] = useState<DateRangePreset>('90d');
  const [customStartInput, setCustomStart] = useState<string | null>(null);
  const [customEndInput, setCustomEnd] = useState<string | null>(null);
  const customStart = customStartInput ?? defaultStart;
  const customEnd = customEndInput ?? defaultEnd;
  const now = useNowMs();
  const [channelFilter, setChannelFilter] = useState<SalesChannel | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'All'>('All');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'All'>('All');

  const windowRange = useMemo(
    () => resolveDateWindow(preset, customStart, customEnd, new Date(now).toISOString()),
    [preset, customStart, customEnd, now]
  );

  const filteredOrders = useMemo(() => {
    const inWin = filterOrdersByWindow(orders, windowRange.startMs, windowRange.endMs);
    return inWin.filter((o) => {
      if (channelFilter !== 'All' && o.salesChannel !== channelFilter) return false;
      if (paymentFilter !== 'All' && o.paymentStatus !== paymentFilter) return false;
      if (categoryFilter !== 'All') {
        const hasCat = o.lineItems.some((li) => li.category === categoryFilter);
        if (!hasCat) return false;
      }
      return true;
    });
  }, [orders, windowRange, channelFilter, paymentFilter, categoryFilter]);

  const previewData = useMemo(() => {
    if (reportType === 'Revenue Ledger' || reportType === 'Sales Summary') {
      const headers = [
        'Order Number',
        'Date',
        'Customer Company',
        'Channel',
        'Payment Status',
        'Subtotal',
        'Discount',
        'Tax',
        'Billed Total',
        'Refunded',
        'Net Realized',
      ];
      const rows = filteredOrders.map((o) => {
        const net =
          o.paymentStatus === 'Paid' || o.paymentStatus === 'Refunded'
            ? Math.max(0, Math.round((o.totalAmount - o.refundedAmount) * 100) / 100)
            : 0;
        return [
          o.orderNumber,
          o.orderDate.slice(0, 10),
          o.customerCompany,
          o.salesChannel,
          o.paymentStatus,
          o.subtotal,
          o.discountAmount,
          o.taxAmount,
          o.totalAmount,
          o.refundedAmount,
          net,
        ];
      });
      const totalRevenue = filteredOrders.reduce((acc, o) => {
        if (o.paymentStatus === 'Paid' || o.paymentStatus === 'Refunded') {
          return acc + Math.max(0, o.totalAmount - o.refundedAmount);
        }
        return acc;
      }, 0);
      return { headers, rows, totalRevenue: Math.round(totalRevenue * 100) / 100 };
    }

    if (reportType === 'Customer Cohort') {
      const enriched = enrichCustomersWithMetrics(customers, filteredOrders).filter(
        (c) => c.ordersCount > 0
      );
      const headers = [
        'Customer ID',
        'Company',
        'Primary Contact',
        'Segment',
        'Status',
        'Country',
        'Orders in Window',
        'Net Realized Spend',
        'Average Order Value',
      ];
      const rows = enriched.map((c) => [
        c.id,
        c.company,
        c.name,
        c.segment,
        c.status,
        c.country,
        c.ordersCount,
        c.lifetimeSpend,
        c.averageOrderValue,
      ]);
      const totalRevenue = enriched.reduce((s, c) => s + c.lifetimeSpend, 0);
      return { headers, rows, totalRevenue: Math.round(totalRevenue * 100) / 100 };
    }

    // Product Velocity
    const prodPerf = calculateProductPerformance(products, filteredOrders).filter(
      (p) => categoryFilter === 'All' || p.category === categoryFilter
    );
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Current Catalog Price',
      'Units Sold in Window',
      'Order Appearances',
      'Gross Line-Item Revenue',
      'Available Stock',
    ];
    const rows = prodPerf.map((p) => [
      p.sku,
      p.name,
      p.category,
      p.currentUnitPrice,
      p.unitsSold,
      p.ordersCount,
      p.grossRevenue,
      p.stockLevel,
    ]);
    const totalRevenue = prodPerf.reduce((s, p) => s + p.grossRevenue, 0);
    return { headers, rows, totalRevenue: Math.round(totalRevenue * 100) / 100 };
  }, [reportType, filteredOrders, customers, products, categoryFilter]);

  const handleSaveTemplate = () => {
    if (!reportName.trim()) {
      addToast('Report name required', 'Provide a descriptive template name.', 'warning');
      return;
    }
    saveReportConfig({
      name: reportName.trim(),
      type: reportType,
      dateRangePreset: preset,
      customStartDate: customStart,
      customEndDate: customEnd,
      channelFilter,
      categoryFilter,
      paymentStatusFilter: paymentFilter,
    });
  };

  const handleDownloadCsv = () => {
    const csv = convertRowsToCsv(previewData.headers, previewData.rows);
    const safeSlug = reportName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerBrowserDownload(csv, `${safeSlug || 'aurelix-report'}.csv`);
    recordGeneratedReport({
      reportName: reportName || reportType,
      type: reportType,
      rowCount: previewData.rows.length,
      totalRevenueReported: previewData.totalRevenue,
      format: 'CSV',
    });
    addToast('Report CSV downloaded', `Exported ${previewData.rows.length} rows.`, 'success');
  };

  const handlePrintReport = () => {
    recordGeneratedReport({
      reportName: reportName || reportType,
      type: reportType,
      rowCount: previewData.rows.length,
      totalRevenueReported: previewData.totalRevenue,
      format: 'Print',
    });
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Reporting Center"
        subtitle="Configure custom report templates, preview reconciled ledger rows live, export CSV files, or print board-ready statements."
        meta={`${savedReports.length} Saved Templates · ${reportHistory.length} Generated Exports`}
        actions={
          <>
            <button
              type="button"
              onClick={handlePrintReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-surface-raised border border-line text-ink-secondary hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0 no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0 no-print"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV ({previewData.rows.length} rows)</span>
            </button>
          </>
        }
      />

      {/* Saved Report Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {savedReports.map((tpl) => (
          <div
            key={tpl.id}
            className="p-4 rounded-xl bg-surface-raised border border-line flex flex-col justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs tabular-nums text-accent font-semibold">
                  {tpl.type}
                </span>
                {savedReports.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteReportConfig(tpl.id)}
                    aria-label={`Delete template ${tpl.name}`}
                    className="text-ink-muted hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <h3 className="text-xs font-bold text-ink">{tpl.name}</h3>
              <p className="text-xs text-ink-muted">
                Window: {tpl.dateRangePreset.toUpperCase()} · Channel: {tpl.channelFilter}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReportName(tpl.name);
                setReportType(tpl.type);
                setPreset(tpl.dateRangePreset);
                setChannelFilter(tpl.channelFilter);
                setCategoryFilter(tpl.categoryFilter);
                setPaymentFilter(tpl.paymentStatusFilter);
                addToast('Template loaded', `Applied "${tpl.name}" filters.`, 'default');
              }}
              className="w-full py-2 px-3 rounded-lg bg-surface-hover hover:bg-blue-600 hover:text-white text-ink-secondary text-xs font-medium transition-colors inline-flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3" />
              <span>Load Template</span>
            </button>
          </div>
        ))}
      </div>

      {/* Report Configuration Builder */}
      <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-ink">
              Report Builder & Filter Parameters
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface-hover text-ink-secondary hover:bg-slate-200 transition-colors"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Save Configuration as Template</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Report Title
            </label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Report Model
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            >
              <option value="Revenue Ledger">Revenue Ledger</option>
              <option value="Sales Summary">Sales Summary</option>
              <option value="Customer Cohort">Customer Cohort</option>
              <option value="Product Velocity">Product Velocity</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Date Range
            </label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as DateRangePreset)}
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="6m">Last 6 Months</option>
              <option value="12m">Last 12 Months</option>
              <option value="custom">Custom Dates</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Sales Channel
            </label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as SalesChannel | 'All')}
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            >
              <option value="All">All Channels</option>
              <option value="Direct Enterprise">Direct Enterprise</option>
              <option value="Self-Serve Web">Self-Serve Web</option>
              <option value="Partner Channel">Partner Channel</option>
              <option value="Marketplace">Marketplace</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Payment Status
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'All')}
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid Only</option>
              <option value="Refunded">Refunded Only</option>
              <option value="Pending">Pending Only</option>
            </select>
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-ink-muted">Start:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-ink-muted">End:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
            </label>
          </div>
        )}
      </div>

      {/* Live Report Preview Card (Print-friendly) */}
      <div className="rounded-xl bg-surface-raised border border-line overflow-hidden">
        <div className="p-6 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs tabular-nums text-accent">
              LIVE REPORT PREVIEW · {reportType.toUpperCase()}
            </div>
            <h2 className="text-heading text-ink mt-1">
              {reportName}
            </h2>
            <p className="text-xs text-ink-muted">
              Showing top 25 of {previewData.rows.length} matching records · Prepared by{' '}
              {settings.personalName}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-muted">Total Reconciled Volume</div>
            <div className="text-xl font-bold tabular-nums text-success">
              {formatCurrency(previewData.totalRevenue, settings.currency, settings.numberFormat)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-sticky-first">
            <thead>
              <tr className="border-b border-line bg-surface-sunken/60 text-xs font-semibold text-ink-muted">
                {previewData.headers.map((h, hIdx) => (
                  <th
                    key={h}
                    className={`py-3 px-4 whitespace-nowrap ${
                      typeof previewData.rows[0]?.[hIdx] === 'number' ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {previewData.rows.slice(0, 25).map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-surface-hover/50">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`py-3 px-4 whitespace-nowrap ${
                        typeof cell === 'number' ? 'tabular-nums text-right' : ''
                      }`}
                    >
                      {typeof cell === 'number' && cIdx >= row.length - 3
                        ? formatCurrency(cell, settings.currency, settings.numberFormat)
                        : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Locally Generated Report History */}
      <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-3 no-print">
        <h2 className="text-sm font-bold text-ink">
          Generated Report History (Persisted Locally)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-sticky-first">
            <thead>
              <tr className="border-b border-line text-xs text-ink-muted">
                <th className="py-2 pr-4">Report Name</th>
                <th className="py-2 px-4">Type</th>
                <th className="py-2 px-4">Generated By</th>
                <th className="py-2 px-4">Date</th>
                <th className="py-2 px-4 text-right">Rows</th>
                <th className="py-2 pl-4 text-right">Reconciled Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {reportHistory.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4 font-semibold text-ink">
                    {item.reportName}{' '}
                    <span className="tabular-nums text-xs text-accent ml-1">
                      [{item.format}]
                    </span>
                  </td>
                  <td className="py-3 px-4 text-ink-muted">{item.type}</td>
                  <td className="py-3 px-4 text-ink-secondary">
                    {item.generatedBy}
                  </td>
                  <td className="py-3 px-4 tabular-nums text-ink-muted">
                    {formatDateDisplay(item.generatedAt, settings.dateFormat)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {item.rowCount}
                  </td>
                  <td className="py-3 pl-4 text-right tabular-nums font-semibold text-success">
                    {formatCurrency(item.totalRevenueReported, settings.currency, settings.numberFormat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
