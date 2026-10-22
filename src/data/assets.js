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

// Walker sprite sheets: FIELD.frame-sized frames; rows down, up, left; columns idle, then the walk
// cycle (4 or 8 frames). `stride` is how far one walk cycle carries them (FIELD.stride by default).
// `idle` is an idle action: a clip about what they're holding, played now and then while
// they stand (ui/motion.js), from `${key}_idle` (tools/region-art/idle.py: rows down, up,
// left, `frames` each) in the `views` it was drawn for. A standee looks the same every way.
const STANDEE = ['down', 'up', 'left'];
const idle = (name, views, fps = 8) => ({ path: `assets/field/field_${name}_idle.png`, views, frames: 8, fps });
export const FIELD_SHEETS = [
  { key: 'field_scott', path: 'assets/field/field_scott.png' },
  { key: 'field_derek', path: 'assets/field/field_derek.png' },
  { key: 'field_brad', path: 'assets/field/field_brad.png', idle: idle('brad', ['left']) }, // peeks in his shopping bag
  { key: 'field_morgan', path: 'assets/field/field_morgan.png', idle: idle('morgan', ['down', 'left']) }, // bounces the ban hammer
  { key: 'field_chad', path: 'assets/field/field_chad.png', idle: idle('chad', ['down', 'left']) }, // sips his iced drink
  { key: 'field_vinny', path: 'assets/field/field_vinny.png', idle: idle('vinny', ['left']) }, // checks his guest list
  { key: 'field_wendy', path: 'assets/field/field_wendy.png', idle: idle('wendy', ['down']) }, // sips her champagne
  // Lil' Turnt, who follows $cott around (data/followers.js).
  { key: 'field_lilturnt', path: 'assets/field/field_lilturnt.png', stride: 120 }, // short legs, quicker steps
  // Idle-only standees (tools/region-art/standee.py): the hot-tub regulars, the doorman, the day traders.
  { key: 'field_bob', path: 'assets/field/field_bob.png' },
  { key: 'field_floyd', path: 'assets/field/field_floyd.png', idle: idle('floyd', STANDEE) }, // chugs his can
  { key: 'field_lola', path: 'assets/field/field_lola.png', idle: idle('lola', STANDEE) }, // takes a selfie
  { key: 'field_doorman', path: 'assets/field/field_doorman.png', idle: idle('doorman', STANDEE) }, // writes on his clipboard
  { key: 'field_helena', path: 'assets/field/field_helena.png', idle: idle('helena', STANDEE) }, // checks her phone
  { key: 'field_quentin', path: 'assets/field/field_quentin.png', idle: idle('quentin', STANDEE, 7) }, // sips his coffee
  { key: 'field_bart', path: 'assets/field/field_bart.png', idle: idle('bart', STANDEE) }, // yells into his phone
  { key: 'field_dockhand', path: 'assets/field/field_dockhand.png' }, // the Isles' jet-ski rental
  { key: 'field_guard', path: 'assets/field/field_guard.png' }, // at Envy's castle
];

// $cott on his jet ski (tools/region-art/jetski.py, systems/ride.js): 16 headings, 22.5° apart. A row per
// heading on the west half, south round through west to north (s ssw sw wsw w wnw nw nnw n); the east half
// mirrors them. Every view's hull bottom sits on one waterline, `foot` px down the frame.
export const RIDE_SHEET = { key: 'field_scott_ski', path: 'assets/field/field_scott_ski.png', w: 168, h: 156, foot: 152 };

