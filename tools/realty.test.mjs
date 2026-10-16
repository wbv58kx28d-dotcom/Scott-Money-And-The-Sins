// Unit tests for $cott's property ladder (systems/realty.js): every session is
// fair, listings behave, and the account math (down payments, loans, fees)
// adds up. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REALTY, CITIES, TIERS } from '../src/data/realty.js';
import { createRng } from '../src/systems/rng.js';
import {
  generateSession, isFair, holderWins, playReader, createAccount, canBuy, buyUnit, sellUnit, saleProceeds,
  downPayment, netWorth, gradeFor, readerMoves, price, mapLots, lotState, settle, standingAt, variantAt, trendAt, inTicks,
} from '../src/systems/realty.js';

// The config in ticks, as sessions use it (prices move REALTY.perMonth times a month).
const TICKED = inTicks(REALTY);

test('every city deals fair sessions: the news reader wins, buy-and-hold never does', () => {
  for (const city of CITIES) {
    const rng = createRng(11);
    for (let i = 0; i < 60; i++) {
      const s = generateSession(rng, city);
      assert.ok(isFair(s), `${city.id} #${i} is fair`);
      const won = playReader(s);
      assert.ok(won !== null && won <= s.months * REALTY.fair.readerBy, `${city.id} #${i}: reader won at ${won}`);
      assert.ok(playReader(s, REALTY, { delay: TICKED.fair.lateDelay }) !== null, `${city.id} #${i}: a slower reader still wins`);
      assert.equal(holderWins(s), false);
    }
  }
});

test('a session has every tier, a cash-only trophy on top, and a starter home $cott can afford', () => {
  const city = CITIES[0];
  const s = generateSession(createRng(5), city);
  for (const tier of TIERS) assert.ok(s.units.some((u) => u.tier === tier), tier);
  assert.equal(s.units[s.trophy].trophy, true);
  const opening = s.prices.map((p) => p[0]);
  assert.equal(Math.max(...opening), opening[s.trophy], 'the trophy is the priciest unit');
  assert.ok(Math.min(...opening) <= s.startCash, 'he can buy the cheapest home outright');
  assert.equal(s.months, REALTY.months * REALTY.perMonth, 'the session runs in ticks');
  assert.equal(s.prices[0].length, s.months + 1);
});

test('listings: the trophy is always up, and every tier always has something listed', () => {
  const s = generateSession(createRng(6), CITIES[1]);
  for (let m = 0; m <= s.months; m++) {
    assert.equal(s.listed[s.trophy][m], true);
    for (const tier of TIERS) assert.ok(s.units.some((u) => u.tier === tier && !u.trophy && s.listed[u.id][m]), `${tier} at ${m}`);
  }
});

test('the bank: 50% down on anything but the trophy, and a sale pays back the loan less the fee', () => {
  const s = generateSession(createRng(7), CITIES[2]);
  const acct = createAccount(1_000_000);
  const m = 0;
  const u = s.units.find((x) => !x.trophy && s.listed[x.id][m]).id;
  const p = s.prices[u][m];
  assert.equal(downPayment(s, u, m), Math.round(p * REALTY.down));
  assert.equal(downPayment(s, s.trophy, m), s.prices[s.trophy][m], 'the trophy is cash only');
  assert.ok(buyUnit(acct, s, u, m));
  assert.equal(acct.cash, 1_000_000 - downPayment(s, u, m));
  assert.equal(canBuy(acct, s, u, m), false, "can't buy what he owns");
  assert.equal(netWorth(acct, s, m), 1_000_000);
  const later = 10;
  const expected = Math.round(s.prices[u][later] * (1 - REALTY.fee) - (p - downPayment(s, u, m)));
  assert.equal(saleProceeds(acct, s, u, later), expected);
  assert.equal(sellUnit(acct, s, u, later), expected);
  assert.equal(acct.owned.size, 0);
  assert.equal(sellUnit(acct, s, u, later), 0, 'nothing to sell twice');
});

test("can't buy an unlisted unit or one he can't afford the down payment on", () => {
  const s = generateSession(createRng(8), CITIES[0]);
  const unlisted = s.units.find((u) => !s.listed[u.id][0]);
  if (unlisted) assert.equal(canBuy(createAccount(10_000_000), s, unlisted.id, 0), false);
  assert.equal(canBuy(createAccount(1000), s, s.trophy, 0), false);
});

