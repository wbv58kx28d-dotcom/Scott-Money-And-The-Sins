// Unit tests for $cott's day-trading minigame: every market must be fair,
// the account math must add up, and grades must follow the target.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TRADE } from '../src/data/trade.js';
import { MAPS } from '../src/data/maps/index.js';
import { createRng } from '../src/systems/rng.js';
import {
  generateMarket, isFair, shouldHold, hintHold, priceAt, createAccount, buy, sell, gainOf, gradeFor, money, pct,
} from '../src/systems/market.js';

const SEEDS = 300;

/**
 * A trader who reacts `lagMs` late to every turn, but acts on a headline as
 * soon as it's (lag-late) seen. Returns the final gain.
 */
function laggingTrader(market, lagMs, cfg = TRADE) {
  const lag = Math.round(lagMs / cfg.tickMs);
  const { prices, legs } = market;
  const acct = createAccount(cfg.cash);
  for (let t = 0; t < prices.length; t++) {
    const seen = Math.max(0, t - lag);
    const heard = legs.find((l) => l.news && l.announce <= seen && t < l.end);
    const want = heard ? heard.dir > 0 : shouldHold(market, seen);
    (want ? buy : sell)(acct, prices[t], t);
  }
  sell(acct, prices[prices.length - 1], prices.length - 1);
  return gainOf(acct, prices[prices.length - 1]);
}

test('markets are fair: holding loses, trading the swings wins', () => {
  const ticks = (TRADE.seconds * 1000) / TRADE.tickMs;
  for (let seed = 0; seed < SEEDS; seed++) {
    const m = generateMarket(createRng(seed));
    assert.equal(m.prices.length, ticks, `seed ${seed} length`);
    assert.ok(isFair(m), `seed ${seed} fair`);
    const hold = m.prices[m.prices.length - 1] / m.open - 1;
    assert.ok(hold < TRADE.target, `seed ${seed}: diamond hands shouldn't pass (${pct(hold)})`);
    // Reacting 0.7 s late to every turn still clears the goal.
    assert.ok(laggingTrader(m, 700) >= TRADE.target, `seed ${seed}: a 0.7 s-late trader should pass`);
  }
});

test('a slow trader passes most of the time, the top grade takes sharp hands', () => {
  const rate = (lagMs, mult) => {
    let n = 0;
    for (let seed = 0; seed < SEEDS; seed++) if (laggingTrader(generateMarket(createRng(seed)), lagMs) >= TRADE.target * mult) n++;
    return n / SEEDS;
  };
  assert.ok(rate(1000, 1) > 0.6, 'a 1 s-late trader usually passes');
  assert.ok(rate(1000, 4) < 0.05, 'a 1 s-late trader almost never goes to the moon');
  assert.ok(rate(400, 4) > 0.5, 'a sharp trader often goes to the moon');
});

test('the debug hint almost always wins, even followed a second late (the smoke test trades by it)', () => {
  let wins = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const m = generateMarket(createRng(seed));
    const acct = createAccount(TRADE.cash);
    for (let t = 0; t < m.prices.length; t++) {
      const want = hintHold(m, Math.max(0, t - 11)); // read 1.1 s ago
      if (want === true) buy(acct, m.prices[t], t);
      if (want === false) sell(acct, m.prices[t], t);
    }
    sell(acct, m.prices[m.prices.length - 1], 0);
    if (gainOf(acct, 1) >= TRADE.target) wins++;
  }
  assert.ok(wins / SEEDS > 0.97, `won ${wins}/${SEEDS}`); // the smoke test retries a loss
});

test('news legs carry a matching headline, announced before they move', () => {
  for (let seed = 0; seed < 50; seed++) {
    const m = generateMarket(createRng(seed));
    for (const leg of m.legs.filter((l) => l.news)) {
      assert.ok(TRADE.headlines[leg.dir > 0 ? 'up' : 'down'].includes(leg.headline), `seed ${seed} headline`);
      assert.ok(leg.announce < leg.start && leg.announce >= 1, `seed ${seed} announce`);
    }
  }
});

test('the same seed makes the same market', () => {
  assert.deepEqual(generateMarket(createRng(42)).prices, generateMarket(createRng(42)).prices);
});

test('priceAt eases between ticks', () => {
  assert.equal(priceAt([100, 110], 0.5), 105);
  assert.equal(priceAt([100, 110], 5), 110);
});

test('buying goes all in, selling cashes out', () => {
  const a = createAccount(1000);
  buy(a, 50, 3);
  assert.equal(a.shares, 20);
  assert.equal(a.cash, 0);
  buy(a, 10, 4); // already in: nothing happens
  assert.equal(a.shares, 20);
  sell(a, 60, 9);
  assert.equal(a.cash, 1200);
  assert.ok(Math.abs(gainOf(a, 1) - 0.2) < 1e-9);
  assert.deepEqual(a.trades, [{ buyTick: 3, buyPrice: 50, sellTick: 9, sellPrice: 60 }]);
});

test('grades follow the target', () => {
  assert.equal(gradeFor(-0.1, 0.25).id, 'fail');
  assert.equal(gradeFor(0.249, 0.25).id, 'fail');
  assert.equal(gradeFor(0.25, 0.25).id, 'pass');
  assert.equal(gradeFor(0.5, 0.25).id, 'great');
  assert.equal(gradeFor(1.0, 0.25).id, 'legendary');
});

test('money and percent formatting', () => {
  assert.equal(money(1043.4), '$1,043');
  assert.equal(money(98.999, true), '$99.00');
  assert.equal(money(-12.5, true), '-$12.50');
  assert.equal(pct(0.0434), '+4.3%');
  assert.equal(pct(-0.2), '-20.0%');
});

test('trade challenges only override known settings', () => {
  for (const map of Object.values(MAPS)) {
    for (const npc of map.npcs.filter((n) => n.challenge?.kind === 'trade')) {
      const c = npc.challenge;
      assert.ok(c.target === undefined || (c.target > 0 && c.target < 2), `${map.id}:${npc.id} target`);
      assert.ok(c.ticker === undefined || /^\$[A-Z]{2,6}$/.test(c.ticker), `${map.id}:${npc.id} ticker`);
    }
  }
});
