import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from '@/app/dashboard/reports/page';
import { useAppStore } from '@/stores/useAppStore';
import type { AurelixStorageSchema, OrderLineItem } from '@/types';

const getState = useAppStore.getState;

describe('historical Product Velocity', () => {
  let container: HTMLDivElement;
  let root: Root;
  let workspace: AurelixStorageSchema;

  beforeEach(() => {
    localStorage.clear();
    getState().hydrateStore();
    const baseline = getState().getExportSnapshot();
    workspace = {
      ...baseline,
      products: [
        { ...baseline.products[0], category: 'Enterprise Software', unitPrice: 19.99, stockLevel: 10, status: 'Active' },
        { ...baseline.products[1], category: 'Cloud Infrastructure', unitPrice: 8.15, stockLevel: 10, status: 'Active' },
      ],
      orders: [],
    };
    expect(getState().importBackupJson(JSON.stringify(workspace)).ok).toBe(true);
    expect(getState().createOrder({
      customerId: workspace.customers[0].id,
      salesChannel: 'Direct Enterprise',
      paymentStatus: 'Paid',
      fulfillmentStatus: 'Fulfilled',
      discountAmount: 0,
      taxRatePercent: 0,
      items: [
        { productId: workspace.products[0].id, quantity: 2 },
        { productId: workspace.products[1].id, quantity: 3 },
      ],
    })).toBeTruthy();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function select(id: string, value: string) {
    const control = container.querySelector<HTMLSelectElement>(id)!;
    act(() => {
      control.value = value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  const historicCells = (scope: HTMLElement) => [...scope.querySelectorAll('table:first-of-type tbody tr')][0]
    ?.querySelectorAll('td');

  it('keeps the original category and amount after a catalog edit in a mixed-category invoice', () => {
    act(() => root.render(<ReportsPage />));
    select('#report-date-range', 'all');
    select('#report-model', 'Product Velocity');
    select('#report-product-category', 'Enterprise Software');
    const before = [...(historicCells(container) ?? [])].map((cell) => cell.textContent);
    expect(before).toContain('$39.98');
    expect(before).toContain(workspace.products[0].sku);

    const originalLine = getState().orders[0].lineItems[0];
    const current = getState().products[0];
    act(() => getState().updateProduct(current.id, { ...current, category: 'Cloud Infrastructure', unitPrice: 100 }));
    expect(getState().products[0].category).toBe('Cloud Infrastructure');
    expect(getState().orders[0].lineItems[0]).toEqual(originalLine);

    const after = [...(historicCells(container) ?? [])].map((cell) => cell.textContent);
    expect(after).toEqual(before);
    select('#report-product-category', 'Cloud Infrastructure');
    const cloud = [...(historicCells(container) ?? [])].map((cell) => cell.textContent);
    expect(cloud).toContain(workspace.products[1].sku);
    expect(cloud).toContain('$24.45');
    expect(cloud).not.toContain(workspace.products[0].sku);
  });

  it('counts legacy lines with a missing category explicitly without using the current catalog category', () => {
    const legacy = structuredClone(getState().getExportSnapshot());
    const line: Partial<OrderLineItem> = legacy.orders[0].lineItems[0];
    delete line.category;
    expect(getState().importBackupJson(JSON.stringify(legacy)).ok).toBe(true);
    act(() => root.render(<ReportsPage />));
    select('#report-date-range', 'all');
    select('#report-model', 'Product Velocity');
    expect(container.querySelector('table')?.textContent).toContain('Unclassified');
    expect(container.querySelector('table')?.textContent).toContain('$39.98');
  });
});
