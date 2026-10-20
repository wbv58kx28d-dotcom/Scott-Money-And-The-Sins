// Screen size, colors, fonts, and layout. Scenes read positions from here
// instead of hard-coding them. Combat numbers live in src/data/, not here.

export const GAME_W = 720;
export const GAME_H = 1280;

export const FONTS = {
  header: '"Press Start 2P", monospace', // headers and labels
  body: '"VT323", monospace',            // body and dialog text
};

// Phaser wants numbers for fills and CSS strings for text.
export const COLORS = {
  bg: '#0b0a12',
  text: '#f5f1e8',
  textDim: '#8a8496',
  textGold: '#f4d35e',
  textBad: '#ff6b6b',
  textGood: '#7cf29c',
  textCool: '#9fdcff',
  outline: '#120d1c',

  // Ego bars go green → yellow → red (above 50%, above 25%, below).
  egoHigh: 0x3ddc84,
  egoMid: 0xffd166,
  egoLow: 0xff5c5c,
  flow: 0x4cc9f0,
  crowd: 0xff5c8a,
  crowdFull: 0xffd166,
  barBack: 0x2a2040,

  glow: 0x9fdcff, // active-turn highlight (CLAUDE.md §8.1)
};

/** Ego bar color for a fill ratio (from the prototype). */
export const egoColor = (ratio) => (ratio > 0.5 ? COLORS.egoHigh : ratio > 0.25 ? COLORS.egoMid : COLORS.egoLow);

// Battle layout for the 720×1280 portrait canvas (CLAUDE.md §8.2).
// Characters use feet origins: x, y is where the feet touch the ground.
export const LAYOUT = {
  // Up to 2 enemy slots, upper-left. Only slot 0 is used so far.
  enemySlots: [
    { x: 220, y: 735 },
    { x: 330, y: 650 },
  ],
  scott: { x: 500, y: 1040 },
  // TEMPORARY: $cott is in the foreground, so he should look bigger than the
  // enemies. Until the art chat re-exports scott.png at ~420 px tall, he's
  // stretched in-engine (an approved exception to "never setScale finished
  // art", CLAUDE.md §8.1). Set back to 1 when the new file lands.
  scottScale: 1.3,

  // Lunges move toward the opponent: $cott up-left, the enemy down-right.
  scottLunge: { dx: -56, dy: -40 },
  enemyLunge: { dx: 56, dy: 40 },

  // Where popups appear, measured up from the feet.
  headroom: 30, // gap above the head for damage numbers

  // HUD cards (ui/hud.js). The enemy's and $cott's match; the enemy's intel
  // tags sit under its feet (dy below the enemy slot), not in its card.
  enemyHud: { x: 24, y: 24, w: 352, h: 144 },
  scottHud: { x: 24, y: 830, w: 352, h: 210 },
  enemyIntel: { x: 24, dy: 12, h: 34, gap: 6, maxW: 344 },
  cornerButtons: { y: 46, h: 40, gap: 8, right: 684 }, // ? and SND, top-right
  crowd: { x: 412, y: 82, w: 272, h: 86 },

  panel: { x: 16, y: 1090, w: 688, h: 170, pad: 8, gap: 6 },
  timingBar: { x: 60, y: 1186, w: 600, h: 44 },

  stageLabel: { x: 28, y: 176 },
  // Lyric ribbons for bars (ui/speechBubble.js): $cott's sit above his head,
  // the enemy's to the right of their face. Both stay below minTop.
  bubble: { right: 700, gap: 22, minTop: 318 },
  // The crowd: silhouettes along the horizon, behind the fighters.
  crowdRow: { y: 700, count: 15, spacing: 48 },
  entrance: { offscreen: 260, ms: 650 }, // fighters slide in from the sides

  idleBob: { px: 3, ms: 1400 },
};

// Overworld map layout (assets/map/README.md). The map art fills the canvas
// at scale 1; the bottom band is kept clear for the region info panel.
export const MAP = {
  panel: { x: 16, y: 1112, w: 688, h: 152 },
  enterButton: { w: 176, h: 104 }, // right side of the panel
  phoneButton: { x: 76, y: 44, w: 112, h: 40 },
  pin: { radius: 11, labelGap: 18 }, // region names sit below their pin
  token: { radius: 22, lift: 40, bob: 4 }, // $cott's coin floats above the pin
  route: { dash: 12, gap: 9, width: 4 },
  highlight: { tint: 0xffe68c, min: 0.06, max: 0.26, ms: 900 },
  tapSlop: 24, // a press that moves farther than this is a drag, not a tap
  fogFadeMs: 1400,
  routeDrawMs: 900,
  travelMs: 500,
};

// Placeholder sprites bake this many screen pixels into each sprite pixel,
// so a ~29-row sprite stands ~320 px tall (HANDOFF.md Phase 1, step 6).
export const PLACEHOLDER_PX = 11;
export const OUTLINE_PX = 3;

// Walkable regions (scenes/RegionScene.js, CLAUDE.md §6.6, §8.4).
export const FIELD = {
  frame: { w: 96, h: 144 }, // one frame of a walker sprite sheet; feet at the bottom center
  artPx: 5, // screen px per art pixel in the placeholder walkers and props (when art is missing)
  cell: 10, // walk-grid cell, in world px
  clearance: 2, // cells kept free between $cott's feet and a wall
  npcBlock: { w: 70, h: 30 }, // an NPC's own footprint, centered on the feet
  speed: 260, // walking speed, px per second
  // How far a walk cycle (two steps) carries him at that speed: it sets the cadence, about
  // 2.9 steps a second, a brisk walk. The cycle is paced by distance, so slower is fewer steps.
  stride: 180,
  talkRange: 110, // $cott stops this close to an NPC to talk
  cameraLerp: 0.14,
  dragRepathMs: 120, // while a finger is held down and dragged, re-aim this often
  tapSlop: 24,
  card: { x: 16, y: 18, w: 420, h: 84 }, // region name, top-left
  buttons: { y: 52, h: 48, right: 700, gap: 8 }, // the PHONE button, top-right
  // The on-screen joystick, bottom-right under the thumb (mirror x for lefties: 120). `grab` is
  // how close a touch must start to pick it up; below `deadZone` (of the radius) it doesn't
  // move, and the lightest push walks at `minSpeed`.
  stick: { x: 600, y: 1150, radius: 60, knob: 22, grab: 90, deadZone: 0.2, minSpeed: 0.4 },
  // The TALK button, down-left of the stick like a gamepad's A button. It lights up when an
  // NPC is within `range` of $cott's feet; pressing it talks to the nearest one.
  talkButton: { x: 440, y: 1186, radius: 36, grab: 56, range: 170 },
};

// $cott's jet ski (CLAUDE.md §6.6, systems/ride.js): rented once at a dock, boarded from any shore.
export const RIDE = {
  speed: 430, // px per second on the water
  clearance: 3, // water-grid cells kept between the hull and the shore
  reach: 90, // how far across the shore (px) he can hop between land and the ski
  pushMs: 140, // push the stick into the shore this long to hop on or off
  hopMs: 280, // the hop itself
  hopHeight: 26, // px he rises at the top of the hop
  waterline: [8, 12], // art rows of hull under the water, swinging between these as it bobs (screen px)
  bobMs: 1100, // one bob
  wakeEveryPx: 22, // a puff of foam behind him every this many px ridden
  wakeMs: 900, // how long a puff lasts
  rippleMs: 1500, // standing still: a ring spreads out from the hull this often
  price: 400, // what the dock charges (less if that's more than he has: never stuck on the first island)
};
