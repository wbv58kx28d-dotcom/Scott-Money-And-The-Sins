// Status effects on one battler (CLAUDE.md §5.7). Definitions live in
// src/data/statuses.js.

import { STATUSES } from '../data/statuses.js';

export class StatusSet {
  constructor() {
    this.active = new Map(); // id -> { def, turns, fresh }
  }

  /** Apply (or refresh) a status. Returns its definition. */
  apply(id) {
    const def = STATUSES[id];
    if (!def) throw new Error(`Unknown status: ${id}`);
    this.active.set(id, { def, turns: def.turns, fresh: true });
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

  /** Total Flow lost at the start of the holder's turn. */
  flowDrain() {
    let total = 0;
    for (const { def } of this.active.values()) total += def.flowDrain ?? 0;
    return total;
  }

  blocksRegen() {
    for (const { def } of this.active.values()) if (def.blocksRegen) return true;
    return false;
  }

  /**
   * End-of-round tick. A status applied this round doesn't count down until
   * the next one, so "2 turns" means two full rounds. Returns expired defs.
   */
  tick() {
    const expired = [];
    for (const [id, entry] of this.active) {
      if (entry.turns === null) continue;
      if (entry.fresh) {
        entry.fresh = false;
        continue;
      }
      entry.turns -= 1;
      if (entry.turns <= 0) {
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
