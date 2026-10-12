// Battle items (CLAUDE.md §5.8). `perFight` is how many $cott starts each
// fight with. Using an item takes his turn.

export const ITEMS = {
  coldBrew: {
    id: 'coldBrew',
    name: 'Cold Brew',
    short: 'COLD BREW', // HUD label
    perFight: 2,
    restore: { flow: 30 },
    line: '$cott slams a Cold Brew. Single-origin. Triple-shot. Flow restored.',
  },
  voicemail: {
    id: 'voicemail',
    name: 'Hype Man Voicemail',
    short: 'VOICEMAIL',
    perFight: 1,
    restore: { clout: 35 },
    line: '"Yo, it\'s your hype man. You\'re literally him. Call me back." Clout restored.',
  },
};
