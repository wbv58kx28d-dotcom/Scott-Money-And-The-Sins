// $cott's property ladder: an isometric city neighborhood of homes,
// apartments, and towers, some listed for sale. He starts with enough for a
// starter home, the bank lends half of anything but the trophy, and the clock
// runs a month every few seconds. Each kind of property (the village, midtown,
// the skyline) moves in trends a few months long; a chip per kind shows where
// it's heading a month before each trend starts, and headlines on the ticker
// are flavor that match the big ones. Lots update one at a time, each on its
// own day of the month, so changes ripple across the map. Meanwhile the city keeps changing:
// cranes go up on empty lots and open as new listings, the wrecking ball takes
// old units down (the developer buys $cott out of his), and renovations make
// units worth more. Buy the trophy property (cash only) to win.
//
// Follows the minigame contract (CLAUDE.md §6.3): run() launches an overlay
// scene over the caller and resolves with { grade, score, value, won } when
// it's done. `score` is final net worth as a multiple of the starting cash,
// `value` the net worth, `won` the month the trophy was bought (or null).
// `difficulty` speeds the clock up. `context.city` picks the city (an id from
// data/realty.js); otherwise it's random. Session math lives in
// systems/realty.js. Art: PixelLab sprites from tools/realty-art/ (built into
// assets/realty/), or drawn stand-ins (ui/buildings.js) for cities without.
//
// The map has its own camera (drag to pan) over a viewport between the ticker
// and the info card; everything else is on the main camera.

import { GAME_W, GAME_H, COLORS, LAYOUT } from '../config.js';
import { REALTY, CITIES, TIERS } from '../data/realty.js';
import {
  generateSession, createAccount, canBuy, buyUnit, sellUnit, saleProceeds, downPayment, gradeFor, readerMoves,
  price, lotState, variantAt, settle, trendAt, standingAt,
} from '../systems/realty.js';
import { rng } from '../systems/rng.js';
import { DEBUG } from '../systems/debug.js';
import { Audio } from '../systems/audio.js';
import { Button } from '../ui/button.js';
import { StatBar } from '../ui/bars.js';
import { drawCard, drawRibbonPanel, CARD_INSET, RIBBON_GOLD } from '../ui/ribbon.js';
import { label, body, fitWidth } from '../ui/text.js';
import { drawIsoBuilding, STANDIN_HEIGHT, STANDIN_SIZE } from '../ui/buildings.js';
import { pixelIcon } from '../ui/phoneIcons.js';

const KEY = 'Realty';

const UP = 0x3ddc84;
const DOWN = 0xff5c5c;
const UP_CSS = '#7cf29c';
const DOWN_CSS = '#ff6b6b';
const NEWS = 0xff8c42;
const TAGS = {
  breaking: { text: 'BREAKING', bg: '#ff8c42', color: '#ffffff' },
  local: { text: 'LOCAL', bg: '#3fb6e8', color: '#e8fbff' },
  filler: { text: 'NEWS', bg: '#8a80a8', color: '#9a92b8' },
};

