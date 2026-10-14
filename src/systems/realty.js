// Price paths, listings, development, and account math for $cott's property
// ladder (minigames/realty.js). Pure functions, so tools/realty.test.mjs can
// check every session is fair without a browser.
//
// A session is generated whole up front from the gameplay rng and revealed a
// month at a time, like the day trade's market (systems/market.js): which lot
// holds what each month, every unit's price for every month it stands, which
// units are listed when, the news, and the development (cranes, wrecking
// balls, renovations). Each headline breaks a couple of months before it
// moves its tiers' prices.

import { REALTY, TIERS } from '../data/realty.js';

/**
 * Generate a fair session for a city (see REALTY.fair). Returns
 * { city, lots, units, prices, listed, events, dev, startCash, trophy, months }:
 *   lots    [{ i, j, zone }]: every buildable lot on the map (zone = its tier)
 *   units   [{ id, tier, name, kind, label, trophy, lot, born, gone, renos, variants }]
 *           born/gone: the months it stands (gone null if it never comes down);
 *           renos [{ month, factor }]; variants [{ from, index }] (its look over time)
 *   prices  prices[unit][month], null while it isn't standing
 *   listed  listed[unit][month] (for units $cott doesn't own)
 *   events  headlines: [{ headline, fx, announce, start, end }], prices move over months start+1..end
 *   dev     development: [{ type: 'build' | 'demolish' | 'renovate', announce, at, unit?, lot }]
 *           build: crane up at `announce`, unit opens at `at`; demolish and
 *           renovate: booked at `announce`, happen at `at`
 */
export function generateSession(rng, city, cfg = REALTY) {
  let session = null;
  for (let i = 0; i < cfg.fair.tries; i++) {
    session = buildSession(rng, city, cfg);
    if (isFair(session, cfg)) return session;
  }
  return session; // practically never reached (tools/realty.test.mjs)
}

/** Every buildable lot: the grid minus the roads, zoned by block. */
export function mapLots(cfg = REALTY) {
  const { size, road } = cfg.map;
  const lots = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === road || j === road) continue;
      const zone = i < road && j < road ? 'high' : i > road && j > road ? 'low' : 'mid';
      lots.push({ i, j, zone });
    }
  }
  return lots;
}

