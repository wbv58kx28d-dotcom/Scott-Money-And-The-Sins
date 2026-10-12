// Preload: load art from src/data/assets.js. Anything missing gets a
// procedural placeholder under the same key, so scenes never check.

import { GAME_W, GAME_H, COLORS } from '../config.js';
import { IMAGES } from '../data/assets.js';
import { DEFAULT_ENEMY } from '../data/enemies/index.js';
import { DEBUG } from '../systems/debug.js';
import { makePlaceholder } from '../systems/placeholders.js';
import { label } from '../ui/text.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const barW = 420;
    const x = (GAME_W - barW) / 2;
    const y = GAME_H / 2;
    label(this, GAME_W / 2, y - 40, 'LOADING...', 20, { color: COLORS.textGold }).setOrigin(0.5);
    const frame = this.add.rectangle(GAME_W / 2, y + 10, barW, 28).setStrokeStyle(4, COLORS.panelBorder);
    const bar = this.add.rectangle(x + 4, y + 10, 0, 20, COLORS.flow).setOrigin(0, 0.5);
    this.load.on('progress', (p) => bar.setSize(Math.round((barW - 8) * p), 20));
    frame.setDepth(1);

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
    if (this.missing.length) {
      console.info(`[$cott] using placeholders for missing art: ${this.missing.join(', ')}`);
    }

    if (DEBUG.enabled) this.scene.start('Battle', { enemy: DEBUG.battle ?? DEFAULT_ENEMY });
    else this.scene.start('Title');
  }
}
