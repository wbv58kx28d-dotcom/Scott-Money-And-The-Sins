// Unit tests for ground variety (systems/terrain.js): patches from smooth
// noise that stay off the banks, and decals that only land where every cell
// they cover is the same solid terrain. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Terrain, noise } from '../src/systems/terrain.js';
import { MAPS } from '../src/data/maps/index.js';

const swamp = JSON.parse(fs.readFileSync(new URL('../assets/regions/swamp/tileset.json', import.meta.url)));

test('noise is smooth, in range, and the same every time', () => {
  for (let k = 0; k < 500; k++) {
    const x = k * 0.37;
    const y = k * 0.11;
    const n = noise(x, y, 3);
    assert.ok(n >= 0 && n <= 1);
    assert.equal(noise(x, y, 3), n);
    assert.ok(Math.abs(noise(x + 0.01, y, 3) - n) < 0.05, 'no jumps');
  }
});

test('patches stay on their terrain, clear of the banks', () => {
  const map = MAPS.start;
  const t = new Terrain(map.layout.terrain, swamp);
  assert.ok(swamp.patches.length >= 3);
  swamp.patches.forEach((p, k) => {
    let inside = 0;
    for (let y = 16; y < t.height; y += 48) {
      for (let x = 16; x < t.width; x += 48) {
        if (!t.patchAt(p, k, x, y)) continue;
        inside++;
        assert.ok(t.shareAt(new Set(p.on), x, y) >= 0.75, `patch ${k} at ${x},${y} is off its terrain`);
      }
    }
    assert.ok(inside > 0, `patch ${k} shows up somewhere`);
  });
});

test('every decal on the swamp sits wholly on one solid terrain', () => {
  const t = new Terrain(MAPS.start.layout.terrain, swamp);
  const { frames } = swamp.decals;
  let big = 0;
  for (let j = 0; j < t.rows; j++) {
    for (let i = 0; i < t.cols; i++) {
      const key = t.key(i, j);
      for (const d of t.decalsFor(i, j)) {
        const [, , w, h] = frames[d.frame];
        if (d.x + w > t.cell || d.y + h > t.cell) big++;
        assert.ok(t.solidUnder(i, j, d.x + w, d.y + h, key), `decal at cell ${i},${j}`);
      }
    }
  }
  assert.ok(big > 50, `the big decals (lily pads, sludge) land somewhere: ${big}`);
});

// A square pool of water in grass: corners 2..10 are water, the rest grass.
function pool() {
  const rows = [];
  for (let j = 0; j <= 12; j++) {
    let r = '';
    for (let i = 0; i <= 12; i++) r += i >= 2 && i <= 10 && j >= 2 && j <= 10 ? 'w' : 'g';
    rows.push(r);
  }
  return new Terrain(rows, swamp);
}

test('a bank hangs over the water only at its far (north) shore', () => {
  const t = pool();
  const { cell } = t;
  assert.ok(t.bank > 0, 'the swamp has banks');
  const x = 6 * cell;
  const banks = t.banksAt(x, 0, 12 * cell);
  assert.equal(banks.length, 1, 'one bank down the column: the north shore, not the south');
  const [b] = banks;
  assert.ok(t.wetAt(x, b.top) && !t.wetAt(x, b.top - 2), 'it starts where the water does');
  assert.ok(b.top < 3 * cell, 'at the north shore');
  assert.equal(b.height, t.bank);
  assert.deepEqual(t.banksAt(cell / 2, 0, 12 * cell), [], 'no water, no bank');
});

test('water gets deeper away from the shore', () => {
  const t = pool();
  const { cell } = t;
  const depth = t.wetDepths(0, 0, 12, 12, 6);
  const mid = depth(6 * cell, 6 * cell);
  const edge = depth(2.5 * cell, 6 * cell);
  assert.ok(depth(cell, cell) === 0, 'dry ground has no depth');
  assert.ok(edge > 0 && edge < mid, `deeper in the middle (${edge} < ${mid})`);
  assert.ok(Math.abs(mid - 5 * cell) < cell / 2, `the middle is 5 cells from the nearest dry corner (${mid / cell})`);
});

test('every staircase reaches past the foot of the face it climbs', () => {
  for (const map of Object.values(MAPS)) {
    const ts = JSON.parse(fs.readFileSync(new URL(`../assets/regions/${map.tileset}/tileset.json`, import.meta.url)));
    const t = new Terrain(map.layout.terrain, ts);
    for (const b of (map.layout.bridges ?? []).filter((s) => s.kind === 'stairs')) {
      for (const f of t.facesAt(b.x + b.w / 2, b.y, b.y + b.h + t.maxFace)) {
        if (f.top > b.y + b.h) continue;
        assert.ok(b.y + b.h >= f.top + f.height, `${map.id} stairs at ${b.x},${b.y} stop ${f.top + f.height - b.y - b.h}px short of the face's foot`);
      }
    }
  }
});
