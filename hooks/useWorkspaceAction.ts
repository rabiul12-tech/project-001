'use client';

import { useCallback } from 'react';
import { runWorkspaceTransaction } from '@/lib/storage/repository';
import { useAppStore } from '@/stores/useAppStore';

export function useWorkspaceAction<Args extends unknown[], Result>(
  selector: (state: ReturnType<typeof useAppStore.getState>) => (...args: Args) => Result
) {
  const action = useAppStore(selector);
  return useCallback((...args: Args) => runWorkspaceTransaction(() => {
    const workspace = useAppStore.getState();
    if (!workspace.isHydrated) workspace.hydrateStore();
    return action(...args);
  }), [action]);
}
