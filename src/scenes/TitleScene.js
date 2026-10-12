// Title screen. Tap anywhere to start. Until the overworld exists, that goes
// straight to the prologue fight.

import { GAME_W, GAME_H, COLORS, LAYOUT } from '../config.js';
import { DEFAULT_ENEMY } from '../data/enemies/index.js';
import { TapBus } from '../ui/tapBus.js';
import { label, body } from '../ui/text.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.buttons = new Set();
    this.add.image(0, 0, 'bg_tokyo').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.45).setOrigin(0);

    const cx = GAME_W / 2;
    label(this, cx, 230, '$COTT MONEY', 52, { color: COLORS.textGold, strokeThickness: 10 }).setOrigin(0.5);
    label(this, cx, 312, 'REDEMPTION ARC', 26, { color: '#f472b6', strokeThickness: 6 }).setOrigin(0.5);
    body(this, cx, 372, 'Framed. Broke. Still him.', 38, { color: COLORS.text }).setOrigin(0.5);

    const scott = this.add.image(cx, LAYOUT.scott.y - 60, 'scott').setOrigin(0.5, 1);
    this.tweens.add({ targets: scott, y: scott.y - LAYOUT.idleBob.px, duration: LAYOUT.idleBob.ms / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const start = label(this, cx, 1100, 'TAP TO START', 26, { color: COLORS.text }).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
    body(this, cx, 1220, 'A parody. All villains are fictional.', 26, { color: COLORS.textDim }).setOrigin(0.5);

    const bus = new TapBus(this);
    bus.once('tap', () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Battle', { enemy: DEFAULT_ENEMY }));
    });
  }
}
