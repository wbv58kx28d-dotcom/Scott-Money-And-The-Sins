// Stand-in isometric buildings for the property ladder (minigames/realty.js),
// for cities without PixelLab art yet (data/realty.js `art`). One look per
// `kind`: a box on a little plot, with walls, a roof, and windows, drawn on a
// 4 px grid (2 art px at the game's 2× density), at the same size as the real
// sprites (128 px wide, standing on the bottom of the image).

const P = 4;
const OUTLINE = 0x120d1c;

// Walls (left, right), roof, and window lit/dark.
const LOOKS = {
  machiya: { left: 0x6a4a34, right: 0x52382a, roof: 0x3a3d4a, lit: 0xffd98a, dark: 0x3b2e28, roofPeak: true },
  apartment: { left: 0xb8a888, right: 0x968a70, roof: 0xd8ccb0, lit: 0xffd98a, dark: 0x4a4a5a },
  tower: { left: 0x3a4a78, right: 0x2a3658, roof: 0x5a6a98, lit: 0x7fe3ff, dark: 0x1d2640 },
  bungalow: { left: 0xe8d2a6, right: 0xc8b088, roof: 0x8a4b38, lit: 0xffd98a, dark: 0x4a5a7a, roofPeak: true },
  villa: { left: 0xf0e6d6, right: 0xd0c4b2, roof: 0xc0503a, lit: 0xffd98a, dark: 0x4a5a7a, roofPeak: true },
  mansion: { left: 0xf2f2ee, right: 0xd2d2cc, roof: 0xe8e8e2, lit: 0x7fe3ff, dark: 0x3a6a8a },
  craftsman: { left: 0x6b8f71, right: 0x557358, roof: 0x3e3a3a, lit: 0xffd98a, dark: 0x2a3540, roofPeak: true },
  condo: { left: 0x4f6d7a, right: 0x3e5763, roof: 0x6a8a96, lit: 0xffd98a, dark: 0x2a3a44 },
  glass: { left: 0x5aa0b8, right: 0x46829a, roof: 0x7fc4d8, lit: 0xe8fbff, dark: 0x3a7a90 },
};
export const STANDIN_HEIGHT = { low: 40, mid: 76, high: 150, trophy: 230 };
export const STANDIN_SIZE = { w: 128, pad: 40, plot: 36 }; // texture is w × (height + pad + plot)

/** A small deterministic hash, so a building's lit windows stay put. */
function lit(seed, i) {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x) > 0.45;
}

/**
 * Draw a stand-in into graphics `g`, in a texture of STANDIN_SIZE.w ×
 * (h + pad + plot): plot at the bottom, building `h` px tall above it.
 */
export function drawIsoBuilding(g, kind, { h, seed = 1, trophy = false }) {
  const look = LOOKS[kind] ?? LOOKS.apartment;
  const W = STANDIN_SIZE.w;
  const H = h + STANDIN_SIZE.pad + STANDIN_SIZE.plot;
  const cx = W / 2;
  // The plot: a diamond 112 × 56 at the bottom, with a slab edge.
  const plotY = H - 32; // plot center
  const diamond = (x, y, hw, hh) => [
    { x, y: y - hh }, { x: x + hw, y }, { x, y: y + hh }, { x: x - hw, y },
  ];
  g.fillStyle(0x2a2630, 1).fillPoints(diamond(cx, plotY + 4, 56, 28), true);
  g.fillStyle(0x5a5a66, 1).fillPoints(diamond(cx, plotY, 56, 28), true);
  // The box: a footprint diamond 72 × 36, walls up `h`.
  const hw = trophy ? 40 : 36;
  const hh = hw / 2;
  const base = plotY;
  const top = base - h;
  const L = { x: cx - hw, y: base };
  const F = { x: cx, y: base + hh };
  const R = { x: cx + hw, y: base };
  const up = (p) => ({ x: p.x, y: p.y - h });
  g.fillStyle(OUTLINE, 1).fillPoints([{ x: L.x - P, y: L.y }, { x: F.x, y: F.y + P }, { x: R.x + P, y: R.y }, { x: R.x + P, y: top }, { x: cx, y: top - hh - P }, { x: L.x - P, y: top }], true);
  g.fillStyle(look.left, 1).fillPoints([L, F, up(F), up(L)], true);
  g.fillStyle(look.right, 1).fillPoints([F, R, up(R), up(F)], true);
  g.fillStyle(look.roof, 1).fillPoints([up(L), up(F), up(R), { x: cx, y: top - hh }], true);
  // Windows: rows of little rects on both walls, following the slope.
  const rows = Math.max(1, Math.floor((h - 16) / 20));
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 3; c++) {
      const t = (c + 0.6) / 3.4;
      const yOff = 12 + r * 20;
      // Left wall: from L to F.
      const lx = L.x + (F.x - L.x) * t;
      const ly = L.y + (F.y - L.y) * t - h + yOff;
      g.fillStyle(lit(seed, n++) ? look.lit : look.dark, 1).fillRect(Math.round(lx), Math.round(ly), P * 2, P * 2);
      const rx = F.x + (R.x - F.x) * t;
      const ry = F.y + (R.y - F.y) * t - h + yOff;
      g.fillStyle(lit(seed, n++) ? look.lit : look.dark, 1).fillRect(Math.round(rx) - P * 2, Math.round(ry), P * 2, P * 2);
    }
  }
  if (look.roofPeak) {
    // A pitched roof: a ridge rising over the box.
    g.fillStyle(look.roof, 1).fillPoints([up(L), up(F), { x: cx, y: top - 20 }], true);
    g.fillStyle(Phaser.Display.Color.ValueToColor(look.roof).darken(15).color, 1).fillPoints([up(F), up(R), { x: cx, y: top - 20 }], true);
  }
  if (trophy) {
    // A gold crown on top.
    g.fillStyle(0xffd166, 1).fillRect(cx - 12, top - hh - 24, 24, 12);
    g.fillRect(cx - 12, top - hh - 32, P, 8).fillRect(cx - 2, top - hh - 36, P, 12).fillRect(cx + 8, top - hh - 32, P, 8);
  }
}
