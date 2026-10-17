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

// A region's ground is drawn from its tileset (assets/regions/<set>/, built by
// tools/region-art/tileset.py), named by the map's layout; see ui/terrainView.js.

// Walker sprite sheets: FIELD.frame-sized frames; rows down, up, left; columns idle, walk 1–4.
export const FIELD_SHEETS = [
  { key: 'field_scott', path: 'assets/field/field_scott.png' },
  { key: 'field_derek', path: 'assets/field/field_derek.png' },
  { key: 'field_brad', path: 'assets/field/field_brad.png' },
  { key: 'field_morgan', path: 'assets/field/field_morgan.png' },
  { key: 'field_chad', path: 'assets/field/field_chad.png' },
  { key: 'field_vinny', path: 'assets/field/field_vinny.png' },
  { key: 'field_wendy', path: 'assets/field/field_wendy.png' },
];

// Scenery props, drawn with their feet (bottom center) on the ground. `name` and
// `block` (the footprint $cott can't walk through) are what the map editor
// gives a new one; `place: false` ones aren't placed as props (ropes are map `gates`).
export const PROP_IMAGES = [
  { key: 'prop_cypress', path: 'assets/props/prop_cypress.png', name: 'CYPRESS', block: { w: 64, h: 24 } },
  { key: 'prop_cypress_b', path: 'assets/props/prop_cypress_b.png', name: 'CYPRESS 2', block: { w: 64, h: 24 } },
  { key: 'prop_cypress_c', path: 'assets/props/prop_cypress_c.png', name: 'CYPRESS 3', block: { w: 60, h: 24 } },
  { key: 'prop_cypress_d', path: 'assets/props/prop_cypress_d.png', name: 'CYPRESS 4', block: { w: 64, h: 24 } },
  { key: 'prop_snag', path: 'assets/props/prop_snag.png', name: 'SNAG', block: { w: 40, h: 18 } },
  { key: 'prop_snag_b', path: 'assets/props/prop_snag_b.png', name: 'SNAG 2', block: { w: 40, h: 18 } },
  { key: 'prop_sign', path: 'assets/props/prop_sign.png', name: 'SIGN', block: { w: 90, h: 16 }, label: 'SIGN' },
  { key: 'prop_setup', path: 'assets/props/prop_setup.png', name: 'DESK', block: { w: 170, h: 50 } },
  { key: 'prop_tent', path: 'assets/props/prop_tent.png', name: 'TENT', block: { w: 160, h: 60 } },
  { key: 'prop_lounge', path: 'assets/props/prop_lounge.png', name: 'LOUNGE', block: { w: 100, h: 30 } },
  // Toxic bog scenery (tools/region-art/props/, CLAUDE.md §8.4).
  { key: 'prop_shrooms', path: 'assets/props/prop_shrooms.png', name: 'SHROOMS', block: { w: 30, h: 12 } },
  { key: 'prop_shrooms_b', path: 'assets/props/prop_shrooms_b.png', name: 'SHROOMS 2', block: { w: 30, h: 12 } },
  { key: 'prop_barrel', path: 'assets/props/prop_barrel.png', name: 'SLUDGE BARREL', block: { w: 40, h: 18 } },
  { key: 'prop_stump', path: 'assets/props/prop_stump.png', name: 'STUMP', block: { w: 56, h: 20 } },
  { key: 'prop_crystals', path: 'assets/props/prop_crystals.png', name: 'CRYSTALS', block: { w: 44, h: 16 } },
  { key: 'prop_rig', path: 'assets/props/prop_rig.png', name: 'MINING RIG', block: { w: 70, h: 24 } },
  { key: 'prop_reeds', path: 'assets/props/prop_reeds.png', name: 'REEDS', block: { w: 34, h: 12 } },
  { key: 'prop_trash', path: 'assets/props/prop_trash.png', name: 'TRASH' }, // flat: walk right over it
  // Derek's house; its open cellar door is the way down to his basement (an exit on top of it).
  { key: 'prop_house', path: 'assets/props/prop_house.png', name: 'HOUSE', block: { w: 250, h: 70 } },
  { key: 'prop_cellar', path: 'assets/props/prop_cellar.png', name: 'CELLAR DOOR' },
  // Derek's basement: a back wall in 128 px segments (tools/region-art/wall.py), stairs up, and the server room.
  { key: 'prop_wall', path: 'assets/props/prop_wall.png', name: 'WALL' },
  { key: 'prop_wall_pipe', path: 'assets/props/prop_wall_pipe.png', name: 'WALL + PIPE' },
  { key: 'prop_stairs', path: 'assets/props/prop_stairs.png', name: 'STAIRS' },
  { key: 'prop_poster', path: 'assets/props/prop_poster.png', name: 'POSTER' },
  { key: 'prop_apesign', path: 'assets/props/prop_apesign.png', name: 'APE SIGN' },
  { key: 'prop_rack', path: 'assets/props/prop_rack.png', name: 'SERVER RACK', block: { w: 70, h: 26 } },
  { key: 'prop_rack_b', path: 'assets/props/prop_rack_b.png', name: 'SERVER RACK 2', block: { w: 76, h: 26 } },
  { key: 'prop_rack_c', path: 'assets/props/prop_rack_c.png', name: 'SERVER RACK 3', block: { w: 76, h: 26 } },
  { key: 'prop_battlestation', path: 'assets/props/prop_battlestation.png', name: 'BATTLE STATION', block: { w: 200, h: 50 } },
  { key: 'prop_fridge', path: 'assets/props/prop_fridge.png', name: 'MINI FRIDGE', block: { w: 36, h: 18 } },
  { key: 'prop_mattress', path: 'assets/props/prop_mattress.png', name: 'MATTRESS', block: { w: 100, h: 36 } },
  // A velvet rope (map `gates`), closed and unhooked.
  { key: 'prop_rope', path: 'assets/props/prop_rope.png', place: false },
  { key: 'prop_rope_open', path: 'assets/props/prop_rope_open.png', place: false },
];

// Little looping effects in the regions, as sprite sheets (w × h frames).
// fx_bubble: a toxic bubble rising and popping on the water (the tileset's `bubbles`).
export const FX_SHEETS = [
  { key: 'fx_bubble', path: 'assets/fx/fx_bubble.png', w: 32, h: 32 },
];

// $cott's phone (scenes/PhoneScene.js): PixelLab art built by tools/phone-art/build.py.
// Anything missing is drawn instead. Icons are keyed phone_icon_<model>_<app id>.
export const PHONE_ART = [
  { key: 'phone_flip', path: 'assets/phone/flip_body.png' },
  { key: 'phone_flip_glare', path: 'assets/phone/flip_glare.png' },
  { key: 'phone_smart', path: 'assets/phone/smart_body.png' }, // wallpaper included
  ...['flip', 'smart'].flatMap((model) => ['map', 'stonks', 'shop', 'settings'].map((app) => ({
    key: `phone_icon_${model}_${app}`, path: `assets/phone/icon_${model}_${app}.png`,
  }))),
];
