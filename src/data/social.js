// $cott's social app (CLAUDE.md §6.10): a parody of the bird site, on his
// phone. NPCs post to it as the story moves (and @ him), and $cott posts to
// it to win back his Clout, the meter that opens velvet ropes around the
// world (map data `gates`). Clout only ever goes up.
//
// Everything here is data: the accounts, the feed, $cott's drafts and his
// classic posts, and the numbers. Lines are placeholders until the writing
// chat sends real ones. Logic lives in systems/social.js; the app is
// scenes/SocialScene.js and posting is minigames/post.js.

export const APP = {
  name: 'Y',
  tagline: 'the everything app (formerly Chirper)',
};

// Who posts. `sheet` is a field walker sheet (data/assets.js): the avatar is
// its idle head. Without one, the avatar is the initial on `color`.
export const ACCOUNTS = {
  scott: { name: '$COTT MONEY', handle: '@scottmoney', sheet: 'field_scott', verified: true },
  derek: { name: 'DIAMOND HANDS DEREK', handle: '@DiamondHandsDerek', sheet: 'field_derek' },
  brad: { name: 'BAGHOLDER BRAD', handle: '@bradholds', sheet: 'field_brad' },
  morgan: { name: 'MOD MORGAN', handle: '@mod_morgan', sheet: 'field_morgan', verified: true },
  chad: { name: 'CHAD', handle: '@chad', sheet: 'field_chad' },
  vinny: { name: 'VELVET VINNY', handle: '@bluecheckbouncer', sheet: 'field_vinny', verified: true },
  wendy: { name: 'WHALE WENDY', handle: '@whalewatching', sheet: 'field_wendy', verified: true },
  floyd: { name: 'FLOATIE FLOYD', handle: '@hottubfloyd', sheet: 'field_floyd' },
  lola: { name: 'LOSS PORN LOLA', handle: '@redcandlelola', sheet: 'field_lola' },
  bob: { name: 'BOT ACCOUNT BOB', handle: '@totally_human_bob', sheet: 'field_bob' },
  helena: { name: 'HEDGE FUND HELENA', handle: '@velocitycap', sheet: 'field_helena', verified: true },
  news: { name: 'OVERWORLD NEWS', handle: '@overworldnews', color: 0x1f6feb, verified: true },
  guru: { name: 'GRINDSET GURU', handle: '@330am', color: 0xff8c42 },
  lilturnt: { name: "LIL' TURNT", handle: '@lilturnt', color: 0xf08a3c },
  babarbara: { name: 'BABARBARA', handle: '@babarbara', color: 0xd94f70 },
};

// Clout and posting.
export const SOCIAL = {
  startClout: 0,
  postsPerFight: 3, // posts refill after every fight, like Stonks trades
  drafts: 3, // drafts offered per post (a classic, once unlocked, is always one of them)
  trending: 3, // hashtags trending at a time
  trendMult: 2, // a draft on a trending hashtag
  classicMult: 2, // a classic never goes out of style
  // When to post: a curve of how many followers are online sweeps by, and
  // $cott taps POST. The share of the peak at that moment sets the rating.
  timing: {
    sweepMs: 2200, // one pass across the day
    ratings: [
      { id: 'PERFECT', min: 0.9, mult: 2, label: 'PRIME TIME' },
      { id: 'FIRE', min: 0.7, mult: 1.5, label: 'GOOD HOUR' },
      { id: 'MID', min: 0.45, mult: 1, label: 'SLOW HOUR' },
      { id: 'WACK', min: 0, mult: 0.25, label: 'EVERYONE WAS ASLEEP' },
    ],
  },
  // A post's grade, by its total multiplier (trend × timing).
  grades: [
    { id: 'legendary', mult: 4, label: 'WENT VIRAL' },
    { id: 'great', mult: 2, label: 'TRENDING' },
    { id: 'pass', mult: 1, label: 'POSTED' },
    { id: 'fail', mult: 0, label: "RATIO'D" },
  ],
  // Replying to an NPC's post: the right reply, or any other one.
  reply: { right: 60, wrong: 5 },
  // Big moments post themselves.
  moments: {
    stonks: { great: 40, legendary: 80 }, // by the trade's grade
    realty: { pass: 50, great: 100, legendary: 200 }, // the first time per city and grade
  },
};

export const TRENDS = ['CRYPTO', 'GRINDSET', 'AI', 'DRIP', 'GYM', 'REALESTATE', 'BEEF', 'STONKS', 'WELLNESS'];

