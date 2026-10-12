// Stat bar (Clout, Flow, crowd).
//
// HANDOFF quirk, kept on purpose: the bar tweens a display copy of the value,
// so the real stat changes instantly and the bar catches up.

import { COLORS } from '../config.js';
import { label, body } from './text.js';

export class StatBar {
  constructor(scene, { x, y, w, h, color, lowColor = null, lowAt = 0.25, title = '', value, max, numbers = true }) {
    this.scene = scene;
    Object.assign(this, { x, y, w, h, color, lowColor, lowAt, max });
    this.value = value;
    this.display = { v: value };
    this.g = scene.add.graphics();
    if (title) label(scene, x, y - 6, title, 14).setOrigin(0, 1);
    this.numbers = numbers ? body(scene, x + w, y - 2, '', 28).setOrigin(1, 1) : null;
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
    const { g, x, y, w, h } = this;
    const ratio = Math.max(0, Math.min(1, this.display.v / this.max));
    const fill = this.lowColor !== null && ratio <= this.lowAt ? this.lowColor : this.color;
    g.clear();
    g.fillStyle(COLORS.barBack, 1);
    g.fillRect(x, y, w, h);
    const fw = Math.round((w - 6) * ratio);
    if (fw > 0) {
      g.fillStyle(fill, 1);
      g.fillRect(x + 3, y + 3, fw, h - 6);
      // Top highlight for a chunky pixel look.
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(x + 3, y + 3, fw, 3);
    }
    g.lineStyle(3, 0x000000, 1);
    g.strokeRect(x, y, w, h);
  }
}
