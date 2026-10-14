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
// buttons. Only exists in debug mode. `scene` is the bottom running scene;
// an overlay on top of it (a minigame) adds its buttons and state.
function installDebugHook(game) {
  window.__smm = {
    game,
    debug: DEBUG,
    state() {
      const scenes = game.scene.getScenes(true);
      if (!scenes.length) return { scene: null };
      let out = { scene: scenes[0].scene.key, buttons: [] };
      for (const scene of scenes) {
        const buttons = [...(scene.buttons ?? [])].map((b) => b.describe());
        out = { ...out, ...scene.debugState?.(), buttons: [...out.buttons, ...buttons] };
      }
      return out;
    },
  };
  console.info('[$cott] debug mode', DEBUG);
}
