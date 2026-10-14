// $cott's phone: the in-game menu (CLAUDE.md §6.7). It opens over a region or
// the overworld map, which pause underneath, and holds the apps in
// data/phone.js: MAP, STONKS (trade for cash), SHOP (spend it), SETTINGS.
//
// $cott starts on a flip phone: a green LCD with chunky pixel lettering
// (ui/pixelFont.js), a 2×2 icon grid, and a keypad whose right soft key goes
// back and whose red key hangs up. The SHOP sells the smartphone upgrade:
// wallpaper, a status bar, a cash widget, and a 4-column grid of app tiles.
// Each model draws its own body and widgets; the apps are written once against
// small helpers (text, button) that draw in the current model's style.

import { GAME_W, GAME_H } from '../config.js';
import { PHONES, APPS, SHOP, STOCKS, ECONOMY } from '../data/phone.js';
import { ITEMS } from '../data/items.js';
import { Save } from '../systems/save.js';
import { Audio } from '../systems/audio.js';
import { rng } from '../systems/rng.js';
import { createMarket, payout, changeLabel, money } from '../systems/stonks.js';
import { VERSION } from '../version.js';
import { pixelText, pixelTextWidth } from '../ui/pixelFont.js';
import { pixelIcon, ICON_SIZE } from '../ui/phoneIcons.js';
import { label, body, fitWidth } from '../ui/text.js';
import { PHONE_ART } from '../data/assets.js';

// Flip phone: a silver clamshell, opened (assets/phone/flip_body.png, PixelLab art
// drawn at 2×; tools/phone-art/build.py). Every rect below was measured from the art,
// and the drawn stand-in uses the same ones, so the LCD and keys line up either way.
const FLIP = {
  body: { x: 168, y: 40, w: 384, h: 1200 },
  lcd: { x: 234, y: 168, w: 252, h: 336 }, // the glass
  content: { x: 242, y: 196, w: 236, h: 282 }, // inside the LCD, between status and soft-key rows
  backKey: { x: 422, y: 690, w: 90, h: 56 }, // right soft key
  endKey: { x: 414, y: 810, w: 86, h: 64 }, // red key
  colors: { lcd: 0xb6c6a2, ink: '#1d2b1a', mid: '#5f7a55', light: '#b6c6a2', inkHex: 0x1d2b1a, midHex: 0x5f7a55 },
};
// Smartphone: PixelLab's gold-framed slab (assets/phone/smart_body.png), with
// the wallpaper already in its glass. `screen` is that glass, measured from the
// art (tools/phone-art/build.py prints it).
const SMART = {
  body: { x: 108, y: 84, w: 504, h: 1112 },
  screen: { x: 148, y: 110, w: 422, h: 1054 },
  content: { x: 168, y: 168, w: 384, h: 960 },
  homeBar: { y: 1146, w: 150 },
};
// Text sizes per model: flip = px per font pixel; smart = Press Start / VT323 px.
const FLIP_PX = { s: 2, m: 3, l: 4, xl: 5 };
const SMART_LABEL = { s: 12, m: 16, l: 22, xl: 34 };
const SMART_BODY = { s: 24, m: 30, l: 36, xl: 48 };
const STOCK_MOOD = { HODL: 'SAFE', APE: 'SPICY', MOON: 'DEGEN' };

export default class PhoneScene extends Phaser.Scene {
  constructor() {
    super('Phone');
  }

  init(data) {
    this.from = data?.from ?? null; // the scene paused underneath
  }

