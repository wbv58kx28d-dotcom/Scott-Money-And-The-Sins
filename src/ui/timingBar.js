// The beat-timing minigame bar (CLAUDE.md §5.4). Math is in systems/timing.js.
//
// HANDOFF quirk, kept on purpose: taps in the first 150 ms are ignored, so the
// tap that picked the move can't also end the minigame.

import { COLORS, LAYOUT } from '../config.js';
import { TIMING } from '../data/rules.js';
import { markerPosition, rateTiming, ratingById } from '../systems/timing.js';
import { Audio } from '../systems/audio.js';
import { rng } from '../systems/rng.js';
import { label, fitWidth } from './text.js';

// Zone colors from the prototype; WACK is the bare bar.
const ZONE_COLORS = { MID: 0x3a2a6a, FIRE: 0xff8c42, PERFECT: 0xffd166 };

export class TimingBar {
  constructor(scene, bus) {
    this.scene = scene;
    this.bus = bus;
    const b = LAYOUT.timingBar;
    const half = b.w / 2;
    const cx = b.x + half;
    this.layer = scene.add.container(0, 0).setDepth(25).setVisible(false);

    const g = scene.add.graphics();
    g.fillStyle(0x0a0618, 1);
    g.fillRect(b.x - 12, b.y - 10, b.w + 24, b.h + 20);
    g.lineStyle(4, 0xf2eaff, 1);
    g.strokeRect(b.x - 12, b.y - 10, b.w + 24, b.h + 20);
    // Widest zone first; each narrower zone paints over the middle.
    for (const r of [...TIMING.ratings].reverse()) {
      if (!ZONE_COLORS[r.id]) continue;
      g.fillStyle(ZONE_COLORS[r.id], 1);
      g.fillRect(Math.round(cx - r.within * half), b.y, Math.round(r.within * half * 2), b.h);
    }

    this.title = label(scene, cx, LAYOUT.panel.y + 28, '', 18, { color: COLORS.textGold }).setOrigin(0.5);
    this.prompt = label(scene, cx, LAYOUT.panel.y + 62, 'TAP ON THE BEAT!', 16, { color: COLORS.textGold }).setOrigin(0.5);
    this.result = label(scene, cx, LAYOUT.panel.y + 62, '', 22, { strokeThickness: 6 }).setOrigin(0.5).setVisible(false);
    this.marker = scene.add.rectangle(b.x, b.y + b.h / 2, 12, b.h + 28, 0xffffff).setStrokeStyle(3, 0x000000);
    this.layer.add([g, this.title, this.prompt, this.result, this.marker]);
  }

  /**
   * Run the minigame. Resolves with a rating from TIMING.ratings.
   * @param {{speed:number, title:string, perfect?:boolean}} o
   */
  play({ speed, title, perfect = false }) {
    const { scene, bus } = this;
    const b = LAYOUT.timingBar;
    this.title.setFontSize(18).setText(title);
    fitWidth(this.title, LAYOUT.panel.w - 40);
    this.prompt.setVisible(true).setAlpha(1);
    this.result.setVisible(false);
    this.layer.setVisible(true);
    const pulse = scene.tweens.add({ targets: this.prompt, alpha: 0.3, duration: Audio.beatMs / 2, yoyo: true, repeat: -1 });
    const fromRight = rng.fx.chance(0.5);
    const start = scene.time.now;

    return new Promise((resolve) => {
      let pos = fromRight ? 1 : 0;
      const update = () => {
        pos = markerPosition(scene.time.now - start, speed, fromRight);
        this.marker.setX(Math.round(b.x + b.w * pos));
      };
      const onTap = () => {
        if (scene.time.now - start < TIMING.ignoreFirstMs) return;
        scene.events.off('update', update);
        bus.off('tap', onTap);
        const rating = perfect ? ratingById('PERFECT') : rateTiming(pos);
        Audio.sfx(rating.sfx);
        pulse.remove();
        this.prompt.setVisible(false);
        this.result.setText(rating.label).setColor(rating.color).setVisible(true).setScale(1.6);
        scene.tweens.add({ targets: this.result, scale: 1, duration: 200, ease: 'Back.easeOut' });
        scene.time.delayedCall(TIMING.resultMs, () => {
          this.layer.setVisible(false);
          resolve(rating);
        });
      };
      update();
      scene.events.on('update', update);
      bus.on('tap', onTap);
    });
  }
}
