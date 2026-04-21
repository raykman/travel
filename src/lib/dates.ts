// Trip state logic: pre-trip / live / post-trip detection.
// All dates are interpreted in the site's notional "trip time" (UTC dates).

export const TRIP_START = new Date('2026-04-30T00:00:00Z');
export const TRIP_END = new Date('2026-07-18T23:59:59Z');
export const TRIP_LENGTH_DAYS = 80;

export type TripState = 'pre' | 'live' | 'post';

/**
 * Returns "now" for date calculations. Honors the TRIP_PREVIEW_DATE env var
 * (e.g. `TRIP_PREVIEW_DATE=2026-06-14 npm run dev`) so you can preview the
 * live-state or post-trip UI before the trip actually starts. Server-side
 * only — safe to ship, since env vars aren't exposed to the client.
 */
function now(): Date {
  const override = import.meta.env.TRIP_PREVIEW_DATE;
  if (override) {
    const d = new Date(override);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function getTripState(at: Date = now()): TripState {
  if (at < TRIP_START) return 'pre';
  if (at > TRIP_END) return 'post';
  return 'live';
}

/** 1-indexed day of the trip (1..62). Clamped to [1, TRIP_LENGTH_DAYS]. */
export function getCurrentDay(at: Date = now()): number {
  const ms = at.getTime() - TRIP_START.getTime();
  const day = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(TRIP_LENGTH_DAYS, day));
}

/**
 * Calendar days until trip start, inclusive of today and the departure day.
 * e.g. today = Apr 20, departure = Apr 30 → 11 days.
 * Normalises both dates to midnight UTC so time-of-day never affects the count.
 * Returns 0 once the trip has started.
 */
export function getDaysUntilStart(at: Date = now()): number {
  const todayMidnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const startMidnight = Date.UTC(
    TRIP_START.getUTCFullYear(),
    TRIP_START.getUTCMonth(),
    TRIP_START.getUTCDate(),
  );
  const wholeDays = Math.round((startMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
  if (wholeDays <= 0) return 0;
  return wholeDays + 1; // +1: counts both today and the departure day
}

/** Progress 0..1 through the trip. */
export function getTripProgress(at: Date = now()): number {
  const total = TRIP_END.getTime() - TRIP_START.getTime();
  const elapsed = at.getTime() - TRIP_START.getTime();
  return Math.max(0, Math.min(1, elapsed / total));
}
