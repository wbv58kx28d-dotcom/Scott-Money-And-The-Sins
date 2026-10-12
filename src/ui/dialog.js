// Typewriter dialog in the bottom panel.
//
// HANDOFF quirk, kept on purpose: a tap while text is typing completes it, and
// the next tap advances. `say()` returns a promise, so battle logic can just
// `await` each line in order.

import { COLORS, LAYOUT } from '../config.js';
import { body, label, fitWrapped } from './text.js';
import { PROMPT_STYLE } from './ribbon.js';

const CHAR_MS = 16;

export class DialogBox {
  constructor(scene, bus, { instant = false } = {}) {
    this.scene = scene;
    this.bus = bus;
    this.instant = instant;
    const p = LAYOUT.panel;
    this.box = { x: p.x + 22, y: p.y + 16, w: p.w - 60, h: p.h - 32 };

    this.text = body(scene, this.box.x, this.box.y, '', 36, { lineSpacing: -2 });
    this.speaker = label(scene, p.x + 14, p.y - 6, '', 16, {
      color: PROMPT_STYLE.color,
      backgroundColor: PROMPT_STYLE.bg,
      padding: { x: 10, y: 6 },
      strokeThickness: 0,
    }).setOrigin(0, 1);
    this.arrow = scene.add.triangle(p.x + p.w - 26, p.y + p.h - 22, 0, 0, 16, 0, 8, 10, 0xf4d35e);
    scene.tweens.add({ targets: this.arrow, alpha: 0.2, duration: 380, yoyo: true, repeat: -1 });
    this.hide();
  }

  /**
   * Show a line (or a couplet: pass an array) and wait for the player.
   * @param {string|string[]} text
   * @param {string|null} speaker  e.g. "$COTT"; null for narration
   * @param {object} opts  color: text color
   */
  say(text, speaker = null, { color = COLORS.text } = {}) {
    const str = Array.isArray(text) ? text.join('\n') : text;
    this.visible(true);
    this.speaker.setText(speaker ?? '').setVisible(!!speaker);
    this.text.setColor(color);
    const wrapped = fitWrapped(this.text, str, {
      maxWidth: this.box.w,
      maxHeight: this.box.h,
      maxSize: 36,
      minSize: 24,
    });
    this.arrow.setVisible(false);

    return new Promise((resolve) => {
      let shown = 0;
      let timer = null;
      let done = false;
      const finish = () => {
        timer?.remove();
        this.text.setText(wrapped);
        this.arrow.setVisible(true);
        done = true;
      };
      const onTap = () => {
        if (!done) return finish();
        this.bus.off('tap', onTap);
        resolve();
      };
      this.bus.on('tap', onTap);
      if (this.instant) return finish();
      timer = this.scene.time.addEvent({
        delay: CHAR_MS,
        loop: true,
        callback: () => {
          shown += 1;
          this.text.setText(wrapped.slice(0, shown));
          if (shown >= wrapped.length) finish();
        },
      });
    });
  }

  /** Show a line without waiting for a tap (e.g. "DEREK fires back..."). */
  show(text, speaker = null) {
    this.visible(true);
    this.speaker.setText(speaker ?? '').setVisible(!!speaker);
    this.text.setColor(COLORS.text);
    const wrapped = fitWrapped(this.text, text, { maxWidth: this.box.w, maxHeight: this.box.h, maxSize: 36, minSize: 24 });
    this.text.setText(wrapped);
    this.arrow.setVisible(false);
  }

  visible(on) {
    this.text.setVisible(on);
    this.speaker.setVisible(on && !!this.speaker.text);
    if (!on) this.arrow.setVisible(false);
  }

  hide() {
    this.text.setText('');
    this.speaker.setText('');
    this.visible(false);
  }
}
