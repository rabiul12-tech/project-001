import { describe, it, expect, beforeEach } from 'vitest';
import { generateDeterministicSeedData } from '@/lib/demo-data/seed';
import { resolveDateWindow, filterOrdersByWindow } from '@/lib/calculations/analytics';
import { DAY_MS, isoDay, nowMs } from '@/lib/clock';
import { useAppStore } from '@/stores/useAppStore';

const NOW = Date.UTC(2031, 2, 9, 15, 30);

function allSeedTimestamps(seed: ReturnType<typeof generateDeterministicSeedData>): string[] {
  return [
    ...seed.customers.map((c) => c.createdAt),
    ...seed.products.flatMap((p) => [p.createdAt, p.updatedAt]),
    ...seed.orders.map((o) => o.orderDate),
    ...seed.team.flatMap((m) => [m.joinedAt, m.lastActiveAt]),
    ...seed.activities.map((a) => a.timestamp),
    ...seed.savedReports.flatMap((r) => [r.createdAt, r.lastGeneratedAt]),
    ...seed.reportHistory.map((r) => r.generatedAt),
    seed.seededAt,
  ];
}

describe('single clock: seed, windows and runtime records', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.getState().hydrateStore();
  });

  it('seeds relative to the given now, with nothing dated after it', () => {
    const seed = generateDeterministicSeedData(NOW);
    expect(seed.seededAt).toBe(new Date(NOW).toISOString());
    for (const iso of allSeedTimestamps(seed)) {
      expect(Date.parse(iso)).toBeLessThanOrEqual(NOW);
    }
    expect(seed.dailySessions.at(-1)?.date).toBe(isoDay(NOW));
  });

  it('keeps the same shape on any day (only the dates shift)', () => {
    const a = generateDeterministicSeedData(NOW);
    const b = generateDeterministicSeedData(NOW + 400 * DAY_MS);
    expect(b.orders.map((o) => o.totalAmount)).toEqual(a.orders.map((o) => o.totalAmount));
    expect(Date.parse(b.orders[0].orderDate) - Date.parse(a.orders[0].orderDate)).toBe(400 * DAY_MS);
  });

  it('ends every preset window at now, so recent orders fall inside the 30d window', () => {
    const seed = generateDeterministicSeedData(NOW);
    const win = resolveDateWindow('30d', '2020-01-01', '2020-02-01', new Date(NOW).toISOString());
    expect(win.endMs).toBe(NOW);
    expect(filterOrdersByWindow(seed.orders, win.startMs, win.endMs).length).toBeGreaterThan(0);
  });

  it('stamps runtime activity and orders with the same clock as the window end', () => {
    const before = nowMs();
    useAppStore.getState().setActiveRolePreview('Analyst');
    const [entry] = useAppStore.getState().activities;
    expect(Date.parse(entry.timestamp)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(entry.timestamp)).toBeLessThanOrEqual(nowMs());

    // Switch back to Owner before creating an order, since Analyst is read-only for order mutations.
    useAppStore.getState().setActiveRolePreview('Owner');
    const state = useAppStore.getState();
    const order = state.createOrder({
      customerId: state.customers[0].id,
      salesChannel: 'Direct Enterprise',
      paymentStatus: 'Paid',
      fulfillmentStatus: 'Fulfilled',
      discountAmount: 0,
      taxRatePercent: 8.5,
      notes: '',
      items: [{ productId: state.products[0].id, quantity: 1 }],
    });
    expect(order).not.toBeNull();
    expect(Date.parse(order!.orderDate)).toBeLessThanOrEqual(nowMs());
  });

  it('keeps historical date windows addressable when the active clock advances', () => {
    const seed = generateDeterministicSeedData(NOW);
    const day = seed.orders[0].orderDate.slice(0, 10);
    const win = resolveDateWindow('custom', day, day, new Date(NOW + 45 * DAY_MS).toISOString());
    expect(filterOrdersByWindow(seed.orders, win.startMs, win.endMs)).toContain(seed.orders[0]);
  });
});
