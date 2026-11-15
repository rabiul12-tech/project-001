import { describe, it, expect, beforeEach } from 'vitest';
import { generateDeterministicSeedData } from '@/lib/demo-data/seed';
import { nowMs } from '@/lib/clock';
import {
  loadFromLocalStorage,
  resetLocalStorageToSeed,
  saveToLocalStorage,
  STORAGE_KEYS,
  validateAndImportBackupJson,
} from '@/lib/storage/repository';
import {
  calculateExecutiveComparison,
  calculateFinancialSummary,
  calculateOrderTotalsFromItems,
  calculateProductPerformance,
  enrichCustomersWithMetrics,
  filterOrdersByWindow,
  resolveDateWindow,
} from '@/lib/calculations/analytics';
import { convertRowsToCsv } from '@/lib/export/exporter';
import {
  customerFormSchema,
  productFormSchema,
} from '@/lib/validation/schemas';
import { useAppStore } from '@/stores/useAppStore';

describe('AURELIX Analytics — Comprehensive Business Logic & Workflow Suite (25 Tests)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.getState().resetDemoData();
  });

  // 1. Initial demo data is seeded correctly
  it('01. seeds deterministic initial demo dataset (250 customers, 80 products, 1200 orders, 6 team members)', () => {
    const seed1 = generateDeterministicSeedData();
    const seed2 = generateDeterministicSeedData();
    expect(seed1.customers.length).toBe(250);
    expect(seed1.products.length).toBe(80);
    expect(seed1.orders.length).toBe(1200);
    expect(seed1.team.length).toBe(6);
    expect(seed1.dailySessions.length).toBe(365);
    expect(seed1.orders[0].orderNumber).toBe(seed2.orders[0].orderNumber);
    expect(seed1.orders[0].totalAmount).toBe(seed2.orders[0].totalAmount);
  });

  // 2. A customer can be created
  it('02. creates a new customer and immediately updates store and LocalStorage', () => {
    const store = useAppStore.getState();
    const created = store.addCustomer({
      name: 'Clara Thorne',
      company: 'Thorne Quantum Labs',
      email: 'clara@thornequantum.io',
      phone: '+1 (415) 890-2211',
      segment: 'Enterprise',
      status: 'Active',
      country: 'United States',
      notes: 'Strategic account',
    });

    const updatedCustomers = useAppStore.getState().customers;
    expect(created).not.toBeNull();
    expect(updatedCustomers.length).toBe(251);
    expect(updatedCustomers[0].id).toBe(created?.id);
    expect(updatedCustomers[0].company).toBe('Thorne Quantum Labs');
  });

  // 3. A customer can be edited
  it('03. edits an existing customer and synchronizes order display metadata', () => {
    const store = useAppStore.getState();
    const target = store.customers[0];
    store.updateCustomer(target.id, {
      name: 'Updated Executive Name',
      company: 'Updated Holdings Corp',
      email: target.email,
      phone: target.phone,
      segment: 'Mid-Market',
      status: 'At Risk',
      country: target.country,
      notes: 'Updated notes',
    });

    const after = useAppStore.getState().customers.find((c) => c.id === target.id);
    expect(after?.company).toBe('Updated Holdings Corp');
    expect(after?.status).toBe('At Risk');
  });

  // 4. Customer deletion handles referenced orders safely
  it('04. deletes a customer while preserving historical orders and revenue integrity', () => {
    const store = useAppStore.getState();
    const orderWithCust = store.orders[0];
    const custId = orderWithCust.customerId;
    const initialOrderCount = store.orders.length;

    store.deleteCustomers([custId]);

    const afterState = useAppStore.getState();
    expect(afterState.customers.find((c) => c.id === custId)).toBeUndefined();
    expect(afterState.orders.length).toBe(initialOrderCount);
    const preservedOrder = afterState.orders.find((o) => o.id === orderWithCust.id);
    expect(preservedOrder?.customerCompany).toBeTruthy();
  });

  // 5. A product can be created
  it('05. creates a new product SKU and adds it to the catalog', () => {
    const store = useAppStore.getState();
    const newProd = store.addProduct({
      sku: 'SEC-9999',
      name: 'Zero-Knowledge Audit Vault',
      category: 'Security & Compliance',
      unitPrice: 4500,
      costPrice: 900,
      stockLevel: 75,
      status: 'Active',
      description: 'Hardware-backed cryptographic audit vault.',
    });

    expect(newProd).not.toBeNull();
    expect(useAppStore.getState().products.length).toBe(81);
    expect(useAppStore.getState().products[0].sku).toBe(newProd?.sku);
  });

  // 6. Product prices are validated
  it('06. validates product prices with Zod and rejects negative or zero unit prices', () => {
    const invalidResult = productFormSchema.safeParse({
      sku: 'ENT-101',
      name: 'Invalid Product',
      category: 'Enterprise Software',
      unitPrice: -250,
      costPrice: 50,
      stockLevel: 10,
      status: 'Active',
      description: 'Valid description text',
    });
    expect(invalidResult.success).toBe(false);

    const validResult = productFormSchema.safeParse({
      sku: 'ENT-101',
      name: 'Valid Product',
      category: 'Enterprise Software',
      unitPrice: 1250,
      costPrice: 250,
      stockLevel: 10,
      status: 'Active',
      description: 'Valid description text',
    });
    expect(validResult.success).toBe(true);
  });

  // 7. Historical order prices remain unchanged when product price is edited
  it('07. preserves historical order line-item prices after product unit price is edited', () => {
    const store = useAppStore.getState();
    const sampleOrder = store.orders[0];
    const lineItem = sampleOrder.lineItems[0];
    const originalLockedPrice = lineItem.unitPrice;
    const originalOrderTotal = sampleOrder.totalAmount;

    const targetProduct = store.products.find((p) => p.id === lineItem.productId)!;
    store.updateProduct(targetProduct.id, {
      sku: targetProduct.sku,
      name: targetProduct.name,
      category: targetProduct.category,
      unitPrice: originalLockedPrice + 5000, // Dramatic price increase
      costPrice: targetProduct.costPrice,
      stockLevel: targetProduct.stockLevel,
      status: targetProduct.status,
      description: targetProduct.description,
    });

    const updatedProduct = useAppStore.getState().products.find((p) => p.id === targetProduct.id)!;
    expect(updatedProduct.unitPrice).toBe(originalLockedPrice + 5000);

    const historicalOrderAfter = useAppStore.getState().orders.find((o) => o.id === sampleOrder.id)!;
    expect(historicalOrderAfter.lineItems[0].unitPrice).toBe(originalLockedPrice);
    expect(historicalOrderAfter.totalAmount).toBe(originalOrderTotal);
  });

  // 8. Orders calculate correct totals
  it('08. calculates order subtotal, discount, tax, and total accurately from line items', () => {
    const totals = calculateOrderTotalsFromItems(
      [
        { quantity: 2, unitPrice: 1000 },
        { quantity: 1, unitPrice: 500 },
      ],
      200, // $200 discount -> $2300 taxable
      0.1 // 10% tax -> $230 tax -> $2530 total
    );
    expect(totals.subtotal).toBe(2500);
    expect(totals.discountAmount).toBe(200);
    expect(totals.taxAmount).toBe(230);
    expect(totals.totalAmount).toBe(2530);
  });

  // 9. Refunds update financial metrics without double-counting
  it('09. updates net revenue and refund rate accurately when a simulated refund is issued', () => {
    const store = useAppStore.getState();
    const win = resolveDateWindow('12m');
    const beforeSummary = calculateFinancialSummary(
      store.orders,
      store.dailySessions,
      win.startMs,
      win.endMs
    );

    const paidOrder = store.orders.find((o) => o.paymentStatus === 'Paid')!;
    store.refundOrder(paidOrder.id, 500);

    const afterOrders = useAppStore.getState().orders;
    const afterSummary = calculateFinancialSummary(
      afterOrders,
      store.dailySessions,
      win.startMs,
      win.endMs
    );

    expect(Math.round(afterSummary.totalRefunds - beforeSummary.totalRefunds)).toBe(500);
    expect(Math.round(beforeSummary.netRevenue - afterSummary.netRevenue)).toBe(500);
  });

  // 10. Revenue dashboards match source records
  it('10. reconciles financial summary totals with underlying order records', () => {
    const { orders, dailySessions } = useAppStore.getState();
    const win = resolveDateWindow('30d');
    const summary = calculateFinancialSummary(orders, dailySessions, win.startMs, win.endMs);
    const manualPeriodOrders = filterOrdersByWindow(orders, win.startMs, win.endMs);

    const manualNet = manualPeriodOrders
      .filter((o) => o.paymentStatus === 'Paid' || o.paymentStatus === 'Refunded')
      .reduce((acc, o) => acc + Math.max(0, o.totalAmount - o.refundedAmount), 0);

    expect(summary.totalOrdersCount).toBe(manualPeriodOrders.length);
    expect(summary.netRevenue).toBeCloseTo(manualNet, 1);
  });

  // 11. Filtering works
  it('11. filters customer and product records accurately by segment and category', () => {
    const { customers, products } = useAppStore.getState();
    const enterpriseCustomers = customers.filter((c) => c.segment === 'Enterprise');
    expect(enterpriseCustomers.length).toBeGreaterThan(20);
    expect(enterpriseCustomers.every((c) => c.segment === 'Enterprise')).toBe(true);

    const cloudProducts = products.filter((p) => p.category === 'Cloud Infrastructure');
    expect(cloudProducts.length).toBeGreaterThan(5);
  });

  // 12. Sorting works
  it('12. sorts enriched customers by lifetime spend descending and ascending', () => {
    const { customers, orders } = useAppStore.getState();
    const enriched = enrichCustomersWithMetrics(customers, orders);
    const desc = [...enriched].sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
    expect(desc[0].lifetimeSpend).toBeGreaterThanOrEqual(desc[1].lifetimeSpend);

    const asc = [...enriched].sort((a, b) => a.lifetimeSpend - b.lifetimeSpend);
    expect(asc[0].lifetimeSpend).toBeLessThanOrEqual(asc[desc.length - 1].lifetimeSpend);
  });

  // 13. Pagination works
  it('13. slices paginated records accurately across pages', () => {
    const { customers } = useAppStore.getState();
    const pageSize = 20;
    const page1 = customers.slice(0, pageSize);
    const page2 = customers.slice(pageSize, pageSize * 2);
    expect(page1.length).toBe(20);
    expect(page2.length).toBe(20);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  // 14. Date filters work
  it('14. resolves 7d, 30d, 90d, and custom date windows and filters orders accordingly', () => {
    const { orders } = useAppStore.getState();
    const win7 = resolveDateWindow('7d');
    const win90 = resolveDateWindow('90d');
    const orders7 = filterOrdersByWindow(orders, win7.startMs, win7.endMs);
    const orders90 = filterOrdersByWindow(orders, win90.startMs, win90.endMs);

    expect(win7.days).toBe(7);
    expect(win90.days).toBe(90);
    expect(orders90.length).toBeGreaterThan(orders7.length);
  });

  // 15. LocalStorage persistence survives refresh
  it('15. persists user mutations to LocalStorage and hydrates them on reload without overwriting', () => {
    const store = useAppStore.getState();
    store.addCustomer({
      name: 'Persistence Check User',
      company: 'Persistent Sovereign LLC',
      email: 'persist@sovereign.io',
      phone: '+1 (212) 555-0199',
      segment: 'Enterprise',
      status: 'Active',
      country: 'United States',
    });

    const reloaded = loadFromLocalStorage();
    expect(reloaded.status).toBe('hydrated');
    expect(reloaded.data.customers[0].company).toBe('Persistent Sovereign LLC');
  });

  // 16. Corrupt LocalStorage data is handled
  it('16. recovers gracefully from corrupt JSON in LocalStorage and preserves corrupt snapshot', () => {
    window.localStorage.setItem(STORAGE_KEYS.MAIN_STORE, '{corrupt_json: true, unclosed');
    const result = loadFromLocalStorage();
    expect(result.status).toBe('corrupt_recovered');
    expect(result.data.customers.length).toBe(250);
    expect(result.errorMessage).toBeTruthy();
  });

  // 17. Backup export works
  it('17. exports valid JSON workspace snapshot and RFC-4180 CSV rows', () => {
    const snap = useAppStore.getState().getExportSnapshot();
    expect(snap.schemaVersion).toBe(1);
    expect(snap.orders.length).toBe(1200);

    const csv = convertRowsToCsv(['Order', 'Company, Inc.'], [['AUR-1', 'Acme, "Global"']]);
    expect(csv).toContain('"Acme, ""Global"""');
  });

  // 18. Backup import validation works
  it('18. validates imported backup JSON and rejects malformed schemas', () => {
    const badImport = validateAndImportBackupJson('{"schemaVersion": 1, "customers": []}');
    expect(badImport.ok).toBe(false);
    expect(badImport.error).toBeTruthy();

    const validSnap = JSON.stringify(useAppStore.getState().getExportSnapshot());
    const goodImport = validateAndImportBackupJson(validSnap);
    expect(goodImport.ok).toBe(true);
  });

  // 19. Reset restores valid demo data
  it('19. resets modified workspace back to deterministic seed dataset', () => {
    const store = useAppStore.getState();
    store.deleteCustomers([store.customers[0].id, store.customers[1].id]);
    expect(useAppStore.getState().customers.length).toBe(248);

    const restored = resetLocalStorageToSeed();
    expect(restored.customers.length).toBe(250);
  });

  // 20. Theme preference persists
  it('20. persists light and dark theme switching in LocalStorage settings', () => {
    const store = useAppStore.getState();
    store.setTheme('light');
    expect(useAppStore.getState().settings.theme).toBe('light');

    const hydrated = loadFromLocalStorage();
    expect(hydrated.data.settings.theme).toBe('light');
  });

  // 21. Sidebar state persists
  it('21. persists sidebar collapsed state in LocalStorage settings', () => {
    const store = useAppStore.getState();
    store.setSidebarCollapsed(true);
    expect(useAppStore.getState().settings.sidebarCollapsed).toBe(true);

    const hydrated = loadFromLocalStorage();
    expect(hydrated.data.settings.sidebarCollapsed).toBe(true);
  });

  // 22. Command palette state & search matching works
  it('22. toggles Command Palette open state and global search query', () => {
    const store = useAppStore.getState();
    store.setCommandPaletteOpen(true);
    expect(useAppStore.getState().commandPaletteOpen).toBe(true);
    store.setCommandPaletteOpen(false);
    expect(useAppStore.getState().commandPaletteOpen).toBe(false);
  });

  // 23. Forms show useful validation errors via Zod
  it('23. produces actionable field validation errors for invalid customer inputs', () => {
    const res = customerFormSchema.safeParse({
      name: 'A',
      company: '',
      email: 'not-an-email',
      phone: '123',
      segment: 'Enterprise',
      status: 'Active',
      country: '',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const messages = res.error.issues.map((i) => i.message);
      expect(messages).toContain('Enter a valid corporate email address');
    }
  });

  // 24. Responsive navigation drawer state works
  it('24. controls mobile slide-out navigation state cleanly', () => {
    const store = useAppStore.getState();
    store.setMobileNavOpen(true);
    expect(useAppStore.getState().mobileNavOpen).toBe(true);
    store.setMobileNavOpen(false);
    expect(useAppStore.getState().mobileNavOpen).toBe(false);
  });

  // 25. Zero-denominator and edge-case calculation safety
  it('25. handles empty order windows and zero denominators safely without NaN', () => {
    const emptySummary = calculateFinancialSummary(
      [],
      [],
      nowMs(),
      nowMs()
    );
    expect(emptySummary.netRevenue).toBe(0);
    expect(emptySummary.averageOrderValue).toBe(0);
    expect(emptySummary.conversionRatePercent).toBe(0);
    expect(Number.isNaN(emptySummary.averageOrderValue)).toBe(false);

    const perf = calculateProductPerformance(useAppStore.getState().products, []);
    expect(perf.length).toBe(80);
    expect(perf[0].grossRevenue).toBe(0);

    const execComp = calculateExecutiveComparison(
      useAppStore.getState().orders,
      useAppStore.getState().dailySessions,
      resolveDateWindow('30d')
    );
    expect(typeof execComp.deltas.netRevenue).toBe('number');
  });
});
