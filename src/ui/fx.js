// Hit effects, popups, and lunges. Character sprites use feet origins, so
// "above the head" is y - displayHeight.

import { LAYOUT } from '../config.js';
import { label, body } from './text.js';

const wait = (scene, ms) => new Promise((resolve) => scene.time.delayedCall(ms, resolve));

/** Text that pops up and floats away. */
export function floatText(scene, x, y, str, { color = '#ffffff', size = 28, font = 'header', rise = 70, duration = 900, delay = 0 } = {}) {
  const make = font === 'header' ? label : body;
  const t = make(scene, Math.round(x), Math.round(y), str, size, { color }).setOrigin(0.5).setDepth(50);
  t.setScale(0.6);
  scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut', delay });
  scene.tweens.add({
    targets: t,
    y: y - rise,
    alpha: 0,
    duration,
    delay: delay + 260,
    ease: 'Cubic.easeIn',
    onComplete: () => t.destroy(),
  });
  return t;
}

/** Top of a character's head, for popups. */
export function headPoint(character) {
  const { container, sprite } = character;
  return { x: container.x, y: container.y - sprite.displayHeight - LAYOUT.headroom };
}

/** Lunge toward the opponent and back. */
export async function lunge(scene, character, { dx, dy }) {
  const { container } = character;
  const x0 = container.x;
  const y0 = container.y;
  await new Promise((resolve) =>
    scene.tweens.add({ targets: container, x: x0 + dx, y: y0 + dy, duration: 110, ease: 'Quad.easeOut', yoyo: true, hold: 40, onComplete: resolve }),
  );
  container.setPosition(x0, y0);
}

/** Flash white and shake. */
export function hitShake(scene, character, strength = 10) {
  const { container, sprite } = character;
  const x0 = container.x;
  sprite.setTintFill(0xffffff);
  scene.time.delayedCall(70, () => sprite.clearTint());
  scene.time.delayedCall(140, () => sprite.setTintFill(0xffffff));
  scene.time.delayedCall(200, () => sprite.clearTint());
  scene.tweens.add({
    targets: container,
    x: x0 + strength,
    duration: 40,
    yoyo: true,
    repeat: 3,
    onComplete: () => container.setX(x0),
  });
}

export { wait };
