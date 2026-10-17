// Unit tests for the Sin who follows $cott around (systems/follower.js,
// data/followers.js): Lil' Turnt walking his trail, Pikachu style. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Trail, facingOf, moodOf, followerLines } from '../src/systems/follower.js';
import { FOLLOWERS, MAX_JEALOUSY } from '../src/data/followers.js';
import { EMOTES } from '../src/ui/emote.js';
import { MAPS } from '../src/data/maps/index.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Walk the leader along a list of points in small steps, recording as the scene does. */
function walk(trail, from, points, step = 5) {
  let at = { ...from };
  for (const p of points) {
    while (dist(at, p) > 0.001) {
      const d = Math.min(step, dist(at, p));
      const k = d / dist(at, p);
      at = { x: at.x + (p.x - at.x) * k, y: at.y + (p.y - at.y) * k };
      trail.record(at.x, at.y);
    }
  }
  return at;
}

test('she starts gap px behind him, on the side he faces away from', () => {
  const t = new Trail(70, { x: 500, y: 500 }, { facing: 'up' });
  assert.deepEqual(t.position(), { x: 500, y: 570 });
  assert.deepEqual(new Trail(70, { x: 500, y: 500 }, { facing: 'right' }).position(), { x: 430, y: 500 });
});

test('she walks his trail: gap px back along it, even around corners', () => {
  const t = new Trail(70, { x: 0, y: 0 }, { facing: 'right' });
  // Right 200, then down 200: after the corner, she's on his path, not cutting across it.
  walk(t, { x: 0, y: 0 }, [{ x: 200, y: 0 }, { x: 200, y: 30 }]);
  const p = t.position();
  // 30 px down the second leg, so 40 px back along the first.
  assert.ok(Math.abs(p.x - 160) < 1 && Math.abs(p.y) < 1, JSON.stringify(p));
  walk(t, { x: 200, y: 30 }, [{ x: 200, y: 200 }]);
  const q = t.position();
  assert.ok(Math.abs(q.x - 200) < 1 && Math.abs(q.y - 130) < 1, JSON.stringify(q));
});

test('she stops when he stops, and the trail stays short', () => {
  const t = new Trail(70, { x: 0, y: 0 }, { facing: 'down' });
  const end = walk(t, { x: 0, y: 0 }, [{ x: 0, y: 3000 }, { x: 3000, y: 3000 }]);
  const p = t.position();
  for (let i = 0; i < 10; i++) t.record(end.x, end.y);
  assert.deepEqual(t.position(), p);
  assert.ok(t.points.length < 40, `trail trimmed (${t.points.length} points)`);
});

test('every spot she stands on is a spot he stood on (so she never walks through walls)', () => {
  const t = new Trail(70, { x: 0, y: 0 }, { facing: 'left' });
  const visited = [];
  let at = { x: 0, y: 0 };
  // A zigzag, recording every step.
  for (const p of [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 200 }, { x: 150, y: 200 }]) {
    while (dist(at, p) > 0.001) {
      const d = Math.min(4, dist(at, p));
      const k = d / dist(at, p);
      at = { x: at.x + (p.x - at.x) * k, y: at.y + (p.y - at.y) * k };
      visited.push(at);
      t.record(at.x, at.y);
      const her = t.position();
      if (visited.length * 4 > 80) {
        // On the polyline he walked: within a step of some point of it.
        assert.ok(visited.some((v) => dist(v, her) <= 4.01), `off his path at ${JSON.stringify(her)}`);
      }
    }
  }
});

test('facing comes from the way she moved', () => {
  assert.equal(facingOf(5, 1), 'right');
  assert.equal(facingOf(-5, 1), 'left');
  assert.equal(facingOf(1, -5), 'up');
  assert.equal(facingOf(0, 5), 'down');
  assert.equal(facingOf(0, 0), null);
});

test("Lil' Turnt's moods climb with jealousy, and each has an emote and lines", () => {
  const { moods } = FOLLOWERS.lilturnt;
  assert.equal(moodOf(moods, 0).id, moods[0].id);
  let last = -1;
  for (let j = 0; j <= MAX_JEALOUSY; j++) {
    const i = moods.indexOf(moodOf(moods, j));
    assert.ok(i >= last, 'never calms down as jealousy rises');
    last = i;
  }
  assert.equal(moodOf(moods, MAX_JEALOUSY).id, moods.at(-1).id);
  for (const m of moods) {
    assert.ok(EMOTES.includes(m.emote), m.id);
    assert.ok(m.lines.length > 0, m.id);
  }
  for (const e of FOLLOWERS.lilturnt.idle.emotes) assert.ok(EMOTES.includes(e), e);
});

test('her lines: the intro first, then whoever is nearby, else the map or her mood', () => {
  const data = FOLLOWERS.lilturnt;
  const first = (n) => 0;
  assert.deepEqual(followerLines(data, { first: true, mood: 'smitten' }, first), data.intro);
  assert.deepEqual(followerLines(data, { near: 'wendy', map: 'start', mood: 'smitten' }, first), [data.near.wendy[0]]);
  // Nobody she has a line for nearby: the map (pick 0) or her mood (pick 1).
  assert.deepEqual(followerLines(data, { near: 'nobody', map: 'start', mood: 'smitten' }, first), [data.maps.start[0]]);
  assert.deepEqual(followerLines(data, { map: 'start', mood: 'jealous' }, (n) => (n === 2 ? 1 : 0)), [data.moods.find((m) => m.id === 'jealous').lines[0]]);
  assert.deepEqual(followerLines(data, { map: 'nowhere', mood: 'fuming' }, first), [data.moods.find((m) => m.id === 'fuming').lines[0]]);
});

test('her map and nearby lines name real maps and NPCs', () => {
  const data = FOLLOWERS.lilturnt;
  for (const id of Object.keys(data.maps)) assert.ok(MAPS[id], `no map ${id}`);
  const npcs = new Set(Object.values(MAPS).flatMap((m) => m.npcs.map((n) => n.id)));
  for (const id of Object.keys(data.near)) assert.ok(npcs.has(id), `no NPC ${id}`);
});
