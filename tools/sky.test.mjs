// Unit tests for the time of day and the weather (systems/sky.js, data/looks.js). Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  hourOf, clockLabel, parseTime, lerpColor, phaseAt, skyAt, rollWeather, weatherAt, easeMix, clockAtHour, pinWeather, shiftWeather, DAY_MINUTES,
  sunShadow, lightShadow,
} from '../src/systems/sky.js';
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

test("SETTINGS' sliders: the clock moves within its day, and picked weather holds until it runs out", () => {
  const spec = swamp.weather;
  const clock = DAY_MINUTES * 2 + 17 * 60 + 20; // day 3, 5:20 PM
  assert.equal(clockAtHour(clock, 6.25), DAY_MINUTES * 2 + 6 * 60 + 15, 'same day, earlier');
  assert.equal(clockAtHour(clock, 23.75), DAY_MINUTES * 2 + 23 * 60 + 45, 'same day, later');
  const rand = createRng(3).random;
  const fog = pinWeather('fog', clock, spec);
  assert.equal(weatherAt(fog, clock, spec, rand), fog, 'the picked weather is in now');
  assert.equal(weatherAt(fog, fog.until - 1, spec, rand), fog, 'and lasts as long as weather can');
  assert.notEqual(weatherAt(fog, fog.until, spec, rand).kind, 'fog', 'then rolls on');
  // Moving the clock back keeps the weather, with the same time left.
  const back = clockAtHour(clock, 6);
  const moved = shiftWeather(fog, back - clock);
  assert.equal(weatherAt(moved, back, spec, rand), moved);
  assert.equal(moved.until - back, fog.until - clock);
  assert.equal(shiftWeather(null, 60), null, 'no weather yet stays none');
});

test("the sun's shadows turn with the day: west in the morning, short at noon, long and east at golden hour, none at night", () => {
  const path = swamp.sunPath;
  const at = (h) => sunShadow(path, h);
  const len = (k) => Math.hypot(k.x, k.y / 0.6);
  assert.equal(at(3).alpha, 0, 'night');
  assert.equal(at(path.rise).alpha, 0);
  assert.equal(at(path.set + 0.5).alpha, 0);
  assert.equal(sunShadow(undefined, 12).alpha, 0, 'rooms have no sun');
  assert.ok(at(8).x < 0, 'morning: west');
  assert.ok(at(17.5).x > 0, 'golden hour: east');
  const noon = at((path.rise + path.set) / 2);
  assert.ok(Math.abs(noon.x) < 1e-9 && noon.y > 0, 'midday: straight toward the camera');
  assert.ok(len(at(17.5)) > len(noon) * 2.5, 'long at golden hour');
  assert.ok(len(at(6.1)) <= 2.2 + 1e-9, 'never longer than the cap, even at sunrise');
  assert.ok(at(6.05).alpha < at(9).alpha && at(9).alpha === 1, 'fades in as the sun clears the horizon');
  for (let h = path.rise + 0.25; h < path.set; h += 0.25) assert.ok(at(h).y >= 0, `never toward the sun in the north (${h})`);
});

test('a light casts shadows away from it, longer and fainter the farther from it', () => {
  const torch = { x: 100, y: 100, h: 80, reach: 200, strength: 1 };
  const east = lightShadow(torch, 160, 100);
  assert.ok(east.x > 0 && Math.abs(east.y) < 1e-9, 'east of the torch: points east');
  const south = lightShadow(torch, 100, 160);
  assert.ok(south.y > 0 && Math.abs(south.x) < 1e-9, 'south of it: points south (down the screen)');
  const far = lightShadow(torch, 260, 100);
  assert.ok(Math.hypot(far.x, far.y) > Math.hypot(east.x, east.y), 'longer farther away');
  assert.ok(far.alpha < east.alpha, 'and fainter');
  assert.equal(lightShadow(torch, 400, 100).alpha, 0, 'none past its reach');
  assert.equal(lightShadow(torch, 100, 100).alpha, 0, 'none right under it');
  assert.ok(lightShadow({ ...torch, strength: 0.5 }, 160, 100).alpha < east.alpha, 'a dimmer light, a fainter shadow');
  // The ground's up-and-down is foreshortened: 60 px down the screen is farther than 60 px across.
  assert.ok(lightShadow(torch, 100, 160).alpha < lightShadow(torch, 160, 100).alpha);
});
