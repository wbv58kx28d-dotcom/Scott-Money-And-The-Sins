// $cott's jet ski (CLAUDE.md §6.6): rented once at a dock, then boarded from
// any shore, Surf-style. On the water he moves on a grid of his own (the
// lagoon, minus docks, kept a little off the shore so the hull never noses
// into the sand), and where the walk grid and the water grid face each other
// across a shore, he can hop between them. A tap across the water plans the
// whole trip: walk to the best shore, ride, hop off, walk the rest.
// Pure (no Phaser), on top of systems/walkGrid.js and systems/mapcheck.js.

import { FIELD, RIDE } from '../config.js';
import { WalkGrid } from './walkGrid.js';
import { inRect, reachable } from './mapcheck.js';

/** Does this map have a jet ski to rent (an NPC who rents it out)? */
export const hasJetski = (map) => map.npcs.some((n) => n.rental);

/** The water grid: open water, not under a dock (a bridge) or an exit, kept RIDE.clearance cells off the shore. */
export function buildWaterGrid(map, terrain) {
  const { cell } = FIELD;
  const cols = Math.ceil(map.size.w / cell);
  const rows = Math.ceil(map.size.h / cell);
  const grid = new WalkGrid(cols, rows, cell, (c, r) => {
    const x = (c + 0.5) * cell;
    const y = (r + 0.5) * cell;
    if (map.bridges.some((b) => inRect(x, y, b)) || map.exits.some((e) => inRect(x, y, e))) return false;
    return terrain.wetAt(x, y) && terrain.voidAt(x, y) <= 0.5;
  });
  return grid.erode(RIDE.clearance);
}

/**
 * Every place $cott can hop between land and water: { land: [c, r], water: [c, r] } for each
 * open land cell that looks straight across the shore (4 ways) at open water within RIDE.reach px,
 * over nothing but shore and water (never through a wall or a prop's footprint).
 */
export function shorePairs(walk, water, terrain) {
  const pairs = [];
  const steps = Math.ceil(RIDE.reach / walk.cell);
  for (let r = 0; r < walk.rows; r++) {
    for (let c = 0; c < walk.cols; c++) {
      if (!walk.isOpen(c, r)) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let k = 1; k <= steps; k++) {
          const nc = c + dc * k;
          const nr = r + dr * k;
          if (water.isOpen(nc, nr)) {
            pairs.push({ land: [c, r], water: [nc, nr] });
            break;
          }
          if (walk.isOpen(nc, nr)) break; // more land: a nearer cell is the shore
          const { x, y } = walk.center(nc, nr);
          // Between them: shore sand (eroded off the walk grid) or water. A prop or a cliff ends the look.
          if (terrain.blocksAt(x, y) && !terrain.wetAt(x, y)) break;
          if (!terrain.wetAt(x, y) && !onGround(walk, nc, nr)) break;
        }
      }
    }
  }
  return pairs;
}

/** Is a closed walk cell only closed for clearance (open ground next to open ground), not under a footprint? */
function onGround(walk, c, r) {
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
    if (walk.isOpen(c + dc, r + dr)) return true;
  }
  return false;
}

/**
 * Where to hop from one grid to the other on the way from `from` to `to`: the pair whose start
 * `from` can reach on its own grid and whose end reaches `to` on the other, by the shortest trip
 * (straight lines, each leg at its own speed). `side` says which way: 'board' (land to water) or
 * 'land' (water to land). Returns { from: {x, y}, to: {x, y} } or null when there's no way.
 */
export function crossing(pairs, grids, side, from, to) {
  const [a, b] = side === 'board' ? [grids.walk, grids.water] : [grids.water, grids.walk];
  const [ka, kb] = side === 'board' ? ['land', 'water'] : ['water', 'land'];
  const [va, vb] = side === 'board' ? [FIELD.speed, RIDE.speed] : [RIDE.speed, FIELD.speed];
  const near = reachable(a, from);
  const far = reachable(b, to);
  let best = null;
  let bestT = Infinity;
  for (const p of pairs) {
    const [ac, ar] = p[ka];
    const [bc, br] = p[kb];
    if (!near[ar * a.cols + ac] || !far[br * b.cols + bc]) continue;
    const pa = a.center(ac, ar);
    const pb = b.center(bc, br);
    const t = Math.hypot(pa.x - from.x, pa.y - from.y) / va + Math.hypot(pb.x - to.x, pb.y - to.y) / vb;
    if (t < bestT) {
      bestT = t;
      best = { from: pa, to: pb };
    }
  }
  return best;
}

