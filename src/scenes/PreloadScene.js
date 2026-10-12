// Preload: load art from src/data/assets.js. Anything missing gets a
// procedural placeholder under the same key, so scenes never check.

import { GAME_W, GAME_H, COLORS } from '../config.js';
import { IMAGES } from '../data/assets.js';
import { DEBUG } from '../systems/debug.js';
import { makePlaceholder } from '../systems/placeholders.js';
import { label } from '../ui/text.js';
import { StatBar } from '../ui/bars.js';
import { prewarmBubbleGlyphs } from '../ui/speechBubble.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const barW = 420;
    const x = (GAME_W - barW) / 2;
    const y = GAME_H / 2;
    label(this, GAME_W / 2, y - 40, 'LOADING...', 20, { color: COLORS.textGold }).setOrigin(0.5);
    const bar = new StatBar(this, { x, y: y - 4, w: barW, h: 28, color: COLORS.flow, value: 0, max: 1, numbers: false });
    this.load.on('progress', (p) => bar.set(p, 1, false));

    this.missing = [];
    this.load.on('loaderror', (file) => this.missing.push(file.key));
    for (const img of IMAGES) {
      if (img.path) this.load.image(img.key, img.path);
    }
  }

  create() {
    for (const img of IMAGES) {
      if (!this.textures.exists(img.key)) makePlaceholder(this, img.key, img.placeholder);
    }
    // Render the speech-bubble letters now, so the first bars don't stutter.
    prewarmBubbleGlyphs(this);
    if (this.missing.length) {
      console.info(`[$cott] using placeholders for missing art: ${this.missing.join(', ')}`);
    }

    if (DEBUG.battle) this.scene.start('Battle', { enemy: DEBUG.battle });
    else if (DEBUG.enabled) this.scene.start('Overworld');
    else this.scene.start('Title');
  }
}
