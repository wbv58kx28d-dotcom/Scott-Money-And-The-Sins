// Diamond Hands Derek — prologue villain, Subreddit Swamps (CLAUDE.md §4).
//
// Stats, weaknesses, soft spots, AI weights, and the Pump & Dump rule come
// from CLAUDE.md §4–5. Values marked RECONSTRUCTED (move powers, move
// type/targets, the heal) and every couplet were written while the legacy
// prototype was missing; reconcile them with legacy/scott-money-battle.html.

export default {
  id: 'derek',
  name: 'Diamond Hands Derek',
  short: 'DEREK',
  title: 'Meme-Stock Trader',
  type: 'HYPE',
  maxClout: 150,
  texture: 'derek',
  background: 'bg_tokyo', // the Subreddit Swamps background doesn't exist yet

  weak: ['FLEX'],
  resist: ['ROAST'],
  softSpots: [
    { type: 'FLEX', target: 'WEALTH', msg: 'Right in the brokerage account! Those diamond hands are shaking.' }, // crit
    { type: 'ROAST', target: 'INTELLECT', msg: 'The "I did my own research" armor cracks wide open.' }, // bypass
    { type: 'WORDPLAY', target: 'CAREER', msg: 'That one hit his night shift. Derek felt it.' }, // nerve
  ],
  messages: {
    weak: "Derek can't handle a FLEX. His bags feel heavier already.",
    resisted: 'Derek gets roasted by the internet daily. It barely stings.',
  },

  // Fires when Clout drops to `atCloutPct` of max or below (§4, §5.7).
  statusTriggers: [
    {
      status: 'shortSqueezed',
      atCloutPct: 0.4,
      msg: 'DEREK IS SHORT SQUEEZED! A cornered ape hits harder.',
    },
  ],

  // §5.9: rules are checked in order; if none fires, pick a move by weight.
  ai: {
    rules: [
      {
        move: 'pumpDump',
        chance: 0.3,
        when: { targetLacksStatus: 'rugPulled', targetFlowAtLeast: 15 },
      },
    ],
  },

  moves: [
    {
      id: 'lossPorn',
      name: 'Loss Porn',
      type: 'WORDPLAY',
      target: 'CAREER',
      power: 12, // RECONSTRUCTED
      weight: 30,
      bars: [
        'I lost two hundred K and I posted it with pride,',
        "You lost your whole empire, bro, and now you've got to hide.",
      ],
    },
    {
      id: 'dueDiligence',
      name: 'Due Diligence',
      type: 'ROAST',
      target: 'INTELLECT',
      power: 9, // RECONSTRUCTED
      weight: 20,
      bars: [
        'I did the due diligence on your so-called genius plan,',
        "It's a pitch deck and a vibe, bro — your brain's a ceiling fan.",
      ],
    },
    {
      id: 'apesStrong',
      name: 'Apes Together Strong',
      type: 'HYPE',
      heal: 15, // RECONSTRUCTED
      weight: 20,
      bars: [
        "Apes together strong, the whole swamp's got my back,",
        'One upvote at a time — watch my Clout come right back.',
      ],
    },
    {
      id: 'hairlineShort',
      name: 'Hairline Short',
      type: 'ROAST',
      target: 'LOOKS',
      power: 9, // RECONSTRUCTED
      weight: 15,
      bars: [
        "I'm shorting your hairline, it's been bearish for a decade,",
        'Your forehead has more runway than the startups that you made.',
      ],
    },
    {
      id: 'dripCheck',
      name: 'Drip Check',
      type: 'FLEX',
      target: 'STYLE',
      power: 13, // RECONSTRUCTED
      weight: 15,
      bars: [
        "That vest's a life jacket for a sinking finance bro,",
        'Your drip is a leaky faucet and the whole swamp saw it go.',
      ],
    },
    {
      id: 'tendieTower',
      name: 'Tendie Tower',
      type: 'FLEX',
      target: 'WEALTH',
      power: 16, // RECONSTRUCTED
      weight: 10,
      bars: [
        'My tendie tower is taller than your credit score,',
        "I'm eating gains for breakfast while you're begging at the door.",
      ],
    },
    {
      id: 'pumpDump',
      name: 'Pump & Dump',
      type: 'WORDPLAY',
      target: 'REP',
      power: 8, // RECONSTRUCTED
      weight: 0, // only used through the AI rule above
      applyStatus: 'rugPulled',
      bars: [
        'I pumped your little token, then I dumped it on the fans,',
        "Now your Flow is draining out — rug pulled, that's the plan.",
      ],
    },
  ],

  // $cott's couplets against Derek: scottBars[type][target] (CLAUDE.md §9).
  scottBars: {
    FLEX: {
      WEALTH: [
        'My net worth has a net worth, and my yacht has got a yacht,',
        'Your diamond hands are holding every bag that I forgot.',
      ],
      PHYSIQUE: [
        'I got a private trainer and a chef who preps my greens,',
        "You got carpal tunnel from refreshing ticker screens.",
      ],
      STYLE: [
        'My vest is bespoke merino, hand-stitched by the elite,',
        "You're in a stained hoodie and some Crocs with no heat.",
      ],
      STATUS: [
        'I got a blue check, a green room, and a seat at every table,',
        'You got a flair on a forum and a username that\'s unstable.',
      ],
    },
    ROAST: {
      LOOKS: [
        'Your face looks like a chart in a market correction,',
        'Red all over, sagging in every direction.',
      ],
      INTELLECT: [
        'You call it due diligence — it\'s a meme and a hunch,',
        'You ate the crayons, Derek, then you shorted your own lunch.',
      ],
      LIFESTYLE: [
        "You trade from mom's basement on her Wi-Fi and her dime,",
        "You're long on the future but you're short on rent every time.",
      ],
      FAMILY: [
        'Your mom put down her savings on your "can\'t-lose" play,',
        "Now Thanksgiving's just a margin call served up on a tray.",
      ],
    },
    WORDPLAY: {
      NAME: [
        'They call you Diamond Hands — I call you Cubic Zirconia,',
        "Fake from the start and you're losing to my persona.",
      ],
      CAREER: [
        'You list "full-time trader" but you stock shelves at night,',
        'The only bags you hold are paper ones — and that sounds right.',
      ],
      REP: [
        'Your rep\'s a penny stock that the market forgot,',
        'Even the bots in your replies just said "nah, I\'m not."',
      ],
    },
    // Drop the Mic (finisher, no type or target).
    MIC: [
      'Tell the apes to hold THIS: my name, my bag, my crown,',
      "The mic drops like your portfolio — and it ain't coming back around.",
    ],
  },

  script: {
    intro: [
      { text: 'The Subreddit Swamps. Something blocks the path, clutching a glowing rock.' },
      { speaker: 'DEREK', text: 'Well, well. The great $cott Money. Heard you got framed, bro. Clout at all-time lows.' },
      { speaker: '$COTT', text: "Framed? I'm a limited edition. Step aside, bagholder." },
      { speaker: 'DEREK', text: "Apes don't step aside. Apes HODL. Let's do this." },
    ],
    victory: [
      { speaker: 'DEREK', text: 'Paper... hands... I have... paper hands...' },
      { speaker: '$COTT', text: 'Hold that L, Derek. Hold it with both hands.' },
      { text: 'The swamp parts. The road to the Sins is open.' },
    ],
    defeat: [
      { speaker: 'DEREK', text: "Apes together strong. $cott together... alone." },
      { text: '$cott got cooked in the Subreddit Swamps.' },
    ],
  },

  // Pre-battle parley (CLAUDE.md §6.2). Open question for the prologue: skip it,
  // or a $cott-only tutorial version? Null means the fight starts directly.
  parley: null,
};
