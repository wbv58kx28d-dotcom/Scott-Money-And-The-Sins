// $cott's phone: the in-game menu (CLAUDE.md §6.7). It opens over a region or
// the overworld map, which pause underneath, and holds the apps in
// data/phone.js: MAP, Y ($cott's social app, scenes/SocialScene.js), STONKS
// (stake cash on $cott's day trade, minigames/trade.js), REALTY, SHOP (spend
// it), SETTINGS. A big Stonks or Realty win posts itself to Y for Clout.
//
// $cott starts on a flip phone: a green LCD with chunky pixel lettering
// (ui/pixelFont.js), a 2×2 icon grid, and a keypad whose right soft key goes
// back and whose red key hangs up. The SHOP sells the smartphone upgrade:
// wallpaper, a status bar, a cash widget, and a 4-column grid of app tiles.
// Each model draws its own body and widgets; the apps are written once against
// small helpers (text, button) that draw in the current model's style. While
// the phone is a work in progress, SETTINGS can swap models for testing.

import { GAME_W, GAME_H } from '../config.js';
import { PHONES, APPS, SHOP, ECONOMY, WIFI } from '../data/phone.js';
import { TRADE } from '../data/trade.js';
import { ITEMS } from '../data/items.js';
import { Save } from '../systems/save.js';
import { Audio } from '../systems/audio.js';
import { rng } from '../systems/rng.js';
import { money, pct } from '../systems/market.js';
import trade from '../minigames/trade.js';
import realty from '../minigames/realty.js';
import social from './SocialScene.js';
import { formatClout, fillIn } from '../systems/social.js';
import { SOCIAL, MOMENTS } from '../data/social.js';
import { socialNews } from '../ui/badge.js';
import { REALTY, CITIES } from '../data/realty.js';
import { price } from '../systems/realty.js';
import { VERSION } from '../version.js';
import { pixelText, pixelTextWidth } from '../ui/pixelFont.js';
import { pixelIcon } from '../ui/phoneIcons.js';
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
    this.trading = false;
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
    if (this.page === 'stonks-result') return this.stonks();
    if (this.page === 'realty-result') return this.realty();
    if (this.page === 'wifi-traced') return this.close();
    this.home();
  }

  // ---- Home ----------------------------------------------------------------------------

  home() {
    this.clearPage('home');
    const apps = APPS.filter((a) => !a.gift || Save.hasApp(a.id)); // gifted apps once he has them
    if (this.flip) {
      const c = FLIP.content;
      this.text(c.x + c.w / 2, c.y, 'MENU', { size: 'l', align: 'center' });
      const cols = PHONES.flip.cols;
      const rows = Math.ceil(apps.length / cols);
      // Rows shrink to fit the LCD as apps are added; a short last row is centered.
      const cell = { w: c.w / cols, h: Math.min(124, Math.floor((c.h - 30) / rows)) };
      const pad = cell.h < 100 ? 2 : 8;
      apps.forEach((app, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, apps.length - row * cols);
        const cx = c.x + (c.w - inRow * cell.w) / 2 + (i % cols) * cell.w + cell.w / 2;
        const top = c.y + 30 + row * cell.h;
        const icon = `phone_icon_flip_${app.id}`;
        if (this.textures.exists(icon)) {
          this.pageLayer.add(this.add.image(Math.round(cx - 24), top + pad, icon).setOrigin(0));
        } else {
          this.pageLayer.add(pixelIcon(this, Math.round(cx - 22), top + pad + 2, app.icon, { px: 5, color: FLIP.colors.ink }));
        }
        this.text(cx, top + pad + 56, app.name, { size: 'm', align: 'center', maxW: cell.w - 8 });
        if (app.id === 'social') this.newsDot(cx + 26, top + pad + 2);
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
      this.text(c.x + c.w - 26, c.y + 22, 'CLOUT', { size: 's', color: '#e2d9ff', align: 'right' });
      this.text(c.x + c.w - 26, c.y + 52, formatClout(Save.clout), { size: 'l', color: '#ff8ad8', align: 'right' });
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
        if (app.id === 'social') this.newsDot(cx + tile / 2 - 4, top + 4);
        this.appTap(app, cx - pitch / 2 + 6, top - 6, pitch - 12, tile + 44);
      });
    }
  }

  /** What's new in the social app, as a count on its icon. */
  newsDot(x, y) {
    const n = socialNews();
    if (!n) return;
    const g = this.add.graphics();
    if (this.flip) g.fillStyle(FLIP.colors.inkHex, 1).fillCircle(x, y, 13);
    else g.fillStyle(0x0d0820, 1).fillCircle(x, y, 17).fillStyle(0xe0245e, 1).fillCircle(x, y, 14);
    this.pageLayer.add(g);
    const str = n > 9 ? '9+' : String(n);
    if (this.flip) this.pageLayer.add(pixelText(this, Math.round(x - pixelTextWidth(str, 2) / 2), y - 5, str, { px: 2, color: FLIP.colors.light }));
    else this.pageLayer.add(label(this, Math.round(x), Math.round(y + 1), str, 12, { strokeThickness: 0 }).setOrigin(0.5));
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
    if (id === 'social') return this.openSocial();
    if (id === 'stonks') return this.stonks();
    if (id === 'realty') return this.realty();
    if (id === 'shop') return this.shop();
    if (id === 'settings') return this.settings();
    if (id === 'wifi') return this.wifi();
  }

  // ---- MAP ------------------------------------------------------------------------------

  /** From a region, head out to the overworld map; on the map already, just put the phone away. */
  openMap() {
    if (this.from !== 'Region') return this.close();
    this.scene.stop('Region');
    this.scene.start('Overworld');
  }

  // ---- Y (the social app) -----------------------------------------------------------------
  // It takes the whole screen (scenes/SocialScene.js); the phone comes back on its home screen.

  async openSocial() {
    if (this.trading) return;
    this.trading = true;
    this.page = 'social';
    this.root.setVisible(false);
    await social.run(this);
    this.trading = false;
    this.root.setVisible(true);
    this.home();
  }

  /** A big moment posts itself: $cott's own post in the feed, and the Clout it earned. */
  brag(text, gain, tag) {
    if (!gain) return;
    Save.addClout(gain);
    const likes = gain * rng.int(18, 30);
    Save.addMine({
      text, tag, gain, label: 'BIG MOMENT', likes, reposts: Math.round(likes * 0.2), replies: Math.round(likes * 0.05), reactions: [],
    });
  }

  // ---- STONKS ---------------------------------------------------------------------------
  // Stake some cash on $cott's day trade (minigames/trade.js). The phone steps
  // aside while it plays, then shows what came back.

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
    this.text(c.x + c.w / 2, top + (this.flip ? 16 : 50), this.flip ? 'STAKE?' : 'HOW MUCH GOES IN?', { size: 'm', align: 'center' });
    const rowH = this.flip ? 58 : 110;
    const first = top + (this.flip ? 38 : 100);
    ECONOMY.stakes.forEach((stake, i) => {
      const y = first + i * (rowH + (this.flip ? 6 : 16));
      this.button(c.x, y, c.w, rowH, money(stake), () => this.trade(stake), { enabled: Save.cash >= stake, accent });
    });
    if (!this.flip) {
      const y = first + ECONOMY.stakes.length * (rowH + 16) + 20;
      ['BUY goes all in. SELL cashes out.', `${TRADE.seconds} seconds to the closing bell.`, 'Whatever the trade is worth then is yours.'].forEach((line, i) => {
        this.text(c.x + c.w / 2, y + i * 34, line, { size: 's', align: 'center', font: 'body', color: '#e2d9ff', maxW: c.w });
      });
    }
  }

  async trade(stake) {
    if (this.trading || Save.trades <= 0 || Save.cash < stake) return;
    Save.useTrade();
    Save.spend(stake);
    this.trading = true;
    this.page = 'stonks-trade';
    // The day trade takes the whole screen; the phone comes back for the result.
    this.root.setVisible(false);
    const ticker = rng.pick(ECONOMY.tickers);
    const { grade, value } = await trade.run(this, { context: { title: 'STONKS', ticker, cash: stake } });
    Save.earn(value);
    // A big win posts itself.
    const clout = SOCIAL.moments.stonks[grade] ?? 0;
    this.brag(fillIn(MOMENTS.stonks, { pct: pct(value / stake - 1), ticker }), clout, 'STONKS');
    this.trading = false;
    this.root.setVisible(true);
    this.result(stake, value, grade, clout);
  }

  result(stake, value, gradeId, clout = 0) {
    const profit = value - stake;
    this.clearPage('stonks-result');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'stonks').color;
    // The trade's grades are measured against Brad's 25% goal; here any profit is a win.
    const grade = TRADE.grades.find((g) => g.id === gradeId);
    const quips = this.flip
      ? ['PROFIT HANDS.', 'BROKE EVEN.', 'NOT ADVICE.']
      : ['Diamond hands? Paper hands. PROFIT hands.', 'Broke even. Peak efficiency.', 'Not financial advice. Clearly.'];
    const quip = gradeId !== 'fail' && grade ? grade.label : quips[profit > 0 ? 0 : profit === 0 ? 1 : 2];
    this.header(profit >= 0 ? 'PROFIT' : 'LOSS', accent);
    const top = c.y + (this.flip ? 34 : 120);
    const good = this.flip ? FLIP.colors.ink : '#3ddc84';
    const bad = this.flip ? FLIP.colors.ink : '#ff5c8a';
    this.text(c.x + c.w / 2, top, `${profit >= 0 ? '+' : '-'}${money(Math.abs(profit))}`, { size: 'xl', align: 'center', color: profit >= 0 ? good : bad });
    if (this.flip) {
      this.text(c.x + c.w / 2, top + 34, `${pct(value / stake - 1)}  ${quip}`, { size: 's', align: 'center', font: 'body', maxW: c.w });
    } else {
      this.text(c.x + c.w / 2, top + 80, pct(value / stake - 1), { size: 'm', align: 'center', color: profit >= 0 ? good : bad });
      this.text(c.x + c.w / 2, top + 130, quip, { size: 's', align: 'center', font: 'body', color: '#e2d9ff', maxW: c.w });
    }
    const btnH = this.flip ? 56 : 110;
    const y = c.y + c.h - btnH * 2 - (this.flip ? 6 : 80);
    if (clout) this.text(c.x + c.w / 2, y - (this.flip ? 18 : 56), `POSTED IT. +${formatClout(clout)} CLOUT`, { size: 's', align: 'center', color: this.flip ? FLIP.colors.ink : '#ff8ad8', maxW: c.w });
    this.button(c.x, y, c.w, btnH, 'AGAIN', () => this.stonks(), { enabled: Save.trades > 0 && Save.cash >= ECONOMY.stakes[0], accent });
    this.button(c.x, y + btnH + (this.flip ? 6 : 16), c.w, btnH, 'DONE', () => this.home(), { accent: 0x3a3550 });
  }

  // ---- REALTY ----------------------------------------------------------------------------
  // $cott's property ladder (minigames/realty.js). Pick a city, climb to its
  // trophy. Play money for now: it doesn't touch his cash.

  realty() {
    this.clearPage('realty');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'realty').color;
    this.header('REALTY', accent);
    const top = c.y + (this.flip ? 28 : 90);
    this.text(c.x + c.w / 2, top, this.flip ? 'PICK A CITY' : 'PICK A CITY. CLIMB TO THE TROPHY.', { size: this.flip ? 'm' : 's', align: 'center', maxW: c.w });
    const rowH = this.flip ? 58 : 130;
    const first = top + (this.flip ? 24 : 50);
    CITIES.forEach((city, i) => {
      const y = first + i * (rowH + (this.flip ? 6 : 16));
      this.button(c.x, y, c.w, rowH, city.name, () => this.playRealty(city.id), {
        accent: city.accent, sub: this.flip ? null : city.blurb,
      });
    });
    if (!this.flip) {
      this.text(c.x + c.w / 2, first + CITIES.length * (rowH + 16) + 16, 'Play money for now. Your cash is safe.', {
        size: 's', align: 'center', font: 'body', color: '#e2d9ff', maxW: c.w,
      });
    }
  }

  async playRealty(city) {
    if (this.trading) return;
    this.trading = true;
    this.page = 'realty-play';
    this.root.setVisible(false);
    const result = await realty.run(this, { context: { city } });
    // Climbing to a trophy posts itself, once per city and grade.
    let clout = 0;
    if (result.won !== null && Save.brag(`realty:${city}:${result.grade}`)) {
      clout = SOCIAL.moments.realty[result.grade] ?? 0;
      this.brag(fillIn(MOMENTS.realty, { city: CITIES.find((c) => c.id === city)?.name ?? city }), clout, 'REALESTATE');
    }
    this.trading = false;
    this.root.setVisible(true);
    this.realtyResult(result, clout);
  }

  realtyResult({ won, value, grade }, clout = 0) {
    this.clearPage('realty-result');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'realty').color;
    this.header(won !== null ? 'SOLD!' : 'TIME UP', accent);
    const top = c.y + (this.flip ? 34 : 120);
    const ink = this.flip ? FLIP.colors.ink : null;
    if (won !== null) {
      this.text(c.x + c.w / 2, top, `MONTH ${won}`, { size: 'xl', align: 'center', color: ink ?? '#ffd166' });
      this.text(c.x + c.w / 2, top + (this.flip ? 34 : 80), REALTY.grades.find((g) => g.id === grade)?.label ?? 'SOLD!', {
        size: 's', align: 'center', font: 'body', color: ink ?? '#e2d9ff', maxW: c.w,
      });
    } else {
      this.text(c.x + c.w / 2, top, price(value), { size: 'xl', align: 'center', color: ink ?? '#ff5c8a' });
      this.text(c.x + c.w / 2, top + (this.flip ? 34 : 80), 'NET WORTH. STILL RENTING.', { size: 's', align: 'center', font: 'body', color: ink ?? '#e2d9ff', maxW: c.w });
    }
    const btnH = this.flip ? 56 : 110;
    const y = c.y + c.h - btnH * 2 - (this.flip ? 6 : 80);
    if (clout) this.text(c.x + c.w / 2, y - (this.flip ? 18 : 56), `POSTED IT. +${formatClout(clout)} CLOUT`, { size: 's', align: 'center', color: this.flip ? FLIP.colors.ink : '#ff8ad8', maxW: c.w });
    this.button(c.x, y, c.w, btnH, 'AGAIN', () => this.realty(), { accent });
    this.button(c.x, y + btnH + (this.flip ? 6 : 16), c.w, btnH, 'DONE', () => this.home(), { accent: 0x3a3550 });
  }

  // ---- WIFI -----------------------------------------------------------------------------
  // The day traders' Wi-Fi sniffer (systems/secrets.js): the networks around
  // $cott. A hidden one (Derek's) shows its signal and which way to walk; once
  // he's right on top of it, TRACE finds it, and the region shows what was hidden.

  wifi() {
    this.clearPage('wifi');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'wifi').color;
    this.header('WIFI', accent);
    const region = this.from === 'Region' ? this.scene.get('Region') : null;
    const hidden = region?.wifiNetworks() ?? [];
    let y = c.y + (this.flip ? 30 : 100);
    const rowH = this.flip ? 30 : 64;
    const row = (name, bars, { sub = null, color = null } = {}) => {
      this.text(c.x, y, name, { size: 'm', color, maxW: c.w - (this.flip ? 46 : 90) });
      this.bars(c.x + c.w - (this.flip ? 34 : 70), y + (this.flip ? 12 : 30), bars);
      if (sub) this.text(c.x, y + (this.flip ? 14 : 34), sub, { size: 's', font: 'body', color: this.flip ? null : '#9fdcff', maxW: c.w });
      y += rowH + (sub ? (this.flip ? 14 : 30) : 0);
    };
    for (const n of hidden) {
      const sub = n.found ? 'TRACED. SOMETHING WAS HIDDEN HERE.' : n.trace ? "IT'S RIGHT HERE. TRACE IT." : n.bars ? `HEAD ${n.heading}` : `TOO WEAK. HEAD ${n.heading}`;
      row(n.ssid, n.bars, { sub, color: this.flip ? null : '#ffd166' });
      if (n.trace && !n.found) {
        const h = this.flip ? 46 : 96;
        this.button(c.x, y, c.w, h, 'TRACE', () => this.trace(region, n), { accent, sub: this.flip ? null : 'Pinpoint the router.' });
        y += h + (this.flip ? 8 : 20);
      }
    }
    if (!region) this.text(c.x + c.w / 2, y, this.flip ? 'GO OUTSIDE.' : 'No networks out here. Go walk around a region.', { size: 's', font: 'body', align: 'center', maxW: c.w });
    else {
      // Everyone else's networks fill out the list (fewer on the flip phone's little LCD).
      const decoys = WIFI.decoys.slice(0, this.flip ? (hidden.length ? 2 : 4) : 5);
      decoys.forEach((name, i) => row(name, 1 + ((i * 3 + name.length) % 4), { color: this.flip ? null : '#e2d9ff' }));
    }
  }

  /** Signal bars, bottom-left at (x, y): `n` of 4 lit. */
  bars(x, y, n) {
    const g = this.add.graphics();
    const w = this.flip ? 6 : 12;
    const gap = this.flip ? 2 : 4;
    for (let i = 0; i < 4; i++) {
      const h = (this.flip ? 4 : 8) * (i + 1);
      const on = i < n;
      const color = this.flip ? (on ? FLIP.colors.inkHex : FLIP.colors.midHex) : on ? 0x7cf29c : 0x3a3550;
      g.fillStyle(color, 1).fillRect(x + i * (w + gap), y - h, w, h);
    }
    this.pageLayer.add(g);
  }

  /** TRACE: the region finds the secret, and the phone says so before stepping aside. */
  trace(region, network) {
    region.traceSecret(network.id);
    Audio.sfx('crit');
    this.clearPage('wifi-traced');
    const c = this.flip ? FLIP.content : SMART.content;
    const accent = APPS.find((a) => a.id === 'wifi').color;
    this.header('WIFI', accent);
    const top = c.y + (this.flip ? 40 : 160);
    this.text(c.x + c.w / 2, top, 'TRACED', { size: 'xl', align: 'center', color: this.flip ? null : '#7cf29c' });
    this.text(c.x + c.w / 2, top + (this.flip ? 34 : 80), network.ssid, { size: 'm', align: 'center', maxW: c.w });
    this.text(c.x + c.w / 2, top + (this.flip ? 56 : 130), this.flip ? 'THE ROUTER IS RIGHT HERE.' : "The router's right under $cott's feet. Put the phone away and look.", {
      size: 's', align: 'center', font: 'body', maxW: c.w,
    });
    const h = this.flip ? 56 : 110;
    this.button(c.x, c.y + c.h - h - (this.flip ? 6 : 80), c.w, h, 'LOOK', () => this.close(), { accent });
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
      if (this.from) this.scene.stop(this.from);
      this.scene.start('Title');
    }, { accent: 0xb3261e });
    // Work in progress: swap between the two phones without buying the upgrade.
    const other = this.flip ? 'smart' : 'flip';
    this.button(c.x, top + (rowH + gap) * 2, c.w, rowH, this.flip ? 'TRY SMARTPHONE' : 'TRY FLIP PHONE', () => this.swapPhone(other), {
      accent: 0x3a3550, sub: this.flip ? 'TEST TOGGLE' : 'Test toggle while the phone is in progress.',
    });
    const info = top + (rowH + gap) * 3 + (this.flip ? 6 : 20);
    this.text(c.x + c.w / 2, info, PHONES[this.model].name, { size: 's', align: 'center', font: 'body' });
    this.text(c.x + c.w / 2, info + (this.flip ? 16 : 36), `V${VERSION}`, { size: 's', align: 'center', font: 'body' });
  }

  /** Switch models and reopen on SETTINGS (the toggle lives there). */
  swapPhone(id) {
    Save.setPhone(id);
    this.tweens.add({
      targets: this.root, y: GAME_H, duration: 200, ease: 'Quad.easeIn',
      onComplete: () => {
        this.build(true);
        this.settings();
      },
    });
  }

  /** Read by the debug hook / smoke test. Points are canvas coordinates. */
  debugState() {
    return {
      phone: this.model,
      page: this.page,
      cash: Save.cash,
      clout: Save.clout,
      trades: Save.trades,
      // While the day trade is up, its own buttons are the ones to press.
      targets: this.trading ? undefined : [...this.chrome, ...this.targets].map(({ text, x, y, enabled }) => ({ text, x, y, enabled })),
    };
  }
}
