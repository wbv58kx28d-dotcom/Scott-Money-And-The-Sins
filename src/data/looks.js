// A map's atmosphere (ui/atmosphere.js, systems/sky.js): the light and air
// over its ground. A map's content file names its `look`; debug `&look=<id>`
// tries another (`none` turns it off). Props bring their own shadows, glows
// and puffs (`shadow`, `glow`, `puffs` in data/assets.js); the light says how
// strong they are.
//
// The light (each part optional):
//   grade      a color the whole world is multiplied by (white = untouched).
//              UI and overhead bubbles sit above it.
//   sun        { color, alpha, x }: a low sun's light washing in from the top
//              of the screen, x 0 from the west (left), 1 from the east.
//   haze       { color, alpha }: a flat wash over the world.
//   vignette   how dark the screen's edges get (0..1), in `vignetteColor`.
//   shadows    how dark shadows on the ground are (0..1).
//   lights     how strong props' glows are (0 turns them off).
//   sky        { top, bottom }: the sky past a drop (a `vista`), top of the screen to the horizon.
//   fireflies, spores, mist   how much of each (0..1): fireflies and spores
//              drift in view (`fireflyColors`, `sporeColors`, `motes` of each),
//              mist banks lie over solid water cells (`mistDensity`, `mistColor`).
//
// Outdoors, `phases` are lights at hours of the day (`at`, 0..24), blended in
// between, and the clock runs while $cott walks the region (DAY). `weather`
// gives each kind's odds and how long it lasts; fog, rain and storms fade in
// over the light (systems/sky.js says what each does).

/** The day's clock: a whole day takes this long in a region; a new game starts at this hour. */
export const DAY = { realMinutes: 24, startHour: 17, fadeSeconds: 8 };

const NIGHT = {
  grade: 0x5c6098, sun: { color: 0x7080ff, alpha: 0, x: 0.5 }, vignette: 0.6,
  shadows: 0.25, lights: 1.5, fireflies: 1, mist: 0.16,
  sky: { top: 0x0c0a2a, bottom: 0x3a2c66 },
};
const DAWN = {
  grade: 0xdcc2cc, sun: { color: 0xffc890, alpha: 0.38, x: 1 }, vignette: 0.32,
  shadows: 0.32, lights: 0.5, fireflies: 0.15, mist: 0.32,
  sky: { top: 0x6a78b8, bottom: 0xffc8a8 },
};
const DAY_LIGHT = {
  grade: 0xfcf6ee, sun: { color: 0xfff2c8, alpha: 0.06, x: 0.6 }, vignette: 0.18,
  shadows: 0.34, lights: 0.25, fireflies: 0, mist: 0.08,
  sky: { top: 0x4a90e0, bottom: 0xb8dcf0 },
};
// Golden hour: a warm grade and the sun's light flooding in from the west.
const SUNSET = {
  grade: 0xf2cab4, sun: { color: 0xff8a3a, alpha: 0.6, x: 0 }, vignette: 0.32,
  shadows: 0.42, lights: 0.8, fireflies: 0.3, mist: 0.14,
  sky: { top: 0x4a3a8a, bottom: 0xffa050 },
};
// After sundown: violet, the last pink light low in the west, the neon coming on.
const DUSK = {
  grade: 0xd6bcd8, sun: { color: 0xff6aa0, alpha: 0.32, x: 0 }, vignette: 0.4,
  shadows: 0.38, lights: 1.05, fireflies: 0.8, mist: 0.16,
  sky: { top: 0x2a1c5a, bottom: 0xe0609a },
};

const SWAMP_AIR = {
  vignetteColor: 0x14081e,
  fireflyColors: [0xfff07a, 0xc8ff6a, 0xffb0e0],
  sporeColors: [0xffffff, 0xf0f4ff, 0xffe8f8],
  motes: 24,
  mistDensity: 0.03,
  mistColor: 0xf0eaff,
};

export const LOOKS = {
  // The swamp's day: night, dawn, day, golden hour, dusk, and round again; with weather.
  swamp: {
    ...SWAMP_AIR,
    phases: [
      { at: 0, ...NIGHT },
      { at: 4.5, ...NIGHT },
      { at: 6.5, ...DAWN },
      { at: 9, ...DAY_LIGHT },
      { at: 16, ...DAY_LIGHT },
      { at: 18, ...SUNSET },
      { at: 19.5, ...DUSK },
      { at: 21.5, ...NIGHT },
    ],
    weather: { odds: { clear: 6, fog: 3, rain: 2, storm: 1 }, hours: [2, 5] },
    // Past the cliff at the map's top edge: the financial district the stonk bros can't
    // afford, over misty hills and the swamp's own treeline (ui/vista.js). `depth` is how
    // fast a layer moves with the ground, `rise` how far above the cliff edge its skyline
    // sits with the camera at the top, `haze` how far its color fades toward the sky's.
    vista: {
      extendTop: 420, // how far past the map's top the camera may look
      layers: [
        { kind: 'city', depth: 0.08, rise: 230, height: 260, color: 0x2a2040, haze: 0.45, mist: 0.5, seed: 5 },
        { kind: 'hills', depth: 0.2, rise: 130, height: 120, color: 0x261a34, haze: 0.32, mist: 0.6, seed: 9 },
        { kind: 'trees', depth: 0.4, rise: 40, height: 110, color: 0x140c1e, haze: 0.12, mist: 0.45, seed: 13 },
      ],
    },
  },

  // Plain daylight: just shadows. Maps without a look of their own.
  day: { shadows: 0.3, lights: 0.35 },

  // Derek's basement: a dark room lit by screens, server lights and his neon.
  basement: { grade: 0x9a90b8, vignette: 0.55, vignetteColor: 0x06040c, shadows: 0.4, lights: 1.1 },

  // The trading floor: bright, clean, a little cool.
  office: { grade: 0xf0f0ff, vignette: 0.3, vignetteColor: 0x0a0c14, shadows: 0.3, lights: 0.6 },
};

export const DEFAULT_LOOK = 'day';
