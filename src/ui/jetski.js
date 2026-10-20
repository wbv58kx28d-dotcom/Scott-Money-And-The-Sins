// $cott on his jet ski (CLAUDE.md §6.6, systems/ride.js): the ride sheet's
// frame for each facing, the hull riding low in the water and bobbing while he
// idles (the bottom rows cropped off at the waterline, so nothing is scaled),
// a churn of foam at the waterline hiding the cut, a V of foam peeling off
// behind him as he rides, and rings spreading out from the hull while he sits still. Foam and rings are drawn on the 2 px art grid,
// flat on the water just above the ground layer, so the light map grades them.

import { RIDE } from '../config.js';
import { RIDE_SHEET } from '../data/assets.js';
import { facingFrame } from '../systems/fieldArt.js';

const FOAM = 'fx_ski_foam';
// The churn at the waterline: as wide as the hull in each view (the side view's is long).
const CHURN = { narrow: { key: 'fx_ski_churn', w: 64 }, wide: { key: 'fx_ski_churn_wide', w: 132 } };
const RINGS = [20, 30, 40, 50]; // a ring's half-width at each step (px); each is 0.4 as tall
const ringKey = (k) => `fx_ski_ring_${k}`;
// Where the hull's bottom sits in a ride frame (tools/region-art/jetski.py WATERLINE, in screen px).
const HULL_FOOT = 140;
// How far behind his feet the stern is, by view: the side view's hull is long.
const STERN = { down: 18, up: 18, left: 62, right: 62 };
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
  if (scene.textures.exists(FOAM)) return;
  const foam = scene.textures.createCanvas(FOAM, 24, 10);
  let ctx = foam.getContext();
  ctx.fillStyle = WHITE;
  ctx.globalAlpha = 0.5;
  pixelEllipse(ctx, 12, 5, 12, 5);
  ctx.globalAlpha = 1;
  pixelEllipse(ctx, 12, 5, 6, 3);
  foam.refresh();
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
   * @param {{ depth: number }} o  depth for the foam (flat on the water)
   */
  constructor(scene, sprite, { depth }) {
    Object.assign(this, { scene, sprite, depth });
    makeTextures(scene);
    this.churn = scene.add.image(sprite.x, sprite.y, CHURN.narrow.key).setOrigin(0.5, 0.5).setVisible(false);
    this.since = 0; // px ridden since the last puff of foam
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
    this.since = 0;
    this.still = 0;
  }

  /**
   * Each frame he's on the water: `moved` px this frame, heading (mx, my), facing. Moving, the hull
   * planes higher and foam peels off the stern; sitting still, it bobs and rings spread out.
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
    if (moved > 0.01) {
      this.still = 0;
      this.since += moved;
      if (this.since >= RIDE.wakeEveryPx) {
        this.since = 0;
        this.wake(mx, my, facing);
      }
    } else {
      this.still += delta;
      if (this.still > 300 && time - this.ringAt > RIDE.rippleMs) {
        this.ringAt = time;
        this.ripple();
      }
    }
  }

  /** Two puffs at the stern, drifting apart on either side of his track, fading. */
  wake(mx, my, facing) {
    const len = Math.hypot(mx, my) || 1;
    const ux = mx / len;
    const uy = my / len;
    const back = STERN[facing] ?? 20;
    const sx = this.sprite.x - ux * back;
    const sy = this.sprite.y - 6 - uy * back * 0.5;
    for (const side of [-1, 1]) {
      const px = -uy * side;
      const py = ux * side;
      const puff = this.scene.add.image(Math.round(sx + px * 14), Math.round(sy + py * 6), FOAM).setDepth(this.depth).setAlpha(0.9);
      this.scene.tweens.add({
        targets: puff, x: puff.x + px * 44, y: puff.y + py * 20, alpha: 0, duration: RIDE.wakeMs, ease: 'Quad.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
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
