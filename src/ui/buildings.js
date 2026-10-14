// Stand-in pixel buildings for $cott's property ladder (minigames/realty.js),
// one style per `kind` in data/realty.js. Drawn on a 4 px grid with chunky
// rectangles so they sit with the pixel art; PixelLab art replaces them later
// (a texture named `realty_<kind>` wins if it's loaded).
//
// Every building stands on (cx, base): centered, feet on the ground line.

const P = 4; // one art pixel
const OUTLINE = 0x120d1c;
const snap = (v) => Math.round(v / P) * P;

/** A small deterministic hash, so a unit's lit windows don't change between redraws. */
function lit(seed, i) {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x) > 0.42;
}

/**
 * Draw a building into graphics `g`. `w`/`h` are its footprint and height in
 * screen px (snapped to the grid); `trophy` adds the crown that marks the goal.
 */
export function drawBuilding(g, kind, { cx, base, w, h, seed = 1, trophy = false }) {
  const x = snap(cx - w / 2);
  const y = snap(base);
  w = snap(w);
  h = snap(h);
  const draw = KINDS[kind] ?? KINDS.apartment;
  draw(g, { x, y, w, h, seed, trophy });
}

function box(g, x, y, w, h, color) {
  g.fillStyle(OUTLINE, 1).fillRect(x - P, y - P, w + 2 * P, h + 2 * P);
  g.fillStyle(color, 1).fillRect(x, y, w, h);
}

/** A gable roof: rows of rect, each 2 px narrower per side, from `y` (its bottom) up. */
function gable(g, cx, y, w, rows, color, step = P) {
  g.fillStyle(OUTLINE, 1);
  for (let r = 0; r < rows; r++) {
    const rw = w - r * 2 * step;
    if (rw <= 0) break;
    g.fillRect(cx - rw / 2 - P, y - (r + 1) * P - P, rw + 2 * P, P + P);
  }
  g.fillStyle(color, 1);
  for (let r = 0; r < rows; r++) {
    const rw = w - r * 2 * step;
    if (rw <= 0) break;
    g.fillRect(cx - rw / 2, y - (r + 1) * P, rw, P);
  }
}

/** A grid of windows, lit or dark by the hash. */
function windows(g, x, y, w, h, { cols, rows, ww = 2 * P, wh = 3 * P, on, off, seed }) {
  const gx = (w - cols * ww) / (cols + 1);
  const gy = (h - rows * wh) / (rows + 1);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      g.fillStyle(lit(seed, i++) ? on : off, 1).fillRect(snap(x + gx + c * (ww + gx)), snap(y + gy + r * (wh + gy)), ww, wh);
    }
  }
}

function crown(g, cx, top) {
  // A gold crown floating over the trophy.
  g.fillStyle(OUTLINE, 1).fillRect(cx - 5 * P, top - 5 * P, 10 * P, 4 * P);
  g.fillStyle(0xffd166, 1);
  g.fillRect(cx - 4 * P, top - 3 * P, 8 * P, P);
  g.fillRect(cx - 4 * P, top - 4 * P, P, P);
  g.fillRect(cx - P / 2 - P / 2, top - 4 * P, P, P);
  g.fillRect(cx + 3 * P, top - 4 * P, P, P);
}

