// Unit tests for the time of day and the weather (systems/sky.js, data/looks.js). Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hourOf, clockLabel, parseTime, lerpColor, phaseAt, skyAt, rollWeather, weatherAt, easeMix, DAY_MINUTES } from '../src/systems/sky.js';
import { LOOKS, DAY } from '../src/data/looks.js';
import { createRng } from '../src/systems/rng.js';

const swamp = LOOKS.swamp;
const brightness = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);

test('the clock: hours wrap round the day, and debug times parse', () => {
  assert.equal(hourOf(0), 0);
  assert.equal(hourOf(18 * 60 + 30), 18.5);
  assert.equal(hourOf(DAY_MINUTES * 3 + 60), 1);
  assert.equal(parseTime('18:30'), 18 * 60 + 30);
  assert.equal(parseTime('7'), 7 * 60);
  assert.equal(parseTime('25:00'), null);
  assert.equal(parseTime('noon'), null);
  assert.equal(parseTime(null), null);
  assert.equal(clockLabel(17 * 60 + 5), '5:05');
  assert.equal(clockLabel(0), '12:00');
  assert.equal(clockLabel(DAY_MINUTES + 12 * 60 + 30), '12:30');
});

test('colors blend channel by channel', () => {
  assert.equal(lerpColor(0x000000, 0xffffff, 0.5), 0x808080);
  assert.equal(lerpColor(0xff0000, 0x0000ff, 0), 0xff0000);
  assert.equal(lerpColor(0xff0000, 0x0000ff, 1), 0x0000ff);
});

test('the swamp\'s day: phases blend, midnight wraps, and day is brighter than night', () => {
  const at = (h) => phaseAt(swamp.phases, h);
  for (const p of swamp.phases) assert.deepEqual(at(p.at).grade, p.grade, `at ${p.at}`);
  assert.ok(brightness(at(12).grade) > brightness(at(18).grade), 'noon brighter than golden hour');
  assert.ok(brightness(at(18).grade) > brightness(at(23).grade), 'golden hour brighter than night');
  assert.ok(at(18.5).sun.alpha > at(12).sun.alpha, 'the sun lights up the evening');
  assert.ok(at(18.5).sun.x < 0.5, 'from the west');
  assert.ok(at(7).sun.x > 0.5, 'and the morning from the east');
  assert.ok(at(23).lights > at(12).lights, 'the neon comes up at night');
  assert.ok(at(23).fireflies > 0.9 && at(12).fireflies === 0, 'fireflies at night only');
  // Between two phases, half way.
  const half = at((4.5 + 6.5) / 2);
  const night = swamp.phases.find((p) => p.at === 4.5);
  const dawn = swamp.phases.find((p) => p.at === 6.5);
  assert.ok(Math.abs(half.shadows - (night.shadows + dawn.shadows) / 2) < 1e-9);
  // Wrapping: just before midnight is the same as just after.
  assert.ok(Math.abs(brightness(at(23.99).grade) - brightness(at(0.01).grade)) < 6);
});

test('a new game starts in golden hour', () => {
  const l = phaseAt(swamp.phases, DAY.startHour);
  assert.ok(l.sun.alpha > 0.2 && l.sun.x < 0.5);
});

test('weather changes the light: fog is white and soft, rain is grey and wet, storms flash', () => {
  const clear = skyAt(swamp, 15, {});
  const fog = skyAt(swamp, 15, { fog: 1 });
  const rain = skyAt(swamp, 15, { rain: 1 });
  const storm = skyAt(swamp, 15, { storm: 1 });
  assert.ok(fog.fog === 1 && fog.haze.alpha > 0.1, 'fog drifts and washes everything');
  const [r, g, b] = [16, 8, 0].map((s) => (fog.haze.color >> s) & 255);
  assert.ok(r > 230 && g > 230 && b > 230 && Math.max(r, g, b) - Math.min(r, g, b) < 12, 'and it\'s white, not green');
  assert.ok(fog.shadows < clear.shadows, 'fog softens shadows');
  assert.ok(rain.rain === 1 && rain.fireflies === 0 && rain.shadows < clear.shadows);
  assert.ok(brightness(rain.grade) < brightness(clear.grade), 'rain is darker');
  assert.ok(storm.lightning === 1 && storm.rain > 1 && brightness(storm.grade) < brightness(rain.grade));
  // Half-faded weather is in between.
  const half = skyAt(swamp, 15, { fog: 0.5 });
  assert.ok(half.haze.alpha > clear.haze.alpha && half.haze.alpha < fog.haze.alpha);
});

test('rooms have one light at every hour, and ignore the weather they never get', () => {
  assert.deepEqual(skyAt(LOOKS.basement, 3).grade, skyAt(LOOKS.basement, 15).grade);
  assert.equal(LOOKS.basement.weather, undefined);
});

test('weather rolls by its odds, lasts a while, then changes', () => {
  const rand = createRng(5).random;
  const counts = {};
  for (let k = 0; k < 4000; k++) {
    const w = rollWeather(swamp.weather.odds, rand);
    counts[w] = (counts[w] ?? 0) + 1;
  }
  const total = Object.values(swamp.weather.odds).reduce((a, b) => a + b, 0);
  for (const [kind, n] of Object.entries(swamp.weather.odds)) {
    assert.ok(Math.abs(counts[kind] / 4000 - n / total) < 0.04, `${kind}: ${counts[kind]}`);
  }
  const spec = swamp.weather;
  const first = weatherAt(null, 1000, spec, rand);
  assert.ok(first.until >= 1000 + spec.hours[0] * 60 && first.until <= 1000 + spec.hours[1] * 60);
  assert.equal(weatherAt(first, first.until - 1, spec, rand), first, 'it lasts');
  const next = weatherAt(first, first.until, spec, rand);
  assert.notEqual(next.kind, first.kind, 'then something else comes in');
  // A clock set far back (a debug time) doesn't strand the weather.
  assert.notEqual(weatherAt(first, 0, spec, rand), first);
});

test('weather fades: each kind eases toward the current one', () => {
  let mix = easeMix({}, 'clear', 1, 1);
  assert.deepEqual(mix, { fog: 0, rain: 0, storm: 0 });
  mix = easeMix(mix, 'fog', 4, 1 / 8);
  assert.equal(mix.fog, 0.5);
  mix = easeMix(mix, 'rain', 2, 1 / 8);
  assert.equal(mix.fog, 0.25);
  assert.equal(mix.rain, 0.25);
  mix = easeMix(mix, 'rain', 100, 1 / 8);
  assert.deepEqual(mix, { fog: 0, rain: 1, storm: 0 });
});
