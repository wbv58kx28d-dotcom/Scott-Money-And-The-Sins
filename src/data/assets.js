// Images the Preload scene tries to load. Every entry is optional: if the
// file is missing (or `path` is null), the named procedural placeholder is
// generated under the same texture key, so the game runs before the art lands.
//
// When finished art arrives, drop it in assets/ and set its `path` here.
//
// The seven Sin sprites (lilturnt, babarbara, susan, toking, keezus, louis,
// sixpac) are already in assets/sprites/crew/. They get listed here when
// summon cut-ins and parley portraits are built (HANDOFF.md Phase 3), so phones
// don't download them before the game uses them. Likewise the villains with
// art but no battle yet (vince, max, fulfiller in assets/sprites/enemies/).
//
// Facing: crew sprites face left; villain sprites face right, toward $cott.

export const IMAGES = [
  { key: 'scott', path: 'assets/sprites/crew/scott.png', placeholder: 'scott' },
  { key: 'derek', path: 'assets/sprites/enemies/derek.png', placeholder: 'derek' },
  { key: 'bg_tokyo', path: 'assets/bg/bg_tokyo.webp', placeholder: 'bgCity' },
];

// ---- Walkable regions (CLAUDE.md §6.6, §8.4) ----------------------------------
// Loaded by the Region scene on entry, not at startup. Anything with a null
// path is baked procedurally under the same key (systems/fieldArt.js).

// Painted region maps: `base` is the ground, `walk` the walk mask (white = walkable).
export const REGION_ART = {
  start: { base: 'assets/regions/start/base.webp', walk: 'assets/regions/start/walk.png' },
};

// Walker sprite sheets: FIELD.frame-sized frames; rows down, up, left; columns idle, walk 1–4.
export const FIELD_SHEETS = [
  { key: 'field_scott', path: 'assets/field/field_scott.png' },
  { key: 'field_derek', path: null },
];

// Scenery props, drawn with their feet (bottom center) on the ground.
export const PROP_IMAGES = [
  { key: 'prop_cypress', path: 'assets/props/prop_cypress.png' },
  { key: 'prop_cypress_b', path: 'assets/props/prop_cypress_b.png' },
  { key: 'prop_snag', path: 'assets/props/prop_snag.png' },
  { key: 'prop_snag_b', path: 'assets/props/prop_snag_b.png' },
  { key: 'prop_sign', path: 'assets/props/prop_sign.png' },
  { key: 'prop_setup', path: 'assets/props/prop_setup.png' },
  { key: 'prop_tent', path: 'assets/props/prop_tent.png' },
];
