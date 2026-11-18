import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDeterministicSeedData } from '@/lib/demo-data/seed';
import {
  buildRevenueTimeSeries,
  calculateFinancialSummary,
  calculateProductPerformance,
  calculateSalesByChannel,
  enrichCustomersWithMetrics,
  resolveDateWindow,
} from '@/lib/calculations/analytics';
import { DAY_MS } from '@/lib/clock';
import { loadFromLocalStorage, saveToLocalStorage, STORAGE_KEYS } from '@/lib/storage/repository';
import { useAppStore } from '@/stores/useAppStore';
import type { FulfillmentStatus, Order, PaymentStatus } from '@/types';

const getState = useAppStore.getState;

function createOrder(paymentStatus: PaymentStatus = 'Paid', fulfillmentStatus: FulfillmentStatus = 'Processing') {
  const state = getState();
  const order = state.createOrder({
    customerId: state.customers[0].id,
    items: [{ productId: state.products[0].id, quantity: 2 }],
    salesChannel: 'Direct Enterprise',
    paymentStatus,
    fulfillmentStatus,
    discountAmount: 0.25,
    taxRatePercent: 8.5,
  });
  if (!order) throw new Error('Expected an order');
  return order;
}

function currentOrder(id: string) {
  return getState().orders.find((order) => order.id === id);
}

