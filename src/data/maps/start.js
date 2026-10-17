// The Subreddit Swamps (CLAUDE.md §6.6): who's here and what they say and
// do, keyed by id. WHERE everything stands (and the ground itself) is in
// ./start.layout.js, which the map editor writes; systems/mapfile.js joins the
// two. An NPC or rope in the layout with nothing here still works, with
// stand-in lines.

export default {
  npcs: {
    derek: {
      name: 'DEREK',
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
    brad: {
      name: 'BAGHOLDER BRAD',
      unlocks: 'c_colorblind', // a classic post for $cott's social app (data/social.js), after his first talk
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
    morgan: {
      name: 'MOD MORGAN',
      unlocks: 'c_rules',
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
    chad: {
      name: 'CHAD',
      unlocks: 'c_lambo',
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

    // The Swamp Yacht Club: an island behind a velvet rope (`gates` below).
    // Vinny holds the rope; Wendy is the party inside.
    vinny: {
      name: 'VELVET VINNY',
      talk: [
        { speaker: 'VINNY', text: '"Swamp Yacht Club. Members and the extremely online only."' },
      ],
    },
    wendy: {
      name: 'WHALE WENDY',
      unlocks: 'c_yacht',
      talk: [
        { speaker: 'WENDY', text: '"Oh good, someone with Clout. Everyone else here is a frog."' },
        { speaker: 'WENDY', text: '"Welcome to the club, darling. The yacht is a pool float. Don\'t tell anyone. Here, for the road."' },
      ],
      talkAgain: [{ speaker: 'WENDY', text: '"Champagne? It\'s swamp water. Vintage."' }],
      gift: { cash: 750, items: { voicemail: 1 } }, // given once, after her first talk
    },
  },

  // Velvet ropes: $cott needs `clout` (social Clout, data/social.js) to get
  // past. The rope's footprint blocks the way until the bouncer lets him
  // through, then it stays open for good. The layout says where each rope is
  // and which NPC is its bouncer. {clout} and {need} fill in.
  gates: {
    vip: {
      name: 'SWAMP YACHT CLUB',
      clout: 500,
      deny: [
        { speaker: 'VINNY', text: '"{clout} Clout? Cute. The list says {need}."' },
        { speaker: 'VINNY', text: '"Go post something. Get famous. Then we\'ll talk."' },
      ],
      allow: [
        { speaker: 'VINNY', text: '"Wait. THE $cott Money? {clout} Clout?"' },
        { speaker: 'VINNY', text: '"My apologies, sir. Right this way."' },
      ],
      open: [{ speaker: 'VINNY', text: '"Enjoy the club, sir."' }],
    },
  },
};
