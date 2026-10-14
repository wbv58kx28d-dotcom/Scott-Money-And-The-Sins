// Unit tests for $cott's property ladder (systems/realty.js): every session is
// fair, listings behave, and the account math (down payments, loans, fees)
// adds up. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REALTY, CITIES, TIERS } from '../src/data/realty.js';
import { createRng } from '../src/systems/rng.js';
import {
  generateSession, isFair, holderWins, playReader, createAccount, canBuy, buyUnit, sellUnit, saleProceeds,
  downPayment, netWorth, gradeFor, readerMoves, price,
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
