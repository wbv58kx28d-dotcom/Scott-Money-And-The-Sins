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

    // Swamp locals. Each holds a `challenge`: win it and they spill intel on
    // Derek, which starts out visible in the fight (systems/intel.js).
    //   kind: 'beat'  `rounds` taps on the timing bar, each `need` or better
    //   kind: 'quiz'  every question's FIRST answer is right (shown shuffled)
    //   kind: 'trade' $cott's day-trading minigame (minigames/trade.js); finish up
    //                 `target` or better. Can override src/data/trade.js values.
    //   reveal        { enemy, weak?, resist?, softSpots?: ['TYPE>TARGET'] }
    // Placeholder lines until the writing chat sends real ones.
    {
      id: 'brad',
      name: 'BAGHOLDER BRAD',
      sprite: 'field_brad',
      x: 660,
      y: 1560,
      facing: 'left',
      talk: [
        { speaker: 'BRAD', text: '"Been holding these bags since 2021. My arms went numb in 2022."' },
        { speaker: 'BRAD', text: '"Derek says selling is for paper hands. But you look like you\'ve seen... profit."' },
      ],
      talkWon: [{ speaker: 'BRAD', text: '"One bag down. Only eleven to go."' }],
      challenge: {
        kind: 'trade',
        prompt: 'BRAD HAS NEVER SOLD A SHARE',
        accept: 'SHOW HIM',
        acceptSub: 'Buy low. Sell high. Allegedly.',
        title: 'TEACH BRAD TO SELL',
        ticker: '$BAGS',
        target: 0.25,
        win: [
          { speaker: 'BRAD', text: '"Is... is that what profit looks like?"\n*drops a bag*' },
          { speaker: 'BRAD', text: '"Derek can\'t take a flex either. Show him money he doesn\'t have and he short-circuits."' },
        ],
        lose: [{ speaker: 'BRAD', text: '"That\'s it? I\'ve seen bigger gains, and I\'m down 94%."' }],
        reveal: { enemy: 'derek', weak: ['FLEX'] },
      },
    },
    {
      id: 'morgan',
      name: 'MOD MORGAN',
      sprite: 'field_morgan',
      x: 340,
      y: 1250,
      facing: 'right',
      talk: [
        { speaker: 'MORGAN', text: '"Halt. I moderate this swamp."' },
        { speaker: 'MORGAN', text: '"Nobody gets the inside scoop on Derek without passing the rules quiz."' },
      ],
      talkWon: [{ speaker: 'MORGAN', text: '"Stay on topic. I\'m watching you."' }],
      challenge: {
        kind: 'quiz',
        prompt: "MORGAN'S RULES QUIZ",
        accept: 'TAKE THE QUIZ',
        acceptSub: 'Three questions. No googling.',
        questions: [
          {
            q: 'Rule 1: the stock just dropped 40%. What do we do?',
            answers: ['Buy the dip', 'Sell everything', 'Read the earnings report'],
            right: [{ speaker: 'MORGAN', text: '"Correct. Logic is not welcome here."' }],
            wrong: [{ speaker: 'MORGAN', text: '"*BONK* Banned. Come back when you\'ve unlearned economics."' }],
          },
          {
            q: 'Rule 2: what counts as due diligence?',
            answers: ['A rocket emoji and a feeling', 'Researching the company', 'Asking a financial advisor'],
            right: [{ speaker: 'MORGAN', text: '"Correct. Research is FUD."' }],
            wrong: [{ speaker: 'MORGAN', text: '"*BONK* We don\'t do homework here. Banned."' }],
          },
          {
            q: 'Rule 3: when do we sell?',
            answers: ['We do not sell', 'When it hits our target', 'When rent is due'],
            right: [{ speaker: 'MORGAN', text: '"Correct. We hold until the heat death of the universe."' }],
            wrong: [{ speaker: 'MORGAN', text: '"*BONK* Paper hands detected. Banned."' }],
          },
        ],
        win: [
          { speaker: 'MORGAN', text: '"Perfect score. You think like a true ape. Disgusting. Welcome."' },
          { speaker: 'MORGAN', text: '"Don\'t bother roasting Derek; 40,000 commenters already tried. But question his RESEARCH and he melts."' },
        ],
        lose: [{ text: "Morgan's ban hammer is still ringing in your ears." }],
        reveal: { enemy: 'derek', resist: ['ROAST'], softSpots: ['ROAST>INTELLECT'] },
      },
    },
    {
      id: 'chad',
      name: 'CHAD',
      sprite: 'field_chad',
      x: 420,
      y: 560,
      facing: 'right',
      talk: [
        { speaker: 'CHAD', text: '"Sup. I\'m Derek\'s wife\'s boyfriend. I also run his 401(k)."' },
        { speaker: 'CHAD', text: '"Out-flex me and I\'ll tell you where it really hurts him."' },
      ],
      talkWon: [{ speaker: 'CHAD', text: '"Tell Derek I said hi. Actually, don\'t. He\'ll cry."' }],
      challenge: {
        kind: 'beat',
        prompt: 'CHAD THINKS HE HAS MORE DRIP',
        accept: 'BRING IT',
        acceptSub: 'Two flexes, both on beat.',
        title: 'OUT-FLEX CHAD',
        need: 'FIRE',
        rounds: 2,
        speed: 1.2,
        win: [
          { speaker: 'CHAD', text: '"Okay, okay. You\'ve got drip, bro."' },
          { speaker: 'CHAD', text: '"Real talk: Derek\'s broke. I pay his Wi-Fi. And he calls day trading a \'career.\' Hit him there."' },
        ],
        lose: [{ speaker: 'CHAD', text: '"Cute. Come back when your vest is paid off, bro."' }],
        reveal: { enemy: 'derek', softSpots: ['FLEX>WEALTH', 'WORDPLAY>CAREER'] },
      },
    },
  ],

  // y-sorted scenery. `block` is the footprint (centered on the feet) that $cott can't walk through.
  props: [
    { texture: 'prop_setup', x: 690, y: 400, block: { w: 170, h: 50 } },
    { texture: 'prop_tent', x: 360, y: 400, block: { w: 160, h: 60 } },
    { texture: 'prop_sign', x: 650, y: 1700, block: { w: 90, h: 16 }, label: 'r/APES' },
    { texture: 'prop_sign', x: 370, y: 760, block: { w: 90, h: 16 }, label: 'HODL ZONE' },
    { texture: 'prop_sign', x: 610, y: 610, block: { w: 90, h: 16 }, label: 'NO SELLING' },
    // Cypress trees and dead snags around the edges and between the pools.
    ...[
      [110, 260], [960, 250], [150, 700], [920, 980], [90, 1210], [990, 1560],
      [130, 1700], [870, 1820], [700, 1240], [330, 640], [820, 560], [250, 1350],
    ].map(([x, y], i) => ({ texture: i % 2 ? 'prop_cypress_b' : 'prop_cypress', x, y, block: { w: 64, h: 24 } })),
    ...[[420, 1600], [760, 1450], [190, 1020], [880, 360], [740, 690], [330, 1880]].map(([x, y], i) => ({
      texture: i % 2 ? 'prop_snag_b' : 'prop_snag', x, y, block: { w: 40, h: 18 },
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
