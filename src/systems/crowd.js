// Crowd meter (CLAUDE.md §5.5). At max, Drop the Mic unlocks.

import { CROWD } from '../data/rules.js';

export class Crowd {
  constructor({ max = CROWD.max, lockWhenFull = CROWD.lockWhenFull } = {}) {
    this.max = max;
    this.lockWhenFull = lockWhenFull;
    this.value = 0;
  }

  get full() {
    return this.value >= this.max;
  }

  /** Change the meter. Returns { delta, becameFull }. */
  add(amount) {
    const wasFull = this.full;
    if (wasFull && this.lockWhenFull) return { delta: 0, becameFull: false };
    const before = this.value;
    this.value = Math.max(0, Math.min(this.max, this.value + amount));
    return { delta: this.value - before, becameFull: !wasFull && this.full };
  }

  reset() {
    this.value = 0;
  }
}
