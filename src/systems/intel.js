// Scouting intel: what $cott has learned about a villain before the fight.
//
// Minor characters in a region (src/data/maps/<region>.js) can hold a
// `challenge`; winning it reveals part of a villain's weak / resist / soft-spot
// data (CLAUDE.md §5.3). It's saved (systems/save.js) and seeded into the
// battle, so those tags start filled in instead of "???".
//
// A reveal looks like { enemy: 'derek', weak: ['FLEX'], resist: ['ROAST'],
// softSpots: ['FLEX>WEALTH'] }; soft spots use combat.js's softSpotKey format.

import { softSpotKey } from './combat.js';

export const emptyIntel = () => ({ weak: [], resist: [], softSpots: [] });

/** Merge a reveal into saved intel (lists stay unique). Returns the new intel. */
export function mergeIntel(intel, reveal) {
  const out = emptyIntel();
  for (const k of Object.keys(out)) out[k] = [...new Set([...(intel?.[k] ?? []), ...(reveal?.[k] ?? [])])];
  return out;
}

/** Fill a battler's `discovered` sets from saved intel, keeping only what the villain really has. */
export function seedDiscovered(battler, intel) {
  if (!intel) return 0;
  const { def, discovered } = battler;
  const real = {
    weak: new Set(def.weak),
    resist: new Set(def.resist),
    softSpots: new Set(def.softSpots.map((s) => softSpotKey(s.type, s.target))),
  };
  let added = 0;
  for (const kind of Object.keys(real)) {
    for (const value of intel[kind] ?? []) {
      if (!real[kind].has(value) || discovered[kind].has(value)) continue;
      discovered[kind].add(value);
      added += 1;
    }
  }
  return added;
}

const pretty = (key) => key.replace('>', ' → ');

/** Lines announcing a reveal in the region, e.g. "INTEL: Derek is WEAK to FLEX." */
export function revealLines(enemy, reveal) {
  const who = enemy.short.charAt(0) + enemy.short.slice(1).toLowerCase();
  const lines = [];
  for (const t of reveal.weak ?? []) lines.push(`INTEL GET: ${who} is WEAK to ${t}.`);
  for (const t of reveal.resist ?? []) lines.push(`INTEL GET: ${who} RESISTS ${t}.`);
  if (reveal.softSpots?.length) lines.push(`INTEL GET: soft spot${reveal.softSpots.length > 1 ? 's' : ''} ${reveal.softSpots.map(pretty).join(', ')}.`);
  return lines.map((text) => ({ text: `${text}\nIt'll show in the fight.` }));
}

/** The battle's opening line when scouting paid off, or null. */
export function scoutingLine(battler) {
  const { def, discovered } = battler;
  const parts = [];
  if (discovered.weak.size) parts.push(`weak to ${[...discovered.weak].join('/')}`);
  if (discovered.resist.size) parts.push(`resists ${[...discovered.resist].join('/')}`);
  if (discovered.softSpots.size) parts.push(`${discovered.softSpots.size}/${def.softSpots.length} soft spots`);
  if (!parts.length) return null;
  return { text: `Your scouting paid off.\n${def.short} intel: ${parts.join(', ')}.` };
}
