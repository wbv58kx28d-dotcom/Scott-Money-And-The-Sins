// Sins who walk behind $cott in the regions, Pikachu-in-Pokémon-Yellow style
// (CLAUDE.md §6.6, systems/follower.js). One follows at a time: the first
// recruited Sin listed here, or Lil' Turnt while SETTINGS' test toggle is on.
//
// Talk to her (tap her, or press TALK with nobody else around) and she says
// one line: her intro the first time, then about whoever's standing nearby
// (`near`, keyed by NPC id), the map she's on (`maps`), or her mood. Her
// mood is jealousy: +1 each time $cott talks to someone else, back to 0 when
// he talks to her. Each mood has an emote that pops over her head, both when
// she talks and when she notices him talking to someone else.
// Emotes: heart, note, dots, anger, bang (ui/emote.js).
//
// Barks: walking past someone or something in `barks` (NPCs by id, props by
// texture, ropes by id, doors by the map they lead to), she sometimes says one
// line in a bubble over her head, without stopping play. Each one counts once
// each time $cott walks up to it, then only `chance` of the time, at least
// `cooldownMs` after her last bark, and not about the same thing for `againMs`.
// `range` is how close he has to come (px); an entry can be { range, lines } to
// set its own. Keep bark lines short: the bubble wraps at about 25 letters.
//
// Placeholder lines until the writing chat sends real ones.

export const FOLLOWERS = {
  lilturnt: {
    sprite: 'field_lilturnt',
    speaker: "LIL' TURNT",
    gap: 70, // px of $cott's trail she walks behind
    head: 70, // px from her feet to the top of her ears (her emotes float just above)
    // Standing still this long, she pops one of these on her own.
    idle: { afterMs: 9000, emotes: ['dots', 'note', 'heart'] },
    intro: [
      { speaker: "LIL' TURNT", text: '"Oh, you\'re $cott Money? Cute. I\'m Lil\' Turnt, and I\'m the main character now."' },
      { speaker: "LIL' TURNT", text: '"I\'ll walk behind you. Not because I\'m following you. Because I\'m supervising."' },
    ],
    moods: [
      { id: 'smitten', at: 0, emote: 'heart', lines: [
        { text: '"*purrs* You\'re only allowed to look at me. Good boy."' },
        { text: '"Pearls on. Tutu on. Ego: purring."' },
        { text: '"Fun fact: cats are better than you. But you\'re the best of the humans, so."' },
      ] },
      { id: 'sideeye', at: 1, emote: 'dots', lines: [
        { text: '"Who was that? No, it\'s fine. I didn\'t want to know. Who was that?"' },
        { text: '"*side-eye* You laughed at their joke. I heard you."' },
        { text: '"I\'m not jealous. I\'m a cat. Cats are above jealousy. *tail lashes*"' },
      ] },
      { id: 'jealous', at: 3, emote: 'anger', lines: [
        { text: '"You talk to EVERYONE. Do they have pearls? Do they have a TUTU?"' },
        { text: '"I\'m keeping a list. You\'re on it. They\'re on it. Everyone\'s on it."' },
        { text: '"*knocks your phone off a log* Oops."' },
      ] },
      { id: 'fuming', at: 5, emote: 'anger', lines: [
        { text: '"I am going to sit on your keyboard for SIX HOURS."' },
        { text: '"*hisses at the general concept of other people*"' },
        { text: '"Every NPC you talk to, I\'m getting a new necklace. Put it on your tab."' },
      ] },
    ],
    // On a map, keyed by map id.
    maps: {
      start: [
        { text: '"This swamp smells like wet dog and bad trades. Carry me."' },
        { text: '"If a single bubble pops on my tutu, I\'m filing a complaint with the subreddit."' },
      ],
      start_office: [
        { text: '"Ooh, a desk with three monitors. That\'s mine. I\'m lying on the keyboard."' },
        { text: '"Finance bros. Ew. Their cats have better portfolios."' },
      ],
      start_lair: [
        { text: '"Server racks are basically heated beds. Derek, I accept."' },
        { text: '"This basement has big \'I\'ve never been loved by a cat\' energy."' },
      ],
    },
    // Someone standing near $cott, keyed by NPC id.
    near: {
      wendy: [{ text: '"Her lounge chair is nicer than mine. I don\'t have a lounge chair. I want THAT one."' }],
      helena: [{ text: '"Hedge fund? I\'ll hedge YOUR fund. *flexes claws*"' }],
      lola: [{ text: '"She posts her losses for attention. I post NOTHING and get MORE attention."' }],
      floyd: [{ text: '"A floatie. Unserious. I respect it a little."' }],
      morgan: [{ text: '"A mod? I don\'t follow rules. I follow YOU. For now."' }],
      chad: [{ text: '"Chad. Of course his name is Chad."' }],
      derek: [{ text: '"His hands are DIAMONDS? Mine are paws and I\'m still richer in spirit."' }],
      doorman: [{ text: '"The list? Darling, I AM the list."' }],
    },
    barks: {
      chance: 0.5,
      cooldownMs: 9000,
      againMs: 60000,
      range: 200,
      npcs: {
        brad: ['Still holding, Brad? Bless.', 'Sell. SELL. Ugh.'],
        morgan: ['A mod. Ew. Rules.', "Don't let her ban me."],
        chad: ['Chad. Of course.', "Who's Chad? Who cares?"],
        floyd: ['That floatie is a lifestyle.', 'He owes the hot tub rent.'],
        lola: ['Couldn\'t be me. Posting losses.', 'Her losses get more likes than me. RUDE.'],
        bob: ["That one's a bot. I can smell it.", 'Beep boop. Loser.'],
        doorman: ["I'm with him. Ugh. WITH him.", 'Professionals only? So, me.'],
        vinny: ['Velvet rope? I AM the velvet rope.'],
        wendy: ['Her chair. I want her chair.', 'A whale? I eat fish. Just saying.'],
        helena: ['Corner office. Mine now.', "Don't look at her. Look at me."],
        quentin: ['He does math. For fun. Gross.'],
        bart: ['He yells more than I do. Respect.'],
        derek: ['He smells like energy drink and fear.', 'Diamond hands? I have diamond CLAWS.'],
      },
      props: {
        prop_hottub: { range: 260, lines: ['Hot tub? Cats don\'t do water.', 'Everyone in there is a bagholder.'] },
        prop_tower: { range: 300, lines: ['Glass tower. Finally, my aesthetic.', 'That\'s where the money lives.'] },
        prop_tarp: ['That tarp is hiding something.', 'Something smells like basement.'],
        prop_house: { range: 260, lines: ['Who lives HERE? Gross.', 'This house needs a cat. Badly.'] },
        prop_lounge: ['Dibs on the lounge chair.'],
        prop_rack: ['Warm servers. Nap spot acquired.', 'Blinky lights. Must. Swat.'],
        prop_battlestation: ['Three monitors. I\'m lying on all of them.'],
        prop_fridge: ['Energy drinks. No tuna. Unacceptable.'],
        prop_tradedesk: ['Keyboards. Sit on them. Obviously.'],
        prop_espresso: ["Espresso? I'm already this awake."],
      },
      ropes: {
        vip: ['VIP? I\'m VIP-er.'],
        office: ['Professionals only. So, me.'],
      },
      doors: {
        start_lair: ['Down THERE? In the dark? ...Fine.'],
        start_office: ['Ooh. Air conditioning.'],
        start: ['Back to the swamp. Joy.'],
      },
    },
  },
};

/** Jealousy stops counting here (the top mood's threshold is plenty). */
export const MAX_JEALOUSY = 9;
