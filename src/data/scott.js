// $cott Money: stats, moves, and his side of the weakness rules
// (CLAUDE.md §5.1–5.3). His bars against each villain live in that villain's
// file as `scottBars`, so every fight gets its own couplets.

export default {
  id: 'scott',
  name: '$cott Money',
  short: '$COTT',
  texture: 'scott',
  maxClout: 100,
  maxFlow: 60,

  // The rules apply both ways (§5.3).
  weak: ['ROAST'], // fragile ego
  resist: ['FLEX'], // you can't out-flex $cott
  softSpots: [
    { type: 'ROAST', target: 'LOOKS', msg: 'THE HAIRLINE. Nobody talks about the hairline.' }, // crit
    { type: 'FLEX', target: 'STYLE', msg: 'Not the vest! The vest was a gift from himself.' }, // bypass
  ],
  messages: {
    weak: "$cott's ego is load-bearing. ROASTs hit double.",
    resisted: '$cott yawns. You cannot out-flex $cott Money.',
  },

  // speed: the timing marker sweeps faster for higher numbers.
  moves: [
    { id: 'lambo', name: 'Lambo Lullaby', type: 'FLEX', cost: 8, power: 20, speed: 1.0 },
    { id: 'seriesA', name: 'Series A Slaughter', type: 'WORDPLAY', cost: 12, power: 23, speed: 1.25 },
    { id: 'capTable', name: 'Cap Table Clapback', type: 'ROAST', cost: 10, power: 22, speed: 1.1 },
    { id: 'mooning', name: 'Mooning', type: 'HYPE', cost: 15, applyStatus: 'mooning' },
    { id: 'dropMic', name: 'Drop the Mic', type: null, cost: 0, power: 45, speed: 1.4, finisher: true },
  ],

  items: ['coldBrew', 'voicemail'],

  lines: {
    mooning: [
      "Strap in, I'm going parabolic, check the candles on my chest,",
      "I don't moon — the moon checks in with me before it rests.",
    ],
    run: "$cott doesn't run. He pivots.",
    stall: '$cott checks his phone. Nobody texted. He regroups.',
    crowdFull: 'THE CROWD IS ON ITS FEET! DROP THE MIC is ready.',
  },
};
