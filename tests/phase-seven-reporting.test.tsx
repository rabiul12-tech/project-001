import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrdersPage from '@/app/dashboard/orders/page';
import ReportsPage from '@/app/dashboard/reports/page';
import { TrendIndicator } from '@/components/ui/primitives';
import { calculateExecutiveComparison, calculatePercentChange, resolveDateWindow, toCents } from '@/lib/calculations/analytics';
import * as exporter from '@/lib/export/exporter';
import { useAppStore } from '@/stores/useAppStore';
import type { Order } from '@/types';
import { installNativeDialogStub } from './native-dialog';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const getState = useAppStore.getState;

describe('Phase 7 report correctness', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreDialog: () => void;

  beforeEach(() => {
    localStorage.clear();
    getState().hydrateStore();
    window.history.replaceState(null, '', '/dashboard');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    restoreDialog = installNativeDialogStub();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    restoreDialog();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const find = <T extends HTMLElement>(selector: string) => {
    const element = container.querySelector<T>(selector);
    if (!element) throw new Error(`Could not find ${selector}`);
    return element;
  };

  const button = (name: string, scope: ParentNode = container) => {
    const element = [...scope.querySelectorAll('button')].find(
      (item) => item.textContent?.trim().startsWith(name)
    );
    if (!element) throw new Error(`Could not find button ${name}`);
    return element;
  };

  it('explicitly marks Orders as all-time and announces the active sort column', () => {
    act(() => root.render(<OrdersPage />));
    expect(container.textContent).toMatch(/all-time/i);
    expect(find('thead th[aria-sort="descending"]').textContent).toContain('Order Date');
    act(() => button('Order Total').click());
    expect(container.querySelectorAll('thead th[aria-sort]')).toHaveLength(1);
    expect(find('thead th[aria-sort="descending"]').textContent).toContain('Order Total');
    act(() => button('Order Total').click());
    expect(find('thead th[aria-sort="ascending"]').textContent).toContain('Order Total');
  });

  it('compares only fulfilled, settled orders in the Completed Orders KPI', () => {
    const template = getState().orders[0];
    const currentOrder = (paymentStatus: Order['paymentStatus'], fulfillmentStatus: Order['fulfillmentStatus'], id: string): Order => ({
      ...template,
      id,
      orderDate: '2026-07-14T09:00:00Z',
      paymentStatus,
      fulfillmentStatus,
    });
    const rows = [
      currentOrder('Pending', 'Fulfilled', 'pending'),
      currentOrder('Failed', 'Fulfilled', 'failed'),
      currentOrder('Paid', 'Processing', 'processing'),
      currentOrder('Paid', 'Fulfilled', 'completed'),
      currentOrder('Refunded', 'Fulfilled', 'refunded'),
      currentOrder('Paid', 'Canceled', 'canceled'),
      { ...currentOrder('Paid', 'Fulfilled', 'prior'), orderDate: '2026-07-09T09:00:00Z' },
    ];
    const report = calculateExecutiveComparison(rows, [], resolveDateWindow('7d', undefined, undefined, '2026-07-17T12:00:00Z'));
    expect(report.current.totalOrdersCount).toBe(6);
    expect(report.current).toMatchObject({ completedOrdersCount: 2 });
    expect(report.previous).toMatchObject({ completedOrdersCount: 1 });
    expect(report.deltas).toMatchObject({ completedOrders: 100 });
  });

  it('renders a New trend with a nonzero current value and a zero prior period', () => {
    const delta = calculatePercentChange(27, 0);
    expect(delta).toBeNull();
    expect(calculatePercentChange(0, 0)).toBe(0);
    expect(calculatePercentChange(0, 7)).toBe(-100);
    act(() => root.render(<TrendIndicator value={delta} />));
    expect(container.textContent).toContain('New');
    expect(container.textContent).not.toContain('100');
  });

  it('records the same row count and reconciled amount as the printable preview', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    act(() => root.render(<ReportsPage />));
    const rows = [...find('table').querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(25);
    const amount = rows.reduce((sum, row) => {
      const currency = row.lastElementChild?.textContent?.replace(/[^\d.-]/g, '') ?? '';
      return sum + toCents(Number(currency));
    }, 0);
    await act(async () => button('Print').click());
    expect(window.print).toHaveBeenCalledOnce();
    expect(getState().reportHistory[0]).toMatchObject({ format: 'Print', rowCount: rows.length, totalRevenueReported: amount / 100 });
  });

  it('retains the historical Product Velocity CSV headers and exports all matching rows', async () => {
    const download = vi.spyOn(exporter, 'triggerBrowserDownload').mockImplementation(() => {});
    act(() => root.render(<ReportsPage />));
    const model = find<HTMLSelectElement>('#report-model');
    act(() => {
      model.value = 'Product Velocity';
      model.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const scope = find('table');
    const previewRows = scope.querySelectorAll('tbody tr').length;
    await act(async () => button('Download CSV').click());
    expect(download).toHaveBeenCalledOnce();
    const [header, ...rows] = download.mock.calls[0][0].trimEnd().split(/\r?\n/);
    expect(header).toBe('SKU,Product Name,Recorded Category,Average Recorded Unit Price,Units Sold in Window,Order Appearances,Gross Line-Item Revenue,Current Available Stock');
    expect(rows.length).toBeGreaterThan(previewRows);
    expect(getState().reportHistory[0]).toMatchObject({ format: 'CSV', type: 'Product Velocity', rowCount: rows.length });
  });

  it('blocks invalid custom dates, links the error to both fields and recovers on correction', () => {
    act(() => root.render(<ReportsPage />));
    const range = find<HTMLSelectElement>('#report-date-range');
    act(() => {
      range.value = 'custom';
      range.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const start = find<HTMLInputElement>('#report-start-date');
    const end = find<HTMLInputElement>('#report-end-date');
    const setDate = (input: HTMLInputElement, value: string) => act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    setDate(start, '2026-11-18');
    setDate(end, '2025-11-17');
    const message = find('[role="alert"]');
    expect(message.textContent).toContain('Start date cannot be after end date.');
    expect(start.getAttribute('aria-describedby')).toBe(message.id);
    expect(end.getAttribute('aria-describedby')).toBe(message.id);
    expect(start.getAttribute('aria-invalid')).toBe('true');
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect(button('Print').disabled).toBe(true);
    expect(button('Download CSV').disabled).toBe(true);
    expect(button('Save Configuration').disabled).toBe(true);
    setDate(end, '2026-11-19');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(button('Download CSV').disabled).toBe(false);
  });

  it('keeps the saved template until the destructive dialog is confirmed', async () => {
    act(() => root.render(<ReportsPage />));
    const id = getState().savedReports[0].id;
    const trigger = find<HTMLButtonElement>('button[aria-label^="Delete template"]');
    await act(async () => trigger.click());
    expect(getState().savedReports.some((template) => template.id === id)).toBe(true);
    await act(async () => button('Cancel', find('dialog')).click());
    expect(getState().savedReports.some((template) => template.id === id)).toBe(true);
    await act(async () => trigger.click());
    await act(async () => button('Delete Template', find('dialog')).click());
    expect(getState().savedReports.some((template) => template.id === id)).toBe(false);
  });
});
