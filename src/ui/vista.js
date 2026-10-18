// The view past a drop (CLAUDE.md §6.6): where a region's ground ends at a
// cliff edge (a `void` terrain, systems/terrain.js), the land beyond shows
// through, in layers that move slower than the ground the farther away they
// are (parallax). The map's look names it (`vista` in data/looks.js).
//
// From the back: the sky (a gradient from the horizon up, stars at night, a
// low sun's disc at dawn and sunset), then each layer, a silhouette drawn
// once as a mask that tiles sideways (a city skyline, misty hills, a
// treeline), recolored as the light changes: its color fades toward the
// sky's the farther it is, with mist at its feet. A city's windows are lit
// at night, drawn over the dusk's grade (clipped to the drop, so they stay
// warm and bright) like props' glows.
//
// Positions: with the camera at its highest, each layer's skyline sits `rise`
// px above the cliff edge (the far ones higher, like land falling away to a
// horizon) and it's solid below that, down past the edge, so there are no
// gaps. Each moves `depth` as fast as the ground, so walking north reveals
// more of the far view rising over the edge, and walking away sinks it.

import { GAME_W, GAME_H } from '../config.js';
import { createRng } from '../systems/rng.js';
import { lerpColor } from '../systems/sky.js';

const PX = 2;
const TILE = 1024; // layer masks tile sideways every this many px
const BELOW = 160; // how far each layer runs on below its skyline, solid
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const near = (a, b) => [16, 8, 0].every((s) => Math.abs(((a >> s) & 255) - ((b >> s) & 255)) < 3);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A skyline: blocks of towers, some with setbacks and spires; windows on a grid, some lit. */
function cityMask(h, seed) {
  const rand = createRng(seed).random;
  const shape = canvas(TILE, h);
  const lights = canvas(TILE, h);
  const sc = shape.getContext('2d');
  const lc = lights.getContext('2d');
  sc.fillStyle = '#fff';
  const art = h / PX;
  let x = 0;
  while (x < TILE / PX) {
    const w = Math.min(TILE / PX - x, 6 + Math.floor(rand() * 16));
    const tall = rand() < 0.12;
    const bh = Math.floor(art * (tall ? 0.7 + rand() * 0.28 : 0.2 + rand() * 0.45));
    sc.fillRect(x * PX, h - bh * PX, w * PX, bh * PX);
    // A setback, and on tall ones a spire with a red light.
    if (w > 9 && rand() < 0.5) {
      const sw = Math.floor(w * 0.6);
      const sh = 3 + Math.floor(rand() * 8);
      sc.fillRect((x + Math.floor((w - sw) / 2)) * PX, h - (bh + sh) * PX, sw * PX, sh * PX);
    }
    if (tall) {
      const mx = x + Math.floor(w / 2);
      sc.fillRect(mx * PX, h - (bh + 10) * PX, PX, 10 * PX);
      lc.fillStyle = '#ff4050';
      lc.fillRect(mx * PX, h - (bh + 10) * PX, PX, PX);
    }
    // Windows: every other art pixel across, every third up; about a third lit.
    lc.fillStyle = '#ffd88a';
    for (let wy = 3; wy < bh - 2; wy += 3) {
      for (let wx = x + 1; wx < x + w - 1; wx += 2) if (rand() < 0.32) lc.fillRect(wx * PX, h - wy * PX, PX, PX);
    }
    x += w + (rand() < 0.3 ? 1 : 0);
  }
  // A solid lower city, so the gaps between towers don't run all the way down.
  sc.fillRect(0, h - Math.floor(art * 0.16) * PX, TILE, Math.floor(art * 0.16) * PX);
  return { shape, lights };
}

/** A ridge line from sines that repeat across the tile, so it tiles. */
function hillsMask(h, seed) {
  const rand = createRng(seed).random;
  const shape = canvas(TILE, h);
  const c = shape.getContext('2d');
  c.fillStyle = '#fff';
  const waves = [1, 2, 3, 5, 8].map((k) => ({ k, a: rand() / k, p: rand() * Math.PI * 2 }));
  const art = h / PX;
  for (let x = 0; x < TILE / PX; x++) {
    const t = (x / (TILE / PX)) * Math.PI * 2;
    const v = waves.reduce((s, w) => s + w.a * Math.sin(w.k * t + w.p), 0);
    const top = Math.round(art * (0.45 - v * 0.35));
    c.fillRect(x * PX, Math.max(0, top) * PX, PX, h - Math.max(0, top) * PX);
  }
  return { shape };
}

