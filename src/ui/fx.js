// Hit effects, popups, and lunges. Character sprites use feet origins, so
// "above the head" is y - displayHeight.

import { LAYOUT } from '../config.js';
import { Audio } from '../systems/audio.js';
import { label, body } from './text.js';

export const wait = (scene, ms) => new Promise((resolve) => scene.time.delayedCall(ms, resolve));

/** Text that pops up and floats away. */
export function floatText(scene, x, y, str, { color = '#ffffff', size = 28, font = 'header', rise = 68, duration = 1100 } = {}) {
  const make = font === 'header' ? label : body;
  const t = make(scene, Math.round(x), Math.round(y), str, size, { color, stroke: '#000000', strokeThickness: 10 })
    .setOrigin(0.5)
    .setDepth(40);
  scene.tweens.add({ targets: t, y: y - rise, alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  return t;
}

/** Top of a character's head, for popups. */
export function headPoint(character) {
  const { container, sprite } = character;
  return { x: container.x, y: container.y - sprite.displayHeight - LAYOUT.headroom };
}

/** Lunge toward the opponent and back. */
export function lunge(scene, character, { dx, dy }) {
  const { container } = character;
  const x0 = container.x;
  const y0 = container.y;
  return new Promise((resolve) =>
    scene.tweens.add({
      targets: container, x: x0 + dx, y: y0 + dy, duration: 90, ease: 'Quad.easeOut', yoyo: true,
      onComplete: () => {
        container.setPosition(x0, y0);
        resolve();
      },
    }),
  );
}

/** Set or clear the sprite tint for the battler's statuses (Mooning, Squeezed). */
export function reTint(character, battler) {
  const tint = battler.statuses.tint();
  if (tint) character.sprite.setTint(tint);
  else character.sprite.clearTint();
}

/**
 * The prototype's hit effect: flash white three times, shake the camera on
 * big hits (anything above 1×), and float the damage number.
 */
export function hitFx(scene, character, battler, dmg, hit) {
  const big = hit.mult > 1;
  Audio.sfx(big ? 'crit' : 'hit');
  let n = 0;
  scene.time.addEvent({
    delay: 70,
    repeat: 5,
    callback: () => {
      n += 1;
      if (n % 2) character.sprite.setTintFill(0xffffff);
      else reTint(character, battler); // the last flash (n = 6) ends on the real tint
    },
  });
  if (big) scene.cameras.main.shake(hit.id === 'crit' ? 320 : 220, hit.id === 'crit' ? 0.02 : 0.012);
  const color = big ? '#ffd166' : hit.mult < 1 ? '#9a92b8' : '#ffffff';
  const p = headPoint(character);
  floatText(scene, p.x, p.y, `${hit.id === 'crit' ? 'CRIT ' : ''}-${dmg}`, { color, size: big ? 36 : 28 });
}
