import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateFinancialSummary,
  calculateOrderTotalsFromItems,
  calculateProductPerformance,
  enrichCustomersWithMetrics,
  filterOrdersByWindow,
  fromCents,
  resolveDateWindow,
  toCents,
} from '@/lib/calculations/analytics';
import {
  convertRowsToCsv,
  formatDateDisplay,
  formatTimestampUtc,
  getUtcDayKey,
} from '@/lib/export/exporter';
import { canPerformAction, PERMISSION_MATRIX } from '@/lib/permissions';
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  STORAGE_KEYS,
  validateAndImportBackupJson,
} from '@/lib/storage/repository';
import { CURRENT_SCHEMA_VERSION } from '@/lib/demo-data/seed';
import { useAppStore } from '@/stores/useAppStore';
import { Order, TeamRole } from '@/types';

describe('AURELIX Regression Suite — Financial Integrity, Pagination, Timezone, Security & RBAC', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.getState().resetDemoData();
  });

  it('01. performs decimal-safe integer cent arithmetic without floating-point drift', () => {
    const calc = calculateOrderTotalsFromItems(
      [
        { quantity: 1, unitPrice: 19.99 },
        { quantity: 2, unitPrice: 0.1 },
      ],
      0.09,
      0.085
    );
    expect(calc.subtotal).toBe(20.19);
    expect(calc.discountAmount).toBe(0.09);
    expect(calc.taxAmount).toBe(1.71);
    expect(calc.totalAmount).toBe(21.81);
    expect(fromCents(toCents(0.1) + toCents(0.2))).toBe(0.3);
  });

  it('02. excludes Pending and Failed orders from realized KPIs and reconciles partial refunds cleanly', () => {
    const baseDate = '2026-10-15T12:00:00.000Z';
    const sampleOrders: Order[] = [
      {
        id: 'o1',
        orderNumber: 'ORD-1',
        customerId: 'c1',
        customerName: 'Alice',
        customerCompany: 'Acme',
        customerEmail: 'a@acme.io',
        orderDate: baseDate,
        lineItems: [],
        subtotal: 1000,
        discountAmount: 100,
        taxRate: 0.085,
        taxAmount: 76.5,
        totalAmount: 976.5,
        refundedAmount: 200,
        paymentStatus: 'Refunded',
        fulfillmentStatus: 'Fulfilled',
        salesChannel: 'Direct Enterprise',
      },
      {
        id: 'o2',
        orderNumber: 'ORD-2',
        customerId: 'c1',
        customerName: 'Alice',
        customerCompany: 'Acme',
        customerEmail: 'a@acme.io',
        orderDate: baseDate,
        lineItems: [],
        subtotal: 500,
        discountAmount: 0,
        taxRate: 0.085,
        taxAmount: 42.5,
        totalAmount: 542.5,
        refundedAmount: 0,
        paymentStatus: 'Paid',
        fulfillmentStatus: 'Fulfilled',
        salesChannel: 'Direct Enterprise',
      },
      {
        id: 'o3',
        orderNumber: 'ORD-3',
        customerId: 'c1',
        customerName: 'Alice',
        customerCompany: 'Acme',
        customerEmail: 'a@acme.io',
        orderDate: baseDate,
        lineItems: [],
        subtotal: 5000,
        discountAmount: 0,
        taxRate: 0.085,
        taxAmount: 425,
        totalAmount: 5425,
        refundedAmount: 0,
        paymentStatus: 'Pending',
        fulfillmentStatus: 'Processing',
        salesChannel: 'Direct Enterprise',
      },
      {
        id: 'o4',
        orderNumber: 'ORD-4',
        customerId: 'c1',
        customerName: 'Alice',
        customerCompany: 'Acme',
        customerEmail: 'a@acme.io',
        orderDate: baseDate,
        lineItems: [],
        subtotal: 8000,
        discountAmount: 0,
        taxRate: 0.085,
        taxAmount: 680,
        totalAmount: 8680,
        refundedAmount: 0,
        paymentStatus: 'Failed',
        fulfillmentStatus: 'Canceled',
        salesChannel: 'Direct Enterprise',
      },
    ];

    const summary = calculateFinancialSummary(
      sampleOrders,
      [],
      Date.parse('2026-10-01T00:00:00.000Z'),
      Date.parse('2026-10-31T23:59:59.999Z')
    );
    expect(summary.grossRevenue).toBe(1500);
    expect(summary.totalRefunds).toBe(200);
    expect(summary.netRevenue).toBe(1319);
    expect(summary.paidOrdersCount).toBe(1);
    expect(summary.refundedOrdersCount).toBe(1);
    expect(summary.pendingRevenue).toBe(5425);
    expect(summary.failedOrderVolume).toBe(8680);
    expect(summary.averageOrderValue).toBe(659.5);

    const enriched = enrichCustomersWithMetrics(
      [
        {
          id: 'c1',
          name: 'Alice',
          company: 'Acme',
          email: 'a@acme.io',
          phone: '123',
          segment: 'Enterprise',
          status: 'Active',
          country: 'US',
          createdAt: baseDate,
        },
      ],
      sampleOrders
    );
    expect(enriched[0].ordersCount).toBe(4);
    expect(enriched[0].lifetimeSpend).toBe(1319);
    expect(enriched[0].averageOrderValue).toBe(659.5);
  });

  it('03. resolves inclusive custom UTC day bounds and all-time range without dropping boundary-day orders', () => {
    const win = resolveDateWindow('custom', '2026-11-10', '2026-11-14', '2026-11-15T09:00:00.000Z');
    const boundaryOrder: Order = {
      id: 'ord-end-day',
      orderNumber: 'ORD-END',
      customerId: 'c1',
      customerName: 'Bob',
      customerCompany: 'EndDay Co',
      customerEmail: 'b@end.io',
      orderDate: '2026-11-14T23:30:00.000Z',
      lineItems: [],
      subtotal: 100,
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      totalAmount: 100,
      refundedAmount: 0,
      paymentStatus: 'Paid',
      fulfillmentStatus: 'Fulfilled',
      salesChannel: 'Marketplace',
    };
    const nextDayOrder: Order = {
      ...boundaryOrder,
      id: 'ord-next-day',
      orderDate: '2026-11-15T00:00:01.000Z',
    };

    const filtered = filterOrdersByWindow([boundaryOrder, nextDayOrder], win.startMs, win.endMs);
    expect(filtered.map((o) => o.id)).toEqual(['ord-end-day']);

    const winAll = resolveDateWindow(
      'all',
      undefined,
      undefined,
      '2026-11-15T09:00:00.000Z',
      '2025-01-01T00:00:00.000Z'
    );
    expect(winAll.startMs).toBe(Date.parse('2025-01-01T00:00:00.000Z'));
  });

  it('04. formats activity timestamps consistently in UTC and keeps feed sorted newest-first without future seeded timestamps', () => {
    const lateUtc = '2026-11-14T22:45:00.000Z';
    expect(formatDateDisplay(lateUtc, 'MMM d, yyyy')).toBe('Nov 14, 2026');
    expect(formatTimestampUtc(lateUtc, 'yyyy-MM-dd')).toBe('2026-11-14 · 22:45 UTC');
    expect(getUtcDayKey(lateUtc)).toBe('2026-11-14');

    const { activities } = useAppStore.getState();
    const now = Date.now() + 5000;
    for (let i = 0; i < activities.length; i++) {
      const ts = Date.parse(activities[i].timestamp);
      expect(ts).toBeLessThanOrEqual(now);
      if (i > 0) {
        expect(Date.parse(activities[i - 1].timestamp)).toBeGreaterThanOrEqual(ts);
      }
    }
  });

  it('05. partitions 80 products cleanly across 8 pages at pageSize 10 with no duplicates or skips', () => {
    const { products, orders } = useAppStore.getState();
    const perf = calculateProductPerformance(products, orders);
    expect(perf.length).toBe(80);

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(perf.length / pageSize));
    expect(totalPages).toBe(8);

    const seen = new Set<string>();
    for (let p = 1; p <= totalPages; p++) {
      const slice = perf.slice((p - 1) * pageSize, p * pageSize);
      expect(slice.length).toBe(10);
      slice.forEach((item) => seen.add(item.productId));
    }
    expect(seen.size).toBe(80);
  });

  it('06. supports explicit 0% tax order creation and rejects refunds on Failed/Canceled orders', () => {
    const store = useAppStore.getState();
    const cust = store.customers[0];
    const prod = store.products[0];

    const zeroTaxOrder = store.createOrder({
      customerId: cust.id,
      salesChannel: 'Direct Enterprise',
      paymentStatus: 'Paid',
      fulfillmentStatus: 'Fulfilled',
      discountAmount: 0,
      taxRatePercent: 0,
      items: [{ productId: prod.id, quantity: 2 }],
    });

    expect(zeroTaxOrder).not.toBeNull();
    expect(zeroTaxOrder?.taxAmount).toBe(0);
    expect(zeroTaxOrder?.totalAmount).toBe(prod.unitPrice * 2);

    const failedOrder = store.createOrder({
      customerId: cust.id,
      salesChannel: 'Self-Serve Web',
      paymentStatus: 'Failed',
      fulfillmentStatus: 'Canceled',
      discountAmount: 0,
      taxRatePercent: 8.5,
      items: [{ productId: prod.id, quantity: 1 }],
    });
    expect(failedOrder).not.toBeNull();
    if (failedOrder) {
      store.refundOrder(failedOrder.id, 100);
      const refreshed = useAppStore.getState().orders.find((o) => o.id === failedOrder.id);
      expect(refreshed?.refundedAmount).toBe(0);
      expect(refreshed?.paymentStatus).toBe('Failed');
    }
  });

  it('07. preserves historical order prices when product unit price updates or product is archived', () => {
    const store = useAppStore.getState();
    const prod = store.products[0];
    const origPrice = prod.unitPrice;
    const ord = store.createOrder({
      customerId: store.customers[0].id,
      salesChannel: 'Partner Channel',
      paymentStatus: 'Paid',
      fulfillmentStatus: 'Fulfilled',
      discountAmount: 0,
      taxRatePercent: 0,
      items: [{ productId: prod.id, quantity: 1 }],
    });
    expect(ord?.totalAmount).toBe(origPrice);

    store.updateProduct(prod.id, {
      sku: prod.sku,
      name: prod.name,
      category: prod.category,
      unitPrice: origPrice + 999,
      costPrice: prod.costPrice,
      stockLevel: prod.stockLevel,
      status: prod.status,
      description: prod.description,
    });
    store.archiveProducts([prod.id]);

    const afterOrder = useAppStore.getState().orders.find((o) => o.id === ord?.id);
    expect(afterOrder?.totalAmount).toBe(origPrice);
    expect(afterOrder?.lineItems[0].unitPrice).toBe(origPrice);

    const updatedProd = useAppStore.getState().products.find((p) => p.id === prod.id);
    expect(updatedProd?.status).toBe('Archived');

    const perf = calculateProductPerformance(
      useAppStore.getState().products,
      useAppStore.getState().orders
    );
    const archivedPerf = perf.find((p) => p.productId === prod.id);
    expect(archivedPerf?.unitsSold).toBeGreaterThanOrEqual(1);
  });

  it('08. neutralizes CSV formula injection payloads safely', () => {
    const csv = convertRowsToCsv(
      ['Formula', 'Normal'],
      [
        ['=CMD|"/C calc"!A0', '+123'],
        ['-400', '@SUM(A1:A2)'],
      ]
    );
    expect(csv).toContain("'=CMD");
    expect(csv).toContain("'+123");
    expect(csv).toContain("'-400");
    expect(csv).toContain("'@SUM(A1:A2)");
  });

  it('09. rejects unsupported backup schemaVersion and preserves existing LocalStorage on failed import', () => {
    const store = useAppStore.getState();
    const added = store.addCustomer({
      name: 'Keeper User',
      company: 'Safe Harbor Keepers',
      email: 'keeper@safeharbor.io',
      phone: '555-0101',
      segment: 'Enterprise',
      status: 'Active',
      country: 'United States',
    });
    expect(added).not.toBeNull();

    const snap = useAppStore.getState().getExportSnapshot();
    const unsupportedFuture = JSON.stringify({
      ...snap,
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    });
    const resFuture = validateAndImportBackupJson(unsupportedFuture);
    expect(resFuture.ok).toBe(false);
    expect(resFuture.error).toContain('Unsupported backup schema version');

    const badReports = JSON.stringify({
      ...snap,
      savedReports: [{ invalidField: true }],
    });
    const resBadReports = validateAndImportBackupJson(badReports);
    expect(resBadReports.ok).toBe(false);

    const loaded = loadFromLocalStorage();
    expect(loaded.data.customers[0].company).toBe('Safe Harbor Keepers');
  });

  it('10. handles storage quota write failures without throwing and surfaces store error banner state', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const saveResult = saveToLocalStorage(useAppStore.getState().getExportSnapshot());
    expect(saveResult.ok).toBe(false);
    expect(saveResult.error).toBeTruthy();

    const created = useAppStore.getState().addCustomer({
      name: 'Quota Check',
      company: 'Quota Overflow Co',
      email: 'q@overflow.io',
      phone: '555-0123',
      segment: 'SMB',
      status: 'Active',
      country: 'Canada',
    });
    expect(created).not.toBeNull();
    expect(useAppStore.getState().storageQuotaError).toBeTruthy();

    useAppStore.getState().dismissStorageError();
    expect(useAppStore.getState().storageQuotaError).toBeNull();

    setItemSpy.mockRestore();
  });

  it('11. syncs external storage changes into Zustand store state', () => {
    const snap = useAppStore.getState().getExportSnapshot();
    const modifiedSnap = {
      ...snap,
      settings: {
        ...snap.settings,
        workspaceName: 'Aurelix Cross-Tab Synced Corp',
      },
    };
    window.localStorage.setItem(STORAGE_KEYS.MAIN_STORE, JSON.stringify(modifiedSnap));
    useAppStore.getState().syncFromExternalStorage();
    expect(useAppStore.getState().settings.workspaceName).toBe('Aurelix Cross-Tab Synced Corp');
  });

  it('12. enforces complete Role Permission Matrix across Owner, Admin, Analyst, and Viewer', () => {
    const roles: TeamRole[] = ['Owner', 'Admin', 'Analyst', 'Viewer'];
    for (const row of PERMISSION_MATRIX) {
      for (const role of roles) {
        expect(canPerformAction(role, row.action)).toBe(row[role]);
      }
    }

    const store = useAppStore.getState();

    store.setActiveRolePreview('Viewer');
    const viewerCust = useAppStore.getState().addCustomer({
      name: 'Blocked',
      company: 'Blocked Co',
      email: 'blocked@co.io',
      phone: '555-0000',
      segment: 'SMB',
      status: 'Active',
      country: 'US',
    });
    expect(viewerCust).toBeNull();
    expect(
      useAppStore.getState().saveReportConfig({
        name: 'Blocked Template',
        type: 'Revenue Ledger',
        dateRangePreset: '30d',
        channelFilter: 'All',
        categoryFilter: 'All',
        paymentStatusFilter: 'All',
      })
    ).toBeNull();

    store.setActiveRolePreview('Analyst');
    const analystReport = useAppStore.getState().saveReportConfig({
      name: 'Analyst Audit',
      type: 'Revenue Ledger',
      dateRangePreset: '30d',
      channelFilter: 'All',
      categoryFilter: 'All',
      paymentStatusFilter: 'All',
    });
    expect(analystReport).not.toBeNull();
    expect(
      useAppStore.getState().addCustomer({
        name: 'Blocked Analyst',
        company: 'Blocked Analyst Co',
        email: 'blocked2@co.io',
        phone: '555-0000',
        segment: 'SMB',
        status: 'Active',
        country: 'US',
      })
    ).toBeNull();

    const paidOrd = useAppStore.getState().orders.find((o) => o.paymentStatus === 'Paid');
    expect(paidOrd).toBeTruthy();
    if (paidOrd) {
      useAppStore.getState().refundOrder(paidOrd.id, 10);
      const updated = useAppStore.getState().orders.find((o) => o.id === paidOrd.id);
      expect(updated?.paymentStatus).toBe('Refunded');
    }

    store.setActiveRolePreview('Admin');
    const custCountBefore = useAppStore.getState().customers.length;
    const adminCust = useAppStore.getState().addCustomer({
      name: 'Admin Allowed',
      company: 'Admin Allowed Co',
      email: 'admin@allowed.io',
      phone: '555-9999',
      segment: 'Enterprise',
      status: 'Active',
      country: 'UK',
    });
    expect(adminCust).not.toBeNull();
    useAppStore.getState().resetDemoData();
    expect(useAppStore.getState().customers.length).toBe(custCountBefore + 1);
  });
});
