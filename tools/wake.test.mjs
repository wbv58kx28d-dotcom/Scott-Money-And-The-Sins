// The jet ski's wake (ui/wake.js): a V that spreads with age, only on open
// water, never joining two runs of the trail, and gone once its life is up.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Wake } from '../src/ui/wake.js';
import { RIDE } from '../src/config.js';

/** A stand-in for Phaser's Graphics: records every square drawn. */
function fakeScene() {
  const rects = [];
  const g = {
    rects,
    setDepth: () => g,
    clear: () => { rects.length = 0; },
    fillStyle: () => g,
    fillRect: (x, y, w, h) => rects.push({ x, y, w, h }),
  };
  return { scene: { add: { graphics: () => g } }, g };
}

/** Ride straight up from (500, 1000) for `ms`, a point a frame, leaving the wake behind. */
function rideUp(wake, { from = 0, ms = 600, x = 500, y0 = 1000, speed = 430 } = {}) {
  for (let t = from; t <= from + ms; t += 16) wake.add(x, y0 - ((t - from) * speed) / 1000, 0, -1, t, 26);
  return from + ms;
}

test('the waves spread in a V behind him, on the 2 px grid', () => {
  const { scene, g } = fakeScene();
  const wake = new Wake(scene, { depth: 0, wet: () => true });
  const end = rideUp(wake);
  wake.draw(end);
  assert.ok(g.rects.length > 100, 'waves drawn');
  for (const r of g.rects) assert.ok(r.x % 2 === 0 && r.y % 2 === 0, 'on the art grid');
  // Older waves (lower down, where he was) have spread wider than the fresh ones at the stern.
  const near = g.rects.filter((r) => r.y < 760);
  const far = g.rects.filter((r) => r.y > 940);
  const width = (rs) => Math.max(...rs.map((r) => r.x)) - Math.min(...rs.map((r) => r.x));
  assert.ok(width(far) > width(near) + 40, `${width(far)} vs ${width(near)}`);
});

test('no waves on land or under a dock', () => {
  const { scene, g } = fakeScene();
  const wet = (x) => x < 520; // land from x 520 eastward
  const wake = new Wake(scene, { depth: 0, wet });
  const end = rideUp(wake);
  wake.draw(end);
  assert.ok(g.rects.length > 0);
  assert.ok(g.rects.every((r) => r.x < 520 + 4), 'nothing drawn east of the shore');
});

test('a hop off and back on somewhere else starts a new wake, not a wave across the gap', () => {
  const { scene, g } = fakeScene();
  const wake = new Wake(scene, { depth: 0, wet: () => true });
  rideUp(wake, { ms: 300, x: 300 });
  const end = rideUp(wake, { from: 600, ms: 300, x: 900 });
  wake.draw(end);
  // Between the two runs (x 340..860, well past either's spread) nothing is drawn.
  assert.ok(!g.rects.some((r) => r.x > 420 && r.x < 780), 'no wave joins the two runs');
});

test('the wake fades out once its life is up', () => {
  const { scene, g } = fakeScene();
  const wake = new Wake(scene, { depth: 0, wet: () => true });
  const end = rideUp(wake);
  wake.draw(end + RIDE.wake.life + 20);
  assert.equal(g.rects.length, 0);
  assert.equal(wake.trail.length, 0);
});
