// Unit tests for the Sin who follows $cott around (systems/follower.js,
// data/followers.js): Lil' Turnt walking his trail, Pikachu style. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Trail, Barker, barkTargets, facingOf, moodOf, followerLines } from '../src/systems/follower.js';
import { PROP_IMAGES } from '../src/data/assets.js';
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

test('near a diagonal, facing holds until the other way clearly leads', () => {
  // Wobbling around 45° keeps whichever way he was already facing.
  assert.equal(facingOf(10, 11, 'right'), 'right');
  assert.equal(facingOf(11, 10, 'down'), 'down');
  // Clearly past it, he turns.
  assert.equal(facingOf(10, 15, 'right'), 'down');
  assert.equal(facingOf(15, 10, 'down'), 'right');
  // Reversing turns him at once, whatever the lead.
  assert.equal(facingOf(-10, 11, 'right'), 'down');
  assert.equal(facingOf(-10, 1, 'right'), 'left');
  assert.equal(facingOf(0, -5, 'down'), 'up');
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

// ---- Barks: one-liners over her head as $cott walks past things ----------------

const target = (key, x, y, lines = ['a', 'b']) => ({ key, x, y, lines });
const always = () => 0;
const never = () => 0.99;
const firstPick = () => 0;

test('a bark comes when he walks up to something, not while he stays by it', () => {
  const b = new Barker({ chance: 1, cooldownMs: 0, againMs: 0, range: 100 }, { now: 0, settleMs: 0 });
  const t = [target('npc:brad', 500, 0)];
  assert.equal(b.update(0, { x: 0, y: 0 }, t, always, firstPick), null); // far away
  const bark = b.update(10, { x: 450, y: 0 }, t, always, firstPick);
  assert.equal(bark?.key, 'npc:brad');
  assert.equal(b.update(20, { x: 460, y: 0 }, t, always, firstPick), null, 'still standing there: no second bark');
  b.update(30, { x: 0, y: 0 }, t, always, firstPick); // walks off
  assert.equal(b.update(40, { x: 450, y: 0 }, t, always, firstPick)?.key, 'npc:brad', 'comes back: another');
});

test('barks are occasional: the chance roll, the cooldown, and once in a while per thing', () => {
  const t = [target('npc:brad', 100, 0), target('prop:prop_hottub', 0, 100)];
  const far = { x: 1000, y: 1000 };
  // The roll says no.
  let b = new Barker({ chance: 0.5, range: 50 }, { now: 0, settleMs: 0 });
  b.update(0, far, t, never, firstPick);
  assert.equal(b.update(1, { x: 100, y: 0 }, t, never, firstPick), null);
  // The cooldown: a second thing right after the first stays quiet.
  b = new Barker({ chance: 1, cooldownMs: 5000, againMs: 0, range: 50 }, { now: 0, settleMs: 0 });
  b.update(0, far, t, always, firstPick);
  assert.ok(b.update(1, { x: 100, y: 0 }, t, always, firstPick));
  assert.equal(b.update(2, { x: 0, y: 100 }, t, always, firstPick), null);
  // ...but not after it.
  b.update(3, far, t, always, firstPick);
  assert.ok(b.update(6000, { x: 0, y: 100 }, t, always, firstPick));
  // Once in a while per thing: back to Brad too soon, nothing.
  b = new Barker({ chance: 1, cooldownMs: 0, againMs: 60000, range: 50 }, { now: 0, settleMs: 0 });
  b.update(0, far, t, always, firstPick);
  assert.ok(b.update(1, { x: 100, y: 0 }, t, always, firstPick));
  b.update(2, far, t, always, firstPick);
  assert.equal(b.update(3, { x: 100, y: 0 }, t, always, firstPick), null);
  b.update(4, far, t, always, firstPick);
  assert.ok(b.update(70000, { x: 100, y: 0 }, t, always, firstPick));
});

test('nothing on arrival: what was already in range, or during the settle-in', () => {
  const t = [target('npc:brad', 0, 0)];
  let b = new Barker({ chance: 1, cooldownMs: 0, range: 100 }, { now: 0, settleMs: 0 });
  assert.equal(b.update(0, { x: 10, y: 0 }, t, always, firstPick), null, 'already beside Brad when the map loads');
  b = new Barker({ chance: 1, cooldownMs: 0, range: 100 }, { now: 0, settleMs: 2000 });
  b.update(0, { x: 500, y: 0 }, t, always, firstPick);
  assert.equal(b.update(500, { x: 10, y: 0 }, t, always, firstPick), null, 'settling in');
});

test('a different line from last time, and things sharing a key share a bark', () => {
  const b = new Barker({ chance: 1, cooldownMs: 0, againMs: 0, range: 50 }, { now: 0, settleMs: 0 });
  const t = [target('prop:prop_rack', 0, 0, ['one', 'two']), target('prop:prop_rack', 200, 0, ['one', 'two'])];
  const far = { x: 100, y: 500 };
  b.update(0, far, t, always, firstPick);
  const said = [];
  for (let i = 0; i < 4; i++) {
    said.push(b.update(i * 2 + 1, { x: 0, y: 0 }, t, always, firstPick)?.text);
    b.update(i * 2 + 2, far, t, always, firstPick);
  }
  assert.deepEqual(said, ['one', 'two', 'one', 'two']);
  // Walking from one rack to the next (both in range of one or the other) is one visit.
  b.update(100, { x: 0, y: 0 }, t, always, firstPick);
  assert.equal(b.update(101, { x: 40, y: 0 }, t, always, firstPick), null);
});

test('bark targets come from the map: NPCs, props by texture, ropes, doors (not the way out)', () => {
  const barks = { npcs: { brad: ['x'] }, props: { prop_hottub: { range: 300, lines: ['y'] } }, ropes: { vip: ['z'] }, doors: { start_lair: ['w'], map: ['never'] } };
  const out = barkTargets(barks, {
    npcs: [{ id: 'brad', x: 1, y: 2 }, { id: 'nobody', x: 0, y: 0 }],
    props: [{ texture: 'prop_hottub', x: 3, y: 4 }, { texture: 'prop_cypress', x: 0, y: 0 }],
    gates: [{ id: 'vip', x: 5, y: 6 }],
    exits: [{ to: 'start_lair', x: 0, y: 0, w: 10, h: 20 }, { to: 'map', x: 0, y: 0, w: 1, h: 1 }],
  });
  assert.deepEqual(out.map((t) => t.key), ['npc:brad', 'prop:prop_hottub', 'rope:vip', 'door:start_lair']);
  assert.equal(out[1].range, 300);
  assert.deepEqual([out[3].x, out[3].y], [5, 10]);
});

test("Lil' Turnt's barks name real NPCs, props, ropes and maps, and fit the bubble", () => {
  const { barks } = FOLLOWERS.lilturnt;
  const npcs = new Set(Object.values(MAPS).flatMap((m) => m.npcs.map((n) => n.id)));
  const ropes = new Set(Object.values(MAPS).flatMap((m) => m.gates.map((g) => g.id)));
  const props = new Set(PROP_IMAGES.map((p) => p.key));
  for (const id of Object.keys(barks.npcs)) assert.ok(npcs.has(id), `no NPC ${id}`);
  for (const id of Object.keys(barks.props)) assert.ok(props.has(id), `no prop ${id}`);
  for (const id of Object.keys(barks.ropes)) assert.ok(ropes.has(id), `no rope ${id}`);
  for (const id of Object.keys(barks.doors)) assert.ok(MAPS[id], `no map ${id}`);
  for (const group of ['npcs', 'props', 'ropes', 'doors']) {
    for (const entry of Object.values(barks[group])) {
      const lines = Array.isArray(entry) ? entry : entry.lines;
      assert.ok(lines.length > 0);
      for (const l of lines) assert.ok(l.length <= 44, `too long for the bubble: ${l}`);
    }
  }
});
