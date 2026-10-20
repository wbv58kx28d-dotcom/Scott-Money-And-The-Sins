// The waves behind $cott's jet ski (ui/jetski.js): a trail of where the stern
// has been, redrawn every frame on the 2 px art grid, flat on the water just
// above the ground layer (so the light map grades it). Each point of the trail
// ages, and the waves it left spread out sideways as it does, so a turn leaves
// a curved wake behind it, the way a real one does.
//
// The wake is a V (a Kelvin wake): two crests spreading from the hull's sides,
// each a lit line over a darker trough, rippling a little side to side and
// breaking into foam caps, with a fainter echo inside each and broken foam down
// the middle. Fresh waves are 4 px thick (2 art px); they flatten to 2 px, then
// break up into gaps and fade. Only open water gets waves: where one runs up
// onto a beach or under a dock, it stops.

import { RIDE } from '../config.js';

const CREST = 0xf2fcff; // a wave's lit top
const TROUGH = 0x0a4a5c; // the shade under it
const FOAM = 0xffffff;
const SNAP = (v) => Math.round(v / 2) * 2;

/** 0..1, fixed for a point of the trail and a salt, so broken foam doesn't flicker from frame to frame. */
function hash(n, salt) {
  const s = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class Wake {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ depth: number, wet: (x: number, y: number) => boolean }} o  `wet`: is a world point open water?
   */
  constructor(scene, { depth, wet }) {
    this.g = scene.add.graphics().setDepth(depth);
    this.wet = wet;
    // { x, y, ux, uy, t, d, half, cut }: stern spot, heading, time, distance ridden, hull half-width there,
    // and whether the trail jumped to it (a hop off and back on somewhere else), so no wave joins them.
    this.trail = [];
    this.dist = 0;
  }

  /** The stern is at (x, y), heading (ux, uy), with the hull `half` px wide each side of it. */
  add(x, y, ux, uy, time, half) {
    const last = this.trail.at(-1);
    const step = last ? Math.hypot(x - last.x, y - last.y) : 0;
    if (last && step < RIDE.wake.every) return;
    const cut = !last || step > RIDE.wake.every * 8 || time - last.t > 250;
    this.dist += cut ? 0 : step;
    this.trail.push({ x, y, ux, uy, t: time, d: this.dist, half, cut });
  }

  /** Redraw what's left of the wake; points older than its life drop off. */
  draw(time) {
    const { life } = RIDE.wake;
    while (this.trail.length && time - this.trail[0].t > life) this.trail.shift();
    this.g.clear();
    if (this.trail.length < 2) return;
    this.foam(time);
    for (const side of [-1, 1]) {
      this.crest(time, side, 1, 1);
      this.crest(time, side, 0.62, 0.55);
    }
  }

  clear() {
    this.trail = [];
    this.g.clear();
  }

  /** How faded a point's waves are (0..1) at its age, and how far they've spread to each side. */
  spreadAt(p, time) {
    const age = time - p.t;
    return { f: age / RIDE.wake.life, s: p.half + (RIDE.wake.spread * age) / 1000 };
  }

  /**
   * Where a point's wave is on one side (`side` ±1), `reach` of the way out: spread out sideways from
   * the stern, rippling side to side a little more as it ages (fixed per point, so it doesn't swim).
   */
  at(p, time, side, reach) {
    const { f, s } = this.spreadAt(p, time);
    const { ripple } = RIDE.wake;
    const d = s * reach + Math.sin(p.d / ripple.length + side * 1.7) * ripple.amp * (0.3 + f);
    return { x: p.x - p.uy * d * side, y: p.y + p.ux * d * side };
  }

  /** Fill `size` px squares (2 or 4) along a line, skipping some (`keep` says which), on the grid. */
  line(a, b, color, alpha, keep, size) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / size)); // squares touch, no more
    this.g.fillStyle(color, alpha);
    for (let i = 0; i <= n; i++) {
      if (!keep(i)) continue;
      const t = i / n;
      this.g.fillRect(SNAP(a.x + (b.x - a.x) * t), SNAP(a.y + (b.y - a.y) * t), size, size);
    }
  }

  /** One crest down a side of the V: a trough band under a lit line, with foam caps on the young waves. */
  crest(time, side, reach, alpha) {
    const salt = side + reach * 10;
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      if (b.cut) continue;
      const { f } = this.spreadAt(b, time);
      const fade = (1 - f) ** 1.2 * alpha;
      const size = f < 0.45 ? 4 : 2;
      const pa = this.at(a, time, side, reach);
      const pb = this.at(b, time, side, reach);
      if (!this.wet(pa.x, pa.y) || !this.wet(pb.x, pb.y)) continue;
      const keep = (k) => hash(b.d * 3 + k, salt) > f * 0.85;
      this.line({ x: pa.x, y: pa.y + size }, { x: pb.x, y: pb.y + size }, TROUGH, 0.45 * fade, keep, size);
      this.line(pa, pb, CREST, 0.95 * fade, keep, size);
      // Now and then the young crest breaks into a cap of foam.
      if (f < 0.5 && hash(b.d, salt + 31) > 0.82) {
        this.g.fillStyle(FOAM, fade);
        this.g.fillRect(SNAP(pb.x) - 2, SNAP(pb.y) - 2, 6, 4);
      }
    }
  }

  /** The foam down the middle: a cluster of squares around each young point, scattered by its hash, breaking up as it ages. */
  foam(time) {
    const { life } = RIDE.wake;
    const share = 0.5;
    for (const p of this.trail) {
      const f = (time - p.t) / (life * share);
      if (f >= 1) continue;
      const w = 8 + (time - p.t) * 0.03;
      for (let k = 0; k < 5; k++) {
        if (hash(p.d, k + 7) < f * 0.9) continue;
        const off = (hash(p.d, k) - 0.5) * 2 * w;
        const along = (hash(p.d, k + 3) - 0.5) * 4;
        const size = f < 0.5 && hash(p.d, k + 21) > 0.4 ? 4 : 2; // chunky while it's fresh
        const x = p.x - p.uy * off + p.ux * along;
        const y = p.y + p.ux * off + p.uy * along;
        if (!this.wet(x, y)) continue;
        this.g.fillStyle(FOAM, 0.9 * (1 - f));
        this.g.fillRect(SNAP(x), SNAP(y), size, size);
      }
    }
  }
}
