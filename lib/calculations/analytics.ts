import {
  Customer,
  DailySessionMetric,
  DateRangePreset,
  Order,
  Product,
  ProductCategory,
  SalesChannel,
} from '@/types';
import { nowIso } from '@/lib/clock';

/**
 * CENTRALIZED ANALYTICS & FINANCIAL CALCULATION ENGINE
 *
 * Documented Formula Rules:
 * Realized metrics include Paid and Refunded orders with non-canceled fulfillment.
 * See README.md for the eligibility, refund and reporting rules.
 */

export interface DateWindow {
  startMs: number;
  endMs: number;
  prevStartMs: number;
  prevEndMs: number;
  days: number;
}

const ONE_DAY_MS = 86_400_000;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

export function isRealizedOrder(order: Pick<Order, 'paymentStatus' | 'fulfillmentStatus'>): boolean {
  return order.fulfillmentStatus !== 'Canceled' &&
    (order.paymentStatus === 'Paid' || order.paymentStatus === 'Refunded');
}

function invoiceRefundCents(order: Order): number {
  return Math.min(toCents(order.totalAmount), Math.max(0, toCents(order.refundedAmount)));
}

export function realizedNetCents(order: Order): number {
  return isRealizedOrder(order) ? toCents(order.totalAmount) - invoiceRefundCents(order) : 0;
}

function parseWindowStartMs(value: string): number {
  const trimmed = value.trim();
  if (DATE_ONLY_REGEX.test(trimmed)) {
    return Date.parse(`${trimmed}T00:00:00.000Z`);
  }
  return Date.parse(trimmed);
}

function parseWindowEndMs(value: string): number {
  const trimmed = value.trim();
  if (DATE_ONLY_REGEX.test(trimmed)) {
    return Date.parse(`${trimmed}T23:59:59.999Z`);
  }
  return Date.parse(trimmed);
}

export function resolveDateWindow(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  referenceIso: string = nowIso(),
  earliestRecordIso?: string
): DateWindow {
  const parsedRef = Date.parse(referenceIso);
  const refMs = Number.isFinite(parsedRef) ? parsedRef : Date.now();

  if (preset === 'custom') {
    const parsedEnd = customEnd ? parseWindowEndMs(customEnd) : NaN;
    const endMs = Number.isFinite(parsedEnd) ? parsedEnd : refMs;
    const parsedStart = customStart ? parseWindowStartMs(customStart) : NaN;
    const rawStartMs = Number.isFinite(parsedStart) ? parsedStart : endMs - 30 * ONE_DAY_MS;
    const startMs = Math.min(rawStartMs, endMs);
    const spanMs = Math.max(0, endMs - startMs);
    const days = Math.max(1, Math.round(spanMs / ONE_DAY_MS));
    const prevEndMs = startMs - 1;
    const prevStartMs = prevEndMs - Math.max(ONE_DAY_MS - 1, spanMs);
    return { startMs, endMs, prevStartMs, prevEndMs, days };
  }

  // Presets always end at the active clock reference timestamp.
  const endMs = refMs;
  let days = 30;
  if (preset === '7d') days = 7;
  else if (preset === '30d') days = 30;
  else if (preset === '90d') days = 90;
  else if (preset === '6m') days = 180;
  else if (preset === '12m') days = 365;
  else if (preset === 'all') days = 365;

  let startMs = endMs - days * ONE_DAY_MS;
  if (preset === 'all' && earliestRecordIso) {
    const earliestMs = Date.parse(earliestRecordIso);
    if (Number.isFinite(earliestMs) && earliestMs < startMs) {
      startMs = earliestMs;
      days = Math.max(365, Math.ceil((endMs - startMs) / ONE_DAY_MS));
    }
  }

  const durationMs = Math.max(ONE_DAY_MS, endMs - startMs);
  const prevEndMs = startMs - 1;
  const prevStartMs = prevEndMs - durationMs;

  return { startMs, endMs, prevStartMs, prevEndMs, days };
}