/** A treeline of swamp cypress: round canopies on a low band, moss hanging off them. */
function treesMask(h, seed) {
  const rand = createRng(seed).random;
  const shape = canvas(TILE, h);
  const c = shape.getContext('2d');
  c.fillStyle = '#fff';
  const art = h / PX;
  const W = TILE / PX;
  c.fillRect(0, h - Math.floor(art * 0.42) * PX, TILE, Math.floor(art * 0.42) * PX);
  for (let x = 0; x < W;) {
    const r = 6 + Math.floor(rand() * 9);
    const cy = Math.floor(art * (0.42 + rand() * 0.2));
    // Draw the canopy wrapped, so trees at the seam show on both sides.
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy) * 1.3);
      for (let dx = -half; dx <= half; dx++) c.fillRect((((x + dx) % W) + W) % W * PX, (cy + dy) * PX, PX, PX);
    }
    // Trunk, and moss strands hanging off the canopy.
    c.fillRect((x % W) * PX, (cy + r) * PX, PX * 2, h - (cy + r) * PX);
    for (let k = 0; k < 4; k++) {
      const mx = x - r + Math.floor(rand() * r * 2);
      const len = 2 + Math.floor(rand() * 6);
      c.fillRect((((mx % W) + W) % W) * PX, (cy + Math.floor(r * 0.6)) * PX, PX, len * PX);
    }
    x += Math.floor(r * 1.6) + Math.floor(rand() * 6);
  }
  return { shape };
}

const MASKS = { city: cityMask, hills: hillsMask, trees: treesMask };

