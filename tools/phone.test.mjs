// Unit tests for $cott's phone: the save's money rules, and that the phone's
// data hangs together. (Stonks plays the day trade; its market is tested in
// market.test.mjs.) Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PHONES, APPS, SHOP, ECONOMY } from '../src/data/phone.js';
import { ITEMS } from '../src/data/items.js';
import SCOTT from '../src/data/scott.js';
import { Save } from '../src/systems/save.js';

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
  assert.deepEqual(APPS.map((a) => a.id).sort(), ['map', 'realty', 'settings', 'shop', 'stonks']);
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
  assert.ok(ECONOMY.tickers.length > 0 && ECONOMY.tickers.every((t) => /^\$[A-Z0-9]+$/.test(t)), 'tickers look like $TICKERS');
});

test('the title only offers CONTINUE when there is progress to continue', () => {
  Save.reset();
  assert.equal(Save.hasProgress, false, 'a fresh save has nothing to continue');
  Save.earn(100);
  assert.equal(Save.hasProgress, true, 'cash earned counts');
  Save.reset();
  Save.winChallenge('start:brad', null);
  assert.equal(Save.hasProgress, true, 'a won challenge counts');
  Save.reset();
  Save.useTrade();
  assert.equal(Save.hasProgress, true, 'a trade made counts');
  Save.reset();
  assert.equal(Save.hasProgress, false);
});
