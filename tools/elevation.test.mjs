// Unit tests for elevation (systems/terrain.js): high ground ('h', a `cliff`
// terrain) with a cliff face hung below its south edges, a rim $cott can't
// cross, and stairs (a boardwalk of kind 'stairs') as the way up. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Terrain } from '../src/systems/terrain.js';
import { buildRegionGrid, reachable } from '../src/systems/mapcheck.js';
import { mergeMap } from '../src/systems/mapfile.js';

const swamp = JSON.parse(fs.readFileSync(new URL('../assets/regions/swamp/tileset.json', import.meta.url)));

/** A 20×20-cell grass map with a block of high ground in rows 4..10, columns 4..15 (corners). */
function plateau() {
  const rows = [];
  for (let j = 0; j <= 20; j++) {
    let r = '';
    for (let i = 0; i <= 20; i++) r += i >= 4 && i <= 15 && j >= 4 && j <= 10 ? 'h' : 'g';
    rows.push(r);
  }
  return rows;
}

test('the swamp tileset has high ground with a cliff face', () => {
  assert.ok(swamp.terrains.h?.cliff);
  assert.ok(swamp.pairs.includes('gh'));
  assert.ok(swamp.cliff.face >= 32);
  for (const key of ['hhhh', 'hhgg', 'gghh', 'hghg', 'ghgh']) assert.ok(swamp.tiles[key], key);
});

test('high ground, its rim, and the face hanging below its south edge', () => {
  const t = new Terrain(plateau(), swamp);
  const c = t.cell;
  const mid = 10 * c;
  assert.ok(t.highAt(mid, 7 * c), 'the middle of the plateau is high');
  assert.ok(!t.highAt(mid, 14 * c), 'below it is low');
  assert.ok(!t.blocksAt(mid, 7 * c), 'walkable on top');
  assert.ok(t.blocksAt(mid, 10.5 * c), 'the south rim blocks');
  assert.ok(t.blocksAt(mid, 10.5 * c + t.face - 4), 'so does the face below it');
  assert.ok(!t.blocksAt(mid, 10.5 * c + t.face + 20), 'past the face foot is open ground');
  assert.ok(t.blocksAt(mid, 3.5 * c), 'the north rim blocks too');
  assert.ok(!t.blocksAt(mid, 2 * c), 'but there is no face above it');
  // facesAt: one face per south-facing rim, as tall as the tileset says.
  const faces = t.facesAt(mid, 0, 20 * c);
  assert.equal(faces.length, 1);
  assert.equal(faces[0].height, t.face);
  assert.ok(Math.abs(faces[0].top - 10.5 * c) <= 4, `the face starts at the rim (${faces[0].top})`);
});

test('a plateau is cut off without stairs, and stairs are the way up', () => {
  const c = 32;
  const layout = {
    id: 't', tileset: 'swamp', cell: c, cols: 20, terrain: plateau(),
    spawn: { x: 10 * c, y: 17 * c, facing: 'up' }, exits: [], bridges: [], npcs: [], gates: [], props: [],
  };
  const map = mergeMap(layout, { npcs: {}, gates: {} });
  const terrain = new Terrain(layout.terrain, swamp);
  const top = { x: 10 * c, y: 7 * c };
  const can = (m) => {
    const grid = buildRegionGrid(m, terrain);
    const seen = reachable(grid, m.spawn);
    const [col, row] = grid.cellOf(top.x, top.y);
    return seen[row * grid.cols + col];
  };
  assert.ok(!can(map), 'no way up the cliff');
  const withStairs = { ...map, bridges: [{ x: 10 * c - 29, y: 9 * c, w: 58, h: 4 * c, kind: 'stairs' }] };
  assert.ok(can(withStairs), 'up the stairs');
});

test('maps without high ground are unchanged: no faces, no extra blocking', () => {
  const rows = plateau().map((r) => r.replace(/h/g, 'g'));
  const t = new Terrain(rows, swamp);
  assert.deepEqual(t.facesAt(320, 0, 640), []);
  for (let y = 16; y < 640; y += 16) assert.ok(!t.blocksAt(320, y));
});
