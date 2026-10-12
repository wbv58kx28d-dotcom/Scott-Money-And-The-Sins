// Pixel-style button.
//
// HANDOFF quirk, kept on purpose: buttons act on POINTERUP, only when the same
// press started on them, and the callback runs ~1 ms later. The global
// tap-to-advance handler (ui/tapBus.js) runs on pointerdown and ignores taps on
// buttons, so one tap can't both pick an option and skip the next line. The
// delay also means a button can safely destroy itself from its own callback.
//
// A disabled button still takes taps (so they never leak through to the
// dialog) and calls onDisabledPress, e.g. to explain why it's disabled.

import { COLORS } from '../config.js';
import { Audio } from '../systems/audio.js';
import { label, body, fitWidth } from './text.js';

export class Button {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} o  x/y are the button's center.
   */
  constructor(scene, o) {
    const { x, y, w, h, text, sub = null, enabled = true, size = 18, accent = null, fill = null, system = false } = o;
    // An optional skin (e.g. RIBBON_BUTTON in ui/ribbon.js) draws the button
    // instead of the classic framed box. `align: 'left'` starts the text at the
    // skin's inset instead of centering it.
    this.skin = o.skin ?? null;
    this.accent = accent;
    this.hover = false;
    const textColor = o.textColor ?? COLORS.text;
    const subColor = o.subColor ?? COLORS.textDim;
    const left = o.align === 'left';
    const inset = this.skin?.inset ?? 14;
    const textX = left ? Math.round(-w / 2 + inset) : 0;
    const originX = left ? 0 : 0.5;
    this.scene = scene;
    this.text = text;
    this.onPress = o.onPress;
    this.onDisabledPress = o.onDisabledPress;
    this.fill = fill;
    this.system = system; // corner buttons like "?" (the smoke test skips these)
    this.w = w;
    this.h = h;
    this.downTime = null;
    this.pressed = false;

    this.container = scene.add.container(Math.round(x), Math.round(y)).setDepth(o.depth ?? 20);
    this.shadow = scene.add.rectangle(4, 4, w, h, COLORS.shadow, 0.55);
    this.bg = scene.add.rectangle(0, 0, w, h, COLORS.button).setStrokeStyle(4, accent ?? COLORS.buttonBorder);
    // With a sub-line, both lines scale to the button's height so they fit.
    const labelSize = sub ? Math.min(size, Math.round(h * 0.34)) : size;
    this.label = label(scene, textX, sub ? -Math.round(h * 0.22) : 0, text, labelSize, { color: textColor }).setOrigin(originX, 0.5);
    fitWidth(this.label, left ? w - inset - 10 : w - 20);
    this.container.add([this.shadow, this.bg, this.label]);
    if (this.skin) {
      // The skin draws the visuals; the rectangle stays as the invisible tap target.
      this.shadow.setVisible(false);
      this.bg.setStrokeStyle();
      this.skinG = scene.add.graphics();
      this.container.addAt(this.skinG, 0);
    }
    if (sub) {
      const subSize = Math.min(26, Math.round(h * 0.5));
      this.sub = body(scene, textX, Math.round(h * 0.25), sub, subSize, { color: subColor }).setOrigin(originX, 0.5);
      fitWidth(this.sub, left ? w - inset - 10 : w - 16);
      this.container.add(this.sub);
    }

    // Phaser runs pointerup before pointerout, so resetting on out is safe.
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => {
      this.hover = true;
      if (this.skin) this.refresh();
      else if (this.enabled && !this.fill) this.bg.setFillStyle(COLORS.buttonHover);
    });
    this.bg.on('pointerout', () => {
      this.hover = false;
      this.downTime = null;
      this.setPressed(false);
      this.refresh();
    });
    this.bg.on('pointerdown', (pointer) => {
      this.downTime = pointer.downTime;
      if (this.enabled) this.setPressed(true);
    });
    this.bg.on('pointerup', (pointer) => {
      const samePress = this.downTime !== null && pointer.downTime === this.downTime;
      this.downTime = null;
      this.setPressed(false);
      if (!samePress) return;
      Audio.sfx('blip');
      const callback = this.enabled ? this.onPress : this.onDisabledPress;
      if (callback) setTimeout(callback, 1);
    });

    this.setEnabled(enabled);
    scene.buttons?.add(this);
  }

  setPressed(pressed) {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    const d = pressed ? 2 : -2;
    this.container.setPosition(this.container.x + d, this.container.y + d);
    if (this.skin) this.refresh();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.refresh();
    return this;
  }

  setText(text) {
    this.text = text;
    this.label.setText(text);
    return this;
  }

  refresh() {
    if (this.skin) {
      this.bg.setFillStyle(0x000000, 0.001);
      this.skinG.clear();
      this.skin.button(this.skinG, {
        w: this.w, h: this.h, accent: this.accent, fill: this.fill,
        enabled: this.enabled, pressed: this.pressed, hover: this.hover,
      });
    } else {
      this.bg.setFillStyle(!this.enabled ? COLORS.buttonDisabled : this.fill ?? COLORS.button);
    }
    this.label.setAlpha(this.enabled ? 1 : 0.45);
    this.sub?.setAlpha(this.enabled ? 1 : 0.45);
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
      system: this.system,
    };
  }

  destroy() {
    this.scene.buttons?.delete(this);
    this.container.destroy();
  }
}
