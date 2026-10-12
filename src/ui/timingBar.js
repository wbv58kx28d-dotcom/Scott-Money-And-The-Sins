// The beat-timing minigame bar (CLAUDE.md §5.4). Math is in systems/timing.js.
//
// HANDOFF quirk, kept on purpose: taps in the first 150 ms are ignored, so the
// tap that picked the move can't also end the minigame.

import { COLORS, LAYOUT, RESULT_COLORS } from '../config.js';
import { TIMING } from '../data/rules.js';
import { markerPosition, rateTiming, ratingById, sweepMs } from '../systems/timing.js';
import { label, fitWidth } from './text.js';

const ZONE_COLORS = { WACK: 0x2a2140, MID: 0x2f6f9f, FIRE: 0xd9692b, PERFECT: 0xf4d35e };

export class TimingBar {
  constructor(scene, bus) {
    this.scene = scene;
    this.bus = bus;
    const b = LAYOUT.timingBar;
    this.layer = scene.add.container(0, 0).setVisible(false);

    const g = scene.add.graphics();
    // Widest zone first; each narrower zone paints over the middle.
    for (const r of [...TIMING.ratings].reverse()) {
      const half = r.within === Infinity ? 0.5 : r.within;
      g.fillStyle(ZONE_COLORS[r.id], 1);
      g.fillRect(Math.round(b.x + b.w * (0.5 - half)), b.y, Math.round(b.w * half * 2), b.h);
    }
    g.lineStyle(4, 0x000000, 1);
    g.strokeRect(b.x, b.y, b.w, b.h);

    this.title = label(scene, b.x + b.w / 2, LAYOUT.panel.y + 30, '', 18, { color: COLORS.textGold }).setOrigin(0.5);
    this.hint = label(scene, b.x + b.w / 2, LAYOUT.panel.y + 62, 'TAP ON THE BEAT!', 14, { color: COLORS.text }).setOrigin(0.5);
    this.marker = scene.add.rectangle(b.x, b.y + b.h / 2, 10, b.h + 22, 0xffffff).setStrokeStyle(3, 0x000000);
    this.layer.add([g, this.title, this.hint, this.marker]);
  }

  /**
   * Run the minigame. Resolves with a rating from TIMING.ratings.
   * @param {{speed:number, title:string, perfect?:boolean}} o
   */
  play({ speed, title, perfect = false }) {
    const { scene, bus } = this;
    const b = LAYOUT.timingBar;
    this.title.setText(title.toUpperCase()).setFontSize(18);
    fitWidth(this.title, LAYOUT.panel.w - 40);
    this.layer.setVisible(true);
    const start = scene.time.now;
    const limit = sweepMs(speed) * TIMING.maxSweeps;

    return new Promise((resolve) => {
      let pos = 0;
      const update = () => {
        const elapsed = scene.time.now - start;
        pos = markerPosition(elapsed, speed);
        this.marker.setX(Math.round(b.x + b.w * pos));
        if (elapsed > limit) finish(ratingById('WACK'));
      };
      const onTap = () => {
        if (scene.time.now - start < TIMING.ignoreFirstMs) return;
        finish(perfect ? ratingById('PERFECT') : rateTiming(pos));
      };
      const finish = (rating) => {
        scene.events.off('update', update);
        bus.off('tap', onTap);
        this.marker.setFillStyle(Phaser.Display.Color.HexStringToColor(RESULT_COLORS[rating.id]).color);
        scene.time.delayedCall(260, () => {
          this.layer.setVisible(false);
          this.marker.setFillStyle(0xffffff);
          resolve(rating);
        });
      };
      scene.events.on('update', update);
      bus.on('tap', onTap);
    });
  }
}
