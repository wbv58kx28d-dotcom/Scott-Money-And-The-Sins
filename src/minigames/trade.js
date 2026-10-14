// $cott's day-trading minigame: a live price chart creeps across the screen
// and one big button flips between BUY (all in) and SELL (cash out). Headlines
// warn of sharp moves just before they hit. At the closing bell anything still
// held is sold, and the grade depends on the gain against the target.
//
// Follows the minigame contract (CLAUDE.md §6.3): run() launches an overlay
// scene over the caller and resolves with { grade, score } when it's done.
// `score` is the final gain in percent, and `value` what the account ended up
// worth (the phone's Stonks app pays that out). $cott has no Sin level, so `level` is
// unused; `difficulty` speeds the market up. `context` is the challenge's data:
// it can set `title` and override TRADE's ticker, seconds, cash, target, and
// headlines (src/data/trade.js). Price paths and the account math are pure
// functions in systems/market.js.

import { GAME_W, GAME_H, COLORS, LAYOUT } from '../config.js';
import { TRADE } from '../data/trade.js';
import {
  generateMarket, priceAt, hintHold, createAccount, buy, sell, holding, accountValue, gainOf, gradeFor, money, pct,
} from '../systems/market.js';
import { rng } from '../systems/rng.js';
import { DEBUG } from '../systems/debug.js';
import { Audio } from '../systems/audio.js';
import { Button } from '../ui/button.js';
import { StatBar } from '../ui/bars.js';
import { drawCard, drawRibbonPanel, CARD_INSET, RIBBON_GOLD } from '../ui/ribbon.js';
import { label, body, fitWidth } from '../ui/text.js';

const KEY = 'Trade';
const OVERRIDES = ['ticker', 'seconds', 'cash', 'target', 'headlines'];

const UP = 0x3ddc84;
const DOWN = 0xff5c5c;
const FLAT = 0x6a5fa0;
const NEWS = 0xff8c42;
const UP_CSS = '#7cf29c';
const DOWN_CSS = '#ff6b6b';

// Cards, top to bottom. The main button sits in the usual bottom panel (LAYOUT.panel).
const HEADER = { x: 16, y: 120, w: 688, h: 116 };
const CHART = { x: 16, y: 252, w: 688, h: 544 };
const PLOT = { left: 50, right: 680, top: 322, bottom: 774 };
const STATS = { x: 16, y: 812, w: 688, h: 166 };
const STATUS_Y = 1036;
const RANGE_MS = 180; // how fast the chart's vertical scale catches up
const CONTINUE_DELAY_MS = 700; // so a late SELL tap can't skip the result

export default {
  id: 'trade',
  sin: null, // $cott's own
  title: "$cott's Day Trade",
  run(scene, { difficulty = 1, context = {} } = {}) {
    return new Promise((done) => scene.scene.launch(KEY, { parent: scene.scene.key, difficulty, context, done }));
  },
};

export class TradeScene extends Phaser.Scene {
  constructor() {
    super(KEY);
  }

  init({ parent, difficulty = 1, context = {}, done }) {
    const overrides = Object.fromEntries(OVERRIDES.filter((k) => context[k] !== undefined).map((k) => [k, context[k]]));
    this.cfg = { ...TRADE, ...overrides, tickMs: TRADE.tickMs / (difficulty * DEBUG.speed) };
    this.titleText = context.title ?? 'DAY TRADE';
    this.parentKey = parent;
    this.done = done;
  }

  create() {
    const { cfg } = this;
    this.buttons = new Set();
    this.market = generateMarket(rng, cfg);
    this.acct = createAccount(cfg.cash);
    this.phase = 'ready'; // ready | open | closed
    this.tick = 0;
    this.price = this.market.open;
    this.newsIndex = 0;
    this.markers = [];
    const open = this.market.open;
    this.range = { lo: open * 0.85, hi: open * 1.15 };
    this.seen = { lo: open, hi: open };

    // Covers the region and takes every tap, so nothing reaches the scene below.
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0a12, 0.88).setOrigin(0).setInteractive();
    this.buildHeader();
    this.buildChart();
    this.buildStats();
    drawRibbonPanel(this, LAYOUT.panel);
    const p = LAYOUT.panel;
    this.main = new Button(this, {
      x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w - 16, h: p.h - 16, size: 34, accent: RIBBON_GOLD, textColor: '#ffd166',
      text: 'OPEN THE MARKET', sub: `${cfg.seconds} seconds on the clock`, onPress: () => this.press(),
    });
    this.status = body(this, GAME_W / 2, STATUS_Y, '', 30, { align: 'center', color: COLORS.textDim }).setOrigin(0.5);
    this.say(`BUY goes all in. SELL cashes out.\nFinish ${pct(cfg.target)} or better by the closing bell.`);
    this.input.keyboard?.on('keydown-SPACE', () => this.main.enabled && this.press());

