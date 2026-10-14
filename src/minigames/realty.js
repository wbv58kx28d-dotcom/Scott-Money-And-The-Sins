// $cott's property ladder: a neighborhood of homes, apartments, and towers in
// one city, some listed for sale. He starts with enough for a starter home,
// the bank lends half of anything but the trophy, and the clock runs a month
// every couple of seconds. Headlines crawl across the news ticker a few months
// before they move prices, and each one hits the low, middle, and high end of
// the market differently. Buy the trophy property (cash only) to win.
//
// Follows the minigame contract (CLAUDE.md §6.3): run() launches an overlay
// scene over the caller and resolves with { grade, score, value, won } when
// it's done. `score` is final net worth as a multiple of the starting cash,
// `value` the net worth, `won` the month the trophy was bought (or null).
// `difficulty` speeds the clock up. `context.city` picks the city (an id from
// data/realty.js); otherwise it's random. Session math lives in
// systems/realty.js, the stand-in building art in ui/buildings.js.

import { GAME_W, GAME_H, COLORS, LAYOUT } from '../config.js';
import { REALTY, CITIES, TIERS } from '../data/realty.js';
import {
  generateSession, createAccount, canBuy, buyUnit, sellUnit, saleProceeds, downPayment, netWorth, gradeFor, readerMoves, price,
} from '../systems/realty.js';
import { rng } from '../systems/rng.js';
import { DEBUG } from '../systems/debug.js';
import { Audio } from '../systems/audio.js';
import { Button } from '../ui/button.js';
import { StatBar } from '../ui/bars.js';
import { drawCard, drawRibbonPanel, CARD_INSET, RIBBON_GOLD } from '../ui/ribbon.js';
import { label, body, fitWidth } from '../ui/text.js';
import { drawBuilding, drawForSale } from '../ui/buildings.js';
import { pixelIcon } from '../ui/phoneIcons.js';

const KEY = 'Realty';

const UP = 0x3ddc84;
const DOWN = 0xff5c5c;
const UP_CSS = '#7cf29c';
const DOWN_CSS = '#ff6b6b';
const NEWS = 0xff8c42;

// Cards, top to bottom. The main button sits in the usual bottom panel (LAYOUT.panel).
const HEADER = { x: 16, y: 40, w: 688, h: 132 };
const TICKER = { x: 16, y: 184, w: 688, h: 52 };
const STREET = { x: 16, y: 248, w: 688, h: 600 };
const INFO = { x: 16, y: 860, w: 688, h: 214 };
// The neighborhood's rows, back to front: where each tier's ground line is and
// how tall its buildings stand. Units in a row share its width evenly.
const ROWS = {
  high: { base: 486, h: 176, w: 132 },
  mid: { base: 664, h: 120, w: 128 },
  low: { base: 816, h: 92, w: 112 },
};
const TAG_H = 34; // price tag under each building
const TICKER_SPEED = 260; // px per second
const BREAKING_HOLD_MS = 1200; // breaking news sits still this long before it crawls
const CONTINUE_DELAY_MS = 700;

export default {
  id: 'realty',
  sin: null, // $cott's own
  title: "$cott's Property Ladder",
  run(scene, { difficulty = 1, context = {} } = {}) {
    return new Promise((done) => scene.scene.launch(KEY, { parent: scene.scene.key, difficulty, context, done }));
  },
};

export class RealtyScene extends Phaser.Scene {
  constructor() {
    super(KEY);
  }

  init({ parent, difficulty = 1, context = {}, done }) {
    this.cfg = REALTY;
    this.city = CITIES.find((c) => c.id === context.city) ?? rng.pick(CITIES);
    this.monthMs = REALTY.monthMs / (difficulty * DEBUG.speed);
    this.parentKey = parent;
    this.done = done;
  }