test('grades go by how early the trophy was bought', () => {
  const months = 48;
  const g = (won) => gradeFor({ won }, months).id;
  assert.equal(g(null), 'fail');
  assert.equal(g(20), 'legendary');
  assert.equal(g(30), 'great');
  assert.equal(g(48), 'pass');
});

test('the hint never suggests something illegal', () => {
  const s = generateSession(createRng(9), CITIES[1]);
  const acct = createAccount(s.startCash);
  for (let m = 0; m <= s.months && acct.won === null; m++) {
    for (const mv of readerMoves(s, acct, m)) {
      if (mv.type === 'buy') assert.ok(buyUnit(acct, s, mv.unit, m), `buy ${mv.unit} at ${m}`);
      else assert.ok(sellUnit(acct, s, mv.unit, m) !== 0 || acct.owned.has(mv.unit) === false, `sell ${mv.unit} at ${m}`);
    }
    assert.ok(acct.cash >= 0);
  }
});

test('headlines move tiers both ways, and prices read like listings', () => {
  for (const city of CITIES) {
    const all = [...city.headlines, ...REALTY.headlines];
    for (const h of all) assert.equal(h.fx.length, 3, h.text);
    TIERS.forEach((tier, ti) => {
      assert.ok(all.some((h) => h.fx[ti] > 0) && all.some((h) => h.fx[ti] < 0), `${city.id} ${tier} news goes both ways`);
    });
    assert.ok(city.tiers.high.trophy, `${city.id} names its trophy`);
  }
  assert.equal(price(95_000), '$95K');
  assert.equal(price(1_250_000), '$1.25M');
  assert.equal(price(2_000_000), '$2M');
});

test('the map: a 7×7 grid minus a road cross, zoned by block, the trophy on the back corner', () => {
  const lots = mapLots();
  assert.equal(lots.length, 36);
  const count = (z) => lots.filter((l) => l.zone === z).length;
  assert.deepEqual([count('low'), count('mid'), count('high')], [9, 18, 9]);
  const s = generateSession(createRng(12), CITIES[0]);
  const t = s.units[s.trophy];
  assert.deepEqual([s.lots[t.lot].i, s.lots[t.lot].j], [0, 0]);
  for (const u of s.units) assert.equal(s.lots[u.lot].zone, u.tier, `${u.name} stands in its zone`);
  assert.equal(new Set(s.units.map((u) => u.name)).size, s.units.length, 'names are unique');
});

test('development: one building per lot at a time; cranes, wrecking balls, and glow-ups behave', () => {
  for (const city of CITIES) {
    const rng = createRng(13);
    for (let n = 0; n < 20; n++) {
      const s = generateSession(rng, city);
      for (let m = 0; m <= s.months; m++) {
        s.lots.forEach((_, lot) => {
          const here = s.units.filter((u) => u.lot === lot && standingAt(s, u.id, m));
          assert.ok(here.length <= 1, `${city.id}: lot ${lot} holds ${here.length} units at month ${m}`);
          const st = lotState(s, lot, m);
          if (st.site) assert.equal(here.length, 0, 'a crane only stands on an empty lot');
        });
      }
      for (const e of s.dev) {
        const u = s.units[e.unit];
        assert.ok(!u.trophy, 'the trophy is never touched');
        if (e.type === 'build') {
          assert.equal(u.born, e.at);
          assert.ok(s.listed[u.id][e.at], 'a new build opens listed');
          assert.equal(s.prices[u.id][e.at - 1], null, "it isn't standing before it opens");
        }
        if (e.type === 'demolish') {
          assert.equal(u.gone, e.at);
          assert.equal(s.prices[u.id][e.at], null);
          for (let m = e.announce; m < e.at; m++) assert.equal(s.listed[u.id][m], false, 'booked for the wrecking ball: off the market');
        }
        if (e.type === 'renovate') {
          assert.ok(u.renos.some((r) => r.month === e.at));
          assert.ok(variantAt(u, e.at) !== variantAt(u, e.at - 1) || (city.art?.[u.tier]?.length ?? 3) === 1, 'it gets a new look');
        }
      }
      assert.ok(s.dev.length >= 8, `${city.id}: plenty of development (${s.dev.length})`);
    }
  }
});

