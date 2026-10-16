// Unit tests for the pure combat systems (no browser needed).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import SCOTT from '../src/data/scott.js';
import derek from '../src/data/enemies/derek.js';
import { ENEMIES } from '../src/data/enemies/index.js';
import { DISS_TYPES } from '../src/data/types.js';
import { CROWD } from '../src/data/rules.js';
import {
  createBattler, resolveHit, rollDamage, startOfTurnFlow, checkStatusTriggers, discover, softSpotKey, restore, scottBarsFor,
} from '../src/systems/combat.js';
import { rateTiming, markerPosition, sweepMs } from '../src/systems/timing.js';
import { StatusSet } from '../src/systems/status.js';
import { Crowd } from '../src/systems/crowd.js';
import { chooseEnemyMove } from '../src/systems/ai.js';
import { createRng } from '../src/systems/rng.js';
import { parseCouplet, plainCouplet } from '../src/systems/bars.js';
import { REGIONS, regionById } from '../src/data/regions.js';
import { CREW } from '../src/data/crew.js';
import { allStatuses, newlyOpened } from '../src/systems/progress.js';

const noVariance = { range: () => 1 };

test('hit results against Derek match CLAUDE.md §4', () => {
  const d = createBattler(derek);
  const cases = [
    ['FLEX', 'WEALTH', 'crit', 3],
    ['ROAST', 'INTELLECT', 'bypass', 1],
    ['WORDPLAY', 'CAREER', 'nerve', 1.5],
    ['FLEX', 'PHYSIQUE', 'weak', 2],
    ['ROAST', 'LOOKS', 'resisted', 0.5],
    ['WORDPLAY', 'NAME', 'normal', 1],
    [null, null, 'normal', 1], // Drop the Mic
  ];
  for (const [type, target, kind, mult] of cases) {
    const hit = resolveHit(d, type, target);
    assert.equal(hit.id, kind, `${type}>${target}`);
    assert.equal(hit.mult, mult, `${type}>${target}`);
  }
});

test('hit results against $cott apply the same rules (§5.3)', () => {
  const s = createBattler(SCOTT);
  assert.equal(resolveHit(s, 'ROAST', 'LOOKS').id, 'crit'); // the hairline
  assert.equal(resolveHit(s, 'FLEX', 'STYLE').id, 'bypass'); // the vest
  assert.equal(resolveHit(s, 'ROAST', 'LIFESTYLE').id, 'weak');
  assert.equal(resolveHit(s, 'FLEX', 'WEALTH').id, 'resisted');
  assert.equal(resolveHit(s, 'WORDPLAY', 'CAREER').id, 'normal');
  assert.equal(resolveHit(s, 'HYPE', null).id, 'normal'); // Pump & Dump
});

test('damage formula (§5.6)', () => {
  const s = createBattler(SCOTT);
  const d = createBattler(derek);
  const base = { attacker: s, defender: d, variance: [0.9, 1.1], rng: noVariance };

  // Lambo Lullaby, PERFECT, crit: 20 × 1.5 × 3 = 90
  assert.equal(rollDamage({ ...base, power: 20, timingMult: 1.5, hitMult: 3 }), 90);
  // Mooning: × 1.5
  s.statuses.apply('mooning');
  assert.equal(rollDamage({ ...base, power: 20, timingMult: 1, hitMult: 1 }), 30);
  // Enemy hit on a Mooning $cott while Short Squeezed: 10 × 2 × 1.3 × 1.25 = 32.5 → 33
  d.statuses.apply('shortSqueezed');
  assert.equal(rollDamage({ power: 10, hitMult: 2, attacker: d, defender: s, variance: [0.85, 1.15], rng: noVariance }), 33);
  // Minimum 1
  assert.equal(rollDamage({ ...base, power: 0.1, timingMult: 0.6, hitMult: 0.5 }), 1);
});

test('damage variance stays inside its range', () => {
  const s = createBattler(SCOTT);
  const d = createBattler(derek);
  const r = createRng(42);
  for (let i = 0; i < 500; i++) {
    const dmg = rollDamage({ power: 100, attacker: s, defender: d, variance: [0.9, 1.1], rng: r });
    assert.ok(dmg >= 90 && dmg <= 110, `${dmg}`);
  }
});