// $cott's everyday drafts: `tag` is its hashtag, `base` the Clout before multipliers.
export const DRAFTS = [
  { id: 'd_dip', tag: 'CRYPTO', base: 40, text: "If you're not buying the dip, you ARE the dip." },
  { id: 'd_seed', tag: 'CRYPTO', base: 35, text: "My seed phrase is my mantra. I won't say it out loud. But I think it a lot." },
  { id: 'd_sleep', tag: 'GRINDSET', base: 45, text: 'Sleep is a subscription I cancelled in 2019.' },
  { id: 'd_24h', tag: 'GRINDSET', base: 50, text: 'You had the same 24 hours as me. I just expensed mine.' },
  { id: 'd_therapist', tag: 'AI', base: 45, text: 'Replaced my therapist with a chatbot that agrees with me. Healing.' },
  { id: 'd_memoir', tag: 'AI', base: 40, text: "Asked an AI to write my memoir. It said 'insufficient humility data.'" },
  { id: 'd_vest', tag: 'DRIP', base: 45, text: 'This vest has seen more funding rounds than your startup.' },
  { id: 'd_shades', tag: 'DRIP', base: 40, text: 'Shades indoors because the future is that bright. Also a hangover.' },
  { id: 'd_legday', tag: 'GYM', base: 35, text: 'Leg day? I outsource leg day.' },
  { id: 'd_bench', tag: 'GYM', base: 45, text: "Bench my net worth? Bro, they don't make a bar that long." },
  { id: 'd_rent', tag: 'REALESTATE', base: 45, text: "Renting is paying someone else's mortgage. That's why I'm someone else." },
  { id: 'd_flip', tag: 'REALESTATE', base: 40, text: "Bought a house to flip. Flipped it. It's upside down now. Still counts." },
  { id: 'd_diss', tag: 'BEEF', base: 50, text: "Some of y'all are about to get a diss track and don't even know it yet." },
  { id: 'd_unfollow', tag: 'BEEF', base: 40, text: 'Unfollowed everyone who doubted me. Following: 3.' },
  { id: 'd_top', tag: 'STONKS', base: 45, text: "Sold the top. Again. It's exhausting being right." },
  { id: 'd_advisor', tag: 'STONKS', base: 40, text: "My financial advisor quit. Said he couldn't keep up." },
  { id: 'd_plunge', tag: 'WELLNESS', base: 40, text: 'Cold plunge. Hot take. Warm wallet.' },
  { id: 'd_meditate', tag: 'WELLNESS', base: 40, text: 'Meditated for 10 minutes. Thought about money for 9.' },
];

// $cott's classic posts. Talking to someone in the world can unlock one (map
// data `unlocks`); it waits in his drafts until he posts it, once.
// PLACEHOLDERS: these become real posts from $cott's actual account.
export const CLASSICS = [
  { id: 'c_colorblind', base: 150, text: "Your portfolio is red because your mindset is red. I'm colorblind to losses. Literally. I've been tested." },
  { id: 'c_lambo', base: 150, text: 'Bought a fourth Lambo. Not because I needed it. Because the third one looked at me wrong.' },
  { id: 'c_rules', base: 150, text: "Rules are just suggestions written by people who weren't invited to the meeting." },
  { id: 'c_yacht', base: 200, text: 'Rented a yacht to think about buying a bigger yacht. Self-care is a hustle.' },
];