    // If the scene below goes away (say, back to the map), this goes with it.
    this.onParentGone = () => this.scene.stop();
    this.scene.get(this.parentKey)?.events.once('shutdown', this.onParentGone);
    this.refresh();
    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  // ---- Layout ------------------------------------------------------------------

  buildHeader() {
    const h = HEADER;
    const left = h.x + CARD_INSET;
    const right = h.x + h.w - 24;
    drawCard(this.add.graphics(), h, RIBBON_GOLD);
    fitWidth(label(this, left, h.y + 14, this.titleText, 16, { color: '#ffd166' }), h.w - CARD_INSET - 24);
    label(this, left, h.y + 46, this.cfg.ticker, 26);
    this.priceText = label(this, right, h.y + 46, '', 26).setOrigin(1, 0);
    body(this, left, h.y + 80, `OPEN ${money(this.market.open, true)}`, 28, { color: COLORS.textDim });
    this.changeText = body(this, right, h.y + 80, '', 28).setOrigin(1, 0);
  }

  buildChart() {
    const c = CHART;
    drawCard(this.add.graphics(), c, COLORS.glow);
    // The news strip along the top of the chart.
    this.newsTag = label(this, c.x + CARD_INSET, c.y + 18, 'NEWS', 14, {
      color: '#0d0820', backgroundColor: '#8a80a8', padding: { x: 8, y: 6 }, strokeThickness: 0,
    });
    const tx = this.newsTag.x + this.newsTag.width + 12;
    this.newsMaxW = c.x + c.w - 20 - tx;
    this.newsText = label(this, tx, c.y + 24, 'PRE-MARKET. QUIET... TOO QUIET.', 14, { color: COLORS.textDim });
    fitWidth(this.newsText, this.newsMaxW);
    this.gridLabels = [0, 1, 2].map(() => body(this, PLOT.right, 0, '', 22, { color: '#5d5580' }).setOrigin(1, 1));
    this.chart = this.add.graphics();
    this.entryLabel = label(this, PLOT.left + 4, 0, '', 12, { color: '#ffd166' }).setOrigin(0, 1).setVisible(false);
    const mid = (PLOT.top + PLOT.bottom) / 2;
    this.bellCard = this.add.graphics().setDepth(9);
    this.bell = label(this, GAME_W / 2, mid, '', 36, { strokeThickness: 8 }).setOrigin(0.5).setDepth(10);
    this.bellSub = body(this, GAME_W / 2, this.bell.y + 52, '', 36).setOrigin(0.5).setDepth(10);
  }

  buildStats() {
    const s = STATS;
    const left = s.x + CARD_INSET;
    const right = s.x + s.w - 24;
    drawCard(this.add.graphics(), s, RIBBON_GOLD);
    this.holdText = body(this, left, s.y + 10, '', 32);
    this.valueText = body(this, right, s.y + 10, '', 32).setOrigin(1, 0);
    const barW = 470;
    this.goal = new StatBar(this, {
      x: left, y: s.y + 70, w: barW, h: 24, title: `GOAL ${pct(this.cfg.target)}`, value: 0, max: 100, numbers: false,
      color: (r) => (r >= 1 ? COLORS.crowdFull : COLORS.flow),
    });
    this.gainText = label(this, right, s.y + 70, '', 20).setOrigin(1, 0);
    this.clock = new StatBar(this, {
      x: left, y: s.y + 126, w: barW, h: 18, title: 'CLOSING BELL', value: 1, max: 1, numbers: false, color: NEWS,
    });
    this.clockText = body(this, right, s.y + 118, '', 30).setOrigin(1, 0);
  }

