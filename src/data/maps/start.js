// The Subreddit Swamps, walkable (CLAUDE.md §6.6). World coordinates are
// pixels at scale 1; the camera scrolls over a map bigger than the screen.
//
// Until the painted region art lands (CLAUDE.md §8.4), `placeholder` describes
// the procedural stand-in: it paints the ground and the walk mask from these
// shapes. Props and NPCs use feet positions, like battle sprites.

export default {
  id: 'start',
  size: { w: 1080, h: 1920 },
  spawn: { x: 540, y: 1790, facing: 'up' },
  // Walking into an exit leaves the region.
  exits: [{ to: 'map', x: 470, y: 1880, w: 140, h: 40 }],

  npcs: [
    {
      id: 'derek',
      name: 'DEREK',
      sprite: 'field_derek',
      x: 540,
      y: 450,
      facing: 'down',
      fight: 'derek', // tapping him walks over, talks, then offers the fight
      // Placeholder lines until the writing chat sends real ones.
      talk: [
        { speaker: 'DEREK', text: '"Well, well. $cott Money, wading through MY swamp."' },
        { speaker: 'DEREK', text: '"Down 98% and still holding. You know what that makes me?\nA LEGEND."' },
      ],
      talkCleared: [
        { speaker: 'DEREK', text: '"Back for more? I averaged down on my feelings."' },
      ],
    },
  ],

  // y-sorted scenery. `block` is the footprint (centered on the feet) that $cott can't walk through.
  props: [
    { texture: 'prop_setup', x: 690, y: 400, block: { w: 170, h: 50 } },
    { texture: 'prop_tent', x: 360, y: 400, block: { w: 160, h: 60 } },
    { texture: 'prop_sign', x: 650, y: 1700, block: { w: 30, h: 16 }, label: 'r/APES' },
    { texture: 'prop_sign', x: 300, y: 880, block: { w: 30, h: 16 }, label: 'HODL ZONE' },
    { texture: 'prop_sign', x: 610, y: 610, block: { w: 30, h: 16 }, label: 'NO SELLING' },
    // Cypress trees and dead snags around the edges and between the pools.
    ...[
      [110, 260], [960, 250], [150, 700], [920, 980], [90, 1210], [990, 1560],
      [130, 1700], [870, 1820], [700, 1240], [330, 640], [820, 560], [250, 1350],
    ].map(([x, y]) => ({ texture: 'prop_cypress', x, y, block: { w: 44, h: 22 } })),
    ...[[420, 1600], [760, 1450], [190, 1020], [880, 360], [600, 760], [330, 1880]].map(([x, y]) => ({
      texture: 'prop_snag', x, y, block: { w: 30, h: 16 },
    })),
  ],

  placeholder: {
    seed: 7101,
    // The dirt path, from the exit at the bottom to Derek's camp at the top.
    path: [[540, 1920], [540, 1660], [400, 1460], [470, 1260], [470, 960], [650, 800], [600, 600], [540, 470]],
    pathWidth: 80,
    clearing: { x: 540, y: 400, rx: 280, ry: 150 },
    pools: [
      { x: 470, y: 1110, rx: 300, ry: 80 }, // the boardwalk crosses this one
      { x: 230, y: 1540, rx: 150, ry: 90 },
      { x: 830, y: 1330, rx: 190, ry: 110 },
      { x: 220, y: 900, rx: 150, ry: 110 },
      { x: 860, y: 760, rx: 150, ry: 90 },
      { x: 860, y: 1700, rx: 110, ry: 60 },
    ],
    boardwalks: [{ x: 420, y: 1000, w: 100, h: 220 }],
    border: 44, // dense reeds at the edges (not walkable, except the exit)
  },
};
