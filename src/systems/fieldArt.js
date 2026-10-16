// Procedural stand-ins for region art (CLAUDE.md §6.6, §8.4): walker sprite
// sheets, scenery props, a painted ground layer, and the walk mask. Each is
// drawn at art resolution, given a 1-art-pixel dark outline where it's a
// sprite, then blown up FIELD.artPx× with nearest-neighbor, so it's baked at
// final size (nothing is setScale'd).
//
// Every texture uses the key real art will load under, so finished files can
// replace these without touching the scene.

import { FIELD } from '../config.js';
import { fieldRows, FIELD_PALETTES } from '../data/placeholders.js';
import { createRng } from './rng.js';

const OUTLINE = '#120d1c';

// Sheet layout, shared with real art: one row per view, columns are
// idle, walk 1–4. Right-facing is the left row mirrored.
export const SHEET_VIEWS = ['down', 'up', 'left'];
export const SHEET_COLS = 5;
const COLUMN_POSES = ['stand', 'stepA', 'stand', 'stepB', 'stand'];

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Add a 1 px dark outline around every opaque pixel (grows the canvas by 1 px each side). */
function outlined(src) {
  const { width: w, height: h } = src;
  const data = src.getContext('2d').getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
  const out = canvas(w + 2, h + 2);
  const ctx = out.getContext('2d');
  ctx.fillStyle = OUTLINE;
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  ctx.drawImage(src, 1, 1);
  return out;
}

function upscaled(src, px) {
  const out = canvas(src.width * px, src.height * px);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

function rowsCanvas(rows, palette) {
  const c = canvas(rows[0].length, rows.length);
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = palette[ch] ?? '#ff00ff';
    ctx.fillRect(x, y, 1, 1);
  }));
  return c;
}

// ---- Walkers -----------------------------------------------------------------

/** A walker sheet (views × idle + 4 walk frames) under `key`, numbered like load.spritesheet. */
export function bakeWalkerSheet(scene, key) {
  const palette = FIELD_PALETTES[key];
  const { w: fw, h: fh } = FIELD.frame;
  const sheet = canvas(fw * SHEET_COLS, fh * SHEET_VIEWS.length);
  const ctx = sheet.getContext('2d');
  SHEET_VIEWS.forEach((view, row) => {
    COLUMN_POSES.forEach((pose, col) => {
      const art = upscaled(outlined(rowsCanvas(fieldRows(view, pose), palette)), FIELD.artPx);
      // Feet at the bottom center of the frame.
      ctx.drawImage(art, col * fw + Math.round((fw - art.width) / 2), row * fh + fh - art.height - 2);
    });
  });
  const tex = scene.textures.addCanvas(key, sheet);
  for (let i = 0; i < SHEET_COLS * SHEET_VIEWS.length; i++) {
    tex.add(i, 0, (i % SHEET_COLS) * fw, Math.floor(i / SHEET_COLS) * fh, fw, fh);
  }
}

/** Idle and walk animations for a walker sheet: `${key}_walk_${view}`. Idle is a frame index. */
export function walkerAnims(scene, key) {
  SHEET_VIEWS.forEach((view, row) => {
    const anim = `${key}_walk_${view}`;
    if (scene.anims.exists(anim)) return;
    scene.anims.create({
      key: anim,
      frames: scene.anims.generateFrameNumbers(key, { start: row * SHEET_COLS + 1, end: row * SHEET_COLS + 4 }),
      frameRate: FIELD.walkFps,
      repeat: -1,
    });
  });
}

/** Sheet frame and mirroring for a facing: right reuses the left row, flipped. */
export function facingFrame(facing) {
  const view = facing === 'right' ? 'left' : facing;
  return { row: SHEET_VIEWS.indexOf(view), view, flip: facing === 'right' };
}

// ---- Props ---------------------------------------------------------------------

/** Fill a noisy ellipse at art resolution. */
function blob(ctx, rand, cx, cy, rx, ry, color, rough = 0.12) {
  ctx.fillStyle = color;
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1 - rough + rand.random() * rough * 2) ctx.fillRect(x, y, 1, 1);
    }
  }
}