/**
 * Pushing the stick into the shore: the spot on the other grid straight ahead, within RIDE.reach
 * px, over shore and water only, or null. `onto` is the grid he'd hop onto.
 */
export function hopAhead(onto, terrain, at, dir) {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  for (let d = onto.cell; d <= RIDE.reach; d += onto.cell / 2) {
    const x = at.x + ux * d;
    const y = at.y + uy * d;
    if (onto.walkableAt(x, y)) return { x: Math.round(x), y: Math.round(y) };
    if (terrain.blocksAt(x, y) && !terrain.wetAt(x, y)) return null;
  }
  return null;
}

/**
 * Everywhere $cott can get to from the spawn once he has the jet ski: open cells of the walk
 * grid (`walk`) and of the water grid (`water`), joined at the shore pairs. Two masks, cell by cell.
 */
export function reachableByRide(grids, pairs, from) {
  const { walk, water } = grids;
  const seen = { walk: new Uint8Array(walk.cols * walk.rows), water: new Uint8Array(water.cols * water.rows) };
  const hop = { walk: new Map(), water: new Map() };
  for (const p of pairs) {
    const li = p.land[1] * walk.cols + p.land[0];
    const wi = p.water[1] * water.cols + p.water[0];
    if (!hop.walk.has(li)) hop.walk.set(li, []);
    if (!hop.water.has(wi)) hop.water.set(wi, []);
    hop.walk.get(li).push(wi);
    hop.water.get(wi).push(li);
  }
  const start = walk.nearestOpen(from.x, from.y, 4);
  if (!start) return seen;
  const stack = [['walk', start[1] * walk.cols + start[0]]];
  seen.walk[stack[0][1]] = 1;
  while (stack.length) {
    const [layer, i] = stack.pop();
    const grid = grids[layer];
    const c = i % grid.cols;
    const r = (i - c) / grid.cols;
    const next = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (grid.isOpen(c + dc, r + dr)) next.push([layer, (r + dr) * grid.cols + c + dc]);
    }
    const other = layer === 'walk' ? 'water' : 'walk';
    for (const j of hop[layer].get(i) ?? []) next.push([other, j]);
    for (const [l, j] of next) {
      if (seen[l][j]) continue;
      seen[l][j] = 1;
      stack.push([l, j]);
    }
  }
  return seen;
}

// ---- Headings: which way the ski points, in 16 steps (CLAUDE.md §6.6) ----------------
// Step 0 points down the screen (south), 4 west, 8 north, 12 east. The ride sheet draws
// the west half (0..8, south round through west to north); the east half is the same
// rows mirrored.

export const HEADINGS = 16;

/** The heading step (0..15) nearest to a direction of travel (ux, uy), screen y down. */
export function headingOf(ux, uy) {
  const a = Math.atan2(-ux, uy); // 0 south, π/2 west, ±π north, -π/2 east
  return ((Math.round(a / ((2 * Math.PI) / HEADINGS)) % HEADINGS) + HEADINGS) % HEADINGS;
}

/** The unit direction (ux, uy) a heading step points. */
export function headingVector(k) {
  const a = (k * 2 * Math.PI) / HEADINGS;
  return { ux: -Math.sin(a), uy: Math.cos(a) };
}

/** The ride sheet's row for a heading step, and whether to mirror it (the east half). */
export function headingRow(k) {
  return k <= HEADINGS / 2 ? { row: k, flip: false } : { row: HEADINGS - k, flip: true };
}

/** One step from `from` toward `to`, the short way round (or `to` itself, once there). */
export function turnToward(from, to) {
  const d = (((to - from) % HEADINGS) + HEADINGS + HEADINGS / 2) % HEADINGS - HEADINGS / 2;
  if (d === 0) return to;
  return (from + Math.sign(d) + HEADINGS) % HEADINGS;
}
