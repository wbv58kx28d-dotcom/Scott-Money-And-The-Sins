// $cott on his jet ski (CLAUDE.md §6.6, systems/ride.js): the ride sheet's
// frame for each facing, the hull riding low in the water and bobbing while he
// idles (the bottom rows cropped off at the waterline, so nothing is scaled),
// a churn of foam at the waterline hiding the cut, white water and spray at
// the stern (ui/splash.js), waves spreading behind him as he rides
// (ui/wake.js), and rings spreading out from the hull while he
// sits still. Waves and rings are drawn on the 2 px art grid, flat on the
// water just above the ground layer, so the light map grades them.

import { RIDE } from '../config.js';
import { RIDE_SHEET } from '../data/assets.js';
import { facingFrame } from '../systems/fieldArt.js';
import { Wake } from './wake.js';
import { Splash } from './splash.js';

// The churn at the waterline: as wide as the hull in each view (the side view's is long).
const CHURN = { narrow: { key: 'fx_ski_churn', w: 64 }, wide: { key: 'fx_ski_churn_wide', w: 132 } };
const RINGS = [20, 30, 40, 50]; // a ring's half-width at each step (px); each is 0.4 as tall
const ringKey = (k) => `fx_ski_ring_${k}`;
// Where the hull's bottom sits in a ride frame (tools/region-art/jetski.py WATERLINE, in screen px).
const HULL_FOOT = 140;
// The hull on the water, by view (measured from the ride sheet): how far its stern is behind the middle
// of its footprint, and how far it reaches to each side. The side view's hull is long and thin.
const HULL = { down: { back: 24, half: 26 }, up: { back: 24, half: 26 }, left: { back: 66, half: 6 }, right: { back: 66, half: 6 } };
// The middle of the hull's footprint, above his feet (screen px).
const HULL_RISE = 8;
const WHITE = '#f4fbff';

/** Fill an ellipse (or its rim) in 2 px squares. */
function pixelEllipse(ctx, cx, cy, rx, ry, rim = 0) {
  for (let y = -ry; y < ry; y += 2) {
    for (let x = -rx; x < rx; x += 2) {
      const d = ((x + 1) / rx) ** 2 + ((y + 1) / ry) ** 2;
      const inner = rim ? (((x + 1) / (rx - rim)) ** 2 + ((y + 1) / (ry - rim)) ** 2) : 2;
      if (d <= 1 && inner > 1) ctx.fillRect(cx + x, cy + y, 2, 2);
    }
  }
}

function makeTextures(scene) {
  if (scene.textures.exists(CHURN.narrow.key)) return;
  let ctx;
  for (const { key, w } of Object.values(CHURN)) {
    // A ring of foam around the hull's foot, thick at the sides, with a brighter rim.
    const churn = scene.textures.createCanvas(key, w, 14);
    ctx = churn.getContext();
    ctx.fillStyle = WHITE;
    ctx.globalAlpha = 0.45;
    pixelEllipse(ctx, w / 2, 7, w / 2, 7);
    ctx.globalAlpha = 1;
    pixelEllipse(ctx, w / 2, 7, w / 2, 7, 2);
    churn.refresh();
  }
  RINGS.forEach((rx, k) => {
    const ry = Math.round((rx * 0.4) / 2) * 2;
    const ring = scene.textures.createCanvas(ringKey(k), rx * 2, ry * 2);
    ctx = ring.getContext();
    ctx.fillStyle = WHITE;
    pixelEllipse(ctx, rx, ry, rx, ry, 2);
    ring.refresh();
  });
}

export class JetSkiView {
  /**
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.Sprite} sprite  $cott's sprite (it swaps between his walk and ride sheets)
   * @param {{ depth: number, wet: (x: number, y: number) => boolean }} o  depth for the foam (flat on the
   *   water), and where open water is (the waves stop at a beach or a dock)
   */
  constructor(scene, sprite, { depth, wet }) {
    Object.assign(this, { scene, sprite, depth });
    makeTextures(scene);
    this.churn = scene.add.image(sprite.x, sprite.y, CHURN.narrow.key).setOrigin(0.5, 0.5).setVisible(false);
    this.waves = new Wake(scene, { depth, wet });
    this.splash = new Splash(scene, { wet });
    this.still = 0; // ms since he stopped
    this.ringAt = 0;
  }

