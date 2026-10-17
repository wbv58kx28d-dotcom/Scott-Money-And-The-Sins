// $cott's property ladder (src/minigames/realty.js): a neighborhood of homes,
// apartments, and towers, some listed for sale. $cott starts with enough for
// one of the cheapest homes and has to flip his way up to the trophy property
// before the clock runs out. Each tier (the village, midtown, the skyline)
// moves in trends that last a few months; a trend chip per tier shows where
// it's heading half a month before each trend starts. Headlines on the ticker are
// flavor that matches the trends. Price paths come from systems/realty.js.
//
// Prices are in dollars. A headline's `fx` says which way it points each tier,
// as [low, mid, high] (positive = up, negative = down, 0 = no effect); it's
// shown when a trend starts in a tier it points the same way. Parody only:
// never real people or real companies.

export const TIERS = ['low', 'mid', 'high'];

export const REALTY = {
  months: 36, // one session
  monthMs: 3500, // ~2 minutes
  // Prices move this many times a month (each lot on its own day). Everything
  // below is in months; systems/realty.js converts it to these ticks.
  perMonth: 2,
  fee: 0.06, // the realtor's cut of every sale
  down: 0.4, // the bank lends the rest (60%) of any price but the trophy's (cash only)
  startCash: 1.1, // × the cheapest home's price
  trophy: 1.05, // the trophy is priced this × the top of the high tier

  // Every unit wobbles a little each month around a slow drift (small, so the
  // trends show through).
  drift: 0.004,
  noise: 0.012, // per unit
  tierNoise: 0.008, // shared by a tier

  // Trends: each tier's prices move in legs `legs` months long (front-loaded:
  // the biggest moves come first, so a chip flip shows on the map right
  // away), up (by a
  // fraction in `up`) or down (`down`), or now and then flat (`flat` chance).
  // Legs alternate, and lean back toward where the tier started, so holding
  // pays nothing. The tier's chip flips `lead` months (half a month: one
  // tick) before a leg starts; a
  // leg of `strong` or more shows double arrows.
  trend: { legs: [4, 6], up: [0.25, 0.5], down: [0.18, 0.36], flat: 0.1, lead: 0.5, strong: 0.33, drift: 0.2 },
  // What the chips say, by direction and strength.
  outlook: {
    up2: { label: 'HOT', color: '#7cf29c' },
    up: { label: 'RISING', color: '#7cf29c' },
    flat: { label: 'STEADY', color: '#c8c2d8' },
    down: { label: 'COOLING', color: '#ff9a7a' },
    down2: { label: 'CRASHING', color: '#ff6b6b' },
  },

  // The neighborhood: a size × size grid of lots seen in isometric, with a road
  // along row and column `road`. That splits it into four blocks: the back
  // block is the skyline (high tier, with the trophy on its back corner), the
  // two side blocks are midtown (mid), and the front block is the village (low).
  map: { size: 7, road: 3 },
  // How many units of each tier stand at the opening bell (plus the trophy).
  // The rest of the lots are empty, for now.
  start: { low: 6, mid: 10, high: 4 },
  // Development: every `every` months something happens on a lot. A crane goes
  // up on an empty lot and finishes `build` months later as a new listed unit
  // of that zone's tier; or a unit is booked for the wrecking ball (torn down
  // `notice` months later, and if it's $cott's the developer buys him out at
  // market price, no fee); or a unit is booked for a renovation (worth
  // `reno` × as much from `notice` months later). Bookings show on the ticker.
  dev: { every: [3, 4], first: [2, 4], build: [3, 5], notice: 2, reno: 1.25, weights: { build: 0.45, demolish: 0.2, renovate: 0.35 }, minAge: 8 },
  zones: { low: 'THE VILLAGE', mid: 'MIDTOWN', high: 'THE SKYLINE' },
  // Ticker lines for development ({name}, {zone}). They don't move tier prices.
  // A crane going up shows on the map instead; a new build is announced when it opens.
  devNews: {
    open: 'NOW OPEN: {name}. UNITS LISTED.',
    demolish: 'WRECKING BALL BOOKED FOR {name}',
    renovate: 'PERMITS FILED: {name} GETTING A GLOW-UP',
  },

  // Within a month, lots update one at a time (each on its own day of the
  // month), so changes ripple across the map instead of landing all at once.
  // Units that aren't $cott's are on and off the market. Each month a listing
  // can come down or go up; every tier always has at least one listed. The
  // trophy is always listed: the goal is the price, not the wait. A new
  // build is listed for its first `fresh` months; one booked for the wrecking
  // ball comes off the market.
  listings: { start: 0.6, flip: 0.25, fresh: 3 },

  // Every session is checked before it's played (tools/realty.test.mjs): a
  // player who follows the trend chips can reach the trophy with time to
  // spare, while one who buys a starter home and holds it never can. By
  // simulation, a reader acting half a month after each chip flips wins
  // around month 19 of 36 (11 at best); one acting `lateDelay` months late
  // must still win (around month 25).
  fair: { readerBy: 0.8, lateDelay: 1, floor: 0.45, tries: 300 },

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

// Cities. Each has its own buildings, unit names (a random first part plus a
// second: "KOI POND" + "COTTAGE"), prices, and local headlines. `art` lists
// PixelLab sprites (tools/realty-art/); a city without it gets drawn
// stand-ins (ui/buildings.js, by `kind`).
export const CITIES = [
  {
    id: 'tokyo',
    name: 'TOKYO',
    blurb: 'Towers over a village of old wooden homes.',
    sky: [0x1b1036, 0x6a2c70], // dusk, top to horizon
    accent: 0xff5c8a,
    tiers: {
      low: {
        kind: 'machiya', label: 'VILLAGE HOME', price: [80_000, 125_000],
        names: [["GRANDMA'S", 'SHRINE VIEW', 'KOI POND', 'TATAMI', 'LANTERN', 'PERSIMMON', 'CICADA', 'RAMEN-SIDE', 'BONSAI', 'TEAPOT'], ['HOUSE', 'COTTAGE', 'MACHIYA', 'HOME']],
      },
      mid: {
        kind: 'apartment', label: 'APARTMENT', price: [150_000, 240_000],
        names: [['CAPSULE', 'NEON', 'KARAOKE', 'VENDING', 'SAKURA', 'PACHINKO', 'MANGA', 'BENTO', 'ARCADE', 'GACHA'], ['LOFTS', 'HEIGHTS', 'COURT', 'TERRACE', 'MANSION']],
      },
      high: {
        kind: 'tower', label: 'TOWER', price: [280_000, 400_000], trophy: 'NEON SPIRE PENTHOUSE',
        names: [['SKY SAMURAI', 'ROBOT BUTLER', 'MEGA', 'CYBER', 'ORBIT', 'HOLO', 'QUANTUM'], ['TOWER', 'RESIDENCES', 'HEIGHTS']],
      },
    },
    // PixelLab art (tools/realty-art/): variants per tier, the trophy, and a construction site.
    art: {
      low: ['low_machiya', 'low_noren', 'low_twostory'],
      mid: ['mid_neon', 'mid_capsule', 'mid_karaoke'],
      high: ['high_glass', 'high_neon', 'high_block'],
      trophy: 'trophy_spire',
      site: 'site_construction',
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
    accent: 0xffb347,
    tiers: {
      low: {
        kind: 'bungalow', label: 'BUNGALOW', price: [85_000, 130_000],
        names: [['PALM TREE', 'TACO TRUCK', 'STUDIO LOT', 'SMOGVIEW', 'SURFBOARD', 'JUICE BAR', 'AVOCADO', 'CANYON', 'BOARDWALK', 'SUNSET'], ['BUNGALOW', 'COTTAGE', 'SHACK', 'HOUSE']],
      },
      mid: {
        kind: 'villa', label: 'VILLA', price: [150_000, 240_000],
        names: [['STUCCO', 'SPANISH TILE', 'POOLSIDE', 'AGENT', 'PILATES', 'KOMBUCHA', 'SCREENPLAY', 'VALET', 'HEADSHOT', 'CASTING'], ['VILLA', 'DUPLEX', 'FOURPLEX', 'COURT', 'LOFTS']],
      },
      high: {
        kind: 'mansion', label: 'MANSION', price: [280_000, 400_000], trophy: 'HILLTOP MEGA-MANSION',
        names: [['INFINITY POOL', 'GATED GLASS', 'PRODUCER', 'CANYON VIEW', 'HELIPAD', 'WINE CAVE', 'SCREENING ROOM'], ['ESTATE', 'MANSION', 'COMPOUND']],
      },
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
    accent: 0x7cf29c,
    tiers: {
      low: {
        kind: 'craftsman', label: 'CRAFTSMAN', price: [80_000, 125_000],
        names: [['MOSSY', 'RAINCOAT', 'GRUNGE', 'FERRY VIEW', 'SALMON RUN', 'FLANNEL', 'PUDDLE', 'TOTEM', 'CEDAR', 'FOGHORN'], ['CRAFTSMAN', 'COTTAGE', 'FIXER', 'HOUSE']],
      },
      mid: {
        kind: 'condo', label: 'CONDO', price: [150_000, 240_000],
        names: [['DRIZZLE', 'LATTE', 'TECH BRO', 'FLEECE VEST', 'KAYAK', 'MICROBREW', 'STARTUP', 'VINYL', 'BIKE LANE', 'PODCAST'], ['CONDOS', 'LOFTS', 'TOWNHOMES', 'FLATS', 'COURT']],
      },
      high: {
        kind: 'glass', label: 'GLASS TOWER', price: [280_000, 400_000], trophy: 'NEEDLE VIEW SKY HOME',
        names: [['LAKEFRONT', 'CLOUD CAMPUS', 'RAINPROOF', 'SERVER FARM', 'ORCA VIEW', 'STOCK OPTION', 'MOUNTAIN VIEW'], ['GLASS', 'SUITES', 'TOWER']],
      },
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
