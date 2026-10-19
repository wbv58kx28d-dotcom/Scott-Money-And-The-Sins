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
//
// Walking past someone or something she has an opinion on (an NPC, a prop
// like the hot tub, a velvet rope, a door), she sometimes says so: a bark,
// one line in a bubble over her head that doesn't stop play (Barker).

const STEP = 4; // record a trail point every this many px of his walking

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Near a diagonal, keep facing the way he already was until the other axis
// leads by this much, so a thumb wobbling around 45° doesn't flip him back
// and forth (each flip restarted the walk cycle).
const STICKY = 1.4;

/** The facing for a movement (dx, dy), or null if it's too small to tell. Pass the current facing to keep it near a diagonal. */
export function facingOf(dx, dy, current = null) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < 0.01 && ay < 0.01) return null;
  const side = dx < 0 ? 'left' : 'right';
  const vert = dy < 0 ? 'up' : 'down';
  if (current === side && ax * STICKY >= ay) return side;
  if (current === vert && ay * STICKY >= ax) return vert;
  return ax > ay ? side : vert;
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

/**
 * The things on a map she can bark about, from her `barks` data: NPCs by id,
 * props by texture, ropes by id, doors by the map they lead to. Each is
 * { key, x, y, lines, range? }; things that share a key (a row of server
 * racks) share one bark.
 */
export function barkTargets(barks, { npcs = [], props = [], gates = [], exits = [] }) {
  const out = [];
  const add = (key, x, y, entry) => {
    if (!entry) return;
    const { lines, range } = Array.isArray(entry) ? { lines: entry } : entry;
    if (lines?.length) out.push({ key, x, y, lines, range });
  };
  for (const n of npcs) add(`npc:${n.id}`, n.x, n.y, barks.npcs?.[n.id]);
  for (const p of props) add(`prop:${p.texture}`, p.x, p.y, barks.props?.[p.texture]);
  for (const g of gates) add(`rope:${g.id}`, g.x, g.y, barks.ropes?.[g.id]);
  for (const e of exits) if (e.to !== 'map') add(`door:${e.to}`, e.x + e.w / 2, e.y + e.h / 2, barks.doors?.[e.to]);
  return out;
}

/**
 * When to bark. Each target counts once each time $cott walks up to it (comes
 * within its range), and then only sometimes (`chance`), not too soon after
 * her last bark (`cooldownMs`), and not about the same thing again for a
 * while (`againMs`). Things already in range when she arrives don't count.
 */
export class Barker {
  constructor({ chance = 0.5, cooldownMs = 9000, againMs = 60000, range = 200 } = {}, { now = 0, settleMs = 2500 } = {}) {
    Object.assign(this, { chance, cooldownMs, againMs, range });
    this.nextAny = now + settleMs;
    this.nextFor = new Map(); // key -> time it may come up again
    this.lastLine = new Map(); // key -> the line she said last time
    this.inside = null; // keys in range last time (null: nothing seen yet)
  }

  /**
   * $cott is at `at`. Returns { key, text, line } to say now, or null. `roll()` is
   * a random number in [0, 1); `pick(n)` an index below n.
   */
  update(now, at, targets, roll, pick) {
    // The nearest of each key's things.
    const near = new Map();
    for (const t of targets) {
      const d = Math.hypot(t.x - at.x, t.y - at.y);
      if (d <= (t.range ?? this.range) && !(near.get(t.key)?.d <= d)) near.set(t.key, { t, d });
    }
    const first = this.inside === null;
    const entered = first ? [] : [...near.keys()].filter((k) => !this.inside.has(k));
    this.inside = new Set(near.keys());
    for (const key of entered) {
      if (now < this.nextAny || now < (this.nextFor.get(key) ?? 0)) continue;
      if (roll() >= this.chance) continue;
      const { lines } = near.get(key).t;
      // A different line from last time, when there's more than one.
      const last = this.lastLine.get(key);
      const pool = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
      const line = pool[pick(pool.length)];
      this.lastLine.set(key, line);
      this.nextAny = now + this.cooldownMs;
      this.nextFor.set(key, now + this.againMs);
      return { key, line, text: line.text ?? line };
    }
    return null;
  }
}
