// Things right in front of the camera (CLAUDE.md §6.6): dark, out-of-focus
// silhouettes that drift across the top and bottom of the screen faster
// than the ground (parallax the other way from a vista), so the world has
// depth in front of $cott as well as behind him. Cypress branches with moss
// hang in from the top near trees, and reed tufts rise from the bottom near
// water. The map's look names them (`foreground` in data/looks.js).
//
// They're drawn in 4 px pixels, twice the world's, so they read as closer and
// softer than everything else, and they sit under the light's grade, so the
// time of day tints them. Each is anchored to something on the map (a tree,
// a stretch of shore): it slides sideways across the screen's top or bottom
// band as the camera passes it, and fades in only while the camera is near it
// up and down. They stay in those bands, so they never cover $cott.

import { GAME_W, GAME_H } from '../config.js';
import { createRng } from '../systems/rng.js';
import { hash } from '../systems/terrain.js';

const BIG = 4; // px per foreground pixel

/** A canvas texture drawn in BIG pixels of `color`: `paint(dot)` sets one, at foreground-pixel coordinates. */
function bake(scene, key, w, h, color, paint) {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w * BIG, h * BIG);
  const ctx = tex.getContext();
  ctx.fillStyle = color;
  paint((x, y) => {
    if (x >= 0 && y >= 0 && x < w && y < h) ctx.fillRect(x * BIG, y * BIG, BIG, BIG);
  });
  tex.refresh();
  return key;
}

/**
 * A branch hanging in from above: a sagging bough under a dense mass of
 * leaves along the top, and long strands of moss hanging down out of it (past
 * the region card, into view). It hangs from `top` px down the screen.
 */
function branchTexture(scene, color, seed) {
  const key = `fx_fg_branch_${seed}`;
  const w = 90;
  const h = 64;
  return bake(scene, key, w, h, color, (dot) => {
    const rand = createRng(seed).random;
    const blob = (cx, cy, rx, ry) => {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1 && rand() > 0.08) dot(cx + x, cy + y);
    };
    // The leaf mass: overlapping clumps along the top, thicker toward the side it grows from.
    const thick = (x) => (seed % 2 === 0 ? 1 - x / w : x / w);
    for (let c = 0; c < 22; c++) {
      const cx = Math.floor(rand() * w);
      blob(cx, Math.floor(rand() * 6), 4 + Math.floor(rand() * 5), 3 + Math.floor(thick(cx) * 6 + rand() * 3));
    }
    // The bough under it, sagging in the middle.
    for (let x = 0; x < w; x++) {
      const y = Math.round(10 + Math.sin((x / w) * Math.PI) * 5);
      for (let k = 0; k < 2 + Math.round(thick(x) * 2); k++) dot(x, y + k);
    }
    // Moss: long strands, some doubled, broken now and then near the ends.
    for (let m = 0; m < 26; m++) {
      const mx = Math.floor(rand() * w);
      const top = 8 + Math.floor(rand() * 8);
      const len = 10 + Math.floor(rand() * (h - top - 12));
      const wide = rand() < 0.4;
      for (let y = top; y < top + len; y++) {
        if (y > top + len * 0.7 && rand() < 0.25) continue;
        const sx = mx + (y % 9 < 2 ? 1 : 0);
        dot(sx, y);
        if (wide && y < top + len * 0.6) dot(sx + 1, y);
      }
    }
  });
}

/** A tuft of reeds rising from below: blades and a few cattails. Its bottom edge is the screen's. */
function reedsTexture(scene, color, seed) {
  const key = `fx_fg_reeds_${seed}`;
  const w = 40;
  const h = 40;
  return bake(scene, key, w, h, color, (dot) => {
    const rand = createRng(seed).random;
    for (let b = 0; b < 14; b++) {
      const x0 = 4 + Math.floor(rand() * (w - 8));
      const len = 14 + Math.floor(rand() * 24);
      const lean = (rand() - 0.5) * 0.5;
      for (let k = 0; k < len; k++) dot(Math.round(x0 + lean * k), h - 1 - k);
      if (rand() < 0.3) {
        // A cattail on top.
        const tx = Math.round(x0 + lean * len);
        for (let k = 0; k < 4; k++) {
          dot(tx, h - len - k);
          dot(tx + 1, h - len - k);
        }
      }
    }
  });
}

export class Foreground {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} spec  the look's `foreground`: { depth, color, alpha, reach, branches: { near, chance }, reeds: { on, chance } }
   * @param {object} o     { depth: just under the light's grade, props: the map's props, terrain }
   */
  constructor(scene, spec, { depth, props, terrain }) {
    this.scene = scene;
    this.spec = spec;
    this.sprites = []; // { img, ay }
    const s = spec.depth ?? 1.35;
    const color = `#${(spec.color ?? 0x120a1a).toString(16).padStart(6, '0')}`;
    // An anchor at world x `ax` is at screen x W/2 + dx when the camera's centered on it; up and down, it stays at screen y `sy`.
    const place = (key, ax, ay, dx, sy, originY) => {
      const x = Math.round(GAME_W / 2 + dx + (ax - GAME_W / 2) * s);
      const img = scene.add.image(x, sy, key).setOrigin(0.5, originY).setScrollFactor(s, 0).setDepth(depth).setAlpha(0);
      this.sprites.push({ img, ay });
    };
    const b = spec.branches;
    if (b) {
      props.forEach((p) => {
        if (!b.near.test(p.texture) || hash(Math.round(p.x), Math.round(p.y), 70) >= b.chance) return;
        const seed = 1 + Math.floor(hash(p.x, p.y, 71) * 6);
        const side = seed % 2 === 0 ? -1 : 1; // hang in from the left or the right
        place(branchTexture(scene, color, seed), p.x, p.y, side * (GAME_W * 0.3 + hash(p.x, p.y, 72) * 80), spec.top ?? 40, 0);
      });
    }
    const r = spec.reeds;
    if (r && terrain) {
      const { cols, rows, cell } = terrain;
      const water = (r.on ?? 'w');
      // Shore cells (water meeting land), now and then.
      for (let j = 1; j < rows; j++) {
        for (let i = 1; i < cols; i++) {
          const key = terrain.key(i, j);
          if (!key.includes(water) || key === water.repeat(4) || hash(i, j, 73) >= r.chance) continue;
          const seed = 11 + Math.floor(hash(i, j, 74) * 4);
          const dx = (hash(i, j, 75) - 0.5) * GAME_W * 0.8;
          place(reedsTexture(scene, color, seed), i * cell, j * cell, dx, GAME_H + 20, 1);
        }
      }
    }
  }

  /** Fade each in while the camera's near its anchor, up and down. */
  update() {
    const cam = this.scene.cameras.main;
    const cy = cam.scrollY + GAME_H / 2;
    const reach = this.spec.reach ?? 520;
    const full = this.spec.alpha ?? 0.92;
    for (const { img, ay } of this.sprites) {
      const a = full * Math.max(0, Math.min(1, (reach - Math.abs(cy - ay)) / (reach * 0.4)));
      img.setVisible(a > 0.01).setAlpha(a);
    }
  }
}
