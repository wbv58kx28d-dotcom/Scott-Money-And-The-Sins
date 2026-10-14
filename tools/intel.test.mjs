// Unit tests for scouting intel and the region challenges that reveal it.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import derek from '../src/data/enemies/derek.js';
import { ENEMIES } from '../src/data/enemies/index.js';
import { MAPS } from '../src/data/maps/index.js';
import { TIMING } from '../src/data/rules.js';
import { createBattler, softSpotKey } from '../src/systems/combat.js';
import { emptyIntel, mergeIntel, seedDiscovered, scoutingLine } from '../src/systems/intel.js';

test('mergeIntel keeps each finding once', () => {
  let intel = mergeIntel(emptyIntel(), { enemy: 'derek', weak: ['FLEX'] });
  intel = mergeIntel(intel, { enemy: 'derek', weak: ['FLEX'], softSpots: ['FLEX>WEALTH'] });
  assert.deepEqual(intel, { weak: ['FLEX'], resist: [], softSpots: ['FLEX>WEALTH'] });
});

test('seedDiscovered fills the HUD only with what the villain really has', () => {
  const b = createBattler(derek);
  const added = seedDiscovered(b, { weak: ['FLEX', 'ROAST'], resist: ['ROAST'], softSpots: ['FLEX>WEALTH', 'FLEX>STYLE'] });
  assert.equal(added, 3);
  assert.deepEqual([...b.discovered.weak], ['FLEX']);
  assert.deepEqual([...b.discovered.resist], ['ROAST']);
  assert.deepEqual([...b.discovered.softSpots], ['FLEX>WEALTH']);
  assert.match(scoutingLine(b).text, /weak to FLEX, resists ROAST, 1\/3 soft spots/);
});

test('no intel, no scouting line', () => {
  const b = createBattler(derek);
  assert.equal(seedDiscovered(b, emptyIntel()), 0);
  assert.equal(scoutingLine(b), null);
});

test('every region challenge is well formed and reveals real intel', () => {
  const ratings = TIMING.ratings.map((r) => r.id);
  for (const map of Object.values(MAPS)) {
    for (const npc of map.npcs.filter((n) => n.challenge)) {
      const c = npc.challenge;
      const where = `${map.id}:${npc.id}`;
      assert.ok(['beat', 'quiz'].includes(c.kind), `${where} kind`);
      if (c.kind === 'beat') assert.ok(ratings.includes(c.need ?? 'FIRE'), `${where} need`);
      if (c.kind === 'quiz') {
        assert.ok(c.questions.length > 0, `${where} has questions`);
        for (const q of c.questions) assert.ok(q.answers.length >= 2 && new Set(q.answers).size === q.answers.length, `${where} answers`);
      }
      const enemy = ENEMIES[c.reveal.enemy];
      assert.ok(enemy, `${where} reveals a real enemy`);
      for (const t of c.reveal.weak ?? []) assert.ok(enemy.weak.includes(t), `${where} weak ${t}`);
      for (const t of c.reveal.resist ?? []) assert.ok(enemy.resist.includes(t), `${where} resist ${t}`);
      const soft = new Set(enemy.softSpots.map((s) => softSpotKey(s.type, s.target)));
      for (const k of c.reveal.softSpots ?? []) assert.ok(soft.has(k), `${where} soft spot ${k}`);
    }
  }
});

test("the swamp's locals reveal all of Derek between them", () => {
  const all = MAPS.start.npcs.filter((n) => n.challenge).reduce((intel, n) => mergeIntel(intel, n.challenge.reveal), emptyIntel());
  const b = createBattler(derek);
  seedDiscovered(b, all);
  assert.equal(b.discovered.weak.size, derek.weak.length);
  assert.equal(b.discovered.resist.size, derek.resist.length);
  assert.equal(b.discovered.softSpots.size, derek.softSpots.length);
});
