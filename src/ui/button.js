// Pixel-style button.
//
// HANDOFF quirk, kept on purpose: buttons act on POINTERUP, only when the same
// press started on them, and the callback runs ~1 ms later. The global
// tap-to-advance handler (ui/tapBus.js) runs on pointerdown and ignores taps on
// buttons, so one tap can't both pick an option and skip the next line. The
// delay also means a button can safely destroy itself from its own callback.

import { COLORS } from '../config.js';
import { Audio } from '../systems/audio.js';
import { label, body, fitWidth } from './text.js';

export class Button {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} o  x/y are the button's center.
   */
  constructor(scene, { x, y, w, h, text, sub = null, enabled = true, size = 18, accent = null, sfx = 'blip', onPress }) {
    this.scene = scene;
    this.text = text;
    this.onPress = onPress;
    this.sfx = sfx;
    this.w = w;
    this.h = h;
    this.downTime = null;
    this.pressed = false;

    this.container = scene.add.container(Math.round(x), Math.round(y));
    this.shadow = scene.add.rectangle(4, 4, w, h, COLORS.shadow, 0.55);
    this.bg = scene.add.rectangle(0, 0, w, h, COLORS.button).setStrokeStyle(4, accent ?? COLORS.buttonBorder);
    // With a sub-line, both lines scale to the button's height so they fit.
    const labelSize = sub ? Math.min(size, Math.round(h * 0.34)) : size;
    this.label = label(scene, 0, sub ? -Math.round(h * 0.22) : 0, text, labelSize).setOrigin(0.5);
    fitWidth(this.label, w - 20);
    this.container.add([this.shadow, this.bg, this.label]);
    if (sub) {
      const subSize = Math.min(26, Math.round(h * 0.5));
      this.sub = body(scene, 0, Math.round(h * 0.25), sub, subSize, { color: COLORS.textDim }).setOrigin(0.5);
      fitWidth(this.sub, w - 16);
      this.container.add(this.sub);
    }

    // Phaser runs pointerup before pointerout, so resetting on out is safe.
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => this.enabled && this.bg.setFillStyle(COLORS.buttonHover));
    this.bg.on('pointerout', () => {
      this.downTime = null;
      this.setPressed(false);
      this.refresh();
    });
    this.bg.on('pointerdown', (pointer) => {
      if (!this.enabled) return;
      this.downTime = pointer.downTime;
      this.setPressed(true);
    });
    this.bg.on('pointerup', (pointer) => {
      const samePress = this.downTime !== null && pointer.downTime === this.downTime;
      this.downTime = null;
      this.setPressed(false);
      if (!samePress || !this.enabled) return;
      Audio.sfx(this.sfx);
      setTimeout(() => this.onPress?.(), 1);
    });

    this.setEnabled(enabled);
    scene.buttons?.add(this);
  }

  setPressed(pressed) {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    const d = pressed ? 2 : -2;
    this.container.setPosition(this.container.x + d, this.container.y + d);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.refresh();
    return this;
  }

  refresh() {
    this.bg.setFillStyle(this.enabled ? COLORS.button : COLORS.buttonDisabled);
    this.container.setAlpha(this.enabled ? 1 : 0.45);
  }

  /** Center position and state, for the debug hook and smoke test. */
  describe() {
    return {
      text: this.text,
      x: this.container.x,
      y: this.container.y,
      w: this.w,
      h: this.h,
      enabled: this.enabled,
    };
  }

  destroy() {
    this.scene.buttons?.delete(this);
    this.container.destroy();
  }
}
