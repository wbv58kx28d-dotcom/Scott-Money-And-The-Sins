// Battle items (CLAUDE.md §5.8). `perFight` is how many $cott starts each
// fight with. Using an item takes his turn.

/** What's in the bag, for a HUD line: "BREW x2  VOICEMAIL x1". */
export const bagLine = (counts) => Object.entries(counts).map(([id, n]) => `${ITEMS[id].short} x${n}`).join('  ');

export const ITEMS = {
  coldBrew: {
    id: 'coldBrew',
    name: 'Cold Brew',
    short: 'BREW', // HUD and menu label
    color: '#4cc9f0',
    perFight: 2,
    restore: { flow: 30 },
    desc: '+30 Flow. Tastes like ambition.',
    line: '$cott slams a Cold Brew. Single origin. Ethically sourced. Probably.\n+30 Flow',
    emptyMsg: 'Out of Cold Brew.',
  },
  voicemail: {
    id: 'voicemail',
    name: 'Hype Man Voicemail',
    short: 'VOICEMAIL',
    color: '#3ddc84',
    perFight: 1,
    restore: { ego: 35 },
    desc: '+35 Ego. "Bro. You\'re HIM."',
    line: '$cott replays a voicemail from his hype man:\n"Bro. You\'re HIM. You\'re literally HIM."\n+35 Ego',
    emptyMsg: 'No voicemails left. The hype man is busy.',
  },
};
