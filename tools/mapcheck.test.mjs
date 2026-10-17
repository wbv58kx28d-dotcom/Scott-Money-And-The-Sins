// Region maps as data (CLAUDE.md §6.11): the terrain grid, the layout file
// format, and the map checks, run on every committed map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Terrain } from '../src/systems/terrain.js';
import { checkMap, buildRegionGrid, reachable } from '../src/systems/mapcheck.js';
import { mergeMap, layoutToSource, cloneLayout } from '../src/systems/mapfile.js';
import { LAYOUTS, CONTENT, MAPS } from '../src/data/maps/index.js';

const tileset = (set) => JSON.parse(fs.readFileSync(new URL(`../assets/regions/${set}/tileset.json`, import.meta.url)));

test('every committed map passes the map checks', () => {
  for (const map of Object.values(MAPS)) {
    const terrain = new Terrain(map.layout.terrain, tileset(map.tileset));
    const { problems } = checkMap(map, terrain);
    const errors = problems.filter((p) => p.level === 'error');
    assert.deepEqual(errors, [], `${map.id}: ${errors.map((e) => e.msg).join('; ')}`);
  }
});

test('every committed terrain grid is drawable and matches its size', () => {
  for (const layout of Object.values(LAYOUTS)) {
    const ts = tileset(layout.tileset);
    assert.equal(layout.terrain[0].length, layout.cols + 1);
    assert.ok(layout.terrain.every((r) => r.length === layout.cols + 1), 'every row is cols + 1 corners');
    const terrain = new Terrain(layout.terrain, ts);
    for (let j = 0; j < terrain.rows; j++) {
      for (let i = 0; i < terrain.cols; i++) assert.ok(ts.tiles[terrain.key(i, j)], `${layout.id}: no tile for ${terrain.key(i, j)} at ${i},${j}`);
    }
    assert.ok(Object.keys(CONTENT[layout.id].npcs).every((id) => layout.npcs.some((n) => n.id === id)), 'no content for NPCs missing from the layout');
  }
});

test('a layout file round-trips through the editor\'s writer', async () => {
  const src = layoutToSource(LAYOUTS.start);
  const back = (await import(`data:text/javascript,${encodeURIComponent(src)}`)).default;
  assert.deepEqual(back, cloneLayout(LAYOUTS.start));
  assert.equal(layoutToSource(back), src, 'writing it again changes nothing');
  assert.ok(layoutToSource({ ...back, props: [{ texture: 'prop_sign', x: 1, y: 2, label: "DON'T SELL" }] }).includes(`"DON'T SELL"`));
});

test('painting keeps every cell drawable: what meets with no tile between gives way to grass', () => {
  const ts = tileset('swamp');
  const t = new Terrain(LAYOUTS.start.terrain, ts);
  // A dirt path straight across water: every cell must still have a tile.
  for (let i = 4; i < 20; i++) t.paint(i, 30, 2, 'd');
  for (let j = 0; j < t.rows; j++) for (let i = 0; i < t.cols; i++) assert.ok(ts.tiles[t.key(i, j)], t.key(i, j));
  assert.equal(t.at(10, 30), 'd', 'the painted terrain wins');
  // Growing the map keeps the old corners and shifts objects by whole cells.
  const before = t.at(5, 5);
  const shift = t.resize({ left: 2, top: 3 });
  assert.deepEqual(shift, { dx: 2 * ts.cell, dy: 3 * ts.cell });
  assert.equal(t.at(7, 8), before);
  assert.equal(t.toRows().length, t.rows + 1);
});

test('the checks catch a rope you can walk around, an unreachable NPC, and things in the water', () => {
  const ts = tileset('swamp');
  const layout = cloneLayout(LAYOUTS.start);
  // Drain the lagoon: the Yacht Club rope no longer closes anything off.
  const t = new Terrain(layout.terrain, ts);
  for (let j = 24; j <= 36; j++) for (let i = 19; i <= 32; i++) t.paint(i, j, 1, 'g');
  layout.terrain = t.toRows();
  // And put Derek in the middle of a pool.
  layout.npcs.find((n) => n.id === 'derek').x = 230;
  layout.npcs.find((n) => n.id === 'derek').y = 1540;
  const map = mergeMap(layout, CONTENT.start);
  const msgs = checkMap(map, new Terrain(layout.terrain, ts)).problems.map((p) => p.msg).join('\n');
  assert.match(msgs, /rope doesn't close anything off/);
  assert.match(msgs, /DEREK can't be reached/);
  assert.match(msgs, /DEREK is standing in the water/);
});

test('ropes are respected by the walk grid', () => {
  const map = MAPS.start;
  const terrain = new Terrain(map.layout.terrain, tileset(map.tileset));
  const wendy = map.npcs.find((n) => n.id === 'wendy');
  const closed = buildRegionGrid(map, terrain);
  const open = buildRegionGrid(map, terrain, { isClosed: () => false });
  const cellNear = (grid) => grid.nearestOpen(wendy.x, wendy.y + 50);
  const [c, r] = cellNear(open);
  assert.equal(reachable(open, map.spawn)[r * open.cols + c], 1, 'with the rope down, the Yacht Club is reachable');
  assert.equal(reachable(closed, map.spawn)[r * closed.cols + c], 0, 'with it up, it is not');
});
