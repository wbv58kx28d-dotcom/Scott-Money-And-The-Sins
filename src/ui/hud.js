// Battle HUD, in the ribbon style (ui/ribbon.js): matching cards for the
// enemy (top-left) and $cott (bottom-left), the crowd meter (top-right), and
// the enemy's ??? intel as tags at the enemy's feet. Each one redraws from
// battler state via refresh().

import { COLORS, LAYOUT, cloutColor } from '../config.js';
import { DISS_TYPES } from '../data/types.js';
import { ITEMS } from '../data/items.js';
import { StatBar } from './bars.js';
import { label, body, fitWidth } from './text.js';
import { drawCard, CARD_INSET, EDGE_W, RIBBON_GOLD } from './ribbon.js';

const hex = (css) => Phaser.Display.Color.HexStringToColor(css).color;

/** A row of status tags, e.g. "MOONING 3", each in its status color. */
class StatusTags {
  constructor(scene, x, y, { align = 'left', maxWidth = 300, size = 26 } = {}) {
    Object.assign(this, { scene, x, y, align, maxWidth, size });
    this.texts = [];
  }

  refresh(statuses) {
    for (const t of this.texts) t.destroy();
    const tags = statuses.list();
    const gap = 14;
    let size = this.size;
    let total = 0;
    for (;;) {
      this.texts = tags.map((s) =>
        body(this.scene, 0, this.y, s.turns ? `${s.tag} ${s.turns}` : s.tag, size, { color: s.color }).setOrigin(0, 0.5),
      );
      total = this.texts.reduce((w, t) => w + t.width, 0) + gap * Math.max(0, tags.length - 1);
      if (total <= this.maxWidth || size <= 16) break;
      for (const t of this.texts) t.destroy();
      size -= 2;
    }
    let cursor = this.align === 'right' ? this.x - total : this.x;
    for (const t of this.texts) {
      t.setX(Math.round(cursor));
      cursor += t.width + gap;
    }
  }
}

// Shared card layout, so the enemy's and $cott's cards line up row for row:
// name, a subtitle row (type and/or status tags), then the Clout bar.
const ROW = { name: 16, sub: 60, clout: 106, flow: 154, items: 190 };
const BAR = { left: 20, right: 24, h: 20 };

function cloutBar(scene, r, battler) {
  return new StatBar(scene, {
    x: r.x + BAR.left, y: r.y + ROW.clout, w: r.w - BAR.left - BAR.right, h: BAR.h,
    color: cloutColor, title: 'CLOUT', value: battler.clout, max: battler.maxClout,
  });
}

export class EnemyHud {
  constructor(scene, enemy) {
    const r = LAYOUT.enemyHud;
    this.enemy = enemy;
    const type = DISS_TYPES[enemy.def.type];
    drawCard(scene.add.graphics(), r, hex(type.color));
    fitWidth(label(scene, r.x + CARD_INSET, r.y + ROW.name, enemy.def.name, 18), r.w - CARD_INSET - 12);
    const typeText = body(scene, r.x + CARD_INSET, r.y + ROW.sub, `${type.id} TYPE`, 28, { color: type.color }).setOrigin(0, 0.5);
    // Status tags (SHORT SQUEEZED) follow the type.
    const tagX = typeText.x + typeText.width + 20;
    this.tags = new StatusTags(scene, tagX, r.y + ROW.sub, { maxWidth: r.x + r.w - 12 - tagX, size: 24 });
    this.clout = cloutBar(scene, r, enemy);
    this.intel = new EnemyIntel(scene, enemy, LAYOUT.enemySlots[0]);
    this.refresh(false);
  }

  refresh(animate = true) {
    const { enemy } = this;
    this.clout.set(enemy.clout, enemy.maxClout, animate);
    this.tags.refresh(enemy.statuses);
    this.intel.refresh(animate);
  }
}

/**
 * WEAK / RESISTS / SOFT SPOTS as small ribbon tags under the enemy's feet,
 * "???" until discovered. A tag hops when its value changes.
 */
class EnemyIntel {
  constructor(scene, enemy, feet) {
    this.scene = scene;
    this.enemy = enemy;
    const c = LAYOUT.enemyIntel;
    this.rows = [feet.y + c.dy, feet.y + c.dy + c.h + c.gap];
    this.tags = {};
  }

