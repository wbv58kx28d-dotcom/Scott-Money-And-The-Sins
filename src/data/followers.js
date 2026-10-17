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
  },
};

/** Jealousy stops counting here (the top mood's threshold is plenty). */
export const MAX_JEALOUSY = 9;
