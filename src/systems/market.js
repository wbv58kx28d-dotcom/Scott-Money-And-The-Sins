// Price paths and trading math for $cott's day-trading minigame
// (minigames/trade.js). Pure functions, so tools/market.test.mjs can check
// every market is fair without a browser.
//
// A market is a whole price path, generated up front from the gameplay rng
// and revealed tick by tick. It swings in legs that alternate up and down;
// some legs are news, announced by a headline just before they move.

import { TRADE } from '../data/trade.js';

/**
 * Generate a fair market (see TRADE.fair). Returns
 * { prices, legs: [{ start, end, dir, news, headline?, announce? }], open }.
 * `prices` has one entry per tick, `seconds * 1000 / tickMs` long.
 */
export function generateMarket(rng, cfg = TRADE) {
  const ticks = Math.round((cfg.seconds * 1000) / cfg.tickMs);
  let market = null;
  for (let i = 0; i < cfg.fair.tries; i++) {
    market = buildMarket(rng, cfg, ticks);
    if (isFair(market, cfg)) return market;
  }
  return market; // practically never reached (tools/market.test.mjs)
}

function buildMarket(rng, cfg, ticks) {
  // Plan the legs.
  const legs = [];
  let dir = rng.chance(0.5) ? 1 : -1;
  for (let t = 0; t < ticks - 1;) {
    const news = legs.length > 0 && rng.chance(cfg.news.chance);
    const len = rng.int(...(news ? cfg.news.ticks : cfg.leg.ticks));
    const size = rng.range(...(news ? cfg.news : cfg.leg)[dir > 0 ? 'up' : 'down']);
    // The closing bell can cut the last leg short; it only moves as far as it gets.
    const end = Math.min(t + len, ticks - 1);
    const leg = { start: t, end, dir, news, move: (Math.log(dir > 0 ? 1 + size : 1 - size) * (end - t)) / len };
    if (news) {
      const pool = cfg.headlines[dir > 0 ? 'up' : 'down'];
      leg.headline = pool[rng.int(0, pool.length - 1)];
      leg.announce = Math.max(1, t - cfg.news.leadTicks);
    }
    legs.push(leg);
    t = leg.end;
    dir = -dir;
  }

  // Trend in log price: normal legs ease in and out, news legs jump then settle.
  const trend = new Array(ticks);
  let level = Math.log(cfg.open);
  trend[0] = level;
  for (const leg of legs) {
    const len = leg.end - leg.start;
    for (let t = leg.start + 1; t <= leg.end; t++) {
      const s = (t - leg.start) / len;
      const ease = leg.news ? 1 - (1 - s) ** 3 : (1 - Math.cos(Math.PI * s)) / 2;
      trend[t] = level + leg.move * ease;
    }
    level += leg.move;
  }

  // A wobble on top that drifts back to the trend, so leg ends stay where planned.
  const prices = new Array(ticks);
  let wobble = 0;
  for (let t = 0; t < ticks; t++) {
    wobble = t === 0 ? 0 : wobble * 0.7 + rng.range(-1, 1) * cfg.noise;
    prices[t] = round2(Math.exp(trend[t] + wobble));
  }
  return { prices, legs, open: prices[0] };
}

/** The checks in TRADE.fair, plus a sane number of news legs. */
export function isFair(market, cfg = TRADE) {
  const { prices, legs, open } = market;
  const news = legs.filter((l) => l.news).length;
  if (news < cfg.news.min || news > cfg.news.max) return false;
  if (Math.min(...prices) < open * cfg.fair.floor) return false;
  if (prices[prices.length - 1] / open - 1 > cfg.target * cfg.fair.holdMax) return false;
  return swingReturn(market) >= (1 + cfg.target) ** cfg.fair.swingMin;
}

/** What riding every up leg from its start to its end would multiply money by. */
export function swingReturn({ prices, legs }) {
  return legs.filter((l) => l.dir > 0).reduce((m, l) => (m * prices[l.end]) / prices[l.start], 1);
}

/** The leg a tick falls in (the last one past the end). */
const legAt = (legs, t) => legs.find((l) => t >= l.start && t < l.end) ?? legs[legs.length - 1];

/** Should $cott be holding at this tick? True inside an up leg. */
export function shouldHold({ legs }, tick) {
  return legAt(legs, tick).dir > 0;
}

/**
 * The debug hint (the smoke test trades by it): should $cott hold a second
 * from now? null when that leg turns too soon to be worth a late trade. Tuned
 * for a headless browser, whose taps land about a second after it decides.
 */
export function hintHold(market, tick, { lead = 10, minRun = 14 } = {}) {
  const t = tick + lead;
  const leg = legAt(market.legs, t);
  return leg.end - t < minRun ? null : leg.dir > 0;
}

/** Price at a fractional tick, so the chart and trades move smoothly between ticks. */
export function priceAt(prices, tick) {
  const i = Math.max(0, Math.min(prices.length - 1, Math.floor(tick)));
  const next = prices[Math.min(prices.length - 1, i + 1)];
  return round2(prices[i] + (next - prices[i]) * Math.max(0, Math.min(1, tick - i)));
}

// ---- $cott's account ----------------------------------------------------------------

/** A fresh account: all cash, no shares. Every BUY goes all in, every SELL cashes out. */
export function createAccount(cash) {
  return { start: cash, cash, shares: 0, entry: null, trades: [] };
}

export function buy(acct, price, tick) {
  if (acct.shares > 0) return acct;
  acct.shares = acct.cash / price;
  acct.cash = 0;
  acct.entry = price;
  acct.trades.push({ buyTick: tick, buyPrice: price, sellTick: null, sellPrice: null });
  return acct;
}

export function sell(acct, price, tick) {
  if (acct.shares <= 0) return acct;
  acct.cash = acct.shares * price;
  acct.shares = 0;
  acct.entry = null;
  Object.assign(acct.trades[acct.trades.length - 1], { sellTick: tick, sellPrice: price });
  return acct;
}

export const holding = (acct) => acct.shares > 0;
export const accountValue = (acct, price) => acct.cash + acct.shares * price;
/** Profit as a fraction of the stake: 0.25 = up 25%. */
export const gainOf = (acct, price) => accountValue(acct, price) / acct.start - 1;

/** The grade for a final gain against the target (TRADE.grades). */
export function gradeFor(gain, target, grades = TRADE.grades) {
  return grades.find((g) => gain >= g.gain * target - 1e-9) ?? grades[grades.length - 1];
}

const round2 = (v) => Math.round(v * 100) / 100;

/** "$1,043" or "$98.20" */
export function money(v, cents = false) {
  const sign = v < 0 ? '-' : '';
  const c = Math.round(Math.abs(v) * 100);
  const whole = cents ? Math.floor(c / 100) : Math.round(c / 100);
  const str = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${str}${cents ? `.${String(c % 100).padStart(2, '0')}` : ''}`;
}

/** "+4.3%" */
export function pct(gain) {
  const v = Math.round(gain * 1000) / 10;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}
