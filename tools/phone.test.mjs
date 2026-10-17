// Unit tests for $cott's phone: the save's money rules, and that the phone's
// data hangs together. (Stonks plays the day trade; its market is tested in
// market.test.mjs.) Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PHONES, APPS, SHOP, ECONOMY, WIFI } from '../src/data/phone.js';
import { MAPS } from '../src/data/maps/index.js';
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
  Save.refillAfterFight();
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
  assert.deepEqual(APPS.map((a) => a.id).sort(), ['map', 'realty', 'settings', 'shop', 'social', 'stonks', 'wifi']);
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

test('every gifted app is given by someone, and Wi-Fi names fit the flip phone\'s font', () => {
  const given = new Set(Object.values(MAPS).flatMap((m) => m.npcs.flatMap((n) => [...(n.gift?.apps ?? []), ...(n.challenge?.gift?.apps ?? [])])));
  for (const app of APPS.filter((a) => a.gift)) assert.ok(given.has(app.id), `someone gives ${app.id}`);
  for (const id of given) assert.ok(APPS.some((a) => a.id === id && a.gift), `${id} is a gifted app`);
  const names = [...WIFI.decoys, ...Object.values(MAPS).flatMap((m) => Object.values(m.secrets).map((s) => s.ssid))];
  for (const n of names) assert.match(n, /^[A-Z0-9 -]+$/, `${n}: letters, digits, spaces, hyphens`);
});

test('gifted apps and found secrets save, and clearing a region finds its secrets', () => {
  Save.reset();
  assert.equal(Save.hasApp('wifi'), false);
  assert.equal(Save.addApp('wifi'), true);
  assert.equal(Save.addApp('wifi'), false, 'only once');
  assert.equal(Save.isFound('start:derek_wifi'), false);
  assert.equal(Save.find('start:derek_wifi'), true);
  assert.equal(Save.isFound('start:derek_wifi'), true);
  assert.equal(Save.hasProgress, true);
  Save.reset();
  Save.clearRegion('start');
  assert.equal(Save.isFound('start:derek_wifi'), true, 'a cleared region has nothing left to hide');
  Save.reset();
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
