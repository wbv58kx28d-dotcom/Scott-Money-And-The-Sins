// White water at the jet ski's stern (ui/jetski.js), where the wake (ui/wake.js)
// begins: a churn of foam boiling on the water, redrawn every few frames so it
// bubbles, and spray thrown up and back from the jet nozzle, each droplet
// flying in an arc (height `z` over the water, drawn `z` px up the screen)
// until it falls back in. Both grow with his speed and settle when he stops; a
// hop on or off throws one burst. All of it on the 2 px art grid.
//
// Two layers: one just behind the hull and one just in front of it. The
// stern's spray goes in front when the stern is nearest the camera (riding up
// the screen, or side-on) and behind when it's the far end (riding down), so
// it never covers his face.

import { RIDE } from '../config.js';

const FOAM = 0xffffff;
const SHADE = 0xbfe9f2; // the churn's shaded underside, and older spray
const SNAP = (v) => Math.round(v / 2) * 2;

/** 0..1, fixed for a pair of numbers. */
function hash(n, salt) {
  const s = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Fill an ellipse in 2 px squares. */
function blob(g, cx, cy, rx, ry) {
  for (let y = -ry; y < ry; y += 2) {
    const half = rx * Math.sqrt(Math.max(0, 1 - ((y + 1) / ry) ** 2));
    const x0 = SNAP(cx - half);
    const w = SNAP(cx + half) - x0;
    if (w > 0) g.fillRect(x0, SNAP(cy + y), w, 2);
  }
}

export class Splash {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ wet: (x: number, y: number) => boolean, rand?: () => number }} o
   */
  constructor(scene, { wet, rand = Math.random }) {
    this.back = scene.add.graphics();
    this.front = scene.add.graphics();
    this.wet = wet;
    this.rand = rand;
    this.drops = []; // { x, y, z, vx, vy, vz, born, life, big, front }
    this.power = 0; // 0..1, eased toward his speed
    this.owed = 0; // droplets due but not yet thrown
    this.stern = null; // { x, y, ux, uy, half, front, wide }
  }

  /**
   * Each frame he's on the water: the stern's spot and heading, the hull's half-width there, his speed
   * (px/s), whether the stern's the end nearest the camera, and the hull's depth (to layer around it).
   * Riding down the screen, the stern's hidden behind him: the spray goes higher so it shows over his
   * shoulders, and the churn spreads out past the hull's sides.
   */
  update(time, delta, { x, y, ux, uy, half, speed, front, depth }) {
    const lift = front ? 1 : 1.5;
    const wide = front ? 1 : 1.7;
    const want = Math.min(1, speed / RIDE.speed);
    // Spray builds quickly and dies down a little slower.
    this.power += (want - this.power) * Math.min(1, delta / (want > this.power ? 120 : 260));
    this.stern = { x, y, ux, uy, half, front, wide };
    this.back.setDepth(depth - 0.02);
    this.front.setDepth(depth + 0.02);
    const { spray } = RIDE.splash;
    this.owed += (spray.perSecond * this.power * delta) / 1000;
    while (this.owed >= 1) {
      this.owed -= 1;
      this.throwDrop(time, { x, y, ux, uy, half, front, speed, lift, wide });
    }
  }

  /** Off the water: the stern's churn goes, though spray still in the air falls back in. */
  off() {
    this.stern = null;
    this.power = 0;
    this.owed = 0;
  }

  /** A burst of spray at a point (a hop on or off). */
  burst(time, x, y, front = true) {
    for (let i = 0; i < RIDE.splash.burst; i++) {
      const a = this.rand() * Math.PI * 2;
      const v = 60 + this.rand() * 120;
      this.drops.push({
        x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 4, z: 2,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, vz: 180 + this.rand() * 200,
        born: time, life: 1000, big: this.rand() < 0.5, front,
      });
    }
  }

  /**
   * One droplet of the stern's spray: a rooster tail thrown up and back from the nozzle, fanning out. It
   * carries the ski's own speed, so it trails just behind the stern instead of being left where it was thrown.
   */
  throwDrop(time, { x, y, ux, uy, half, front, speed, lift, wide }) {
    const r = this.rand;
    const power = this.power;
    const { up, back, fan, life } = RIDE.splash.spray;
    const side = (r() - 0.5) * 2;
    const b = (back[0] + r() * (back[1] - back[0])) * (0.4 + 0.6 * power);
    const out = side * fan * (0.3 + r());
    this.drops.push({
      x: x - uy * side * half * 0.3 * wide, y: y + ux * side * half * 0.3 * wide, z: 4,
      vx: ux * (speed - b) - uy * out, vy: uy * (speed - b) + ux * out * 0.6, vz: (up[0] + r() * (up[1] - up[0])) * (0.35 + 0.65 * power) * lift,
      born: time, life, big: r() < 0.45 * power, front,
    });
  }

  /** Move the spray, then draw it and the stern's churn. */
  draw(time, delta) {
    this.back.clear();
    this.front.clear();
    const dt = delta / 1000;
    const g = RIDE.splash.gravity;
    this.drops = this.drops.filter((d) => {
      d.vz -= g * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      return d.z > 0 && time - d.born < d.life;
    });
    for (const d of this.drops) {
      const f = (time - d.born) / d.life;
      const layer = d.front ? this.front : this.back;
      layer.fillStyle(f < 0.5 ? FOAM : SHADE, 0.95 * (1 - f * f));
      const size = d.big && f < 0.6 ? 4 : 2;
      layer.fillRect(SNAP(d.x), SNAP(d.y - d.z), size, size);
    }
    if (this.stern) this.churn(time);
  }

  /**
   * Lumps of white water hugging the stern, reshuffled every `boilMs` so they boil, sized by his speed:
   * each a shaded underside under a white top, pocked with bubbles, with loose bits of froth around them.
   */
  churn(time) {
    const { x, y, ux, uy, half, front, wide } = this.stern;
    const { churn } = RIDE.splash;
    const p = this.power;
    if (p < 0.05) return;
    const layer = front ? this.front : this.back;
    const tick = Math.floor(time / churn.boilMs);
    const spot = (along, across) => ({ x: x - ux * along - uy * across, y: y - uy * along * 0.6 + ux * across * 0.6 });
    for (let k = 0; k < churn.lumps; k++) {
      // From a little under the hull's stern back along the track, the nearest lumps the biggest.
      const t = hash(tick, k);
      const along = churn.start + t * churn.length * p;
      const at = spot(along, (hash(tick, k + 9) - 0.5) * 2 * (half * 0.7 + 6) * wide);
      if (!this.wet(at.x, at.y)) continue;
      const r = SNAP((churn.size[0] + (1 - t) * hash(tick, k + 17) * (churn.size[1] - churn.size[0])) * (0.5 + 0.5 * p));
      layer.fillStyle(SHADE, 0.85);
      blob(layer, at.x, at.y + 2, r, Math.max(2, SNAP(r * 0.6)));
      layer.fillStyle(FOAM, 0.95);
      blob(layer, at.x, at.y, Math.max(2, r - 2), Math.max(2, SNAP(r * 0.45)));
      // Bubbles popping in it.
      layer.fillStyle(SHADE, 0.9);
      for (let b = 0; b < 2; b++) {
        layer.fillRect(SNAP(at.x + (hash(tick, k * 7 + b) - 0.5) * r), SNAP(at.y + (hash(tick, k * 7 + b + 3) - 0.5) * r * 0.5), 2, 2);
      }
    }
    // Loose froth thrown around the churn.
    layer.fillStyle(FOAM, 0.9);
    for (let k = 0; k < churn.froth; k++) {
      const at = spot(churn.start + hash(tick, k + 40) * churn.length * 1.3 * p, (hash(tick, k + 50) - 0.5) * 2 * (half + 10) * wide);
      if (this.wet(at.x, at.y)) layer.fillRect(SNAP(at.x), SNAP(at.y), 2, 2);
    }
  }
}
