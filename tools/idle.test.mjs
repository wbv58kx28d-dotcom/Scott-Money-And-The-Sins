// Idle actions (CLAUDE.md §6.6): every one listed in src/data/assets.js has its
// sheet (tools/region-art/idle.py), the size its entry says, with only real views.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIELD_SHEETS } from '../src/data/assets.js';
import { FIELD } from '../src/config.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWS = ['down', 'up', 'left'];

/** A PNG's width and height, from its IHDR chunk. */
function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const idles = FIELD_SHEETS.filter((s) => s.idle);

test('some characters have idle actions', () => {
  assert.ok(idles.length > 0);
});

for (const s of idles) {
  test(`${s.key}'s idle action has its sheet`, () => {
    const { path: file, views, frames, fps } = s.idle;
    const full = path.join(ROOT, file);
    assert.ok(fs.existsSync(full), `${file} is missing`);
    assert.deepEqual(pngSize(full), { w: FIELD.frame.w * frames, h: FIELD.frame.h * VIEWS.length });
    assert.ok(views.length > 0 && views.every((v) => VIEWS.includes(v)), `views ${views}`);
    assert.ok(frames > 0 && fps > 0);
  });
}
