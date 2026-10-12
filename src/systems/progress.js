// Which regions are open, from the set of cleared regions (CLAUDE.md §2).
// Pure functions, so the gating rules can be unit-tested.

import { REGIONS } from '../data/regions.js';

/** The lowest tier that still has an uncleared region (all tiers below it are done). */
export function frontierTier(cleared) {
  const open = REGIONS.filter((r) => !cleared.has(r.id)).map((r) => r.tier);
  return open.length ? Math.min(...open) : Infinity;
}

/** 'cleared' | 'open' | 'locked' for one region. */
export function regionStatus(region, cleared) {
  if (cleared.has(region.id)) return 'cleared';
  return region.tier <= frontierTier(cleared) ? 'open' : 'locked';
}

/** Status of every region, as { id: status }. */
export function allStatuses(cleared) {
  return Object.fromEntries(REGIONS.map((r) => [r.id, regionStatus(r, cleared)]));
}

/** Regions that clearing `regionId` just opened. */
export function newlyOpened(cleared, regionId) {
  const before = new Set(cleared);
  before.delete(regionId);
  const was = allStatuses(before);
  const now = allStatuses(cleared);
  return REGIONS.filter((r) => was[r.id] === 'locked' && now[r.id] === 'open').map((r) => r.id);
}