// Cards, top to bottom. The map's camera fills MAP; the main button sits in the usual bottom panel.
const HEADER = { x: 16, y: 40, w: 688, h: 132 };
const TICKER = { x: 16, y: 184, w: 688, h: 52 };
const CHIPS = { x: 16, y: 244, w: 688, h: 50 };
const MAP = { x: 0, y: 302, w: 720, h: 646 };
const INFO = { x: 16, y: 956, w: 688, h: 126 };
// Isometric lots: 64×32 art px diamonds, drawn at 2×. Tile (i, j) has its top
// corner at (ORIGIN.x + (i - j) * 64 + 64, ORIGIN.y + (i + j) * 32).
const TILE = { w: 128, h: 64 };
const TOP_ROOM = 300; // world space above the back corner, for the tallest towers
const ANCHOR_Y = 60; // a building's bottom sits this far below its lot's top corner
const DRAG_PX = 12; // a press that moves further than this pans instead of tapping
const TICKER_SPEED = 260; // px per second
const HOLD_MS = 1200; // breaking and local news sit still this long before they crawl
const CONTINUE_DELAY_MS = 700;
const TAG_BG = '#0d0820';
const TAG_AFFORD = '#1d6b3c'; // a listed unit $cott can afford right now
const TAG_SLOP = 10; // taps this close to a tag still count as on it
const ARROW_MS = 1600; // a tag's up/down arrow shows this long after its price changes

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

  preload() {
    const { art, id } = this.city;
    const names = art ? [...TIERS.flatMap((t) => art[t]), art.trophy, art.site] : [];
    for (const n of names) {
      const key = `realty_${id}_${n}`;
      if (!this.textures.exists(key)) this.load.image(key, `assets/realty/${id}/${n}.png`);
    }
    for (const n of ['grass0', 'grass1', 'grass2', 'road_i', 'road_j', 'road_x', 'rubble']) {
      if (!this.textures.exists(`realty_ground_${n}`)) this.load.image(`realty_ground_${n}`, `assets/realty/ground_${n}.png`);
    }
  }

  create() {
    const { cfg, city } = this;
    this.buttons = new Set();
    this.session = generateSession(rng, city, cfg);
    this.acct = createAccount(this.session.startCash);
    this.phase = 'ready'; // ready | open | closed
    this.month = 0; // the calendar month: the clock, rounded down
    this.t = 0; // the clock, in months
    this.selected = null; // a lot index
    this.result = null;
    this.crawl = null;
    this.queue = []; // ticker items waiting: { text, kind }
    this.seenNews = [];
    this.fillerIndex = 0;
    // Each lot updates on its own day of the month (a cosmetic shuffle), so
    // changes ripple across the map one building at a time.
    const order = this.session.lots.map((_, k) => k);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.fx.int(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.lotOffset = [];
    order.forEach((k, n) => {
      this.lotOffset[k] = ((n + 0.5) / order.length) * 0.92;
    });
    this.shown = this.session.lots.map(() => 0); // the month each lot last drew

    // Everything on the main camera lives in uiLayer; the map's camera shows mapLayer.
    this.uiLayer = this.add.layer();
    this.mapLayer = this.add.layer();
    this.ui(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0a12, 0.92).setOrigin(0).setInteractive());
    this.buildHeader();
    this.buildTicker();
    this.buildChips();
    this.buildInfo();
    this.ui(drawRibbonPanel(this, LAYOUT.panel));
    const p = LAYOUT.panel;
    this.main = new Button(this, {
      x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w - 16, h: p.h - 16, size: 30, accent: RIBBON_GOLD, textColor: '#ffd166',
      text: 'OPEN HOUSE', sub: `${cfg.months} months to buy the ${city.tiers.high.trophy}`, onPress: () => this.press(),
    });
    this.ui(this.main.container);
    this.buildMap();
    // Anything a helper added straight to the scene belongs to the main camera.
    for (const o of [...this.children.list]) if (o !== this.uiLayer && o !== this.mapLayer) this.ui(o);

    this.onParentGone = () => this.scene.stop();
    this.scene.get(this.parentKey)?.events.once('shutdown', this.onParentGone);
    this.refresh();
    this.cameras.main.fadeIn(180, 0, 0, 0);
    this.mapCam.fadeIn(180, 0, 0, 0);
  }

  /** Put a game object on the main camera (and keep it off the map's). */
  ui(obj) {
    this.uiLayer.add(obj);
    return obj;
  }

  /** Put a game object on the map. */
  world(obj) {
    this.mapLayer.add(obj);
    return obj;
  }

  // ---- Layout ------------------------------------------------------------------

  buildHeader() {
    const h = HEADER;
    const left = h.x + CARD_INSET;
    const right = h.x + h.w - 24;
    this.ui(drawCard(this.add.graphics(), h, this.city.accent));
    this.ui(label(this, left, h.y + 14, `PROPERTY LADDER: ${this.city.name}`, 16, { color: '#ffd166' }));
    this.monthText = this.ui(label(this, right, h.y + 14, '', 16).setOrigin(1, 0));
    this.cashText = this.ui(body(this, left, h.y + 38, '', 32));
    this.worthText = this.ui(body(this, right, h.y + 38, '', 32).setOrigin(1, 0));
    this.goal = new StatBar(this, {
      x: left, y: h.y + 88, w: 420, h: 22, title: '', value: 0, max: 100, numbers: false,
      color: (r) => (r >= 1 ? COLORS.crowdFull : COLORS.flow),
    });
    this.goalText = this.ui(body(this, right, h.y + 80, '', 28).setOrigin(1, 0));
  }

  buildTicker() {
    const t = TICKER;
    const g = this.ui(this.add.graphics());
    g.fillStyle(0x000000, 0.6).fillRect(t.x, t.y, t.w, t.h);
    g.fillStyle(NEWS, 1).fillRect(t.x, t.y, t.w, 3).fillRect(t.x, t.y + t.h - 3, t.w, 3);
    this.newsTag = this.ui(label(this, t.x + 10, t.y + t.h / 2, 'NEWS', 14, {
      color: '#0d0820', backgroundColor: '#8a80a8', padding: { x: 8, y: 6 }, strokeThickness: 0,
    }).setOrigin(0, 0.5).setDepth(3));
    // The crawl shows between here and the ticker's right edge (cropped each frame;
    // a geometry mask costs a lot more on software-rendered WebGL).
    this.crawlLeft = t.x + 150;
    this.crawlRight = t.x + t.w - 4;
  }

  /** One chip per kind of property: where it's heading. */
  buildChips() {
    const c = CHIPS;
    const w = Math.floor((c.w - 16) / 3);
    this.chips = TIERS.map((tier, ti) => {
      const x = c.x + ti * (w + 8);
      const g = this.ui(this.add.graphics());
      g.fillStyle(0x000000, 0.55).fillRect(x, c.y, w, c.h);
      const name = this.ui(label(this, x + 10, c.y + 8, this.cfg.zones[tier].replace('THE ', ''), 11, { color: COLORS.textDim, strokeThickness: 0 }));
      const text = this.ui(body(this, x + 10, c.y + 20, '', 28));
      return { x, w, g, name, text, icons: [], last: null };
    });
  }

  /** The month a lot is showing: the clock, less the lot's day of the month. */
  lotMonth(k) {
    return Math.max(0, Math.min(this.session.months, Math.floor(this.t - this.lotOffset[k])));
  }

  /** The month a unit's price and listing are at (its lot's). */
  unitMonth(u) {
    return this.lotMonth(this.session.units[u].lot);
  }

  buildInfo() {
    const r = INFO;
    const left = r.x + CARD_INSET;
    this.ui(drawCard(this.add.graphics(), r, RIBBON_GOLD));
    this.infoTitle = this.ui(label(this, left, r.y + 12, '', 16, { color: '#ffd166' }));
    this.infoSub = this.ui(body(this, left, r.y + 34, '', 26, { color: COLORS.textDim }));
    this.infoLines = this.ui(body(this, left, r.y + 62, '', 26, { lineSpacing: 0 }));
    this.spark = this.ui(this.add.graphics());
  }

  buildMap() {
    const { session, city } = this;
    const N = this.cfg.map.size;
    this.origin = { x: (N - 1) * 64, y: TOP_ROOM };
    this.worldW = N * TILE.w;
    this.worldH = TOP_ROOM + (2 * N - 1) * (TILE.h / 2) + 80;

    // The map's camera and a backdrop that stays put while it pans.
    this.mapCam = this.cameras.add(MAP.x, MAP.y, MAP.w, MAP.h);
    this.mapCam.ignore(this.uiLayer);
    this.cameras.main.ignore(this.mapLayer);
    const sky = `realty_sky_${city.id}`;
    this.bake(sky, MAP.w, MAP.h, (g) => {
      const top = Phaser.Display.Color.ValueToColor(city.sky[0]);
      const bottom = Phaser.Display.Color.ValueToColor(city.sky[1]);
      const bands = 16;
      for (let i = 0; i < bands; i++) {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
        g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1)
          .fillRect(0, Math.floor((MAP.h * i) / bands), MAP.w, Math.ceil(MAP.h / bands) + 1);
      }
    });
    this.world(this.add.image(0, 0, sky).setOrigin(0).setScrollFactor(0).setDepth(-1e6));

    // Ground: roads along the road row and column, grass on every lot.
    const { road } = this.cfg.map;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const { x, y } = this.tileXY(i, j);
        let key = `realty_ground_grass${(i * 7 + j * 3) % 3}`;
        if (i === road && j === road) key = 'realty_ground_road_x';
        else if (j === road) key = 'realty_ground_road_i';
        else if (i === road) key = 'realty_ground_road_j';
        this.world(this.add.image(x, y, key).setOrigin(0).setDepth(-1e5 + i + j));
      }
    }

    // A view per lot: the building (or crane, or rubble), its price tag, $cott's flag.
    this.bake('realty_flag', 36, 40, (g) => {
      g.fillStyle(0x120d1c, 1).fillRect(0, 0, 8, 36).fillRect(6, 0, 28, 18);
      g.fillStyle(0xe2d9ff, 1).fillRect(2, 2, 4, 32);
      g.fillStyle(RIBBON_GOLD, 1).fillRect(6, 2, 24, 14);
      g.fillStyle(0x120d1c, 1).fillRect(16, 6, 4, 6);
    });
    this.lotViews = session.lots.map((lot, k) => {
      const { x, y } = this.tileXY(lot.i, lot.j);
      const ax = x + TILE.w / 2;
      const ay = y + ANCHOR_Y;
      const depth = (lot.i + lot.j) * 10;
      const v = { lot, k, ax, ay, depth, key: null };
      v.rubble = this.world(this.add.image(x, y, 'realty_ground_rubble').setOrigin(0).setDepth(-5e4 + lot.i + lot.j).setVisible(false));
      v.sprite = this.world(this.add.image(ax, ay, '__DEFAULT').setOrigin(0.5, 1).setDepth(depth).setVisible(false));
      v.tag = this.world(body(this, ax, 0, '', 26, {
        backgroundColor: TAG_BG, padding: { x: 8, y: 3 }, color: COLORS.text,
      }).setOrigin(0.5, 1).setDepth(1e5 + depth).setVisible(false));
      v.arrow = null;
      v.flag = this.world(this.add.image(ax, 0, 'realty_flag').setOrigin(1, 1).setDepth(1e5 + depth + 1).setVisible(false));
      return v;
    });
    this.selectRing = this.world(this.add.graphics().setDepth(-4e4));

    // Pan by dragging; a press that doesn't move is a tap on whatever's under it.
    const maxX = Math.max(0, this.worldW - MAP.w);
    const maxY = Math.max(0, this.worldH - MAP.h);
    this.mapCam.setBounds(0, 0, Math.max(this.worldW, MAP.w), Math.max(this.worldH, MAP.h));
    this.mapCam.setScroll(Math.round(maxX / 2), Math.round(maxY * 0.75));
    const inMap = (p) => p.y >= MAP.y && p.y < MAP.y + MAP.h;
    this.input.on('pointerdown', (p) => {
      this.drag = inMap(p) ? { x: p.x, y: p.y, sx: this.mapCam.scrollX, sy: this.mapCam.scrollY, moved: false, id: p.id } : null;
    });
    this.input.on('pointermove', (p) => {
      const d = this.drag;
      if (!d || !p.isDown || p.id !== d.id) return;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < DRAG_PX) return;
      d.moved = true;
      this.mapCam.setScroll(Math.round(d.sx - (p.x - d.x)), Math.round(d.sy - (p.y - d.y)));
    });
    this.input.on('pointerup', (p) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved || p.id !== d.id || !inMap(p)) return;
      const w = this.mapCam.getWorldPoint(p.x, p.y);
      // A price tag is a buy/sell button; anywhere else just selects.
      const tagged = this.pickTag(w.x, w.y);
      if (tagged !== null) return this.tapTag(tagged);
      const lot = this.pick(w.x, w.y);
      if (lot !== null) this.select(lot);
    });
  }

  /** Top-left of tile (i, j)'s image, in world space. */
  tileXY(i, j) {
    return { x: this.origin.x + (i - j) * (TILE.w / 2), y: this.origin.y + (i + j) * (TILE.h / 2) };
  }

  /** The lot whose price tag is under a world point (the frontmost, with a little slop for thumbs), or null. */
  pickTag(wx, wy) {
    const views = this.lotViews.filter((v) => v.tag.visible).sort((a, b) => b.tag.depth - a.tag.depth);
    for (const v of views) {
      const b = v.tag.getBounds();
      if (wx >= b.x - TAG_SLOP && wx <= b.right + TAG_SLOP && wy >= b.y - TAG_SLOP && wy <= b.bottom + TAG_SLOP) return v.k;
    }
    return null;
  }

  /** Tap a price tag: buy it if he can, sell it if it's his; otherwise say why not. */
  tapTag(k) {
    if (this.phase === 'closed') return;
    this.select(k);
    if (this.phase !== 'open') return;
    const u = this.selectedUnit();
    if (u === null) return;
    const m = this.unitMonth(u);
    if (this.acct.owned.has(u)) return this.sell(u);
    if (canBuy(this.acct, this.session, u, m, this.cfg)) return this.buy(u);
    const v = this.lotViews[k];
    if (!this.session.listed[u][m]) this.flash(v, 'NOT FOR SALE', '#c8c2d8');
    else this.flash(v, `NEED ${price(downPayment(this.session, u, m, this.cfg))}`, DOWN_CSS);
    Audio.sfx('bad');
  }

  /** The lot under a world point: the frontmost building drawn there, else the tile. */
  pick(wx, wy) {
    const views = this.lotViews.filter((v) => v.sprite.visible).sort((a, b) => b.depth - a.depth);
    for (const v of views) {
      const s = v.sprite;
      const lx = Math.floor(wx - (s.x - s.width / 2));
      const ly = Math.floor(wy - (s.y - s.height));
      if (lx < 0 || ly < 0 || lx >= s.width || ly >= s.height) continue;
      if ((this.textures.getPixelAlpha(lx, ly, s.texture.key) ?? 0) > 0) return v.k;
    }
    // Invert the isometric projection to the tile under the point.
    const dx = wx - (this.origin.x + TILE.w / 2);
    const dy = wy - this.origin.y;
    const i = Math.floor(dy / TILE.h + dx / TILE.w);
    const j = Math.floor(dy / TILE.h - dx / TILE.w);
    const k = this.session.lots.findIndex((l) => l.i === i && l.j === j);
    return k >= 0 ? k : null;
  }

  /** Draw into a texture once (if it isn't there yet). */
  bake(key, w, h, draw) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ add: false });
    draw(g);
    g.generateTexture(key, Math.ceil(w), Math.ceil(h));
    g.destroy();
  }

  /** The texture for what stands on a lot this month: PixelLab art, or a stand-in baked on first use. */
  lotTexture(st, m) {
    const { city } = this;
    if (st.site) {
      if (city.art?.site) return `realty_${city.id}_${city.art.site}`;
      return this.standIn('site', 'low', 0, false);
    }
    if (st.unit === undefined) return null;
    const unit = this.session.units[st.unit];
    const variant = variantAt(unit, m);
    if (city.art) return `realty_${city.id}_${unit.trophy ? city.art.trophy : city.art[unit.tier][variant]}`;
    return this.standIn(unit.kind, unit.tier, variant, unit.trophy);
  }

  standIn(kind, tier, variant, trophy) {
    const key = `realty_standin_${kind}_${trophy ? 'trophy' : tier}_${variant}`;
    const h = trophy ? STANDIN_HEIGHT.trophy : kind === 'site' ? 40 : STANDIN_HEIGHT[tier] + (variant - 1) * 12;
    this.bake(key, STANDIN_SIZE.w, h + STANDIN_SIZE.pad + 36, (g) => drawIsoBuilding(g, kind === 'site' ? 'condo' : kind, { h, seed: variant + 1, trophy }));
    return key;
  }

  // ---- Play ----------------------------------------------------------------------

  /** The unit on the selected lot, if one stands there now. */
  selectedUnit() {
    if (this.selected === null) return null;
    return lotState(this.session, this.selected, this.lotMonth(this.selected)).unit ?? null;
  }

  press() {
    if (this.phase === 'ready') return this.openMarket();
    if (this.phase === 'closed') return this.finish();
    const u = this.selectedUnit();
    if (u === null) return;
    if (this.acct.owned.has(u)) return this.sell(u);
    return this.buy(u);
  }

  openMarket() {
    this.phase = 'open';
    Audio.sfx('buff');
    this.nextCrawl();
    this.refresh();
  }

  /** The calendar turns: chips, flavor headlines, and development bookings. */
  monthTick(m) {
    const { session, cfg } = this;
    this.month = m;
    // Headlines only for the big trends, as flavor.
    for (const e of session.events) {
      if (e.announce === m && e.headline && Math.abs(e.fx[e.tier]) >= cfg.trend.strong) this.news(e.headline, 'breaking');
    }
    // Development: bookings when they're made (what's built shows on the map).
    for (const e of session.dev) {
      if (e.announce === m && e.type !== 'build') this.news(this.devLine(e.type, e), 'local');
    }
    this.drawChips(true);
    this.refreshHeader();
  }

  devLine(type, e) {
    const { session, cfg } = this;
    return cfg.devNews[type].replace('{name}', session.units[e.unit].name).replace('{zone}', cfg.zones[session.lots[e.lot].zone]);
  }

  /** A lot reaches month mk: draw what's there now, and settle any buyout. */
  revealLot(k, mk) {
    const { session } = this;
    this.shown[k] = mk;
    const opened = session.dev.find((e) => e.type === 'build' && e.lot === k && e.at === mk);
    if (opened) this.news(this.devLine('open', opened), 'local');
    const gone = session.units.find((u) => u.lot === k && u.gone === mk);
    if (gone) {
      for (const out of settle(this.acct, session, mk, gone.id)) {
        this.flash(this.lotViews[k], `BOUGHT OUT +${price(Math.max(0, out.proceeds))}`, '#ffd166');
        this.news('DEVELOPER BUYS OUT $COTT MONEY. "PLEASURE DOING BUSINESS."', 'local');
        Audio.sfx('good');
      }
    }
    this.drawLot(this.lotViews[k], true);
    if (gone) for (const v of this.lotViews) this.drawLot(v, false); // cash changed: affordability too
    this.refreshHeader();
    if (this.selected === k) {
      this.drawInfo();
      this.drawButton();
    }
  }

  buy(u) {
    const { acct, session } = this;
    if (!buyUnit(acct, session, u, this.unitMonth(u))) return;
    const unit = session.units[u];
    if (unit.trophy) {
      Audio.sfx('crit');
      return this.closeMarket();
    }
    Audio.sfx('ok');
    this.flash(this.lotViews[unit.lot], 'BOUGHT', UP_CSS);
    this.refresh();
  }

  sell(u) {
    const proceeds = sellUnit(this.acct, this.session, u, this.unitMonth(u));
    const last = this.acct.history[this.acct.history.length - 1];
    const profit = proceeds - (last.paid - last.loan);
    Audio.sfx(profit >= 0 ? 'good' : 'bad');
    this.flash(this.lotViews[this.session.units[u].lot], `${profit >= 0 ? '+' : '-'}${price(Math.abs(profit))}`, profit >= 0 ? UP_CSS : DOWN_CSS);
    this.refresh();
  }

  select(lot) {
    if (this.phase === 'closed') return;
    Audio.sfx('blip');
    this.selected = lot;
    this.refresh();
  }

  /** A line that floats up off a lot. */
  flash(v, text, color) {
    const top = v.sprite.visible ? v.sprite.y - v.sprite.height : v.ay - 40;
    const pop = this.world(label(this, v.ax, top - 10, text, 16, { color }).setOrigin(0.5).setDepth(3e5));
    this.tweens.add({ targets: pop, y: pop.y - 60, alpha: 0, duration: 1200, ease: 'Cubic.easeOut', onComplete: () => pop.destroy() });
  }

  closeMarket() {
    this.phase = 'closed';
    const { acct, session, cfg } = this;
    const grade = gradeFor(acct, session.months, cfg.grades);
    const worth = this.worth();
    this.result = {
      grade: grade.id, score: Math.round((worth / acct.start) * 100) / 100, value: worth, won: acct.won, city: this.city.id,
    };
    if (acct.won !== null) this.selected = session.units[session.trophy].lot;

    // The result card sits over the map, on the map's camera (pinned to the viewport).
    const midY = MAP.h / 2 - 40;
    const accent = parseInt(grade.color.slice(1), 16);
    const card = drawCard(this.add.graphics(), { x: 84, y: midY - 64, w: 552, h: 170 }, accent, { alpha: 0.96 });
    this.world(card.setScrollFactor(0).setDepth(9e5));
    const big = this.world(label(this, GAME_W / 2, midY - 8, grade.label, 30, { color: grade.color, strokeThickness: 8 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(9e5 + 1));
    fitWidth(big, 500);
    const sub = acct.won !== null
      ? `${session.units[session.trophy].name}\nbought in month ${acct.won}`
      : `Net worth ${price(worth)}. The ${session.units[session.trophy].name} got away.`;
    this.world(body(this, GAME_W / 2, midY + 30, sub, 30, { color: '#e2d9ff', align: 'center', wordWrap: { width: 500 } })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(9e5 + 1));
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

  /** Queue a ticker item. Breaking news jumps the queue and cuts in over anything but other news. */
  news(text, kind) {
    if (kind === 'breaking') {
      this.seenNews.push(text);
      const firstLocal = this.queue.findIndex((q) => q.kind !== 'breaking');
      this.queue.splice(firstLocal < 0 ? this.queue.length : firstLocal, 0, { text, kind });
      Audio.sfx('crit');
    } else {
      this.queue.push({ text, kind });
    }
    if (!this.crawl || this.crawl.kind === 'filler') this.nextCrawl();
  }

  /** Start the next ticker item: news first, then filler and reruns of the last headline. */
  nextCrawl() {
    this.crawl?.text.destroy();
    let item = this.queue.shift();
    if (!item) {
      const rerun = this.seenNews.length && this.fillerIndex % 2 === 1;
      const text = rerun
        ? `EARLIER: ${this.seenNews[this.seenNews.length - 1]}`
        : this.cfg.filler[Math.floor(this.fillerIndex / 2) % this.cfg.filler.length];
      this.fillerIndex += 1;
      item = { text, kind: 'filler' };
    }
    const t = TICKER;
    const tag = TAGS[item.kind];
    const real = item.kind !== 'filler';
    // News starts in full view and holds a moment; filler crawls in from the right.
    const x = real ? this.crawlLeft + 8 : t.x + t.w;
    const text = this.ui(label(this, x, t.y + t.h / 2, item.text, 18, { color: tag.color, strokeThickness: 0 }).setOrigin(0, 0.5));
    this.cropCrawl(text);
    this.crawl = { text, kind: item.kind, holdUntil: real ? this.time.now + HOLD_MS : 0 };
    this.newsTag.setText(tag.text).setBackgroundColor(tag.bg);
    if (item.kind === 'breaking') this.tweens.add({ targets: this.newsTag, alpha: 0.2, duration: 90, yoyo: true, repeat: 3 });
  }

  update(time, delta) {
    if (this.phase !== 'open') return;
    // The clock: the calendar turns at whole months; each lot follows on its own day.
    this.t += delta / this.monthMs;
    const months = this.session.months;
    const m = Math.min(months, Math.floor(this.t));
    if (m !== this.month) this.monthTick(m);
    for (let k = 0; k < this.lotViews.length; k++) {
      const mk = this.lotMonth(k);
      if (mk !== this.shown[k]) this.revealLot(k, mk);
    }
    if (this.t >= months + 1) return this.closeMarket();
    if (!this.crawl || time < this.crawl.holdUntil) return;
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

  refresh() {
    this.refreshHeader();
    this.drawChips(false);
    for (const v of this.lotViews) this.drawLot(v, false);
    this.drawRing();
    this.drawInfo();
    this.drawButton();
  }

  refreshHeader() {
    const { acct, session } = this;
    const trophyPrice = session.prices[session.trophy][this.unitMonth(session.trophy)];
    this.monthText.setText(`MONTH ${this.month}/${session.months}`);
    this.cashText.setText(`CASH ${price(acct.cash)}`);
    this.worthText.setText(`NET WORTH ${price(this.worth())}`);
    this.goal.set(Math.max(0, Math.min(100, Math.round((this.liquid() / trophyPrice) * 100))), 100, false);
    this.goalText.setText(`TROPHY ${price(trophyPrice)}`);
  }

  /** The trend chips: where each kind of property is heading this month. */
  drawChips(animate) {
    const out = this.cfg.outlook;
    this.chips.forEach((c, ti) => {
      const { dir, strong } = trendAt(this.session, ti, this.month, this.cfg);
      const key = dir > 0 ? (strong ? 'up2' : 'up') : dir < 0 ? (strong ? 'down2' : 'down') : 'flat';
      if (key === c.last) return;
      c.last = key;
      const look = out[key];
      c.text.setText(look.label).setColor(look.color);
      for (const i of c.icons) i.destroy();
      c.icons = [];
      const n = strong ? 2 : dir ? 1 : 0;
      for (let a = 0; a < n; a++) {
        c.icons.push(this.ui(pixelIcon(this, c.x + c.w - 28 - a * 22, CHIPS.y + 16, dir > 0 ? 'up' : 'down', { px: 2, color: look.color })));
      }
      if (!n) c.icons.push(this.ui(this.add.rectangle(c.x + c.w - 36, CHIPS.y + 25, 20, 4, 0xc8c2d8).setOrigin(0, 0.5)));
      c.g.clear().fillStyle(0x000000, 0.55).fillRect(c.x, CHIPS.y, c.w, CHIPS.h)
        .fillStyle(Phaser.Display.Color.HexStringToColor(look.color).color, 1).fillRect(c.x, CHIPS.y, 4, CHIPS.h);
      if (animate) {
        c.text.setScale(1.2);
        this.tweens.add({ targets: c.text, scale: 1, duration: 300, ease: 'Back.easeOut' });
        Audio.sfx('blip');
      }
    });
  }

  /** Draw one lot as of its own month. `animate`: it just changed, so show it changing. */
  drawLot(v, animate) {
    const { session, acct } = this;
    const m = this.lotMonth(v.k);
    const st = lotState(session, v.k, m);
    const key = this.lotTexture(st, m);
    v.rubble.setVisible(!!st.rubble);
    if (key !== v.key) {
      const was = v.key;
      v.key = key;
      v.sprite.setVisible(!!key);
      if (key) v.sprite.setTexture(key);
      // Something new on the lot: drop it in (or flash a glow-up).
      if (key && animate) {
        v.sprite.setY(v.ay - (was ? 0 : 24)).setAlpha(was ? 0.3 : 0);
        this.tweens.add({ targets: v.sprite, y: v.ay, alpha: 1, duration: 320, ease: 'Back.easeOut' });
      }
    }
    const u = st.unit;
    if (u === undefined) {
      v.tag.setVisible(false);
      v.flag.setVisible(false);
      this.clearArrow(v);
      return;
    }
    const unit = session.units[u];
    const owned = acct.owned.has(u);
    const listed = session.listed[u][m];
    // Dim what isn't for sale: a grey tint on WebGL, see-through on Canvas (no tints there).
    if (this.renderer.type === Phaser.WEBGL) {
      if (owned || listed) v.sprite.clearTint();
      else v.sprite.setTint(0x8c8ca0);
    } else if (!this.tweens.isTweening(v.sprite)) v.sprite.setAlpha(owned || listed ? 1 : 0.72);
    // Tags float over the roof; the trophy's sits down on its tower so it stays in view.
    const top = v.ay - v.sprite.height - 2 + (unit.trophy ? Math.round(v.sprite.height * 0.35) : 0);
    const show = owned || listed || unit.trophy;
    v.tag.setVisible(show).setY(top);
    if (!show) {
      v.flag.setVisible(false);
      this.clearArrow(v);
      return;
    }
    const p = session.prices[u][m];
    // His: green while it's worth more than he paid, red while it's worth less.
    // Listed and affordable: a green tag. The trophy's lettering is gold.
    const paid = acct.owned.get(u)?.paid;
    const afford = !owned && canBuy(acct, session, u, m, this.cfg);
    const color = owned ? (p >= paid ? UP_CSS : DOWN_CSS) : unit.trophy ? '#ffd166' : COLORS.text;
    v.tag.setText(unit.trophy ? `TROPHY ${price(p)}` : price(p)).setColor(color).setBackgroundColor(afford ? TAG_AFFORD : TAG_BG);
    v.flag.setVisible(owned).setPosition(v.ax - v.tag.width / 2 - 2, top);
    if (!animate) return;
    // Its price just moved: a brief arrow beside the tag, then it fades.
    const prev = m > 0 ? session.prices[u][m - 1] : null;
    if (prev === null || prev === undefined || p === prev) return;
    const upMove = p > prev;
    this.clearArrow(v);
    v.arrow = this.world(pixelIcon(this, Math.round(v.ax + v.tag.width / 2 + 2), top - 22, upMove ? 'up' : 'down', {
      px: 2, color: upMove ? UP_CSS : DOWN_CSS,
    }).setDepth(v.tag.depth + 1));
    this.tweens.add({ targets: v.arrow, alpha: 0, delay: ARROW_MS * 0.6, duration: ARROW_MS * 0.4, onComplete: () => this.clearArrow(v) });
    if (owned) {
      v.tag.setScale(1.15);
      this.tweens.add({ targets: v.tag, scale: 1, duration: 260 });
    }
  }

  clearArrow(v) {
    if (!v.arrow) return;
    this.tweens.killTweensOf(v.arrow);
    v.arrow.destroy();
    v.arrow = null;
  }

  /** A gold ring around the selected lot. */
  drawRing() {
    const g = this.selectRing.clear();
    if (this.selected === null) return;
    const { lot } = this.lotViews[this.selected];
    const { x, y } = this.tileXY(lot.i, lot.j);
    const pts = [{ x: x + 64, y: y + 2 }, { x: x + 126, y: y + 32 }, { x: x + 64, y: y + 62 }, { x: x + 2, y: y + 32 }];
    g.lineStyle(4, RIBBON_GOLD, 1).strokePoints(pts, true);
  }

  drawInfo() {
    const { session, acct, cfg } = this;
    const m = this.selected === null ? this.month : this.lotMonth(this.selected);
    const g = this.spark.clear();
    const width = INFO.w - CARD_INSET - 24;
    const set = (title, sub, lines, subColor = COLORS.textDim) => {
      this.infoTitle.setText(title);
      fitWidth(this.infoTitle, width - 210);
      this.infoSub.setText(sub).setColor(subColor);
      fitWidth(this.infoSub, width);
      this.infoLines.setText(lines.join('\n'));
      fitWidth(this.infoLines, width);
    };
    if (this.selected === null) {
      set(this.phase === 'ready' ? 'HOW IT WORKS' : 'TAP A BUILDING', `Start with ${price(session.startCash)}. Bank lends ${Math.round((1 - cfg.down) * 100)}%. ${Math.round(cfg.fee * 100)}% fee per sale.`, [
        'Chips show where each kind is heading. Buy rising, sell cooling.',
        'Tap a price to buy (green = affordable), tap again to sell.',
      ]);
      return;
    }
    const lot = session.lots[this.selected];
    const st = lotState(session, this.selected, m);
    if (st.unit === undefined) {
      const site = session.dev.find((e) => e.type === 'build' && e.lot === this.selected && m >= e.announce && m < e.at);
      if (site) {
        const u = session.units[site.unit];
        set('CONSTRUCTION SITE', `${cfg.zones[lot.zone]}`, [`Opens in month ${site.at} as ${u.name}.`, 'New builds list the day they open.']);
      } else if (st.rubble) set('RUBBLE', `${cfg.zones[lot.zone]}`, ['The wrecking ball came through.', 'Cleared for a new build.']);
      else set('EMPTY LOT', `${cfg.zones[lot.zone]}`, ['Nothing here yet.', 'Watch for cranes.']);
      return;
    }
    const u = st.unit;
    const unit = session.units[u];
    const p = session.prices[u][m];
    const own = acct.owned.get(u);
    const prev = m > 0 ? session.prices[u][m - 1] : null;
    const change = prev ? p / prev - 1 : 0;
    const look = this.chips[TIERS.indexOf(unit.tier)].last;
    const sub = `${unit.trophy ? 'THE TROPHY' : unit.label}  ${price(p)}  ${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}%  ${cfg.outlook[look]?.label ?? ''}`;
    const booking = session.dev.find((e) => e.unit === u && e.type !== 'build' && m >= e.announce && m < e.at);
    const note = booking
      ? booking.type === 'demolish'
        ? `WRECKING BALL IN ${booking.at - m} MO. (buyout at market)`
        : `GLOW-UP IN ${booking.at - m} MO. (worth ${Math.round((cfg.dev.reno - 1) * 100)}% more)`
      : null;
    let lines;
    if (own) {
      const back = saleProceeds(acct, session, u, m, cfg);
      const putIn = own.paid - own.loan;
      lines = [`Paid ${price(own.paid)} (loan ${price(own.loan)}). Sell: ${price(back)} back (${back >= putIn ? '+' : '-'}${price(Math.abs(back - putIn))})`];
    } else if (!session.listed[u][m]) {
      lines = ['Off the market for now. Listings come and go.'];
    } else if (unit.trophy) {
      lines = [`Cash only. Sell everything and you'd have ${price(this.liquid())}.`];
    } else {
      const down = downPayment(session, u, m, cfg);
      lines = [`${Math.round(cfg.down * 100)}% down: ${price(down)}. The bank lends ${price(p - down)}.`];
    }
    if (note) lines.push(note);
    set(unit.name, sub, lines, change >= 0 ? UP_CSS : DOWN_CSS);

    // A sparkline of this unit's price so far, top-right of the card.
    const box = { x: INFO.x + INFO.w - 200, y: INFO.y + 10, w: 180, h: 22 };
    const hist = session.prices[u].slice(0, m + 1).filter((x) => x !== null);
    if (hist.length > 1) {
      const lo = Math.min(...hist);
      const hi = Math.max(...hist, lo + 1);
      const start = m + 1 - hist.length;
      const pts = hist.map((x, i) => ({
        x: box.x + ((start + i) / session.months) * box.w,
        y: box.y + box.h - ((x - lo) / (hi - lo)) * box.h,
      }));
      g.lineStyle(3, hist[hist.length - 1] >= hist[0] ? UP : DOWN, 1).strokePoints(pts);
    }
  }

  /** Cash plus what selling everything would bring in (each at its lot's month). */
  liquid() {
    const { acct, session, cfg } = this;
    return acct.cash + [...acct.owned.keys()].reduce((s, u) => s + saleProceeds(acct, session, u, this.unitMonth(u), cfg), 0);
  }

  /** Cash plus the equity in everything owned (each at its lot's month, before fees). */
  worth() {
    const { acct, session } = this;
    let total = acct.cash;
    for (const [u, { loan }] of acct.owned) {
      const m = this.unitMonth(u);
      if (standingAt(session, u, m)) total += session.prices[u][m] - loan;
    }
    return total;
  }

  drawButton() {
    if (this.phase !== 'open') return;
    const { acct, session, cfg } = this;
    const u = this.selectedUnit();
    const m = this.selected === null ? this.month : this.lotMonth(this.selected);
    const off = (text, sub) => this.main.setText(text).setSub(sub).setAccent(0x3a3550, COLORS.textDim).setEnabled(false);
    if (this.selected === null) return off('PICK A PROPERTY', 'Tap a building on the map.');
    if (u === null) return off('NOTHING TO BUY', 'Pick a building.');
    const unit = session.units[u];
    if (acct.owned.has(u)) {
      const back = saleProceeds(acct, session, u, m, cfg);
      this.main.setText('SELL').setSub(`${price(back)} back after the loan and fee`).setAccent(DOWN, DOWN_CSS).setEnabled(true);
    } else if (!session.listed[u][m]) {
      off('NOT FOR SALE', 'Wait for it to list, or pick another.');
    } else {
      const down = downPayment(session, u, m, cfg);
      const ok = canBuy(acct, session, u, m, cfg);
      const what = unit.trophy ? `${price(down)} cash` : `${price(down)} down`;
      this.main.setText(unit.trophy ? 'BUY THE TROPHY' : 'BUY')
        .setSub(ok ? what : `Need ${what}. You have ${price(acct.cash)}.`)
        .setAccent(ok ? UP : 0x3a3550, ok ? UP_CSS : COLORS.textDim).setEnabled(ok);
    }
  }

  /** Where on screen a tap lands on this lot's building (a pixel nothing in front covers), or null. */
  tapPoint(v) {
    const s = v.sprite;
    if (!s.visible) return null;
    const cam = this.mapCam;
    for (let fy = 0.15; fy < 0.95; fy += 0.1) {
      for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) {
        const wx = Math.round(s.x - s.width / 2 + s.width * fx);
        const wy = Math.round(s.y - s.height + s.height * fy);
        const sx = wx - cam.scrollX + MAP.x;
        const sy = wy - cam.scrollY + MAP.y;
        if (sx < MAP.x + 4 || sx > MAP.x + MAP.w - 4 || sy < MAP.y + 4 || sy > MAP.y + MAP.h - 4) continue;
        if (this.pickTag(wx, wy) === null && this.pick(wx, wy) === v.k) return { x: sx, y: sy };
      }
    }
    return null;
  }

  /** Where on screen to tap this lot's price tag (its center, if it's showing, frontmost there, and in view), or null. */
  tagPoint(v) {
    if (!v.tag.visible) return null;
    const b = v.tag.getBounds();
    const wx = Math.round(b.centerX);
    const wy = Math.round(b.centerY);
    const sx = wx - this.mapCam.scrollX + MAP.x;
    const sy = wy - this.mapCam.scrollY + MAP.y;
    if (sx < MAP.x + 4 || sx > MAP.x + MAP.w - 4 || sy < MAP.y + 4 || sy > MAP.y + MAP.h - 4) return null;
    return this.pickTag(wx, wy) === v.k ? { x: sx, y: sy } : null;
  }

  /** Read by the debug hook / smoke test: the news reader's next move, and where to tap each unit. */
  debugState() {
    const move = this.phase === 'open' ? readerMoves(this.session, this.acct, this.month)[0] ?? null : null;
    const units = [];
    for (const v of this.lotViews) {
      const mk = this.lotMonth(v.k);
      const u = lotState(this.session, v.k, mk).unit;
      if (u === undefined) continue;
      const at = this.tapPoint(v);
      const tag = this.tagPoint(v);
      units.push({
        id: u, lot: v.k, x: at?.x ?? null, y: at?.y ?? null, onScreen: !!at, tagX: tag?.x ?? null, tagY: tag?.y ?? null,
        buyable: this.phase === 'open' && canBuy(this.acct, this.session, u, mk),
      });
    }
    return {
      realty: {
        phase: this.phase, month: this.month, clock: this.t, cash: this.acct.cash, owned: [...this.acct.owned.keys()], won: this.acct.won,
        selected: this.selected, selectedUnit: this.selectedUnit(), result: this.result, history: this.acct.history,
        scroll: { x: this.mapCam.scrollX, y: this.mapCam.scrollY },
        chips: this.chips.map((c) => c.last),
      },
      realtyMove: move,
      realtyUnits: units,
      realtyAnswer: this.phase === 'ready' || (this.phase === 'closed' && this.main.enabled) ? this.main.text : null,
    };
  }
}