const PROPS = {
  // A swamp cypress: flared roots, a dark canopy, hanging moss.
  prop_cypress(ctx, rand) {
    const c = { w: 32, h: 48 };
    ctx.fillStyle = '#33241a';
    ctx.fillRect(13, 22, 7, 24);
    ctx.fillRect(10, 42, 13, 4);
    ctx.fillRect(8, 44, 4, 2);
    ctx.fillRect(21, 44, 4, 2);
    ctx.fillStyle = '#4a3524';
    ctx.fillRect(14, 22, 3, 23);
    blob(ctx, rand, 16, 14, 14, 11, '#24391f');
    blob(ctx, rand, 13, 11, 10, 8, '#2f4a28');
    blob(ctx, rand, 19, 9, 8, 6, '#3a5c32');
    blob(ctx, rand, 14, 6, 5, 3, '#4f7a3a');
    ctx.fillStyle = '#7c8a6a';
    for (const [x, len] of [[5, 7], [9, 10], [22, 9], [26, 6], [17, 8]]) {
      for (let i = 0; i < len; i++) if (rand.random() > 0.2) ctx.fillRect(x + (i % 3 === 2 ? 1 : 0), 18 + i, 1, 1);
    }
    return c;
  },
  // A dead snag: bare grey trunk and a few branches.
  prop_snag(ctx) {
    const c = { w: 22, h: 34 };
    ctx.fillStyle = '#5a5048';
    ctx.fillRect(9, 6, 4, 27);
    ctx.fillRect(7, 30, 8, 3);
    for (const [x, y, w, h] of [[4, 10, 5, 2], [3, 6, 2, 5], [13, 14, 5, 2], [17, 9, 2, 6], [6, 20, 3, 2], [11, 2, 2, 5]]) ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#776b60';
    ctx.fillRect(10, 6, 1, 25);
    return c;
  },
  // A wooden sign; the scene writes its label on the board.
  prop_sign() {
    return { w: 26, h: 22, draw: (ctx) => {
      ctx.fillStyle = '#5a3e26';
      ctx.fillRect(12, 10, 3, 12);
      ctx.fillRect(0, 0, 26, 11);
      ctx.fillStyle = '#8a6a42';
      ctx.fillRect(1, 1, 24, 9);
      ctx.fillStyle = '#a07c50';
      ctx.fillRect(1, 1, 24, 1);
    } };
  },
  // Derek's battle station: a desk, three monitors of red candles, a gaming chair.
  prop_setup(ctx) {
    const c = { w: 44, h: 30 };
    ctx.fillStyle = '#3a2e44';
    ctx.fillRect(2, 16, 34, 4);
    ctx.fillRect(4, 20, 2, 9);
    ctx.fillRect(32, 20, 2, 9);
    for (const x of [3, 14, 25]) {
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(x, 4, 10, 8);
      ctx.fillRect(x + 4, 12, 2, 4);
      ctx.fillStyle = '#0d2a20';
      ctx.fillRect(x + 1, 5, 8, 6);
      ctx.fillStyle = '#ff4f4f';
      for (let i = 0; i < 8; i++) ctx.fillRect(x + 1 + i, 5 + Math.min(5, Math.floor(i * 0.7)), 1, 1);
    }
    ctx.fillStyle = '#7fe7ff';
    ctx.fillRect(8, 14, 2, 2);
    ctx.fillRect(28, 14, 2, 2);
    // The chair, pulled out in front.
    ctx.fillStyle = '#c8313a';
    ctx.fillRect(36, 8, 7, 14);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(37, 10, 5, 3);
    ctx.fillRect(38, 22, 3, 5);
    ctx.fillRect(35, 27, 9, 2);
    return c;
  },
  // A sagging orange tarp tent with a hand-painted banner.
  prop_tent(ctx) {
    const c = { w: 36, h: 26 };
    for (let y = 0; y < 22; y++) {
      const half = Math.round(4 + y * 0.72);
      ctx.fillStyle = '#d9822b';
      ctx.fillRect(18 - half, y + 3, half, 1);
      ctx.fillStyle = '#a65a1a';
      ctx.fillRect(18, y + 3, half, 1);
    }
    ctx.fillStyle = '#2a1a10';
    for (let y = 12; y < 25; y++) ctx.fillRect(18 - Math.round((y - 12) * 0.35), y, Math.round((y - 12) * 0.7) + 1, 1);
    ctx.fillStyle = '#5a3e26';
    ctx.fillRect(17, 0, 2, 4);
    ctx.fillStyle = '#f2eaff';
    ctx.fillRect(4, 18, 6, 3);
    return c;
  },
};