test("a wrecking ball on $cott's unit buys him out at last month's price, no fee", () => {
  const rng = createRng(14);
  let s;
  let e;
  for (let n = 0; n < 50 && !e; n++) {
    s = generateSession(rng, CITIES[0]);
    e = s.dev.find((d) => d.type === 'demolish');
  }
  assert.ok(e, 'found a demolition');
  const m = e.announce - 1;
  const acct = createAccount(10_000_000);
  // Force a purchase the month before it's booked (it may not be listed then).
  s.listed[e.unit][m] = true;
  assert.ok(buyUnit(acct, s, e.unit, m));
  const { loan } = acct.owned.get(e.unit);
  const before = acct.cash;
  assert.deepEqual(settle(acct, s, e.at - 1), [], 'nothing happens before the wrecking ball');
  const out = settle(acct, s, e.at);
  assert.equal(out.length, 1);
  assert.equal(acct.cash, before + Math.round(s.prices[e.unit][e.at - 1] - loan));
  assert.equal(acct.owned.size, 0);
});

test('trends: each leg moves its tier the way its chip says, the chip flips a month early, headlines match', () => {
  for (const city of CITIES) {
    const pool = new Map([...city.headlines, ...REALTY.headlines].map((h) => [h.text, h.fx]));
    const rng = createRng(15);
    for (let n = 0; n < 15; n++) {
      const s = generateSession(rng, city);
      for (const e of s.events) {
        const ti = e.tier;
        const move = Math.log(1 + e.fx[ti]);
        // The chip shows this leg from `lead` months before it starts.
        const lead = TICKED.trend.lead;
        if (e.start >= lead) assert.equal(trendAt(s, ti, e.start - lead).leg, e, `${city.id}: chip flips early`);
        if (e.headline) assert.equal(Math.sign(pool.get(e.headline)[ti]), Math.sign(move), `${e.headline} points the leg's way`);
        if (Math.abs(move) < 0.15 || e.end - e.start < 2) continue;
        // Prices of the tier's units (standing through it, no glow-ups) move the leg's way.
        const ids = s.units.filter((u) => TIERS.indexOf(u.tier) === ti && standingAt(s, u.id, e.start) && standingAt(s, u.id, e.end)
          && !u.renos.some((r) => r.month > e.start && r.month <= e.end)).map((u) => u.id);
        if (!ids.length) continue;
        const avg = ids.reduce((sum, u) => sum + Math.log(s.prices[u][e.end] / s.prices[u][e.start]), 0) / ids.length;
        assert.equal(Math.sign(avg), Math.sign(move), `${city.id} tier ${ti} leg ${e.start}-${e.end}: moved ${avg.toFixed(2)}, chip said ${move.toFixed(2)}`);
      }
      // Every tier has a chip reading every month.
      for (let m = 0; m < s.months; m++) TIERS.forEach((_, ti) => assert.ok(trendAt(s, ti, m).leg, `tier ${ti} month ${m}`));
    }
  }
});

test('prices move every tick, and a trend shows from its first tick (front-loaded)', () => {
  assert.equal(TICKED.trend.lead, 1, 'the chip flips one tick (half a month) ahead');
  const rng = createRng(16);
  let checked = 0;
  for (let n = 0; n < 10; n++) {
    const s = generateSession(rng, CITIES[n % 3]);
    for (const e of s.events) {
      const ti = e.tier;
      const move = Math.log(1 + e.fx[ti]);
      if (Math.abs(move) < 0.2 || e.end - e.start < 4) continue;
      const ids = s.units.filter((u) => TIERS.indexOf(u.tier) === ti && standingAt(s, u.id, e.start) && standingAt(s, u.id, e.end)
        && !u.renos.some((r) => r.month > e.start && r.month <= e.end)).map((u) => u.id);
      if (ids.length < 2) continue;
      const avg = (a, b) => ids.reduce((sum, u) => sum + Math.log(s.prices[u][b] / s.prices[u][a]), 0) / ids.length;
      const first = avg(e.start, e.start + 1);
      // The first tick of a leg moves the way the chip said, and carries more of it than the last.
      assert.equal(Math.sign(first), Math.sign(move), `first tick of a ${move.toFixed(2)} leg moved ${first.toFixed(3)}`);
      assert.ok(Math.abs(first) > Math.abs(avg(e.end - 1, e.end)), 'front-loaded');
      checked += 1;
    }
  }
  assert.ok(checked > 20, `checked ${checked} legs`);
});
