import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrdersPage from '@/app/dashboard/orders/page';
import { STORAGE_KEYS } from '@/lib/storage/repository';
import { useAppStore } from '@/stores/useAppStore';
import { installNativeDialogStub } from './native-dialog';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const getState = useAppStore.getState;

beforeEach(() => {
  localStorage.clear();
  getState().hydrateStore();
});
afterEach(() => vi.unstubAllGlobals());

describe('orderable products', () => {
  it('rejects an archived SKU in a multi-line order without committing anything', () => {
    const workspace = getState();
    const active = workspace.products.find((product) => product.status === 'Active')!;
    const archived = workspace.products.find((product) => product.status === 'Archived')!;
    const validItem = { productId: active.id, quantity: 2 };
    const draft = {
      customerId: workspace.customers[0].id,
      salesChannel: 'Direct Enterprise' as const,
      paymentStatus: 'Paid' as const,
      fulfillmentStatus: 'Scheduled' as const,
      discountAmount: 0,
      taxRatePercent: 0,
    };
    const originalRaw = localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
    const created = workspace.createOrder({
      ...draft,
      items: [validItem, { productId: archived.id, quantity: 1 }],
    });

    expect(created?.orderNumber ?? null).toBeNull();
    expect(getState().products === workspace.products).toBe(true);
    expect(getState().orders === workspace.orders).toBe(true);
    expect(getState().activities === workspace.activities).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE) === originalRaw).toBe(true);

    expect(workspace.createOrder({ ...draft, items: [validItem] })).toBeTruthy();
    expect(getState().orders.slice(1)).toEqual(workspace.orders);
  });

  it('excludes archived products from the create-order selector and the default selection', () => {
    const restoreDialog = installNativeDialogStub();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const snapshot = getState().getExportSnapshot();
    snapshot.products = snapshot.products.map((product, index) =>
      index === 0 ? { ...product, status: 'Archived' } : product
    );
    expect(getState().importBackupJson(JSON.stringify(snapshot)).ok).toBe(true);
    window.history.replaceState(null, '', '/dashboard/orders?action=new');
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<OrdersPage />));
      const product = container.querySelector<HTMLSelectElement>('select[aria-label="Product for line item 1"]')!;
      expect(product.value).toBe(snapshot.products.find((item) => item.status !== 'Archived')!.id);
      const values = [...product.options].map((option) => option.value);
      expect(values.includes(snapshot.products[0].id)).toBe(false);
    } finally {
      act(() => root.unmount());
      container.remove();
      restoreDialog();
    }
  });
});
