// A region's ground as data (CLAUDE.md §6.11): a grid of terrain codes on
// the CORNERS of the map's cells (one letter each, like 'w' water, 'g' grass;
// the tileset defines them). Each cell is drawn with the tile whose four
// corners match (Wang autotiling, tiles from PixelLab), so painting a corner
// reshapes the four cells around it and the edges blend on their own.
//
// Pure logic, no Phaser: the game draws it (ui/terrainView.js), the walk grid
// samples it, the map editor paints it, and the map checks read it
// (systems/mapcheck.js, unit-tested). `tileset` is assets/regions/<set>/tileset.json.

/** A small integer hash, so tile variants and decals stay put when nearby corners change. */
export function hash(i, j, salt = 0) {
  let h = (i * 374761393 + j * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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

  /** Make every cell drawable. `keep` wins any conflict it's part of. Returns the cell box it touched. */
  fixup(keep = null) {
    const base = this.tileset.base;
    const yields = this.tileset.yields ?? Object.keys(this.tileset.terrains);
    const box = { i0: Infinity, j0: Infinity, i1: -Infinity, j1: -Infinity };
    for (let pass = 0, again = true; again && pass < 50; pass++) {
      again = false;
      for (let j = 0; j < this.rows; j++) {
        for (let i = 0; i < this.cols; i++) {
          const corners = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]];
          const kinds = new Set(corners.map(([x, y]) => this.grid[y][x]));
          if (this.allowed(kinds)) continue;
          // Which terrain gives way: not the one being painted, not the base; first in `yields`.
          const candidates = [...kinds].filter((k) => k !== base && k !== keep);
          const drop = yields.find((y) => candidates.includes(y)) ?? candidates[0] ?? [...kinds].find((k) => k !== base);
          for (const [x, y] of corners) {
            if (this.grid[y][x] !== drop) continue;
            this.grid[y][x] = base;
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

  /** Is world point (x, y) on blocking ground? Corners blend like the tiles' own transitions. */
  blocksAt(x, y) {
    const fx = x / this.cell;
    const fy = y / this.cell;
    if (fx < 0 || fy < 0 || fx > this.cols || fy > this.rows) return true;
    const i = Math.min(this.cols - 1, Math.floor(fx));
    const j = Math.min(this.rows - 1, Math.floor(fy));
    const u = fx - i;
    const v = fy - j;
    const b = (ci, cj) => (this.blocking.has(this.grid[cj][ci]) ? 1 : 0);
    const a = (b(i, j) * (1 - u) + b(i + 1, j) * u) * (1 - v) + (b(i, j + 1) * (1 - u) + b(i + 1, j + 1) * u) * v;
    return a > 0.5;
  }

  /** The tile for a cell: { frame, flip }, picked from its variants by position. */
  tileFor(i, j) {
    const key = this.key(i, j);
    const frames = this.tileset.tiles[key] ?? this.tileset.tiles[this.tileset.base.repeat(4)];
    const frame = frames[Math.floor(hash(i, j, 1) * frames.length)];
    const solid = key[0] === key[1] && key[1] === key[2] && key[2] === key[3];
    return { frame, flip: solid && hash(i, j, 2) < 0.5 };
  }

  /** Little details scattered on a solid cell: [{ frame, x, y }] in px from the cell's corner. */
  decalsFor(i, j) {
    const key = this.key(i, j);
    if (!(key[0] === key[1] && key[1] === key[2] && key[2] === key[3])) return [];
    const { frames, scatter } = this.tileset.decals;
    const out = [];
    scatter.forEach((s, k) => {
      if (s.on !== key[0]) return;
      const n = Math.floor(s.density) + (hash(i, j, 10 + k) < s.density % 1 ? 1 : 0);
      for (let m = 0; m < n; m++) {
        const frame = s.frames[Math.floor(hash(i, j, 100 + k * 7 + m) * s.frames.length)];
        const [, , w, h] = frames[frame];
        const snap = (v) => Math.floor(v / 2) * 2; // on the 2 px art grid
        out.push({
          frame,
          x: snap(hash(i, j, 200 + k * 7 + m) * Math.max(0, this.cell - w)),
          y: snap(hash(i, j, 300 + k * 7 + m) * Math.max(0, this.cell - h)),
        });
      }
    });
    return out;
  }
}
