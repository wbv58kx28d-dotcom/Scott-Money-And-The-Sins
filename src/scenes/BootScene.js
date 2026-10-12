// Boot: one-time setup (debug seed, audio unlock, debug hook), then Preload.
// Fonts are already loaded by the time this runs (src/main.js).

import { DEBUG } from '../systems/debug.js';
import { seedAll } from '../systems/rng.js';
import { Audio } from '../systems/audio.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    if (DEBUG.seed !== null) seedAll(DEBUG.seed);
    Audio.installUnlock();
    if (DEBUG.enabled) installDebugHook(this.game);
    this.scene.start('Preload');
  }
}

// window.__smm lets the smoke test (tools/smoke.mjs) read game state and find
// buttons. Only exists in debug mode.
function installDebugHook(game) {
  window.__smm = {
    game,
    debug: DEBUG,
    state() {
      const scene = game.scene.getScenes(true)[0];
      if (!scene) return { scene: null };
      const base = {
        scene: scene.scene.key,
        buttons: [...(scene.buttons ?? [])].map((b) => b.describe()),
      };
      return scene.debugState ? { ...base, ...scene.debugState() } : base;
    },
  };
  console.info('[$cott] debug mode', DEBUG);
}
