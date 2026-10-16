// Diamond Hands Derek — prologue villain, Subreddit Swamps (CLAUDE.md §4).
// Every number and line here comes from legacy/scott-money-battle.html.
//
// Bars are pools: each entry is a list of couplets, and one is picked at
// random each time. Add a couplet to a list to give it more variety.
// Rhymes are bolded in the speech bubble: the last word of each line by
// default, or [bracketed] words if a couplet has any (see systems/bars.js).

export default {
  id: 'derek',
  name: 'DIAMOND HANDS DEREK',
  short: 'DEREK',
  type: 'HYPE',
  maxEgo: 150,
  texture: 'derek',
  background: 'bg_tokyo', // the Subreddit Swamps background doesn't exist yet
  stage: 'THE SUBREDDIT SWAMPS',

  weak: ['FLEX'],
  resist: ['ROAST'],
  softSpots: [
    { type: 'FLEX', target: 'WEALTH', msg: "He's broke, and now the whole crowd knows it." }, // crit
    { type: 'ROAST', target: 'INTELLECT', msg: 'He can lose money. He cannot lose an argument about money.' }, // bypass
    { type: 'WORDPLAY', target: 'CAREER', msg: '"Day trader" is not a job, and deep down he knows it.' }, // nerve
  ],
  resistMsg: { ROAST: 'Derek has no shame left to lose.\nNot very effective.' },

  // Fires when Ego drops to `atEgoPct` of max or below (§4, §5.7).
  statusTriggers: [
    {
      status: 'shortSqueezed',
      atEgoPct: 0.4,
      msg: "Derek is getting SHORT SQUEEZED!\nHe has never felt more alive. Derek's damage is UP!",
    },
  ],

  // §5.9: rules are checked in order; if none fires, pick a move by weight.
  ai: {
    rules: [
      {
        move: 'pump',
        chance: 0.3,
        when: { targetLacksStatus: 'rugPulled', targetFlowAtLeast: 15 },
      },
    ],
  },

  moves: [
    {
      id: 'loss', name: 'LOSS PORN', type: 'ROAST', target: 'LIFESTYLE', power: 13, weight: 30,
      bars: [["You're down bad, Money, and I know down bad.", "I'm the CEO of down bad. Inherited it from my dad."]],
    },
    {
      id: 'hair', name: 'HAIRLINE SHORT', type: 'ROAST', target: 'LOOKS', power: 10, weight: 15,
      bars: [["Your hairline's in a bear market, it's been retreating all year.", "I'd short it, Money, but it's already outta here."]],
    },
    {
      id: 'dd', name: 'DUE DILIGENCE', type: 'WORDPLAY', target: 'CAREER', power: 14, weight: 20,
      bars: [["They found your laptop, Money. They found your little scheme.", "You're the only founder whose cap table is a crime scene."]],
    },
    {
      id: 'apes', name: 'APES TOGETHER STRONG', type: 'WORDPLAY', target: 'REP', power: 14, weight: 20,
      bars: [
        ["Apes together strong, but you? You're alone.", 'Your whole crew left the group chat. Even Greed blocked your phone.'],
        ['I got ten million apes. You got ten million in debt.', 'I hold the line. You hold a press conference of regret.'],
      ],
    },
    {
      id: 'drip', name: 'DRIP CHECK', type: 'FLEX', target: 'STYLE', power: 14, weight: 15,
      bars: [['Patagonia vest on a button-down? Groundbreaking.', 'You dress like a LinkedIn post about networking.']],
    },
    {
      id: 'tendie', name: 'TENDIE TOWER', type: 'FLEX', target: 'WEALTH', power: 16, weight: 10,
      bars: [["Stimmy check stacked, YOLO'd every cent on calls!", "I'm flexin' on you, Money. Wait, why's it not working at all?"]],
    },
    {
      id: 'pump', name: 'PUMP & DUMP', type: 'HYPE', target: null, power: 7, weight: 0, // only via the AI rule
      applyStatus: 'rugPulled',
      bars: [["I'll pump you to the moon, then I dump you on your head.", "Not financial advice, but your Flow is lookin' red."]],
    },
  ],

  // $cott's couplets against Derek: scottBars[type][target] (CLAUDE.md §9).
  scottBars: {
    FLEX: {
      WEALTH: [
        ["My watch costs more than your portfolio's [peak],", "and your portfolio's [peak] was a Tuesday last [week]."],
        ["I tip my valet in equity, my barista's on the board.", "You tip in Dogecoin. That's the most you can afford."],
      ],
      PHYSIQUE: [["I got abs on my abs and a cold plunge on the yacht.", "Your only cardio's running from the margin calls you got."]],
      STYLE: [['My vest costs more than your four-monitor setup.', 'You wear a hoodie with a rocket on it. Grow up.']],
      STATUS: [['I keynote in Davos, got a TED Talk in the can.', "You're famous on a forum where your username's banned."]],
    },
    ROAST: {
      LOOKS: [['You look like an energy drink that learned how to type.', "Your skin's been in a downtrend since you first bought the hype."]],
      INTELLECT: [
        ['Your due diligence is a meme and a gut feeling.', 'You read candlestick charts like tea leaves on the ceiling.'],
        ['You think a P/E ratio is something from gym class.', "Your whole investing thesis is 'trust me, it'll pass.'"],
      ],
      LIFESTYLE: [['Gaming chair, energy drink, four monitors, no job.', "You're not a trader, Derek. You're a Discord mod."]],
      FAMILY: [['You call it diamond hands. I call it a cry for help.', "Your wife's boyfriend runs your 401(k) himself."]],
    },
    WORDPLAY: {
      NAME: [['Diamond Hands Derek? More like Paper Wallet Pete.', "Your name's got more letters than your wins this week."]],
      CAREER: [
        ['I close a Series A while you close a position.', 'I raise capital. You raise suspicion.'],
        ["You call yourself a day trader. That's not a career.", "That's a gambling problem with a Wi-Fi bill and a chair."],
      ],
      REP: [['You buy high, sell low, and call it a strategy.', "I call it charity, and Derek, you're the charity."]],
    },
  },
  micBars: [["This is the part where the founder gets the final say:", "you're a ticker symbol, Derek, and I just delisted you today."]],

  script: {
    // Each line is { text, speaker? }; a speaker shows as a name tab.
    intro: [
      { text: 'DIAMOND HANDS DEREK blocks the path!' },
      { speaker: 'DEREK', text: '"Your stock\'s crashin\', Money.\nI\'m BUYING THE DIP."' },
      { text: 'Every rival has weaknesses and soft spots.\nTap ? up top for the cheat sheet.' },
    ],
    victory: [
      { text: 'DIAMOND HANDS DEREK got DELISTED!' },
      { speaker: 'DEREK', text: '"I... I still like the stock."\n*logs off to touch grass*' },
    ],
    defeat: [{ text: "$COTT MONEY got RATIO'D.\nHis Clout is now worth less than a meme coin." }],
  },

  // A win's payout (data/phone.js economy): the first clear pays `cash`, rematches `rematch`.
  // Social Clout too (data/social.js): `clout` for the first clear (which $cott posts
  // about), `cloutRematch` after that.
  reward: { cash: 1000, rematch: 150, clout: 250, cloutRematch: 25 },

  // End-of-fight screen. {soft} = soft spots found, {softTotal} = how many
  // exist, {cash} = what the win paid, {clout} = the Clout it earned.
  endScreen: {
    victory: {
      title: 'DELISTED!',
      body: "+{clout} Clout\n+{cash} cash\n+1 Derek's gaming chair (useless)\nSoft spots found: {soft}/{softTotal}\n\n$cott's first step back to the top.\nNext stop: the overworld map.",
    },
    defeat: {
      title: "RATIO'D",
      body: "$cott's Ego hit zero.\n\nDerek is weak to FLEX, and some targets hurt him way more than others. Experiment.",
    },
  },

  // Pre-battle parley (CLAUDE.md §6.2). Open question for the prologue: skip it,
  // or a $cott-only tutorial version? Null means the fight starts directly.
  parley: null,
};