test('timing ratings measure distance against half the bar (§5.4)', () => {
  const at = (pos) => rateTiming(pos).id;
  assert.equal(at(0.5), 'PERFECT');
  assert.equal(at(0.54), 'PERFECT'); // 8% of the half-bar
  assert.equal(at(0.46), 'PERFECT');
  assert.equal(at(0.545), 'FIRE');
  assert.equal(at(0.6), 'FIRE');
  assert.equal(at(0.605), 'MID');
  assert.equal(at(0.68), 'MID');
  assert.equal(at(0.685), 'WACK');
  assert.equal(at(0), 'WACK');
  assert.equal(rateTiming(0.5).mult, 1.5);
  assert.equal(rateTiming(0).crowd, -5);
});

test('timing marker bounces end to end, 820 ms per sweep at speed 1', () => {
  assert.equal(sweepMs(1), 820);
  assert.equal(sweepMs(1.25), 656);
  assert.equal(markerPosition(0, 1), 0);
  assert.equal(markerPosition(410, 1), 0.5);
  assert.equal(markerPosition(820, 1), 1);
  assert.equal(markerPosition(1230, 1), 0.5);
  assert.equal(markerPosition(1640, 1), 0);
  assert.equal(markerPosition(0, 1, true), 1);
  assert.equal(markerPosition(820, 1, true), 0);
});

test('Mooning counts down at the end of every round, including the first', () => {
  const set = new StatusSet();
  set.apply('mooning'); // used in round 1
  assert.equal(set.get('mooning').turns, 3);
  let boostedAttacks = 0;
  set.tick(); // end of round 1
  while (set.has('mooning')) {
    boostedAttacks += 1; // $cott attacks in this round
    set.tick();
  }
  assert.equal(boostedAttacks, 2);
});

test('Rug Pulled drains 8 Flow twice, then regen resumes (§5.7)', () => {
  const s = createBattler(SCOTT);
  s.flow = 40;
  s.statuses.apply('rugPulled');
  assert.equal(s.statuses.tick().length, 0, "end of round doesn't touch it");
  let r = startOfTurnFlow(s, false);
  assert.equal(r.kind, 'drain');
  assert.equal(s.flow, 32);
  assert.equal(s.statuses.get('rugPulled').turns, 1);
  r = startOfTurnFlow(s, false);
  assert.equal(s.flow, 24);
  assert.deepEqual(r.expired.map((x) => x.id), ['rugPulled']);
  assert.equal(startOfTurnFlow(s, false).kind, 'regen');
  assert.equal(s.flow, 29);
});

test('Flow regen: +5 after the first turn, capped (§5.1)', () => {
  const s = createBattler(SCOTT);
  assert.equal(startOfTurnFlow(s, true).kind, 'none');
  assert.equal(startOfTurnFlow(s, false).amount, 0); // already full
  s.flow = 20;
  assert.equal(startOfTurnFlow(s, false).amount, 5);
  assert.equal(s.flow, 25);
  s.flow = 3;
  s.statuses.apply('rugPulled');
  assert.equal(startOfTurnFlow(s, false).amount, 3); // can't go below 0
  assert.equal(s.flow, 0);
});

test('Short Squeezed is permanent', () => {
  const set = new StatusSet();
  set.apply('shortSqueezed');
  for (let i = 0; i < 10; i++) set.tick();
  assert.equal(set.has('shortSqueezed'), true);
  assert.equal(set.tint(), 0xffa0a0);
});

test('items and restores cap at max', () => {
  const s = createBattler(SCOTT);
  assert.deepEqual(s.items, { coldBrew: 2, voicemail: 1 });
  s.ego = 80;
  assert.deepEqual(restore(s, { ego: 35 }), { ego: 20, flow: 0 });
  assert.equal(s.ego, 100);
});

test('crowd meter clamps, unlocks at 100, and locks until the mic drops (§5.5)', () => {
  const c = new Crowd();
  assert.deepEqual(c.add(-5), { delta: 0, becameFull: false });
  c.add(25 + 20); // PERFECT crit
  assert.equal(c.value, 45);
  c.add(CROWD.enemyHit);
  assert.equal(c.value, 41);
  assert.equal(c.add(80).becameFull, true);
  assert.equal(c.value, 100);
  c.add(CROWD.enemyCritHit);
  assert.equal(c.value, 100, 'stays full until Drop the Mic is used');
  c.reset();
  assert.equal(c.value, 0);

  const prototype = new Crowd({ lockWhenFull: false });
  prototype.add(100);
  prototype.add(-4);
  assert.equal(prototype.value, 96, "the prototype's behavior");
});