  create() {
    // The scene object is reused each time the phone opens, so reset everything.
    this.targets = [];
    this.chrome = [];
    this.page = 'home';
    this.market = null;
    this.marketTimer = null;
    this.root = null;
    this.closing = false;
    this.resetArmed = false;
    // Dim the game; tapping outside the phone puts it away.
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.65).setOrigin(0).setInteractive()
      .on('pointerup', (p) => {
        if (!this.inBody(p.x, p.y)) this.close();
      });
    this.build(true);
  }

  get model() {
    return Save.phone;
  }

  get flip() {
    return this.model === 'flip';
  }

  inBody(x, y) {
    const r = this.flip ? FLIP.body : SMART.body;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /** Draw the phone body for the current model, then its home screen. */
  build(slideIn = false) {
    this.root?.destroy();
    this.root = this.add.container(0, 0);
    this.chrome = []; // targets that belong to the body (soft keys, home bar)
    if (this.flip) this.drawFlip();
    else this.drawSmart();
    this.pageLayer = this.add.container(0, 0);
    this.root.add(this.pageLayer);
    // The glass's glare sits over whatever the LCD shows.
    if (this.flip && this.textures.exists('phone_flip_glare')) {
      this.root.add(this.add.image(FLIP.body.x, FLIP.body.y, 'phone_flip_glare').setOrigin(0).setAlpha(0.3));
    }
    this.home();
    if (slideIn) {
      this.root.y = GAME_H;
      this.tweens.add({ targets: this.root, y: 0, duration: 260, ease: 'Back.easeOut' });
      Audio.sfx('blip');
    }
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    this.stopMarket();
    this.tweens.add({
      targets: this.root, y: GAME_H, duration: 200, ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.from) this.scene.resume(this.from);
        this.scene.stop();
      },
    });
  }

  // ---- Bodies ----------------------------------------------------------------------

  preload() {
    for (const { key, path } of PHONE_ART) if (path && !this.textures.exists(key)) this.load.image(key, path);
  }

  drawFlip() {
    const { body, lcd, backKey, endKey, colors } = FLIP;
    if (this.textures.exists('phone_flip')) {
      this.root.add(this.add.image(body.x, body.y, 'phone_flip').setOrigin(0));
    } else {
      this.drawFlipStandIn();
    }
    // The LCD itself: the game's screen goes over the art's glass.
    this.root.add(this.add.rectangle(lcd.x, lcd.y, lcd.w, lcd.h, colors.lcd).setOrigin(0));
    // Working keys: right soft key = back, red key = hang up. Their labels sit on the LCD's bottom row.
    this.chromeTap(backKey.x, backKey.y, backKey.w, backKey.h, 'BACK', () => this.back());
    this.chromeTap(endKey.x, endKey.y, endKey.w, endKey.h, 'END', () => this.close());
    this.statusRow = this.add.container(0, 0);
    this.root.add(this.statusRow);
    this.refreshStatus();
  }

  /** A drawn flip phone in the art's layout, in case assets/phone/flip_body.png is missing. */
  drawFlipStandIn() {
    const { body, lcd, backKey, endKey } = FLIP;
    const g = this.add.graphics();
    this.root.add(g);
    const lidH = lcd.y + lcd.h + 80 - body.y;
    const shell = (y, h) => {
      g.fillStyle(0x4a4e58, 1).fillRoundedRect(body.x, y, body.w, h, 44);
      g.fillStyle(0xb9bdc7, 1).fillRoundedRect(body.x + 4, y + 4, body.w - 8, h - 8, 40);
    };
    shell(body.y, lidH);
    shell(body.y + lidH + 24, body.h - lidH - 24);
    g.fillStyle(0x23262d, 1).fillRoundedRect(lcd.x - 16, lcd.y - 16, lcd.w + 32, lcd.h + 32, 14);
    const key = (r, fill = 0xe6e8ee) => {
      g.fillStyle(0x6e737e, 1).fillRoundedRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 12);
      g.fillStyle(fill, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 10);
    };
    const mirror = (r) => ({ ...r, x: body.x + body.w - (r.x - body.x) - r.w });
    key(backKey);
    key(mirror(backKey));
    key(endKey, 0xe2574c);
    key(mirror(endKey), 0x7ccf6a);
    g.fillStyle(0xe6e8ee, 1).fillCircle(GAME_W / 2, backKey.y + 60, 34);
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].forEach((k, i) => {
      const r = { x: 222 + (i % 3) * 96, y: 904 + Math.floor(i / 3) * 76, w: 84, h: 58 };
      key(r);
      this.root.add(pixelText(this, Math.round(r.x + 42 - pixelTextWidth(k, 4) / 2), r.y + 19, k, { px: 4, color: '#3a3e48' }));
    });
  }

  drawSmart() {
    const { body: b, homeBar } = SMART;
    if (this.textures.exists('phone_smart')) this.root.add(this.add.image(b.x, b.y, 'phone_smart').setOrigin(0));
    else this.drawSmartStandIn();
    const g = this.add.graphics();
    this.root.add(g);
    // Home bar: in an app it goes home; on the home screen it puts the phone away.
    g.fillStyle(0xffffff, 0.75).fillRoundedRect(GAME_W / 2 - homeBar.w / 2, homeBar.y, homeBar.w, 8, 4);
    this.chromeTap(GAME_W / 2 - 120, homeBar.y - 22, 240, 44, 'HOME', () => (this.page === 'home' ? this.close() : this.home()));
    this.statusRow = this.add.container(0, 0);
    this.root.add(this.statusRow);
    this.refreshStatus();
  }

  /** A drawn smartphone, for when its art is missing: a slab with a sunset in bands. */
  drawSmartStandIn() {
    const { body: b, screen: s } = SMART;
    const g = this.add.graphics();
    this.root.add(g);
    g.fillStyle(0x2b2b36, 1).fillRoundedRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 64);
    g.fillStyle(0x0c0c12, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 60);
    const bands = 24;
    const top = Phaser.Display.Color.ValueToColor(0x1d0f3a);
    const bottom = Phaser.Display.Color.ValueToColor(0x8a2a5c);
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
      const y0 = s.y + Math.floor((s.h * i) / bands);
      const y1 = s.y + Math.floor((s.h * (i + 1)) / bands);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(s.x, y0, s.w, y1 - y0);
    }
    // Round the screen's corners by painting the body color back over them.
    g.lineStyle(28, 0x0c0c12, 1).strokeRoundedRect(s.x - 12, s.y - 12, s.w + 24, s.h + 24, 56);
    // The camera pill.
    g.fillStyle(0x000000, 1).fillRoundedRect(GAME_W / 2 - 50, s.y + 10, 100, 28, 14);
  }

  /** The status row: cash on both models, plus a clock and battery on the smartphone. */
  refreshStatus() {
    this.statusRow.removeAll(true);
    if (this.flip) {
      const { lcd, colors } = FLIP;
      const cash = money(Save.cash);
      this.statusRow.add(pixelText(this, lcd.x + 8, lcd.y + 6, cash, { px: 2, color: colors.ink }));
      // Signal bars.
      const g = this.add.graphics().fillStyle(colors.inkHex, 1);
      for (let i = 0; i < 4; i++) g.fillRect(lcd.x + lcd.w - 36 + i * 7, lcd.y + 14 - i * 3, 4, 3 + i * 3);
      g.fillRect(lcd.x + 4, lcd.y + 22, lcd.w - 8, 2);
      g.fillRect(lcd.x + 4, lcd.y + lcd.h - 24, lcd.w - 8, 2);
      this.statusRow.add(g);
      const backLabel = this.page === 'home' ? 'EXIT' : 'BACK';
      this.statusRow.add(pixelText(this, lcd.x + lcd.w - 8 - pixelTextWidth(backLabel, 2), lcd.y + lcd.h - 16, backLabel, { px: 2, color: colors.ink }));
    } else {
      const s = SMART.screen;
      this.statusRow.add(label(this, s.x + 34, s.y + 22, '9:41', 14, { strokeThickness: 0 }));
      const cash = label(this, 0, s.y + 22, money(Save.cash), 14, { color: '#ffd166', strokeThickness: 0 });
      cash.x = s.x + s.w - 34 - cash.width;
      this.statusRow.add(cash);
    }
  }

  /** A tap target that's part of the phone body (it survives page changes). */
  chromeTap(x, y, w, h, name, fn) {
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    zone.on('pointerup', () => {
      Audio.sfx('blip');
      fn();
    });
    this.root.add(zone);
    this.chrome.push({ text: name, x: x + w / 2, y: y + h / 2, enabled: true, zone });
  }

  // ---- Page helpers ------------------------------------------------------------------

  clearPage(page) {
    this.stopMarket();
    if (page !== 'settings') this.resetArmed = false;
    this.page = page;
    this.pageLayer.removeAll(true);
    this.targets = [];
    this.refreshStatus();
  }

  /** Text in the current model's style. `size`: s, m, l, xl. Returns its width. */
  text(x, y, str, { size = 'm', color = null, align = 'left', font = 'label', maxW = null } = {}) {
    let obj;
    if (this.flip) {
      let px = FLIP_PX[size];
      while (maxW && px > 2 && pixelTextWidth(str, px) > maxW) px -= 1;
      const w = pixelTextWidth(str, px);
      const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      obj = pixelText(this, Math.round(left), Math.round(y), str, { px, color: color ?? FLIP.colors.ink });
    } else {
      const make = font === 'body' ? body : label;
      const sizes = font === 'body' ? SMART_BODY : SMART_LABEL;
      obj = make(this, x, y, str, sizes[size], { color: color ?? '#ffffff', strokeThickness: 0 });
      if (maxW) fitWidth(obj, maxW, 8);
      obj.setOrigin(align === 'center' ? 0.5 : align === 'right' ? 1 : 0, 0);
    }
    this.pageLayer.add(obj);
    return obj;
  }

  /** A tappable button in the current model's style. */
  button(x, y, w, h, str, onTap, { enabled = true, accent = 0x1f6feb, sub = null } = {}) {
    const g = this.add.graphics();
    if (this.flip) {
      const { inkHex, midHex } = FLIP.colors;
      g.lineStyle(3, enabled ? inkHex : midHex, 1).strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    } else {
      g.fillStyle(enabled ? accent : 0x3a3550, enabled ? 1 : 0.7).fillRoundedRect(x, y, w, h, 16);
    }
    this.pageLayer.add(g);
    const color = this.flip ? (enabled ? FLIP.colors.ink : FLIP.colors.mid) : enabled ? '#ffffff' : '#8f88a8';
    const ty = sub ? y + h / 2 - (this.flip ? 16 : 16) : y + h / 2 - (this.flip ? 7 : 8);
    this.text(x + w / 2, ty, str, { size: 'm', color, align: 'center', maxW: w - 16 });
    if (sub) this.text(x + w / 2, y + h / 2 + (this.flip ? 5 : 4), sub, { size: 's', color, align: 'center', font: 'body', maxW: w - 16 });
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    zone.on('pointerdown', () => {
      if (!enabled) return;
      if (this.flip) g.fillStyle(FLIP.colors.inkHex, 0.25).fillRect(x, y, w, h);
      else g.setAlpha(0.7);
    });
    zone.on('pointerup', () => {
      if (!enabled) return Audio.sfx('bad');
      Audio.sfx('blip');
      onTap();
    });
    this.pageLayer.add(zone);
    this.targets.push({ text: str, x: x + w / 2, y: y + h / 2, enabled });
    return g;
  }

  /** A page title, with a back arrow on the smartphone (the flip phone has a BACK key). */
  header(title, accent) {
    const c = this.flip ? FLIP.content : SMART.content;
    if (this.flip) {
      this.text(c.x + c.w / 2, c.y, title, { size: 'l', align: 'center' });
    } else {
      const g = this.add.graphics().fillStyle(0x0e0b1a, 0.9).fillRoundedRect(c.x - 6, c.y - 6, c.w + 12, c.h - 30, 26);
      this.pageLayer.add(g);
      this.pageLayer.add(pixelIcon(this, c.x + 10, c.y + 12, 'back', { px: 3, color: '#ffffff' }));
      const zone = this.add.zone(c.x, c.y, 120, 56).setOrigin(0).setInteractive().on('pointerup', () => this.back());
      this.pageLayer.add(zone);
      this.targets.push({ text: 'BACK', x: c.x + 60, y: c.y + 28, enabled: true });
      this.text(c.x + c.w / 2, c.y + 18, title, { size: 'l', align: 'center', color: Phaser.Display.Color.IntegerToColor(accent).rgba });
    }
  }

  back() {
    if (this.page === 'home') return this.close();
    if (this.page === 'stonks-live') return this.sell('SOLD');
    if (this.page === 'stonks-stake' || this.page === 'stonks-result') return this.stonks();
    this.home();
  }

  // ---- Home ----------------------------------------------------------------------------

  home() {
    this.clearPage('home');
    const apps = APPS;
    if (this.flip) {
      const c = FLIP.content;
      this.text(c.x + c.w / 2, c.y, 'MENU', { size: 'l', align: 'center' });
      const cols = PHONES.flip.cols;
      const cell = { w: c.w / cols, h: 124 };
      apps.forEach((app, i) => {
        const cx = c.x + (i % cols) * cell.w + cell.w / 2;
        const top = c.y + 30 + Math.floor(i / cols) * cell.h;
        const icon = `phone_icon_flip_${app.id}`;
        if (this.textures.exists(icon)) {
          this.pageLayer.add(this.add.image(Math.round(cx - 24), top + 8, icon).setOrigin(0));
        } else {
          this.pageLayer.add(pixelIcon(this, Math.round(cx - 22), top + 10, app.icon, { px: 5, color: FLIP.colors.ink }));
        }
        this.text(cx, top + 66, app.name, { size: 'm', align: 'center', maxW: cell.w - 8 });
        this.appTap(app, cx - cell.w / 2 + 4, top, cell.w - 8, cell.h - 6);
      });
    } else {
      const c = SMART.content;
      // A cash widget across the top.
      const g = this.add.graphics().fillStyle(0xffffff, 0.12).fillRoundedRect(c.x, c.y, c.w, 150, 28);
      this.pageLayer.add(g);
      this.text(c.x + 26, c.y + 22, "$COTT'S BAG", { size: 's', color: '#e2d9ff' });
      this.text(c.x + 26, c.y + 52, money(Save.cash), { size: 'xl', color: '#ffd166' });
      this.text(c.x + 26, c.y + 104, `STONKS TRADES LEFT ${Save.trades}/${ECONOMY.tradesPerFight}`, { size: 's', color: '#e2d9ff' });
      const cols = PHONES.smart.cols;
      const pitch = c.w / cols;
      const tile = 64; // the PixelLab tiles are 32 art px at 2×
      apps.forEach((app, i) => {
        const cx = c.x + (i % cols) * pitch + pitch / 2;
        const top = c.y + 190 + Math.floor(i / cols) * 130;
        const icon = `phone_icon_smart_${app.id}`;
        if (this.textures.exists(icon)) {
          this.pageLayer.add(this.add.image(Math.round(cx - tile / 2), top, icon).setOrigin(0));
        } else {
          const t = this.add.graphics();
          t.fillStyle(0x000000, 0.35).fillRoundedRect(cx - tile / 2 + 3, top + 5, tile, tile, 18);
          t.fillStyle(app.color, 1).fillRoundedRect(cx - tile / 2, top, tile, tile, 18);
          this.pageLayer.add(t);
          this.pageLayer.add(pixelIcon(this, Math.round(cx - 18), Math.round(top + tile / 2 - 18), app.icon, { px: 4, color: '#ffffff' }));
        }
        this.text(cx, top + tile + 10, app.name, { size: 's', align: 'center', font: 'body' });
        this.appTap(app, cx - pitch / 2 + 6, top - 6, pitch - 12, tile + 44);
      });
    }
  }

  appTap(app, x, y, w, h) {
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive().on('pointerup', () => {
      Audio.sfx('blip');
      this.openApp(app.id);
    });
    this.pageLayer.add(zone);
    this.targets.push({ text: app.name, x: x + w / 2, y: y + h / 2, enabled: true });
  }

  openApp(id) {
    if (id === 'map') return this.openMap();
    if (id === 'stonks') return this.stonks();
    if (id === 'shop') return this.shop();
    if (id === 'settings') return this.settings();
  }

  // ---- MAP ------------------------------------------------------------------------------

  /** From a region, head out to the overworld map; on the map already, just put the phone away. */
  openMap() {
    if (this.from !== 'Region') return this.close();
    this.stopMarket();
    this.scene.stop('Region');
    this.scene.start('Overworld');
  }

  // ---- STONKS ---------------------------------------------------------------------------

  stonks() {
    this.clearPage('stonks');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'stonks').color;
    this.header('STONKS', accent);
    const top = c.y + (this.flip ? 28 : 90);
    this.text(c.x + c.w / 2, top, `TRADES LEFT ${Save.trades}/${ECONOMY.tradesPerFight}`, { size: 's', align: 'center', font: 'body' });
    if (Save.trades <= 0) {
      this.text(c.x + c.w / 2, top + 50, 'MARKET CLOSED', { size: 'm', align: 'center' });
      this.text(c.x + c.w / 2, top + 90, 'WIN A FIGHT TO REOPEN', { size: 's', align: 'center', font: 'body' });
      return;
    }
    if (Save.cash < ECONOMY.stakes[0]) {
      this.text(c.x + c.w / 2, top + 50, 'TOO BROKE TO TRADE', { size: 'm', align: 'center', maxW: c.w });
      return;
    }
    this.text(c.x + c.w / 2, top + (this.flip ? 16 : 50), 'PICK A TICKER', { size: 'm', align: 'center' });
    const rowH = this.flip ? 60 : 120;
    STOCKS.forEach((stock, i) => {
      const y = top + (this.flip ? 38 : 100) + i * (rowH + (this.flip ? 5 : 16));
      this.button(c.x, y, c.w, rowH, `$${stock.id}`, () => this.pickStake(stock), { accent, sub: `${stock.name} - ${STOCK_MOOD[stock.id] ?? ''}` });
    });
  }

  pickStake(stock) {
    this.clearPage('stonks-stake');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'stonks').color;
    this.header(`$${stock.id}`, accent);
    const top = c.y + (this.flip ? 30 : 100);
    this.text(c.x + c.w / 2, top, 'HOW MUCH?', { size: 'm', align: 'center' });
    const rowH = this.flip ? 58 : 110;
    ECONOMY.stakes.forEach((stake, i) => {
      const y = top + (this.flip ? 24 : 60) + i * (rowH + (this.flip ? 6 : 16));
      this.button(c.x, y, c.w, rowH, money(stake), () => this.trade(stock, stake), { enabled: Save.cash >= stake, accent });
    });
  }

  trade(stock, stake) {
    if (Save.trades <= 0 || Save.cash < stake) return this.stonks();
    Save.useTrade();
    Save.spend(stake);
    this.clearPage('stonks-live');
    this.market = createMarket(stock, rng);
    this.stake = stake;
    this.ticks = 0;
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'stonks').color;
    this.header(`$${stock.id}`, accent);
    this.liveTop = c.y + (this.flip ? 28 : 100);
    this.liveLayer = this.add.container(0, 0);
    this.pageLayer.add(this.liveLayer);
    const btnH = this.flip ? 58 : 120;
    this.button(c.x, c.y + c.h - btnH - (this.flip ? 0 : 60), c.w, btnH, 'SELL', () => this.sell('SOLD'), { accent: 0x2ea043 });
    this.drawLive();
    this.marketTimer = this.time.addEvent({
      delay: ECONOMY.tickMs,
      loop: true,
      callback: () => {
        this.market.tick();
        this.ticks += 1;
        if (this.market.rugged) return this.sell('RUGGED!');
        if (this.ticks >= ECONOMY.maxTicks) return this.sell('MARKET CLOSED');
        this.drawLive();
      },
    });
  }

  /** The live ticker: the flip phone shows numbers and an arrow; the smartphone adds a chart. */
  drawLive() {
    const { market, stake } = this;
    const c = this.flip ? FLIP.content : SMART.content;
    const up = market.price >= 1;
    this.liveLayer.removeAll(true);
    const add = (o) => {
      this.pageLayer.remove(o);
      this.liveLayer.add(o);
      return o;
    };
    const good = this.flip ? FLIP.colors.ink : '#3ddc84';
    const bad = this.flip ? FLIP.colors.ink : '#ff5c8a';
    const left = Math.max(0, Math.ceil(((ECONOMY.maxTicks - this.ticks) * ECONOMY.tickMs) / 1000));
    add(this.text(c.x + c.w / 2, this.liveTop, `CLOSES IN ${left}S`, { size: 's', align: 'center', font: 'body' }));
    add(this.text(c.x + c.w / 2, this.liveTop + (this.flip ? 18 : 50), money(payout(stake, market.price)), { size: 'xl', align: 'center', color: up ? good : bad }));
    add(this.text(c.x + c.w / 2, this.liveTop + (this.flip ? 50 : 110), changeLabel(market.price), { size: 'm', align: 'center', color: up ? good : bad }));
    if (this.flip) {
      const px = 4;
      add(pixelIcon(this, Math.round(c.x + c.w / 2 - (ICON_SIZE * px) / 2), this.liveTop + 74, up ? 'up' : 'down', { px, color: FLIP.colors.ink }));
      return;
    }
    // The chart: the whole run so far, scaled to fit, with the buy-in as a dashed line.
    const box = { x: c.x, y: this.liveTop + 160, w: c.w, h: 420 };
    const g = add(this.add.graphics());
    g.fillStyle(0x000000, 0.35).fillRoundedRect(box.x, box.y, box.w, box.h, 18);
    const h = market.history;
    const lo = Math.min(0.8, ...h);
    const hi = Math.max(1.2, ...h);
    const px = (i) => box.x + 14 + (i / Math.max(ECONOMY.maxTicks, h.length - 1)) * (box.w - 28);
    const py = (v) => box.y + box.h - 14 - ((v - lo) / (hi - lo)) * (box.h - 28);
    g.lineStyle(2, 0xffffff, 0.3);
    for (let x = box.x + 14; x < box.x + box.w - 14; x += 18) g.lineBetween(x, py(1), x + 9, py(1));
    g.lineStyle(4, up ? 0x3ddc84 : 0xff5c8a, 1).beginPath();
    h.forEach((v, i) => (i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v))));
    g.strokePath();
  }

  sell(reason) {
    if (!this.market) return;
    const value = payout(this.stake, this.market.price);
    const profit = value - this.stake;
    this.stopMarket();
    Save.earn(value);
    Audio.sfx(profit >= 0 ? 'good' : 'bad');
    this.clearPage('stonks-result');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'stonks').color;
    this.header(reason, accent);
    const top = c.y + (this.flip ? 34 : 120);
    const good = this.flip ? FLIP.colors.ink : '#3ddc84';
    const bad = this.flip ? FLIP.colors.ink : '#ff5c8a';
    this.text(c.x + c.w / 2, top, `${profit >= 0 ? '+' : '-'}${money(Math.abs(profit))}`, { size: 'xl', align: 'center', color: profit >= 0 ? good : bad });
    const quips = this.flip
      ? ['PROFIT HANDS.', 'BROKE EVEN.', 'NOT ADVICE.']
      : ['Diamond hands? Paper hands. PROFIT hands.', 'Broke even. Peak efficiency.', 'Not financial advice. Clearly.'];
    const quip = quips[profit > 0 ? 0 : profit === 0 ? 1 : 2];
    this.text(c.x + c.w / 2, top + (this.flip ? 34 : 80), quip, { size: 's', align: 'center', font: 'body', maxW: c.w });
    const btnH = this.flip ? 56 : 110;
    const y = c.y + c.h - btnH * 2 - (this.flip ? 6 : 80);
    this.button(c.x, y, c.w, btnH, 'AGAIN', () => this.stonks(), { enabled: Save.trades > 0 && Save.cash >= ECONOMY.stakes[0], accent });
    this.button(c.x, y + btnH + (this.flip ? 6 : 16), c.w, btnH, 'DONE', () => this.home(), { accent: 0x3a3550 });
  }

  stopMarket() {
    this.marketTimer?.remove();
    this.marketTimer = null;
    this.market = null;
  }

  // ---- SHOP -----------------------------------------------------------------------------

  shop() {
    this.clearPage('shop');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'shop').color;
    this.header('SHOP', accent);
    const top = c.y + (this.flip ? 28 : 100);
    const rowH = this.flip ? 80 : 150;
    SHOP.forEach((entry, i) => {
      const y = top + i * (rowH + (this.flip ? 4 : 18));
      const item = ITEMS[entry.id];
      const owned = entry.kind === 'phone' ? Save.phone === entry.phone : false;
      const name = entry.kind === 'phone' ? entry.name : this.flip ? item.short : item.name.toUpperCase();
      // The flip phone's LCD only has room for the count.
      const have = entry.kind === 'phone'
        ? (owned ? 'OWNED' : this.flip ? 'UPGRADE' : entry.desc)
        : this.flip ? `HAVE ${Save.stash(entry.id)}` : `${item.desc} Have ${Save.stash(entry.id)}.`;
      const price = owned ? 'OWNED' : money(entry.price);
      this.button(c.x, y, c.w, rowH, `${name} ${price}`, () => this.buy(entry), {
        enabled: !owned && Save.cash >= entry.price, accent, sub: have,
      });
    });
    if (!this.flip) this.text(c.x + c.w / 2, top + SHOP.length * 168 + 10, 'Shop items stack on top of your free ones each fight.', { size: 's', align: 'center', font: 'body', maxW: c.w });
  }

  buy(entry) {
    if (!Save.spend(entry.price)) return;
    if (entry.kind === 'phone') {
      Save.setPhone(entry.phone);
      Audio.sfx('crit');
      // Out with the clamshell, in with the slab.
      this.tweens.add({
        targets: this.root, y: GAME_H, duration: 220, ease: 'Quad.easeIn',
        onComplete: () => this.build(true),
      });
      return;
    }
    Save.addStash(entry.id, 1);
    Audio.sfx('heal');
    this.shop();
  }

  // ---- SETTINGS -------------------------------------------------------------------------

  settings() {
    this.clearPage('settings');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'settings').color;
    this.header('SETTINGS', accent);
    const top = c.y + (this.flip ? 28 : 100);
    const rowH = this.flip ? 56 : 110;
    const gap = this.flip ? 6 : 16;
    this.button(c.x, top, c.w, rowH, Audio.muted ? 'SOUND: OFF' : 'SOUND: ON', () => {
      Audio.toggleMute();
      this.settings();
    }, { accent });
    this.button(c.x, top + rowH + gap, c.w, rowH, this.resetArmed ? 'TAP AGAIN TO WIPE' : 'RESET PROGRESS', () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        return this.settings();
      }
      Save.reset();
      this.stopMarket();
      if (this.from) this.scene.stop(this.from);
      this.scene.start('Title');
    }, { accent: 0xb3261e });
    const info = top + (rowH + gap) * 2 + (this.flip ? 6 : 20);
    this.text(c.x + c.w / 2, info, PHONES[this.model].name, { size: 's', align: 'center', font: 'body' });
    this.text(c.x + c.w / 2, info + (this.flip ? 16 : 36), `V${VERSION}`, { size: 's', align: 'center', font: 'body' });
  }

  /** Read by the debug hook / smoke test. Points are canvas coordinates. */
  debugState() {
    return {
      phone: this.model,
      page: this.page,
      cash: Save.cash,
      trades: Save.trades,
      market: this.market ? { price: this.market.price, ticks: this.ticks } : null,
      targets: [...this.chrome, ...this.targets].map(({ text, x, y, enabled }) => ({ text, x, y, enabled })),
    };
  }
}
