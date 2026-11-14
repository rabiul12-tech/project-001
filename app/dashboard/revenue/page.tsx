'use client';

import React, { useMemo, useState } from 'react';
import { Download, Search, ArrowUpDown, Eye } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useNowMs } from '@/lib/useClock';
import {
  buildRevenueTimeSeries,
  calculateExecutiveComparison,
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
import {
  KPIStatCard,
  PageHeader,
  StatusBadge,
} from '@/components/ui/primitives';
import { DetailDrawer, Pagination } from '@/components/ui/overlays';
import { RevenueTrendChart } from '@/components/charts/AnalyticsCharts';
import { Order, PaymentStatus } from '@/types';

export default function RevenueIntelligencePage() {
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const products = useAppStore((s) => s.products);
  const dailySessions = useAppStore((s) => s.dailySessions);
  const settings = useAppStore((s) => s.settings);
  const datePreset = useAppStore((s) => s.datePreset);
  const customStartDate = useAppStore((s) => s.customStartDate);
  const customEndDate = useAppStore((s) => s.customEndDate);
  const addToast = useAppStore((s) => s.addToast);

  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'orderDate' | 'totalAmount' | 'netRealized'>('orderDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const now = useNowMs();
  const dateWindow = useMemo(
    () => resolveDateWindow(datePreset, customStartDate, customEndDate, new Date(now).toISOString()),
    [datePreset, customStartDate, customEndDate, now]
  );

  const comparison = useMemo(
    () => calculateExecutiveComparison(orders, dailySessions, dateWindow),
    [orders, dailySessions, dateWindow]
  );

  const periodOrders = useMemo(
    () => filterOrdersByWindow(orders, dateWindow.startMs, dateWindow.endMs),
    [orders, dateWindow]
  );

  const timeSeries = useMemo(
    () => buildRevenueTimeSeries(orders, customers, dateWindow),
    [orders, customers, dateWindow]
  );

  const topProductsByRevenue = useMemo(
    () => calculateProductPerformance(products, periodOrders).slice(0, 6),
    [products, periodOrders]
  );

  const topCustomersByRevenue = useMemo(
    () =>
      enrichCustomersWithMetrics(customers, periodOrders)
        .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)
        .slice(0, 6),
    [customers, periodOrders]
  );

  const revenueByPaymentStatus = useMemo(() => {
    const groups: Record<PaymentStatus, { count: number; total: number; net: number }> = {
      Paid: { count: 0, total: 0, net: 0 },
      Refunded: { count: 0, total: 0, net: 0 },
      Pending: { count: 0, total: 0, net: 0 },
      Failed: { count: 0, total: 0, net: 0 },
    };
    for (const o of periodOrders) {
      groups[o.paymentStatus].count += 1;
      groups[o.paymentStatus].total += o.totalAmount;
      if (o.paymentStatus === 'Paid' || o.paymentStatus === 'Refunded') {
        groups[o.paymentStatus].net += Math.max(0, o.totalAmount - o.refundedAmount);
      }
    }
    return groups;
  }, [periodOrders]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return periodOrders
      .filter((o) => {
        if (paymentFilter !== 'All' && o.paymentStatus !== paymentFilter) return false;
        if (q) {
          return (
            o.orderNumber.toLowerCase().includes(q) ||
            o.customerCompany.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'orderDate') {
          diff = new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
        } else if (sortField === 'totalAmount') {
          diff = a.totalAmount - b.totalAmount;
        } else {
          const netA =
            a.paymentStatus === 'Paid' || a.paymentStatus === 'Refunded'
              ? Math.max(0, a.totalAmount - a.refundedAmount)
              : 0;
          const netB =
            b.paymentStatus === 'Paid' || b.paymentStatus === 'Refunded'
              ? Math.max(0, b.totalAmount - b.refundedAmount)
              : 0;
          diff = netA - netB;
        }
        return sortAsc ? diff : -diff;
      });
  }, [periodOrders, paymentFilter, searchQuery, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(
    () => filteredTransactions.slice((page - 1) * pageSize, page * pageSize),
    [filteredTransactions, page, pageSize]
  );

  const handleSort = (field: 'orderDate' | 'totalAmount' | 'netRealized') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportRevenueCsv = () => {
    const headers = [
      'Order Number',
      'Date',
      'Customer Company',
      'Channel',
      'Payment Status',
      'Gross Subtotal',
      'Discount',
      'Tax',
      'Order Total',
      'Refunded Amount',
      'Net Realized Revenue',
    ];
    const rows = filteredTransactions.map((o) => {
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
    triggerBrowserDownload(
      convertRowsToCsv(headers, rows),
      `aurelix-revenue-ledger-${datePreset}.csv`
    );
    addToast('Revenue ledger exported', `Downloaded ${rows.length} transaction records.`, 'success');
  };

  const cur = comparison.current;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Intelligence & Reconciliation"
        subtitle="Audit gross billings, promotional discounts, tax collections, simulated credit memos, and net realized revenue."
        meta={`Formula: Net = Total (${formatCurrency(cur.grossRevenue - cur.totalDiscounts + cur.totalTax, settings.currency, settings.numberFormat, true)}) − Refunds (${formatCurrency(cur.totalRefunds, settings.currency, settings.numberFormat, true)})`}
        actions={
          <button
            type="button"
            onClick={handleExportRevenueCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Revenue Ledger CSV</span>
          </button>
        }
      />

      {/* Primary Financial Reconciliation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIStatCard
          label="Gross Revenue (Pre-Discount)"
          value={formatCurrency(cur.grossRevenue, settings.currency, settings.numberFormat)}
          delta={comparison.deltas.grossRevenue}
          secondaryMeta={`${cur.paidOrdersCount + cur.refundedOrdersCount} eligible orders`}
        />
        <KPIStatCard
          label="Net Realized Revenue"
          value={formatCurrency(cur.netRevenue, settings.currency, settings.numberFormat)}
          delta={comparison.deltas.netRevenue}
          secondaryMeta={`Includes ${formatCurrency(cur.totalTax, settings.currency, settings.numberFormat, true)} tax`}
        />
        <KPIStatCard
          label="Commercial Discounts"
          value={formatCurrency(cur.totalDiscounts, settings.currency, settings.numberFormat)}
          secondaryMeta={`${cur.grossRevenue > 0 ? ((cur.totalDiscounts / cur.grossRevenue) * 100).toFixed(1) : '0.0'}% of gross`}
        />
        <KPIStatCard
          label="Simulated Refunds Issued"
          value={formatCurrency(cur.totalRefunds, settings.currency, settings.numberFormat)}
          delta={comparison.deltas.refundRate}
          invertDelta={true}
          secondaryMeta={`${cur.refundedOrdersCount} refunded orders (${cur.refundRatePercent}%)`}
        />
      </div>

      {/* Revenue Timeline & Payment Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-xl bg-surface-raised border border-line space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Revenue Timeline (Gross vs. Net Realized)
            </h2>
            <p className="text-xs text-ink-muted">
              Visualizing the spread between gross subtotal billings and net collected revenue
            </p>
          </div>
          <RevenueTrendChart
            data={timeSeries}
            currency={settings.currency}
            numberFormat={settings.numberFormat}
            mode="area"
          />
        </div>

        <div className="lg:col-span-4 p-6 rounded-xl bg-surface-raised border border-line flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Revenue by Payment Status
            </h2>
            <p className="text-xs text-ink-muted">
              Settlement status across all {periodOrders.length} orders in period
            </p>
          </div>

          <div className="space-y-3">
            {(['Paid', 'Pending', 'Refunded', 'Failed'] as const).map((st) => {
              const info = revenueByPaymentStatus[st];
              return (
                <div
                  key={st}
                  onClick={() => {
                    setPaymentFilter(paymentFilter === st ? 'All' : st);
                    setPage(1);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    paymentFilter === st
                      ? 'border-accent bg-surface-raised ring-1 ring-accent'
                      : 'border-line bg-surface-sunken/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={st} />
                    <span className="text-xs tabular-nums text-ink-muted">
                      {info.count} orders
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs text-ink-muted">Gross Invoice Volume:</span>
                    <span className="text-sm font-bold tabular-nums text-ink">
                      {formatCurrency(info.total, settings.currency, settings.numberFormat)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue by Product & Revenue by Customer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Top Revenue Contributors by Product SKU
            </h2>
            <p className="text-xs text-ink-muted">
              Line-item gross revenue generated in active window
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm table-sticky-first">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-muted">
                  <th className="pb-2">Product / SKU</th>
                  <th className="pb-2 text-right">Units</th>
                  <th className="pb-2 text-right">Gross Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {topProductsByRevenue.map((p) => (
                  <tr key={p.productId}>
                    <td className="py-3 pr-2">
                      <div className="font-semibold text-ink">
                        {p.name}
                      </div>
                      <div className="text-xs text-ink-muted tabular-nums">
                        {p.sku} · {p.category}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums text-ink-secondary">
                      {p.unitsSold}
                    </td>
                    <td className="py-3 pl-2 text-right tabular-nums font-semibold text-ink">
                      {formatCurrency(p.grossRevenue, settings.currency, settings.numberFormat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Top Revenue Contributors by Customer Account
            </h2>
            <p className="text-xs text-ink-muted">
              Ranked by net realized spend within the selected window
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm table-sticky-first">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-muted">
                  <th className="pb-2">Account</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Net Realized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {topCustomersByRevenue.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-2">
                      <div className="font-semibold text-ink">
                        {c.company}
                      </div>
                      <div className="text-xs text-ink-muted">
                        {c.name} · {c.segment}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums text-ink-secondary">
                      {c.ordersCount}
                    </td>
                    <td className="py-3 pl-2 text-right tabular-nums font-semibold text-success">
                      {formatCurrency(c.lifetimeSpend, settings.currency, settings.numberFormat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Transactions Ledger Table */}
      <div className="rounded-xl bg-surface-raised border border-line overflow-hidden">
        <div className="p-6 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-heading text-ink">
              Detailed Financial Transactions Ledger
            </h2>
            <p className="text-xs text-ink-muted">
              Click any transaction row to open the full Revenue Breakdown Drawer
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search order # or account..."
                className="pl-8 pr-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-ink focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter by payment status"
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value as PaymentStatus | 'All');
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-ink-secondary"
            >
              <option value="All">All Payment Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Refunded">Refunded</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-sticky-first">
            <thead>
              <tr className="border-b border-line bg-surface-sunken/60 text-xs font-semibold text-ink-muted">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('orderDate')}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Discount / Tax</th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('totalAmount')}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    <span>Billed Total</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('netRealized')}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    <span>Net Realized</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginatedTransactions.map((ord) => {
                const netRealized =
                  ord.paymentStatus === 'Paid' || ord.paymentStatus === 'Refunded'
                    ? Math.max(0, ord.totalAmount - ord.refundedAmount)
                    : 0;
                return (
                  <tr
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 tabular-nums font-semibold text-accent whitespace-nowrap">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 px-4 max-w-[160px]">
                      <div className="font-medium text-ink truncate" title={ord.customerCompany}>
                        {ord.customerCompany}
                      </div>
                      <div className="text-xs text-ink-muted">{ord.salesChannel}</div>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-ink-muted whitespace-nowrap">
                      {formatDateDisplay(ord.orderDate, settings.dateFormat)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ord.paymentStatus} />
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-ink-secondary">
                      {formatCurrency(ord.subtotal, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-ink-muted">
                      −{formatCurrency(ord.discountAmount, settings.currency, settings.numberFormat)} / +
                      {formatCurrency(ord.taxAmount, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-ink-secondary">
                      {formatCurrency(ord.totalAmount, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-success">
                      {formatCurrency(netRealized, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(ord);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-surface-sunken hover:bg-blue-600 hover:text-white text-ink-secondary transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredTransactions.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>

      {/* Revenue Breakdown Drawer */}
      <DetailDrawer
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Revenue Breakdown · ${selectedOrder.orderNumber}` : 'Revenue Breakdown'}
        subtitle={
          selectedOrder
            ? `${selectedOrder.customerCompany} · ${formatDateDisplay(selectedOrder.orderDate, settings.dateFormat)}`
            : undefined
        }
      >
        {selectedOrder && (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-sunken border border-line">
              <div>
                <div className="text-ink-muted">Customer Account</div>
                <div className="font-bold text-ink mt-1">
                  {selectedOrder.customerCompany}
                </div>
                <div className="text-ink-muted">{selectedOrder.customerEmail}</div>
              </div>
              <div>
                <div className="text-ink-muted">Settlement & Channel</div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={selectedOrder.paymentStatus} />
                  <StatusBadge status={selectedOrder.fulfillmentStatus} />
                </div>
                <div className="text-ink-muted mt-1">{selectedOrder.salesChannel}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-ink">
                Locked Line-Item Schedule
              </h3>
              <div className="rounded-xl border border-line overflow-hidden">
                <table className="w-full text-left border-collapse table-sticky-first">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken text-xs text-ink-muted">
                      <th className="py-2 px-3">SKU / Product</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Historical Unit Price</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {selectedOrder.lineItems.map((li) => (
                      <tr key={li.id}>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-ink">
                            {li.productName}
                          </div>
                          <div className="tabular-nums text-xs text-ink-muted">{li.sku}</div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {li.quantity}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {formatCurrency(li.unitPrice, settings.currency, settings.numberFormat)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-semibold">
                          {formatCurrency(li.subtotal, settings.currency, settings.numberFormat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-3">
              <h3 className="font-bold text-ink">
                Accounting Reconciliation Formula
              </h3>
              <div className="flex justify-between">
                <span className="text-ink-muted">Gross Line-Item Subtotal</span>
                <span className="tabular-nums">
                  {formatCurrency(selectedOrder.subtotal, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Less Commercial Discount</span>
                <span className="tabular-nums text-warning">
                  −{formatCurrency(selectedOrder.discountAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">
                  Plus Applicable Tax ({(selectedOrder.taxRate * 100).toFixed(1)}%)
                </span>
                <span className="tabular-nums">
                  +{formatCurrency(selectedOrder.taxAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-line-subtle font-semibold">
                <span>Billed Invoice Total</span>
                <span className="tabular-nums">
                  {formatCurrency(selectedOrder.totalAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Less Simulated Refunds Issued</span>
                <span className="tabular-nums text-danger">
                  −{formatCurrency(selectedOrder.refundedAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-line-subtle text-sm font-bold text-success">
                <span>Net Realized Revenue</span>
                <span className="tabular-nums">
                  {formatCurrency(
                    selectedOrder.paymentStatus === 'Paid' ||
                      selectedOrder.paymentStatus === 'Refunded'
                      ? Math.max(0, selectedOrder.totalAmount - selectedOrder.refundedAmount)
                      : 0,
                    settings.currency,
                    settings.numberFormat
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
