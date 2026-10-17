// Unit tests for hidden things in regions (systems/secrets.js): Derek's cellar
// under a tarp until the WIFI app traces his router. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { present, secretSpots, signal, heading } from '../src/systems/secrets.js';
import { WIFI } from '../src/data/phone.js';
import { MAPS } from '../src/data/maps/index.js';

test('a secret shows once found, its cover until then, everything else always', () => {
  const found = (id) => id === 'a';
  assert.equal(present({ secret: 'a' }, found), true);
  assert.equal(present({ secret: 'b' }, found), false);
  assert.equal(present({ cover: 'a' }, found), false);
  assert.equal(present({ cover: 'b' }, found), true);
  assert.equal(present({}, found), true);
});

test('signal: more bars closer in, and TRACE only right on top of it', () => {
  let last = 5;
  for (let d = 0; d < 5000; d += 50) {
    const { bars, trace } = signal(d);
    assert.ok(bars <= last, `bars never rise as he walks away (${d})`);
    assert.equal(trace, d <= WIFI.traceRange);
    last = bars;
  }
  assert.equal(signal(0).bars, 4);
  assert.equal(signal(99999).bars, 0);
});

test('heading points the way to walk (north is up the map)', () => {
  const o = { x: 0, y: 0 };
  assert.equal(heading(o, { x: 0, y: -100 }), 'NORTH');
  assert.equal(heading(o, { x: 100, y: 0 }), 'EAST');
  assert.equal(heading(o, { x: -100, y: -100 }), 'NORTHWEST');
  assert.equal(heading(o, { x: 0, y: 100 }), 'SOUTH');
});

test("every map's secrets are tagged in its layout, and every tag is a known secret", () => {
  for (const map of Object.values(MAPS)) {
    const spots = secretSpots(map);
    for (const id of Object.keys(map.secrets)) assert.ok(spots[id], `${map.id}: ${id} has props or exits tagged with it`);
    for (const id of Object.keys(spots)) assert.ok(map.secrets[id], `${map.id}: the layout tags ${id}, which the content doesn't describe`);
    for (const [id, s] of Object.entries(map.secrets)) {
      assert.ok(s.ssid && s.app, `${map.id}: ${id} says how it's found`);
      assert.ok(s.found?.length, `${map.id}: ${id} has lines for when it's found`);
    }
  }
});

test("Derek's basement stays hidden until his Wi-Fi is traced", () => {
  const swamp = MAPS.start;
  const door = swamp.exits.find((e) => e.to === 'start_lair');
  assert.equal(door.secret, 'derek_wifi', 'the cellar door is a secret');
  assert.ok(swamp.props.some((p) => p.cover === 'derek_wifi'), 'something covers it until then');
  assert.ok(swamp.props.some((p) => p.secret === 'derek_wifi' && p.texture === 'prop_cellar'), 'the cellar door shows once found');
  // Upper left of the map, as far from the tower (upper right) as the swamp allows.
  const at = secretSpots(swamp).derek_wifi;
  assert.ok(at.x < swamp.size.w / 3 && at.y < swamp.size.h / 3, `upper left (${at.x}, ${at.y})`);
});