/** Bake every prop texture that doesn't exist yet (real art wins). */
export function bakeProps(scene) {
  const rand = createRng(424242);
  for (const [key, paint] of Object.entries(PROPS)) {
    if (scene.textures.exists(key)) continue;
    const probe = canvas(64, 64);
    const spec = paint(probe.getContext('2d'), rand);
    const c = canvas(spec.w, spec.h);
    if (spec.draw) spec.draw(c.getContext('2d'));
    else c.getContext('2d').drawImage(probe, 0, 0);
    scene.textures.addCanvas(key, upscaled(outlined(c), FIELD.artPx));
  }
}

// ---- Ground and walk mask ---------------------------------------------------------

/**
 * Paint a region's placeholder ground (`<id>_base`, world size) and walk mask
 * (`<id>_walk`, art size; white is walkable) from its `placeholder` shapes.
 */
export function bakeRegionPlaceholder(scene, map) {
  const px = FIELD.artPx;
  const ph = map.placeholder;
  const w = Math.ceil(map.size.w / px);
  const h = Math.ceil(map.size.h / px);
  const rand = createRng(ph.seed);
  const a = (v) => v / px; // world px → art px

  const base = canvas(w, h);
  const g = base.getContext('2d');
  const mask = canvas(w, h);
  const m = mask.getContext('2d');
  m.fillStyle = '#ffffff';
  m.fillRect(0, 0, w, h);

  // Swamp grass, speckled.
  const grass = ['#4a5a32', '#45542f', '#4f6036', '#3f4e2b'];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = rand.random();
      g.fillStyle = r < 0.55 ? grass[0] : r < 0.75 ? grass[1] : r < 0.92 ? grass[2] : grass[3];
      g.fillRect(x, y, 1, 1);
    }
  }
  // The trampled clearing around Derek's camp.
  if (ph.clearing) blob(g, rand, a(ph.clearing.x), a(ph.clearing.y), a(ph.clearing.rx), a(ph.clearing.ry), '#5e5a38', 0.2);

  // The dirt path: stamped discs along the polyline, with a darker edge.
  const stamp = (color, radius, where = () => true) => {
    g.fillStyle = color;
    for (let i = 1; i < ph.path.length; i++) {
      const [x0, y0] = ph.path[i - 1].map(a);
      const [x1, y1] = ph.path[i].map(a);
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let s = 0; s <= steps; s++) {
        const cx = x0 + ((x1 - x0) * s) / steps;
        const cy = y0 + ((y1 - y0) * s) / steps;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = Math.round(cx + dx);
            const y = Math.round(cy + dy);
            if (dx * dx + dy * dy <= radius * radius + rand.random() * radius && where(x, y)) g.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  };
  const pathR = Math.round(a(ph.pathWidth) / 2);
  stamp('#5e4c33', pathR + 1);
  stamp('#7a6444', pathR - 1);

  // Grass tufts and the odd yellow flower, kept off the path.
  for (let i = 0; i < w * h * 0.012; i++) {
    const x = rand.int(0, w - 1);
    const y = rand.int(0, h - 1);
    const under = g.getImageData(x, y, 1, 1).data;
    if (under[0] > 0x70) continue; // dirt
    g.fillStyle = rand.chance(0.08) ? '#c9b458' : rand.pick(['#62763e', '#71874a']);
    g.fillRect(x, y, 1, 1);
    if (rand.chance(0.6)) g.fillRect(x - 1, y - 1, 1, 1);
    if (rand.chance(0.6)) g.fillRect(x + 1, y - 1, 1, 1);
  }

  // Pools: a muddy rim, dark water, ripples, lily pads.
  for (const p of ph.pools) {
    const [cx, cy, rx, ry] = [a(p.x), a(p.y), a(p.rx), a(p.ry)];
    blob(g, rand, cx, cy, rx + 2, ry + 2, '#3a3a26', 0.1);
    blob(g, rand, cx, cy, rx, ry, '#24453f', 0.06);
    blob(g, rand, cx - rx * 0.1, cy - ry * 0.15, rx * 0.7, ry * 0.6, '#2e5a50', 0.15);
    for (let i = 0; i < (rx * ry) / 60; i++) {
      const t = rand.random() * Math.PI * 2;
      const r = Math.sqrt(rand.random()) * 0.8;
      const x = Math.round(cx + Math.cos(t) * rx * r);
      const y = Math.round(cy + Math.sin(t) * ry * r);
      if (rand.chance(0.5)) {
        g.fillStyle = '#5c8f7f';
        g.fillRect(x, y, 3, 1);
      } else {
        g.fillStyle = '#5e8f3e';
        g.fillRect(x, y, 3, 2);
        g.fillRect(x + 1, y - 1, 1, 1);
        if (rand.chance(0.25)) {
          g.fillStyle = '#e98fb0';
          g.fillRect(x + 1, y, 1, 1);
        }
      }
    }
    // Water isn't walkable; the rim is (it's just mud).
    m.fillStyle = '#000000';
    blob(m, rand, cx, cy, rx * 0.96, ry * 0.94, '#000000', 0);
  }

  // Islands: dry land back inside a pool (walkable).
  for (const i of ph.islands ?? []) {
    blob(g, rand, a(i.x), a(i.y), a(i.rx), a(i.ry), grass[0], 0.06);
    blob(m, rand, a(i.x), a(i.y), a(i.rx), a(i.ry), '#ffffff', 0);
  }

  // Boardwalks over the water.
  for (const b of ph.boardwalks) {
    const [x, y, bw, bh] = [a(b.x), a(b.y), a(b.w), a(b.h)].map(Math.round);
    g.fillStyle = '#4e3826';
    g.fillRect(x - 1, y, bw + 2, bh);
    for (let py = y; py < y + bh; py += 3) {
      g.fillStyle = rand.pick(['#8a6a44', '#7e6040', '#94744c']);
      g.fillRect(x, py, bw, 2);
    }
    g.fillStyle = '#3a2a1c';
    for (let py = y; py < y + bh; py += 9) {
      g.fillRect(x - 2, py, 2, 3);
      g.fillRect(x + bw, py, 2, 3);
    }
    m.fillStyle = '#ffffff';
    m.fillRect(x, y, bw, bh);
  }

  // Dense reeds around the edges.
  const border = Math.round(a(ph.border));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge >= border + rand.int(0, 2)) continue;
      g.fillStyle = edge < border * 0.5 ? '#1f2a18' : rand.pick(['#2c3a22', '#34442a']);
      g.fillRect(x, y, 1, 1);
    }
  }
  for (let i = 0; i < (w + h) * 3; i++) {
    const side = rand.int(0, 3);
    const along = rand.random();
    const depth = rand.int(0, border);
    const x = side === 0 ? depth : side === 1 ? w - 1 - depth : Math.round(along * w);
    const y = side === 2 ? depth : side === 3 ? h - 1 - depth : Math.round(along * h);
    g.fillStyle = rand.pick(['#5b6b34', '#7a8a44', '#46552c']);
    g.fillRect(x, y - 3, 1, 4);
  }
  m.fillStyle = '#000000';
  m.fillRect(0, 0, w, border);
  m.fillRect(0, h - border, w, border);
  m.fillRect(0, 0, border, h);
  m.fillRect(w - border, 0, border, h);

  // Exits cut through the reeds, and the path is painted back where it runs through them.
  for (const e of map.exits) {
    m.fillStyle = '#ffffff';
    m.fillRect(Math.floor(a(e.x)), Math.floor(a(e.y)) - border, Math.ceil(a(e.w)), Math.ceil(a(e.h)) + border * 2);
  }
  const inReeds = (x, y) => Math.min(x, y, w - 1 - x, h - 1 - y) < border + 3;
  stamp('#5e4c33', pathR + 1, inReeds);
  stamp('#7a6444', pathR - 1, inReeds);

  scene.textures.addCanvas(`${map.id}_base`, upscaled(base, px));
  scene.textures.addCanvas(`${map.id}_walk`, mask);
}

/** Read a walk mask texture into a lookup: (u, v) in 0..1 → walkable. */
export function maskSampler(scene, key) {
  const src = scene.textures.get(key).getSourceImage();
  const c = canvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  return (u, v) => {
    const x = Math.min(c.width - 1, Math.max(0, Math.floor(u * c.width)));
    const y = Math.min(c.height - 1, Math.max(0, Math.floor(v * c.height)));
    const i = (y * c.width + x) * 4;
    return data[i + 3] > 127 && data[i] + data[i + 1] + data[i + 2] > 384;
  };
}
