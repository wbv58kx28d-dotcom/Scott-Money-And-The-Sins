// Button grid inside the bottom panel. `choose()` resolves with the picked
// item's id, so a menu tree reads as a few awaits in the battle loop.

import { LAYOUT } from '../config.js';
import { Button } from './button.js';
import { label, fitWidth } from './text.js';
import { RIBBON_BUTTON, PROMPT_STYLE } from './ribbon.js';

const FLASH_MS = 1500;

export class Menu {
  constructor(scene) {
    this.scene = scene;
    this.buttons = [];
    const p = LAYOUT.panel;
    // The prompt tag sits just above the panel.
    const ps = PROMPT_STYLE;
    this.promptStyle = ps;
    this.prompt = label(scene, p.x + 14, p.y - 6, '', ps.size, {
      backgroundColor: ps.bg,
      padding: { x: 10, y: 6 },
      strokeThickness: 0,
    }).setOrigin(0, 1).setVisible(false);
    this.promptText = '';
  }

  /**
   * @param {Array<{id, text, sub?, enabled?, accent?, fill?, textColor?, subColor?, disabledMsg?}>} items
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
    this.setPrompt(prompt);

    return new Promise((resolve) => {
      items.forEach((item, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const button = new Button(this.scene, {
          ...item,
          skin: RIBBON_BUTTON,
          align: 'left',
          x: p.x + p.pad + col * (bw + p.gap) + bw / 2,
          y: p.y + p.pad + row * (bh + p.gap) + bh / 2,
          w: bw,
          h: bh,
          enabled: item.enabled !== false,
          size,
          onPress: () => {
            this.clear();
            resolve(item.id);
          },
          onDisabledPress: item.disabledMsg ? () => this.flash(item.disabledMsg) : null,
        });
        this.buttons.push(button);
      });
    });
  }

  setPrompt(text) {
    this.promptText = text;
    this.flashToken = (this.flashToken ?? 0) + 1;
    this.showPrompt(text, this.promptStyle.color);
  }

  showPrompt(text, color) {
    this.prompt.setFontSize(this.promptStyle.size).setColor(color).setText(text).setVisible(!!text);
    fitWidth(this.prompt, LAYOUT.panel.w - 28, 8);
  }

  /** Briefly replace the prompt with a message, then restore it. */
  flash(message) {
    const token = (this.flashToken = (this.flashToken ?? 0) + 1);
    this.showPrompt(message, this.promptStyle.flash);
    this.scene.time.delayedCall(FLASH_MS, () => {
      if (token === this.flashToken && this.buttons.length) this.showPrompt(this.promptText, this.promptStyle.color);
    });
  }

  clear() {
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.prompt.setVisible(false);
  }
}
