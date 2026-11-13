'use client';

import React, { useMemo, useState } from 'react';
import { Download, Search, ArrowUpDown, Eye } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
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

  const dateWindow = useMemo(
    () => resolveDateWindow(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate]
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
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
        <div className="lg:col-span-8 p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Revenue Timeline (Gross vs. Net Realized)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
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

        <div className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Revenue by Payment Status
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
                  className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    paymentFilter === st
                      ? 'border-blue-600 bg-blue-600/5 dark:bg-blue-400/10'
                      : 'border-slate-200 dark:border-[#273247] bg-slate-50/70 dark:bg-[#0F1625]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={st} />
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {info.count} orders
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs text-slate-500">Gross Invoice Volume:</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
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
        <div className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Top Revenue Contributors by Product SKU
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Line-item gross revenue generated in active window
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#273247] text-[11px] font-semibold text-slate-500">
                  <th className="pb-2">Product / SKU</th>
                  <th className="pb-2 text-right">Units</th>
                  <th className="pb-2 text-right">Gross Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {topProductsByRevenue.map((p) => (
                  <tr key={p.productId}>
                    <td className="py-2.5 pr-2">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {p.sku} · {p.category}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {p.unitsSold}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(p.grossRevenue, settings.currency, settings.numberFormat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Top Revenue Contributors by Customer Account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ranked by net realized spend within the selected window
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#273247] text-[11px] font-semibold text-slate-500">
                  <th className="pb-2">Account</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Net Realized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {topCustomersByRevenue.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-2">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {c.company}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {c.name} · {c.segment}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {c.ordersCount}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
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
      <div className="rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-[#273247] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Detailed Financial Transactions Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any transaction row to open the full Revenue Breakdown Drawer
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search order # or account..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter by payment status"
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value as PaymentStatus | 'All');
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] text-xs text-slate-800 dark:text-slate-200"
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
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#273247] bg-slate-50/60 dark:bg-[#0F1625]/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('orderDate')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
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
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Billed Total</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('netRealized')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Net Realized</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {paginatedTransactions.map((ord) => {
                const netRealized =
                  ord.paymentStatus === 'Paid' || ord.paymentStatus === 'Refunded'
                    ? Math.max(0, ord.totalAmount - ord.refundedAmount)
                    : 0;
                return (
                  <tr
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className="hover:bg-slate-50 dark:hover:bg-[#1B2639]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {ord.customerCompany}
                      </div>
                      <div className="text-[11px] text-slate-500">{ord.salesChannel}</div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDateDisplay(ord.orderDate, settings.dateFormat)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ord.paymentStatus} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(ord.subtotal, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                      −{formatCurrency(ord.discountAmount, settings.currency, settings.numberFormat)} / +
                      {formatCurrency(ord.taxAmount, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {formatCurrency(ord.totalAmount, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(netRealized, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(ord);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#0F1625] hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 transition-colors"
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
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247]">
              <div>
                <div className="text-slate-500">Customer Account</div>
                <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedOrder.customerCompany}
                </div>
                <div className="text-slate-500">{selectedOrder.customerEmail}</div>
              </div>
              <div>
                <div className="text-slate-500">Settlement & Channel</div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={selectedOrder.paymentStatus} />
                  <StatusBadge status={selectedOrder.fulfillmentStatus} />
                </div>
                <div className="text-slate-500 mt-1">{selectedOrder.salesChannel}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                Locked Line-Item Schedule
              </h3>
              <div className="rounded-xl border border-slate-200 dark:border-[#273247] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#273247] bg-slate-50 dark:bg-[#0F1625] text-[11px] text-slate-500">
                      <th className="py-2 px-3">SKU / Product</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Historical Unit Price</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedOrder.lineItems.map((li) => (
                      <tr key={li.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {li.productName}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">{li.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {li.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatCurrency(li.unitPrice, settings.currency, settings.numberFormat)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {formatCurrency(li.subtotal, settings.currency, settings.numberFormat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] space-y-2.5">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                Accounting Reconciliation Formula
              </h3>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Line-Item Subtotal</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(selectedOrder.subtotal, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Less Commercial Discount</span>
                <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  −{formatCurrency(selectedOrder.discountAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Plus Applicable Tax ({(selectedOrder.taxRate * 100).toFixed(1)}%)
                </span>
                <span className="font-mono tabular-nums">
                  +{formatCurrency(selectedOrder.taxAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-semibold">
                <span>Billed Invoice Total</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(selectedOrder.totalAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Less Simulated Refunds Issued</span>
                <span className="font-mono tabular-nums text-red-600 dark:text-red-400">
                  −{formatCurrency(selectedOrder.refundedAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <span>Net Realized Revenue</span>
                <span className="font-mono tabular-nums">
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
