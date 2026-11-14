/**
 * The single clock for the app: seed generation, analytics windows, records
 * created at runtime (activity, orders, ...) and the header date all read it.
 *
 * Statically prerendered HTML cannot know the visitor's "now", so until the
 * store hydrates (goLive) the clock is frozen at the build time. Server render
 * and first client render therefore agree; goLive() then switches to real time.
 * Without a build time (unit tests) the clock is live from the start.
 */
const BUILD_TIME_MS = Date.parse(process.env.NEXT_PUBLIC_BUILD_TIME ?? '');
const FROZEN_MS = Number.isFinite(BUILD_TIME_MS) ? BUILD_TIME_MS : Date.now();

let live = !Number.isFinite(BUILD_TIME_MS);
const listeners = new Set<() => void>();

export const DAY_MS = 86_400_000;
export const MINUTE_MS = 60_000;

export function nowMs(): number {
  return live ? Date.now() : FROZEN_MS;
}

export function nowIso(): string {
  return new Date(nowMs()).toISOString();
}

export function isClockLive(): boolean {
  return live;
}

/** Value the clock has on the server and during the first client render. */
export function frozenNowMs(): number {
  return FROZEN_MS;
}

export function goLive(): void {
  if (live) return;
  live = true;
  listeners.forEach((notify) => notify());
}

/** Notifies on goLive() and once a minute, so "today" rolls over in a long-lived tab. */
export function subscribeClock(notify: () => void): () => void {
  listeners.add(notify);
  const timer = setInterval(notify, MINUTE_MS);
  return () => {
    listeners.delete(notify);
    clearInterval(timer);
  };
}

export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Default custom range: the 30 days ending today. */
export function defaultCustomRange(ms: number = nowMs()): { start: string; end: string } {
  return { start: isoDay(ms - 30 * DAY_MS), end: isoDay(ms) };
}

/** "Saturday, November 14, 2026". UTC only while frozen, so server and client agree. */
export function formatLongDate(ms: number, utc: boolean): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: utc ? 'UTC' : undefined,
  }).format(ms);
}
