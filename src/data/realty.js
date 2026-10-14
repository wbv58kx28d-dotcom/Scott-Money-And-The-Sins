// $cott's property ladder (src/minigames/realty.js): a neighborhood of homes,
// apartments, and towers, some listed for sale. $cott starts with enough for
// one of the cheapest homes and has to flip his way up to the trophy property
// before the clock runs out. Headlines crawl across a news ticker a couple of
// months before they move prices, and each one hits the low, middle, and high
// end of the market differently. Price paths come from systems/realty.js.
//
// Prices are in dollars. `fx` is what a headline does to each tier's prices,
// as [low, mid, high] fractions (0.3 = up 30%). Parody only: never real people
// or real companies.

export const TIERS = ['low', 'mid', 'high'];

export const REALTY = {
  months: 48, // one session
  monthMs: 2000, // ~96 s
  fee: 0.06, // the realtor's cut of every sale
  down: 0.5, // the bank lends the rest of any price but the trophy's (cash only)
  startCash: 1.1, // × the cheapest home's price
  trophy: 1.1, // the trophy is priced this × the top of the high tier

  // Every unit wobbles a little each month around a slow drift.
  drift: 0.004,
  noise: 0.02, // per unit
  tierNoise: 0.012, // shared by a tier

  // A headline breaks every `every` months, then prices start moving `lead`
  // months later and take `spread` months to get there. Every headline's fx
  // is multiplied by `scale` (tuning knob for how big the swings are).
  // Of the headlines that keep every tier closest to flat, one of the best
  // `pickFrom` is chosen at random (systems/realty.js).
  news: { every: [2, 4], lead: [2, 3], spread: [1, 2], first: [1, 2], pickFrom: 3, scale: 1.25 },

  // Units that aren't $cott's are on and off the market. Each month a listing
  // can come down or go up; every tier always has at least one listed. The
  // trophy is always listed: the goal is the price, not the wait.
  listings: { start: 0.6, flip: 0.25 },

  // Every session is checked before it's played (tools/realty.test.mjs): a
  // player who reads the news can reach the trophy with time to spare, while
  // one who buys a starter home and holds it never can. By simulation, a
  // reader reacting a month after each headline wins around month 30 of 48
  // (15 at best). One reacting `lateDelay` months late must still win.
  fair: { readerBy: 0.8, lateDelay: 2, floor: 0.45, tries: 300 },

  // Grades follow the minigame contract (CLAUDE.md §6.3), by how early the
  // trophy was bought (fraction of the session used).
  grades: [
    { id: 'legendary', by: 0.5, label: 'REAL ESTATE MOGUL', color: '#ffd166', sfx: 'good' },
    { id: 'great', by: 0.7, label: 'KEYS TO THE CITY', color: '#7cf29c', sfx: 'good' },
    { id: 'pass', by: 1, label: 'SOLD!', color: '#7cf29c', sfx: 'good' },
    { id: 'fail', by: Infinity, label: 'STILL RENTING', color: '#ff6b6b', sfx: 'bad' },
  ],

  // Headlines that fit any city.
  headlines: [
    { text: 'CENTRAL BANK SLASHES RATES', fx: [0.15, 0.2, 0.25] },
    { text: 'RATES HIKED AGAIN. MORTGAGES WEEP.', fx: [-0.1, -0.2, -0.25] },
    { text: 'BILLIONAIRES FLOCK TO THE AREA', fx: [0, 0.1, 0.4] },
    { text: 'LUXURY HOME TAX DOUBLES', fx: [0.05, 0, -0.35] },
    { text: 'FIRST-TIME BUYER GRANTS ANNOUNCED', fx: [0.35, 0.1, 0] },
    { text: 'INFLUENCER CALLS THE AREA "MID"', fx: [0, -0.3, -0.1] },
    { text: 'HEDGE FUND BUYS EVERY STARTER HOME', fx: [0.4, 0, 0] },
    { text: 'REMOTE WORK OVER. BACK TO THE OFFICE.', fx: [0, 0.3, 0.1] },
    { text: 'MEME COIN CRASH WIPES OUT LOCAL WHALES', fx: [0, -0.1, -0.4] },
    { text: 'STARTER HOMES FOUND TO BE HAUNTED', fx: [-0.35, 0, 0] },
    { text: 'BUILDER FLOODS MARKET WITH CHEAP HOMES', fx: [-0.3, -0.05, 0] },
    { text: 'FOREIGN BUYERS PILE INTO PENTHOUSES', fx: [0, 0.05, 0.35] },
    { text: 'MID-SIZED APARTMENTS ARE "IN" AGAIN', fx: [0, 0.3, 0] },
    { text: 'LOCAL SCHOOL RANKED DEAD LAST', fx: [-0.25, -0.1, 0] },
  ],
  // Filler between real news. Shown dimmer; they don't move prices.
  filler: [
    'LOCAL CAT ELECTED MAYOR',
    '$COTT MONEY SPOTTED AT OPEN HOUSE, EATS ALL THE COOKIES',
    'OPEN HOUSE SATURDAY. BRING SHOES YOU CAN TAKE OFF.',
    'REALTOR SMILES FOR 9 HOURS STRAIGHT',
    'STUDY: "LOCATION, LOCATION, LOCATION" STILL TRUE',
    'MAN BUYS HOUSE, IMMEDIATELY POSTS ABOUT IT',
  ],
};

