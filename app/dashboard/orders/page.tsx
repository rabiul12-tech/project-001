'use client';

import React, { startTransition, Suspense, useMemo, useOptimistic, useRef, useState } from 'react';
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
import { useWorkspaceAction } from '@/hooks/useWorkspaceAction';
import { calculateOrderTotalsFromItems, fromCents, isRealizedOrder, realizedNetCents } from '@/lib/calculations/analytics';
import { canRefundOrder, getOrderTransitionError } from '@/lib/orders';
import { canPerformAction, getPermissionDeniedMessage } from '@/lib/permissions';
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
  const orderableProducts = useMemo(() => products.filter((product) => product.status !== 'Archived'), [products]);
  const settings = useAppStore((s) => s.settings);
  const createOrder = useWorkspaceAction((s) => s.createOrder);
  const updateOrderStatus = useWorkspaceAction((s) => s.updateOrderStatus);
  const cancelOrder = useWorkspaceAction((s) => s.cancelOrder);
  const refundOrder = useWorkspaceAction((s) => s.refundOrder);
  const bulkUpdateOrderStatus = useWorkspaceAction((s) => s.bulkUpdateOrderStatus);
  const addToast = useAppStore((s) => s.addToast);

  const [searchQuery, setSearchQuery] = useOptimistic(searchParams.get('search') ?? '');
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
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [refundTargetOrder, setRefundTargetOrder] = useState<Order | null>(null);
  const [refundCustomAmount, setRefundCustomAmount] = useState<string>('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);

  const canMutateOrders = canPerformAction(settings.activeRolePreview, 'mutate_orders');
  const canIssueRefund = canPerformAction(settings.activeRolePreview, 'issue_refund');

  // Create Order controlled form state
  const [newCustomerId, setNewCustomerId] = useState<string>(customers[0]?.id || '');
  const [newChannel, setNewChannel] = useState<SalesChannel>('Direct Enterprise');
  const [newPaymentStatus, setNewPaymentStatus] = useState<PaymentStatus>('Paid');
  const [newFulfillmentStatus, setNewFulfillmentStatus] = useState<FulfillmentStatus>('Fulfilled');
  const [newDiscount, setNewDiscount] = useState<number>(0);
  const [newTaxRatePercent, setNewTaxRatePercent] = useState<number>(8.5);
  const [newNotes, setNewNotes] = useState<string>('');
  const nextLineItemId = useRef(1);
  const [newItems, setNewItems] = useState<Array<{ id: number; productId: string; quantity: number }>>([
    { id: 0, productId: orderableProducts[0]?.id ?? '', quantity: 1 },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const resolvedCustomerId = useMemo(
    () => (customers.some((c) => c.id === newCustomerId) ? newCustomerId : customers[0]?.id || ''),
    [customers, newCustomerId]
  );

  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.company.localeCompare(b.company)),
    [customers]
  );

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
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredOrders, safePage, pageSize]
  );

  // Live preview of Create Order calculation
  const draftCalculation = useMemo(() => {
    const pricedItems = newItems.map((it) => {
      const p = orderableProducts.find((prod) => prod.id === it.productId);
      return {
        quantity: Math.max(1, Number(it.quantity) || 1),
        unitPrice: p ? p.unitPrice : 0,
      };
    });
    return calculateOrderTotalsFromItems(
      pricedItems,
      Number(newDiscount) || 0,
      (Number.isFinite(Number(newTaxRatePercent)) ? Math.max(0, Number(newTaxRatePercent)) : 0) / 100
    );
  }, [newItems, orderableProducts, newDiscount, newTaxRatePercent]);

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingOrder) return;
    setFormError(null);
    if (!canMutateOrders) {
      setFormError(getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_orders'));
      return;
    }
    if (!resolvedCustomerId) {
      setFormError('Please select a customer account.');
      return;
    }
    if (newItems.length === 0 || newItems.some((i) =>
      i.quantity < 1 || !orderableProducts.some((product) => product.id === i.productId)
    )) {
      setFormError('Select an available product and enter a valid quantity for each line.');
      return;
    }

    const sanitizedTaxRate = Number.isFinite(Number(newTaxRatePercent))
      ? Math.max(0, Math.min(30, Number(newTaxRatePercent)))
      : 0;

    setCreatingOrder(true);
    try {
      const created = await createOrder({
        customerId: resolvedCustomerId,
        salesChannel: newChannel,
        paymentStatus: newPaymentStatus,
        fulfillmentStatus: newFulfillmentStatus,
        discountAmount: Math.max(0, Number(newDiscount) || 0),
        taxRatePercent: sanitizedTaxRate,
        notes: newNotes,
        items: newItems.map(({ productId, quantity }) => ({ productId, quantity })),
      });

      if (created) {
        setCreateModalOpen(false);
        setNewDiscount(0);
        setNewNotes('');
      } else {
        setFormError('Order was not saved. Check product availability and workspace storage, then try again.');
      }
    } finally {
      setCreatingOrder(false);
    }
  };

  const updateSearchQuery = (query: string) => {
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('search', query);
    } else {
      url.searchParams.delete('search');
    }

    // Keep the field responsive while Next.js applies the history update.
    startTransition(() => {
      setSearchQuery(query);
      window.history.replaceState(null, '', url);
    });
    setPage(1);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    setPage(1);
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
    const paid = orders.filter((o) => o.paymentStatus === 'Paid' && isRealizedOrder(o)).length;
    const pending = orders.filter((o) => o.paymentStatus === 'Pending' && o.fulfillmentStatus !== 'Canceled').length;
    const refunded = orders.filter((o) => o.paymentStatus === 'Refunded' && isRealizedOrder(o)).length;
    const totalValCents = orders.reduce((acc, order) => acc + realizedNetCents(order), 0);
    return { paid, pending, refunded, totalVal: fromCents(totalValCents) };
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commercial Order Management"
        subtitle="Manage orders and simulated refunds across the full ledger. The shared reporting dates apply to Overview, Analytics, and Revenue."
        meta={`${orders.length.toLocaleString()} All-Time Orders`}
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
              disabled={!canMutateOrders}
              title={!canMutateOrders ? getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_orders') : undefined}
              onClick={() => {
                if (!canMutateOrders) {
                  addToast('Permission restricted', getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_orders'), 'warning');
                  return;
                }
                setFormError(null);
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
              id="order-search"
              name="search"
              aria-label="Search orders"
              value={searchQuery}
              onChange={(e) => updateSearchQuery(e.target.value)}
              placeholder="Search order #, company, contact..."
              className="pl-8 pr-3 py-2 w-60 rounded-lg bg-surface-sunken border border-line text-xs text-ink focus:outline-none"
            />
          </div>

          <select
            id="order-payment-filter"
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
            id="order-fulfillment-filter"
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
            id="order-channel-filter"
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
              disabled={!canMutateOrders}
              title={!canMutateOrders ? getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_orders') : undefined}
              onClick={async () => {
                if (await bulkUpdateOrderStatus(selectedIds, 'Paid', 'Fulfilled')) setSelectedIds([]);
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600/10 text-success hover:bg-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
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
            updateSearchQuery('');
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
                <tr className="border-b border-line bg-surface-sunken/60 text-caption font-semibold text-ink-muted">
                  <th scope="col" className="py-3 px-4 w-9">
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
                  <th scope="col" aria-sort={sortField === 'orderNumber' ? (sortAsc ? 'ascending' : 'descending') : undefined} className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('orderNumber')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Order #</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4">Customer Account</th>
                  <th scope="col" aria-sort={sortField === 'orderDate' ? (sortAsc ? 'ascending' : 'descending') : undefined} className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('orderDate')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Order Date</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4">Channel</th>
                  <th scope="col" className="py-3 px-4">Payment</th>
                  <th scope="col" className="py-3 px-4">Fulfillment</th>
                  <th scope="col" aria-sort={sortField === 'totalAmount' ? (sortAsc ? 'ascending' : 'descending') : undefined} className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('totalAmount')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Order Total</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">Actions</th>
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
                        {canRefundOrder(ord) && (
                          <button
                            type="button"
                            disabled={!canIssueRefund}
                            onClick={() => {
                              setRefundTargetOrder(ord);
                              setRefundCustomAmount(String(ord.totalAmount));
                              setRefundError(null);
                            }}
                            title={!canIssueRefund ? getPermissionDeniedMessage(settings.activeRolePreview, 'issue_refund') : 'Issue simulated refund'}
                            className="p-2 rounded-lg text-ink-muted hover:text-amber-600 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {ord.fulfillmentStatus !== 'Canceled' && (
                          <button
                            type="button"
                            disabled={!canMutateOrders}
                            onClick={() => setCancelTargetOrder(ord)}
                            title={!canMutateOrders ? getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_orders') : 'Cancel order'}
                            className="p-2 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
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
            currentPage={safePage}
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
              <label htmlFor="new-order-customer" className="block font-medium text-ink-secondary mb-1">
                Customer Account
              </label>
              <select
                id="new-order-customer"
                name="customerId"
                value={resolvedCustomerId}
                onChange={(e) => setNewCustomerId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              >
                {sortedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-order-channel" className="block font-medium text-ink-secondary mb-1">
                Sales Channel
              </label>
              <select
                id="new-order-channel"
                name="salesChannel"
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
          <div className="space-y-2" role="group" aria-labelledby="new-order-line-items">
            <div className="flex items-center justify-between">
              <span id="new-order-line-items" className="font-semibold text-ink-secondary">
                Order Line Items
              </span>
              <button
                type="button"
                disabled={!orderableProducts.length}
                onClick={() => {
                  const id = nextLineItemId.current++;
                  setNewItems((items) => [
                    ...items,
                    { id, productId: orderableProducts[1]?.id ?? orderableProducts[0]?.id ?? '', quantity: 1 },
                  ]);
                }}
                className="text-accent font-semibold hover:underline"
              >
                + Add Line Item
              </button>
            </div>
            {!orderableProducts.length && (
              <p role="status" className="text-ink-muted">The catalog has no products available for new orders.</p>
            )}

            <div className="space-y-2">
              {newItems.map((item, idx) => {
                const prod = orderableProducts.find((p) => p.id === item.productId);
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-surface-sunken border border-line"
                  >
                    <div className="col-span-7">
                      <select
                        id={`new-order-item-${item.id}-product`}
                        name={`items[${idx}].productId`}
                        aria-label={`Product for line item ${idx + 1}`}
                        value={prod?.id ?? ''}
                        required
                        onChange={(e) => {
                          const updated = [...newItems];
                          updated[idx].productId = e.target.value;
                          setNewItems(updated);
                        }}
                        className="w-full px-2 py-2 rounded bg-surface-raised border border-line"
                      >
                        <option value="" disabled>Select an available product</option>
                        {orderableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} · {p.name} (${p.unitPrice.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        id={`new-order-item-${item.id}-quantity`}
                        name={`items[${idx}].quantity`}
                        aria-label={`Quantity for line item ${idx + 1}`}
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
                          aria-label={`Remove line item ${idx + 1}`}
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
              <label htmlFor="new-order-payment" className="block font-medium text-ink-secondary mb-1">
                Payment Status
              </label>
              <select
                id="new-order-payment"
                name="paymentStatus"
                value={newPaymentStatus}
                onChange={(e) => setNewPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div>
              <label htmlFor="new-order-fulfillment" className="block font-medium text-ink-secondary mb-1">
                Fulfillment
              </label>
              <select
                id="new-order-fulfillment"
                name="fulfillmentStatus"
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
              <label htmlFor="new-order-discount" className="block font-medium text-ink-secondary mb-1">
                Discount ($)
              </label>
              <input
                type="number"
                id="new-order-discount"
                name="discountAmount"
                step="0.01"
                min={0}
                value={newDiscount}
                onChange={(e) => setNewDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="new-order-tax" className="block font-medium text-ink-secondary mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                id="new-order-tax"
                name="taxRatePercent"
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
              disabled={creatingOrder || !orderableProducts.length}
              className="px-4 py-2 rounded-lg bg-accent-strong hover:bg-accent-strong-hover text-white font-semibold"
            >
              {creatingOrder ? 'Recording…' : 'Confirm & Record Order'}
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
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canIssueRefund) {
                setRefundError(getPermissionDeniedMessage(settings.activeRolePreview, 'issue_refund'));
                return;
              }
              const parsed = Number(refundCustomAmount);
              if (!Number.isFinite(parsed) || parsed <= 0 || parsed > refundTargetOrder.totalAmount) {
                setRefundError(
                  `Enter a valid refund amount between 0.01 and ${formatCurrency(refundTargetOrder.totalAmount, settings.currency, settings.numberFormat)}.`
                );
                return;
              }
              if (await refundOrder(refundTargetOrder.id, parsed)) {
                setRefundError(null);
                setRefundTargetOrder(null);
              } else {
                setRefundError('The refund could not be recorded. Check the order status and storage, then try again.');
              }
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-warning leading-relaxed">
              Issuing a simulated refund deducts the refunded amount from Net Realized Revenue and updates the Refund Rate across all executive dashboards.
            </div>
            {refundError && (
              <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-danger">
                {refundError}
              </div>
            )}
            <div>
              <label htmlFor="order-refund-amount" className="block font-medium text-ink-secondary mb-1">
                Refund Amount (Max: {formatCurrency(refundTargetOrder.totalAmount, settings.currency, settings.numberFormat)})
              </label>
              <input
                type="number"
                id="order-refund-amount"
                name="refundAmount"
                step="0.01"
                min={0.01}
                max={refundTargetOrder.totalAmount}
                value={refundCustomAmount}
                onChange={(e) => {
                  setRefundCustomAmount(e.target.value);
                  setRefundError(null);
                }}
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
        onConfirm={() => cancelTargetOrder ? cancelOrder(cancelTargetOrder.id) : false}
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
                  <label htmlFor="order-detail-payment" className="block text-xs text-ink-muted mb-1">Payment Status</label>
                  <select
                    id="order-detail-payment"
                    name="paymentStatus"
                    value={activeDrawerOrder.paymentStatus}
                    disabled={!canMutateOrders || activeDrawerOrder.fulfillmentStatus === 'Canceled'}
                    onChange={(e) =>
                      updateOrderStatus(
                        activeDrawerOrder.id,
                        e.target.value as PaymentStatus,
                        activeDrawerOrder.fulfillmentStatus
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-line disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(['Paid', 'Pending', 'Refunded', 'Failed'] as const).map((status) => (
                      <option key={status} value={status} disabled={Boolean(
                        getOrderTransitionError(activeDrawerOrder, status, activeDrawerOrder.fulfillmentStatus)
                      )}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="order-detail-fulfillment" className="block text-xs text-ink-muted mb-1">Fulfillment Status</label>
                  <select
                    id="order-detail-fulfillment"
                    name="fulfillmentStatus"
                    value={activeDrawerOrder.fulfillmentStatus}
                    disabled={!canMutateOrders || activeDrawerOrder.fulfillmentStatus === 'Canceled'}
                    onChange={(e) => {
                      const status = e.target.value as FulfillmentStatus;
                      if (status === 'Canceled') setCancelTargetOrder(activeDrawerOrder);
                      else updateOrderStatus(activeDrawerOrder.id, activeDrawerOrder.paymentStatus, status);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-line disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(['Fulfilled', 'Processing', 'Scheduled', 'Canceled'] as const).map((status) => (
                      <option key={status} value={status} disabled={Boolean(
                        getOrderTransitionError(activeDrawerOrder, activeDrawerOrder.paymentStatus, status)
                      )}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {canRefundOrder(activeDrawerOrder) && (
                  <button
                    type="button"
                    disabled={!canIssueRefund}
                    title={!canIssueRefund ? getPermissionDeniedMessage(settings.activeRolePreview, 'issue_refund') : undefined}
                    onClick={() => {
                      setRefundTargetOrder(activeDrawerOrder);
                      setRefundCustomAmount(String(activeDrawerOrder.totalAmount));
                      setRefundError(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-amber-500/10 text-warning font-medium hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Issue Simulated Refund
                  </button>
                )}
                {activeDrawerOrder.fulfillmentStatus !== 'Canceled' && (
                  <button
                    type="button"
                    disabled={!canMutateOrders}
                    title={!canMutateOrders ? getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_orders') : undefined}
                    onClick={() => setCancelTargetOrder(activeDrawerOrder)}
                    className="px-3 py-2 rounded-lg bg-red-500/10 text-danger font-medium hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2.5">
              <h3 className="text-subheading text-ink">
                Line Items ({activeDrawerOrder.lineItems.length})
              </h3>
              <div className="rounded-xl border border-line overflow-hidden">
                <table className="w-full text-left border-collapse text-sm table-sticky-first">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken text-caption font-medium text-ink-muted">
                      <th scope="col" className="py-2 px-3">Product / SKU</th>
                      <th scope="col" className="py-2 px-3 text-right">Qty</th>
                      <th scope="col" className="py-2 px-3 text-right">Locked Price</th>
                      <th scope="col" className="py-2 px-3 text-right">Subtotal</th>
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
