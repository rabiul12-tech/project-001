import {
  Customer,
  DailySessionMetric,
  DateRangePreset,
  Order,
  Product,
  ProductCategory,
  SalesChannel,
} from '@/types';
import { REFERENCE_NOW_ISO } from '@/lib/demo-data/seed';

/**
 * CENTRALIZED ANALYTICS & FINANCIAL CALCULATION ENGINE
 *
 * Documented Formula Rules:
 * 1. Eligible Revenue Orders: Orders where `paymentStatus` is 'Paid' or 'Refunded' (excludes 'Failed' and 'Canceled'/'Pending' uncollected orders for realized revenue, with Pending tracked separately).
 * 2. Gross Revenue: Sum of `subtotal` (before discounts & refunds) across all non-failed/non-canceled orders (`Paid` + `Refunded`).
 * 3. Total Discounts: Sum of `discountAmount` across eligible (`Paid` + `Refunded`) orders.
 * 4. Total Tax Collected: Sum of `taxAmount` across eligible (`Paid` + `Refunded`) orders.
 * 5. Total Refunds: Sum of `refundedAmount` across `Refunded` orders.
 * 6. Net Revenue: Sum of (`totalAmount - refundedAmount`) across `Paid` and `Refunded` orders. Never double-counts refunded revenue.
 * 7. Average Order Value (AOV): `Net Revenue / Count of Paid & Partially-Refunded Orders`. Safe zero-denominator handling.
 * 8. Conversion Rate: `(Paid & Processing Orders in period / Unique Visitors in period) * 100`. Derived from daily simulated visitor/session telemetry.
 */

export interface DateWindow {
  startMs: number;
  endMs: number;
  prevStartMs: number;
  prevEndMs: number;
  days: number;
}

export function resolveDateWindow(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  referenceIso: string = REFERENCE_NOW_ISO
): DateWindow {
  const endMs = customEnd ? new Date(customEnd).getTime() : new Date(referenceIso).getTime();
  const oneDayMs = 86400 * 1000;

  let days = 30;
  if (preset === '7d') days = 7;
  else if (preset === '30d') days = 30;
  else if (preset === '90d') days = 90;
  else if (preset === '6m') days = 180;
  else if (preset === '12m') days = 365;
  else if (preset === 'all') days = 365;
  else if (preset === 'custom' && customStart) {
    const startCustomMs = new Date(customStart).getTime();
    days = Math.max(1, Math.round((endMs - startCustomMs) / oneDayMs));
  }

  const startMs =
    preset === 'custom' && customStart
      ? new Date(customStart).getTime()
      : endMs - days * oneDayMs;

  const durationMs = Math.max(oneDayMs, endMs - startMs);
  const prevEndMs = startMs - 1;
  const prevStartMs = prevEndMs - durationMs;

  return { startMs, endMs, prevStartMs, prevEndMs, days };
}

export function filterOrdersByWindow(orders: Order[], startMs: number, endMs: number): Order[] {
  return orders.filter((o) => {
    const t = new Date(o.orderDate).getTime();
    return t >= startMs && t <= endMs;
  });
}