test('Short Squeezed triggers at 40% Ego or below (§4)', () => {
  const d = createBattler(derek);
  d.ego = 61;
  assert.equal(checkStatusTriggers(d).length, 0);
  d.ego = 60;
  assert.deepEqual(checkStatusTriggers(d).map((t) => t.status), ['shortSqueezed']);
  assert.equal(checkStatusTriggers(d).length, 0, 'only fires once');
  assert.equal(d.statuses.dealMult(), 1.3);
});

test('discovery reveals weakness, resistance, and soft spots', () => {
  const d = createBattler(derek);
  discover(d, 'FLEX', resolveHit(d, 'FLEX', 'WEALTH'));
  assert.ok(d.discovered.weak.has('FLEX'));
  assert.ok(d.discovered.softSpots.has(softSpotKey('FLEX', 'WEALTH')));
  discover(d, 'ROAST', resolveHit(d, 'ROAST', 'LOOKS'));
  assert.ok(d.discovered.resist.has('ROAST'));
  assert.equal(discover(d, 'WORDPLAY', resolveHit(d, 'WORDPLAY', 'NAME')), false);
});

test("Derek's AI: Pump & Dump rule, then weights (§5.9)", () => {
  const d = createBattler(derek);
  const s = createBattler(SCOTT);
  const r = createRng(7);
  const counts = {};
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const m = chooseEnemyMove(d, s, r);
    counts[m.id] = (counts[m.id] ?? 0) + 1;
  }
  const share = (id) => (counts[id] ?? 0) / N;
  assert.ok(Math.abs(share('pump') - 0.3) < 0.02, `pump ${share('pump')}`);
  // The other 70% splits by weight: 30/20/20/15/15/10 (out of 110).
  const total = derek.moves.reduce((sum, m) => sum + m.weight, 0);
  for (const move of derek.moves.filter((m) => m.weight > 0)) {
    const expected = 0.7 * (move.weight / total);
    assert.ok(Math.abs(share(move.id) - expected) < 0.015, `${move.id} ${share(move.id)} vs ${expected}`);
  }

  s.statuses.apply('rugPulled');
  for (let i = 0; i < 500; i++) assert.notEqual(chooseEnemyMove(d, s, r).id, 'pump');
  s.statuses.remove('rugPulled');
  s.flow = 14;
  for (let i = 0; i < 500; i++) assert.notEqual(chooseEnemyMove(d, s, r).id, 'pump');
});

test('bars come from couplet pools', () => {
  const r = createRng(3);
  const lambo = SCOTT.moves.find((m) => m.id === 'lambo');
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(scottBarsFor(derek, lambo, 'WEALTH', r)[0]);
  assert.equal(seen.size, 2, 'both WEALTH couplets show up');
  assert.deepEqual(scottBarsFor(derek, SCOTT.micDrop, null, r), derek.micBars[0]);
  assert.equal(scottBarsFor(derek, SCOTT.moves.find((m) => m.id === 'mooning'), null, r).length, 2);
});

test('seeded rng is repeatable', () => {
  const a = createRng(123);
  const b = createRng(123);
  for (let i = 0; i < 50; i++) assert.equal(a.random(), b.random());
});

test('every villain has couplets for every type and target, and for each move', () => {
  const isCouplet = (c) => Array.isArray(c) && c.length === 2 && c.every((l) => typeof l === 'string' && l.length);
  const isPool = (p) => Array.isArray(p) && p.length > 0 && p.every(isCouplet);
  for (const enemy of Object.values(ENEMIES)) {
    for (const [type, { targets }] of Object.entries(DISS_TYPES)) {
      for (const target of targets) assert.ok(isPool(enemy.scottBars[type]?.[target]), `${enemy.id} scottBars.${type}.${target}`);
    }
    assert.ok(isPool(enemy.micBars), `${enemy.id} micBars`);
    for (const move of enemy.moves) {
      assert.ok(isPool(move.bars), `${enemy.id} ${move.id} bars`);
      if (move.target) assert.ok(DISS_TYPES[move.type].targets.includes(move.target), `${enemy.id} ${move.id} target`);
    }
    for (const rule of enemy.ai?.rules ?? []) {
      assert.ok(enemy.moves.some((m) => m.id === rule.move), `${enemy.id} AI rule ${rule.move}`);
    }
  }
});

