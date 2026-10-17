// A Sin who walks behind $cott in the regions, Pikachu-in-Pokémon-Yellow style
// (CLAUDE.md §6.6). Pure, so it's unit-tested (tools/follower.test.mjs).
//
// The follower walks $cott's own trail: every step he takes is recorded, and
// she stands a fixed distance back along it. So she only moves when he does,
// stops when he stops, and goes wherever he went (around water, through
// gaps, along walls), never needing a path of her own.
//
// Her mood is jealousy (she's Envy): it rises each time $cott talks to
// someone else and resets when he talks to her (data/followers.js).

const STEP = 4; // record a trail point every this many px of his walking

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The facing for a movement (dx, dy), or null if it's too small to tell. */
export function facingOf(dx, dy) {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

export class Trail {
  /**
   * `gap` is how far behind (in px of trail) she walks. She starts `gap` px
   * behind `leader`, opposite his facing (kept inside `bounds`, the map's
   * { w, h }, if given), joined to him by a straight line.
   */
  constructor(gap, leader, { facing = 'up', bounds = null } = {}) {
    this.gap = gap;
    const [fx, fy] = DIRS[facing] ?? DIRS.up;
    const clamp = (v, max) => (bounds ? Math.max(0, Math.min(max, v)) : v);
    const start = { x: clamp(leader.x - fx * gap, bounds?.w), y: clamp(leader.y - fy * gap, bounds?.h) };
    this.points = [{ x: start.x, y: start.y }, { x: leader.x, y: leader.y }];
    this.leader = { x: leader.x, y: leader.y };
  }

  /** $cott is now at (x, y). */
  record(x, y) {
    this.leader = { x, y };
    const last = this.points[this.points.length - 1];
    if (Math.hypot(x - last.x, y - last.y) >= STEP) this.points.push({ x, y });
    this.trim();
  }

  /** Drop the trail behind her (keeping the point at her back). */
  trim() {
    let walked = 0;
    let from = this.leader;
    for (let i = this.points.length - 1; i > 0; i--) {
      const to = this.points[i];
      walked += Math.hypot(to.x - from.x, to.y - from.y);
      from = to;
      if (walked > this.gap) {
        this.points.splice(0, i - 1);
        return;
      }
    }
  }

  /** Where she stands: `gap` px back along the trail from him (or its far end, if the trail is shorter). */
  position() {
    let left = this.gap;
    let from = this.leader;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const to = this.points[i];
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      if (d >= left && d > 0) {
        const t = left / d;
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      }
      left -= d;
      from = to;
    }
    return { x: from.x, y: from.y };
  }
}

/** Her mood from her jealousy count: the first mood whose `at` it reaches, from the top. */
export function moodOf(moods, jealousy) {
  return [...moods].reverse().find((m) => jealousy >= m.at) ?? moods[0];
}

/**
 * What she says when $cott talks to her: her intro the first time; else a line
 * about someone standing nearby if she has one, else about the map she's on or
 * her mood (either). `pick(n)` picks an index below n.
 */
export function followerLines(data, { first = false, near = null, map = null, mood }, pick) {
  if (first && data.intro?.length) return data.intro;
  const nearby = near && data.near?.[near];
  const here = map && data.maps?.[map];
  const mine = data.moods.find((m) => m.id === mood)?.lines;
  // Someone else around is all she can talk about; otherwise the place or her mood, either one.
  const pool = nearby?.length ? nearby : here?.length && mine?.length ? [here, mine][pick(2)] : here?.length ? here : mine ?? [];
  return pool.length ? [pool[pick(pool.length)]] : [];
}
