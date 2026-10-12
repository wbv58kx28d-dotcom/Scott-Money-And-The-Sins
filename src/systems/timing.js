// Beat-timing math (CLAUDE.md §5.4). The on-screen bar is ui/timingBar.js.

import { TIMING } from '../data/rules.js';

/** Milliseconds for one end-to-end sweep at this move speed. */
export const sweepMs = (speed = 1) => TIMING.sweepMs / speed;

/**
 * Marker position in [0, 1] after `elapsedMs`, bouncing end to end.
 * The marker starts at the left end, or the right end if `fromRight`.
 */
export function markerPosition(elapsedMs, speed = 1, fromRight = false) {
  const phase = (elapsedMs / sweepMs(speed)) % 2;
  const pos = phase <= 1 ? phase : 2 - phase;
  return fromRight ? 1 - pos : pos;
}

// Absorbs float error so a tap exactly on a zone edge counts as inside it.
const EDGE_EPSILON = 1e-9;

/**
 * Rating for a tap at bar position `pos` (0..1, 0.5 is dead center).
 * Distance is measured against half the bar: 0 at center, 1 at either end.
 */
export function rateTiming(pos) {
  const distance = Math.abs(pos - 0.5) * 2;
  return TIMING.ratings.find((r) => distance <= r.within + EDGE_EPSILON);
}

export const ratingById = (id) => TIMING.ratings.find((r) => r.id === id);