export function filterOrdersByWindow(orders: Order[], startMs: number, endMs: number): Order[] {
  return orders
    .filter((o) => {
      const t = Date.parse(o.orderDate);
      return Number.isFinite(t) && t >= startMs && t <= endMs;
    })
    .sort((a, b) => Date.parse(b.orderDate) - Date.parse(a.orderDate) || b.id.localeCompare(a.id));
}

type PercentChange = number | null;

export function calculatePercentChange(current: number, previous: number): PercentChange {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export interface FinancialSummary {
  grossRevenue: number;
  netRevenue: number;
  totalDiscounts: number;
  totalTax: number;
  totalRefunds: number;
  pendingRevenue: number;
  failedOrderVolume: number;
  totalOrdersCount: number;
  completedOrdersCount: number;
  paidOrdersCount: number;
  refundedOrdersCount: number;
  averageOrderValue: number;
  refundRatePercent: number;
  activeCustomersCount: number;
  conversionRatePercent: number;
  totalSessions: number;
  totalUniqueVisitors: number;
}

export function calculateFinancialSummary(
  orders: Order[],
  sessions: DailySessionMetric[],
  startMs: number,
  endMs: number
): FinancialSummary {
  const periodOrders = filterOrdersByWindow(orders, startMs, endMs);

  let grossCents = 0;
  let netCents = 0;
  let discountCents = 0;
  let taxCents = 0;
  let refundCents = 0;
  let pendingCents = 0;
  let failedCents = 0;
  let paidOrdersCount = 0;
  let refundedOrdersCount = 0;
  let completedOrdersCount = 0;

  const activeCustomerIds = new Set<string>();

  for (const order of periodOrders) {
    const orderTotalCents = toCents(order.totalAmount);
    if (isRealizedOrder(order)) {
      const orderRefundCents = invoiceRefundCents(order);
      grossCents += toCents(order.subtotal);
      discountCents += toCents(order.discountAmount);
      taxCents += toCents(order.taxAmount);
      refundCents += orderRefundCents;
      netCents += Math.max(0, orderTotalCents - orderRefundCents);
      activeCustomerIds.add(order.customerId);
      if (order.fulfillmentStatus === 'Fulfilled') completedOrdersCount++;

      if (order.paymentStatus === 'Paid') {
        paidOrdersCount++;
      } else {
        refundedOrdersCount++;
      }
    } else if (order.paymentStatus === 'Pending' && order.fulfillmentStatus !== 'Canceled') {
      pendingCents += orderTotalCents;
      activeCustomerIds.add(order.customerId);
    } else if (order.paymentStatus === 'Failed' || order.fulfillmentStatus === 'Canceled') {
      failedCents += orderTotalCents;
    }
  }

  const eligibleOrderCount = paidOrdersCount + refundedOrdersCount;
  const averageOrderValue =
    eligibleOrderCount > 0 ? fromCents(Math.round(netCents / eligibleOrderCount)) : 0;
  const refundRatePercent =
    grossCents > 0 ? Math.round((refundCents / grossCents) * 1000) / 10 : 0;

  // Sessions within window
  const startIsoDay = new Date(startMs).toISOString().slice(0, 10);
  const endIsoDay = new Date(endMs).toISOString().slice(0, 10);
  const periodSessions = sessions.filter(
    (s) => s.date >= startIsoDay && s.date <= endIsoDay
  );

  const totalSessions = periodSessions.reduce((acc, s) => acc + s.sessions, 0);
  const totalUniqueVisitors = periodSessions.reduce((acc, s) => acc + s.uniqueVisitors, 0);

  const nonCanceledOrders = periodOrders.filter(
    (o) => o.paymentStatus !== 'Failed' && o.fulfillmentStatus !== 'Canceled'
  ).length;

  const conversionRatePercent =
    totalUniqueVisitors > 0
      ? Math.round((nonCanceledOrders / totalUniqueVisitors) * 10000) / 100
      : 0;

  return {
    grossRevenue: fromCents(grossCents),
    netRevenue: fromCents(netCents),
    totalDiscounts: fromCents(discountCents),
    totalTax: fromCents(taxCents),
    totalRefunds: fromCents(refundCents),
    pendingRevenue: fromCents(pendingCents),
    failedOrderVolume: fromCents(failedCents),
    totalOrdersCount: periodOrders.length,
    completedOrdersCount,
    paidOrdersCount,
    refundedOrdersCount,
    averageOrderValue,
    refundRatePercent,
    activeCustomersCount: activeCustomerIds.size,
    conversionRatePercent,
    totalSessions,
    totalUniqueVisitors,
  };
}

export interface ExecutiveKPIComparison {
  current: FinancialSummary;
  previous: FinancialSummary;
  deltas: {
    netRevenue: PercentChange;
    grossRevenue: PercentChange;
    totalOrders: PercentChange;
    completedOrders: PercentChange;
    activeCustomers: PercentChange;
    averageOrderValue: PercentChange;
    conversionRate: PercentChange;
    refundRate: PercentChange;
  };
}

export function calculateExecutiveComparison(
  orders: Order[],
  sessions: DailySessionMetric[],
  window: DateWindow
): ExecutiveKPIComparison {
  const current = calculateFinancialSummary(orders, sessions, window.startMs, window.endMs);
  const previous = calculateFinancialSummary(
    orders,
    sessions,
    window.prevStartMs,
    window.prevEndMs
  );

  return {
    current,
    previous,
    deltas: {
      netRevenue: calculatePercentChange(current.netRevenue, previous.netRevenue),
      grossRevenue: calculatePercentChange(current.grossRevenue, previous.grossRevenue),
      totalOrders: calculatePercentChange(current.totalOrdersCount, previous.totalOrdersCount),
      completedOrders: calculatePercentChange(current.completedOrdersCount, previous.completedOrdersCount),
      activeCustomers: calculatePercentChange(
        current.activeCustomersCount,
        previous.activeCustomersCount
      ),
      averageOrderValue: calculatePercentChange(
        current.averageOrderValue,
        previous.averageOrderValue
      ),
      conversionRate: calculatePercentChange(
        current.conversionRatePercent,
        previous.conversionRatePercent
      ),
      refundRate: calculatePercentChange(current.refundRatePercent, previous.refundRatePercent),
    },
  };
}

export interface TimeSeriesPoint {
  label: string;
  dateKey: string;
  grossRevenue: number;
  netRevenue: number;
  refunds: number;
  orders: number;
  aov: number;
  newCustomers: number;
}

export function buildRevenueTimeSeries(
  orders: Order[],
  customers: Customer[],
  window: DateWindow
): TimeSeriesPoint[] {
  const filteredOrders = filterOrdersByWindow(orders, window.startMs, window.endMs);
  const groupByDay = window.days <= 35;

  const buckets = new Map<
    string,
    {
      label: string;
      grossCents: number;
      netCents: number;
      refundCents: number;
      orders: number;
      eligibleOrders: number;
      newCustomers: number;
    }
  >();

  const stepDays = groupByDay ? 1 : window.days <= 120 ? 7 : 30;

  if (groupByDay) {
    const sD = new Date(window.startMs);
    const eD = new Date(window.endMs);
    const startUtcDay = Date.UTC(sD.getUTCFullYear(), sD.getUTCMonth(), sD.getUTCDate());
    const endUtcDay = Date.UTC(eD.getUTCFullYear(), eD.getUTCMonth(), eD.getUTCDate());
    for (let t = startUtcDay; t <= endUtcDay; t += ONE_DAY_MS) {
      const d = new Date(t);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      buckets.set(key, {
        label,
        grossCents: 0,
        netCents: 0,
        refundCents: 0,
        orders: 0,
        eligibleOrders: 0,
        newCustomers: 0,
      });
    }
  } else if (stepDays === 7) {
    // Weekly buckets aligned to start UTC day
    const sD = new Date(window.startMs);
    const eD = new Date(window.endMs);
    let cursor = Date.UTC(sD.getUTCFullYear(), sD.getUTCMonth(), sD.getUTCDate());
    const endUtcDay = Date.UTC(eD.getUTCFullYear(), eD.getUTCMonth(), eD.getUTCDate());
    while (cursor <= endUtcDay) {
      const d = new Date(cursor);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      buckets.set(key, {
        label,
        grossCents: 0,
        netCents: 0,
        refundCents: 0,
        orders: 0,
        eligibleOrders: 0,
        newCustomers: 0,
      });
      cursor += 7 * ONE_DAY_MS;
    }
  } else {
    // Monthly buckets
    const startD = new Date(window.startMs);
    const endD = new Date(window.endMs);
    let y = startD.getUTCFullYear();
    let m = startD.getUTCMonth();
    while (y < endD.getUTCFullYear() || (y === endD.getUTCFullYear() && m <= endD.getUTCMonth())) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const d = new Date(Date.UTC(y, m, 1));
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      buckets.set(key, {
        label,
        grossCents: 0,
        netCents: 0,
        refundCents: 0,
        orders: 0,
        eligibleOrders: 0,
        newCustomers: 0,
      });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }

  const bucketKeys = Array.from(buckets.keys());

  const findBucketKey = (isoDate: string): string | undefined => {
    const ms = Date.parse(isoDate);
    if (!Number.isFinite(ms)) return undefined;
    const utcIso = new Date(ms).toISOString();
    if (groupByDay) {
      return utcIso.slice(0, 10);
    }
    if (stepDays === 7) {
      const targetDay = utcIso.slice(0, 10);
      let chosen = bucketKeys[0];
      for (const k of bucketKeys) {
        if (k <= targetDay) chosen = k;
      }
      return chosen;
    }
    return utcIso.slice(0, 7);
  };

  for (const order of filteredOrders) {
    const key = findBucketKey(order.orderDate);
    if (!key || !buckets.has(key)) continue;
    const b = buckets.get(key)!;
    b.orders += 1;
    if (isRealizedOrder(order)) {
      const refundCents = invoiceRefundCents(order);
      b.grossCents += toCents(order.subtotal);
      b.netCents += toCents(order.totalAmount) - refundCents;
      b.refundCents += refundCents;
      b.eligibleOrders += 1;
    }
  }

  for (const cust of customers) {
    const ct = Date.parse(cust.createdAt);
    if (Number.isFinite(ct) && ct >= window.startMs && ct <= window.endMs) {
      const key = findBucketKey(cust.createdAt);
      if (key && buckets.has(key)) {
        buckets.get(key)!.newCustomers += 1;
      }
    }
  }

  return Array.from(buckets.entries()).map(([dateKey, b]) => ({
    label: b.label,
    dateKey,
    grossRevenue: fromCents(b.grossCents),
    netRevenue: fromCents(b.netCents),
    refunds: fromCents(b.refundCents),
    orders: b.orders,
    aov: b.eligibleOrders > 0 ? fromCents(Math.round(b.netCents / b.eligibleOrders)) : 0,
    newCustomers: b.newCustomers,
  }));
}

export interface ChannelBreakdownItem {
  channel: SalesChannel;
  orders: number;
  netRevenue: number;
  sharePercent: number;
}

export function calculateSalesByChannel(orders: Order[]): ChannelBreakdownItem[] {
  const map = new Map<SalesChannel, { orders: number; netCents: number }>([
    ['Direct Enterprise', { orders: 0, netCents: 0 }],
    ['Self-Serve Web', { orders: 0, netCents: 0 }],
    ['Partner Channel', { orders: 0, netCents: 0 }],
    ['Marketplace', { orders: 0, netCents: 0 }],
  ]);

  let totalNetCents = 0;
  for (const o of orders) {
    const entry = map.get(o.salesChannel) || { orders: 0, netCents: 0 };
    entry.orders += 1;
    const netCents = realizedNetCents(o);
    entry.netCents += netCents;
    totalNetCents += netCents;
    map.set(o.salesChannel, entry);
  }

  return Array.from(map.entries())
    .map(([channel, stats]) => ({
      channel,
      orders: stats.orders,
      netRevenue: fromCents(stats.netCents),
      sharePercent: totalNetCents > 0 ? Math.round((stats.netCents / totalNetCents) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.netRevenue - a.netRevenue);
}

type HistoricalCategory = ProductCategory | 'Unclassified';

export interface CategoryPerformanceItem {
  category: HistoricalCategory;
  unitsSold: number;
  grossRevenue: number;
  sharePercent: number;
}

export function calculateSalesByCategory(orders: Order[]): CategoryPerformanceItem[] {
  const categories: ProductCategory[] = [
    'Enterprise Software',
    'Cloud Infrastructure',
    'Data Intelligence',
    'Security & Compliance',
    'API & Integrations',
    'Advisory Retainer',
  ];

  const map = new Map<HistoricalCategory, { unitsSold: number; grossCents: number }>();
  for (const c of categories) {
    map.set(c, { unitsSold: 0, grossCents: 0 });
  }

  let totalGrossCents = 0;
  for (const o of orders) {
    if (!isRealizedOrder(o)) continue;
    for (const item of o.lineItems) {
      const category = item.category ?? 'Unclassified';
      const entry = map.get(category) || { unitsSold: 0, grossCents: 0 };
      const itemCents = toCents(item.subtotal);
      entry.unitsSold += item.quantity;
      entry.grossCents += itemCents;
      totalGrossCents += itemCents;
      map.set(category, entry);
    }
  }

  return Array.from(map.entries())
    .map(([category, stats]) => ({
      category,
      unitsSold: stats.unitsSold,
      grossRevenue: fromCents(stats.grossCents),
      sharePercent:
        totalGrossCents > 0 ? Math.round((stats.grossCents / totalGrossCents) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
}

export interface ProductPerformanceRow {
  productId: string;
  sku: string;
  name: string;
  category: ProductCategory;
  currentUnitPrice: number;
  unitsSold: number;
  ordersCount: number;
  grossRevenue: number;
  stockLevel: number;
}

export function calculateProductPerformance(
  products: Product[],
  orders: Order[]
): ProductPerformanceRow[] {
  const statsMap = new Map<
    string,
    { unitsSold: number; orderIds: Set<string>; grossCents: number }
  >();

  for (const o of orders) {
    if (!isRealizedOrder(o)) continue;
    for (const li of o.lineItems) {
      const existing = statsMap.get(li.productId) || {
        unitsSold: 0,
        orderIds: new Set<string>(),
        grossCents: 0,
      };
      existing.unitsSold += li.quantity;
      existing.orderIds.add(o.id);
      existing.grossCents += toCents(li.subtotal);
      statsMap.set(li.productId, existing);
    }
  }

  return products
    .map((p) => {
      const st = statsMap.get(p.id);
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        currentUnitPrice: p.unitPrice,
        unitsSold: st ? st.unitsSold : 0,
        ordersCount: st ? st.orderIds.size : 0,
        grossRevenue: st ? fromCents(st.grossCents) : 0,
        stockLevel: p.stockLevel,
      };
    })
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
}

export function calculateHistoricalProductVelocity(
  orders: Order[],
  products: Product[],
  categoryFilter: ProductCategory | 'All'
) {
  const currentStock = new Map(products.map((product) => [product.id, product.stockLevel]));
  const groups = new Map<string, {
    productId: string;
    sku: string;
    name: string;
    category: HistoricalCategory;
    unitsSold: number;
    grossCents: number;
    orderIds: Set<string>;
  }>();

  for (const order of orders) {
    if (!isRealizedOrder(order)) continue;
    for (const line of order.lineItems) {
      const category = line.category ?? 'Unclassified';
      if (categoryFilter !== 'All' && category !== categoryFilter) continue;

      const key = JSON.stringify([line.productId, line.sku, category]);
      const group = groups.get(key) ?? {
        productId: line.productId,
        sku: line.sku,
        name: line.productName,
        category,
        unitsSold: 0,
        grossCents: 0,
        orderIds: new Set<string>(),
      };
      group.unitsSold += line.quantity;
      group.grossCents += toCents(line.subtotal);
      group.orderIds.add(order.id);
      groups.set(key, group);
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.grossCents - a.grossCents || a.sku.localeCompare(b.sku) || a.category.localeCompare(b.category))
    .map(({ productId, sku, name, category, unitsSold, grossCents, orderIds }) => ({
      sku,
      name,
      category,
      averageRecordedUnitPrice: fromCents(Math.round(grossCents / unitsSold)),
      unitsSold,
      ordersCount: orderIds.size,
      grossCents,
      currentStock: currentStock.get(productId),
    }));
}

export interface CustomerWithMetrics extends Customer {
  lifetimeSpend: number;
  ordersCount: number;
  lastOrderDate: string | null;
  averageOrderValue: number;
}

export function enrichCustomersWithMetrics(
  customers: Customer[],
  orders: Order[]
): CustomerWithMetrics[] {
  const agg = new Map<
    string,
    { spendCents: number; count: number; settledCount: number; lastDate: string | null; lastMs: number }
  >();

  for (const o of orders) {
    const cur = agg.get(o.customerId) || {
      spendCents: 0,
      count: 0,
      settledCount: 0,
      lastDate: null,
      lastMs: -Infinity,
    };
    cur.count += 1;
    if (isRealizedOrder(o)) {
      cur.spendCents += realizedNetCents(o);
      cur.settledCount += 1;
    }
    const orderMs = Date.parse(o.orderDate);
    if (Number.isFinite(orderMs) && orderMs > cur.lastMs) {
      cur.lastMs = orderMs;
      cur.lastDate = o.orderDate;
    }
    agg.set(o.customerId, cur);
  }

  return customers.map((c) => {
    const stats = agg.get(c.id);
    if (!stats) {
      return {
        ...c,
        lifetimeSpend: 0,
        ordersCount: 0,
        lastOrderDate: null,
        averageOrderValue: 0,
      };
    }
    const lifetimeSpend = fromCents(stats.spendCents);
    return {
      ...c,
      lifetimeSpend,
      ordersCount: stats.count,
      lastOrderDate: stats.lastDate,
      averageOrderValue:
        stats.settledCount > 0 ? fromCents(Math.round(stats.spendCents / stats.settledCount)) : 0,
    };
  });
}

export function calculateOrderTotalsFromItems(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountAmount: number,
  taxRate: number
) {
  const subtotalCents = items.reduce(
    (sum, item) => sum + Math.round(Math.max(0, item.quantity) * toCents(item.unitPrice)),
    0
  );
  const clampedDiscountCents = Math.min(subtotalCents, Math.max(0, toCents(discountAmount)));
  const taxableCents = Math.max(0, subtotalCents - clampedDiscountCents);
  const safeTaxRate = Math.max(0, Number.isFinite(taxRate) ? taxRate : 0);
  const taxCents = Math.round(taxableCents * safeTaxRate);
  const totalCents = taxableCents + taxCents;

  return {
    subtotal: fromCents(subtotalCents),
    discountAmount: fromCents(clampedDiscountCents),
    taxAmount: fromCents(taxCents),
    totalAmount: fromCents(totalCents),
  };
}
