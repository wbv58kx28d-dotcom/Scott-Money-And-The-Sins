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
  panel: 0x141020,
  panelAlpha: 0.94,
  panelBorder: 0xf4d35e,
  panelBorderDim: 0x5b4f7a,
  button: 0x2a2140,
  buttonHover: 0x3b2f5c,
  buttonDisabled: 0x1b1626,
  buttonBorder: 0xf4d35e,
  shadow: 0x000000,

  text: '#f5f1e8',
  textDim: '#8a8496',
  textGold: '#f4d35e',
  textBad: '#ff6b6b',
  textGood: '#7cf29c',
  textCool: '#9fdcff',
  outline: '#120d1c',

  // Clout bars go green → yellow → red (above 50%, above 25%, below).
  cloutHigh: 0x3ddc84,
  cloutMid: 0xffd166,
  cloutLow: 0xff5c5c,
  flow: 0x4cc9f0,
  crowd: 0xff5c8a,
  crowdFull: 0xffd166,
  barBack: 0x2a2040,

  glow: 0x9fdcff, // active-turn highlight (CLAUDE.md §8.1)
};

/** Clout bar color for a fill ratio (from the prototype). */
export const cloutColor = (ratio) => (ratio > 0.5 ? COLORS.cloutHigh : ratio > 0.25 ? COLORS.cloutMid : COLORS.cloutLow);

// Battle layout for the 720×1280 portrait canvas (CLAUDE.md §8.2).
// Characters use feet origins: x, y is where the feet touch the ground.
export const LAYOUT = {
  // Up to 2 enemy slots, upper-left. Only slot 0 is used so far.
  enemySlots: [
    { x: 220, y: 735 },
    { x: 330, y: 650 },
  ],
  scott: { x: 500, y: 1040 },

  // Lunges move toward the opponent. All art faces left.
  scottLunge: { dx: -56, dy: -40 },
  enemyLunge: { dx: 56, dy: 40 },

  // Where popups appear, measured up from the feet.
  headroom: 30, // gap above the head for damage numbers

  enemyHud: { x: 24, y: 24, w: 672, h: 196 },
  cornerButtons: { y: 52, h: 40, gap: 8, right: 682 }, // ? and SND, inside the enemy panel
  crowd: { x: 24, y: 232, w: 672, h: 56 },
  scottHud: { x: 24, y: 850, w: 300, h: 196 },

  panel: { x: 16, y: 1090, w: 688, h: 170, pad: 8, gap: 6 },
  timingBar: { x: 60, y: 1186, w: 600, h: 44 },

  stageLabel: { x: 28, y: 300 },
  // The crowd: silhouettes along the horizon, behind the fighters.
  crowdRow: { y: 700, count: 15, spacing: 48 },
  entrance: { offscreen: 260, ms: 650 }, // fighters slide in from the sides

  idleBob: { px: 3, ms: 1400 },
};

// Placeholder sprites bake this many screen pixels into each sprite pixel,
// so a ~29-row sprite stands ~320 px tall (HANDOFF.md Phase 1, step 6).
export const PLACEHOLDER_PX = 11;
export const OUTLINE_PX = 3;
