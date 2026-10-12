// Unit tests for the pure combat systems (no browser needed).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import SCOTT from '../src/data/scott.js';
import derek from '../src/data/enemies/derek.js';
import { ENEMIES } from '../src/data/enemies/index.js';
import { DISS_TYPES } from '../src/data/types.js';
import { STATUSES } from '../src/data/statuses.js';
import { CROWD } from '../src/data/rules.js';
import {
  createBattler, resolveHit, rollDamage, startOfTurnFlow, checkStatusTriggers, discover, softSpotKey, restore,
} from '../src/systems/combat.js';
import { rateTiming, markerPosition, sweepMs } from '../src/systems/timing.js';
import { StatusSet } from '../src/systems/status.js';
import { Crowd } from '../src/systems/crowd.js';
import { chooseEnemyMove } from '../src/systems/ai.js';
import { createRng } from '../src/systems/rng.js';

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

test("hit results against $cott apply the same rules (§5.3)", () => {
  const s = createBattler(SCOTT);
  assert.equal(resolveHit(s, 'ROAST', 'LOOKS').id, 'crit'); // the hairline
  assert.equal(resolveHit(s, 'FLEX', 'STYLE').id, 'bypass'); // the vest
  assert.equal(resolveHit(s, 'ROAST', 'FAMILY').id, 'weak');
  assert.equal(resolveHit(s, 'FLEX', 'WEALTH').id, 'resisted');
  assert.equal(resolveHit(s, 'WORDPLAY', 'CAREER').id, 'normal');
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

test('timing ratings (§5.4)', () => {
  const at = (pos) => rateTiming(pos).id;
  assert.equal(at(0.5), 'PERFECT');
  assert.equal(at(0.58), 'PERFECT');
  assert.equal(at(0.42), 'PERFECT');
  assert.equal(at(0.59), 'FIRE');
  assert.equal(at(0.7), 'FIRE');
  assert.equal(at(0.71), 'MID');
  assert.equal(at(0.86), 'MID');
  assert.equal(at(0.87), 'WACK');
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
});

test('statuses skip the tick of the round they were applied in', () => {
  const set = new StatusSet();
  set.apply('rugPulled');
  assert.deepEqual(set.tick(), []); // applied this round
  assert.equal(set.get('rugPulled').turns, 2);
  assert.deepEqual(set.tick(), []);
  assert.equal(set.get('rugPulled').turns, 1);
  assert.deepEqual(set.tick().map((s) => s.id), ['rugPulled']);
  assert.equal(set.has('rugPulled'), false);

  set.apply('shortSqueezed'); // permanent
  for (let i = 0; i < 10; i++) set.tick();
  assert.equal(set.has('shortSqueezed'), true);
});

test('Mooning lasts for 3 of $cott\'s following turns', () => {
  const set = new StatusSet();
  set.apply('mooning');
  let boostedTurns = 0;
  set.tick(); // end of the round it was used
  while (set.has('mooning')) {
    boostedTurns += 1; // $cott attacks this round
    set.tick();
  }
  assert.equal(boostedTurns, STATUSES.mooning.turns);
});

test('Flow: +5 regen after the first turn, Rug Pulled drains 8 instead (§5.1, §5.7)', () => {
  const s = createBattler(SCOTT);
  assert.deepEqual(startOfTurnFlow(s, true), { kind: 'none', amount: 0 });
  assert.equal(s.flow, 60);
  assert.deepEqual(startOfTurnFlow(s, false), { kind: 'regen', amount: 0 }); // capped
  s.flow = 20;
  assert.deepEqual(startOfTurnFlow(s, false), { kind: 'regen', amount: 5 });
  assert.equal(s.flow, 25);
  s.statuses.apply('rugPulled');
  assert.deepEqual(startOfTurnFlow(s, false), { kind: 'drain', amount: 8 });
  assert.equal(s.flow, 17);
  s.flow = 3;
  assert.deepEqual(startOfTurnFlow(s, false), { kind: 'drain', amount: 3 });
  assert.equal(s.flow, 0);
});

test('items and restores cap at max', () => {
  const s = createBattler(SCOTT);
  assert.deepEqual(s.items, { coldBrew: 2, voicemail: 1 });
  s.clout = 80;
  assert.deepEqual(restore(s, { clout: 35 }), { clout: 20, flow: 0 });
  assert.equal(s.clout, 100);
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

  const unlocked = new Crowd({ lockWhenFull: false });
  unlocked.add(100);
  unlocked.add(-4);
  assert.equal(unlocked.value, 96);
});

test('Short Squeezed triggers at 40% Clout or below (§4)', () => {
  const d = createBattler(derek);
  d.clout = 61;
  assert.equal(checkStatusTriggers(d).length, 0);
  d.clout = 60;
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
  const share = (id) => counts[id] / N;
  assert.ok(Math.abs(share('pumpDump') - 0.3) < 0.02, `pumpDump ${share('pumpDump')}`);
  // The other 70% splits by weight: 30/20/20/15/15/10 (out of 110).
  const total = derek.moves.reduce((sum, m) => sum + m.weight, 0);
  for (const move of derek.moves.filter((m) => m.weight > 0)) {
    const expected = 0.7 * (move.weight / total);
    assert.ok(Math.abs(share(move.id) - expected) < 0.015, `${move.id} ${share(move.id)} vs ${expected}`);
  }

  s.statuses.apply('rugPulled');
  for (let i = 0; i < 500; i++) assert.notEqual(chooseEnemyMove(d, s, r).id, 'pumpDump');
  s.statuses.remove('rugPulled');
  s.flow = 14;
  for (let i = 0; i < 500; i++) assert.notEqual(chooseEnemyMove(d, s, r).id, 'pumpDump');
});

test('seeded rng is repeatable', () => {
  const a = createRng(123);
  const b = createRng(123);
  for (let i = 0; i < 50; i++) assert.equal(a.random(), b.random());
});

test('every villain has a couplet for every type and target, and for each move', () => {
  for (const enemy of Object.values(ENEMIES)) {
    for (const [type, { targets }] of Object.entries(DISS_TYPES)) {
      for (const target of targets) {
        const bars = enemy.scottBars[type]?.[target];
        assert.ok(Array.isArray(bars) && bars.length === 2, `${enemy.id} scottBars.${type}.${target}`);
      }
    }
    assert.equal(enemy.scottBars.MIC?.length, 2, `${enemy.id} scottBars.MIC`);
    for (const move of enemy.moves) {
      assert.equal(move.bars?.length, 2, `${enemy.id} ${move.id} bars`);
      if (move.type && move.type !== 'HYPE') {
        assert.ok(DISS_TYPES[move.type].targets.includes(move.target), `${enemy.id} ${move.id} target`);
      }
    }
    for (const rule of enemy.ai?.rules ?? []) {
      assert.ok(enemy.moves.some((m) => m.id === rule.move), `${enemy.id} AI rule ${rule.move}`);
    }
  }
});
