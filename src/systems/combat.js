// Combat math: battlers, hit results, damage, discovery, Flow
// (CLAUDE.md §5). No Phaser here, so it can be unit-tested in Node.

import { DISS_TYPES, HIT_KINDS } from '../data/types.js';
import { DAMAGE, FLOW } from '../data/rules.js';
import { ITEMS } from '../data/items.js';
import { StatusSet } from './status.js';

export const softSpotKey = (type, target) => `${type}>${target}`;

/** Runtime state for $cott or a villain, built from its data file. */
export function createBattler(def) {
  const items = {};
  for (const id of def.items ?? []) items[id] = ITEMS[id].perFight;
  return {
    def,
    id: def.id,
    name: def.name,
    short: def.short,
    clout: def.maxClout,
    maxClout: def.maxClout,
    flow: def.maxFlow ?? 0,
    maxFlow: def.maxFlow ?? 0,
    statuses: new StatusSet(),
    items,
    // What $cott has learned about this battler (shown as ??? until found).
    discovered: { weak: new Set(), resist: new Set(), softSpots: new Set() },
  };
}

/**
 * How a diss of `type` at `target` lands on `defender` (§5.3).
 * Returns a HIT_KINDS entry plus the matching soft spot, if any.
 */
export function resolveHit(defender, type, target) {
  if (!type || type === 'HYPE' || !DISS_TYPES[type]) {
    return { ...HIT_KINDS.normal, softSpot: null };
  }
  const { weak = [], resist = [], softSpots = [] } = defender.def;
  const isWeak = weak.includes(type);
  const isResisted = resist.includes(type);
  const softSpot = softSpots.find((s) => s.type === type && s.target === target) ?? null;

  let kind;
  if (softSpot) kind = isWeak ? 'crit' : isResisted ? 'bypass' : 'nerve';
  else kind = isWeak ? 'weak' : isResisted ? 'resisted' : 'normal';
  return { ...HIT_KINDS[kind], softSpot };
}

/**
 * Damage = power × timing × hit × attacker's deal mult × defender's take mult
 * × random variance, rounded, minimum 1 (§5.6). Mooning and Short Squeezed
 * reach the formula through the status multipliers.
 */
export function rollDamage({ power, timingMult = 1, hitMult = 1, attacker, defender, variance, rng }) {
  const [lo, hi] = variance;
  const raw =
    power *
    timingMult *
    hitMult *
    attacker.statuses.dealMult() *
    defender.statuses.takeMult() *
    rng.range(lo, hi);
  return Math.max(DAMAGE.min, Math.round(raw));
}

/** Record what a hit revealed about the defender. Returns true if anything new. */
export function discover(defender, type, hit) {
  const found = defender.discovered;
  const before = found.weak.size + found.resist.size + found.softSpots.size;
  if (hit.id === 'crit' || hit.id === 'weak') found.weak.add(type);
  if (hit.id === 'bypass' || hit.id === 'resisted') found.resist.add(type);
  if (hit.softSpot) found.softSpots.add(softSpotKey(hit.softSpot.type, hit.softSpot.target));
  return found.weak.size + found.resist.size + found.softSpots.size > before;
}

/** Apply damage. Returns the Clout actually lost. */
export function applyDamage(battler, amount) {
  const before = battler.clout;
  battler.clout = Math.max(0, battler.clout - amount);
  return before - battler.clout;
}

/** Restore Clout and/or Flow, capped at max. Returns what was actually gained. */
export function restore(battler, { clout = 0, flow = 0 }) {
  const c0 = battler.clout;
  const f0 = battler.flow;
  battler.clout = Math.min(battler.maxClout, battler.clout + clout);
  battler.flow = Math.min(battler.maxFlow, battler.flow + flow);
  return { clout: battler.clout - c0, flow: battler.flow - f0 };
}

/**
 * Start of $cott's turn (§5.1, §5.7). If a status like Rug Pulled is draining
 * him, he loses that Flow and gets no regen; otherwise he regains 5, except on
 * his first turn. Returns { kind: 'none' | 'regen' | 'drain', amount, expired }.
 */
export function startOfTurnFlow(battler, isFirstTurn) {
  const { amount, drained, expired } = battler.statuses.drain();
  if (drained.length) {
    const before = battler.flow;
    battler.flow = Math.max(0, battler.flow - amount);
    return { kind: 'drain', amount: before - battler.flow, drained, expired };
  }
  if (isFirstTurn) return { kind: 'none', amount: 0, drained, expired };
  const { flow } = restore(battler, { flow: FLOW.regenPerTurn });
  return { kind: 'regen', amount: flow, drained, expired };
}

/** Status triggers like Short Squeezed at 40% Clout. Returns the ones that just fired. */
export function checkStatusTriggers(battler) {
  const fired = [];
  for (const trigger of battler.def.statusTriggers ?? []) {
    if (battler.statuses.has(trigger.status)) continue;
    if (battler.clout > 0 && battler.clout <= battler.maxClout * trigger.atCloutPct) {
      battler.statuses.apply(trigger.status);
      fired.push(trigger);
    }
  }
  return fired;
}

const MUMBLE = [['*mumbles something about synergy*', '*it does not land*']];

/** One couplet from a pool of couplets. */
export const pickCouplet = (pool, rng) => rng.pick(pool);

/** The couplet $cott spits for this move (and target) against this villain. */
export function scottBarsFor(enemyDef, move, target, rng) {
  if (move.finisher) return pickCouplet(enemyDef.micBars, rng);
  if (move.bars) return pickCouplet(move.bars, rng);
  return pickCouplet(enemyDef.scottBars[move.type]?.[target] ?? MUMBLE, rng);
}