  say(text, color = COLORS.textDim) {
    this.status.setText(text).setColor(color);
  }

  // ---- Play ----------------------------------------------------------------------

  press() {
    if (this.phase === 'ready') return this.openMarket();
    if (this.phase === 'open') return this.trade();
    if (this.phase === 'closed') return this.finish();
  }

  openMarket() {
    this.phase = 'open';
    this.startedAt = this.time.now;
    this.newsText.setText('MARKET OPEN').setColor(COLORS.text);
    this.say('');
    Audio.sfx('buff');
    this.refresh();
  }

  trade() {
    const { acct, price, tick, cfg } = this;
    if (!holding(acct)) {
      buy(acct, price, tick);
      this.addMarker('B', UP, tick, price);
      this.say(`Bought ${acct.shares.toFixed(2)} ${cfg.ticker} at ${money(price, true)}.`, COLORS.text);
      Audio.sfx('ok');
    } else {
      const before = acct.trades[acct.trades.length - 1].buyPrice;
      const cost = acct.shares * before;
      sell(acct, price, tick);
      this.cashOut(acct.cash - cost, price >= before);
    }
    this.refresh();
  }

  /** The SELL marker, a floating profit number, and the line under the chart. */
  cashOut(profit, up) {
    const { tick, price } = this;
    const m = this.addMarker('S', up ? UP : DOWN, tick, price);
    const pop = label(this, m.x, m.y - 30, `${profit >= 0 ? '+' : ''}${money(profit)}`, 18, { color: up ? UP_CSS : DOWN_CSS })
      .setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: pop, y: pop.y - 60, alpha: 0, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => pop.destroy() });
    this.say(`Sold at ${money(price, true)}. ${up ? 'Profit.' : 'Ouch.'} ${profit >= 0 ? '+' : ''}${money(profit)}`, up ? UP_CSS : DOWN_CSS);
    Audio.sfx(up ? 'good' : 'bad');
  }

  addMarker(letter, color, tick, price) {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x000000, 1).fillCircle(0, 0, 15).fillStyle(color, 1).fillCircle(0, 0, 12);
    const text = label(this, 0, 0, letter, 12, { color: '#0d0820', strokeThickness: 0 }).setOrigin(0.5).setDepth(6);
    const marker = { g, text, tick, price, x: 0, y: 0 };
    this.markers.push(marker);
    this.placeMarker(marker);
    return marker;
  }

  placeMarker(m) {
    m.x = Math.round(this.xAt(m.tick));
    m.y = Math.round(this.yAt(m.price));
    m.g.setPosition(m.x, m.y);
    m.text.setPosition(m.x + 1, m.y + 1);
  }

  update(time, delta) {
    if (this.phase !== 'open') return;
    const last = this.market.prices.length - 1;
    this.tick = Math.min(last, (time - this.startedAt) / this.cfg.tickMs);
    this.price = priceAt(this.market.prices, this.tick);
    this.seen.lo = Math.min(this.seen.lo, this.price);
    this.seen.hi = Math.max(this.seen.hi, this.price);

    // Headlines land a few ticks before their move.
    const news = this.market.legs.filter((l) => l.news);
    while (this.newsIndex < news.length && news[this.newsIndex].announce <= this.tick) this.breakNews(news[this.newsIndex++]);

    // Ease the vertical scale toward what's been seen (plus the entry line).
    const k = 1 - Math.exp(-delta / RANGE_MS);
    const want = this.wantedRange();
    this.range.lo += (want.lo - this.range.lo) * k;
    this.range.hi += (want.hi - this.range.hi) * k;

    if (this.tick >= last) return this.closeMarket();
    this.refresh();
  }

  breakNews(leg) {
    this.newsTag.setBackgroundColor('#ff8c42').setText('BREAKING');
    const tx = this.newsTag.x + this.newsTag.width + 12;
    this.newsText.setX(tx).setFontSize(14).setText(leg.headline).setColor('#ffffff');
    fitWidth(this.newsText, CHART.x + CHART.w - 20 - tx);
    this.tweens.add({ targets: [this.newsTag, this.newsText], alpha: 0.2, duration: 90, yoyo: true, repeat: 3 });
    Audio.sfx('crit');
  }

  closeMarket() {
    const { acct, market } = this;
    this.phase = 'closed';
    this.tick = market.prices.length - 1;
    this.price = market.prices[this.tick];
    if (holding(acct)) {
      const before = acct.trades[acct.trades.length - 1].buyPrice;
      const cost = acct.shares * before;
      sell(acct, this.price, this.tick);
      this.cashOut(acct.cash - cost, this.price >= before);
      this.status.setText(`${this.status.text}\nThe bell sold it for you.`);
    }
    const gain = gainOf(acct, this.price);
    const grade = gradeFor(gain, this.cfg.target, this.cfg.grades);
    this.result = { grade: grade.id, score: Math.round(gain * 1000) / 10, value: Math.round(accountValue(acct, this.price)) };

    this.newsTag.setBackgroundColor('#8a80a8').setText('CLOSED');
    this.newsText.setAlpha(1).setText('*DING DING DING*').setColor(COLORS.textDim);
    const accent = parseInt(grade.color.slice(1), 16);
    drawCard(this.bellCard, { x: 84, y: this.bell.y - 54, w: 540, h: 142 }, accent, { alpha: 0.96 });
    this.bell.setText(grade.label).setColor(grade.color).setScale(1.6);
    fitWidth(this.bell, CHART.w - 60);
    this.bellSub.setText(`${money(accountValue(acct, this.price))}  (${pct(gain)})`).setColor(grade.color);
    this.tweens.add({ targets: this.bell, scale: 1, duration: 260, ease: 'Back.easeOut' });
    Audio.sfx(grade.sfx);

    this.main.setText('CONTINUE').setSub(gain >= this.cfg.target ? 'Collect your tendies.' : 'Walk it off.').setAccent(RIBBON_GOLD, '#ffd166');
    this.main.setEnabled(false);
    this.time.delayedCall(CONTINUE_DELAY_MS, () => this.main.setEnabled(true));
    this.refresh();
  }

  finish() {
    this.scene.get(this.parentKey)?.events.off('shutdown', this.onParentGone);
    const { done, result } = this;
    this.scene.stop();
    done(result);
  }

  // ---- Drawing ---------------------------------------------------------------------

  wantedRange() {
    let lo = this.seen.lo;
    let hi = this.seen.hi;
    if (this.acct.entry) {
      lo = Math.min(lo, this.acct.entry);
      hi = Math.max(hi, this.acct.entry);
    }
    // Never zoom in so far that the wobble looks like a crash.
    const minSpan = this.market.open * 0.3;
    if (hi - lo < minSpan) {
      const mid = (hi + lo) / 2;
      lo = mid - minSpan / 2;
      hi = mid + minSpan / 2;
    }
    const pad = (hi - lo) * 0.12;
    return { lo: lo - pad, hi: hi + pad };
  }

  xAt(tick) {
    return PLOT.left + (tick / (this.market.prices.length - 1)) * (PLOT.right - PLOT.left);
  }

  yAt(price) {
    const { lo, hi } = this.range;
    return PLOT.bottom - ((price - lo) / (hi - lo)) * (PLOT.bottom - PLOT.top);
  }

  /** Points along the price path from one tick to another (fractional ends allowed). */
  pathPoints(from, to) {
    const { prices } = this.market;
    const pts = [{ x: this.xAt(from), y: this.yAt(priceAt(prices, from)) }];
    for (let i = Math.floor(from) + 1; i < to; i++) pts.push({ x: this.xAt(i), y: this.yAt(prices[i]) });
    pts.push({ x: this.xAt(to), y: this.yAt(priceAt(prices, to)) });
    return pts;
  }

  refresh() {
    const { acct, price, cfg, market } = this;
    const held = holding(acct);
    const value = accountValue(acct, price);
    const gain = gainOf(acct, price);
    const change = price / market.open - 1;

    this.priceText.setText(money(price, true)).setColor(change >= 0 ? UP_CSS : DOWN_CSS);
    this.changeText.setText(`${pct(change)} today`).setColor(change >= 0 ? UP_CSS : DOWN_CSS);
    this.holdText.setText(held ? `HOLDING ${acct.shares.toFixed(2)} ${cfg.ticker}` : 'ALL CASH');
    this.valueText.setText(money(value)).setColor(gain >= 0 ? COLORS.text : DOWN_CSS);
    this.goal.set(Math.max(0, Math.min(100, Math.round((gain / cfg.target) * 100))), 100, false);
    this.gainText.setText(pct(gain)).setColor(gain >= cfg.target ? '#ffd166' : gain >= 0 ? UP_CSS : DOWN_CSS);
    const left = Math.max(0, 1 - this.tick / (market.prices.length - 1));
    this.clock.set(left, 1, false);
    this.clockText.setText(`${Math.ceil(left * cfg.seconds)}s`);

    if (this.phase === 'open') {
      this.main.setText(held ? 'SELL' : 'BUY').setAccent(held ? DOWN : UP, held ? DOWN_CSS : UP_CSS);
      this.main.setSub(held
        ? `Cash out at ${money(price, true)} (${pct(price / acct.entry - 1)})`
        : `All in at ${money(price, true)}`);
    }
    this.drawChart();
  }

  drawChart() {
    const g = this.chart.clear();
    const { acct, tick } = this;
    const { lo, hi } = this.range;

    // Faint gridlines with prices.
    this.gridLabels.forEach((t, i) => {
      const p = lo + ((hi - lo) * (i + 1)) / 4;
      const y = Math.round(this.yAt(p));
      g.fillStyle(0xffffff, 0.07).fillRect(PLOT.left, y, PLOT.right - PLOT.left, 2);
      t.setText(money(p, true)).setY(y - 2);
    });

    const pts = this.pathPoints(0, tick);
    const head = pts[pts.length - 1];
    // Area under the line (whole-pixel columns: a filled polygon shows triangle seams at low
    // alpha), then the line, then the stretches $cott held (green if that trade's up).
    g.fillStyle(COLORS.glow, 0.08);
    for (let i = 0; i < pts.length - 1; i++) {
      const x0 = Math.round(pts[i].x);
      const y = Math.round(Math.min(pts[i].y, pts[i + 1].y));
      g.fillRect(x0, y, Math.round(pts[i + 1].x) - x0, PLOT.bottom - y);
    }
    g.lineStyle(4, FLAT, 1).strokePoints(pts);
    for (const t of acct.trades) {
      const end = t.sellTick ?? tick;
      if (end <= t.buyTick) continue;
      const endPrice = t.sellPrice ?? this.price;
      g.lineStyle(6, endPrice >= t.buyPrice ? UP : DOWN, 1).strokePoints(this.pathPoints(t.buyTick, end));
    }

    // While holding: a dashed line at the entry price.
    this.entryLabel.setVisible(!!acct.entry);
    if (acct.entry) {
      const y = Math.round(this.yAt(acct.entry));
      g.fillStyle(RIBBON_GOLD, 0.75);
      for (let x = PLOT.left; x < PLOT.right; x += 20) g.fillRect(x, y - 1, Math.min(12, PLOT.right - x), 3);
      this.entryLabel.setText(`IN ${money(acct.entry, true)}`).setY(y - 6);
    }

    // The live price.
    const color = acct.entry ? (this.price >= acct.entry ? UP : DOWN) : 0xffffff;
    g.fillStyle(0x000000, 1).fillCircle(head.x, head.y, 10).fillStyle(color, 1).fillCircle(head.x, head.y, 7);
    for (const m of this.markers) this.placeMarker(m);
  }

  /** Read by the debug hook / smoke test: `tradeAnswer` is the button a sharp trader would press now. */
  debugState() {
    const wantHold = hintHold(this.market, Math.floor(this.tick));
    const act = this.phase === 'ready' || (this.phase === 'closed' && this.main.enabled)
      || (this.phase === 'open' && wantHold !== null && wantHold !== holding(this.acct));
    return {
      trade: { phase: this.phase, tick: Math.floor(this.tick), holding: holding(this.acct), result: this.result ?? null },
      tradeAnswer: act ? this.main.text : null,
    };
  }
}
