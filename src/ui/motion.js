// Things that move on their own in a region (CLAUDE.md §6.6): trees, reeds
// and torch flames sway in the wind, and everyone standing still breathes.
//
// Both are frames baked from the art at load, on its 2 px grid, never scaled:
//   sway     each row of a prop above its trunk shifts sideways by whole art
//            pixels, more toward the top, in five leans from -1 to 1. The
//            wind (systems/sky.js: calm in fog, strong in a storm) picks the
//            lean, in a slow wave that rolls across the map.
//   breath   the classic pixel-art idle: the upper body dips one art pixel
//            for part of each breath while the feet stay put. One frame per
//            facing row of a walker sheet (data/assets.js FIELD_SHEETS).

import { SHEET_COLS } from '../systems/fieldArt.js';

const PX = 2;
const LEANS = [-1, -0.5, 0, 0.5, 1]; // sway frames, left to right
const BREATH = { periodMs: [1700, 2400], downShare: 0.4, waist: 0.55 };

/** The image behind a texture (loaded art or a baked canvas). */
const sourceOf = (scene, key) => scene.textures.get(key).getSourceImage();

/**
 * A prop's sway frames: `${key}~sway`, five leans side by side, each `amp` px
 * wider on both sides. Rows above `bend` (a share of the height from the top)
 * move, the top the most.
 */
export function swaySheet(scene, key, amp, bend = 0.72) {
  const out = `${key}~sway`;
  if (scene.textures.exists(out)) return out;
  const src = sourceOf(scene, key);
  const { width: w, height: h } = src;
  const fw = w + amp * 2;
  const tex = scene.textures.createCanvas(out, fw * LEANS.length, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const pivot = Math.round(h * bend);
  LEANS.forEach((lean, f) => {
    for (let y = 0; y < h; y += PX) {
      const weight = y >= pivot ? 0 : ((pivot - y) / pivot) ** 1.3;
      const dx = Math.round((lean * amp * weight) / PX) * PX;
      ctx.drawImage(src, 0, y, w, PX, f * fw + amp + dx, y, w, PX);
    }
    tex.add(f, 0, f * fw, 0, fw, h);
  });
  tex.refresh();
  return out;
}

/**
 * A walker sheet's breathing frames: `${key}~breath`, one per facing row (its
 * idle frame with everything above the waist one art pixel lower).
 */
export function breathSheet(scene, key, frameW, frameH, rows = 3) {
  const out = `${key}~breath`;
  if (scene.textures.exists(out)) return out;
  const src = sourceOf(scene, key);
  const tex = scene.textures.createCanvas(out, frameW * rows, frameH);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  const probe = document.createElement('canvas');
  probe.width = frameW;
  probe.height = frameH;
  const pctx = probe.getContext('2d');
  for (let r = 0; r < rows; r++) {
    const sy = r * frameH;
    if (sy + frameH > src.height) break;
    pctx.clearRect(0, 0, frameW, frameH);
    pctx.drawImage(src, 0, sy, frameW, frameH, 0, 0, frameW, frameH);
    const data = pctx.getImageData(0, 0, frameW, frameH).data;
    // The character's top and feet in this frame.
    let top = frameH;
    let bottom = 0;
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        if (data[(y * frameW + x) * 4 + 3] > 0) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          break;
        }
      }
    }
    const waist = Math.round((top + (bottom - top) * BREATH.waist) / PX) * PX;
    const x0 = r * frameW;
    ctx.drawImage(probe, 0, waist, frameW, frameH - waist, x0, waist, frameW, frameH - waist); // legs stay
    ctx.drawImage(probe, 0, 0, frameW, waist, x0, PX, frameW, waist); // the rest dips one art pixel
    tex.add(r, 0, x0, 0, frameW, frameH);
  }
  tex.refresh();
  return out;
}

export class Motion {
  constructor(scene, { rand }) {
    this.scene = scene;
    this.rand = rand;
    this.swaying = []; // { img, frame }
    this.breathers = []; // { sprite, sheet, breath, row, period, phase, down }
  }

  /** Sway a prop's image (already showing its `swaySheet`). */
  sway(img) {
    img.setFrame(2);
    this.swaying.push({ img, frame: 2 });
  }

  /** Let a walker sprite breathe while it stands still. */
  breathe(sprite, sheet, frameW, frameH) {
    const breath = breathSheet(this.scene, sheet, frameW, frameH);
    const [lo, hi] = BREATH.periodMs;
    this.breathers.push({ sprite, sheet, breath, row: 0, period: lo + this.rand() * (hi - lo), phase: this.rand() * hi, down: false });
  }

  forget(sprite) {
    this.breathers = this.breathers.filter((b) => b.sprite !== sprite);
  }

  /** A sprite was just turned to face a row of its sheet (standing): breathe from there. */
  rest(sprite, row) {
    const b = this.breathers.find((x) => x.sprite === sprite);
    if (b) {
      b.row = row;
      b.down = false;
    }
  }

  update(time, wind) {
    const view = this.scene.cameras.main.worldView;
    const t = time / 1000;
    for (const s of this.swaying) {
      const { img } = s;
      if (img.x < view.x - 200 || img.x > view.right + 200 || img.y < view.y - 50 || img.y > view.bottom + 400) continue;
      // A slow wave rolling across the map, with a quicker flutter on top; stronger wind leans further.
      const wave = 0.65 * Math.sin(t * 0.9 - img.x * 0.004 - img.y * 0.002) + 0.35 * Math.sin(t * 2.1 + img.x * 0.013);
      const lean = Math.max(-1, Math.min(1, wind * (0.35 + wave)));
      const frame = Math.round((lean + 1) * 2);
      if (frame !== s.frame) {
        s.frame = frame;
        img.setFrame(frame);
      }
    }
    for (const b of this.breathers) {
      const { sprite } = b;
      if (sprite.anims.isPlaying || !sprite.visible) {
        b.down = false;
        continue;
      }
      const down = ((time + b.phase) % b.period) / b.period < BREATH.downShare;
      if (down === b.down) continue;
      b.down = down;
      if (down) sprite.setTexture(b.breath, b.row);
      else sprite.setTexture(b.sheet, b.row * SHEET_COLS);
    }
  }
}
