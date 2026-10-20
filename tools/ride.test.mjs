// $cott's jet ski (CLAUDE.md §6.6, systems/ride.js): the water grid, the shore
// pairs he hops across, trip planning, and what the map checks count as reachable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Terrain } from '../src/systems/terrain.js';
import { buildRegionGrid, reachable, checkMap } from '../src/systems/mapcheck.js';
import { buildWaterGrid, shorePairs, crossing, hopAhead, reachableByRide, hasJetski } from '../src/systems/ride.js';
import { MAPS } from '../src/data/maps/index.js';
import { mergeMap, cloneLayout } from '../src/systems/mapfile.js';
import { LAYOUTS, CONTENT } from '../src/data/maps/index.js';
import { RIDE } from '../src/config.js';

const tileset = (set) => JSON.parse(fs.readFileSync(new URL(`../assets/regions/${set}/tileset.json`, import.meta.url)));
const isles = MAPS.isles;
const terrain = new Terrain(isles.layout.terrain, tileset(isles.tileset));
const walk = buildRegionGrid(isles, terrain);
const water = buildWaterGrid(isles, terrain);
const pairs = shorePairs(walk, water, terrain);
const grids = { walk, water };
const npc = (id) => isles.npcs.find((n) => n.id === id);
const at = (grid, p) => grid.walkableAt(p.x, p.y);

test('only maps with someone renting it out have a jet ski', () => {
  assert.ok(hasJetski(isles));
  for (const id of ['start', 'start_lair', 'start_office', 'isles_sky']) assert.ok(!hasJetski(MAPS[id]), id);
});

test('the water grid is the lagoon: never land, never under the dock', () => {
  let open = 0;
  for (let r = 0; r < water.rows; r++) {
    for (let c = 0; c < water.cols; c++) {
      if (!water.isOpen(c, r)) continue;
      open += 1;
      const { x, y } = water.center(c, r);
      assert.ok(terrain.wetAt(x, y), `open water cell on land at ${x},${y}`);
      assert.ok(!walk.isOpen(c, r), `a cell both walkable and rideable at ${x},${y}`);
      for (const b of isles.bridges) assert.ok(!(x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h), 'water under the dock');
    }
  }
  assert.ok(open > 1000, 'a lagoon to ride on');
});

test('every shore pair is a short hop between open land and open water', () => {
  assert.ok(pairs.length > 50, 'shores all round the islands');
  for (const p of pairs) {
    assert.ok(walk.isOpen(...p.land) && water.isOpen(...p.water));
    const a = walk.center(...p.land);
    const b = water.center(...p.water);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= RIDE.reach + walk.cell, 'within reach');
  }
});

test('the castle island can only be reached by water, and the dockhand on foot', () => {
  const onFoot = reachable(walk, isles.spawn);
  const guard = npc('guard');
  const near = (seen, n) => {
    const c = walk.nearestOpen(n.x, n.y + 40, 8);
    return c && seen[c[1] * walk.cols + c[0]];
  };
  assert.ok(near(onFoot, npc('dockhand')), 'the dockhand is on the first island');
  assert.ok(!near(onFoot, guard), 'no walking to the castle');
  const byRide = reachableByRide(grids, pairs, isles.spawn);
  assert.ok(near(byRide.walk, guard), 'riding there works');
});

test('a trip across the water: board at the start island, land at the castle', () => {
  const guard = npc('guard');
  const goal = { x: guard.x, y: guard.y + 60 };
  const c = water.nearestOpen(goal.x, goal.y, 60);
  const board = crossing(pairs, grids, 'board', isles.spawn, water.center(c[0], c[1]));
  assert.ok(board, 'somewhere to board');
  assert.ok(at(walk, board.from) && at(water, board.to));
  const land = crossing(pairs, grids, 'land', board.to, goal);
  assert.ok(land, 'somewhere to land');
  assert.ok(at(water, land.from) && at(walk, land.to));
  // He lands on the castle island, not back where he started.
  assert.ok(land.to.y < 1200, `landed at ${land.to.x},${land.to.y}`);
  assert.ok(water.findPath(board.to, land.from), 'a way across the lagoon');
});

test('pushing off the end of the dock hops onto the water, and back onto it from the water', () => {
  const dock = isles.bridges[0];
  const tip = { x: dock.x + dock.w / 2, y: dock.y + 30 }; // clear of the wall margin at its end
  assert.ok(at(walk, tip), 'the dock is walkable to its tip');
  const on = hopAhead(water, terrain, tip, { x: 0, y: -1 });
  assert.ok(on && at(water, on), 'onto the ski');
  const off = hopAhead(walk, terrain, on, { x: 0, y: 1 });
  assert.ok(off && at(walk, off), 'back onto the dock');
  // Not into the middle of an island from the shore of another: only across one shore.
  assert.equal(hopAhead(water, terrain, isles.spawn, { x: 0, y: -1 }), null, 'nothing to hop onto inland');
});

test('a map with a jet ski still needs its dock reachable on foot', () => {
  const layout = cloneLayout(LAYOUTS.isles);
  const dockhand = layout.npcs.find((n) => n.id === 'dockhand');
  Object.assign(dockhand, { x: 1600, y: 1600 }); // over on the palm island
  const map = mergeMap(layout, CONTENT.isles);
  const { problems } = checkMap(map, new Terrain(layout.terrain, tileset(layout.tileset)));
  assert.ok(problems.some((p) => p.level === 'error' && /rents the jet ski/.test(p.msg)), problems.map((p) => p.msg).join('; '));
});