describe('financial history and order transitions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-10-12T12:00:00Z'));
    getState().hydrateStore();
    const seed = generateDeterministicSeedData();
    expect(getState().importBackupJson(JSON.stringify({ ...seed, orders: [] })).ok).toBe(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps a partial refund through fulfillment and cancellation and rejects a second refund', () => {
    const order = createOrder();
    getState().refundOrder(order.id, 100.25);
    expect(currentOrder(order.id)).toMatchObject({ paymentStatus: 'Refunded', refundedAmount: 100.25 });

    const afterRefund = localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
    getState().refundOrder(order.id, 50);
    getState().updateOrderStatus(order.id, 'Paid', 'Processing');
    expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)).toBe(afterRefund);
    expect(currentOrder(order.id)).toMatchObject({ paymentStatus: 'Refunded', refundedAmount: 100.25 });

    getState().updateOrderStatus(order.id, 'Refunded', 'Fulfilled');
    getState().cancelOrder(order.id);
    expect(currentOrder(order.id)).toMatchObject({
      fulfillmentStatus: 'Canceled',
      paymentStatus: 'Refunded',
      refundedAmount: 100.25,
    });
    expect(getState().activities.filter((entry) => entry.action === 'Simulated Refund Issued')).toHaveLength(1);
  });

  it('validates refund amounts in cents and reconciles a full refund to zero', () => {
    const order = createOrder();
    for (const amount of [0, -1, NaN, Infinity, 0.001, order.totalAmount + 0.01]) {
      getState().refundOrder(order.id, amount);
      expect(currentOrder(order.id)?.refundedAmount).toBe(0);
    }
    getState().refundOrder(order.id);
    expect(currentOrder(order.id)?.refundedAmount).toBe(order.totalAmount);
    const summary = calculateFinancialSummary(getState().orders, [], 0, Date.now());
    expect(summary).toMatchObject({ grossRevenue: order.subtotal, totalRefunds: order.totalAmount, netRevenue: 0 });
  });

  it('rejects refunds without settlement and rejects invalid bulk transitions atomically', () => {
    const pending = createOrder('Pending');
    vi.advanceTimersByTime(1);
    const fulfilled = createOrder('Paid', 'Fulfilled');
    const original = localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
    getState().refundOrder(pending.id, 100);
    getState().bulkUpdateOrderStatus([pending.id, fulfilled.id], 'Pending', 'Scheduled');
    expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)).toBe(original);
    expect(currentOrder(fulfilled.id)?.fulfillmentStatus).toBe('Fulfilled');
    getState().cancelOrder(pending.id);
    getState().updateOrderStatus(pending.id, 'Paid', 'Fulfilled');
    expect(currentOrder(pending.id)).toMatchObject({ paymentStatus: 'Failed', fulfillmentStatus: 'Canceled' });
  });

  it('excludes canceled settled orders across KPIs, series, channel, customer and product totals', () => {
    const original = createOrder();
    const canceled = { ...original, fulfillmentStatus: 'Canceled' as const };
    const { products, customers } = getState();
    const window = resolveDateWindow('30d', undefined, undefined, new Date().toISOString());
    expect(calculateFinancialSummary([canceled], [], window.startMs, window.endMs)).toMatchObject({
      grossRevenue: 0, netRevenue: 0, totalRefunds: 0, totalTax: 0, totalDiscounts: 0,
    });
    expect(buildRevenueTimeSeries([canceled], customers, window).every((point) => point.netRevenue === 0)).toBe(true);
    expect(calculateSalesByChannel([canceled]).every((channel) => channel.netRevenue === 0)).toBe(true);
    expect(calculateProductPerformance(products, [canceled]).every((product) => product.grossRevenue === 0)).toBe(true);
    expect(enrichCustomersWithMetrics(customers, [canceled]).every((customer) => customer.lifetimeSpend === 0)).toBe(true);
  });

  it('releases recorded stock once for an unfulfilled cancellation and retains fulfilled debits', () => {
    const stock = () => getState().products[0].stockLevel;
    const initial = stock();
    const scheduled = createOrder('Paid', 'Scheduled');
    expect(stock()).toBe(initial - 2);
    getState().cancelOrder(scheduled.id);
    getState().cancelOrder(scheduled.id);
    expect(stock()).toBe(initial);

    vi.advanceTimersByTime(1);
    const fulfilled = createOrder('Paid', 'Fulfilled');
    getState().cancelOrder(fulfilled.id);
    expect(stock()).toBe(initial - 2);

    vi.advanceTimersByTime(1);
    const pending = createOrder('Pending', 'Processing');
    expect(stock()).toBe(initial - 4);
    getState().updateOrderStatus(pending.id, 'Failed', 'Processing');
    expect(stock()).toBe(initial - 2);
  });

  it.each(['order total', 'line subtotal', 'discount', 'tax', 'refund'] as const)(
    'rejects an invalid %s before either storage or the active store changes',
    (field) => {
      const created = createOrder();
      const backup = getState().getExportSnapshot();
      const record = structuredClone(created);
      const corrupt: Record<typeof field, (order: Order) => void> = {
        'order total': (order) => { order.totalAmount = 1; },
        'line subtotal': (order) => { order.lineItems[0].subtotal += 10; },
        discount: (order) => { order.discountAmount = order.subtotal + 1; },
        tax: (order) => { order.taxAmount += 10; },
        refund: (order) => { order.refundedAmount = 10; },
      };
      corrupt[field](record);
      const raw = localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
      const result = getState().importBackupJson(JSON.stringify({ ...backup, orders: [record] }));
      expect(result.ok).toBe(false);
      expect(result.error).toContain(created.orderNumber);
      expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)).toBe(raw);
      expect(currentOrder(created.id)).toEqual(created);
    }
  );

  it('keeps persisted seeded and runtime timestamps across two consecutive UTC-day reloads', () => {
    const seededAt = Date.now();
    const seed = generateDeterministicSeedData(seededAt);
    const runtimeTs = new Date(seededAt + 7_200_000).toISOString();
    const runtimeOrder = { ...seed.orders[0], id: 'runtime-order', orderDate: runtimeTs };
    const data = { ...seed, orders: [runtimeOrder, ...seed.orders] };
    expect(saveToLocalStorage(data).ok).toBe(true);
    for (const days of [1, 2]) {
      vi.setSystemTime(new Date(seededAt + days * DAY_MS));
      const loaded = loadFromLocalStorage();
      expect([loaded.data.seededAt, loaded.data.orders[0].orderDate, loaded.data.orders[1].orderDate]).toEqual(
        [seed.seededAt, runtimeTs, seed.orders[0].orderDate]
      );
    }
  });
});
