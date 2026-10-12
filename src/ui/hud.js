// Battle HUD: the enemy panel (with ??? intel), $cott's panel, and the
// crowd meter. Each one redraws from battler state via refresh().

import { COLORS, LAYOUT, cloutColor } from '../config.js';
import { DISS_TYPES } from '../data/types.js';
import { ITEMS } from '../data/items.js';
import { drawPanel } from './panel.js';
import { StatBar } from './bars.js';
import { label, body, fitWidth } from './text.js';

// Room kept clear at the top-right of the enemy panel for the ? and SND buttons.
export const CORNER_W = 150;

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

export class EnemyHud {
  constructor(scene, enemy) {
    const r = LAYOUT.enemyHud;
    this.enemy = enemy;
    drawPanel(scene, r);
    fitWidth(label(scene, r.x + 18, r.y + 18, enemy.def.name, 22), r.w - 36 - CORNER_W);
    const type = DISS_TYPES[enemy.def.type];
    const typeText = body(scene, r.x + 18, r.y + 46, `${type.id} TYPE`, 30, { color: type.color });
    // Status tags (SHORT SQUEEZED) follow the type, clear of the corner buttons.
    const tagX = typeText.x + typeText.width + 24;
    this.tags = new StatusTags(scene, tagX, r.y + 61, { maxWidth: r.x + r.w - 18 - CORNER_W - tagX });
    this.clout = new StatBar(scene, {
      x: r.x + 18, y: r.y + 100, w: r.w - 36, h: 22,
      color: cloutColor, title: 'CLOUT', value: enemy.clout, max: enemy.maxClout,
    });
    this.intel = body(scene, r.x + 18, r.y + 130, '', 30, { color: '#b9acdf' });
    this.soft = body(scene, r.x + 18, r.y + 160, '', 30, { color: COLORS.textGold });
    this.refresh(false);
  }

  refresh(animate = true) {
    const { enemy } = this;
    const { def, discovered } = enemy;
    const w = LAYOUT.enemyHud.w - 36;
    this.clout.set(enemy.clout, enemy.maxClout, animate);
    this.tags.refresh(enemy.statuses);

    const known = (list, found) => (list.length === 0 ? 'NONE' : list.map((t) => (found.has(t) ? t : '???')).join('/'));
    this.intel.setFontSize(30).setText(`WEAK: ${known(def.weak, discovered.weak)}    RESISTS: ${known(def.resist, discovered.resist)}`);
    fitWidth(this.intel, w, 18);
    const found = [...discovered.softSpots].map((key) => key.split('>')[1]);
    this.soft.setFontSize(30).setText(`SOFT SPOTS: ${found.length ? found.join(', ') : '???'}  (${found.length}/${def.softSpots.length})`);
    fitWidth(this.soft, w, 18);
  }
}

export class ScottHud {
  constructor(scene, scott) {
    const r = LAYOUT.scottHud;
    this.scott = scott;
    drawPanel(scene, r);
    fitWidth(label(scene, r.x + 16, r.y + 14, scott.def.name, 18, { color: COLORS.textGold }), r.w - 32);
    this.tags = new StatusTags(scene, r.x + 16, r.y + 52, { maxWidth: r.w - 32, size: 24 });
    this.clout = new StatBar(scene, {
      x: r.x + 16, y: r.y + 88, w: r.w - 32, h: 20,
      color: cloutColor, title: 'CLOUT', value: scott.clout, max: scott.maxClout,
    });
    this.flow = new StatBar(scene, {
      x: r.x + 16, y: r.y + 134, w: r.w - 32, h: 20,
      color: COLORS.flow, title: 'FLOW', value: scott.flow, max: scott.maxFlow,
    });
    this.items = body(scene, r.x + 16, r.y + 162, '', 24, { color: COLORS.textDim });
    this.refresh(false);
  }

  refresh(animate = true) {
    const { scott } = this;
    this.clout.set(scott.clout, scott.maxClout, animate);
    this.flow.set(scott.flow, scott.maxFlow, animate);
    this.tags.refresh(scott.statuses);
    const items = Object.entries(scott.items).map(([id, n]) => `${ITEMS[id].short} x${n}`);
    this.items.setText(items.join('  '));
    fitWidth(this.items.setFontSize(24), LAYOUT.scottHud.w - 32, 16);
  }
}

export class CrowdMeter {
  constructor(scene, crowd) {
    const r = LAYOUT.crowd;
    this.scene = scene;
    this.crowd = crowd;
    drawPanel(scene, r, { border: COLORS.panelBorderDim });
    label(scene, r.x + 16, r.y + r.h / 2, 'CROWD', 16).setOrigin(0, 0.5);
    this.bar = new StatBar(scene, {
      x: r.x + 128, y: r.y + 16, w: r.w - 144, h: 24,
      color: COLORS.crowd, value: crowd.value, max: crowd.max, numbers: false,
    });
    this.ready = label(scene, r.x + 128 + (r.w - 144) / 2, r.y + r.h / 2, 'MIC DROP READY!', 16, { color: '#1a1030', strokeThickness: 0 })
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