// The feed. Posts show once their `when` holds (every key must): `cleared`
// region, `won` challenge (`<region>:<npc>`), `met` NPC (`<region>:<npc>`),
// `gate` opened (`<region>:<gate>`), or `clout` at least. No `when` = from the start.
// `reply`: the FIRST option is right (shown shuffled); `right` / `wrong` is
// how the poster answers.
// Placeholder lines until the writing chat sends real ones.
export const FEED = [
  {
    id: 'news_tower', by: 'news', likes: 88000,
    text: 'BREAKING: The Fulfillment Citadel now offers same-day delivery of your hopes and dreams. Returns not accepted.',
  },
  {
    id: 'brad_day', by: 'brad', likes: 312,
    text: 'Day 1,204 of holding. Arms numb. Spirit strong. Portfolio: also numb.',
    reply: {
      options: [
        "Selling isn't weakness, Brad. It's called profit. Look it up.",
        'Hold forever, brother.',
        'Cool story.',
      ],
      right: 'Profit?? Like... the opposite of what I do?',
      wrong: 'Thanks bro. Day 1,205 here I come.',
    },
  },
  {
    id: 'morgan_rules', by: 'morgan', likes: 1900,
    text: 'REMINDER: posts about "selling", "research" or "math" will be removed. This swamp is a safe space.',
    reply: {
      options: [
        "Rule 4: we don't do math. We do vibes.",
        'Have you considered reading a balance sheet?',
        'first',
      ],
      right: 'Approved. Pinned. Do not let it go to your head.',
      wrong: '*BONK* Removed.',
    },
  },
  {
    id: 'guru_330', by: 'guru', likes: 51000,
    text: 'Woke up at 3:30am. Ice bath. Journaled. Bought a course on waking up at 3:30am.',
  },
  {
    id: 'derek_swamp', by: 'derek', likes: 4200,
    text: 'Some washed-up "visionary" named @scottmoney is wading through MY swamp. Down 98% and still holding. Who\'s the visionary now? #HODL',
    reply: {
      options: [
        "Holding a 98% loss isn't vision, Derek. It's a hostage situation.",
        'Respect the grind, king.',
        'Who?',
      ],
      right: 'Deleting this. Not because you\'re right. Because Chad\'s Wi-Fi is acting up.',
      wrong: 'Lmao even $cott agrees. #HODL',
    },
  },
  {
    id: 'chad_wifi', by: 'chad', likes: 777, when: { met: 'start:chad' },
    text: 'Paying for Derek\'s Wi-Fi so he can post about being rich. Generational wealth looks different for everyone.',
    reply: {
      options: [
        "Chad, you're the only one in this swamp with positive cash flow.",
        'Free Derek.',
        "Who's Derek?",
      ],
      right: 'Real recognize real. Followed.',
      wrong: 'Bro what.',
    },
  },
  {
    id: 'derek_opsec', by: 'derek', likes: 3100,
    text: 'Nobody will ever find my battle station. Undisclosed location. Military-grade router. #OPSEC #HODL',
    reply: {
      options: ["Bold of a man named 'DiamondHands' to name his Wi-Fi after himself.", 'Respect the privacy, king.', 'Where is it though?'],
      right: '...how do you know what my Wi-Fi is called',
      wrong: "Exactly. You'll never know. Never.",
    },
  },
  {
    id: 'lola_loss', by: 'lola', likes: 5800, when: { met: 'start:lola' },
    text: 'Down 87% today. Hot tub is 104°. Both of these numbers are my personality now. #LOSSPORN',
    reply: {
      options: ["That's not a loss, Lola. That's content.", 'Have you tried not doing that?', 'F'],
      right: 'Finally someone who gets it. Pinning this.',
      wrong: 'Muted.',
    },
  },
  {
    id: 'helena_desk', by: 'helena', likes: 41000, when: { gate: 'start:office' },
    text: 'Velocity Capital is taking meetings. Proof of skill required. Proof of Clout is just the lobby.',
  },
  {
    id: 'vinny_rope', by: 'vinny', likes: 640, when: { met: 'start:vinny' },
    text: 'The rope at the Swamp Yacht Club stays UP until you have the Clout. No exceptions. Not even for "founders."',
  },
  {
    id: 'brad_sold', by: 'brad', likes: 2400, when: { won: 'start:brad' },
    text: 'UPDATE: I SOLD ONE (1) SHARE. I feel like a new man. A slightly less poor man. Thank you @scottmoney',
    reply: {
      options: ['Proud of you, Brad. Baby steps. Baby profits.', 'Paper hands.', 'Should have sold them all.'],
      right: '*crying in a cypress tree*',
      wrong: 'Oh. Ok. *buys it back*',
    },
  },
  {
    id: 'wendy_party', by: 'wendy', likes: 23000, when: { gate: 'start:vip' },
    text: 'Hosting the most exclusive yacht party in the swamp. The yacht is a pool float. The vibes are priceless. #WAGMI',
    reply: {
      options: ['A pool float is just a yacht that believes in itself.', 'Is this a scam?', 'Can I bring Brad?'],
      right: 'Write that on my tombstone. Gold leaf.',
      wrong: 'Security?',
    },
  },
  {
    id: 'derek_break', by: 'derek', likes: 9100, when: { cleared: 'start' },
    text: 'Taking a break from posting to focus on my mental health and my 401(k), which Chad is handling.',
    reply: {
      options: ["Logging off is the first green candle you've had all year.", 'L', 'Ratio.'],
      right: '...that\'s actually nice? I hate it.',
      wrong: 'Blocked.',
    },
  },
  {
    id: 'lilturnt_cats', by: 'lilturnt', likes: 340000, when: { cleared: 'start' },
    text: "everyone's cat is ugly except me. that's it. that's the post. #InfluencerIsles",
  },
  {
    id: 'babarbara_ratio', by: 'babarbara', likes: 66000, when: { cleared: 'start' },
    text: 'MOUNT RATIO. COME UP HERE AND SAY IT TO MY FACE.',
  },
];

// What $cott posts on his own after a big moment. {enemy}, {pct}, {ticker}, {city} fill in.
export const MOMENTS = {
  fight: "{enemy} just got DELISTED. In his own house. The comeback is not a phase. #REDEMPTIONARC",
  stonks: "{pct} on {ticker} before lunch. Diamond hands are for people who can't read charts. #STONKS",
  realty: 'Just bought the tallest tower in {city}. Cash. Landlord era. #REALESTATE',
};

// Replies under $cott's own posts, by timing rating (cosmetic).
export const REACTIONS = {
  PERFECT: ['this is the most important post of the decade', 'framing this', 'SIR', 'he is so back'],
  FIRE: ['W', 'real', 'lowkey genius', 'bookmarked'],
  MID: ['ok', 'mid', 'seen it', 'k'],
  WACK: ['ratio', 'who asked', 'posted at 4am lmao', '3 likes and one is your mom'],
};
export const FANS = ['@apestrong', '@moonboi', '@hodlqueen', '@gm_gn', '@wagmi_wendell', '@bagz', '@ser_pls', '@exitliquidity'];
