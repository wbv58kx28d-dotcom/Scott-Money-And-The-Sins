// Battle items (CLAUDE.md §5.8). `perFight` is how many $cott starts each
// fight with. Using an item takes his turn.

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
    restore: { clout: 35 },
    desc: '+35 Clout. "Bro. You\'re HIM."',
    line: '$cott replays a voicemail from his hype man:\n"Bro. You\'re HIM. You\'re literally HIM."\n+35 Clout',
    emptyMsg: 'No voicemails left. The hype man is busy.',
  },
};
