// Unit tests for elevation (systems/terrain.js): raised terrains (a `level`:
// 'h' high ground and 'p' high path at 1, 'H' higher ground at 2) with cliff
// faces hung below their south edges, a rim $cott can't cross, stairs (a
// boardwalk of kind 'stairs') as the way up, and painting that keeps terraces
// stacked (H and p sit on h). Run: npm test

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

/** The plateau with a knoll of higher ground on it, rows 6..8, columns 7..12. */
function terraces() {
  return plateau().map((r, j) => [...r].map((c, i) => (i >= 7 && i <= 12 && j >= 6 && j <= 8 ? 'H' : c)).join(''));
}

test('the swamp tileset has high ground, higher ground and a high path, with a cliff face', () => {
  assert.equal(swamp.terrains.h?.level, 1);
  assert.equal(swamp.terrains.H?.level, 2);
  assert.equal(swamp.terrains.p?.level, 1);
  assert.equal(swamp.terrains.H.under, 'h');
  assert.equal(swamp.terrains.p.under, 'h');
  for (const pair of ['gh', 'hH', 'hp']) assert.ok(swamp.pairs.includes(pair), pair);
  assert.ok(swamp.cliff.face >= 32);
  for (const key of ['hhhh', 'hhgg', 'gghh', 'hghg', 'ghgh', 'HHHH', 'HHhh', 'hhHH', 'pppp', 'pphh', 'hhpp']) assert.ok(swamp.tiles[key], key);
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

test('terraces stack: each level has its own rim and face', () => {
  const t = new Terrain(terraces(), swamp);
  const c = t.cell;
  const mid = 10 * c;
  assert.equal(t.levelAt(mid, 7 * c), 2, 'on the knoll');
  assert.equal(t.levelAt(mid, 9.75 * c), 1, 'on the plateau below it');
  assert.equal(t.levelAt(mid, 14 * c), 0, 'on the ground');
  assert.ok(t.blocksAt(mid, 8.5 * c), 'the knoll\'s rim blocks');
  assert.ok(t.blocksAt(5 * c, 7 * c) === false, 'the plateau beside the knoll is open');
  // Two faces in the column: the knoll's (onto the plateau), then the plateau's (onto the ground).
  const faces = t.facesAt(mid, 0, 20 * c);
  assert.equal(faces.length, 2);
  assert.ok(Math.abs(faces[0].top - 8.5 * c) <= 4, `the knoll's face starts at its rim (${faces[0].top})`);
  assert.equal(faces[0].full, t.face);
  assert.ok(Math.abs(faces[1].top - 10.5 * c) <= 4, `the plateau's face starts at its rim (${faces[1].top})`);
});

test('a drop of two levels hangs a face twice as tall', () => {
  // Higher ground straight onto grass (no tile for it, but the levels still say what's what).
  const rows = plateau().map((r) => r.replace(/h/g, 'H'));
  const t = new Terrain(rows, swamp);
  const [f] = t.facesAt(10 * t.cell, 0, 20 * t.cell);
  assert.equal(f.full, t.face * 2);
  assert.equal(f.height, t.face * 2);
  assert.ok(t.blocksAt(10 * t.cell, 10.5 * t.cell + t.face * 2 - 4), 'the whole face blocks');
  assert.ok(!t.blocksAt(10 * t.cell, 10.5 * t.cell + t.face * 2 + 20), 'past its foot is open');
});

test('painting keeps terraces stacked: higher ground and the high path sit on high ground', () => {
  const blank = () => new Terrain(plateau().map((r) => r.replace(/h/g, 'g')), swamp);
  const drawable = (t) => {
    for (let j = 0; j < t.rows; j++) for (let i = 0; i < t.cols; i++) assert.ok(swamp.tiles[t.key(i, j)], `cell ${i},${j}: ${t.key(i, j)}`);
  };
  // Higher ground painted on grass comes with a ring of high ground.
  const a = blank();
  a.paint(10, 10, 2, 'H');
  drawable(a);
  assert.equal(a.at(10, 10), 'H');
  assert.equal(a.at(12, 10), 'h', 'the ring');
  assert.equal(a.at(15, 10), 'g', 'and grass past it');
  // So does a high path.
  const b = blank();
  b.paint(10, 10, 1, 'p');
  drawable(b);
  assert.equal(b.at(10, 10), 'p');
  assert.equal(b.at(11, 10), 'h');
  // Grass painted over higher ground leaves high ground around it, not a two-level drop.
  const c = new Terrain(terraces(), swamp);
  c.paint(9, 7, 1, 'g');
  drawable(c);
  assert.equal(c.at(9, 7), 'g');
  for (let j = 0; j <= c.rows; j++) for (let i = 0; i <= c.cols; i++) {
    if (c.at(i, j) !== 'H') continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.notEqual(c.at(i + di, j + dj), 'g', `H at ${i},${j} touches grass`);
  }
  // Dirt painted beside fresh high ground gives way, not the high ground.
  const d = blank();
  d.paint(10, 14, 1, 'd');
  d.paint(10, 10, 2, 'H');
  drawable(d);
  assert.equal(d.at(10, 10), 'H');
});

test('a drop is nothing to stand on: no tile, a rim, and a crater shows its far wall', () => {
  assert.ok(swamp.terrains.v?.void && swamp.terrains.v.blocks);
  assert.equal(swamp.terrains.v.level, -2);
  // A grass map with a hole (a crater) in rows 6..12, columns 6..13, and the top two rows dropping away (a cliff edge).
  const rows = [];
  for (let j = 0; j <= 20; j++) {
    let r = '';
    for (let i = 0; i <= 20; i++) r += j <= 1 || (i >= 6 && i <= 13 && j >= 6 && j <= 12) ? 'v' : 'g';
    rows.push(r);
  }
  const t = new Terrain(rows, swamp);
  const c = t.cell;
  for (let j = 0; j < t.rows; j++) for (let i = 0; i < t.cols; i++) assert.ok(t.drawable(i, j), t.key(i, j));
  assert.equal(t.tileFor(10, 9), null, 'nothing drawn in the hole');
  assert.ok(t.tileFor(5, 6), 'its edge is drawn as ground (cut later)');
  assert.equal(t.levelAt(10 * c, 9 * c), -2);
  assert.ok(t.blocksAt(10 * c, 9 * c), "can't walk into it");
  assert.ok(t.blocksAt(10 * c, 12.5 * c + 4), 'or onto its rim');
  assert.ok(!t.blocksAt(10 * c, 16 * c), 'the ground past it is fine');
  // Looking down a column through the crater: its north rim drops two levels, so its far wall is a double face.
  const faces = t.facesAt(10 * c, 2 * c, 20 * c);
  assert.equal(faces.length, 1);
  assert.equal(faces[0].full, t.face * 2);
  assert.ok(Math.abs(faces[0].top - 5.5 * c) <= 4, `the wall hangs from the crater's north rim (${faces[0].top})`);
  // The map's top edge drops away from the camera: no face hangs there.
  assert.equal(t.facesAt(3 * c, 0, 4 * c).length, 0);
  assert.ok(t.voidAt(3 * c, 0) > 0.9 && t.voidAt(3 * c, 4 * c) === 0);
});
