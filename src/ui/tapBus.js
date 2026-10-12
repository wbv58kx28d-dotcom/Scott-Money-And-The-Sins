// Tap-to-advance input for a scene.
//
// Taps are detected on POINTERDOWN, and taps that land on an interactive
// object (a button) are ignored; buttons act on pointerup instead
// (see ui/button.js). Together these stop the tap that picks a menu option
// from also skipping the next dialog line or ending the timing minigame.
// Space and Enter count as taps on desktop.

export class TapBus extends Phaser.Events.EventEmitter {
  constructor(scene) {
    super();
    this.scene = scene;
    this.onPointerDown = (pointer, currentlyOver) => {
      if (currentlyOver.length > 0) return;
      this.emit('tap', pointer);
    };
    this.onKey = (event) => {
      if (event.repeat) return;
      this.emit('tap', null);
    };
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.keyboard?.on('keydown-SPACE', this.onKey);
    scene.input.keyboard?.on('keydown-ENTER', this.onKey);
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Resolves on the next tap. */
  next() {
    return new Promise((resolve) => this.once('tap', resolve));
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.keyboard?.off('keydown-SPACE', this.onKey);
    this.scene.input.keyboard?.off('keydown-ENTER', this.onKey);
    this.removeAllListeners();
    super.destroy();
  }
}