// Scenery props, drawn with their feet (bottom center) on the ground. `name` and
// `block` (the footprint $cott can't walk through) are what the map editor
// gives a new one; `place: false` ones aren't placed as props (ropes are map `gates`).
// Their atmosphere (ui/atmosphere.js, as strong as the map's look says):
//   shadow  a contact shadow under one without its own ground plate, traced
//           from the art's own base where it meets the ground: true, or
//           { rise, reach } (how high up the base is traced, how far it fades out;
//           a low overhang, like a sign's board, wants a small rise)
//   glow    lights: [{ x, y (from the feet), r, color, alpha?, flicker? | pulse?, reach? }]
//           (`reach`: how far its pool spreads on the light map; 2.6 × r if not given)
//   puffs   { x, y, kind: 'steam' | 'ember', every (ms), spread? }, rising off it
//   sway    how far its top leans in a strong wind, px (ui/motion.js); trees, reeds, flames
//   cast    how its shadows away from the sun and from lights are shaped (ui/atmosphere.js castForm):
//           { box: true, w?, d?, h? } a footprint (the block, running back up the screen
//           from the feet) raised to a height (the art's over it), for boxy things;
//           { foot } for a tree: its bottom `foot` px are its mud plate, and the
//           silhouette above casts from there; nothing for each column of the art to
//           cast from its own ground line; false for none (wall decor, flat things)
//   under   drawn under the ground instead of standing on it: the Sky Deck's tower bodies, hanging
//           from their rooftop over a drop. `anchor` is the px in the image that lands on the
//           layout's point (the middle of the rooftop's floor), `floor` the floor's half-width and
//           half-height, and `band` an image tiled below the body down to the map's bottom.
//   seeThrough false: never fades when $cott walks behind it (an arch you see him through anyway)
//   pillars { dx, w, h }: instead of one footprint, one under each of two pillars `dx` either side
//           of the feet, so the way between them stays open (a gate arch; systems/mapcheck.js)
export const PROP_IMAGES = [
  { key: 'prop_cypress', path: 'assets/props/prop_cypress.png', name: 'CYPRESS', block: { w: 64, h: 24 }, sway: 8, cast: { foot: 20 } },
  { key: 'prop_cypress_b', path: 'assets/props/prop_cypress_b.png', name: 'CYPRESS 2', block: { w: 64, h: 24 }, sway: 8, cast: { foot: 24 } },
  { key: 'prop_cypress_c', path: 'assets/props/prop_cypress_c.png', name: 'CYPRESS 3', block: { w: 60, h: 24 }, sway: 8, cast: { foot: 16 } },
  { key: 'prop_cypress_d', path: 'assets/props/prop_cypress_d.png', name: 'CYPRESS 4', block: { w: 64, h: 24 }, sway: 8, cast: { foot: 24 } },
  { key: 'prop_snag', path: 'assets/props/prop_snag.png', name: 'SNAG', block: { w: 40, h: 18 }, shadow: true, glow: [{ x: 4, y: -76, r: 44, color: 0xff5ad0, pulse: true }], sway: 5, cast: { foot: 14 } },
  { key: 'prop_snag_b', path: 'assets/props/prop_snag_b.png', name: 'SNAG 2', block: { w: 40, h: 18 }, shadow: true, glow: [{ x: 12, y: -95, r: 44, color: 0xff5ad0, pulse: true }], sway: 5, cast: { foot: 14 } },
  { key: 'prop_sign', path: 'assets/props/prop_sign.png', name: 'SIGN', block: { w: 90, h: 16 }, label: 'SIGN', shadow: { rise: 10 }, cast: { foot: 0 } },
  { key: 'prop_setup', path: 'assets/props/prop_setup.png', name: 'DESK', block: { w: 170, h: 50 }, cast: { box: true } },
  { key: 'prop_tent', path: 'assets/props/prop_tent.png', name: 'TENT', block: { w: 160, h: 60 }, shadow: true, cast: { box: true } },
  { key: 'prop_lounge', path: 'assets/props/prop_lounge.png', name: 'LOUNGE', block: { w: 100, h: 30 }, cast: { box: true, h: 24 } },
  // Toxic bog scenery (tools/region-art/props/, CLAUDE.md §8.4).
  { key: 'prop_shrooms', path: 'assets/props/prop_shrooms.png', name: 'SHROOMS', block: { w: 30, h: 12 }, shadow: true, glow: [{ x: -5, y: -40, r: 66, color: 0xff5ad0, pulse: true }] },
  { key: 'prop_shrooms_b', path: 'assets/props/prop_shrooms_b.png', name: 'SHROOMS 2', block: { w: 30, h: 12 }, shadow: true, glow: [{ x: -1, y: -44, r: 60, color: 0xc060ff, pulse: true }] },
  { key: 'prop_barrel', path: 'assets/props/prop_barrel.png', name: 'SLUDGE BARREL', block: { w: 40, h: 18 }, shadow: true, glow: [{ x: 9, y: -25, r: 56, color: 0xff40d0, alpha: 0.8 }], cast: { box: true } },
  { key: 'prop_stump', path: 'assets/props/prop_stump.png', name: 'STUMP', block: { w: 56, h: 20 }, shadow: true },
  { key: 'prop_crystals', path: 'assets/props/prop_crystals.png', name: 'CRYSTALS', block: { w: 44, h: 16 }, shadow: true, glow: [{ x: -3, y: -30, r: 72, color: 0xff50e0, pulse: true }] },
  { key: 'prop_rig', path: 'assets/props/prop_rig.png', name: 'MINING RIG', block: { w: 70, h: 24 }, shadow: true, cast: { box: true } },
  { key: 'prop_reeds', path: 'assets/props/prop_reeds.png', name: 'REEDS', block: { w: 34, h: 12 }, sway: 4 },
  { key: 'prop_trash', path: 'assets/props/prop_trash.png', name: 'TRASH', cast: false }, // flat: walk right over it
  // The hot-tub hub (CLAUDE.md §6.6).
  { key: 'prop_hottub', path: 'assets/props/prop_hottub.png', name: 'HOT TUB', block: { w: 150, h: 40 }, shadow: true, glow: [{ x: -2, y: -64, r: 120, color: 0xff40d0, pulse: true }], puffs: { x: 0, y: -84, kind: 'steam', every: 520, spread: 80 }, cast: { box: true, h: 36, d: 56 } },
  { key: 'prop_cooler', path: 'assets/props/prop_cooler.png', name: 'COOLER', block: { w: 56, h: 18 }, shadow: true, cast: { box: true, h: 26 } },
  { key: 'prop_tiki', path: 'assets/props/prop_tiki.png', name: 'TIKI TORCH', block: { w: 18, h: 10 }, shadow: true, glow: [{ x: -2, y: -78, r: 76, color: 0xff9a30, flicker: true }], puffs: { x: -2, y: -86, kind: 'ember', every: 420 }, sway: 2 },
  // The hub's cardboard neighborhood: fake luxury for broke, over-leveraged stonk bros.
  { key: 'prop_cb_mansion', path: 'assets/props/prop_cb_mansion.png', name: 'BOX MANSION', block: { w: 240, h: 90 }, shadow: true, cast: { box: true } },
  { key: 'prop_cb_mansion_b', path: 'assets/props/prop_cb_mansion_b.png', name: 'BOX MANSION 2', block: { w: 240, h: 90 }, shadow: true, cast: { box: true } },
  { key: 'prop_cb_bank', path: 'assets/props/prop_cb_bank.png', name: 'APE CAPITAL', block: { w: 200, h: 60 }, shadow: true, cast: { box: true } },
  { key: 'prop_cb_condo', path: 'assets/props/prop_cb_condo.png', name: 'BOX CONDOS', block: { w: 150, h: 50 }, shadow: true, cast: { box: true } },
  { key: 'prop_cb_garage', path: 'assets/props/prop_cb_garage.png', name: 'BOX LAMBO', block: { w: 160, h: 60 }, shadow: true, cast: { box: true } },
  // The trading firm's tower; its door is an exit just in front of its footprint.
  { key: 'prop_tower', path: 'assets/props/prop_tower.png', name: 'OFFICE TOWER', block: { w: 230, h: 24 }, glow: [{ x: 3, y: -136, r: 130, color: 0x50ff90, alpha: 0.45, pulse: true }, { x: 0, y: -40, r: 96, color: 0x70d8ff, alpha: 0.7 }], cast: { box: true, w: 200, d: 70, h: 230 } },
  { key: 'prop_plant', path: 'assets/props/prop_plant.png', name: 'PLANT', block: { w: 30, h: 14 } },
  // A tarp over Derek's cellar door: a `cover` until the WIFI app traces his router (systems/secrets.js).
  { key: 'prop_tarp', path: 'assets/props/prop_tarp.png', name: 'TARP', cast: false },
  // Derek's house; its open cellar door is the way down to his basement (an exit on top of it).
  { key: 'prop_house', path: 'assets/props/prop_house.png', name: 'HOUSE', block: { w: 250, h: 70 }, glow: [{ x: 74, y: -119, r: 72, color: 0x80c8ff, flicker: true }], cast: { box: true, w: 200, d: 70, h: 150 } },
  { key: 'prop_cellar', path: 'assets/props/prop_cellar.png', name: 'CELLAR DOOR', glow: [{ x: 10, y: -39, r: 90, color: 0xff40d0, pulse: true }], cast: false },
  // Derek's basement: a back wall in 128 px segments (tools/region-art/wall.py), stairs up, and the server room.
  { key: 'prop_wall', path: 'assets/props/prop_wall.png', name: 'WALL', cast: false },
  { key: 'prop_wall_pipe', path: 'assets/props/prop_wall_pipe.png', name: 'WALL + PIPE', cast: false },
  { key: 'prop_stairs', path: 'assets/props/prop_stairs.png', name: 'STAIRS', cast: false },
  { key: 'prop_poster', path: 'assets/props/prop_poster.png', name: 'POSTER', cast: false },
  { key: 'prop_apesign', path: 'assets/props/prop_apesign.png', name: 'APE SIGN', glow: [{ x: 0, y: -82, r: 80, color: 0xff4ad8, pulse: true }], cast: false },
  { key: 'prop_rack', path: 'assets/props/prop_rack.png', name: 'SERVER RACK', block: { w: 70, h: 26 }, glow: [{ x: 0, y: -90, r: 56, color: 0x60ffb0, alpha: 0.6, flicker: true }], cast: { box: true } },
  { key: 'prop_rack_b', path: 'assets/props/prop_rack_b.png', name: 'SERVER RACK 2', block: { w: 76, h: 26 }, glow: [{ x: 0, y: -90, r: 56, color: 0x60c0ff, alpha: 0.6, flicker: true }], cast: { box: true } },
  { key: 'prop_rack_c', path: 'assets/props/prop_rack_c.png', name: 'SERVER RACK 3', block: { w: 76, h: 26 }, glow: [{ x: 0, y: -90, r: 56, color: 0xff60e0, alpha: 0.6, flicker: true }], cast: { box: true } },
  { key: 'prop_battlestation', path: 'assets/props/prop_battlestation.png', name: 'BATTLE STATION', block: { w: 200, h: 50 }, glow: [{ x: -10, y: -105, r: 120, reach: 200, color: 0x7090ff, flicker: true }], cast: { box: true } },
  { key: 'prop_fridge', path: 'assets/props/prop_fridge.png', name: 'MINI FRIDGE', block: { w: 36, h: 18 }, glow: [{ x: 5, y: -28, r: 44, color: 0xff40d0, alpha: 0.7 }], cast: { box: true } },
  { key: 'prop_mattress', path: 'assets/props/prop_mattress.png', name: 'MATTRESS', block: { w: 100, h: 36 }, cast: { box: true, h: 14 } },
  // The trading floor: a marble-and-glass office (tools/region-art/wall.py draws its wall).
  { key: 'prop_office_wall', path: 'assets/props/prop_office_wall.png', name: 'OFFICE WALL', cast: false },
  { key: 'prop_office_window', path: 'assets/props/prop_office_window.png', name: 'OFFICE WINDOW', cast: false },
  { key: 'prop_tradedesk', path: 'assets/props/prop_tradedesk.png', name: 'TRADING DESK', block: { w: 170, h: 40 }, cast: { box: true } },
  { key: 'prop_espresso', path: 'assets/props/prop_espresso.png', name: 'ESPRESSO BAR', block: { w: 110, h: 30 }, cast: { box: true } },
  { key: 'prop_screen', path: 'assets/props/prop_screen.png', name: 'WALL SCREEN', glow: [{ x: 14, y: -99, r: 76, color: 0x50ff90, alpha: 0.5, pulse: true }], cast: false },
  // The Sky Deck's towers (CLAUDE.md §6.6): PixelLab bodies whose own rooftop is the floor, from
  // tools/region-art/skytowers.py. Each layout point is the middle of that floor.
  ...[
    ['keep', 'SKY KEEP', 256, 124, 166, 84],
    ['turret', 'SKY TURRET', 160, 84, 140, 60],
    ['rose', 'SKY ROSE TURRET', 160, 122, 150, 76],
    ['twin', 'SKY TWIN TURRET', 156, 86, 88, 38],
  ].map(([id, name, x, y, rx, ry]) => ({
    key: `sky_${id}`, path: `assets/skydeck/sky_${id}.png`, name, under: true, cast: false,
    anchor: { x, y }, floor: { rx, ry }, band: { key: `sky_${id}_band`, path: `assets/skydeck/sky_${id}_band.png` },
  })),
  // Where a Sky Deck bridge meets a rooftop (CLAUDE.md §6.6), drawn straight-on: for a bridge running
  // down the screen, a gate arch facing the camera on the rim (its `pillars` block, the way between them
  // is open); for one running across, a pair of its pillars, one on each rail at the bridge's mouth.
  { key: 'prop_sky_gate', path: 'assets/props/prop_sky_gate.png', name: 'SKY GATE', shadow: true, cast: false, seeThrough: false, pillars: { dx: 44, w: 16, h: 12 } },
  { key: 'prop_sky_pillar', path: 'assets/props/prop_sky_pillar.png', name: 'SKY GATE PILLAR', shadow: true, cast: false, seeThrough: false },
  // The Influencer Isles (tools/region-art/props/, tools/region-art/isles/README.md): palms, the jet-ski
  // rental shack, and the castle's exterior keep and turrets standing on its island (placeholders, drawn
  // at an angle before the straight-on rule; CLAUDE.md §8.4).
  { key: 'prop_palm', path: 'assets/props/prop_palm.png', name: 'PALM', block: { w: 50, h: 22 }, sway: 8, cast: { foot: 24 } },
  { key: 'prop_palm_b', path: 'assets/props/prop_palm_b.png', name: 'PALM 2', block: { w: 50, h: 22 }, sway: 8, cast: { foot: 24 } },
  { key: 'prop_palm_c', path: 'assets/props/prop_palm_c.png', name: 'GLAM PALM', block: { w: 50, h: 22 }, sway: 8, cast: { foot: 24 } },
  { key: 'prop_skishack', path: 'assets/props/prop_skishack.png', name: 'JET-SKI SHACK', block: { w: 170, h: 50 }, shadow: true, cast: { box: true } },
  { key: 'prop_castle_keep', path: 'assets/props/prop_castle_keep.png', name: 'CASTLE KEEP', block: { w: 240, h: 80 }, shadow: true, cast: { box: true } },
  { key: 'prop_castle_turret', path: 'assets/props/prop_castle_turret.png', name: 'CASTLE TURRET', block: { w: 84, h: 36 }, shadow: true, cast: { box: true } },
  { key: 'prop_castle_turret_b', path: 'assets/props/prop_castle_turret_b.png', name: 'CASTLE TURRET 2', block: { w: 110, h: 40 }, shadow: true, cast: { box: true } },
  { key: 'prop_castle_turret_c', path: 'assets/props/prop_castle_turret_c.png', name: 'CASTLE TURRET 3', block: { w: 84, h: 36 }, shadow: true, cast: { box: true } },
  // A velvet rope (map `gates`), closed and unhooked.
  { key: 'prop_rope', path: 'assets/props/prop_rope.png', place: false },
  { key: 'prop_rope_open', path: 'assets/props/prop_rope_open.png', place: false },
];

/** Where a prop's image hangs from its layout point, as an origin: its feet (bottom middle), or its `anchor`. */
export function propOrigin(def, w, h) {
  return def?.anchor ? [def.anchor.x / w, def.anchor.y / h] : [0.5, 1];
}

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
