// Velocity Capital's trading floor, inside the glass tower in the Subreddit
// Swamps (CLAUDE.md §6.6): the professionals the hot-tub crew can only dream
// of. Their rope (the swamp's `office` gate) wants Clout; their head trader
// wants proof $cott can trade, and gives him the WIFI app that finds Derek.
// WHERE everything stands is in ./start_office.layout.js.
// Placeholder lines until the writing chat sends real ones.

export default {
  look: 'office', // its light and air (data/looks.js)
  region: 'start',
  name: 'Velocity Capital',
  npcs: {
    helena: {
      name: 'HEDGE FUND HELENA',
      talk: [
        { speaker: 'HELENA', text: '"$cott Money. The doorman says the timeline likes you. The timeline is wrong about most things."' },
        { speaker: 'HELENA', text: '"You want Derek? He\'s been front-running our order flow from some router in the swamp. We want him gone too."' },
      ],
      talkWon: [{ speaker: 'HELENA', text: '"Follow the signal. When the bars max out, you\'re standing on him."' }],
      challenge: {
        kind: 'trade',
        prompt: 'HELENA WANTS TO SEE YOU TRADE',
        accept: 'WATCH THIS',
        acceptSub: 'Beat the desk: up 35% by the bell.',
        title: 'PROVE IT TO THE DESK',
        ticker: '$VELO',
        target: 0.35,
        win: [
          { speaker: 'HELENA', text: '"...Not bad. For a crypto guy."' },
          { speaker: 'HELENA', text: '"Here. Our compliance team built a Wi-Fi sniffer. It\'s definitely legal. Find DIAMONDHANDS-5G and you\'ve found Derek."' },
        ],
        lose: [{ speaker: 'HELENA', text: '"The desk has seen better from an intern\'s cat. Again."' }],
        gift: { apps: ['wifi'] },
      },
    },
    quentin: {
      name: 'QUANT QUENTIN',
      talk: [
        { speaker: 'QUENTIN', text: '"I modeled Derek\'s portfolio. The model filed a restraining order."' },
        { speaker: 'QUENTIN', text: '"Win Helena over. Nobody gets the good tools until she says so."' },
      ],
      talkAgain: [{ speaker: 'QUENTIN', text: '"Signal strength falls off with distance squared. Walk toward the bars."' }],
    },
    bart: {
      name: 'BULL MARKET BART',
      talk: [
        { speaker: 'BART', text: '"*on the phone* BUY! SELL! BUY! ...Sorry, who are you?"' },
        { speaker: 'BART', text: '"Derek? The basement guy? His Wi-Fi\'s louder than me. Northwest, way out past the woods."' },
      ],
      talkAgain: [{ speaker: 'BART', text: '"*on the phone* NO, THE OTHER BUY!"' }],
    },
  },
};