// Cities. Each has its own buildings (`kinds`, drawn by minigames/realty.js
// until PixelLab art lands), unit names, prices, and local headlines.
export const CITIES = [
  {
    id: 'tokyo',
    name: 'TOKYO',
    blurb: 'Towers over a village of old wooden homes.',
    sky: [0x1b1036, 0x6a2c70], // dusk, top to horizon
    ground: 0x2a2438,
    accent: 0xff5c8a,
    tiers: {
      low: { kind: 'machiya', label: 'VILLAGE HOME', count: 4, price: [80_000, 125_000], names: ["GRANDMA'S MACHIYA", 'RAMEN-SIDE HOUSE', 'SHRINE VIEW COTTAGE', 'TATAMI TINY HOME', 'KOI POND HOUSE'] },
      mid: { kind: 'apartment', label: 'APARTMENT', count: 3, price: [150_000, 240_000], names: ['CAPSULE LOFTS', 'NEON HEIGHTS', 'VENDING MACHINE VIEWS', 'KARAOKE COURT'] },
      high: { kind: 'tower', label: 'TOWER', count: 2, price: [280_000, 400_000], names: ['SKY SAMURAI TOWER', 'ROBOT BUTLER RESIDENCES'], trophy: 'NEON SPIRE PENTHOUSE' },
    },
    headlines: [
      { text: 'TOKYO TO HOST THE ROBOT OLYMPICS', fx: [0, 0.2, 0.35] },
      { text: 'ANIME STUDIO MOVES IN DOWN THE BLOCK', fx: [0.05, 0.3, 0] },
      { text: 'NEW BULLET TRAIN STOP IN THE VILLAGE', fx: [0.4, 0.05, 0] },
      { text: 'KAIJU SIGHTED IN THE BAY (AGAIN)', fx: [0, -0.15, -0.35] },
      { text: 'TOURISTS DISCOVER THE OLD VILLAGE', fx: [0.35, 0, 0] },
      { text: 'CAPSULE LIVING CRAZE ENDS OVERNIGHT', fx: [0, -0.3, 0] },
      { text: 'TECH GIANT BUILDS ROBOT HQ NEXT DOOR', fx: [0, 0.1, 0.4] },
      { text: 'NEW QUAKE CODE: OLD HOMES NEED REFITS', fx: [-0.3, 0, 0.05] },
      { text: 'VILLAGE ROADS TORN UP FOR TWO YEARS', fx: [-0.3, 0, 0] },
    ],
  },
  {
    id: 'la',
    name: 'LOS ANGELES',
    blurb: 'Bungalows, stucco villas, and a mansion on the hill.',
    sky: [0x2a1a4a, 0xff8c42], // sunset
    ground: 0x3a2a30,
    accent: 0xffb347,
    tiers: {
      low: { kind: 'bungalow', label: 'BUNGALOW', count: 4, price: [85_000, 130_000], names: ['PALM TREE BUNGALOW', 'TACO TRUCK ADJACENT', 'STUDIO LOT SHACK', 'SMOGVIEW COTTAGE', 'SURFBOARD GARAGE'] },
      mid: { kind: 'villa', label: 'VILLA', count: 3, price: [150_000, 240_000], names: ['STUCCO VILLA', 'SPANISH TILE DUPLEX', 'POOLSIDE FOURPLEX', 'AGENT HOUSE'] },
      high: { kind: 'mansion', label: 'MANSION', count: 2, price: [280_000, 400_000], names: ['INFINITY POOL ESTATE', 'GATED GLASS BOX'], trophy: 'HILLTOP MEGA-MANSION' },
    },
    headlines: [
      { text: 'STREAMING GIANT GREENLIGHTS 900 SHOWS', fx: [0, 0.3, 0.2] },
      { text: 'WILDFIRE SMOKE OVER THE HILLS', fx: [0, 0, -0.35] },
      { text: 'CELEB BUYS A BUNGALOW, CALLS IT "HUMBLE"', fx: [0.4, 0, 0] },
      { text: 'WRITERS STRIKE SHUTS DOWN EVERY SET', fx: [0, -0.3, -0.05] },
      { text: 'DROUGHT: PRIVATE POOLS BANNED', fx: [0, -0.1, -0.3] },
      { text: 'NEW METRO LINE (FOR REAL THIS TIME)', fx: [0.35, 0.1, 0] },
      { text: 'REALITY SHOW FILMS ON THE BLOCK', fx: [0.1, 0.3, 0] },
      { text: 'BIG LETTERS SIGN FALLS ON A MANSION', fx: [0, 0, -0.3] },
      { text: 'AWARD WINNERS HUNT FOR HILLTOP HOMES', fx: [0, 0.05, 0.35] },
      { text: 'FREEWAY WIDENING EATS THE BUNGALOWS', fx: [-0.35, 0, 0] },
    ],
  },
  {
    id: 'seattle',
    name: 'SEATTLE',
    blurb: 'Craftsman houses, condos, and glass towers in the rain.',
    sky: [0x1d2b3a, 0x5d7a8c], // overcast
    ground: 0x26302e,
    accent: 0x7cf29c,
    tiers: {
      low: { kind: 'craftsman', label: 'CRAFTSMAN', count: 4, price: [80_000, 125_000], names: ['MOSSY CRAFTSMAN', 'RAINCOAT COTTAGE', 'GRUNGE GARAGE HOUSE', 'FERRY VIEW FIXER', 'SALMON RUN SHACK'] },
      mid: { kind: 'condo', label: 'CONDO', count: 3, price: [150_000, 240_000], names: ['DRIZZLE CONDOS', 'LATTE LOFTS', 'TECH BRO TOWNHOMES', 'FLEECE VEST FLATS'] },
      high: { kind: 'glass', label: 'GLASS TOWER', count: 2, price: [280_000, 400_000], names: ['LAKEFRONT GLASS', 'CLOUD CAMPUS SUITES'], trophy: 'NEEDLE VIEW SKY HOME' },
    },
    headlines: [
      { text: 'EVERYTHING-STORE OPENS HQ NUMBER 3', fx: [0, 0.35, 0.2] },
      { text: 'IT STOPPED RAINING. NOBODY KNOWS WHY.', fx: [0.2, 0.2, 0.2] },
      { text: 'TECH LAYOFFS HIT THE LAKEFRONT', fx: [0, -0.1, -0.35] },
      { text: 'COFFEE CHAIN BUYS THE WHOLE STREET', fx: [0.35, 0.05, 0] },
      { text: 'GRUNGE REVIVAL: ARTISTS MOVE IN', fx: [0.3, 0, 0] },
      { text: 'CONDO GLUT: 40 TOWERS GO UP AT ONCE', fx: [0, -0.35, 0] },
      { text: 'FERRY TO THE ISLANDS SHUT DOWN', fx: [-0.1, 0, -0.25] },
      { text: 'VOLCANO "PROBABLY FINE," SAYS EXPERT', fx: [-0.2, -0.2, -0.2] },
      { text: 'TECH IPO MINTS 900 MILLIONAIRES', fx: [0, 0.1, 0.4] },
      { text: 'SINKHOLE SEASON STARTS EARLY', fx: [-0.3, 0, 0] },
    ],
  },
];
