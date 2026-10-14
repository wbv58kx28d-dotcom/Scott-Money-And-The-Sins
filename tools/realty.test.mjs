// Unit tests for $cott's property ladder (systems/realty.js): every session is
// fair, listings behave, and the account math (down payments, loans, fees)
// adds up. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REALTY, CITIES, TIERS } from '../src/data/realty.js';
import { createRng } from '../src/systems/rng.js';
import {
  generateSession, isFair, holderWins, playReader, createAccount, canBuy, buyUnit, sellUnit, saleProceeds,
  downPayment, netWorth, gradeFor, readerMoves, price, mapLots, lotState, settle, standingAt, variantAt,
} from '../src/systems/realty.js';

test('every city deals fair sessions: the news reader wins, buy-and-hold never does', () => {
  for (const city of CITIES) {
    const rng = createRng(11);
    for (let i = 0; i < 60; i++) {
      const s = generateSession(rng, city);
      assert.ok(isFair(s), `${city.id} #${i} is fair`);
      const won = playReader(s);
      assert.ok(won !== null && won <= REALTY.months * REALTY.fair.readerBy, `${city.id} #${i}: reader won at ${won}`);
      assert.ok(playReader(s, REALTY, { delay: REALTY.fair.lateDelay }) !== null, `${city.id} #${i}: a slower reader still wins`);
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
  assert.equal(s.prices[0].length, REALTY.months + 1);
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