  create() {
    const { cfg, city } = this;
    this.buttons = new Set();
    this.session = generateSession(rng, city, cfg);
    this.acct = createAccount(this.session.startCash);
    this.phase = 'ready'; // ready | open | closed
    this.month = 0;
    this.selected = null;
    this.result = null;
    this.crawl = null;
    this.breaking = [];
    this.seenNews = [];
    this.fillerIndex = 0;

    // Covers the scene below and takes every tap.
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0a12, 0.92).setOrigin(0).setInteractive();
    this.buildHeader();
    this.buildTicker();
    this.buildStreet();
    this.buildInfo();
    drawRibbonPanel(this, LAYOUT.panel);
    const p = LAYOUT.panel;
    this.main = new Button(this, {
      x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w - 16, h: p.h - 16, size: 30, accent: RIBBON_GOLD, textColor: '#ffd166',
      text: 'OPEN HOUSE', sub: `${cfg.months} months to buy the ${city.tiers.high.trophy}`, onPress: () => this.press(),
    });

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
    drawCard(this.add.graphics(), h, this.city.accent);
    label(this, left, h.y + 14, `PROPERTY LADDER: ${this.city.name}`, 16, { color: '#ffd166' });
    this.monthText = label(this, right, h.y + 14, '', 16).setOrigin(1, 0);
    this.cashText = body(this, left, h.y + 38, '', 32);
    this.worthText = body(this, right, h.y + 38, '', 32).setOrigin(1, 0);
    this.goal = new StatBar(this, {
      x: left, y: h.y + 88, w: 420, h: 22, title: '', value: 0, max: 100, numbers: false,
      color: (r) => (r >= 1 ? COLORS.crowdFull : COLORS.flow),
    });
    this.goalText = body(this, right, h.y + 80, '', 28).setOrigin(1, 0);
  }

  buildTicker() {
    const t = TICKER;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.6).fillRect(t.x, t.y, t.w, t.h);
    g.fillStyle(NEWS, 1).fillRect(t.x, t.y, t.w, 3).fillRect(t.x, t.y + t.h - 3, t.w, 3);
    this.newsTag = label(this, t.x + 10, t.y + t.h / 2, 'NEWS', 14, {
      color: '#0d0820', backgroundColor: '#8a80a8', padding: { x: 8, y: 6 }, strokeThickness: 0,
    }).setOrigin(0, 0.5).setDepth(3);
    // The crawl shows between here and the ticker's right edge (cropped each frame;
    // a geometry mask costs a lot more on software-rendered WebGL).
    this.crawlLeft = t.x + 150;
    this.crawlRight = t.x + t.w - 4;
  }

  buildStreet() {
    const s = STREET;
    const { city } = this;
    // The backdrop is baked into a texture once: sky bands down to the horizon
    // color, and a street under each row. (Graphics redraw every rect every
    // frame, which is slow on software-rendered WebGL.)
    const bg = `realty_street_${city.id}`;
    this.bake(bg, s.w, s.h, (g) => {
      const top = Phaser.Display.Color.ValueToColor(city.sky[0]);
      const bottom = Phaser.Display.Color.ValueToColor(city.sky[1]);
      const bands = 12;
      for (let i = 0; i < bands; i++) {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
        const y0 = Math.floor((s.h * i) / bands);
        const y1 = Math.floor((s.h * (i + 1)) / bands);
        g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, y0, s.w, y1 - y0);
      }
      for (const tier of TIERS) {
        const r = ROWS[tier];
        g.fillStyle(city.ground, 1).fillRect(0, r.base - s.y, s.w, TAG_H + 8);
        g.fillStyle(0x000000, 0.35).fillRect(0, r.base - s.y, s.w, 4);
      }
    });
    this.add.image(s.x, s.y, bg).setOrigin(0);
    this.bake('realty_sale', 32, 32, (g) => drawForSale(g, 8, 32));
    this.bake('realty_flag', 36, 40, (g) => {
      g.fillStyle(0x120d1c, 1).fillRect(0, 0, 8, 36).fillRect(6, 0, 28, 18);
      g.fillStyle(0xe2d9ff, 1).fillRect(2, 2, 4, 32);
      g.fillStyle(RIBBON_GOLD, 1).fillRect(6, 2, 24, 14);
      g.fillStyle(0x120d1c, 1).fillRect(16, 6, 4, 6);
    });

    // Units: placed across their row, with a tap zone, a building, and a tag.
    this.unitViews = [];
    for (const tier of TIERS) {
      const row = ROWS[tier];
      const units = this.session.units.filter((u) => u.tier === tier);
      const cell = s.w / units.length;
      units.forEach((u, i) => {
        const cx = Math.round(s.x + cell * i + cell / 2);
        const h = u.trophy ? row.h + 44 : row.h - (i % 2) * 12;
        const view = { unit: u, cx, base: row.base, w: u.trophy ? row.w + 16 : row.w, h, cell };
        // Each building is baked once (a PixelLab texture named realty_<kind> can replace it later).
        const key = `realty_${city.id}_${u.kind}_${u.id}_${view.w}x${h}${u.trophy ? '_trophy' : ''}`;
        const pad = 48;
        this.bake(key, view.w + pad * 2, h + pad + 8, (g) => drawBuilding(g, u.kind, {
          cx: (view.w + pad * 2) / 2, base: h + pad, w: view.w, h, seed: u.id + 1, trophy: u.trophy,
        }));
        view.building = this.add.image(cx, row.base + 8, key).setOrigin(0.5, 1);
        view.sale = this.add.image(Math.round(cx + view.w / 2 - 6), row.base, 'realty_sale').setOrigin(0, 1);
        view.flag = this.add.image(Math.round(cx - view.w / 2 + 6), row.base - h - 36, 'realty_flag').setOrigin(0).setDepth(3);
        view.zone = this.add.zone(cx - cell / 2 + 4, row.base - h - 20, cell - 8, h + 20 + TAG_H).setOrigin(0).setInteractive();
        view.zone.on('pointerup', () => this.select(u.id));
        view.tag = body(this, cx, row.base + 4, '', 28).setOrigin(0.5, 0).setDepth(4);
        view.status = label(this, cx, row.base - h - 18, '', 11, { strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(4);
        this.unitViews[u.id] = view;
      });
    }
    this.selectBox = this.add.graphics().setDepth(5);
    this.arrows = this.add.container(0, 0).setDepth(4);
  }

  buildInfo() {
    const r = INFO;
    const left = r.x + CARD_INSET;
    drawCard(this.add.graphics(), r, RIBBON_GOLD);
    this.infoTitle = label(this, left, r.y + 16, '', 18, { color: '#ffd166' });
    this.infoSub = body(this, left, r.y + 44, '', 28, { color: COLORS.textDim });
    this.infoLines = body(this, left, r.y + 78, '', 30, { lineSpacing: 2 });
    this.spark = this.add.graphics();
  }

  /** Draw into a texture once (if it isn't there yet). */
  bake(key, w, h, draw) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ add: false });
    draw(g);
    g.generateTexture(key, Math.ceil(w), Math.ceil(h));
    g.destroy();
  }

  // ---- Play ----------------------------------------------------------------------

  press() {
    if (this.phase === 'ready') return this.openMarket();
    if (this.phase === 'closed') return this.finish();
    const u = this.selected;
    if (u === null) return;
    if (this.acct.owned.has(u)) return this.sell(u);
    return this.buy(u);
  }

  openMarket() {
    this.phase = 'open';
    Audio.sfx('buff');
    this.monthTimer = this.time.addEvent({ delay: this.monthMs, loop: true, callback: () => this.nextMonth() });
    this.nextCrawl();
    this.refresh();
  }

  nextMonth() {
    if (this.phase !== 'open') return;
    this.month += 1;
    for (const e of this.session.events) if (e.announce === this.month) this.breakNews(e);
    if (this.month >= this.session.months) return this.closeMarket();
    this.refresh(true);
  }

  buy(u) {
    const { acct, session, month } = this;
    if (!buyUnit(acct, session, u, month)) return;
    const unit = session.units[u];
    if (unit.trophy) {
      Audio.sfx('crit');
      return this.closeMarket();
    }
    Audio.sfx('ok');
    this.flash(u, `BOUGHT`, UP_CSS);
    this.refresh();
  }

  sell(u) {
    const proceeds = sellUnit(this.acct, this.session, u, this.month);
    const last = this.acct.history[this.acct.history.length - 1];
    const profit = proceeds - (last.paid - last.loan);
    Audio.sfx(profit >= 0 ? 'good' : 'bad');
    this.flash(u, `${profit >= 0 ? '+' : '-'}${price(Math.abs(profit))}`, profit >= 0 ? UP_CSS : DOWN_CSS);
    this.refresh();
  }

  select(u) {
    if (this.phase === 'closed') return;
    Audio.sfx('blip');
    this.selected = u;
    this.refresh();
  }

  /** A number that floats up off a building. */
  flash(u, text, color) {
    const v = this.unitViews[u];
    const pop = label(this, v.cx, v.base - v.h - 30, text, 18, { color }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: pop, y: pop.y - 60, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => pop.destroy() });
  }

  closeMarket() {
    this.phase = 'closed';
    this.monthTimer?.remove();
    const { acct, session, cfg } = this;
    const m = Math.min(this.month, session.months);
    const grade = gradeFor(acct, session.months, cfg.grades);
    const worth = netWorth(acct, session, m);
    this.result = {
      grade: grade.id, score: Math.round((worth / acct.start) * 100) / 100, value: worth, won: acct.won, city: this.city.id,
    };
    this.selected = acct.won !== null ? session.trophy : null;

    const s = STREET;
    const mid = s.y + s.h / 2 - 60;
    const accent = parseInt(grade.color.slice(1), 16);
    drawCard(this.add.graphics().setDepth(9), { x: 84, y: mid - 64, w: 552, h: 170 }, accent, { alpha: 0.96 });
    const big = label(this, GAME_W / 2, mid - 8, grade.label, 30, { color: grade.color, strokeThickness: 8 }).setOrigin(0.5).setDepth(10);
    fitWidth(big, 500);
    const sub = acct.won !== null
      ? `${session.units[session.trophy].name}\nbought in month ${acct.won}`
      : `Net worth ${price(worth)}. The ${session.units[session.trophy].name} got away.`;
    body(this, GAME_W / 2, mid + 30, sub, 30, { color: '#e2d9ff', align: 'center', wordWrap: { width: 500 } }).setOrigin(0.5, 0).setDepth(10);
    Audio.sfx(grade.sfx);

    this.main.setText('CONTINUE').setSub(acct.won !== null ? 'Enjoy the view.' : 'Back to renting.').setAccent(RIBBON_GOLD, '#ffd166');
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

  // ---- The news ticker ----------------------------------------------------------------

  breakNews(e) {
    this.seenNews.push(e.headline);
    this.breaking.push(e.headline);
    // Breaking news cuts in over filler right away.
    if (!this.crawl || !this.crawl.real) this.nextCrawl();
    Audio.sfx('crit');
  }

  /** Start the next headline crawling in from the right: breaking news first, then filler and reruns. */
  nextCrawl() {
    this.crawl?.text.destroy();
    let str;
    let real = false;
    if (this.breaking.length) {
      str = this.breaking.shift();
      real = true;
    } else if (this.seenNews.length && this.fillerIndex % 2 === 1) {
      str = `EARLIER: ${this.seenNews[this.seenNews.length - 1]}`;
    } else {
      str = this.cfg.filler[Math.floor(this.fillerIndex / 2) % this.cfg.filler.length];
    }
    if (!real) this.fillerIndex += 1;
    const t = TICKER;
    // Breaking news starts in full view and holds a moment; the rest crawls in from the right.
    const x = real ? this.crawlLeft + 8 : t.x + t.w;
    const text = label(this, x, t.y + t.h / 2, str, 18, { color: real ? '#ffffff' : '#9a92b8', strokeThickness: 0 }).setOrigin(0, 0.5);
    this.cropCrawl(text);
    this.crawl = { text, real, holdUntil: real ? this.time.now + BREAKING_HOLD_MS : 0 };
    this.newsTag.setText(real ? 'BREAKING' : 'NEWS').setBackgroundColor(real ? '#ff8c42' : '#8a80a8');
    if (real) this.tweens.add({ targets: this.newsTag, alpha: 0.2, duration: 90, yoyo: true, repeat: 3 });
  }

  update(time, delta) {
    if (this.phase !== 'open' || !this.crawl) return;
    if (time < this.crawl.holdUntil) return;
    const t = this.crawl.text;
    t.x = Math.round(t.x - (TICKER_SPEED * delta) / 1000);
    if (t.x + t.width < this.crawlLeft) this.nextCrawl();
    else this.cropCrawl(t);
  }

  cropCrawl(t) {
    const x0 = Math.max(0, this.crawlLeft - t.x);
    const x1 = Math.min(t.width, this.crawlRight - t.x);
    t.setCrop(x0, 0, Math.max(0, x1 - x0), t.height);
  }

  // ---- Drawing ---------------------------------------------------------------------

  refresh(newMonth = false) {
    const { acct, session } = this;
    const m = this.month;
    const trophy = session.trophy;
    const trophyPrice = session.prices[trophy][m];
    const liquid = this.liquid();

    this.monthText.setText(`MONTH ${m}/${session.months}`);
    this.cashText.setText(`CASH ${price(acct.cash)}`);
    this.worthText.setText(`NET WORTH ${price(netWorth(acct, session, m))}`);
    this.goal.set(Math.max(0, Math.min(100, Math.round((liquid / trophyPrice) * 100))), 100, false);
    this.goalText.setText(`TROPHY ${price(trophyPrice)}`);

    this.drawUnits(newMonth);
    this.drawInfo();
    this.drawButton();
  }

  drawUnits(newMonth) {
    const { session, acct } = this;
    const m = this.month;
    this.arrows.removeAll(true);
    for (const v of this.unitViews) {
      const { unit } = v;
      const owned = acct.owned.has(unit.id);
      const listed = session.listed[unit.id][m];
      // Dim what isn't for sale (and isn't his).
      v.building.setAlpha(listed || owned ? 1 : 0.4);
      v.sale.setVisible(listed && !owned);
      v.flag.setVisible(owned);
      const p = session.prices[unit.id][m];
      const prev = session.prices[unit.id][Math.max(0, m - 1)];
      const color = owned ? '#ffd166' : !listed ? '#6f6888' : COLORS.text;
      v.tag.setText(price(p)).setColor(color);
      v.status.setText(unit.trophy ? 'TROPHY' : '').setColor('#ffd166');
      if (m > 0 && p !== prev) {
        const up = p > prev;
        this.arrows.add(pixelIcon(this, Math.round(v.cx + v.tag.width / 2 + 4), v.base + 10, up ? 'up' : 'down', { px: 2, color: up ? UP_CSS : DOWN_CSS }));
      }
      if (newMonth && owned) {
        // Owned buildings pulse with the month's move.
        v.tag.setScale(1.15);
        this.tweens.add({ targets: v.tag, scale: 1, duration: 260 });
      }
    }
    const sel = this.selectBox.clear();
    if (this.selected !== null) {
      const v = this.unitViews[this.selected];
      sel.lineStyle(4, RIBBON_GOLD, 1).strokeRect(v.cx - v.cell / 2 + 6, v.base - v.h - 26, v.cell - 12, v.h + 26 + TAG_H);
    }
  }

  drawInfo() {
    const { session, acct, cfg } = this;
    const m = this.month;
    const g = this.spark.clear();
    const u = this.selected;
    if (u === null) {
      this.infoTitle.setText(this.phase === 'ready' ? 'HOW IT WORKS' : 'TAP A BUILDING');
      this.infoSub.setText(this.city.blurb);
      this.infoLines.setText([
        `Start with ${price(session.startCash)}. The bank lends half of any price.`,
        'News moves prices a few months after it breaks.',
        `Buy the trophy (cash only) to win. ${Math.round(cfg.fee * 100)}% fee on every sale.`,
      ].join('\n'));
      fitWidth(this.infoLines, INFO.w - CARD_INSET - 24);
      return;
    }
    const unit = session.units[u];
    const p = session.prices[u][m];
    const own = acct.owned.get(u);
    this.infoTitle.setText(unit.name);
    fitWidth(this.infoTitle, INFO.w - CARD_INSET - 250);
    const change = m > 0 ? p / session.prices[u][m - 1] - 1 : 0;
    this.infoSub.setText(`${unit.trophy ? 'THE TROPHY' : unit.label}  ${price(p)}  ${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}% this month`)
      .setColor(change >= 0 ? UP_CSS : DOWN_CSS);
    let lines;
    if (own) {
      const back = saleProceeds(acct, session, u, m, cfg);
      const putIn = own.paid - own.loan;
      lines = [`Paid ${price(own.paid)}  (loan ${price(own.loan)})`, `Sell now: ${price(back)} back  (${back >= putIn ? '+' : '-'}${price(Math.abs(back - putIn))})`];
    } else if (!session.listed[u][m]) {
      lines = ['Off the market for now.', 'Listings come and go every month.'];
    } else if (unit.trophy) {
      lines = ['Cash only. The seller wants it all up front.', `You'd have ${price(this.liquid())} if you sold everything.`];
    } else {
      const down = downPayment(session, u, m, cfg);
      lines = [`${Math.round(cfg.down * 100)}% down: ${price(down)}`, `The bank lends ${price(p - down)}`];
    }
    this.infoLines.setText(lines.join('\n'));
    fitWidth(this.infoLines, INFO.w - CARD_INSET - 24);

    // A sparkline of this unit's price so far, top-right of the card.
    const box = { x: INFO.x + INFO.w - 220, y: INFO.y + 16, w: 196, h: 52 };
    const hist = session.prices[u].slice(0, m + 1);
    const lo = Math.min(...hist);
    const hi = Math.max(...hist, lo + 1);
    g.fillStyle(0x000000, 0.35).fillRect(box.x, box.y, box.w, box.h);
    if (hist.length > 1) {
      const pts = hist.map((v, i) => ({
        x: box.x + 4 + (i / session.months) * (box.w - 8),
        y: box.y + box.h - 4 - ((v - lo) / (hi - lo)) * (box.h - 8),
      }));
      g.lineStyle(3, hist[hist.length - 1] >= hist[0] ? UP : DOWN, 1).strokePoints(pts);
    }
  }

  /** Cash plus what selling everything would bring in. */
  liquid() {
    const { acct, session, cfg } = this;
    return acct.cash + [...acct.owned.keys()].reduce((s, u) => s + saleProceeds(acct, session, u, this.month, cfg), 0);
  }

  drawButton() {
    if (this.phase !== 'open') return;
    const { acct, session, cfg } = this;
    const m = this.month;
    const u = this.selected;
    if (u === null) {
      this.main.setText('PICK A PROPERTY').setSub('Tap a building above.').setAccent(0x3a3550, COLORS.textDim).setEnabled(false);
      return;
    }
    const unit = session.units[u];
    if (acct.owned.has(u)) {
      const back = saleProceeds(acct, session, u, m, cfg);
      this.main.setText('SELL').setSub(`${price(back)} back after the loan and fee`).setAccent(DOWN, DOWN_CSS).setEnabled(true);
    } else if (!session.listed[u][m]) {
      this.main.setText('NOT FOR SALE').setSub('Wait for it to list, or pick another.').setAccent(0x3a3550, COLORS.textDim).setEnabled(false);
    } else {
      const down = downPayment(session, u, m, cfg);
      const ok = canBuy(acct, session, u, m, cfg);
      const what = unit.trophy ? `${price(down)} cash` : `${price(down)} down`;
      this.main.setText(unit.trophy ? 'BUY THE TROPHY' : 'BUY')
        .setSub(ok ? what : `Need ${what}. You have ${price(acct.cash)}.`)
        .setAccent(ok ? UP : 0x3a3550, ok ? UP_CSS : COLORS.textDim).setEnabled(ok);
    }
  }

  /** Read by the debug hook / smoke test: the news reader's next move, and where each unit is. */
  debugState() {
    const move = this.phase === 'open' ? readerMoves(this.session, this.acct, this.month)[0] ?? null : null;
    return {
      realty: {
        phase: this.phase, month: this.month, cash: this.acct.cash, owned: [...this.acct.owned.keys()], won: this.acct.won,
        selected: this.selected, result: this.result, history: this.acct.history,
      },
      realtyMove: move,
      realtyUnits: this.unitViews.map((v) => ({
        id: v.unit.id, x: v.cx, y: v.base - Math.round(v.h / 2), buyable: this.phase === 'open' && canBuy(this.acct, this.session, v.unit.id, this.month),
      })),
      realtyAnswer: this.phase === 'ready' || (this.phase === 'closed' && this.main.enabled) ? this.main.text : null,
    };
  }
}