export class Vista {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} spec   the look's `vista`: { extendTop, layers: [{ kind, depth, height, color, haze, sink, seed }] }
   * @param {object} o      { depth: just under the ground, over: over the grade, terrain }
   */
  constructor(scene, spec, { depth, over, terrain }) {
    this.scene = scene;
    this.spec = spec;
    this.terrain = terrain;
    this.edge = this.edgeY();
    const pin = (o, d) => o.setScrollFactor(0).setOrigin(0).setDepth(d);
    // The sky: a tall gradient strip, laid so its bottom color meets the horizon.
    // (It runs on past the horizon in the bottom color, behind the gaps between far buildings.)
    this.skyTex = scene.textures.exists('fx_vista_sky') ? scene.textures.get('fx_vista_sky') : scene.textures.createCanvas('fx_vista_sky', 4, GAME_H * 3);
    this.sky = pin(scene.add.image(0, 0, 'fx_vista_sky'), depth - 10).setDisplaySize(GAME_W, GAME_H * 3);
    this.stars = pin(scene.add.tileSprite(0, 0, GAME_W, GAME_H, this.starTexture()), depth - 9);
    this.sun = scene.add.image(0, 0, this.sunTexture(0xffffff)).setScrollFactor(0).setDepth(depth - 8).setOrigin(0.5, 0.5);
    this.skyDrawn = null;
    this.layers = spec.layers.map((l, k) => {
      const made = MASKS[l.kind](l.height, l.seed ?? 7 + k);
      const full = l.height + l.rise + BELOW;
      // The skyline on top, solid below it (the land between it and the cliff).
      const shape = canvas(TILE, full);
      const sc = shape.getContext('2d');
      sc.drawImage(made.shape, 0, 0);
      sc.fillStyle = '#fff';
      sc.fillRect(0, l.height, TILE, full - l.height);
      let lights = null;
      if (made.lights) {
        lights = canvas(TILE, full);
        lights.getContext('2d').drawImage(made.lights, 0, 0);
      }
      const key = `fx_vista_${k}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const tex = scene.textures.createCanvas(key, TILE, full);
      const sprite = pin(scene.add.tileSprite(0, 0, GAME_W, full, key), depth - 7 + k);
      let glow = null;
      if (lights) {
        const lkey = `fx_vista_${k}_lights`;
        if (scene.textures.exists(lkey)) scene.textures.remove(lkey);
        scene.textures.addCanvas(lkey, lights);
        glow = pin(scene.add.tileSprite(0, 0, GAME_W, full, lkey), over + 2.5).setBlendMode(Phaser.BlendModes.ADD);
        glow.setMask(this.dropMask().createGeometryMask());
      }
      return { ...l, full, shape, tex, sprite, glow, painted: null };
    });
  }

  /** The cliff edge: the world y where the ground starts, on average along the top of the map. */
  edgeY() {
    const t = this.terrain;
    let sum = 0;
    for (let i = 0; i <= t.cols; i++) {
      let j = 0;
      while (j < t.rows && t.voids.has(t.grid[j][i])) j++;
      sum += j * t.cell;
    }
    return sum / (t.cols + 1);
  }

  /** A shape in the world covering the drop (whole cells only, so lit windows never show over the ground's lip). */
  dropMask() {
    if (this.mask) return this.mask;
    const t = this.terrain;
    const g = this.scene.make.graphics({ add: false }).fillStyle(0xffffff);
    const top = -(this.spec.extendTop ?? 0) - GAME_H;
    for (let i = 0; i < t.cols; i++) {
      let j = 0;
      while (j < t.rows && t.key(i, j) === [...t.voids][0].repeat(4)) j++;
      g.fillRect(i * t.cell, top, t.cell, j * t.cell - top - t.cell / 2);
    }
    this.mask = g;
    return g;
  }

  starTexture() {
    const key = 'fx_vista_stars';
    if (this.scene.textures.exists(key)) return key;
    const tex = this.scene.textures.createCanvas(key, 360, 360);
    const ctx = tex.getContext();
    const rand = createRng(31).random;
    for (let k = 0; k < 70; k++) {
      ctx.fillStyle = rgba(0xffffff, 0.4 + rand() * 0.6);
      const x = Math.floor(rand() * 180) * PX;
      const y = Math.floor(rand() * 180) * PX;
      ctx.fillRect(x, y, PX, PX);
      if (rand() < 0.15) {
        ctx.fillStyle = rgba(0xffffff, 0.35);
        ctx.fillRect(x - PX, y, PX * 3, PX);
        ctx.fillRect(x, y - PX, PX, PX * 3);
      }
    }
    tex.refresh();
    return key;
  }

  /** The sun's disc in a color (rounded, so the evening's blend of colors bakes only a few). */
  sunTexture(color) {
    const step = (c) => Math.min(255, Math.round(c / 24) * 24);
    color = (step((color >> 16) & 255) << 16) | (step((color >> 8) & 255) << 8) | step(color & 255);
    const key = `fx_vista_sun_${color.toString(16)}`;
    if (this.scene.textures.exists(key)) return key;
    const r = 18; // art px
    const tex = this.scene.textures.createCanvas(key, r * 2 * PX, r * 2 * PX);
    const ctx = tex.getContext();
    for (let y = 0; y < r * 2; y++) {
      for (let x = 0; x < r * 2; x++) {
        const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
        if (d > 1) continue;
        ctx.fillStyle = rgba(color, d < 0.62 ? 1 : d < 0.8 ? 0.45 : 0.18);
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }
    tex.refresh();
    return key;
  }

  /** Recolor and move everything for the camera and the light (systems/sky.js). */
  update(light) {
    const cam = this.scene.cameras.main;
    const top = -(this.spec.extendTop ?? 0);
    const { sky } = light;
    // Each layer's skyline on screen; the far layer's is the horizon.
    const base = (l) => Math.round(this.edge - top - l.rise - (cam.scrollY - top) * l.depth);
    const horizon = base(this.spec.layers[0]);
    // Sky: redraw only when its colors change; move it to sit on the horizon.
    if (!this.skyDrawn || !near(this.skyDrawn.top, sky.top) || !near(this.skyDrawn.bottom, sky.bottom)) {
      this.skyDrawn = { ...sky };
      const ctx = this.skyTex.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, GAME_H * 2);
      g.addColorStop(0, rgba(sky.top, 1));
      g.addColorStop(0.5, rgba(lerpColor(sky.top, sky.bottom, 0.45), 1));
      g.addColorStop(1, rgba(sky.bottom, 1));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, GAME_H * 2);
      ctx.fillStyle = rgba(sky.bottom, 1);
      ctx.fillRect(0, GAME_H * 2, 4, GAME_H);
      this.skyTex.refresh();
    }
    this.sky.y = horizon - GAME_H * 2;
    // Stars by how dark the sky's top is; they barely move.
    const dark = 1 - (((sky.top >> 16) & 255) + ((sky.top >> 8) & 255) + (sky.top & 255)) / (3 * 110);
    this.stars.setAlpha(Math.max(0, Math.min(1, dark))).setPosition(0, Math.min(0, horizon - GAME_H));
    this.stars.tilePositionX = cam.scrollX * 0.02;
    // The sun's disc low over the horizon when its light is strong (dawn and evening).
    const sun = light.sun;
    const show = Math.max(0, (sun.alpha - 0.15) * 2);
    this.sun.setVisible(show > 0.02).setAlpha(Math.min(1, show)).setPosition(Math.round(GAME_W * (0.08 + sun.x * 0.84)), Math.round(horizon - 70));
    if (this.sun.visible) this.sun.setTexture(this.sunTexture(lerpColor(sun.color, 0xffffff, 0.35)));
    for (const l of this.layers) {
      const color = lerpColor(l.color, sky.bottom, l.haze);
      if (l.painted === null || !near(l.painted, color)) this.paint(l, color, sky.bottom);
      const y = base(l) - l.height;
      l.sprite.setPosition(0, y);
      l.sprite.tilePositionX = cam.scrollX * l.depth + (l.offset ?? 0);
      if (l.glow) {
        l.glow.setPosition(0, y).setAlpha(Math.max(0, Math.min(1, (light.lights - 0.4) * 0.9)));
        l.glow.tilePositionX = l.sprite.tilePositionX;
      }
    }
  }

  /** Fill a layer's silhouette with its color, misted toward the sky at its feet. */
  paint(l, color, mist) {
    l.painted = color;
    const ctx = l.tex.getContext();
    ctx.clearRect(0, 0, TILE, l.full);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(l.shape, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = rgba(color, 1);
    ctx.fillRect(0, 0, TILE, l.full);
    // Mist settling at the foot of the skyline, and over the land below it.
    const g = ctx.createLinearGradient(0, l.height * 0.4, 0, l.height + 40);
    g.addColorStop(0, rgba(mist, 0));
    g.addColorStop(1, rgba(mist, l.mist ?? 0.6));
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, l.full);
    ctx.globalCompositeOperation = 'source-over';
    l.tex.refresh();
    // A TileSprite copies its texture into a pattern only when its frame is set; make it copy the new colors.
    l.sprite.dirty = true;
    l.sprite.updateTileTexture();
  }
}
