'use client';

import { useSyncExternalStore } from 'react';
import {
  formatLongDate,
  frozenNowMs,
  isClockLive,
  MINUTE_MS,
  nowMs,
  subscribeClock,
} from '@/lib/clock';

const ceilToMinute = (ms: number) => Math.ceil(ms / MINUTE_MS) * MINUTE_MS;

/** Now, rounded up to the minute: a stable snapshot that never precedes a just-created record. */
export function useNowMs(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => ceilToMinute(nowMs()),
    () => ceilToMinute(frozenNowMs())
  );
}

/** Today's long date for page headers (visitor's time zone once the clock is live). */
export function useTodayLabel(): string {
  return useSyncExternalStore(
    subscribeClock,
    () => formatLongDate(nowMs(), !isClockLive()),
    () => formatLongDate(frozenNowMs(), true)
  );
}
