// The time of day and the weather over a region (CLAUDE.md §6.6), as numbers:
// what the light looks like at a given hour under a given mix of weather.
// Pure logic, no Phaser: ui/atmosphere.js draws it, the Region scene runs
// the clock, and tools/sky.test.mjs checks it. Looks are in data/looks.js.
//
// A look is either one fixed light (rooms) or `phases`, lights at hours of the
// day, blended in between (the swamp). Weather (`fog`, `rain`, `storm`)
// is mixed in on top, each 0..1, so one can fade out while another fades in.

export const DAY_MINUTES = 24 * 60;

// The light, and what each part of it is when a look doesn't say.
const LIGHT = {
  grade: 0xffffff, // the world is multiplied by this
  sun: { color: 0xffffff, alpha: 0, x: 0.5 }, // a low sun's warm light from the screen's top edge; x 0 west, 1 east
  haze: { color: 0xffffff, alpha: 0 }, // a flat wash over the world
  vignette: 0, // how dark the screen's edges get
  shadows: 0.3,
  lights: 0.3, // props' glows
  fireflies: 0,
  spores: 0,
  mist: 0, // mist banks over the water
  fog: 0, // fog drifting over everything
  rain: 0,
  lightning: 0,
  wind: 0.35, // how far trees and reeds lean as they sway (0..1, ui/motion.js)
  sky: { top: 0x5aa0e0, bottom: 0xd8ecf0 }, // the sky past a drop (ui/vista.js)
};
const COLORS = new Set(['grade', 'color', 'top', 'bottom']);

