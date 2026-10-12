// Checks the modular data against the legacy prototype, which CLAUDE.md §5
// names as the source of truth. It evaluates the prototype's GAME DATA block
// (plain object literals) in an isolated vm context and compares.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import SCOTT from '../src/data/scott.js';
import derek from '../src/data/enemies/derek.js';
import { DISS_TYPES, TARGET_INFO, HIT_KINDS } from '../src/data/types.js';
import { TIMING } from '../src/data/rules.js';
import { plainCouplet } from '../src/systems/bars.js';

// Rhyme [brackets] are presentation markup the prototype didn't have.
const plainPool = (pool) => pool.map(plainCouplet);
const plainBars = (bars) => Object.fromEntries(
  Object.entries(bars).map(([type, targets]) => [type, Object.fromEntries(Object.entries(targets).map(([t, pool]) => [t, plainPool(pool)]))]),
);

const html = fs.readFileSync(new URL('../legacy/scott-money-battle.html', import.meta.url), 'utf8');
const start = html.indexOf('/* ---------------- GAME DATA');
const end = html.indexOf('/* ---------------- PIXEL SPRITES');
assert.ok(start > 0 && end > start, 'found the GAME DATA block');
// JSON round-trip: objects from the vm context have that context's prototypes,
// which strict deep-equal would reject even when the contents match.
const legacy = JSON.parse(
  vm.runInNewContext(
    `${html.slice(start, end)}; JSON.stringify({ TYPES, TARGETS, CRIT, NERVE, RATINGS, SCOTT, SCOTT_MOVES, MIC_DROP, ENEMY, SCOTT_RESIST_MSG })`,
    {},
    { timeout: 1000 },
  ),
);

test('types, targets, and target descriptions', () => {
  for (const [id, t] of Object.entries(legacy.TYPES)) {
    assert.deepEqual(DISS_TYPES[id].targets, t.targets, id);
    assert.equal(DISS_TYPES[id].color, t.color, id);
  }
  assert.deepEqual(TARGET_INFO, legacy.TARGETS);
});

test('hit multipliers', () => {
  assert.equal(HIT_KINDS.crit.mult, 2 * legacy.CRIT);
  assert.equal(HIT_KINDS.nerve.mult, legacy.NERVE);
});

test('timing ratings', () => {
  legacy.RATINGS.forEach((r, i) => {
    const mine = TIMING.ratings[i];
    assert.equal(mine.label, r.label);
    assert.equal(mine.mult, r.mult);
    assert.equal(mine.crowd, r.crowd);
    assert.equal(mine.sfx, r.sfx);
    if (r.max < 99) assert.equal(mine.within, r.max);
  });
});

test("$cott's stats, weaknesses, soft spots, and moves", () => {
  const S = legacy.SCOTT;
  assert.equal(SCOTT.maxClout, S.maxClout);
  assert.equal(SCOTT.maxFlow, S.maxFlow);
  assert.deepEqual(SCOTT.weak, S.weak);
  assert.deepEqual(SCOTT.resist, S.resist);
  for (const spot of SCOTT.softSpots) {
    assert.ok(S.soft[spot.type].includes(spot.target), `${spot.type}>${spot.target}`);
    assert.equal(spot.msg, S.softMsg[spot.target]);
  }
  assert.deepEqual(SCOTT.resistMsg, legacy.SCOTT_RESIST_MSG);
  for (const lm of legacy.SCOTT_MOVES) {
    const m = SCOTT.moves.find((x) => x.id === lm.id || x.name === lm.name);
    assert.ok(m, lm.name);
    assert.equal(m.name, lm.name);
    assert.equal(m.type, lm.type);
    assert.equal(m.cost, lm.cost);
    if (!lm.buff) {
      assert.equal(m.power, lm.power);
      assert.equal(m.speed, lm.speed);
    } else {
      assert.deepEqual(plainPool(m.bars), lm.bars);
    }
  }
  const mic = legacy.MIC_DROP;
  assert.equal(SCOTT.micDrop.power, mic.power);
  assert.equal(SCOTT.micDrop.speed, mic.speed);
});

test("Derek's stats, soft spots, messages, moves, and bars", () => {
  const E = legacy.ENEMY;
  assert.equal(derek.name, E.name);
  assert.equal(derek.short, E.short);
  assert.equal(derek.type, E.type);
  assert.equal(derek.maxClout, E.maxClout);
  assert.deepEqual(derek.weak, E.weak);
  assert.deepEqual(derek.resist, E.resist);
  const legacySpots = Object.entries(E.soft).flatMap(([type, targets]) => targets.map((target) => `${type}>${target}`));
  assert.deepEqual(derek.softSpots.map((s) => `${s.type}>${s.target}`).sort(), legacySpots.sort());
  for (const spot of derek.softSpots) assert.equal(spot.msg, E.softMsg[spot.target]);
  assert.deepEqual(derek.resistMsg, E.resistMsg);

  assert.equal(derek.moves.length, E.moves.length);
  for (const lm of E.moves) {
    const m = derek.moves.find((x) => x.id === lm.id);
    assert.ok(m, lm.id);
    assert.equal(m.name, lm.name, lm.id);
    assert.equal(m.type, lm.type, lm.id);
    assert.equal(m.target, lm.target, lm.id);
    assert.equal(m.power, lm.power, lm.id);
    assert.equal(m.weight, lm.weight ?? 0, lm.id);
    assert.deepEqual(plainPool(m.bars), lm.bars, lm.id);
    assert.equal(!!m.applyStatus, !!lm.inflict, lm.id);
  }

  assert.deepEqual(plainBars(derek.scottBars), E.scottBars);
  assert.deepEqual(plainPool(derek.micBars), E.micBars);
});
