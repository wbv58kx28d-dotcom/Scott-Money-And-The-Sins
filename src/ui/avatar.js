// Round profile pictures for the social app (data/social.js ACCOUNTS): the
// head of the account's field walker sheet (its idle frame, at scale 1), or
// an initial on a colored dot for accounts without one.

import { FIELD } from '../config.js';
import { FIELD_SHEETS } from '../data/assets.js';
import { ACCOUNTS } from '../data/social.js';
import { label } from './text.js';
import { pixelIcon } from './phoneIcons.js';

const HEAD = 56; // px cropped from the frame, the head and a bit of collar

/** In a scene's preload(): load the walker sheets the avatars need (if not loaded yet). */
export function preloadAvatars(scene) {
  const { w, h } = FIELD.frame;
  const wanted = new Set(Object.values(ACCOUNTS).map((a) => a.sheet).filter(Boolean));
  for (const s of FIELD_SHEETS) {
    if (wanted.has(s.key) && s.path && !scene.textures.exists(s.key)) scene.load.spritesheet(s.key, s.path, { frameWidth: w, frameHeight: h });
  }
}

/** A 'head' frame on a walker sheet: centered, starting just above the top of the hair. */
function headFrame(scene, key) {
  const tex = scene.textures.get(key);
  if (tex.has('head')) return 'head';
  const f0 = tex.get(0);
  let top = 0;
  find: for (let y = 0; y < f0.height; y++) {
    for (let x = 0; x < f0.width; x += 2) {
      if (scene.textures.getPixelAlpha(x, y, key, 0) > 0) {
        top = y;
        break find;
      }
    }
  }
  tex.add('head', f0.sourceIndex, f0.cutX + Math.round((f0.width - HEAD) / 2), f0.cutY + Math.max(0, top - 4), HEAD, HEAD);
  return 'head';
}

/** A verified badge: a gold dot with a check, centered on (x, y). Returns its objects. */
export function verifiedBadge(scene, x, y) {
  const g = scene.add.graphics().fillStyle(0x0d0820, 1).fillCircle(x, y, 12).fillStyle(0xffd166, 1).fillCircle(x, y, 10);
  return [g, pixelIcon(scene, Math.round(x - 9), Math.round(y - 9), 'check', { px: 2, color: '#0d0820' })];
}

/** An avatar of `size` px centered on (x, y). Returns its objects, for adding to a container. */
export function avatar(scene, x, y, accountId, size = 68) {
  const acct = ACCOUNTS[accountId] ?? { name: '?', color: 0x6f6888 };
  const r = size / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.5).fillCircle(x + 2, y + 3, r);
  g.fillStyle(acct.color ?? 0x2a2440, 1).fillCircle(x, y, r);
  g.lineStyle(3, 0xffffff, 0.15).strokeCircle(x, y, r - 1);
  const out = [g];
  if (acct.sheet && scene.textures.exists(acct.sheet)) {
    out.push(scene.add.image(Math.round(x), Math.round(y + 4), acct.sheet, headFrame(scene, acct.sheet)).setOrigin(0.5));
  } else {
    out.push(label(scene, Math.round(x), Math.round(y + 1), acct.name.replace(/[^A-Z]/g, '').charAt(0) || '?', Math.round(size * 0.4), {
      strokeThickness: 0,
    }).setOrigin(0.5));
  }
  return out;
}
