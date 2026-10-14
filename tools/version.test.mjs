// The version shown on the title screen (src/version.js) must stay well formed.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { VERSION, RELEASED, versionLabel } from '../src/version.js';

test('version is semver and the release date is a real date', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.match(RELEASED, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(RELEASED)));
});

test('the label reads like "v1.2.3 · Oct 14, 2026"', () => {
  assert.match(versionLabel(), new RegExp(`^v${VERSION.replace(/\./g, '\\.')} · [A-Z][a-z]{2} \\d{1,2}, \\d{4}$`));
});
