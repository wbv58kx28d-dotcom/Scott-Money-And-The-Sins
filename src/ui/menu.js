// Button grid inside the bottom panel. `choose()` resolves with the picked
// item's id, so a menu tree reads as a few awaits in the battle loop.

import { LAYOUT } from '../config.js';
import { Button } from './button.js';
import { label } from './text.js';

export class Menu {
  constructor(scene) {
    this.scene = scene;
    this.buttons = [];
    const p = LAYOUT.panel;
    this.prompt = label(scene, p.x + 14, p.y - 6, '', 16, {
      backgroundColor: '#2a2140',
      padding: { x: 10, y: 6 },
      strokeThickness: 0,
    }).setOrigin(0, 1).setVisible(false);
  }

  /**
   * @param {Array<{id, text, sub?, enabled?, accent?, sfx?}>} items
   * @param {{prompt?: string, columns?: number}} opts
   */
  choose(items, { prompt = '', columns = 2 } = {}) {
    this.clear();
    const p = LAYOUT.panel;
    const rows = Math.ceil(items.length / columns);
    const innerW = p.w - p.pad * 2;
    const innerH = p.h - p.pad * 2;
    const bw = Math.floor((innerW - p.gap * (columns - 1)) / columns);
    const bh = Math.floor((innerH - p.gap * (rows - 1)) / rows);
    const size = bh >= 70 ? 22 : 16;

    this.prompt.setText(prompt).setVisible(!!prompt);

    return new Promise((resolve) => {
      items.forEach((item, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const button = new Button(this.scene, {
          x: p.x + p.pad + col * (bw + p.gap) + bw / 2,
          y: p.y + p.pad + row * (bh + p.gap) + bh / 2,
          w: bw,
          h: bh,
          text: item.text,
          sub: item.sub ?? null,
          enabled: item.enabled !== false,
          accent: item.accent ?? null,
          sfx: item.sfx ?? 'blip',
          size,
          onPress: () => {
            this.clear();
            resolve(item.id);
          },
        });
        this.buttons.push(button);
      });
    });
  }

  clear() {
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.prompt.setVisible(false);
  }
}
