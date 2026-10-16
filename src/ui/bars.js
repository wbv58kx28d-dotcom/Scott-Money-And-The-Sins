// Stat bar (Ego, Flow, crowd): a slanted ribbon-style bar (ui/ribbon.js).
//
// HANDOFF quirk, kept on purpose: the bar tweens a display copy of the value,
// so the real stat changes instantly and the bar catches up.

import { COLORS } from '../config.js';
import { label, body } from './text.js';
import { quad } from './ribbon.js';

export class StatBar {
  /**
   * `color` is a fill color, or a function of the fill ratio returning one.
   * The bar leans like the ribbons: its top edge sits `skew` px right of its bottom.
   */
  constructor(scene, { x, y, w, h, color, title = '', value, max, numbers = true, skew = Math.round(h * 0.5) }) {
    this.scene = scene;
    Object.assign(this, { x, y, w, h, color, max, skew });
    this.value = value;
    this.display = { v: value };
    this.g = scene.add.graphics();
    this.title = title ? label(scene, x + skew, y - 6, title, 14).setOrigin(0, 1) : null;
    this.numbers = numbers ? body(scene, x + w + skew, y - 2, '', 28).setOrigin(1, 1) : null;
    this.set(value, max, false);
  }

  set(value, max = this.max, animate = true) {
    this.value = value;
    this.max = max;
    this.numbers?.setText(`${value}/${max}`);
    this.tween?.remove();
    if (!animate) {
      this.display.v = value;
      this.draw();
      return;
    }
    this.tween = this.scene.tweens.add({
      targets: this.display,
      v: value,
      duration: 450,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.draw(),
      onComplete: () => this.draw(),
    });
  }

  setColor(color) {
    this.color = color;
    this.draw();
  }

  draw() {
    const { g, x, y, w, h, skew } = this;
    const ratio = Math.max(0, Math.min(1, this.display.v / this.max));
    const fill = typeof this.color === 'function' ? this.color(ratio) : this.color;
    // The inner fill keeps the same lean: skew scales with height.
    const inner = (hh) => (skew * hh) / h;
    g.clear();
    g.fillStyle(0x000000, 0.5).fillPoints(quad(x + 3, y + 3, w, h, skew), true);
    g.fillStyle(COLORS.barBack, 1).fillPoints(quad(x, y, w, h, skew), true);
    const fw = Math.round((w - 6) * ratio);
    if (fw > 0) {
      g.fillStyle(fill, 1).fillPoints(quad(x + 3 + inner(3), y + 3, fw, h - 6, inner(h - 6)), true);
      // Top highlight for a chunky pixel look.
      g.fillStyle(0xffffff, 0.25).fillPoints(quad(x + 3 + inner(h - 6), y + 3, fw, 3, inner(3)), true);
    }
    g.lineStyle(3, 0x000000, 1).strokePoints(quad(x, y, w, h, skew), true);
  }
}
