import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import OrdersPage from '@/app/dashboard/orders/page';
import ReportsPage from '@/app/dashboard/reports/page';
import SettingsPage from '@/app/dashboard/settings/page';
import { useAppStore } from '@/stores/useAppStore';
import { installNativeDialogStub } from './native-dialog';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const ordersPath = '/dashboard/orders';

function find<T extends HTMLElement>(scope: HTMLElement, selector: string): T {
  const element = scope.querySelector<T>(selector);
  if (!element) throw new Error(`Could not find ${selector}`);
  return element;
}

function expectVisibleLabels(scope: HTMLElement, labels: string[]) {
  const visibleLabels = [...scope.querySelectorAll('label')];
  const ids = labels.map((name) => {
    const label = visibleLabels.find((element) => element.textContent?.trim() === name);
    expect(label?.control, `Control for ${name}`).toBeTruthy();
    expect(label?.control?.id).toBeTruthy();
    return label?.control?.id;
  });
  expect(new Set(ids).size).toBe(ids.length);
}

function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('Phase 1 UI regressions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreDialog: () => void;

  beforeAll(() => { restoreDialog = installNativeDialogStub(); });
  afterAll(() => restoreDialog());

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    window.history.replaceState(null, '', ordersPath);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('applies search parameter changes without remounting and retains the ledger controls', () => {
    const paidOrders = useAppStore.getState().orders.filter((order) => order.paymentStatus === 'Paid');
    const firstOrder = paidOrders[0].orderNumber;
    const nextOrder = paidOrders[1].orderNumber;
    window.history.replaceState(null, '', `${ordersPath}?search=${firstOrder}`);
    act(() => root.render(<OrdersPage />));
    const search = find<HTMLInputElement>(container, 'input[aria-label="Search orders"]');
    const selectedOrders = () =>
      [...container.querySelectorAll('tbody input[aria-label^="Select order "]')]
        .map((checkbox) => checkbox.getAttribute('aria-label')?.replace('Select order ', ''));

    expect(search.value).toBe(firstOrder);
    expect(selectedOrders()).toEqual([firstOrder]);

    const payment = find<HTMLSelectElement>(container, 'select[aria-label="Filter by payment status"]');
    const pageSize = find<HTMLSelectElement>(container, 'select[aria-label="Rows per page"]');
    choose(payment, 'Paid');
    choose(pageSize, '20');
    const orderSort = find<HTMLButtonElement>(container, 'thead th:nth-child(2) button');
    act(() => orderSort.click());
    const navigate = (path: string) => {
      window.history.pushState(null, '', path);
      act(() => root.render(<OrdersPage />));
    };

    navigate(`${ordersPath}?search=${nextOrder}`);
    expect(container.querySelector('input[aria-label="Search orders"]')).toBe(search);
    expect(search.value).toBe(nextOrder);
    expect(selectedOrders()).toEqual([nextOrder]);

    navigate(ordersPath);
    expect(search.value).toBe('');
    expect(payment.value).toBe('Paid');
    expect(pageSize.value).toBe('20');
    const sortedPaidOrders = paidOrders.map((order) => order.orderNumber).sort((a, b) => b.localeCompare(a));
    expect(selectedOrders()).toEqual(sortedPaidOrders.slice(0, 20));
    const nextPage = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Next');
    expect(nextPage).toBeTruthy();
    act(() => nextPage?.click());
    expect(selectedOrders()).toEqual(sortedPaidOrders.slice(20, 40));
  });

  it('exposes labels for the order form and keeps remaining line-item IDs when a row is removed', () => {
    window.history.replaceState(null, '', `${ordersPath}?action=new`);
    act(() => root.render(<OrdersPage />));
    const dialog = find(container, 'dialog[aria-label="Create Commercial Order"]');
    expectVisibleLabels(dialog, [
      'Customer Account', 'Sales Channel', 'Payment Status', 'Fulfillment', 'Discount ($)', 'Tax Rate (%)',
    ]);

    const items = find(dialog, '[role="group"]');
    expect(items.querySelector('select[aria-label="Product for line item 1"]')).toBeTruthy();
    expect(items.querySelector('input[aria-label="Quantity for line item 1"]')).toBeTruthy();
    const addItem = find<HTMLButtonElement>(items, 'button');
    expect(addItem.textContent?.trim()).toBe('+ Add Line Item');
    act(() => addItem.click());
    const product = find(items, 'select[aria-label="Product for line item 2"]');
    const quantity = find(items, 'input[aria-label="Quantity for line item 2"]');
    const ids = [product.id, quantity.id];
    expect(new Set(ids).size).toBe(2);
    const removeItem = find<HTMLButtonElement>(items, 'button[aria-label="Remove line item 1"]');
    act(() => removeItem.click());
    expect(find(items, 'select[aria-label="Product for line item 1"]').id).toBe(ids[0]);
    expect(find(items, 'input[aria-label="Quantity for line item 1"]').id).toBe(ids[1]);
  });

  it('associates visible report configuration labels with their controls', () => {
    act(() => root.render(<ReportsPage />));
    expectVisibleLabels(container, [
      'Report Title', 'Report Model', 'Date Range', 'Sales Channel', 'Product Category', 'Payment Status',
    ]);
  });

  it('associates profile, workspace, formatting and sidebar labels with their controls', () => {
    act(() => root.render(<SettingsPage />));
    expectVisibleLabels(container, [
      'Full Name', 'Corporate Email', 'Executive Title', 'Workspace Name', 'Company Domain',
      'Company Logo Monogram', 'Display Currency', 'Date Format',
      'Number Formatting Locale', 'Compact Icon-Only Sidebar',
    ]);
  });
});
