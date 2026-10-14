// Title screen (text from the legacy prototype). Tap to start the journey
// on the overworld map. With a save in progress it asks instead: CONTINUE, or
// START FRESH (a second tap confirms, then the save is wiped).

import { GAME_W, GAME_H, LAYOUT } from '../config.js';
import { Audio } from '../systems/audio.js';
import { Save } from '../systems/save.js';
import { Button } from '../ui/button.js';
import { label, body } from '../ui/text.js';
import { drawCard, RIBBON_GOLD } from '../ui/ribbon.js';
import { versionLabel } from '../version.js';

const TITLE_STYLE = {
  color: '#ffd166',
  stroke: '#3a1d00',
  strokeThickness: 16,
  shadow: { offsetX: 0, offsetY: 10, color: '#000000', blur: 0, fill: true, stroke: true },
};

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.buttons = new Set();
    this.starting = false;
    this.add.image(0, 0, 'bg_tokyo').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.45).setOrigin(0);

    const cx = GAME_W / 2;
    label(this, cx, 184, '$COTT', 76, TITLE_STYLE).setOrigin(0.5);
    label(this, cx, 284, 'MONEY', 76, TITLE_STYLE).setOrigin(0.5);
    label(this, cx, 372, 'REDEMPTION ARC', 24, { color: '#ff5c8a' }).setOrigin(0.5);

    const scott = this.add.image(cx, 850, 'scott').setOrigin(0.5, 1);
    this.tweens.add({ targets: scott, y: scott.y - LAYOUT.idleBob.px * 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    body(this, cx, 892, 'Chapter 1: Framed', 44, { color: '#ffd166' }).setOrigin(0.5);
    body(this, cx, 924, 'They framed him. His Clout is gone. His crew scattered. Now $cott Money takes it all back, one diss at a time.', 38, {
      color: '#e2d9ff',
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5, 0);
    if (Save.hasProgress) this.askContinue();
    else this.tapToStart();
    body(this, cx, 1236, 'A parody. All villains are fictional.', 26, { color: '#8a8496' }).setOrigin(0.5);
    // Which build this is, so a stale cached copy is easy to spot.
    body(this, GAME_W - 12, GAME_H - 6, versionLabel(), 22, { color: '#6f6888' }).setOrigin(1, 1);
  }

  tapToStart() {
    const cx = GAME_W / 2;
    const tapW = 380;
    drawCard(this.add.graphics(), { x: cx - tapW / 2 - 6, y: 1140, w: tapW, h: 64 }, RIBBON_GOLD);
    const tap = label(this, cx + 6, 1172, 'TAP TO START', 24).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
    this.input.once('pointerup', () => this.begin());
  }

  /** A save exists: pick it up, or wipe it and start over. */
  askContinue() {
    const y = 1166;
    const w = 320;
    const h = 76;
    new Button(this, {
      x: GAME_W / 2 - w / 2 - 8, y, w, h, text: 'CONTINUE', size: 22, accent: RIBBON_GOLD, textColor: '#ffd166',
      onPress: () => this.begin(),
    });
    let armed = false;
    const fresh = new Button(this, {
      x: GAME_W / 2 + w / 2 + 8, y, w, h, text: 'START FRESH', size: 22, accent: 0xff5c5c,
      onPress: () => {
        if (!armed) {
          armed = true;
          fresh.setText('TAP AGAIN TO WIPE');
          Audio.sfx('bad');
          return;
        }
        Save.reset();
        this.begin();
      },
    });
  }

  begin() {
    if (this.starting) return;
    this.starting = true;
    Audio.unlock();
    Audio.sfx('good');
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Overworld'));
  }
}
