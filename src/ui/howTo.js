// The "?" cheat sheet overlay. It's interactive, so taps on it never reach
// the dialog or the timing bar; a tap (same press, released) closes it.

import { GAME_W, GAME_H, COLORS } from '../config.js';
import { DISS_TYPES } from '../data/types.js';
import { HOW_TO } from '../data/battleText.js';
import { label, body } from './text.js';
import { drawCard, hex, RIBBON_GOLD } from './ribbon.js';


export function showHowTo(scene, onClose) {
  const layer = scene.add.container(0, 0).setDepth(70);
  const bg = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x07040f, 0.96).setOrigin(0).setInteractive();
  layer.add(bg);
  const title = label(scene, 0, 70, HOW_TO.title, 26, { color: COLORS.textGold }).setOrigin(0, 0.5);
  title.setX(Math.round((GAME_W - title.width) / 2));
  layer.add(drawCard(scene.add.graphics(), { x: title.x - 34, y: 44, w: title.width + 56, h: 52 }, RIBBON_GOLD));
  layer.add(title);
  const text = body(scene, 44, 112, HOW_TO.body, 36, { color: '#e2d9ff', wordWrap: { width: GAME_W - 88 } });
  layer.add(text);

  let y = text.y + text.height + 26;
  for (const type of Object.values(DISS_TYPES)) {
    // Each type name sits on a small ribbon tag in its color.
    const name = label(scene, 66, y + 2, type.id, 18, { color: type.color });
    layer.add(drawCard(scene.add.graphics(), { x: 44, y: y - 6, w: name.width + 40, h: 32 }, hex(type.color), { skew: 8 }));
    layer.add(name);
    layer.add(body(scene, 44, y + 26, type.targets.length ? type.targets.join(', ') : 'Self buffs, no target', 32, { color: '#cfc3ef' }));
    y += 78;
  }
  layer.add(body(scene, GAME_W / 2, Math.min(y + 16, GAME_H - 60), HOW_TO.close, 34, { color: '#9d90c8' }).setOrigin(0.5, 0));

  let downTime = null;
  bg.on('pointerdown', (p) => (downTime = p.downTime));
  bg.on('pointerup', (p) => {
    if (p.downTime !== downTime) return;
    setTimeout(() => {
      layer.destroy();
      onClose?.();
    }, 1);
  });
  return layer;
}
