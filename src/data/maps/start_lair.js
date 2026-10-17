// Derek's basement, under his house in the Subreddit Swamps: the subreddit's
// server room, and where he waits for $cott (CLAUDE.md §6.6). The swamp's
// cellar door leads here and the stairs lead back up (exits whose `to` is the
// other map). WHERE everything stands is in ./start_lair.layout.js.

export default {
  region: 'start',
  name: "Derek's Basement",
  npcs: {
    derek: {
      name: 'DEREK',
      fight: 'derek', // tapping him walks over, talks, then offers the fight
      // Placeholder lines until the writing chat sends real ones.
      talk: [
        { speaker: 'DEREK', text: '"Well, well. $cott Money, in MY server room. Mind the cables."' },
        { speaker: 'DEREK', text: '"Down 98% and still holding. You know what that makes me?\nA LEGEND."' },
      ],
      talkCleared: [
        { speaker: 'DEREK', text: '"Back for more? I averaged down on my feelings."' },
      ],
    },
  },
};