const KINDS = {
  // ---- Tokyo ----
  machiya(g, { x, y, w, h, seed }) {
    const wallH = snap(h * 0.55);
    box(g, x, y - wallH, w, wallH, 0x5a3a2a);
    // Paper sliding doors with a lattice.
    const dw = snap(w * 0.3);
    for (const dx of [snap(w * 0.12), snap(w * 0.58)]) {
      g.fillStyle(0xe8dcc0, 1).fillRect(x + dx, y - wallH + 3 * P, dw, wallH - 3 * P);
      g.fillStyle(0x8a6a4a, 1);
      for (let lx = x + dx + 2 * P; lx < x + dx + dw; lx += 2 * P + P) g.fillRect(lx, y - wallH + 3 * P, P / 2, wallH - 3 * P);
    }
    // Noren curtain and a red lantern.
    g.fillStyle(0x2c4f8a, 1).fillRect(x + snap(w * 0.12), y - wallH + 3 * P, dw, 2 * P);
    g.fillStyle(0xd94f3a, 1).fillRect(x + w - 3 * P, y - wallH + P, 2 * P, 3 * P);
    // A wide, low tiled roof with an overhang.
    const roofRows = Math.max(3, snap(h * 0.4) / P);
    gable(g, x + w / 2, y - wallH, w + 4 * P, roofRows, 0x3a3d4a, P * 1.5);
    g.fillStyle(0x5a5f72, 1).fillRect(x - 2 * P, y - wallH - P, w + 4 * P, P);
    if (lit(seed, 9)) g.fillStyle(0xffd166, 0.9).fillRect(x + snap(w * 0.2), y - wallH + 5 * P, P, P);
  },

  apartment(g, { x, y, w, h, seed }) {
    box(g, x, y - h, w, h, 0x8d8fa6);
    windows(g, x, y - h + P, w - 3 * P, h - 3 * P, { cols: 3, rows: Math.max(2, Math.floor(h / (7 * P))), on: 0xffd98a, off: 0x3b3d52, seed });
    // Balcony rails.
    g.fillStyle(0x6a6c82, 1);
    for (let by = y - h + 6 * P; by < y - P; by += 6 * P) g.fillRect(x, by, w - 3 * P, P);
    // A neon sign down the side.
    g.fillStyle(0xff5c8a, 1).fillRect(x + w - 3 * P, y - h + 2 * P, 2 * P, snap(h * 0.6));
    g.fillStyle(0xffffff, 0.8);
    for (let sy = y - h + 3 * P; sy < y - h + snap(h * 0.6); sy += 3 * P) g.fillRect(x + w - 2 * P - P / 2, sy, P, P);
    g.fillStyle(0x3b3d52, 1).fillRect(x + snap(w * 0.4), y - 4 * P, 3 * P, 4 * P);
  },

  tower(g, { x, y, w, h, seed, trophy }) {
    const body = trophy ? snap(h * 0.82) : h;
    box(g, x, y - body, w, body, 0x2a3550);
    windows(g, x, y - body, w, body, { cols: 4, rows: Math.floor(body / (5 * P)), ww: 2 * P, wh: 2 * P, on: trophy ? 0xffd166 : 0x7fe3ff, off: 0x1d2640, seed });
    // A neon stripe and a stepped crown.
    g.fillStyle(0xff5c8a, 1).fillRect(x, y - body + 2 * P, w, P);
    box(g, x + 2 * P, y - body - 3 * P, w - 4 * P, 3 * P, 0x3a4766);
    if (trophy) {
      // The spire.
      box(g, x + w / 2 - 2 * P, y - h, 4 * P, h - body - 3 * P, 0xb8c4e0);
      g.fillStyle(0xffd166, 1).fillRect(x + w / 2 - P, y - h - 3 * P, 2 * P, 3 * P);
      crown(g, x + w / 2, y - h - 4 * P);
    } else {
      g.fillStyle(OUTLINE, 1).fillRect(x + w / 2 - P, y - body - 9 * P, 2 * P, 6 * P);
      g.fillStyle(0xff5c5c, 1).fillRect(x + w / 2 - P, y - body - 10 * P, 2 * P, P);
    }
  },

  // ---- Los Angeles ----
  bungalow(g, { x, y, w, h, seed }) {
    const bw = snap(w * 0.78);
    const wallH = snap(h * 0.55);
    box(g, x, y - wallH, bw, wallH, 0xe8d2a6);
    gable(g, x + bw / 2, y - wallH, bw + 2 * P, snap(h * 0.3) / P, 0x8a4b38);
    g.fillStyle(0x5a3a2a, 1).fillRect(x + snap(bw * 0.4), y - 6 * P, 3 * P, 6 * P);
    g.fillStyle(lit(seed, 1) ? 0xffd98a : 0x4a5a7a, 1).fillRect(x + 2 * P, y - wallH + 3 * P, 4 * P, 3 * P);
    g.fillStyle(lit(seed, 2) ? 0xffd98a : 0x4a5a7a, 1).fillRect(x + bw - 6 * P, y - wallH + 3 * P, 4 * P, 3 * P);
    // A palm tree.
    const px = x + w - 3 * P;
    g.fillStyle(0x6a4a2a, 1);
    for (let t = 0; t < h; t += P) g.fillRect(px + (t > h * 0.6 ? P : 0), y - t - P, P, P);
    g.fillStyle(0x3ddc84, 1);
    const top = y - h;
    for (let f = 1; f <= 4; f++) {
      g.fillRect(px - f * P, top + f * P / 2, P, P);
      g.fillRect(px + P + f * P, top + f * P / 2, P, P);
    }
    g.fillRect(px - P, top - P, 3 * P, P);
  },

  villa(g, { x, y, w, h, seed }) {
    const wallH = snap(h * 0.75);
    box(g, x, y - wallH, w, wallH, 0xf0e6d6);
    // Red tile roof, shallow.
    gable(g, x + w / 2, y - wallH, w + 4 * P, 3, 0xc0503a, 3 * P);
    // Arched windows on two floors.
    for (let fl = 0; fl < 2; fl++) {
      for (let c = 0; c < 3; c++) {
        const wx = x + snap((w * (c + 1)) / 4) - P;
        const wy = y - wallH + 3 * P + fl * snap(wallH * 0.45);
        g.fillStyle(lit(seed, fl * 3 + c) ? 0xffd98a : 0x4a5a7a, 1).fillRect(wx, wy + P, 2 * P, 3 * P);
        g.fillRect(wx + P / 2, wy, P, P);
      }
    }
    g.fillStyle(0x3a2a20, 1).fillRect(x + snap(w * 0.1), y - wallH + snap(wallH * 0.45) - P, snap(w * 0.8), P);
  },

  mansion(g, { x, y, w, h, seed, trophy }) {
    const lowH = snap(h * 0.45);
    box(g, x, y - lowH, w, lowH, 0xf2f2ee);
    windows(g, x, y - lowH, w, lowH, { cols: 4, rows: 1, ww: 4 * P, wh: snap(lowH * 0.5), on: 0x7fe3ff, off: 0x3a6a8a, seed });
    const upW = snap(w * 0.65);
    const upH = snap(h * (trophy ? 0.3 : 0.4));
    box(g, x + snap(w * 0.3), y - lowH - upH, upW, upH, 0xe2e2dc);
    windows(g, x + snap(w * 0.3), y - lowH - upH, upW, upH, { cols: 3, rows: 1, ww: 3 * P, wh: snap(upH * 0.5), on: 0x7fe3ff, off: 0x3a6a8a, seed: seed + 9 });
    if (trophy) {
      const topW = snap(w * 0.4);
      const topH = snap(h * 0.22);
      box(g, x + snap(w * 0.15), y - h, topW, topH, 0xffffff);
      g.fillStyle(0xffd166, 1).fillRect(x + snap(w * 0.15), y - h, topW, P);
      crown(g, x + snap(w * 0.15) + topW / 2, y - h - P);
    }
    // The pool out front.
    g.fillStyle(0x3fb6e8, 1).fillRect(x + 2 * P, y - P, w - 4 * P, P);
  },

  // ---- Seattle ----
  craftsman(g, { x, y, w, h, seed }) {
    const wallH = snap(h * 0.55);
    const colors = [0x6b8f71, 0x5d7a9c, 0x9c6b5d];
    box(g, x, y - wallH, w, wallH, colors[Math.floor(seed) % colors.length]);
    // Siding lines.
    g.fillStyle(0x000000, 0.18);
    for (let sy = y - wallH + 2 * P; sy < y; sy += 2 * P) g.fillRect(x, sy, w, P / 2);
    gable(g, x + w / 2, y - wallH, w + 4 * P, snap(h * 0.45) / P, 0x3e3a3a);
    // Chimney, porch, windows.
    box(g, x + w - 4 * P, y - wallH - snap(h * 0.35), 2 * P, 4 * P, 0x8a4b38);
    g.fillStyle(0xf0e6d6, 1).fillRect(x, y - 5 * P, w, P);
    g.fillRect(x + P, y - 4 * P, P, 4 * P);
    g.fillRect(x + w - 2 * P, y - 4 * P, P, 4 * P);
    g.fillStyle(lit(seed, 3) ? 0xffd98a : 0x2a3540, 1).fillRect(x + 3 * P, y - wallH + 2 * P, 3 * P, 3 * P);
    g.fillStyle(0x3a2a20, 1).fillRect(x + w - 7 * P, y - 4 * P, 2 * P, 4 * P);
  },

  condo(g, { x, y, w, h, seed }) {
    box(g, x, y - h, w, h, 0x4f6d7a);
    windows(g, x, y - h, w, h, { cols: 3, rows: Math.max(2, Math.floor(h / (6 * P))), ww: 3 * P, wh: 2 * P, on: 0xffd98a, off: 0x2a3a44, seed });
    g.fillStyle(0xc9d6d9, 1);
    for (let by = y - h + 5 * P; by < y - P; by += 6 * P) g.fillRect(x + P, by, w - 2 * P, P);
    box(g, x + 2 * P, y - h - 3 * P, 4 * P, 2 * P, 0x6a7a80);
  },

  glass(g, { x, y, w, h, seed, trophy }) {
    if (trophy) {
      // A needle: a slim shaft with a saucer on top.
      const shaftW = 4 * P;
      box(g, x + w / 2 - shaftW / 2, y - h + 8 * P, shaftW, h - 8 * P, 0xc9d6d9);
      box(g, x + snap(w * 0.1), y - h + 4 * P, snap(w * 0.8), 3 * P, 0xe8eef0);
      g.fillStyle(0xffd166, 1).fillRect(x + snap(w * 0.1), y - h + 6 * P, snap(w * 0.8), P);
      windows(g, x + snap(w * 0.1), y - h + 4 * P, snap(w * 0.8), 2 * P, { cols: 6, rows: 1, ww: P, wh: P, on: 0xffd166, off: 0x5a6a70, seed });
      g.fillStyle(OUTLINE, 1).fillRect(x + w / 2 - P / 2, y - h, P, 4 * P);
      crown(g, x + w / 2, y - h);
      return;
    }
    box(g, x, y - h, w, h, 0x5aa0b8);
    // Mullions and a sloped top.
    g.fillStyle(0x3a7a90, 1);
    for (let mx = x + 3 * P; mx < x + w; mx += 3 * P) g.fillRect(mx, y - h, P / 2, h);
    windows(g, x, y - h, w, h, { cols: 3, rows: Math.floor(h / (6 * P)), ww: 2 * P, wh: P, on: 0xe8fbff, off: 0x4a8aa0, seed });
    for (let s = 0; s < 4; s++) g.fillStyle(0x7fc4d8, 1).fillRect(x + s * snap(w / 4), y - h - (4 - s) * P, snap(w / 4), (4 - s) * P);
  },
};

/** A little red-and-white FOR SALE sign on a post, feet at (x, base). */
export function drawForSale(g, x, base) {
  x = snap(x);
  base = snap(base);
  g.fillStyle(OUTLINE, 1).fillRect(x - P, base - 7 * P, 7 * P, 4 * P);
  g.fillStyle(0xff5c5c, 1).fillRect(x, base - 6 * P, 5 * P, 2 * P);
  g.fillStyle(0xffffff, 1).fillRect(x + P, base - 5 * P - P / 2, 3 * P, P / 2);
  g.fillStyle(0x6a4a2a, 1).fillRect(x + 2 * P, base - 4 * P, P, 4 * P);
}
