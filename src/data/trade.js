// $cott's day-trading minigame (src/minigames/trade.js): a live price chart,
// one BUY / SELL button, and a closing bell. Price paths come from
// systems/market.js. A challenge can override any of the top-level values
// (ticker, seconds, cash, target, headlines) in its own data.

export const TRADE = {
  ticker: '$STONK',
  tickMs: 100, // one price tick; difficulty divides it (2 = twice as fast)
  seconds: 24, // opening bell to closing bell
  cash: 1000, // $cott's stake; every BUY goes all in
  open: 100, // opening share price
  target: 0.25, // finish up this much (25%) to pass

  // The price swings in legs, alternating up and down. `up`/`down` are the
  // size of a leg's move (0.2 = 20%). `noise` is a wobble laid over the trend.
  leg: { ticks: [30, 50], up: [0.2, 0.4], down: [0.15, 0.3] },
  noise: 0.012,
  // A news leg is short and sharp, and its headline shows `leadTicks` before
  // it moves: read the news and you can trade ahead of the crowd.
  news: { chance: 0.35, ticks: [12, 16], up: [0.18, 0.32], down: [0.16, 0.28], leadTicks: 6, min: 1, max: 3 },
  // Every market is checked before it's played: holding from open to close
  // must NOT reach the goal (diamond hands don't pay), while trading the
  // swings must clear it with room to spare. Tuned by simulation
  // (tools/market.test.mjs): reacting 0.7 s late to every turn still passes;
  // the top grades need sharper hands.
  fair: { holdMax: 0.5, swingMin: 2, floor: 0.35, tries: 200 },

  // Headlines for news legs. Parody only, never real people or companies.
  headlines: {
    up: [
      'CEO POSTS A ROCKET EMOJI',
      'COMPANY ADDS "AI" TO ITS NAME',
      'SHORT SQUEEZE RUMORS ON THE FORUMS',
      'APES ASSEMBLE. RALLY AT NOON.',
      'INFLUENCER: "NOT FINANCIAL ADVICE"',
      'CELEB WEARS THE MERCH',
    ],
    down: [
      'CEO QUIETLY SELLS 2M SHARES',
      'REGULATORS SEND A STERN LETTER',
      'EARNINGS CALL: "THE VIBES WERE OFF"',
      'HEDGE FUND DOUBLES ITS SHORT',
      'TRADING APP CRASHES MID-RALLY',
      'CFO SPOTTED BUYING A YACHT',
    ],
  },

  // Grades follow the minigame contract (CLAUDE.md §6.3). `gain` is a
  // multiple of the target: 1 = hit the goal exactly.
  grades: [
    { id: 'legendary', gain: 4, label: 'TO THE MOON!', color: '#ffd166', sfx: 'good' },
    { id: 'great', gain: 2, label: 'TENDIES!', color: '#7cf29c', sfx: 'good' },
    { id: 'pass', gain: 1, label: 'PROFIT!', color: '#7cf29c', sfx: 'good' },
    { id: 'fail', gain: -Infinity, label: 'PAPER LOSSES', color: '#ff6b6b', sfx: 'bad' },
  ],
};
