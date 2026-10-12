// Status effects on one battler (CLAUDE.md §5.7). Definitions, including
// when each one counts down, live in src/data/statuses.js.

import { STATUSES } from '../data/statuses.js';

export class StatusSet {
  constructor() {
    this.active = new Map(); // id -> { def, turns }
  }

  /** Apply (or refresh) a status. Returns its definition. */
  apply(id) {
    const def = STATUSES[id];
    if (!def) throw new Error(`Unknown status: ${id}`);
    this.active.set(id, { def, turns: def.turns });
    return def;
  }

  has(id) {
    return this.active.has(id);
  }

  get(id) {
    return this.active.get(id) ?? null;
  }

  remove(id) {
    this.active.delete(id);
  }

  /** Multiplier on damage this battler deals. */
  dealMult() {
    let mult = 1;
    for (const { def } of this.active.values()) mult *= def.dealMult ?? 1;
    return mult;
  }

  /** Multiplier on damage this battler takes. */
  takeMult() {
    let mult = 1;
    for (const { def } of this.active.values()) mult *= def.takeMult ?? 1;
    return mult;
  }

  /** The tint of the first active status that has one, or null. */
  tint() {
    for (const { def } of this.active.values()) if (def.tint) return def.tint;
    return null;
  }

  /**
   * Start of the holder's turn: statuses with a flowDrain take their Flow and
   * count down. Returns { amount, drained: [defs], expired: [defs] }.
   */
  drain() {
    let amount = 0;
    const drained = [];
    const expired = [];
    for (const [id, entry] of this.active) {
      if (!entry.def.flowDrain) continue;
      amount += entry.def.flowDrain;
      drained.push(entry.def);
      if (entry.def.countdown === 'onDrain' && --entry.turns <= 0) {
        this.active.delete(id);
        expired.push(entry.def);
      }
    }
    return { amount, drained, expired };
  }

  /** End of round: 'roundEnd' statuses count down. Returns expired defs. */
  tick() {
    const expired = [];
    for (const [id, entry] of this.active) {
      if (entry.def.countdown !== 'roundEnd' || entry.turns === null) continue;
      if (--entry.turns <= 0) {
        this.active.delete(id);
        expired.push(entry.def);
      }
    }
    return expired;
  }

  /** For the HUD: [{ id, tag, color, turns }]. */
  list() {
    return [...this.active.values()].map(({ def, turns }) => ({
      id: def.id,
      tag: def.tag,
      color: def.color,
      turns,
    }));
  }
}
