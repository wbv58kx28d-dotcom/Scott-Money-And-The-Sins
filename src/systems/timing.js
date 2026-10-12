// Beat-timing math (CLAUDE.md §5.4). The on-screen bar is ui/timingBar.js.

import { TIMING } from '../data/rules.js';

/** Milliseconds for one full left-to-right sweep at this move speed. */
export const sweepMs = (speed = 1) => TIMING.sweepMs / speed;

/** Marker position in [0, 1] after `elapsedMs`, bouncing end to end. */
export function markerPosition(elapsedMs, speed = 1) {
  const phase = (elapsedMs / sweepMs(speed)) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

// Absorbs float error so a tap exactly on a zone edge counts as inside it.
const EDGE_EPSILON = 1e-9;

/** Rating for a tap at bar position `pos` (0..1, 0.5 is dead center). */
export function rateTiming(pos) {
  const distance = Math.abs(pos - 0.5);
  return TIMING.ratings.find((r) => distance <= r.within + EDGE_EPSILON);
}

export const ratingById = (id) => TIMING.ratings.find((r) => r.id === id);
