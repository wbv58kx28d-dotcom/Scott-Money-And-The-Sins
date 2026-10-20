// The Influencer Isles (CLAUDE.md §6.6): who's here and what they say, keyed by
// id. WHERE everything stands is in ./isles.layout.js. A start for now: the
// first island with the jet-ski rental, a lagoon of islands to ride across, and
// Envy's castle on its island, closed until her fight is written. The castle's
// top is ./isles_sky.js. Placeholder lines until the writing chat sends real ones.

export default {
  look: 'isles', // its light, time of day and weather (data/looks.js)
  npcs: {
    // Rents out the jet ski (systems/ride.js): once rented, $cott boards it from any shore.
    //   rental  { price?, offer, rented, broke, have }: what he says when $cott can't pay the
    //           full price (he takes what's in the wallet, so no one's stuck on the first island),
    //           and once the ski's his.
    dockhand: {
      name: 'DOCKHAND DYLAN',
      talk: [
        { speaker: 'DYLAN', text: '"Welcome to the Isles, bro. Every island\'s a content house, and every content house is across the water."' },
        { speaker: 'DYLAN', text: '"No bridges. Princess says bridges ruin the sightlines."' },
      ],
      talkAgain: [{ speaker: 'DYLAN', text: '"Sea\'s calm. Vibes are immaculate. Ride safe, post responsibly."' }],
      rental: {
        price: 400,
        offer: [{ speaker: 'DYLAN', text: '"One jet ski. Pink, gold trim, phone mount. {price}, and she\'s yours for the season."' }],
        rented: [
          { speaker: 'DYLAN', text: '"Keys are in it. Ride it off any beach, park it on any beach. She finds her own way home."' },
          { text: 'Walk into the water from any shore to ride. Ride onto land to hop off.' },
        ],
        broke: [{ speaker: 'DYLAN', text: '"{cash}? That\'s... tragic. Fine. Whatever\'s in the wallet. I\'m not leaving a man on an island."' }],
        have: [{ speaker: 'DYLAN', text: '"She\'s still yours, bro. Just walk into the water."' }],
      },
    },
    guard: {
      name: 'CASTLE GUARD',
      talk: [
        { speaker: 'GUARD', text: '"Halt. The Princess is not receiving visitors."' },
        { speaker: 'GUARD', text: '"She is receiving brand deals. You are not a brand deal."' },
      ],
    },
  },
};