function buildSession(rng, city, cfg) {
  const { months } = cfg;
  const shuffled = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const lots = mapLots(cfg);
  const lotIndex = (i, j) => lots.findIndex((l) => l.i === i && l.j === j);
  const variantCount = (tier) => city.art?.[tier]?.length ?? 3;

  // Names: a first part and a second, never the same name twice.
  const usedNames = new Set();
  const nameFor = (tier) => {
    const [firsts, seconds] = city.tiers[tier].names;
    for (let k = 0; k < 50; k++) {
      const name = `${rng.pick(firsts)} ${rng.pick(seconds)}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    return `${rng.pick(firsts)} ${rng.pick(seconds)} ${usedNames.size}`;
  };

  // The units standing at the opening bell, on random lots in their zones.
  const units = [];
  const base = []; // price in month-0 dollars; the tier index carries it through time
  const occupied = new Map(); // lot index -> unit id, as of the opening bell
  const addUnit = (tier, lot, born, { trophy = false } = {}) => {
    const t = city.tiers[tier];
    const u = {
      id: units.length, tier, kind: t.kind, label: t.label, trophy, lot, born, gone: null, renos: [],
      name: trophy ? t.trophy : nameFor(tier),
      variants: [{ from: born, index: rng.int(0, variantCount(tier) - 1) }],
    };
    units.push(u);
    const [lo, hi] = t.price;
    base.push(trophy ? roundPrice(hi * cfg.trophy) : roundPrice(rng.range(lo, hi)));
    return u;
  };
  const trophyLot = lotIndex(0, 0);
  occupied.set(trophyLot, addUnit('high', trophyLot, 0, { trophy: true }).id);
  for (const tier of TIERS) {
    const open = shuffled(lots.map((l, k) => k).filter((k) => lots[k].zone === tier && !occupied.has(k)));
    for (let n = 0; n < cfg.start[tier]; n++) occupied.set(open[n], addUnit(tier, open[n], 0).id);
  }
  const trophy = 0; // the first unit made

  // The news: a headline every few months, each moving prices a bit later.
  // Headlines are picked so every tier swings both ways and ends up near where
  // it started, like the day trade's legs: holding pays nothing, reading the
  // news and trading the swings does.
  const scaled = (h) => ({ text: h.text, fx: h.fx.map((f) => f * cfg.news.scale) });
  const pool = shuffled([...city.headlines, ...cfg.headlines].map(scaled));
  const events = [];
  const net = TIERS.map(() => 0);
  const after = (h) => h.fx.reduce((s, f, ti) => s + Math.abs(net[ti] + Math.log(1 + f)), 0);
  for (let m = rng.int(...cfg.news.first); m < months - 2 && pool.length; m += rng.int(...cfg.news.every)) {
    const start = m + rng.int(...cfg.news.lead);
    if (start >= months) break;
    const end = Math.min(months, start + rng.int(...cfg.news.spread));
    const best = [...pool].sort((a, b) => after(a) - after(b)).slice(0, cfg.news.pickFrom);
    const h = rng.pick(best);
    pool.splice(pool.indexOf(h), 1);
    h.fx.forEach((f, ti) => {
      net[ti] += Math.log(1 + f);
    });
    events.push({ headline: h.text, fx: h.fx, announce: m, start, end });
  }

  // Development: cranes, wrecking balls, and renovations, one every few months.
  // `busy` tracks each lot's state month by month as it's planned.
  const dev = [];
  const lotFree = new Map(lots.map((_, k) => [k, occupied.has(k) ? Infinity : 0])); // free from this month
  const booked = new Set(); // units with a pending demolition or renovation
  const standing = (m) => units.filter((u) => u.born <= m && (u.gone === null || u.gone > m));
  const { dev: d } = cfg;
  for (let m = rng.int(...d.first); m < months - d.notice - 1; m += rng.int(...d.every)) {
    const types = Object.keys(d.weights);
    const options = {
      build: lots.map((_, k) => k).filter((k) => k !== trophyLot && lotFree.get(k) <= m),
      demolish: standing(m).filter((u) => !u.trophy && !booked.has(u.id) && m - u.born >= d.minAge),
      renovate: standing(m).filter((u) => !u.trophy && !booked.has(u.id) && m - u.born >= d.minAge),
    };
    const usable = types.filter((t) => options[t].length);
    if (!usable.length) continue;
    const type = rng.weighted(usable, (t) => d.weights[t]);
    if (type === 'build') {
      const lot = rng.pick(options.build);
      const at = m + rng.int(...d.build);
      if (at >= months) continue;
      const u = addUnit(lots[lot].zone, lot, at);
      lotFree.set(lot, Infinity);
      dev.push({ type, announce: m, at, unit: u.id, lot });
    } else {
      const u = rng.pick(options[type]);
      const at = m + d.notice;
      booked.add(u.id);
      if (type === 'demolish') {
        u.gone = at;
        lotFree.set(u.lot, at + 1); // rubble for a month, then buildable
      } else {
        u.renos.push({ month: at, factor: d.reno });
        const n = variantCount(u.tier);
        const now = u.variants[u.variants.length - 1].index;
        u.variants.push({ from: at, index: n > 1 ? (now + rng.int(1, n - 1)) % n : now });
        booked.delete(u.id); // could be booked again later
      }
      dev.push({ type, announce: m, at, unit: u.id, lot: u.lot });
    }
  }

  // Each tier's price index over time (log): news, plus a shared wobble.
  const level = TIERS.map(() => new Array(months + 1).fill(0));
  TIERS.forEach((_, ti) => {
    for (let m = 1; m <= months; m++) level[ti][m] = level[ti][m - 1] + cfg.drift + rng.range(-1, 1) * cfg.tierNoise;
  });
  for (const e of events) {
    const len = e.end - e.start;
    TIERS.forEach((_, ti) => {
      const move = Math.log(1 + e.fx[ti]);
      for (let m = e.start + 1; m <= months; m++) level[ti][m] += (move * Math.min(m - e.start, len)) / len;
    });
  }

  // Unit prices: base × tier index × its own wobble × renovations, while it stands.
  const prices = units.map((u, k) => {
    const ti = TIERS.indexOf(u.tier);
    const path = new Array(months + 1).fill(null);
    let own = 0;
    let reno = 0;
    for (let m = u.born; m <= months && (u.gone === null || m < u.gone); m++) {
      if (m > u.born) own += rng.range(-1, 1) * cfg.noise;
      for (const r of u.renos) if (r.month === m) reno += Math.log(r.factor);
      path[m] = roundPrice(base[k] * Math.exp(level[ti][m] + own + reno));
    }
    return path;
  });

  // Listings: on and off the market, the trophy always, a new build for its
  // first months, never one booked for the wrecking ball, and at least one
  // standing unit per tier listed every month.
  const listed = units.map(() => new Array(months + 1).fill(false));
  for (let m = 0; m <= months; m++) {
    for (const u of units) {
      if (prices[u.id][m] === null) continue;
      const doomed = dev.some((e) => e.type === 'demolish' && e.unit === u.id && m >= e.announce);
      if (u.trophy) listed[u.id][m] = true;
      else if (doomed) listed[u.id][m] = false;
      else if (u.born > 0 && m < u.born + cfg.listings.fresh) listed[u.id][m] = true;
      else if (m === 0) listed[u.id][m] = rng.chance(cfg.listings.start);
      else listed[u.id][m] = rng.chance(cfg.listings.flip) ? !listed[u.id][m - 1] : listed[u.id][m - 1];
    }
    for (const tier of TIERS) {
      const ids = units.filter((u) => u.tier === tier && !u.trophy && prices[u.id][m] !== null
        && !dev.some((e) => e.type === 'demolish' && e.unit === u.id && m >= e.announce)).map((u) => u.id);
      if (ids.length && !ids.some((i) => listed[i][m])) listed[rng.pick(ids)][m] = true;
    }
  }

  const cheapest = Math.min(...units.filter((u) => u.born === 0).map((u) => base[u.id]));
  return {
    city: city.id, lots, units, prices, listed, events, dev, trophy, months, startCash: roundPrice(cheapest * cfg.startCash),
  };
}

/** Prices land on round thousands, like listings do. */
const roundPrice = (v) => Math.round(v / 1000) * 1000;

/** Is this unit standing this month? */
export const standingAt = (session, u, m) => session.prices[u][m] !== null && session.prices[u][m] !== undefined;

/** Which unit (if any) stands on a lot this month, and whether there's a crane on it. */
export function lotState(session, lot, m) {
  const unit = session.units.find((u) => u.lot === lot && standingAt(session, u.id, m));
  if (unit) return { unit: unit.id };
  const site = session.dev.find((e) => e.type === 'build' && e.lot === lot && m >= e.announce && m < e.at);
  if (site) return { site: true };
  const rubble = session.units.find((u) => u.lot === lot && u.gone === m);
  return rubble ? { rubble: true } : {};
}

/** A unit's look (art variant) this month. */
export function variantAt(unit, m) {
  let index = unit.variants[0].index;
  for (const v of unit.variants) if (m >= v.from) index = v.index;
  return index;
}

/**
 * The fairness checks: no unit crashes below `floor` of where it started, a
 * news reader reaches the trophy by `readerBy` of the session (and a slower
 * one still gets there), and buying a starter home and holding it never does.
 */
export function isFair(session, cfg = REALTY) {
  const { prices, months } = session;
  for (const path of prices) {
    const alive = path.filter((p) => p !== null);
    if (Math.min(...alive) < alive[0] * cfg.fair.floor) return false;
  }
  const reader = playReader(session, cfg);
  if (reader === null || reader > months * cfg.fair.readerBy) return false;
  if (playReader(session, cfg, { delay: cfg.fair.lateDelay }) === null) return false;
  return !holderWins(session, cfg);
}

/**
 * Buy at the open and never sell: either the cheapest home outright, or the
 * priciest unit the bank will finance. Could either ever afford the trophy?
 */
export function holderWins(session, cfg = REALTY) {
  const { units, trophy, months, startCash } = session;
  const open = units.filter((u) => !u.trophy && u.born === 0).map((u) => u.id);
  const p0 = (i) => session.prices[i][0];
  const cheapest = open.reduce((best, i) => (p0(i) < p0(best) ? i : best), open[0]);
  const financed = open.filter((i) => p0(i) * cfg.down <= startCash).sort((a, b) => p0(b) - p0(a))[0];
  const plans = [{ unit: cheapest, loan: 0 }, { unit: financed, loan: p0(financed) * (1 - cfg.down) }];
  return plans.some(({ unit, loan }) => {
    const left = startCash - (p0(unit) - loan);
    let last = p0(unit);
    for (let m = 0; m <= months; m++) {
      const p = session.prices[unit][m];
      // Torn down: bought out at the last price, no fee.
      const worth = p === null ? last - loan : p * (1 - cfg.fee) - loan;
      if (p !== null) last = p;
      if (left + worth >= session.prices[trophy][m]) return true;
    }
    return false;
  });
}

/** Play the session as the news reader (readerMoves) from the opening bell. Returns the month the trophy was bought, or null. */
export function playReader(session, cfg = REALTY, { delay = 1 } = {}) {
  const acct = createAccount(session.startCash);
  for (let m = 0; m <= session.months; m++) {
    settle(acct, session, m);
    for (const move of readerMoves(session, acct, m, { delay, cfg })) {
      if (move.type === 'sell') sellUnit(acct, session, move.unit, m, cfg);
      else buyUnit(acct, session, move.unit, m, cfg);
    }
    if (acct.won !== null) return acct.won;
  }
  return null;
}

/**
 * What each tier stands to gain by holding from month m and selling at the
 * best moment, as known `delay` months after each headline broke: the peak of
 * the announced moves still to come, in log price (0 if it only goes down).
 * [low, mid, high].
 */
export function outlook(session, m, delay = 0) {
  return TIERS.map((_, ti) => {
    let level = 0;
    let best = 0;
    for (let k = m + 1; k <= session.months; k++) {
      level += knownStep(session, ti, k, m - delay);
      best = Math.max(best, level);
    }
    return best;
  });
}

/** The move in tier ti's prices into month k, counting only headlines out by month `seen`. */
function knownStep(session, ti, k, seen) {
  let step = 0;
  for (const e of session.events) {
    if (e.announce > seen || k <= e.start || k > e.end) continue;
    step += Math.log(1 + e.fx[ti]) / (e.end - e.start);
  }
  return step;
}

/**
 * The news reader's moves this month, in order: sell what has nothing good
 * coming, buy the trophy if it's affordable, else buy the priciest listed unit
 * in whichever tier has the best news ahead. Also the debug hint (the smoke
 * test plays by it). It ignores renovations and new builds; a human can do better.
 */
export function readerMoves(session, acct, m, { delay = 0, cfg = REALTY } = {}) {
  const { prices, listed, units, trophy } = session;
  const ahead = outlook(session, m, delay);
  const worthIt = Math.log(1 / (1 - cfg.fee)) + 0.04; // has to beat the fee
  const moves = [];
  let cash = acct.cash;
  const owned = new Set(acct.owned.keys());
  const equity = (u) => prices[u][m] * (1 - cfg.fee) - acct.owned.get(u).loan;

  // Enough to take the trophy once everything's sold? Then sell up and buy it.
  const liquid = cash + [...owned].reduce((s, u) => s + equity(u), 0);
  if (!owned.has(trophy) && liquid >= prices[trophy][m]) {
    for (const u of owned) moves.push({ type: 'sell', unit: u });
    moves.push({ type: 'buy', unit: trophy });
    return moves;
  }

  for (const u of owned) {
    if (ahead[TIERS.indexOf(units[u].tier)] <= 0.01) {
      moves.push({ type: 'sell', unit: u });
      cash += equity(u);
      owned.delete(u);
    }
  }
  const order = TIERS.map((_, ti) => ti).filter((ti) => ahead[ti] > worthIt).sort((a, b) => ahead[b] - ahead[a]);
  for (const ti of order) {
    for (;;) {
      const pick = units
        .filter((u) => TIERS.indexOf(u.tier) === ti && !u.trophy && !owned.has(u.id) && listed[u.id][m]
          && standingAt(session, u.id, m) && downPayment(session, u.id, m, cfg) <= cash)
        .sort((a, b) => prices[b.id][m] - prices[a.id][m])[0];
      if (!pick) break;
      moves.push({ type: 'buy', unit: pick.id });
      owned.add(pick.id);
      cash -= downPayment(session, pick.id, m, cfg);
    }
  }
  return moves;
}

// ---- $cott's account ----------------------------------------------------------------
// The bank finances everything but the trophy: $cott puts `down` of the price
// in cash and borrows the rest, and a sale pays the loan back first. The
// trophy's seller wants it all in cash.

/** All cash to start. `owned` maps unit id to { paid, loan }. `won` is the month he bought the trophy. */
export function createAccount(cash) {
  return { start: cash, cash, owned: new Map(), won: null, history: [] };
}

/** The cash it takes to buy a unit this month. */
export function downPayment(session, u, m, cfg = REALTY) {
  const p = session.prices[u][m];
  return u === session.trophy ? p : Math.round(p * cfg.down);
}

/** Can $cott buy this unit this month? */
export function canBuy(acct, session, u, m, cfg = REALTY) {
  return standingAt(session, u, m) && !acct.owned.has(u) && session.listed[u][m] && downPayment(session, u, m, cfg) <= acct.cash;
}

export function buyUnit(acct, session, u, m, cfg = REALTY) {
  if (!canBuy(acct, session, u, m, cfg)) return false;
  const price = session.prices[u][m];
  const down = downPayment(session, u, m, cfg);
  acct.cash -= down;
  acct.owned.set(u, { paid: price, loan: price - down });
  acct.history.push({ type: 'buy', unit: u, month: m, price, loan: price - down });
  if (u === session.trophy) acct.won = m;
  return true;
}

/** What selling would put in $cott's pocket this month: the price, less the fee and the loan. */
export function saleProceeds(acct, session, u, m, cfg = REALTY) {
  const own = acct.owned.get(u);
  return own && standingAt(session, u, m) ? Math.round(session.prices[u][m] * (1 - cfg.fee) - own.loan) : 0;
}

/** Sell at this month's price. Returns the proceeds (0 if he didn't own it). */
export function sellUnit(acct, session, u, m, cfg = REALTY) {
  if (!acct.owned.has(u) || !standingAt(session, u, m)) return 0;
  const proceeds = saleProceeds(acct, session, u, m, cfg);
  const { paid, loan } = acct.owned.get(u);
  acct.cash += proceeds;
  acct.history.push({ type: 'sell', unit: u, month: m, price: session.prices[u][m], paid, loan, proceeds });
  acct.owned.delete(u);
  return proceeds;
}

/**
 * Start-of-month housekeeping: anything of $cott's torn down this month is
 * bought out by the developer at last month's price, no fee. Returns the buyouts.
 */
export function settle(acct, session, m) {
  const out = [];
  for (const [u, { paid, loan }] of acct.owned) {
    if (session.units[u].gone !== m) continue;
    const price = session.prices[u][m - 1];
    const proceeds = Math.round(price - loan);
    acct.cash += proceeds;
    acct.owned.delete(u);
    acct.history.push({ type: 'buyout', unit: u, month: m, price, paid, loan, proceeds });
    out.push({ unit: u, proceeds, paid, loan });
  }
  return out;
}

/** Cash plus the equity in everything owned at this month's prices (before fees). */
export function netWorth(acct, session, m) {
  let total = acct.cash;
  for (const [u, { loan }] of acct.owned) if (standingAt(session, u, m)) total += session.prices[u][m] - loan;
  return total;
}

/** The grade for when (or whether) the trophy was bought. */
export function gradeFor(acct, months, grades = REALTY.grades) {
  if (acct.won === null) return grades[grades.length - 1];
  return grades.find((g) => acct.won <= g.by * months) ?? grades[grades.length - 1];
}

/** "$95K", "$1.25M" */
export function price(v) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  return `$${Math.round(v / 1000)}K`;
}
