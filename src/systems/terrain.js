// A region's ground as data (CLAUDE.md §6.11): a grid of terrain codes on
// the CORNERS of the map's cells (one letter each, like 'w' water, 'g' grass;
// the tileset defines them). Each cell is drawn with the tile whose four
// corners match (Wang autotiling, tiles from PixelLab), so painting a corner
// reshapes the four cells around it and the edges blend on their own.
//
// Pure logic, no Phaser: the game draws it (ui/terrainView.js), the walk grid
// samples it, the map editor paints it, and the map checks read it
// (systems/mapcheck.js, unit-tested). `tileset` is assets/regions/<set>/tileset.json.
//
// Elevation: a terrain with a `level` is raised that many steps (the swamp's
// 'h' high ground and 'p' high path are 1, 'H' higher ground is 2). Its tiles
// show the top; under every edge that faces the camera (south) and drops to
// lower ground hangs a cliff face, `tileset.cliff.face` px tall per level
// dropped, drawn over the ground below. $cott can't step over a rim or onto a
// face; stairs (a boardwalk of kind 'stairs', always walkable) are the way up
// and down. A raised terrain's `under` is what it gives way to (H and p sit
// on h), so terraces stack: painting H on grass rings it with h.

/** A small integer hash, so tile variants and decals stay put when nearby corners change. */
export function hash(i, j, salt = 0) {
  let h = (i * 374761393 + j * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise, 0..1, on a lattice one unit apart (two octaves). */
export function noise(x, y, salt = 0) {
  const one = (x, y, s) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const ease = (t) => t * t * (3 - 2 * t);
    const u = ease(x - i);
    const v = ease(y - j);
    const top = hash(i, j, s) * (1 - u) + hash(i + 1, j, s) * u;
    const bottom = hash(i, j + 1, s) * (1 - u) + hash(i + 1, j + 1, s) * u;
    return top * (1 - v) + bottom * v;
  };
  return 0.65 * one(x, y, salt) + 0.35 * one(x * 2.3 + 17, y * 2.3 + 5, salt + 1);
}

// How close to the edge of high ground counts as its rim (can't stand there), px.
const RIM = 8;

/** A cell whose four corners are all one terrain. */
const isSolid = (key) => key === key[0].repeat(4);

export class Terrain {
  /**
   * @param {string[]} rows  (rows + 1) strings of (cols + 1) corner codes
   * @param {object} tileset tileset.json
   */
  constructor(rows, tileset) {
    this.tileset = tileset;
    this.cell = tileset.cell;
    this.grid = rows.map((r) => [...r]);
    this.rows = this.grid.length - 1;
    this.cols = this.grid[0].length - 1;
    this.pairs = new Set(tileset.pairs.flatMap((p) => [p, [...p].reverse().join('')]));
    this.blocking = new Set(Object.entries(tileset.terrains).filter(([, t]) => t.blocks).map(([c]) => c));
    this.levels = Object.fromEntries(Object.entries(tileset.terrains).map(([c, t]) => [c, t.level ?? 0]));
    this.maxLevel = Math.max(0, ...Object.values(this.levels));
    // atLeast[L]: the terrains at level L or higher.
    this.atLeast = [];
    for (let L = 1; L <= this.maxLevel; L++) this.atLeast[L] = new Set(Object.keys(this.levels).filter((c) => this.levels[c] >= L));
    this.face = this.maxLevel ? (tileset.cliff?.face ?? 48) : 0; // per level dropped
    this.maxFace = this.face * this.maxLevel;
  }

  get width() {
    return this.cols * this.cell;
  }

  get height() {
    return this.rows * this.cell;
  }

  /** The grid as strings again (for saving). */
  toRows() {
    return this.grid.map((r) => r.join(''));
  }

  at(i, j) {
    return this.grid[Math.max(0, Math.min(this.rows, j))][Math.max(0, Math.min(this.cols, i))];
  }

  /** A cell's four corners, NW NE SW SE, as a key into tileset.tiles. */
  key(i, j) {
    return this.grid[j][i] + this.grid[j][i + 1] + this.grid[j + 1][i] + this.grid[j + 1][i + 1];
  }

  /** Can these terrains share a cell? (Only the pairs a tileset was drawn for.) */
  allowed(kinds) {
    if (kinds.size <= 1) return true;
    if (kinds.size > 2) return false;
    return this.pairs.has([...kinds].join(''));
  }

  /**
   * Paint corners within `radius` corners of (ci, cj) with code `c`, then fix
   * any cell that would mix terrains with no tile between them: the other
   * terrain gives way to the base (grass), so a pool never touches a path.
   * Returns the cell box that may have changed, or null.
   */
  paint(ci, cj, radius, c) {
    let changed = false;
    for (let j = cj - radius + 1; j <= cj + radius - 1; j++) {
      for (let i = ci - radius + 1; i <= ci + radius - 1; i++) {
        if (i < 0 || j < 0 || i > this.cols || j > this.rows) continue;
        if (radius > 1 && (i - ci) ** 2 + (j - cj) ** 2 > (radius - 0.5) ** 2) continue;
        if (this.grid[j][i] === c) continue;
        this.grid[j][i] = c;
        changed = true;
      }
    }
    if (!changed) return null;
    const box = this.fixup(c);
    const r = radius + 1;
    return {
      i0: Math.min(box.i0, ci - r), j0: Math.min(box.j0, cj - r),
      i1: Math.max(box.i1, ci + r), j1: Math.max(box.j1, cj + r),
    };
  }

  /**
   * Make every cell drawable. `keep` wins any conflict it's part of: lower
   * ground around a raised `keep` rises to what it sits on (its `under`), and
   * otherwise the other terrain gives way to its own `under` (or the base). Returns the cell box it touched.
   */
  fixup(keep = null) {
    const { base, terrains } = this.tileset;
    const order = this.tileset.yields ?? Object.keys(terrains);
    const lv = this.levels;
    // Which gives way first: an overlay (one with an `under`), then `yields` order.
    const rank = (k) => (terrains[k]?.under ? 0 : 100) + order.indexOf(k);
    const before = (a, b) => rank(a) - rank(b);
    const raiseTo = keep && terrains[keep]?.under;
    const box = { i0: Infinity, j0: Infinity, i1: -Infinity, j1: -Infinity };
    for (let pass = 0, again = true; again && pass < 50; pass++) {
      again = false;
      for (let j = 0; j < this.rows; j++) {
        for (let i = 0; i < this.cols; i++) {
          const corners = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]];
          const kinds = new Set(corners.map(([x, y]) => this.grid[y][x]));
          if (this.allowed(kinds)) continue;
          let drop;
          let to;
          if (raiseTo && kinds.has(keep) && [...kinds].some((k) => lv[k] < lv[keep] && k !== raiseTo)) {
            // Raised ground being painted: the lower ground beside it comes up to what it sits on.
            drop = [...kinds].find((k) => lv[k] < lv[keep] && k !== raiseTo);
            to = raiseTo;
          } else {
            // Which terrain gives way: not the one being painted, not the base.
            const candidates = [...kinds].filter((k) => k !== base && k !== keep).sort(before);
            drop = candidates[0] ?? [...kinds].find((k) => k !== base);
            to = terrains[drop]?.under ?? base;
          }
          for (const [x, y] of corners) {
            if (this.grid[y][x] !== drop) continue;
            this.grid[y][x] = to;
            again = true;
            box.i0 = Math.min(box.i0, x - 1);
            box.j0 = Math.min(box.j0, y - 1);
            box.i1 = Math.max(box.i1, x);
            box.j1 = Math.max(box.j1, y);
          }
        }
      }
    }
    return box;
  }

  /**
   * Grow (or shrink, with negatives) the map by whole cells on each side. New
   * corners copy the nearest edge. Returns the world-px shift for objects.
   */
  resize({ left = 0, top = 0, right = 0, bottom = 0 }) {
    const cols = this.cols + left + right;
    const rows = this.rows + top + bottom;
    if (cols < 4 || rows < 4) return null;
    const grid = [];
    for (let j = 0; j <= rows; j++) {
      const row = [];
      for (let i = 0; i <= cols; i++) row.push(this.at(i - left, j - top));
      grid.push(row);
    }
    this.grid = grid;
    this.cols = cols;
    this.rows = rows;
    return { dx: left * this.cell, dy: top * this.cell };
  }

  /** How much of the terrains in `set` is at world point (x, y), 0..1: the corners, blended like the tiles' own transitions. */
  shareAt(set, x, y) {
    const fx = Math.max(0, Math.min(this.cols, x / this.cell));
    const fy = Math.max(0, Math.min(this.rows, y / this.cell));
    const i = Math.min(this.cols - 1, Math.floor(fx));
    const j = Math.min(this.rows - 1, Math.floor(fy));
    const u = fx - i;
    const v = fy - j;
    const b = (ci, cj) => (set.has(this.grid[cj][ci]) ? 1 : 0);
    return (b(i, j) * (1 - u) + b(i + 1, j) * u) * (1 - v) + (b(i, j + 1) * (1 - u) + b(i + 1, j + 1) * u) * v;
  }

  /** How many levels up world point (x, y) is: 0 on the ground, 1 on high ground, and so on. */
  levelAt(x, y) {
    let lv = 0;
    while (lv < this.maxLevel && this.shareAt(this.atLeast[lv + 1], x, y) > 0.5) lv++;
    return lv;
  }

  /** Is world point (x, y) on raised ground? */
  highAt(x, y) {
    return this.levelAt(x, y) > 0;
  }

  /** Is world point (x, y) on blocking ground: water, reeds, off the map, or a cliff's rim or face? */
  blocksAt(x, y) {
    if (x < 0 || y < 0 || x > this.width || y > this.height) return true;
    if (this.shareAt(this.blocking, x, y) > 0.5) return true;
    return this.cliffAt(x, y);
  }

  /**
   * Is (x, y) on a cliff: within RIM px of a change of level (any side), or on
   * a face hanging below a south-facing edge?
   */
  cliffAt(x, y) {
    if (!this.face) return false;
    const lv = this.levelAt(x, y);
    for (const [dx, dy] of [[RIM, 0], [-RIM, 0], [0, RIM], [0, -RIM]]) {
      if (this.levelAt(x + dx, y + dy) !== lv) return true;
    }
    if (lv === this.maxLevel || !this.higherAbove(x, y, lv)) return false;
    return this.facesAt(x, y, y + 1).some((f) => f.top <= y && y < f.top + f.height);
  }

  /** Is any corner within a face's reach above (x, y) higher than `lv`? (A quick test before scanning.) */
  higherAbove(x, y, lv) {
    const i = Math.floor(x / this.cell);
    const j1 = Math.min(this.rows, Math.floor(y / this.cell) + 1);
    for (let j = Math.max(0, Math.floor((y - this.maxFace) / this.cell)); j <= j1; j++) {
      if (this.levels[this.at(i, j)] > lv || this.levels[this.at(i + 1, j)] > lv) return true;
    }
    return false;
  }

  /**
   * Where cliff faces hang in a column of world x, from y0 to y1: [{ top,
   * height, full }] for each south-facing drop (higher ground above, lower
   * below), its face from the rim down `face` px per level dropped (`full`),
   * or less where it reaches ground as high again. On the 2 px art grid.
   */
  facesAt(x, y0, y1) {
    const out = [];
    if (!this.face) return out;
    const start = Math.floor((y0 - this.maxFace) / 2) * 2;
    let prev = this.levelAt(x, start);
    for (let y = start + 2; y < y1; y += 2) {
      const lv = this.levelAt(x, y);
      if (lv < prev) {
        const full = this.face * (prev - lv);
        let h = 0;
        while (h < full && this.levelAt(x, y + h) < prev) h += 2;
        out.push({ top: y, height: h, full });
      }
      prev = lv;
    }
    return out;
  }

  /**
   * Is world point (x, y) inside one of the tileset's `patches` (soft blotches
   * that break up big fields of one terrain: moss on grass, deep water mid-pool)?
   * 0 no, 1 its soft edge, 2 inside. Patches thin out toward other terrains,
   * so they never spill over a bank.
   */
  patchAt(patch, k, x, y) {
    const share = this.shareAt(patch.set ??= new Set(patch.on), x, y);
    if (share < 0.75) return 0;
    const n = noise(x / (patch.scale * this.cell), y / (patch.scale * this.cell), 500 + k * 7) - (1 - share) * 2;
    return n > patch.cut + 0.05 ? 2 : n > patch.cut ? 1 : 0;
  }

  /** Are all the cells from (i, j) out to w × h px from its corner this one solid `key`? */
  solidUnder(i, j, w, h, key) {
    const i1 = i + Math.ceil(w / this.cell) - 1;
    const j1 = j + Math.ceil(h / this.cell) - 1;
    if (i1 >= this.cols || j1 >= this.rows) return false;
    for (let cj = j; cj <= j1; cj++) for (let ci = i; ci <= i1; ci++) if (this.key(ci, cj) !== key) return false;
    return true;
  }

  /** The tile for a cell: { frame, flip }, picked from its variants by position. */
  tileFor(i, j) {
    const key = this.key(i, j);
    const frames = this.tileset.tiles[key] ?? this.tileset.tiles[this.tileset.base.repeat(4)];
    const frame = frames[Math.floor(hash(i, j, 1) * frames.length)];
    return { frame, flip: isSolid(key) && hash(i, j, 2) < 0.5 };
  }

  /**
   * Details scattered on a solid cell: [{ frame, x, y }] in px from the cell's
   * corner. One bigger than a cell spills right and down, and only lands where
   * every cell it covers is the same solid terrain (no lily pad over a bank).
   */
  decalsFor(i, j) {
    const key = this.key(i, j);
    if (!isSolid(key)) return [];
    const { frames, scatter } = this.tileset.decals;
    const out = [];
    scatter.forEach((s, k) => {
      if (s.on !== key[0]) return;
      const n = Math.floor(s.density) + (hash(i, j, 10 + k) < s.density % 1 ? 1 : 0);
      for (let m = 0; m < n; m++) {
        const frame = s.frames[Math.floor(hash(i, j, 100 + k * 7 + m) * s.frames.length)];
        const [, , w, h] = frames[frame];
        const snap = (v) => Math.floor(v / 2) * 2; // on the 2 px art grid
        const x = snap(hash(i, j, 200 + k * 7 + m) * Math.max(0, this.cell - w));
        const y = snap(hash(i, j, 300 + k * 7 + m) * Math.max(0, this.cell - h));
        if (!this.solidUnder(i, j, x + w, y + h, key)) continue;
        out.push({ frame, x, y });
      }
    });
    return out;
  }
}
