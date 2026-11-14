'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Download,
  Eye,
  RotateCcw,
  XCircle,
  ArrowUpDown,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { calculateOrderTotalsFromItems } from '@/lib/calculations/analytics';
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
import {
  ConfirmDialog,
  DetailDrawer,
  EmptyState,
  ModalDialog,
  Pagination,
} from '@/components/ui/overlays';
import {
  FulfillmentStatus,
  Order,
  PaymentStatus,
  SalesChannel,
} from '@/types';

function OrdersManagementContent() {
  const searchParams = useSearchParams();
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const products = useAppStore((s) => s.products);
  const settings = useAppStore((s) => s.settings);
  const createOrder = useAppStore((s) => s.createOrder);
  const updateOrderStatus = useAppStore((s) => s.updateOrderStatus);
  const cancelOrder = useAppStore((s) => s.cancelOrder);
  const refundOrder = useAppStore((s) => s.refundOrder);
  const bulkUpdateOrderStatus = useAppStore((s) => s.bulkUpdateOrderStatus);
  const addToast = useAppStore((s) => s.addToast);

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'All'>('All');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentStatus | 'All'>('All');
  const [channelFilter, setChannelFilter] = useState<SalesChannel | 'All'>('All');
  const [sortField, setSortField] = useState<'orderDate' | 'totalAmount' | 'orderNumber'>('orderDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(() => searchParams.get('action') === 'new');
  const [refundTargetOrder, setRefundTargetOrder] = useState<Order | null>(null);
  const [refundCustomAmount, setRefundCustomAmount] = useState<string>('');
  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);

  // Create Order controlled form state
  const [newCustomerId, setNewCustomerId] = useState<string>(customers[0]?.id || '');
  const [newChannel, setNewChannel] = useState<SalesChannel>('Direct Enterprise');
  const [newPaymentStatus, setNewPaymentStatus] = useState<PaymentStatus>('Paid');
  const [newFulfillmentStatus, setNewFulfillmentStatus] = useState<FulfillmentStatus>('Fulfilled');
  const [newDiscount, setNewDiscount] = useState<number>(0);
  const [newTaxRatePercent, setNewTaxRatePercent] = useState<number>(8.5);
  const [newNotes, setNewNotes] = useState<string>('');
  const [newItems, setNewItems] = useState<Array<{ productId: string; quantity: number }>>([
    { productId: products[0]?.id || '', quantity: 1 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (paymentFilter !== 'All' && o.paymentStatus !== paymentFilter) return false;
        if (fulfillmentFilter !== 'All' && o.fulfillmentStatus !== fulfillmentFilter) return false;
        if (channelFilter !== 'All' && o.salesChannel !== channelFilter) return false;
        if (q) {
          return (
            o.orderNumber.toLowerCase().includes(q) ||
            o.customerCompany.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q) ||
            o.customerEmail.toLowerCase().includes(q)
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
          diff = a.orderNumber.localeCompare(b.orderNumber);
        }
        return sortAsc ? diff : -diff;
      });
  }, [orders, searchQuery, paymentFilter, fulfillmentFilter, channelFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((page - 1) * pageSize, page * pageSize),
    [filteredOrders, page, pageSize]
  );

  // Live preview of Create Order calculation
  const draftCalculation = useMemo(() => {
    const pricedItems = newItems.map((it) => {
      const p = products.find((prod) => prod.id === it.productId);
      return {
        quantity: Math.max(1, Number(it.quantity) || 1),
        unitPrice: p ? p.unitPrice : 0,
      };
    });
    return calculateOrderTotalsFromItems(
      pricedItems,
      Number(newDiscount) || 0,
      (Number(newTaxRatePercent) || 0) / 100
    );
  }, [newItems, products, newDiscount, newTaxRatePercent]);

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newCustomerId) {
      setFormError('Please select a customer account.');
      return;
    }
    if (newItems.length === 0 || newItems.some((i) => !i.productId || i.quantity < 1)) {
      setFormError('Please configure valid products and quantities.');
      return;
    }

    const created = createOrder({
      customerId: newCustomerId,
      salesChannel: newChannel,
      paymentStatus: newPaymentStatus,
      fulfillmentStatus: newFulfillmentStatus,
      discountAmount: Number(newDiscount) || 0,
      taxRatePercent: Number(newTaxRatePercent) || 8.5,
      notes: newNotes,
      items: newItems,
    });

    if (created) {
      setCreateModalOpen(false);
      setNewDiscount(0);
      setNewNotes('');
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportOrdersCsv = (onlySelected = false) => {
    const source = onlySelected
      ? filteredOrders.filter((o) => selectedIds.includes(o.id))
      : filteredOrders;
    const headers = [
      'Order Number',
      'Order Date',
      'Customer Company',
      'Customer Contact',
      'Sales Channel',
      'Payment Status',
      'Fulfillment Status',
      'Subtotal',
      'Discount',
      'Tax',
      'Total Amount',
      'Refunded Amount',
    ];
    const rows = source.map((o) => [
      o.orderNumber,
      o.orderDate.slice(0, 10),
      o.customerCompany,
      o.customerName,
      o.salesChannel,
      o.paymentStatus,
      o.fulfillmentStatus,
      o.subtotal,
      o.discountAmount,
      o.taxAmount,
      o.totalAmount,
      o.refundedAmount,
    ]);
    triggerBrowserDownload(
      convertRowsToCsv(headers, rows),
      `aurelix-orders-${onlySelected ? 'selected' : 'ledger'}.csv`
    );
    addToast('Orders CSV exported', `Downloaded ${rows.length} order records.`, 'success');
  };

  // Keep drawerOrder synced with store changes
  const activeDrawerOrder = useMemo(() => {
    if (!drawerOrder) return null;
    return orders.find((o) => o.id === drawerOrder.id) || null;
  }, [drawerOrder, orders]);

  const summaryStats = useMemo(() => {
    const paid = orders.filter((o) => o.paymentStatus === 'Paid').length;
    const pending = orders.filter((o) => o.paymentStatus === 'Pending').length;
    const refunded = orders.filter((o) => o.paymentStatus === 'Refunded').length;
    const totalVal = orders
      .filter((o) => o.paymentStatus === 'Paid' || o.paymentStatus === 'Refunded')
      .reduce((acc, o) => acc + Math.max(0, o.totalAmount - o.refundedAmount), 0);
    return { paid, pending, refunded, totalVal };
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commercial Order Management"
        subtitle="Create multi-line orders, calculate tax & discount schedules, manage fulfillment status, and process simulated refunds."
        meta={`${orders.length.toLocaleString()} Total Orders`}
        actions={
          <>
            <button
              type="button"
              onClick={() => handleExportOrdersCsv(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-surface-raised border border-line text-ink-secondary hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Orders CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Order</span>
            </button>
          </>
        }
      />

      {/* Order Ledger KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIStatCard
          label="Cumulative Net Order Value"
          value={formatCurrency(summaryStats.totalVal, settings.currency, settings.numberFormat)}
          secondaryMeta="Settled less simulated refunds"
        />
        <KPIStatCard
          label="Settled (Paid) Orders"
          value={summaryStats.paid.toLocaleString()}
          secondaryMeta="Recognized in net revenue"
        />
        <KPIStatCard
          label="Pending Settlement"
          value={summaryStats.pending.toLocaleString()}
          secondaryMeta="Awaiting invoice clearance"
        />
        <KPIStatCard
          label="Simulated Refunded Orders"
          value={summaryStats.refunded.toLocaleString()}
          secondaryMeta="Credit memos applied"
        />
      </div>

      {/* Filters & Bulk Actions */}
      <div className="p-4 rounded-xl bg-surface-raised border border-line flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
              placeholder="Search order #, company, contact..."
              className="pl-8 pr-3 py-2 w-60 rounded-lg bg-surface-sunken border border-line text-xs text-ink focus:outline-none"
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
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
            <option value="Failed">Failed</option>
          </select>

          <select
            aria-label="Filter by fulfillment status"
            value={fulfillmentFilter}
            onChange={(e) => {
              setFulfillmentFilter(e.target.value as FulfillmentStatus | 'All');
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-ink-secondary"
          >
            <option value="All">All Fulfillment</option>
            <option value="Fulfilled">Fulfilled</option>
            <option value="Processing">Processing</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Canceled">Canceled</option>
          </select>

          <select
            aria-label="Filter by sales channel"
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value as SalesChannel | 'All');
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-ink-secondary"
          >
            <option value="All">All Channels</option>
            <option value="Direct Enterprise">Direct Enterprise</option>
            <option value="Self-Serve Web">Self-Serve Web</option>
            <option value="Partner Channel">Partner Channel</option>
            <option value="Marketplace">Marketplace</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums font-semibold text-accent">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => {
                bulkUpdateOrderStatus(selectedIds, 'Paid', 'Fulfilled');
                setSelectedIds([]);
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600/10 text-success hover:bg-emerald-600/20"
            >
              Mark Paid & Fulfilled
            </button>
            <button
              type="button"
              onClick={() => handleExportOrdersCsv(true)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-surface-hover text-ink-secondary"
            >
              Export Selected CSV
            </button>
          </div>
        )}
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          title="No orders match current filters"
          description="Clear your search or status filters, or create a new commercial order."
          actionLabel="Reset Order Filters"
          onAction={() => {
            setSearchQuery('');
            setPaymentFilter('All');
            setFulfillmentFilter('All');
            setChannelFilter('All');
          }}
        />
      ) : (
        <div className="rounded-xl bg-surface-raised border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm table-sticky-first">
              <thead>
                <tr className="border-b border-line bg-surface-sunken/60 text-xs font-semibold text-ink-muted">
                  <th className="py-3 px-4 w-9">
                    <input
                      type="checkbox"
                      aria-label="Select all orders on page"
                      checked={
                        paginatedOrders.length > 0 &&
                        paginatedOrders.every((o) => selectedIds.includes(o.id))
                      }
                      onChange={() => {
                        const pageIds = paginatedOrders.map((o) => o.id);
                        const allSelected = pageIds.every((id) => selectedIds.includes(id));
                        if (allSelected) {
                          setSelectedIds(selectedIds.filter((id) => !pageIds.includes(id)));
                        } else {
                          setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
                        }
                      }}
                      className="rounded border-line"
                    />
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('orderNumber')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Order #</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Customer Account</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('orderDate')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Order Date</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Fulfillment</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('totalAmount')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Order Total</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {paginatedOrders.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => setDrawerOrder(ord)}
                    className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select order ${ord.orderNumber}`}
                        checked={selectedIds.includes(ord.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(ord.id)
                              ? prev.filter((i) => i !== ord.id)
                              : [...prev, ord.id]
                          )
                        }
                        className="rounded border-line"
                      />
                    </td>
                    <td className="py-3 px-4 tabular-nums font-semibold text-accent whitespace-nowrap">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 px-4 max-w-[160px]">
                      <div className="font-semibold text-ink truncate" title={ord.customerCompany}>
                        {ord.customerCompany}
                      </div>
                      <div className="text-xs text-ink-muted truncate" title={ord.customerName}>
                        {ord.customerName}
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-ink-muted whitespace-nowrap">
                      {formatDateDisplay(ord.orderDate, settings.dateFormat)}
                    </td>
                    <td className="py-3 px-4 text-ink-secondary whitespace-nowrap">
                      {ord.salesChannel}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ord.paymentStatus} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ord.fulfillmentStatus} />
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-ink whitespace-nowrap">
                      {formatCurrency(ord.totalAmount, settings.currency, settings.numberFormat)}
                      {ord.refundedAmount > 0 && (
                        <div className="text-xs text-warning">
                          Refunded: {formatCurrency(ord.refundedAmount, settings.currency, settings.numberFormat)}
                        </div>
                      )}
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDrawerOrder(ord)}
                          title="Inspect order details"
                          className="p-2 rounded-lg text-ink-muted hover:text-blue-600 hover:bg-surface-hover"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {ord.paymentStatus === 'Paid' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRefundTargetOrder(ord);
                              setRefundCustomAmount(String(ord.totalAmount));
                            }}
                            title="Issue simulated refund"
                            className="p-2 rounded-lg text-ink-muted hover:text-amber-600 hover:bg-amber-500/10"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {ord.fulfillmentStatus !== 'Canceled' && (
                          <button
                            type="button"
                            onClick={() => setCancelTargetOrder(ord)}
                            title="Cancel order"
                            className="p-2 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-500/10"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Create Order Modal */}
      <ModalDialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Commercial Order"
        subtitle="Order totals are automatically calculated from line-item quantities, locked catalog prices, discounts, and applicable tax."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateOrderSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-danger">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Customer Account
              </label>
              <select
                value={newCustomerId}
                onChange={(e) => setNewCustomerId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              >
                {customers.slice(0, 80).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Sales Channel
              </label>
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value as SalesChannel)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              >
                <option value="Direct Enterprise">Direct Enterprise</option>
                <option value="Self-Serve Web">Self-Serve Web</option>
                <option value="Partner Channel">Partner Channel</option>
                <option value="Marketplace">Marketplace</option>
              </select>
            </div>
          </div>

          {/* Line Items Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-ink-secondary">
                Order Line Items
              </label>
              <button
                type="button"
                onClick={() =>
                  setNewItems([
                    ...newItems,
                    { productId: products[1]?.id || products[0]?.id || '', quantity: 1 },
                  ])
                }
                className="text-accent font-semibold hover:underline"
              >
                + Add Line Item
              </button>
            </div>

            <div className="space-y-2">
              {newItems.map((item, idx) => {
                const prod = products.find((p) => p.id === item.productId);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-surface-sunken border border-line"
                  >
                    <div className="col-span-7">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const updated = [...newItems];
                          updated[idx].productId = e.target.value;
                          setNewItems(updated);
                        }}
                        className="w-full px-2 py-2 rounded bg-surface-raised border border-line"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} · {p.name} (${p.unitPrice.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...newItems];
                          updated[idx].quantity = Math.max(1, Number(e.target.value) || 1);
                          setNewItems(updated);
                        }}
                        className="w-full px-2 py-2 rounded bg-surface-raised border border-line tabular-nums text-right"
                      />
                    </div>
                    <div className="col-span-2 text-right tabular-nums font-semibold">
                      {formatCurrency(
                        (prod?.unitPrice || 0) * item.quantity,
                        settings.currency,
                        settings.numberFormat
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      {newItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                          className="text-ink-muted hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Payment Status
              </label>
              <select
                value={newPaymentStatus}
                onChange={(e) => setNewPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Fulfillment
              </label>
              <select
                value={newFulfillmentStatus}
                onChange={(e) => setNewFulfillmentStatus(e.target.value as FulfillmentStatus)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              >
                <option value="Fulfilled">Fulfilled</option>
                <option value="Processing">Processing</option>
                <option value="Scheduled">Scheduled</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Discount ($)
              </label>
              <input
                type="number"
                min={0}
                value={newDiscount}
                onChange={(e) => setNewDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={30}
                value={newTaxRatePercent}
                onChange={(e) => setNewTaxRatePercent(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
            </div>
          </div>

          {/* Live Calculated Summary Box */}
          <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-2">
            <div className="flex justify-between text-ink-muted">
              <span>Line-Item Subtotal:</span>
              <span className="tabular-nums">
                {formatCurrency(draftCalculation.subtotal, settings.currency, settings.numberFormat)}
              </span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Discount Applied:</span>
              <span className="tabular-nums text-warning">
                −{formatCurrency(draftCalculation.discountAmount, settings.currency, settings.numberFormat)}
              </span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Calculated Tax ({newTaxRatePercent}%):</span>
              <span className="tabular-nums">
                +{formatCurrency(draftCalculation.taxAmount, settings.currency, settings.numberFormat)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-line-subtle text-sm font-bold text-ink">
              <span>Calculated Order Total:</span>
              <span className="tabular-nums text-accent">
                {formatCurrency(draftCalculation.totalAmount, settings.currency, settings.numberFormat)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-line text-ink-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-accent-strong hover:bg-accent-strong-hover text-white font-semibold"
            >
              Confirm & Record Order
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Simulated Refund Modal */}
      <ModalDialog
        open={Boolean(refundTargetOrder)}
        onClose={() => setRefundTargetOrder(null)}
        title={
          refundTargetOrder
            ? `Issue Simulated Refund · ${refundTargetOrder.orderNumber}`
            : 'Issue Simulated Refund'
        }
        subtitle="Simulated mode: This updates financial metrics and order status in LocalStorage without executing a real payment gateway transfer."
        maxWidth="max-w-md"
      >
        {refundTargetOrder && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amt = Number(refundCustomAmount) || refundTargetOrder.totalAmount;
              refundOrder(refundTargetOrder.id, amt);
              setRefundTargetOrder(null);
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-warning leading-relaxed">
              Issuing a simulated refund deducts the refunded amount from Net Realized Revenue and updates the Refund Rate across all executive dashboards.
            </div>
            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Refund Amount (Max: {formatCurrency(refundTargetOrder.totalAmount, settings.currency)})
              </label>
              <input
                type="number"
                step="0.01"
                min={1}
                max={refundTargetOrder.totalAmount}
                value={refundCustomAmount}
                onChange={(e) => setRefundCustomAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundTargetOrder(null)}
                className="px-4 py-2 rounded-lg border border-line"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                Record Simulated Refund
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* Cancel Order Confirmation */}
      <ConfirmDialog
        open={Boolean(cancelTargetOrder)}
        onClose={() => setCancelTargetOrder(null)}
        onConfirm={() => {
          if (cancelTargetOrder) {
            cancelOrder(cancelTargetOrder.id);
          }
        }}
        title={`Cancel Order ${cancelTargetOrder?.orderNumber}?`}
        description="Canceling this order marks fulfillment as Canceled and excludes the invoice from realized revenue."
        confirmLabel="Cancel Order"
      />

      {/* Order Details & Status Edit Drawer */}
      <DetailDrawer
        open={Boolean(activeDrawerOrder)}
        onClose={() => setDrawerOrder(null)}
        title={activeDrawerOrder ? `Order ${activeDrawerOrder.orderNumber}` : 'Order Details'}
        subtitle={
          activeDrawerOrder
            ? `${activeDrawerOrder.customerCompany} · ${formatDateDisplay(activeDrawerOrder.orderDate, settings.dateFormat)}`
            : undefined
        }
      >
        {activeDrawerOrder && (
          <div className="space-y-6 text-xs">
            {/* Status Edit Controls */}
            <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-3">
              <div className="font-bold text-ink">
                Update Order Settlement & Fulfillment
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Payment Status</label>
                  <select
                    value={activeDrawerOrder.paymentStatus}
                    onChange={(e) =>
                      updateOrderStatus(
                        activeDrawerOrder.id,
                        e.target.value as PaymentStatus,
                        activeDrawerOrder.fulfillmentStatus
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-line"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Refunded">Refunded</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Fulfillment Status</label>
                  <select
                    value={activeDrawerOrder.fulfillmentStatus}
                    onChange={(e) =>
                      updateOrderStatus(
                        activeDrawerOrder.id,
                        activeDrawerOrder.paymentStatus,
                        e.target.value as FulfillmentStatus
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-line"
                  >
                    <option value="Fulfilled">Fulfilled</option>
                    <option value="Processing">Processing</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Canceled">Canceled</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {activeDrawerOrder.paymentStatus === 'Paid' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRefundTargetOrder(activeDrawerOrder);
                      setRefundCustomAmount(String(activeDrawerOrder.totalAmount));
                    }}
                    className="px-3 py-2 rounded-lg bg-amber-500/10 text-warning font-medium hover:bg-amber-500/20"
                  >
                    Issue Simulated Refund
                  </button>
                )}
                {activeDrawerOrder.fulfillmentStatus !== 'Canceled' && (
                  <button
                    type="button"
                    onClick={() => setCancelTargetOrder(activeDrawerOrder)}
                    className="px-3 py-2 rounded-lg bg-red-500/10 text-danger font-medium hover:bg-red-500/20"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <h3 className="font-bold text-ink">
                Line Items ({activeDrawerOrder.lineItems.length})
              </h3>
              <div className="rounded-xl border border-line overflow-hidden">
                <table className="w-full text-left border-collapse table-sticky-first">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken text-xs text-ink-muted">
                      <th className="py-2 px-3">Product / SKU</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Locked Price</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {activeDrawerOrder.lineItems.map((li) => (
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

            {/* Financial Summary */}
            <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-muted">Subtotal:</span>
                <span className="tabular-nums">
                  {formatCurrency(activeDrawerOrder.subtotal, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Discount:</span>
                <span className="tabular-nums text-warning">
                  −{formatCurrency(activeDrawerOrder.discountAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">
                  Tax ({(activeDrawerOrder.taxRate * 100).toFixed(1)}%):
                </span>
                <span className="tabular-nums">
                  +{formatCurrency(activeDrawerOrder.taxAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-line-subtle font-bold text-sm">
                <span>Order Total:</span>
                <span className="tabular-nums">
                  {formatCurrency(activeDrawerOrder.totalAmount, settings.currency, settings.numberFormat)}
                </span>
              </div>
              {activeDrawerOrder.refundedAmount > 0 && (
                <div className="flex justify-between text-warning font-semibold">
                  <span>Simulated Refund Issued:</span>
                  <span className="tabular-nums">
                    −{formatCurrency(activeDrawerOrder.refundedAmount, settings.currency, settings.numberFormat)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-ink-muted">Loading order ledger...</div>}>
      <OrdersManagementContent />
    </Suspense>
  );
}