/** The hour (0..24) at a clock reading in game minutes. */
export function hourOf(clock) {
  return (((clock % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES) / 60;
}

/** The time on $cott's phone, 12-hour like a phone's status bar: "5:42". */
export function clockLabel(clock) {
  const minutes = Math.floor(hourOf(clock) * 60);
  const h = Math.floor(minutes / 60) % 12 || 12;
  return `${h}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "18:30" → game minutes into the day, or null. */
export function parseTime(str) {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(str ?? '');
  if (!m || Number(m[1]) > 23 || Number(m[2] ?? 0) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2] ?? 0);
}

/** The clock moved to `hour` (0..24) on the same day: what SETTINGS' time slider does. */
export function clockAtHour(clock, hour) {
  return Math.floor(clock / DAY_MINUTES) * DAY_MINUTES + Math.round(hour * 60);
}

export function lerpColor(a, b, t) {
  const ch = (c, s) => (c >> s) & 255;
  const mix = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

/** Blend two lights (or parts of one): numbers and colors part way from a to b. */
export function blend(a, b, t, key = null) {
  if (typeof a === 'number') return COLORS.has(key) ? lerpColor(a, b, t) : a + (b - a) * t;
  const out = {};
  for (const k of Object.keys(a)) out[k] = blend(a[k], b[k], t, k);
  return out;
}

/** A look's light with every part filled in. */
function full(light) {
  const out = {};
  for (const [k, v] of Object.entries(LIGHT)) {
    out[k] = typeof v === 'object' ? { ...v, ...light[k] } : light[k] ?? v;
  }
  return out;
}

/** The light at an hour: between the phases either side of it, wrapping round midnight. */
export function phaseAt(phases, hour) {
  const sorted = [...phases].sort((a, b) => a.at - b.at);
  let i = sorted.findIndex((p) => p.at > hour);
  if (i === -1) i = sorted.length;
  const next = sorted[i % sorted.length];
  const prev = sorted[(i - 1 + sorted.length) % sorted.length];
  const span = ((next.at - prev.at + 24) % 24) || 24;
  const t = ((hour - prev.at + 24) % 24) / span;
  return blend(full(prev), full(next), Math.min(1, Math.max(0, t)));
}

// What each kind of weather does to the light, at full strength.
const WEATHER = {
  // White fog: a pale wash, fog drifting over everything, soft shadows, the sun lost in it.
  fog: (l, m) => ({
    ...l,
    grade: lerpColor(l.grade, 0xe6e8ee, 0.35 * m),
    haze: { color: lerpColor(l.haze.color, 0xf2f4f8, m), alpha: l.haze.alpha + (0.14 - l.haze.alpha) * m },
    sun: { ...l.sun, alpha: l.sun.alpha * (1 - 0.75 * m) },
    shadows: l.shadows * (1 - 0.6 * m),
    lights: l.lights * (1 - 0.2 * m),
    fireflies: l.fireflies * (1 - 0.5 * m),
    spores: Math.max(l.spores, 0.6 * m),
    mist: l.mist + (0.3 - l.mist) * m,
    fog: Math.max(l.fog, m),
    wind: l.wind * (1 - 0.7 * m), // fog lies on still air
    sky: { top: lerpColor(l.sky.top, 0xc8ccd8, 0.7 * m), bottom: lerpColor(l.sky.bottom, 0xe8eaf0, 0.8 * m) },
  }),
  // Rain: grey-blue and flat, streaks falling, no fireflies.
  rain: (l, m) => ({
    ...l,
    grade: lerpColor(l.grade, 0x9ca6bc, 0.55 * m),
    haze: { color: lerpColor(l.haze.color, 0xb8c0d0, m), alpha: l.haze.alpha + (0.08 - l.haze.alpha) * m },
    sun: { ...l.sun, alpha: l.sun.alpha * (1 - 0.9 * m) },
    shadows: l.shadows * (1 - 0.7 * m),
    fireflies: l.fireflies * (1 - m),
    rain: Math.max(l.rain, m),
    wind: l.wind + (0.7 - l.wind) * m,
    sky: { top: lerpColor(l.sky.top, 0x5a6074, 0.75 * m), bottom: lerpColor(l.sky.bottom, 0x8a90a0, 0.75 * m) },
  }),
};
WEATHER.storm = (l, m) => {
  const wet = WEATHER.rain(l, m);
  return {
    ...wet, grade: lerpColor(wet.grade, 0x7c84a0, 0.3 * m), rain: Math.max(wet.rain, m * 1.4), lightning: Math.max(wet.lightning, m),
    wind: wet.wind + (1 - wet.wind) * m,
  };
};
export const WEATHER_KINDS = ['clear', ...Object.keys(WEATHER)];

/**
 * A look's light at an hour under a mix of weather ({ fog: 0..1, rain: 0..1, storm: 0..1 }).
 * A look without `phases` is the same at every hour.
 */
export function skyAt(look, hour, mix = {}) {
  let light = look.phases ? phaseAt(look.phases, hour) : full(look);
  for (const [kind, m] of Object.entries(mix)) if (m > 0 && WEATHER[kind]) light = WEATHER[kind](light, m);
  return light;
}

/** Pick a weather by its odds ({ clear: 6, fog: 3, ... }). */
export function rollWeather(odds, rand) {
  const kinds = Object.entries(odds).filter(([, n]) => n > 0);
  let r = rand() * kinds.reduce((sum, [, n]) => sum + n, 0);
  for (const [kind, n] of kinds) {
    r -= n;
    if (r < 0) return kind;
  }
  return kinds.at(-1)?.[0] ?? 'clear';
}

/**
 * The weather at a clock reading: `state` ({ kind, until }) while it lasts,
 * then a new roll lasting `spec.hours` ([min, max] game hours). Never rolls
 * the same kind twice running unless it's the only one.
 */
export function weatherAt(state, clock, spec, rand) {
  if (state && clock < state.until && clock >= state.until - spec.hours[1] * 60) return state;
  const odds = { ...spec.odds };
  if (state && Object.keys(odds).filter((k) => odds[k] > 0).length > 1) delete odds[state.kind];
  const hours = spec.hours[0] + rand() * (spec.hours[1] - spec.hours[0]);
  return { kind: rollWeather(odds, rand), until: Math.round(clock + hours * 60) };
}

/** Weather picked by hand (SETTINGS' slider): `kind` from now, for as long as any weather lasts. */
export function pinWeather(kind, clock, spec) {
  return { kind, until: Math.round(clock + spec.hours[1] * 60) };
}

/** The weather after the clock is moved by `by` minutes: the same kind, for the same time left. */
export function shiftWeather(state, by) {
  return state && { ...state, until: state.until + by };
}

/** Ease each weather's share toward the current kind's: 1 for it, 0 for the rest, `rate` per second. */
export function easeMix(mix, kind, dt, rate) {
  const out = {};
  for (const k of WEATHER_KINDS.slice(1)) {
    const target = k === kind ? 1 : 0;
    const now = mix[k] ?? 0;
    const step = rate * dt;
    out[k] = now < target ? Math.min(target, now + step) : Math.max(target, now - step);
  }
  return out;
}

// ---- Shadows that point -------------------------------------------------------------
// A cast shadow is an offset per pixel of height: a point h px up lands h × (x, y)
// px from the feet on the ground. The ground's up-and-down is foreshortened in the
// 3/4 view, so the y part is squashed.
// The sun's are kept short (`sun`: a low sun's would run off the screen) and so are a
// light's (`lamp`: how fast they grow per px walked, per px of the light's height), so
// the light feels near and soft rather than a spotlight from far away.
const CAST = { squash: 0.6, longest: 1.1, sun: 0.55, lamp: 0.6, lampLongest: 0.8 };

/**
 * Where the sun's shadows fall at an hour: { x, y, alpha }. `path` ({ rise, set, peak }):
 * the sun comes up in the east at `rise`, crosses the north (the top of the screen) and
 * goes down in the west at `set`, `peak` degrees up at its highest. Shadows fall away
 * from it (west in the morning, toward the camera at noon, east at golden hour), long
 * while it's low, and fade in and out as it clears the horizon. None at night or without a path.
 */
export function sunShadow(path, hour, { squash = CAST.squash, longest = CAST.longest } = {}) {
  const none = { x: 0, y: 0, alpha: 0 };
  if (!path) return none;
  const t = (hour - path.rise) / (path.set - path.rise);
  if (t <= 0 || t >= 1) return none;
  const up = Math.sin(Math.PI * t) * path.peak * (Math.PI / 180);
  const len = Math.min(longest, CAST.sun / Math.tan(up));
  return {
    x: -Math.cos(Math.PI * t) * len,
    y: Math.sin(Math.PI * t) * len * squash,
    alpha: Math.min(1, up / (6 * (Math.PI / 180))),
  };
}

/**
 * A shadow cast away from a light, at feet (x, y): { x, y, alpha } like sunShadow.
 * `light` is { x, y: the spot on the ground under it, h: how high it is, reach, strength }.
 * The farther from the light, the longer the shadow and the fainter, gone at its reach;
 * right under it, there's none to speak of.
 */
export function lightShadow(light, x, y, { squash = CAST.squash, longest = CAST.lampLongest } = {}) {
  const gx = x - light.x;
  const gy = (y - light.y) / squash; // on the ground, unsquashed
  const d = Math.hypot(gx, gy);
  if (d >= light.reach || d < 1) return { x: 0, y: 0, alpha: 0 };
  const len = Math.min(longest, (CAST.lamp * d) / light.h);
  return {
    x: (gx / d) * len,
    y: (gy / d) * len * squash,
    alpha: light.strength * Math.sqrt(1 - d / light.reach) * Math.min(1, d / 40),
  };
}
