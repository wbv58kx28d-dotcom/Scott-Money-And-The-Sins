// A map's atmosphere (ui/atmosphere.js): the light and air over its ground.
// A map's content file names its `look`; debug `&look=<id>` tries another.
// The world's props bring their own shadows, glows and puffs (`shadow`,
// `glow`, `puffs` in data/assets.js); a look only says how strong they are.
//
//   grade     a color the whole world is multiplied by (white = untouched),
//             so 0xb8a8d8 is a violet dusk. UI and overhead bubbles sit above it.
//   haze      { color, alpha }: a flat wash over the world, for murky air.
//   vignette  { color, alpha }: darkened screen edges.
//   shadows   how dark shadows on the ground are (0..1).
//   lights    how strong props' glows are (0 turns them off).
//   motes     { count, kind: 'firefly' | 'spore', colors }: specks drifting in view.
//   mist      { density, color, alpha }: low banks of mist over solid water cells.

export const LOOKS = {
  // Plain daylight: just shadows. Rooms and maps without a look of their own.
  day: { shadows: 0.3, lights: 0.35 },

  // The swamp, take A: a violet toxic dusk, neon glowing, fireflies over the bog.
  dusk: {
    grade: 0xc4acd8,
    vignette: { color: 0x14081e, alpha: 0.5 },
    shadows: 0.38,
    lights: 1,
    motes: { count: 22, kind: 'firefly', colors: [0xfff07a, 0xc8ff6a] },
    mist: { density: 0.03, color: 0xe8d8ff, alpha: 0.16 },
  },

  // Take B: a sickly green fog, spores rising, glows muted by the murk.
  fog: {
    grade: 0xc8d0b0,
    haze: { color: 0xc8d8a0, alpha: 0.12 },
    vignette: { color: 0x101408, alpha: 0.45 },
    shadows: 0.3,
    lights: 0.7,
    motes: { count: 34, kind: 'spore', colors: [0xe8ff9a, 0xffffff, 0xff9ae8] },
    mist: { density: 0.07, color: 0xe4f0c8, alpha: 0.26 },
  },

  // Take C: night. Deep blue, the neon and the windows doing all the work.
  night: {
    grade: 0x50548c,
    vignette: { color: 0x05040e, alpha: 0.65 },
    shadows: 0.45,
    lights: 1.6,
    motes: { count: 30, kind: 'firefly', colors: [0xfff07a, 0xc8ff6a, 0xff8ad8] },
    mist: { density: 0.025, color: 0xa8b0ff, alpha: 0.14 },
  },

  // Derek's basement: a dark room lit by screens, server lights and his neon.
  basement: {
    grade: 0x9a90b8,
    vignette: { color: 0x06040c, alpha: 0.55 },
    shadows: 0.4,
    lights: 1.1,
  },

  // The trading floor: bright, clean, a little cool.
  office: {
    grade: 0xf0f0ff,
    vignette: { color: 0x0a0c14, alpha: 0.3 },
    shadows: 0.3,
    lights: 0.6,
  },
};

export const DEFAULT_LOOK = 'day';
