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
