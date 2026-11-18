import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityPage from '@/app/dashboard/activity/page';
import CustomersPage from '@/app/dashboard/customers/page';
import ProductsPage from '@/app/dashboard/products/page';
import TeamPage from '@/app/dashboard/team/page';
import { STORAGE_KEYS } from '@/lib/storage/repository';
import { productFormSchema, productSchema } from '@/lib/validation/schemas';
import { useAppStore } from '@/stores/useAppStore';
import { installNativeDialogStub } from './native-dialog';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

describe('Phase 7 catalog and accessibility regressions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreDialog: () => void;

  beforeAll(() => { restoreDialog = installNativeDialogStub(); });
  afterAll(() => restoreDialog());

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.clear();
    useAppStore.getState().hydrateStore();
    window.history.replaceState(null, '', '/dashboard');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function button(text: string) {
    const element = [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === text);
    if (!element) throw new Error(`Could not find button ${text}`);
    return element;
  }

  function openForm(Page: React.ComponentType, trigger: string) {
    act(() => root.render(<Page />));
    act(() => button(trigger).click());
    const dialog = container.querySelector<HTMLDialogElement>('dialog[open]');
    if (!dialog) throw new Error(`Expected a form after clicking ${trigger}`);
    return dialog;
  }

  it.each([
    { name: 'Customers', Page: CustomersPage, trigger: 'Add Customer', count: 8 },
    { name: 'Products', Page: ProductsPage, trigger: 'Create Product', count: 8 },
    { name: 'Team', Page: TeamPage, trigger: 'Add Demo Member', count: 5 },
  ])('associates all visible labels in the $name form', ({ Page, trigger, count }) => {
    const dialog = openForm(Page, trigger);
    const labels = [...dialog.querySelectorAll('label')];
    expect(labels).toHaveLength(count);
    const controlIds = labels.map((label) => {
      expect(label.control, label.textContent?.trim()).toBeTruthy();
      return label.control?.id;
    });
    expect(new Set(controlIds).size).toBe(count);
  });

  it('uses native product grid actions and exposes the selected view', () => {
    act(() => root.render(<ProductsPage />));
    const table = button('Table');
    const grid = button('Grid');
    expect(table.getAttribute('aria-pressed')).toBe('true');
    act(() => grid.click());
    expect(table.getAttribute('aria-pressed')).toBe('false');
    expect(grid.getAttribute('aria-pressed')).toBe('true');

    const cardAction = container.querySelector<HTMLButtonElement>('h3 button[aria-label^="View "]');
    expect(cardAction?.tabIndex).toBe(0);
    act(() => cardAction?.click());
    expect(container.querySelector('dialog[open]')?.getAttribute('aria-label')).toBe(cardAction?.textContent?.trim());
  });

  it.each([
    { name: 'Customers', Page: CustomersPage, initial: 'Lifetime Spend', next: 'Customer / Company' },
    { name: 'Products', Page: ProductsPage, initial: 'Gross Revenue', next: 'Unit Price' },
  ])('exposes the active $name sort and moves it when a different column is sorted', ({ Page, initial, next }) => {
    act(() => root.render(<Page />));
    expect(button(initial).closest('th')?.getAttribute('aria-sort')).toBe('descending');
    act(() => button(next).click());
    const header = button(next).closest('th');
    expect(container.querySelectorAll('th[aria-sort]')).toHaveLength(1);
    expect(header?.getAttribute('aria-sort')).toBe('descending');
    act(() => button(next).click());
    expect(header?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('has a single named Activity details action per event', () => {
    act(() => root.render(<ActivityPage />));
    expect(container.querySelector('[role="button"] button')).toBeNull();
    const detailButton = container.querySelector<HTMLButtonElement>('button[aria-label^="Details for "]');
    expect(detailButton?.tabIndex).toBe(0);
    act(() => detailButton?.click());
    expect(container.querySelector('dialog[open]')).toBeTruthy();
  });

  it('accepts exact cents for both pricing fields and rejects fractional cents', () => {
    const dialog = openForm(ProductsPage, 'Create Product');
    for (const [name, amount] of [['unitPrice', '19.99'], ['costPrice', '8.15']]) {
      const input = dialog.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = amount;
      expect(input.validity.stepMismatch).toBe(false);
      input.value = '10.005';
      expect(input.validity.stepMismatch).toBe(true);
    }
  });

  it('enforces cents on product writes while retaining the legacy backup schema', () => {
    const { products, addProduct, updateProduct } = useAppStore.getState();
    const sample = { ...products[0], unitPrice: 19.99, costPrice: 8.15 };
    expect(productFormSchema.safeParse(sample).success).toBe(true);
    const fractional = { ...sample, unitPrice: 19.999, costPrice: 8.155 };
    expect(productFormSchema.safeParse(fractional).success).toBe(false);
    expect(productSchema.safeParse(fractional).success).toBe(true);

    const persisted = localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
    expect(addProduct(fractional)).toBeNull();
    updateProduct(products[0].id, fractional);
    expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE) === persisted).toBe(true);

    const created = addProduct(sample);
    expect(created?.unitPrice).toBe(19.99);
    expect(created?.costPrice).toBe(8.15);
  });
});
