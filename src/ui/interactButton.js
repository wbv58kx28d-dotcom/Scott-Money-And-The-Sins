// The TALK button beside the region joystick (CLAUDE.md §6.6): a faint round
// button that lights up gold when someone is close enough to talk to, so a
// phone player never has to tap the NPC itself. Same minimal look as the
// joystick; the scene feeds it pointer events like the stick.

import { label } from './text.js';

const LOOK = {
  idle: { ring: 0.22, fill: 0.08, text: 0.35 },
  ready: { ring: 0.7, fill: 0.3, text: 1 },
};

export class InteractButton {
  /** @param {{x:number, y:number, radius:number, grab:number}} o */
  constructor(scene, o) {
    this.o = o;
    this.ready = false;
    this.fill = scene.add.circle(o.x, o.y, o.radius, 0xffffff, 1).setDepth(30);
    this.ring = scene.add.circle(o.x, o.y, o.radius).setStrokeStyle(3, 0xffffff, 1).setDepth(30);
    this.text = label(scene, 0, 0, 'TALK', 12, { strokeThickness: 0 }).setDepth(30);
    this.text.setPosition(Math.round(o.x - this.text.width / 2), Math.round(o.y - this.text.height / 2));
    this.setReady(false, true);
  }

  contains(pointer) {
    return this.ring.visible && Math.hypot(pointer.x - this.o.x, pointer.y - this.o.y) <= this.o.grab;
  }

  /** Gold and bright when there's someone to talk to; faint otherwise. */
  setReady(ready, force = false) {
    if (ready === this.ready && !force) return;
    this.ready = ready;
    const look = ready ? LOOK.ready : LOOK.idle;
    const tint = ready ? 0xffd166 : 0xffffff;
    this.fill.setFillStyle(tint, 1).setAlpha(look.fill);
    this.ring.setStrokeStyle(3, tint, 1).setAlpha(look.ring);
    this.text.setColor(ready ? '#ffd166' : '#ffffff').setAlpha(look.text);
  }

  /** A quick squish so a press feels like a press. */
  pulse(scene) {
    scene.tweens.add({ targets: [this.fill, this.ring], scale: 0.88, duration: 70, yoyo: true });
  }

  setVisible(on) {
    for (const o of [this.fill, this.ring, this.text]) o.setVisible(on);
  }
}