  /** Show the ride frame for a facing (right mirrors left). */
  face(facing) {
    const { row, flip } = facingFrame(facing);
    this.sprite.anims.stop();
    this.sprite.setTexture(RIDE_SHEET.key, row).setFlipX(flip);
    this.churn.setTexture(facing === 'left' || facing === 'right' ? CHURN.wide.key : CHURN.narrow.key);
  }

  /** Back on foot: the whole frame again. */
  off() {
    this.sprite.setCrop();
    this.churn.setVisible(false);
    this.splash.off();
    this.still = 0;
  }

  /** Every frame, riding or not: what's left of the waves keeps spreading and fading. */
  tick(time, delta) {
    this.waves.draw(time);
    this.splash.draw(time, delta);
  }

  /**
   * Each frame he's on the water: `moved` px this frame, heading (mx, my), facing. Moving, the hull
   * planes higher and waves spread from the stern; sitting still, it bobs and rings spread out.
   */
  update(time, delta, moved, mx, my, facing) {
    const [lo, hi] = RIDE.waterline;
    const sink = moved > 0.01 ? lo - 4 : lo + (hi - lo) * (0.5 + 0.5 * Math.sin((time / RIDE.bobMs) * Math.PI * 2));
    const cut = HULL_FOOT - Math.round(sink / 2) * 2;
    this.sprite.setCrop(0, 0, RIDE_SHEET.w, cut);
    // The churn sits on the cut, just in front of the hull.
    const foot = this.sprite.y - RIDE_SHEET.h + cut;
    this.churn.setPosition(Math.round(this.sprite.x), Math.round(foot - 2)).setDepth(this.sprite.depth + 0.01).setVisible(true)
      .setAlpha(moved > 0.01 ? 0.95 : 0.55 + 0.25 * Math.sin((time / RIDE.bobMs) * Math.PI * 2));
    const len = Math.hypot(mx, my) || 1;
    if (moved > 0.01) [this.ux, this.uy] = [mx / len, my / len];
    const stern = this.stern(facing);
    // The stern's the end nearest the camera unless he's riding down the screen.
    this.splash.update(time, delta, { ...stern, speed: (moved / Math.max(1, delta)) * 1000, front: facing !== 'down', depth: this.sprite.depth });
    if (moved > 0.01) {
      this.still = 0;
      this.waves.add(stern.x, stern.y, stern.ux, stern.uy, time, stern.half);
    } else {
      this.still += delta;
      if (this.still > 300 && time - this.ringAt > RIDE.rippleMs) {
        this.ringAt = time;
        this.ripple();
      }
    }
  }

  /** Where the stern is on the water, the heading it was last moving, and the hull's half-width there. */
  stern(facing) {
    const ux = this.ux ?? 0;
    const uy = this.uy ?? -1;
    const { back, half } = HULL[facing] ?? HULL.down;
    return { x: this.sprite.x - ux * back, y: this.sprite.y - HULL_RISE - uy * back * 0.5, ux, uy, half };
  }

  /** A burst of spray where he hits (or leaves) the water. */
  burst(time, x, y) {
    this.splash.burst(time, x, y - HULL_RISE);
  }

  /** A ring spreading out from the hull, step by step through the ring sizes, fading. */
  ripple() {
    const ring = this.scene.add.image(Math.round(this.sprite.x), Math.round(this.sprite.y - 8), ringKey(0)).setDepth(this.depth).setAlpha(0.7);
    const step = RIDE.rippleMs / 2 / RINGS.length;
    RINGS.forEach((_, k) => {
      this.scene.time.delayedCall(step * k, () => ring.active && ring.setTexture(ringKey(k)).setAlpha(0.7 * (1 - k / RINGS.length)));
    });
    this.scene.time.delayedCall(step * RINGS.length, () => ring.destroy());
  }
}
