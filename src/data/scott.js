// $cott Money: stats, moves, and his side of the weakness rules
// (CLAUDE.md §5.1–5.3). His bars against each villain live in that villain's
// file as `scottBars`, so every fight gets its own couplets.

export default {
  id: 'scott',
  name: '$COTT MONEY',
  short: '$COTT',
  texture: 'scott',
  maxEgo: 100,
  maxFlow: 60,

  // The rules apply both ways (§5.3).
  weak: ['ROAST'], // fragile ego
  resist: ['FLEX'], // you can't out-flex $cott
  softSpots: [
    { type: 'ROAST', target: 'LOOKS', msg: 'Nobody is allowed to talk about the hairline.' }, // crit
    { type: 'FLEX', target: 'STYLE', msg: 'The vest was supposed to be his whole personality.' }, // bypass
  ],
  resistMsg: { FLEX: "You can't out-flex $cott Money.\nNot very effective." },

  // speed: the timing marker sweeps faster for higher numbers.
  moves: [
    { id: 'lambo', name: 'LAMBO LULLABY', type: 'FLEX', cost: 8, power: 20, speed: 1.0 },
    { id: 'seriesA', name: 'SERIES A SLAUGHTER', type: 'WORDPLAY', cost: 12, power: 23, speed: 1.25 },
    { id: 'capTable', name: 'CAP TABLE CLAPBACK', type: 'ROAST', cost: 10, power: 22, speed: 1.1 },
    {
      id: 'mooning',
      name: 'MOONING',
      type: 'HYPE',
      cost: 15,
      applyStatus: 'mooning',
      bars: [
        ['*puts on a second pair of sunglasses*', '"I don\'t need the crowd. The crowd needs a narrative."'],
        ['*announces a token that does not exist*', '"Number go up. That\'s the whole whitepaper."'],
      ],
    },
  ],
  // The finisher, offered from the main menu once the crowd is full.
  micDrop: { id: 'mic', name: 'DROP THE MIC', type: null, cost: 0, power: 45, speed: 1.4, finisher: true },

  items: ['coldBrew', 'voicemail'],

  lines: {
    run: "$cott Money doesn't run. He PIVOTS.\n...There's nowhere to pivot to.",
    stall: '$cott checks his phone. Nobody texted. He regroups.',
    micDropped: "The crowd loses it. $cott drops the mic.\nHe'll expense a new one.",
    noFlow: 'Not enough Flow. Grab a Cold Brew from the bag.',
    micNotReady: "The crowd isn't hyped enough yet. Land some clean bars.",
  },
};
