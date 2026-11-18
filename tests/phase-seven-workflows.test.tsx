import React, { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '@/app/page';
import SettingsPage from '@/app/dashboard/settings/page';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { STORAGE_KEYS } from '@/lib/storage/repository';
import { useAppStore } from '@/stores/useAppStore';
import { installNativeDialogStub } from './native-dialog';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('Phase 7 demo workflows', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreDialog: () => void;

  beforeAll(() => { restoreDialog = installNativeDialogStub(); });
  afterAll(() => restoreDialog());

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    push.mockReset();
    localStorage.clear();
    useAppStore.getState().hydrateStore();
    useAppStore.setState({ commandPaletteOpen: false, toasts: [] });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function find<T extends HTMLElement>(selector: string) {
    const control = container.querySelector<T>(selector);
    if (!control) throw new Error(`Missing control ${selector}`);
    return control;
  }

  function button(label: string): HTMLButtonElement {
    const control = [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === label);
    if (!control) throw new Error(`Missing button ${label}`);
    return control;
  }

  function queryPalette(value: string): HTMLInputElement {
    act(() => useAppStore.getState().setCommandPaletteOpen(true));
    act(() => root.render(<CommandPalette triggerRef={createRef<HTMLButtonElement>()} />));
    const input = find<HTMLInputElement>('input[aria-label="Search workspace"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setValue.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return input;
  }

  async function pressEnter(input: HTMLInputElement) {
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
  }

  it('keeps an unmatched Command Palette query open without writing or running an unrelated action', async () => {
    const original = localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
    const theme = useAppStore.getState().settings.theme;
    const input = queryPalette('unmatched-phase-seven-3827');
    await pressEnter(input);

    expect(useAppStore.getState().commandPaletteOpen).toBe(true);
    expect(useAppStore.getState().settings.theme).toBe(theme);
    expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)).toBe(original);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('No matching results');
    expect(push).not.toHaveBeenCalled();
  });

  it('runs the explicitly matched theme command through the same keyboard path', async () => {
    const theme = useAppStore.getState().settings.theme;
    const input = queryPalette('theme');
    await pressEnter(input);

    expect(useAppStore.getState().commandPaletteOpen).toBe(false);
    expect(useAppStore.getState().settings.theme).not.toBe(theme);
  });

  it('skips a disabled backup command when entering a matching query as Viewer', async () => {
    useAppStore.getState().setActiveRolePreview('Viewer');
    useAppStore.setState({ toasts: [] });
    const original = localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
    const input = queryPalette('export full workspace json backup');
    expect(button('Export Full Workspace JSON BackupJSON').disabled).toBe(true);
    await pressEnter(input);

    expect(useAppStore.getState().commandPaletteOpen).toBe(true);
    expect(useAppStore.getState().toasts).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)).toBe(original);
  });

  it('enters an Analyst persona with identity and role persisted together in one write', async () => {
    const persona = useAppStore.getState().team.find((member) => member.role === 'Analyst')!;
    const write = vi.spyOn(Storage.prototype, 'setItem');
    act(() => root.render(<LandingPage />));

    await act(async () => button('Enter as Analyst').click());

    const fields = {
      activeRolePreview: 'Analyst',
      personalName: persona.name,
      personalEmail: persona.email,
      personalTitle: persona.title,
    };
    expect(useAppStore.getState().settings).toMatchObject(fields);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)!);
    expect(stored.settings).toMatchObject(fields);
    expect(write.mock.calls.filter(([key]) => key === STORAGE_KEYS.MAIN_STORE)).toHaveLength(1);
    expect(useAppStore.getState().toasts.some((toast) => toast.title === 'Permission denied')).toBe(false);
    expect(push).toHaveBeenCalledExactlyOnceWith('/dashboard');
    act(() => {
      expect(useAppStore.getState().updateSettings({ workspaceName: 'Restricted edit' }).ok).toBe(false);
    });
  });

  it('does not switch persona or navigate after a failed persistence attempt', async () => {
    const settings = useAppStore.getState().settings;
    const stored = localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    act(() => root.render(<LandingPage />));

    await act(async () => button('Enter as Analyst').click());

    expect(useAppStore.getState().settings).toEqual(settings);
    expect(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)).toBe(stored);
    expect(useAppStore.getState().storageQuotaError).toMatch(/quota/i);
    expect(push).not.toHaveBeenCalled();
  });

  it('discloses the English interface while retaining legacy language metadata on a preference save', async () => {
    useAppStore.getState().updateSettings({ language: 'Français' });
    act(() => root.render(<SettingsPage />));
    expect(container.textContent).toContain('Interface Language');
    expect(container.textContent).toContain('The workspace interface is available in English.');
    expect(container.querySelector('#settings-display-language')).toBeNull();

    const numberFormat = find<HTMLSelectElement>('#settings-number-locale');
    act(() => {
      numberFormat.value = 'de-DE';
      numberFormat.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => button('Save All Workspace Preferences').click());

    const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.MAIN_STORE)!).settings;
    expect(settings).toMatchObject({ language: 'Français', numberFormat: 'de-DE' });
  });
});
