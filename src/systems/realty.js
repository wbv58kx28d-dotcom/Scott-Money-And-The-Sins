// Price paths, listings, and account math for $cott's property ladder
// (minigames/realty.js). Pure functions, so tools/realty.test.mjs can check
// every session is fair without a browser.
//
// A session is generated whole up front from the gameplay rng and revealed a
// month at a time, like the day trade's market (systems/market.js): every
// unit's price for every month, which units are listed when, and the news.
// Each headline breaks a couple of months before it moves its tiers' prices.

import { REALTY, TIERS } from '../data/realty.js';

/**
 * Generate a fair session for a city (see REALTY.fair). Returns
 * { city, units, prices, listed, events, startCash, trophy, months }:
 *   units   [{ id, tier, name, kind, label, trophy }], low to high
 *   prices  prices[unit][month], months 0..months
 *   listed  listed[unit][month] (for units $cott doesn't own)
 *   events  [{ headline, fx, announce, start, end }]: prices move over months start+1..end
 */
export function generateSession(rng, city, cfg = REALTY) {
  let session = null;
  for (let i = 0; i < cfg.fair.tries; i++) {
    session = buildSession(rng, city, cfg);
    if (isFair(session, cfg)) return session;
  }
  return session; // practically never reached (tools/realty.test.mjs)
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

  // The units: each tier's prices spread across its range, cheapest first.
  const units = [];
  const base = [];
  for (const tier of TIERS) {
    const t = city.tiers[tier];
    const names = shuffled(t.names);
    const [lo, hi] = t.price;
    const count = tier === 'high' ? t.count - 1 : t.count; // the trophy is extra
    for (let i = 0; i < count; i++) {
      const slot = (i + rng.range(0.15, 0.85)) / count;
      units.push({ id: units.length, tier, name: names[i], kind: t.kind, label: t.label, trophy: false });
      base.push(roundPrice(lo + (hi - lo) * slot));
    }
    if (tier === 'high') {
      units.push({ id: units.length, tier, name: t.trophy, kind: t.kind, label: t.label, trophy: true });
      base.push(roundPrice(hi * cfg.trophy));
    }
  }
  const trophy = units.length - 1;

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

  // Each tier's monthly move in log price: news, plus a shared wobble.
  const steps = TIERS.map(() => new Array(months + 1).fill(0));
  TIERS.forEach((_, ti) => {
    for (let m = 1; m <= months; m++) steps[ti][m] = cfg.drift + rng.range(-1, 1) * cfg.tierNoise;
  });
  for (const e of events) {
    const len = e.end - e.start;
    TIERS.forEach((_, ti) => {
      const move = Math.log(1 + e.fx[ti]);
      for (let m = e.start + 1; m <= e.end; m++) steps[ti][m] += move / len;
    });
  }

  const prices = units.map((u, i) => {
    const ti = TIERS.indexOf(u.tier);
    const path = [base[i]];
    let level = Math.log(base[i]);
    for (let m = 1; m <= months; m++) {
      level += steps[ti][m] + rng.range(-1, 1) * cfg.noise;
      path.push(roundPrice(Math.exp(level)));
    }
    return path;
  });

  // Listings: on and off the market, at least one per tier, the trophy always.
  const listed = units.map((u) => [u.trophy || rng.chance(cfg.listings.start)]);
  for (let m = 0; m <= months; m++) {
    units.forEach((u, i) => {
      if (m > 0) listed[i][m] = u.trophy || (rng.chance(cfg.listings.flip) ? !listed[i][m - 1] : listed[i][m - 1]);
    });
    for (const tier of TIERS) {
      const ids = units.filter((u) => u.tier === tier && !u.trophy).map((u) => u.id);
      if (!ids.some((i) => listed[i][m])) listed[rng.pick(ids)][m] = true;
    }
  }

  const cheapest = Math.min(...base);
  return { city: city.id, units, prices, listed, events, trophy, months, startCash: roundPrice(cheapest * cfg.startCash) };
}

/** Prices land on round thousands, like listings do. */
const roundPrice = (v) => Math.round(v / 1000) * 1000;

/**
 * The fairness checks: no unit crashes below `floor` of where it started, a
 * news reader reaches the trophy by `readerBy` of the session (and a slower
 * one still gets there), and buying a starter home and holding it never does.
 */
export function isFair(session, cfg = REALTY) {
  const { prices, months } = session;
  if (prices.some((p) => Math.min(...p) < p[0] * cfg.fair.floor)) return false;
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
  const { prices, units, trophy, months, startCash } = session;
  const open = units.filter((u) => !u.trophy).map((u) => u.id);
  const cheapest = open.reduce((best, i) => (prices[i][0] < prices[best][0] ? i : best), open[0]);
  const financed = open.filter((i) => prices[i][0] * cfg.down <= startCash).sort((a, b) => prices[b][0] - prices[a][0])[0];
  const plans = [{ unit: cheapest, loan: 0 }, { unit: financed, loan: prices[financed][0] * (1 - cfg.down) }];
  return plans.some(({ unit, loan }) => {
    const left = startCash - (prices[unit][0] - loan);
    for (let m = 0; m <= months; m++) {
      if (left + prices[unit][m] * (1 - cfg.fee) - loan >= prices[trophy][m]) return true;
    }
    return false;
  });
}

/** Play the session as the news reader (readerMoves) from the opening bell. Returns the month the trophy was bought, or null. */
export function playReader(session, cfg = REALTY, { delay = 1 } = {}) {
  const acct = createAccount(session.startCash);
  for (let m = 0; m <= session.months; m++) {
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
 * test plays by it).
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
        .filter((u) => TIERS.indexOf(u.tier) === ti && !u.trophy && !owned.has(u.id) && listed[u.id][m] && downPayment(session, u.id, m, cfg) <= cash)
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
  return !acct.owned.has(u) && session.listed[u][m] && downPayment(session, u, m, cfg) <= acct.cash;
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
  return own ? Math.round(session.prices[u][m] * (1 - cfg.fee) - own.loan) : 0;
}

/** Sell at this month's price. Returns the proceeds (0 if he didn't own it). */
export function sellUnit(acct, session, u, m, cfg = REALTY) {
  if (!acct.owned.has(u)) return 0;
  const proceeds = saleProceeds(acct, session, u, m, cfg);
  const { paid, loan } = acct.owned.get(u);
  acct.cash += proceeds;
  acct.history.push({ type: 'sell', unit: u, month: m, price: session.prices[u][m], paid, loan, proceeds });
  acct.owned.delete(u);
  return proceeds;
}

/** Cash plus the equity in everything owned at this month's prices (before fees). */
export function netWorth(acct, session, m) {
  let total = acct.cash;
  for (const [u, { loan }] of acct.owned) total += session.prices[u][m] - loan;
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
