import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAvatar } from '@/components/ui/primitives';

const claire = '/images/avatar_claire_vance_1794569123724.jpg';
const elena = '/images/avatar_elena_rostova_1794569124921.jpg';

describe('sized dashboard avatars', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('requests a sized image candidate for a bundled dashboard avatar', () => {
    act(() => root.render(<UserAvatar name="Claire Vance" src={claire} size="sm" />));
    const avatar = container.querySelector('img')!;
    expect(avatar.getAttribute('width')).toBe('28');
    expect(avatar.getAttribute('height')).toBe('28');
    expect(avatar.getAttribute('srcset')).toContain('/_next/image?');
  });

  it('tries the next persona image after an earlier source fails', () => {
    act(() => root.render(<UserAvatar name="Claire Vance" src={claire} />));
    act(() => container.querySelector('img')?.dispatchEvent(new Event('error')));
    expect(container.querySelector('img')).toBeNull();

    act(() => root.render(<UserAvatar name="Elena Rostova" src={elena} />));
    expect(container.querySelector('img')?.alt).toBe('Elena Rostova');
  });
});
