// Where $cott can walk in a region, and checks that a map plays (CLAUDE.md
// §6.11). The Region scene builds its walk grid here, the map editor runs the
// checks live, and the unit tests run them on every committed map, so a map
// written by hand, by the editor, or by AI is held to the same rules:
//   - $cott can reach every exit and every NPC from the spawn (ropes opened);
//   - every velvet rope closes something off (you can't just walk around it),
//     and its bouncer can be reached without going through it;
//   - nothing stands in the water, in the reeds, or off the map.
// Pure (no Phaser), on top of systems/walkGrid.js and systems/terrain.js.

import { FIELD } from '../config.js';
import { WalkGrid } from './walkGrid.js';

const footprint = (x, y, b) => ({ x: x - b.w / 2, y: y - b.h / 2, w: b.w, h: b.h });
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Is a world point walkable ground: not water or reeds, or on a bridge or an exit? */
export function groundWalkable(map, terrain, x, y) {
  if (map.bridges.some((b) => inRect(x, y, b)) || map.exits.some((e) => inRect(x, y, e))) return true;
  return !terrain.blocksAt(x, y);
}

/**
 * The walk grid: the ground, minus every prop's, NPC's, and closed rope's
 * footprint, eroded so feet keep a little distance from walls.
 * `isClosed(gate)` says which ropes are up (default: all of them).
 */
export function buildRegionGrid(map, terrain, { isClosed = () => true } = {}) {
  const { cell, clearance } = FIELD;
  const cols = Math.ceil(map.size.w / cell);
  const rows = Math.ceil(map.size.h / cell);
  const grid = new WalkGrid(cols, rows, cell, (c, r) => groundWalkable(map, terrain, (c + 0.5) * cell, (r + 0.5) * cell));
  for (const p of map.props) if (p.block?.w) grid.block(footprint(p.x, p.y, p.block));
  for (const n of map.npcs) grid.block(footprint(n.x, n.y, FIELD.npcBlock));
  for (const g of map.gates) if (isClosed(g)) grid.block(footprint(g.x, g.y, g.block));
  return grid.erode(clearance);
}

/** Every open cell reachable from a world point (4-way, like the walker without corner cuts). */
export function reachable(grid, from) {
  const start = grid.nearestOpen(from.x, from.y, 4);
  const seen = new Uint8Array(grid.cols * grid.rows);
  if (!start) return seen;
  const stack = [start];
  seen[start[1] * grid.cols + start[0]] = 1;
  while (stack.length) {
    const [c, r] = stack.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!grid.isOpen(nc, nr) || seen[nr * grid.cols + nc]) continue;
      seen[nr * grid.cols + nc] = 1;
      stack.push([nc, nr]);
    }
  }
  return seen;
}

/** Can $cott get within talking range of a point? */
function canReach(grid, seen, x, y, range) {
  const r = Math.ceil(range / grid.cell);
  const [c0, r0] = grid.cellOf(x, y);
  for (let dr = -r; dr <= r; dr++) {
    for (let dc = -r; dc <= r; dc++) {
      const c = c0 + dc;
      const rr = r0 + dr;
      if (c < 0 || rr < 0 || c >= grid.cols || rr >= grid.rows || !seen[rr * grid.cols + c]) continue;
      const p = grid.center(c, rr);
      if (Math.hypot(p.x - x, p.y - y) <= range) return true;
    }
  }
  return false;
}

/**
 * Check a map. Returns { problems: [{ level: 'error' | 'warn', msg, x, y }],
 * open, closed } where open / closed are the cells reachable from the spawn
 * with every rope down / up (the editor shades them).
 */
export function checkMap(map, terrain) {
  const problems = [];
  const err = (msg, x, y) => problems.push({ level: 'error', msg, x, y });
  const warn = (msg, x, y) => problems.push({ level: 'warn', msg, x, y });
  const { w, h } = map.size;
  const off = (o) => o.x < 0 || o.y < 0 || o.x > w || o.y > h;
  const talk = FIELD.talkRange * 0.9;

  const closedGrid = buildRegionGrid(map, terrain);
  const openGrid = buildRegionGrid(map, terrain, { isClosed: () => false });
  const closed = reachable(closedGrid, map.spawn);
  const open = reachable(openGrid, map.spawn);

  if (off(map.spawn)) err('The spawn is off the map.', map.spawn.x, map.spawn.y);
  else if (terrain.blocksAt(map.spawn.x, map.spawn.y)) err('The spawn is in the water or the reeds.', map.spawn.x, map.spawn.y);
  if (!closed.some(Boolean)) err('$cott can\'t move from the spawn.', map.spawn.x, map.spawn.y);

  for (const e of map.exits) {
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    if (!canReach(closedGrid, closed, cx, cy, Math.max(e.w, e.h) / 2 + closedGrid.cell)) err(`The exit to ${e.to} can't be reached.`, cx, cy);
  }

  for (const n of map.npcs) {
    if (off(n)) err(`${n.name} is off the map.`, n.x, n.y);
    else if (terrain.blocksAt(n.x, n.y)) warn(`${n.name} is standing in the water or the reeds.`, n.x, n.y);
    if (!canReach(openGrid, open, n.x, n.y, talk)) err(`${n.name} can't be reached, even with every rope down.`, n.x, n.y);
  }

  for (const g of map.gates) {
    // What opening just this rope adds to where $cott can go, past the rope's own footprint.
    const one = buildRegionGrid(map, terrain, { isClosed: (o) => o !== g });
    const withIt = reachable(one, map.spawn);
    const pad = (FIELD.clearance + 2) * one.cell;
    const near = { x: g.x - g.block.w / 2 - pad, y: g.y - g.block.h / 2 - pad, w: g.block.w + 2 * pad, h: g.block.h + 2 * pad };
    let added = 0;
    for (let i = 0; i < withIt.length; i++) {
      if (!withIt[i] || closed[i]) continue;
      const p = one.center(i % one.cols, Math.floor(i / one.cols));
      if (!inRect(p.x, p.y, near)) added += 1;
    }
    if (added < 4) err(`The ${g.name} rope doesn't close anything off: $cott can walk around it.`, g.x, g.y);
    const bouncer = map.npcs.find((n) => n.id === g.bouncer);
    if (!bouncer) err(`The ${g.name} rope has no bouncer (${g.bouncer ?? 'none set'}).`, g.x, g.y);
    else if (!canReach(closedGrid, closed, bouncer.x, bouncer.y, talk)) err(`${bouncer.name}, the ${g.name} bouncer, is behind a rope.`, bouncer.x, bouncer.y);
  }

  for (const p of map.props) {
    if (off(p)) err(`A ${p.texture} is off the map.`, p.x, p.y);
    else if (p.block?.w && terrain.blocksAt(p.x, p.y)) warn(`A ${p.texture.replace('prop_', '')} stands in the water or the reeds.`, p.x, p.y);
  }
  return { problems, open, closed, grid: openGrid };
}