  refresh(animate = true) {
    const { def, discovered } = this.enemy;
    const known = (list, found) => (list.length === 0 ? 'NONE' : list.map((t) => (found.has(t) ? t : '???')).join('/'));
    // A single discovered type shows in its own color.
    const typeColor = (value) => DISS_TYPES[value]?.color ?? (value.includes('???') ? COLORS.textDim : COLORS.text);
    const weak = known(def.weak, discovered.weak);
    const resist = known(def.resist, discovered.resist);
    const found = [...discovered.softSpots].map((key) => key.split('>')[1]);
    const soft = `${found.length ? found.join(', ') : '???'}  ${found.length}/${def.softSpots.length}`;

    const { x, maxW } = LAYOUT.enemyIntel;
    const weakTag = this.tag('weak', x, this.rows[0], 'WEAK', weak, typeColor(weak), 0x7cf29c, maxW, animate);
    this.tag('resist', weakTag.right + 10, this.rows[0], 'RESISTS', resist, typeColor(resist), 0x9a92b8, maxW, animate);
    this.tag('soft', x, this.rows[1], 'SOFT SPOTS', soft, found.length ? COLORS.textGold : COLORS.textDim, RIBBON_GOLD, maxW, animate);
  }

  /** Draw (or redraw) one tag; returns its right edge. */
  tag(id, x, y, key, value, color, accent, maxW, animate) {
    const old = this.tags[id];
    if (old && old.value === value && old.x === x) return old;
    old?.container.destroy();
    const { h } = LAYOUT.enemyIntel;
    const skew = 8;
    const inset = skew + EDGE_W + 8;
    const container = this.scene.add.container(x, y);
    const keyText = label(this.scene, inset, h / 2, key, 11, { color: '#b9acdf' }).setOrigin(0, 0.5);
    const valueText = body(this.scene, keyText.x + keyText.width + 10, h / 2, value, 28, { color }).setOrigin(0, 0.5);
    fitWidth(valueText, maxW - valueText.x - 14, 16);
    const w = Math.round(valueText.x + valueText.width + 12);
    const g = drawCard(this.scene.add.graphics(), { x: 0, y: 0, w, h }, accent, { skew });
    container.add([g, keyText, valueText]);
    if (old && animate) this.scene.tweens.add({ targets: container, y: y - 8, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    const tag = { container, value, x, right: x + w + skew };
    this.tags[id] = tag;
    return tag;
  }
}

export class ScottHud {
  constructor(scene, scott) {
    const r = LAYOUT.scottHud;
    this.scott = scott;
    drawCard(scene.add.graphics(), r, RIBBON_GOLD);
    fitWidth(label(scene, r.x + CARD_INSET, r.y + ROW.name, scott.def.name, 18, { color: COLORS.textGold }), r.w - CARD_INSET - 12);
    this.tags = new StatusTags(scene, r.x + CARD_INSET, r.y + ROW.sub, { maxWidth: r.w - CARD_INSET - 12, size: 24 });
    this.clout = cloutBar(scene, r, scott);
    this.flow = new StatBar(scene, {
      x: r.x + BAR.left, y: r.y + ROW.flow, w: r.w - BAR.left - BAR.right, h: BAR.h,
      color: COLORS.flow, title: 'FLOW', value: scott.flow, max: scott.maxFlow,
    });
    this.items = body(scene, r.x + BAR.left, r.y + ROW.items, '', 24, { color: COLORS.textDim }).setOrigin(0, 0.5);
    this.refresh(false);
  }

  refresh(animate = true) {
    const { scott } = this;
    this.clout.set(scott.clout, scott.maxClout, animate);
    this.flow.set(scott.flow, scott.maxFlow, animate);
    this.tags.refresh(scott.statuses);
    const items = Object.entries(scott.items).map(([id, n]) => `${ITEMS[id].short} x${n}`);
    this.items.setText(items.join('  '));
    fitWidth(this.items.setFontSize(24), LAYOUT.scottHud.w - BAR.left - BAR.right, 16);
  }
}

export class CrowdMeter {
  constructor(scene, crowd) {
    const r = LAYOUT.crowd;
    this.scene = scene;
    this.crowd = crowd;
    drawCard(scene.add.graphics(), r, COLORS.crowd);
    label(scene, r.x + CARD_INSET, r.y + 16, 'CROWD', 14);
    const bar = { x: r.x + BAR.left, y: r.y + 46, w: r.w - BAR.left - BAR.right, h: 24 };
    this.bar = new StatBar(scene, { ...bar, color: COLORS.crowd, value: crowd.value, max: crowd.max, numbers: false });
    this.ready = label(scene, bar.x + bar.w / 2 + this.bar.skew / 2, bar.y + bar.h / 2, 'MIC DROP READY!', 12, { color: '#1a1030', strokeThickness: 0 })
      .setOrigin(0.5)
      .setVisible(false);
    this.pulse = scene.tweens.add({ targets: this.ready, alpha: 0.25, duration: 300, yoyo: true, repeat: -1, paused: true });
  }

  refresh() {
    const { crowd } = this;
    this.bar.setColor(crowd.full ? COLORS.crowdFull : COLORS.crowd);
    this.bar.set(crowd.value, crowd.max);
    this.ready.setVisible(crowd.full);
    if (crowd.full) this.pulse.resume();
    else this.pulse.pause();
  }
}
