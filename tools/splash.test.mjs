// White water at the jet ski's stern (ui/splash.js): spray that rides along
// with the ski, grows with speed, stays off land, and a hop's burst.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Splash } from '../src/ui/splash.js';
import { RIDE } from '../src/config.js';

/** A stand-in for Phaser's Graphics: records every square drawn. */
function fakeGraphics() {
  const g = { rects: [], depth: 0 };
  Object.assign(g, {
    setDepth: (d) => { g.depth = d; return g; },
    clear: () => { g.rects.length = 0; },
    fillStyle: () => g,
    fillRect: (x, y, w, h) => g.rects.push({ x, y, w, h }),
  });
  return g;
}
const fakeScene = () => ({ add: { graphics: fakeGraphics } });

/** A seeded random source, so the spray is the same every run. */
function seeded(seed = 7) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Ride straight up at `speed` px/s for `ms`, 16 ms a frame; returns the end time and the stern's spot. */
function ride(splash, { speed = RIDE.speed, ms = 800, x = 500, y0 = 1000, from = 0 } = {}) {
  let y = y0;
  for (let t = from; t < from + ms; t += 16) {
    y -= (speed * 16) / 1000;
    splash.update(t, 16, { x, y, ux: 0, uy: -1, half: 26, speed, front: true, depth: 10 });
    splash.draw(t, 16);
  }
  return { end: from + ms, x, y };
}

test('the spray rides along just behind the stern, not left where it was thrown', () => {
  const splash = new Splash(fakeScene(), { wet: () => true, rand: seeded() });
  const { x, y } = ride(splash);
  assert.ok(splash.drops.length > 20, `${splash.drops.length} droplets in the air`);
  for (const d of splash.drops) {
    assert.ok(Math.abs(d.x - x) < 120, `droplet ${Math.round(d.x - x)} px off to the side`);
    assert.ok(d.y - y > -40 && d.y - y < 220, `droplet ${Math.round(d.y - y)} px behind the stern`);
  }
});

test('faster means more white water; stopped, it settles', () => {
  const fast = new Splash(fakeScene(), { wet: () => true, rand: seeded() });
  const slow = new Splash(fakeScene(), { wet: () => true, rand: seeded() });
  ride(fast);
  ride(slow, { speed: RIDE.speed * 0.25 });
  assert.ok(fast.drops.length > slow.drops.length * 2, `${fast.drops.length} vs ${slow.drops.length}`);
  const still = new Splash(fakeScene(), { wet: () => true, rand: seeded() });
  const { end } = ride(still);
  ride(still, { speed: 0, from: end, ms: 2000 });
  assert.equal(still.drops.length, 0, 'the spray has fallen back in');
  assert.ok(still.power < 0.01);
  assert.equal(still.front.rects.length + still.back.rects.length, 0, 'nothing left to draw');
});

test('the churn stays on the water', () => {
  const splash = new Splash(fakeScene(), { wet: (x) => x < 500, rand: seeded() });
  splash.update(0, 16, { x: 500, y: 1000, ux: 0, uy: -1, half: 26, speed: RIDE.speed, front: true, depth: 10 });
  splash.power = 1;
  splash.drops = [];
  splash.draw(0, 16);
  const churn = splash.front.rects;
  assert.ok(churn.length > 0, 'some churn on the water side');
  assert.ok(churn.every((r) => r.x < 500 + 24), 'none drawn out on the land side');
});

test("it's layered in front of the hull when the stern is nearest the camera, behind it otherwise", () => {
  const splash = new Splash(fakeScene(), { wet: () => true, rand: seeded() });
  splash.update(0, 16, { x: 0, y: 0, ux: 0, uy: -1, half: 26, speed: RIDE.speed, front: true, depth: 10 });
  assert.ok(splash.front.depth > 10 && splash.back.depth < 10);
  splash.power = 1;
  splash.draw(0, 16);
  assert.ok(splash.front.rects.length > 0 && splash.back.rects.length === 0, 'riding up: in front');
  splash.update(16, 16, { x: 0, y: 0, ux: 0, uy: 1, half: 26, speed: RIDE.speed, front: false, depth: 10 });
  splash.drops = [];
  splash.draw(16, 16);
  assert.ok(splash.back.rects.length > 0 && splash.front.rects.length === 0, 'riding down: behind');
});

test('a hop throws a burst that falls back in', () => {
  const splash = new Splash(fakeScene(), { wet: () => true, rand: seeded() });
  splash.burst(0, 300, 300);
  assert.equal(splash.drops.length, RIDE.splash.burst);
  for (let t = 16; t < 1600; t += 16) splash.draw(t, 16);
  assert.equal(splash.drops.length, 0);
});
