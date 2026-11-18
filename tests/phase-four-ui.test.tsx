import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import CustomersPage from '@/app/dashboard/customers/page';
import ProductsPage from '@/app/dashboard/products/page';
import { DetailDrawer, ModalDialog } from '@/components/ui/overlays';
import { useAppStore } from '@/stores/useAppStore';
import { installNativeDialogStub } from './native-dialog';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function MinimalOrderForm() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  return (
    <>
      <button id="open-form" onClick={() => setOpen(true)}>Open form</button>
      <ModalDialog open={open} onClose={() => setOpen(false)} title="Order form">
        <input aria-label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </ModalDialog>
    </>
  );
}

function OrderDrawerFlow() {
  const [drawer, setDrawer] = useState(false);
  const [refund, setRefund] = useState(false);
  return (
    <>
      <button id="open-details" onClick={() => setDrawer(true)}>Open details</button>
      <ModalDialog open={refund} onClose={() => setRefund(false)} title="Refund confirmation">
        <button onClick={() => setRefund(false)}>Confirm refund</button>
      </ModalDialog>
      <DetailDrawer open={drawer} onClose={() => setDrawer(false)} title="Order details">
        <button id="open-refund" onClick={() => setRefund(true)}>Open refund</button>
      </DetailDrawer>
    </>
  );
}

describe('dialog and deep-link regressions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreDialog: () => void;

  beforeAll(() => { restoreDialog = installNativeDialogStub(); });
  afterAll(() => restoreDialog());

  function find<T extends HTMLElement>(selector: string) {
    const element = container.querySelector<T>(selector);
    if (!element) throw new Error(`Could not find ${selector}`);
    return element;
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    window.history.replaceState(null, '', '/dashboard');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('keeps focus on a controlled amount input as the dialog re-renders', () => {
    act(() => root.render(<MinimalOrderForm />));
    act(() => find('#open-form').click());
    const input = find<HTMLInputElement>('input[aria-label="Amount"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    input.focus();
    for (const amount of ['1', '12']) {
      act(() => {
        setValue.call(input, amount);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(document.activeElement === input).toBe(true);
      expect(input.value).toBe(amount);
    }
  });

  it('dismisses only the top order confirmation and restores the drawer trigger', async () => {
    act(() => root.render(<OrderDrawerFlow />));
    const opener = find('#open-details');
    opener.focus();
    act(() => opener.click());
    const trigger = find('#open-refund');
    trigger.focus();
    act(() => trigger.click());
    const refund = find('[aria-label="Refund confirmation"]');
    expect(refund.tagName).toBe('DIALOG');
    await act(async () => { refund.dispatchEvent(new Event('cancel', { cancelable: true })); });
    expect(container.querySelector('[aria-label="Refund confirmation"]')).toBeNull();
    expect(find('[aria-label="Order details"]')).toBeTruthy();
    expect(document.activeElement === trigger).toBe(true);
  });

  it.each(['customers', 'products'] as const)('tracks repeated same-route search navigation on %s', (route) => {
    const { customers, products } = useAppStore.getState();
    const names = route === 'customers'
      ? [customers[0].company, customers[1].company]
      : [products[0].name, products[1].name];
    const queries = route === 'customers' ? names : [products[0].sku, products[1].sku];
    const Page = route === 'customers' ? CustomersPage : ProductsPage;
    const navigate = (query: string) => window.history.pushState(null, '', `/dashboard/${route}?search=${encodeURIComponent(query)}`);
    const findRecord = (name: string) => [...container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === `View ${name}`
    );
    navigate(queries[0]);
    act(() => root.render(<Page />));
    const search = find<HTMLInputElement>('input[placeholder^="Search "]');
    expect(search.value).toBe(queries[0]);
    expect(Boolean(findRecord(names[0]))).toBe(true);
    for (const i of [1, 0, 1]) {
      navigate(queries[i]);
      act(() => root.render(<Page />));
      expect(find('input[placeholder^="Search "]') === search).toBe(true);
      expect(search.value).toBe(queries[i]);
      expect(Boolean(findRecord(names[i]))).toBe(true);
      expect(findRecord(names[1 - i])).toBeUndefined();
    }
  });
});
