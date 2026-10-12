// Entry point: wait for fonts, then start Phaser.
// Phaser is the global from lib/phaser.min.js (loaded as a classic script in
// index.html before this module). Never import it.

import { GAME_W, GAME_H, COLORS } from './config.js';
import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import TitleScene from './scenes/TitleScene.js';
import BattleScene from './scenes/BattleScene.js';
import OverworldScene from './scenes/OverworldScene.js';
import RegionScene from './scenes/RegionScene.js';

const FONT_TIMEOUT_MS = 2500;

// Text fitting measures rendered text, so both fonts must be ready first.
// If Google Fonts is slow or blocked, start anyway after 2.5 s.
function waitForFonts() {
  if (!document.fonts?.load) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('16px "Press Start 2P"'),
    document.fonts.load('16px "VT323"'),
  ]).catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
  return Promise.race([loads, timeout]);
}

waitForFonts().then(() => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: COLORS.bg,
    pixelArt: true,
    roundPixels: true,
    audio: { noAudio: true }, // the beat is WebAudio (systems/audio.js)
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, PreloadScene, TitleScene, OverworldScene, RegionScene, BattleScene],
  });
});
