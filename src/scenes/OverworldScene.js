// Overworld map (CLAUDE.md §2, §6.5). The hub between fights: tap a region
// to see it in the info panel, then ENTER to walk around it (or straight to its fight, for a region without a map yet).
//
// Art and geometry come from the map pack (assets/map/, see its README);
// gameplay data from src/data/regions.js; progress from systems/save.js.
// Layer order, bottom to top: base, fog, highlight, outline, route, pins,
// labels, $cott's token, UI.

import { GAME_W, GAME_H, COLORS, MAP } from '../config.js';
import { REGIONS, TIER_NAMES, regionById } from '../data/regions.js';
import { ENEMIES } from '../data/enemies/index.js';
import { CREW } from '../data/crew.js';
import { MAPS } from '../data/maps/index.js';
import { allStatuses, frontierTier, newlyOpened } from '../systems/progress.js';
import { Save } from '../systems/save.js';
import { Audio } from '../systems/audio.js';
import { Button } from '../ui/button.js';
import { PhoneBadge } from '../ui/badge.js';
import { drawRibbonPanel } from '../ui/ribbon.js';
import { label, body, fitWidth } from '../ui/text.js';

const MAP_DIR = 'assets/map';
const INK = 0x1a1030;

export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super('Overworld');
  }

  init(data) {
    this.justCleared = data?.justCleared ?? null;
  }

  // Loaded on the first visit; Phaser skips files it already has.
  preload() {
    const loading = label(this, GAME_W / 2, GAME_H / 2, 'LOADING MAP...', 18, { color: COLORS.textGold }).setOrigin(0.5);
    this.load.once('complete', () => loading.destroy());
    this.load.json('mapRegions', `${MAP_DIR}/map_regions.json`);
    this.load.image('map_base', `${MAP_DIR}/map_base.webp`);
    for (const r of REGIONS) {
      this.load.image(`map_${r.id}_fog`, `${MAP_DIR}/regions/${r.id}_fog.webp`);
      this.load.image(`map_${r.id}_mask`, `${MAP_DIR}/regions/${r.id}_mask.png`);
      this.load.image(`map_${r.id}_outline`, `${MAP_DIR}/regions/${r.id}_outline.png`);
    }
  }

  create() {
    this.buttons = new Set();
    // Phaser reuses the scene object on restart, so reset per-visit state here.
    this.revealing = false;
    this.travelling = false;
    const geo = this.cache.json.get('mapRegions');
    this.geo = Object.fromEntries(geo.regions.map((r) => [r.key, r]));
    this.routeData = geo.route;
    this.polys = Object.fromEntries(geo.regions.map((r) => [r.key, new Phaser.Geom.Polygon(r.poly.flat())]));
    this.statuses = allStatuses(Save.cleared);
    const opened = this.justCleared ? newlyOpened(Save.cleared, this.justCleared) : [];

    this.add.image(0, 0, 'map_base').setOrigin(0);

    this.fog = {};
    this.masks = {};
    this.outlines = {};
    for (const r of REGIONS) {
      const g = this.geo[r.id];
      const covered = this.statuses[r.id] === 'locked' || opened.includes(r.id);
      this.fog[r.id] = this.add.image(g.x, g.y, `map_${r.id}_fog`).setOrigin(0).setAlpha(covered ? 1 : 0);
    }
    for (const r of REGIONS) {
      const g = this.geo[r.id];
      const mask = this.add.image(g.x, g.y, `map_${r.id}_mask`).setOrigin(0).setTint(MAP.highlight.tint).setAlpha(0);
      // Open regions you haven't beaten yet glow gently to invite a tap.
      if (this.statuses[r.id] === 'open' && !opened.includes(r.id)) this.pulse(mask);
      this.masks[r.id] = mask;
    }
    for (const r of REGIONS) {
      const g = this.geo[r.id];
      this.outlines[r.id] = this.add.image(g.x, g.y, `map_${r.id}_outline`).setOrigin(0).setVisible(false);
    }

    this.routeG = this.add.graphics();
    this.drawRoute(opened, 0);

    this.pins = {};
    for (const r of REGIONS) this.pins[r.id] = this.makePin(r, opened.includes(r.id));

    const at = this.statuses[Save.at] === 'locked' ? 'start' : Save.at;
    this.token = this.makeToken(this.geo[at].node);

    this.makePanel();
    // $cott's phone (scenes/PhoneScene.js): stonks, the shop, and settings (sound lives there now).
    new Button(this, {
      ...MAP.phoneButton, text: 'PHONE', size: 14, accent: 0xffd166, system: true, depth: 30,
      onPress: () => {
        if (this.revealing || this.travelling) return;
        this.scene.launch('Phone', { from: this.scene.key });
        this.scene.pause();
      },
    });
    const pb = MAP.phoneButton;
    this.badge = new PhoneBadge(this, pb.x + pb.w / 2 - 4, pb.y - pb.h / 2 + 2, 31);
    this.events.on('resume', () => this.badge.refresh());

    this.input.on('pointerup', (pointer, over) => this.onTap(pointer, over));
    this.cameras.main.fadeIn(250, 0, 0, 0);

    this.select(at);
    if (opened.length) this.reveal(opened);
  }

  // ---- Building blocks -----------------------------------------------------

  pulse(mask) {
    const { min, max, ms } = MAP.highlight;
    mask.setAlpha(min);
    this.tweens.add({ targets: mask, alpha: max, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** A pin on the region's landmark, plus its name once it's open. */
  makePin(region, hidden) {
    const [x, y] = this.geo[region.id].node;
    const status = this.statuses[region.id];
    const r = MAP.pin.radius;
    const pin = this.add.container(x, y);
    const g = this.add.graphics();
    const fill = status === 'cleared' ? 0xffd166 : status === 'open' ? 0xff5c8a : 0x6b6478;
    g.fillStyle(INK, 1).fillCircle(0, 0, r + 3);
    g.fillStyle(fill, 1).fillCircle(0, 0, r);
    if (status === 'cleared') {
      g.lineStyle(3, INK, 1);
      g.lineBetween(-5, 0, -1, 4);
      g.lineBetween(-1, 4, 6, -4);
    }
    pin.add(g);
    if (status === 'open') this.tweens.add({ targets: pin, scale: 1.25, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    let name = null;
    if (status !== 'locked') {
      name = label(this, x, y + r + MAP.pin.labelGap, region.name.toUpperCase(), 11, {
        color: '#fff1c8',
        backgroundColor: 'rgba(26, 16, 48, 0.85)',
        padding: { x: 6, y: 4 },
        strokeThickness: 0,
      }).setOrigin(0.5, 0);
      const half = name.width / 2;
      name.setX(Math.round(Math.min(Math.max(x, half + 6), GAME_W - half - 6)));
    }
    if (hidden) {
      pin.setScale(0);
      name?.setAlpha(0);
    }
    return { pin, name };
  }

  /** $cott's token: a gold coin with a $, bobbing above the pin. */
  makeToken([x, y]) {
    const { radius, lift, bob } = MAP.token;
    const token = this.add.container(x, y - lift).setDepth(10);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4).fillCircle(3, 4, radius);
    g.fillStyle(INK, 1).fillCircle(0, 0, radius + 3);
    g.fillStyle(0xffd166, 1).fillCircle(0, 0, radius);
    g.fillStyle(0xfff1c8, 1).fillCircle(-6, -7, 5);
    token.add([g, label(this, 1, 1, '$', 20, { color: '#1a1030', strokeThickness: 0 }).setOrigin(0.5)]);
    this.tweens.add({ targets: token, y: y - lift - bob, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return token;
  }

  /**
   * The dashed route along every segment that leads to an open region. Segments
   * into `growing` regions are drawn only up to `fraction` (for the reveal).
   */
  drawRoute(growing = [], fraction = 1) {
    const g = this.routeG.clear();
    const shown = this.routeData.filter((s) => this.statuses[s.to] !== 'locked');
    for (const [width, color, alpha] of [[MAP.route.width + 4, INK, 0.85], [MAP.route.width, 0xfff1c8, 1]]) {
      g.lineStyle(width, color, alpha);
      for (const seg of shown) dashedPath(g, seg.points, growing.includes(seg.to) ? fraction : 1);
    }
  }

  makePanel() {
    const p = MAP.panel;
    const b = MAP.enterButton;
    drawRibbonPanel(this, p);
    const textW = p.w - 36 - b.w - 16;
    this.textW = textW;
    this.infoName = label(this, p.x + 18, p.y + 18, '', 18, { color: COLORS.textGold });
    this.infoLine = body(this, p.x + 18, p.y + 50, '', 30, { color: '#e2d9ff' });
    this.infoStatus = body(this, p.x + 18, p.y + 92, '', 30);
    this.enterButton = null;
  }

  // ---- Interaction -----------------------------------------------------------

  onTap(pointer, over) {
    if (over.length || this.revealing || this.travelling) return;
    if (pointer.y >= MAP.panel.y) return;
    if (Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.upX, pointer.upY) > MAP.tapSlop) return;
    const hit = REGIONS.find((r) => Phaser.Geom.Polygon.Contains(this.polys[r.id], pointer.x, pointer.y));
    if (!hit || hit.id === this.selectedId) return;
    Audio.sfx('blip');
    this.select(hit.id);
  }

  select(id) {
    const region = regionById(id);
    const status = this.statuses[id];
    this.selectedId = id;
    for (const [rid, outline] of Object.entries(this.outlines)) {
      outline.setVisible(rid === id).setAlpha(status === 'locked' ? 0.45 : 1);
    }

    const villain = region.villain ? ENEMIES[region.villain] : null;
    const recruit = region.recruit ? CREW[region.recruit] : null;
    const parts = [TIER_NAMES[region.tier]];
    if (villain) parts.push(`VS ${villain.name}`);
    if (recruit) parts.push(`RECRUIT ${recruit.name.toUpperCase()} (${recruit.sin.toUpperCase()})`);

    this.infoName.setFontSize(18).setText(region.name.toUpperCase());
    fitWidth(this.infoName, this.textW, 10);
    this.infoLine.setFontSize(30).setText(parts.join(' · '));
    fitWidth(this.infoLine, this.textW, 18);
    const { text, color } = this.statusText(region, status, villain);
    this.setStatus(text, color);
    this.makeEnterButton(region, status, villain);
  }

  statusText(region, status, villain) {
    if (status === 'locked') {
      return { text: `LOCKED: clear ${TIER_NAMES[frontierTier(Save.cleared)]} first`, color: '#ff5c8a' };
    }
    if (status === 'cleared') return { text: 'CLEARED', color: '#7cf29c' };
    if (!villain) return { text: "COMING SOON: this villain isn't written yet", color: COLORS.textDim };
    return { text: MAPS[region.id] ? 'OPEN. Tap ENTER to explore.' : 'OPEN. Tap ENTER to fight.', color: '#ffd166' };
  }

  setStatus(text, color) {
    this.infoStatus.setFontSize(30).setColor(color).setText(text);
    fitWidth(this.infoStatus, this.textW, 18);
  }

  makeEnterButton(region, status, villain) {
    this.enterButton?.destroy();
    const p = MAP.panel;
    const b = MAP.enterButton;
    const canFight = status !== 'locked' && !!villain;
    const rematch = status === 'cleared' && !MAPS[region.id]; // with a map, rematches start from the villain
    const text = status === 'locked' ? 'LOCKED' : !villain ? 'SOON' : rematch ? 'REMATCH' : 'ENTER';
    this.enterButton = new Button(this, {
      x: p.x + p.w - 14 - b.w / 2,
      y: p.y + p.h / 2,
      w: b.w,
      h: b.h,
      text,
      size: 18,
      enabled: canFight,
      accent: canFight ? 0xffd166 : null,
      fill: canFight && status === 'open' ? 0xffd166 : null,
      textColor: canFight && status === 'open' ? '#1a1030' : COLORS.text,
      depth: 30,
      onPress: () => this.enter(region),
      onDisabledPress: () => this.flashStatus(this.statusText(region, status, villain)),
    });
  }

  flashStatus({ text, color }) {
    this.tweens.add({ targets: this.infoStatus, alpha: 0.2, duration: 90, yoyo: true, repeat: 1 });
    this.setStatus(text, color);
  }

  /** Walk the token to the region, then go in (or straight to its fight if it has no map yet). */
  enter(region) {
    if (this.travelling) return;
    this.travelling = true;
    Save.moveTo(region.id);
    const [x, y] = this.geo[region.id].node;
    this.tweens.killTweensOf(this.token);
    this.tweens.add({
      targets: this.token,
      x,
      y: y - MAP.token.lift,
      duration: MAP.travelMs,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          if (MAPS[region.id]) this.scene.start('Region', { region: region.id });
          else this.scene.start('Battle', { enemy: region.villain, region: region.id });
        });
      },
    });
  }

  /** After a win: lift the fog off newly opened regions and extend the route. */
  reveal(opened) {
    this.revealing = true;
    const tier = regionById(opened[0]).tier;
    const banner = label(this, GAME_W / 2, 120, `${TIER_NAMES[tier]} UNLOCKED`, 26, {
      color: '#ffd166',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(40).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut', delay: 300 });
    this.tweens.add({ targets: banner, alpha: 0, duration: 400, delay: MAP.fogFadeMs + MAP.routeDrawMs + 900, onComplete: () => banner.destroy() });
    Audio.sfx('good');

    for (const id of opened) this.tweens.add({ targets: this.fog[id], alpha: 0, duration: MAP.fogFadeMs, delay: 400 });
    const progress = { f: 0 };
    this.tweens.add({
      targets: progress,
      f: 1,
      duration: MAP.routeDrawMs,
      delay: 400 + MAP.fogFadeMs * 0.6,
      onUpdate: () => this.drawRoute(opened, progress.f),
      onComplete: () => {
        this.drawRoute();
        for (const id of opened) {
          const { pin, name } = this.pins[id];
          this.tweens.add({ targets: pin, scale: 1, duration: 260, ease: 'Back.easeOut' });
          if (name) this.tweens.add({ targets: name, alpha: 1, duration: 260 });
          this.pulse(this.masks[id]);
        }
        this.revealing = false;
        this.select(opened[0]);
      },
    });
  }

  /** Read by the debug hook / smoke test. */
  debugState() {
    return {
      selected: this.selectedId,
      statuses: this.statuses,
      at: Save.at,
      revealing: this.revealing,
      nodes: Object.fromEntries(Object.entries(this.geo).map(([k, g]) => [k, g.node])),
    };
  }
}

/** Draw a polyline as dashes, stopping `fraction` of the way along it. */
function dashedPath(g, points, fraction = 1) {
  const { dash, gap } = MAP.route;
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  const limit = total * fraction;
  let travelled = 0;
  let drawing = true;
  let left = dash;
  for (let i = 1; i < points.length && travelled < limit; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let t = 0;
    while (t < len && travelled < limit) {
      const step = Math.min(left, len - t, limit - travelled);
      if (drawing) {
        const a = t / len;
        const b = (t + step) / len;
        g.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
      }
      t += step;
      travelled += step;
      left -= step;
      if (left <= 0) {
        drawing = !drawing;
        left = drawing ? dash : gap;
      }
    }
  }
}