test('bars: the last word of each line rhymes by default', () => {
  const [a, b] = parseCouplet(['Your hairline is retreating all year,', "I'd short it, Money, but it's outta here."]);
  assert.deepEqual(a.words.filter((w) => w.rhyme).map((w) => w.text), ['year,']);
  assert.deepEqual(b.words.filter((w) => w.rhyme).map((w) => w.text), ['here.']);
  assert.equal(a.direction, false);
});

test('bars: [brackets] mark rhymes, including multi-word ones', () => {
  const lines = parseCouplet(["My watch beats your portfolio's [peak],", 'your [grow up] was a Tuesday last [week].']);
  const rhymes = lines.flatMap((l) => l.words.filter((w) => w.rhyme).map((w) => w.text));
  assert.deepEqual(rhymes, ['peak,', 'grow', 'up', 'week.']);
  assert.ok(lines.every((l) => l.words.every((w) => !/[[\]]/.test(w.text))), 'brackets are stripped');
});

test('bars: *stage directions* never rhyme', () => {
  const [action, quote] = parseCouplet(['*puts on a second pair of sunglasses*', '"Number go up. That\'s the whole whitepaper."']);
  assert.equal(action.direction, true);
  assert.ok(action.words.every((w) => !w.rhyme));
  assert.equal(quote.words.at(-1).rhyme, true);
});

test('bars: plainCouplet removes markup', () => {
  assert.deepEqual(plainCouplet(['a [b] c', '[d e]']), ['a b c', 'd e']);
});

test('regions: the map pack and regions.js agree', async () => {
  const fs = await import('node:fs');
  const map = JSON.parse(fs.readFileSync(new URL('../assets/map/map_regions.json', import.meta.url), 'utf8'));
  const byKey = Object.fromEntries(map.regions.map((r) => [r.key, r]));
  assert.deepEqual(REGIONS.map((r) => r.id).sort(), Object.keys(byKey).sort());
  for (const r of REGIONS) {
    assert.equal(r.name, byKey[r.id].name, r.id);
    if (r.villain) assert.ok(ENEMIES[r.villain], `${r.id} villain ${r.villain}`);
    if (r.recruit) assert.ok(CREW[r.recruit], `${r.id} recruit ${r.recruit}`);
  }
  // Map order never goes backwards in tier, and every route step joins real regions.
  const ordered = [...map.regions].sort((a, b) => a.order - b.order).map((r) => regionById(r.key).tier);
  assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b));
  for (const seg of map.route) assert.ok(byKey[seg.frm] && byKey[seg.to], `${seg.frm}->${seg.to}`);
});

test('progress: tiers open in pairs, finale, then the tower', () => {
  const status = (...cleared) => allStatuses(new Set(cleared));
  let s = status();
  assert.equal(s.start, 'open');
  assert.ok(REGIONS.filter((r) => r.id !== 'start').every((r) => s[r.id] === 'locked'));

  s = status('start');
  assert.equal(s.start, 'cleared');
  assert.equal(s.isles, 'open');
  assert.equal(s.ratio, 'open');
  assert.equal(s.riviera, 'locked');

  s = status('start', 'ratio'); // either order within a tier
  assert.equal(s.isles, 'open');
  assert.equal(s.riviera, 'locked', 'needs both tier 1 regions');

  s = status('start', 'ratio', 'isles');
  assert.equal(s.riviera, 'open');
  assert.equal(s.lofi, 'open');

  s = status('start', 'isles', 'ratio', 'riviera', 'lofi', 'bubble', 'offshore');
  assert.equal(s.apex, 'open');
  assert.equal(s.citadel, 'locked');
  assert.equal(status('start', 'isles', 'ratio', 'riviera', 'lofi', 'bubble', 'offshore', 'apex').citadel, 'open');
});

test('progress: clearing a region reports what it opened', () => {
  assert.deepEqual(newlyOpened(new Set(['start']), 'start'), ['isles', 'ratio']);
  assert.deepEqual(newlyOpened(new Set(['start', 'isles']), 'isles'), [], 'tier 2 waits for Mount Ratio');
  assert.deepEqual(newlyOpened(new Set(['start', 'isles', 'ratio']), 'ratio'), ['riviera', 'lofi']);
});
