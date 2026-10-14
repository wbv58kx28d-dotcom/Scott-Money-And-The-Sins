// Unit tests for $cott's phone: the Stonks market, the save's money rules, and
// that the phone's data hangs together. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PHONES, APPS, SHOP, STOCKS, ECONOMY } from '../src/data/phone.js';
import { ITEMS } from '../src/data/items.js';
import SCOTT from '../src/data/scott.js';
import { createRng } from '../src/systems/rng.js';
import { createMarket, payout, changeLabel, money } from '../src/systems/stonks.js';
import { Save } from '../src/systems/save.js';

test('a market starts at 1.0, records every tick, and never goes below a cent', () => {
  const m = createMarket(STOCKS[2], createRng(1));
  assert.equal(m.price, 1);
  for (let i = 0; i < 500; i++) m.tick();
  assert.ok(m.history.length > 1 && m.history.every((p) => p >= 0.01));
});

test('the safe ticker never rugs; a rugged market stays down', () => {
  const safe = createMarket(STOCKS.find((s) => s.rug === 0), createRng(2));
  for (let i = 0; i < 2000; i++) safe.tick();
  assert.equal(safe.rugged, false);
  const degen = createMarket({ id: 'X', vol: 0, drift: 0, rug: 1, rugDrop: 0.8 }, createRng(3));
  degen.tick();
  assert.equal(degen.rugged, true);
  assert.ok(Math.abs(degen.price - 0.2) < 1e-9);
  const after = degen.price;
  degen.tick();
  assert.equal(degen.price, after);
});

test('the market drifts up on average, so trading is worth a shot', () => {
  const rng = createRng(4);
  let total = 0;
  const runs = 400;
  for (let r = 0; r < runs; r++) {
    const m = createMarket(STOCKS[0], rng);
    for (let i = 0; i < 40; i++) m.tick();
    total += m.price;
  }
  assert.ok(total / runs > 1, `average ${total / runs}`);
});

test('payout and labels', () => {
  assert.equal(payout(250, 1.08), 270);
  assert.equal(payout(100, 0), 0);
  assert.equal(changeLabel(1.084), '+8.4%');
  assert.equal(changeLabel(0.97), '-3.0%');
  assert.equal(money(2500), '$2,500');
});

test('the save tracks cash, the stash, trades, and the phone', () => {
  Save.reset();
  assert.equal(Save.cash, ECONOMY.startCash);
  assert.equal(Save.phone, 'flip');
  assert.equal(Save.trades, ECONOMY.tradesPerFight);
  assert.equal(Save.spend(Save.cash + 1), false, "can't overspend");
  assert.equal(Save.spend(100), true);
  Save.earn(250);
  assert.equal(Save.cash, ECONOMY.startCash + 150);
  Save.addStash('coldBrew', 2);
  assert.equal(Save.useStash('coldBrew'), true);
  assert.equal(Save.stash('coldBrew'), 1);
  assert.equal(Save.useStash('voicemail'), false);
  for (let i = 0; i < ECONOMY.tradesPerFight; i++) assert.equal(Save.useTrade(), true);
  assert.equal(Save.useTrade(), false, 'the market closes when trades run out');
  Save.refillTrades();
  assert.equal(Save.trades, ECONOMY.tradesPerFight);
  Save.setPhone('smart');
  assert.equal(Save.phone, 'smart');
  Save.setPhone('rotary');
  assert.equal(Save.phone, 'smart', 'unknown models are ignored');
  Save.reset();
  assert.equal(Save.phone, 'flip');
});

test('phone data hangs together', () => {
  assert.ok(PHONES.flip && PHONES.smart);
  assert.deepEqual(APPS.map((a) => a.id).sort(), ['map', 'settings', 'shop', 'stonks']);
  for (const entry of SHOP) {
    if (entry.kind === 'item') {
      assert.ok(ITEMS[entry.id], `${entry.id} is a real item`);
      assert.ok(SCOTT.items.includes(entry.id), `${entry.id} is one $cott can use in battle`);
    } else {
      assert.equal(entry.kind, 'phone');
      assert.ok(PHONES[entry.phone], `${entry.id} upgrades to a real phone`);
    }
    assert.ok(entry.price > 0);
  }
  assert.ok(ECONOMY.stakes.every((s, i) => i === 0 || s > ECONOMY.stakes[i - 1]), 'stakes ascend');
  assert.ok(ECONOMY.startCash >= ECONOMY.stakes[0], 'a new player can afford a first trade');
});
