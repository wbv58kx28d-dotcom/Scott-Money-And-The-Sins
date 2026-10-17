// Where $cott can walk inside a region, and how he gets there.
//
// A region's walkable ground (systems/mapcheck.js) is sampled into a coarse
// grid of cells. Tap-to-move asks findPath() for a route: A* over 8 directions (no
// cutting corners past walls), then smoothed so he walks in straight lines
// wherever he has a clear view. Pure logic, no Phaser: unit-tested in tools/.

export class WalkGrid {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {number} cell  world px per cell
   * @param {(col:number, row:number) => boolean} walkable
   */
  constructor(cols, rows, cell, walkable) {
    Object.assign(this, { cols, rows, cell });
    this.open = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) this.open[r * cols + c] = walkable(c, r) ? 1 : 0;
  }

  /** Close every cell within `radius` cells of a wall, so feet don't clip into it. */
  erode(radius) {
    if (radius <= 0) return this;
    const { cols, rows } = this;
    const src = this.open.slice();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!src[r * cols + c]) continue;
        let clear = true;
        for (let dr = -radius; dr <= radius && clear; dr++) {
          for (let dc = -radius; dc <= radius && clear; dc++) {
            if (dr * dr + dc * dc > radius * radius) continue;
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= rows || cc >= cols || !src[rr * cols + cc]) clear = false;
          }
        }
        this.open[r * cols + c] = clear ? 1 : 0;
      }
    }
    return this;
  }

  /** Mark a world-space rectangle as blocked (e.g. an NPC's footprint). */
  block({ x, y, w, h }) {
    const c0 = Math.floor(x / this.cell);
    const r0 = Math.floor(y / this.cell);
    const c1 = Math.floor((x + w) / this.cell);
    const r1 = Math.floor((y + h) / this.cell);
    for (let r = Math.max(0, r0); r <= Math.min(this.rows - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) this.open[r * this.cols + c] = 0;
    }
  }

  isOpen(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.open[r * this.cols + c] === 1;
  }

  cellOf(x, y) {
    return [Math.floor(x / this.cell), Math.floor(y / this.cell)];
  }

  center(c, r) {
    return { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell };
  }

  walkableAt(x, y) {
    return this.isOpen(...this.cellOf(x, y));
  }

  /** The open cell nearest to a world point (searching outward), or null. */
  nearestOpen(x, y, maxRadius = 12) {
    const [c0, r0] = this.cellOf(x, y);
    if (this.isOpen(c0, r0)) return [c0, r0];
    let best = null;
    let bestD = Infinity;
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          if (!this.isOpen(c0 + dc, r0 + dr)) continue;
          const d = dr * dr + dc * dc;
          if (d < bestD) {
            bestD = d;
            best = [c0 + dc, r0 + dr];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** True if a straight walk between two world points stays on open cells. */
  clearLine(a, b) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / (this.cell / 3)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkableAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  }

  /**
   * World-space waypoints from `from` to `to` (excluding the start), or null
   * when there's no way through. A blocked target snaps to the nearest open cell.
   */
  findPath(from, to) {
    const start = this.nearestOpen(from.x, from.y, 3);
    const goal = this.nearestOpen(to.x, to.y);
    if (!start || !goal) return null;
    const cells = astar(this, start, goal);
    if (!cells) return null;
    // The exact tap point when it's walkable; otherwise the snapped cell's center.
    const end = this.walkableAt(to.x, to.y) ? { x: to.x, y: to.y } : this.center(...goal);
    const points = cells.slice(1, -1).map(([c, r]) => this.center(c, r));
    points.push(end);
    return this.smooth(from, points);
  }

  /** Drop waypoints that can be skipped with a clear straight line. */
  smooth(from, points) {
    const out = [];
    let anchor = from;
    let i = 0;
    while (i < points.length) {
      let j = points.length - 1;
      while (j > i && !this.clearLine(anchor, points[j])) j--;
      out.push(points[j]);
      anchor = points[j];
      i = j + 1;
    }
    return out;
  }
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** A* over the grid's open cells. Returns [[col,row], ...] from start to goal, or null. */
function astar(grid, [sc, sr], [gc, gr]) {
  const { cols } = grid;
  const idx = (c, r) => r * cols + c;
  const h = (c, r) => {
    const dx = Math.abs(c - gc);
    const dy = Math.abs(r - gr);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const g = new Float64Array(grid.open.length).fill(Infinity);
  const came = new Int32Array(grid.open.length).fill(-1);
  const closed = new Uint8Array(grid.open.length);
  const heap = new MinHeap();
  g[idx(sc, sr)] = 0;
  heap.push(h(sc, sr), idx(sc, sr));
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const c = cur % cols;
    const r = (cur - c) / cols;
    if (c === gc && r === gr) {
      const path = [];
      for (let k = cur; k !== -1; k = came[k]) path.push([k % cols, Math.floor(k / cols)]);
      return path.reverse();
    }
    for (const [dc, dr, cost] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!grid.isOpen(nc, nr)) continue;
      // Diagonals need both side cells open, so the path never slips through a corner.
      if (dc && dr && (!grid.isOpen(c + dc, r) || !grid.isOpen(c, r + dr))) continue;
      const n = idx(nc, nr);
      const ng = g[cur] + cost;
      if (ng < g[n]) {
        g[n] = ng;
        came[n] = cur;
        heap.push(ng + h(nc, nr), n);
      }
    }
  }
  return null;
}

class MinHeap {
  constructor() {
    this.keys = [];
    this.vals = [];
  }

  get size() {
    return this.keys.length;
  }

  push(key, val) {
    const { keys, vals } = this;
    let i = keys.length;
    keys.push(key);
    vals.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= keys[i]) break;
      [keys[p], keys[i]] = [keys[i], keys[p]];
      [vals[p], vals[i]] = [vals[i], vals[p]];
      i = p;
    }
  }

  pop() {
    const { keys, vals } = this;
    const top = vals[0];
    const lastK = keys.pop();
    const lastV = vals.pop();
    if (keys.length) {
      keys[0] = lastK;
      vals[0] = lastV;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < keys.length && keys[l] < keys[m]) m = l;
        if (r < keys.length && keys[r] < keys[m]) m = r;
        if (m === i) break;
        [keys[m], keys[i]] = [keys[i], keys[m]];
        [vals[m], vals[i]] = [vals[i], vals[m]];
        i = m;
      }
    }
    return top;
  }
}