export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
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

  let grossRevenue = 0;
  let netRevenue = 0;
  let totalDiscounts = 0;
  let totalTax = 0;
  let totalRefunds = 0;
  let pendingRevenue = 0;
  let failedOrderVolume = 0;
  let paidOrdersCount = 0;
  let refundedOrdersCount = 0;

  const activeCustomerIds = new Set<string>();

  for (const order of periodOrders) {
    if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Refunded') {
      grossRevenue += order.subtotal;
      totalDiscounts += order.discountAmount;
      totalTax += order.taxAmount;
      totalRefunds += order.refundedAmount;
      const realizedNet = Math.max(0, order.totalAmount - order.refundedAmount);
      netRevenue += realizedNet;
      activeCustomerIds.add(order.customerId);

      if (order.paymentStatus === 'Paid') {
        paidOrdersCount++;
      } else {
        refundedOrdersCount++;
      }
    } else if (order.paymentStatus === 'Pending' && order.fulfillmentStatus !== 'Canceled') {
      pendingRevenue += order.totalAmount;
      activeCustomerIds.add(order.customerId);
    } else if (order.paymentStatus === 'Failed' || order.fulfillmentStatus === 'Canceled') {
      failedOrderVolume += order.totalAmount;
    }
  }

  const eligibleOrderCount = paidOrdersCount + refundedOrdersCount;
  const averageOrderValue = eligibleOrderCount > 0 ? netRevenue / eligibleOrderCount : 0;
  const refundRatePercent =
    grossRevenue > 0 ? Math.round((totalRefunds / grossRevenue) * 1000) / 10 : 0;

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
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    totalDiscounts: Math.round(totalDiscounts * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    totalRefunds: Math.round(totalRefunds * 100) / 100,
    pendingRevenue: Math.round(pendingRevenue * 100) / 100,
    failedOrderVolume: Math.round(failedOrderVolume * 100) / 100,
    totalOrdersCount: periodOrders.length,
    paidOrdersCount,
    refundedOrdersCount,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
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
    netRevenue: number;
    grossRevenue: number;
    totalOrders: number;
    activeCustomers: number;
    averageOrderValue: number;
    conversionRate: number;
    refundRate: number;
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
      grossRevenue: number;
      netRevenue: number;
      refunds: number;
      orders: number;
      eligibleOrders: number;
      newCustomers: number;
    }
  >();

  const stepDays = groupByDay ? 1 : window.days <= 120 ? 7 : 30;
  const oneDayMs = 86400 * 1000;

  if (groupByDay) {
    for (let t = window.startMs; t <= window.endMs; t += oneDayMs) {
      const d = new Date(t);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      buckets.set(key, {
        label,
        grossRevenue: 0,
        netRevenue: 0,
        refunds: 0,
        orders: 0,
        eligibleOrders: 0,
        newCustomers: 0,
      });
    }
  } else if (stepDays === 7) {
    // Weekly buckets
    let cursor = window.startMs;
    while (cursor <= window.endMs) {
      const d = new Date(cursor);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      buckets.set(key, {
        label,
        grossRevenue: 0,
        netRevenue: 0,
        refunds: 0,
        orders: 0,
        eligibleOrders: 0,
        newCustomers: 0,
      });
      cursor += 7 * oneDayMs;
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
        grossRevenue: 0,
        netRevenue: 0,
        refunds: 0,
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
    if (groupByDay) {
      return isoDate.slice(0, 10);
    }
    if (stepDays === 7) {
      const targetDay = isoDate.slice(0, 10);
      let chosen = bucketKeys[0];
      for (const k of bucketKeys) {
        if (k <= targetDay) chosen = k;
      }
      return chosen;
    }
    return isoDate.slice(0, 7);
  };

  for (const order of filteredOrders) {
    const key = findBucketKey(order.orderDate);
    if (!key || !buckets.has(key)) continue;
    const b = buckets.get(key)!;
    b.orders += 1;
    if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Refunded') {
      b.grossRevenue += order.subtotal;
      b.netRevenue += Math.max(0, order.totalAmount - order.refundedAmount);
      b.refunds += order.refundedAmount;
      b.eligibleOrders += 1;
    }
  }

  for (const cust of customers) {
    const ct = new Date(cust.createdAt).getTime();
    if (ct >= window.startMs && ct <= window.endMs) {
      const key = findBucketKey(cust.createdAt);
      if (key && buckets.has(key)) {
        buckets.get(key)!.newCustomers += 1;
      }
    }
  }

  return Array.from(buckets.entries()).map(([dateKey, b]) => ({
    label: b.label,
    dateKey,
    grossRevenue: Math.round(b.grossRevenue),
    netRevenue: Math.round(b.netRevenue),
    refunds: Math.round(b.refunds),
    orders: b.orders,
    aov: b.eligibleOrders > 0 ? Math.round(b.netRevenue / b.eligibleOrders) : 0,
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
  const map = new Map<SalesChannel, { orders: number; netRevenue: number }>([
    ['Direct Enterprise', { orders: 0, netRevenue: 0 }],
    ['Self-Serve Web', { orders: 0, netRevenue: 0 }],
    ['Partner Channel', { orders: 0, netRevenue: 0 }],
    ['Marketplace', { orders: 0, netRevenue: 0 }],
  ]);

  let totalNet = 0;
  for (const o of orders) {
    const entry = map.get(o.salesChannel) || { orders: 0, netRevenue: 0 };
    entry.orders += 1;
    if (o.paymentStatus === 'Paid' || o.paymentStatus === 'Refunded') {
      const net = Math.max(0, o.totalAmount - o.refundedAmount);
      entry.netRevenue += net;
      totalNet += net;
    }
    map.set(o.salesChannel, entry);
  }

  return Array.from(map.entries())
    .map(([channel, stats]) => ({
      channel,
      orders: stats.orders,
      netRevenue: Math.round(stats.netRevenue),
      sharePercent: totalNet > 0 ? Math.round((stats.netRevenue / totalNet) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.netRevenue - a.netRevenue);
}

export interface CategoryPerformanceItem {
  category: ProductCategory;
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

  const map = new Map<ProductCategory, { unitsSold: number; grossRevenue: number }>();
  for (const c of categories) {
    map.set(c, { unitsSold: 0, grossRevenue: 0 });
  }

  let totalGross = 0;
  for (const o of orders) {
    if (o.paymentStatus !== 'Paid' && o.paymentStatus !== 'Refunded') continue;
    for (const item of o.lineItems) {
      const entry = map.get(item.category) || { unitsSold: 0, grossRevenue: 0 };
      entry.unitsSold += item.quantity;
      entry.grossRevenue += item.subtotal;
      totalGross += item.subtotal;
      map.set(item.category, entry);
    }
  }

  return Array.from(map.entries())
    .map(([category, stats]) => ({
      category,
      unitsSold: stats.unitsSold,
      grossRevenue: Math.round(stats.grossRevenue),
      sharePercent: totalGross > 0 ? Math.round((stats.grossRevenue / totalGross) * 1000) / 10 : 0,
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
    { unitsSold: number; ordersCount: number; grossRevenue: number }
  >();

  for (const o of orders) {
    if (o.paymentStatus !== 'Paid' && o.paymentStatus !== 'Refunded') continue;
    for (const li of o.lineItems) {
      const existing = statsMap.get(li.productId) || {
        unitsSold: 0,
        ordersCount: 0,
        grossRevenue: 0,
      };
      existing.unitsSold += li.quantity;
      existing.ordersCount += 1;
      existing.grossRevenue += li.subtotal;
      statsMap.set(li.productId, existing);
    }
  }

  return products
    .map((p) => {
      const st = statsMap.get(p.id) || { unitsSold: 0, ordersCount: 0, grossRevenue: 0 };
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        currentUnitPrice: p.unitPrice,
        unitsSold: st.unitsSold,
        ordersCount: st.ordersCount,
        grossRevenue: Math.round(st.grossRevenue * 100) / 100,
        stockLevel: p.stockLevel,
      };
    })
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
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
    { spend: number; count: number; lastDate: string | null }
  >();

  for (const o of orders) {
    const cur = agg.get(o.customerId) || { spend: 0, count: 0, lastDate: null };
    cur.count += 1;
    if (o.paymentStatus === 'Paid' || o.paymentStatus === 'Refunded') {
      cur.spend += Math.max(0, o.totalAmount - o.refundedAmount);
    }
    if (!cur.lastDate || o.orderDate > cur.lastDate) {
      cur.lastDate = o.orderDate;
    }
    agg.set(o.customerId, cur);
  }

  return customers.map((c) => {
    const stats = agg.get(c.id) || { spend: 0, count: 0, lastDate: null };
    const lifetimeSpend = Math.round(stats.spend * 100) / 100;
    return {
      ...c,
      lifetimeSpend,
      ordersCount: stats.count,
      lastOrderDate: stats.lastDate,
      averageOrderValue:
        stats.count > 0 ? Math.round((lifetimeSpend / stats.count) * 100) / 100 : 0,
    };
  });
}

export function calculateOrderTotalsFromItems(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountAmount: number,
  taxRate: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100) / 100,
    0
  );
  const clampedDiscount = Math.min(subtotal, Math.max(0, discountAmount));
  const taxableBase = Math.max(0, subtotal - clampedDiscount);
  const taxAmount = Math.round(taxableBase * taxRate * 100) / 100;
  const totalAmount = Math.round((taxableBase + taxAmount) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(clampedDiscount * 100) / 100,
    taxAmount,
    totalAmount,
  };
}
