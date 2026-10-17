// Emote bubbles: a little speech bubble with a pixel icon that pops over a
// character's head, like Pikachu's moods in Pokémon Yellow (data/followers.js);
// and bark bubbles, the same bubble holding one short line of text.
// Drawn on the world art's 2 px grid (CLAUDE.md §8.4) so it doesn't shimmer.

import { body } from './text.js';

const PX = 2;
const INK = 0x1b1226;
const PAPER = 0xfff6fb;
const COLORS = { k: INK, r: 0xff2e63, p: 0xff8ad8, y: 0xffd166 };

// Icons, one character per art pixel: k ink, r red, p pink, y gold.
const ICONS = {
  heart: [
    '.kk...kk.',
    'kppk.krrk',
    'kprrkrrrk',
    'krrrrrrrk',
    '.krrrrrk.',
    '..krrrk..',
    '...krk...',
    '....k....',
  ],
  anger: [
    '.rr...rr.',
    '..r...r..',
    'rr.....rr',
    '.........',
    '.........',
    'rr.....rr',
    '..r...r..',
    '.rr...rr.',
  ],
  dots: [
    '.........',
    '.........',
    '.........',
    'kk.kk.kk.',
    'kk.kk.kk.',
    '.........',
    '.........',
    '.........',
  ],
  note: [
    '....kk...',
    '....kkk..',
    '....k.kk.',
    '....k..k.',
    '....k....',
    '..kkk....',
    '.kkkk....',
    '..kk.....',
  ],
  bang: [
    '...yy....',
    '...yy....',
    '...yy....',
    '...yy....',
    '...yy....',
    '.........',
    '...yy....',
    '...yy....',
  ],
};
export const EMOTES = Object.keys(ICONS);

const ICON_W = 9;
const ICON_H = 8;
const PAD = 3; // art px of bubble around the icon
const BW = ICON_W + PAD * 2; // bubble, in art px
const BH = ICON_H + PAD * 2;

/** A bubble with an emote icon, its tail's tip at (0, 0); a Graphics to position and destroy. */
export function emoteBubble(scene, id) {
  const g = scene.add.graphics();
  const x0 = -Math.floor(BW / 2);
  const y0 = -(BH + 3); // the tail is 3 art px tall
  const px = (x, y, color, w = 1, h = 1) => g.fillStyle(color, 1).fillRect((x0 + x) * PX, (y0 + y) * PX, w * PX, h * PX);
  // Ink outline (rounded corners), paper inside, then the tail.
  px(1, 0, INK, BW - 2, BH);
  px(0, 1, INK, BW, BH - 2);
  px(2, 1, PAPER, BW - 4, BH - 2);
  px(1, 2, PAPER, BW - 2, BH - 4);
  const tx = Math.floor(BW / 2) - 1;
  px(tx, BH, INK, 3, 1);
  px(tx + 1, BH + 1, INK, 1, 2);
  px(tx + 1, BH - 1, PAPER, 1, 1);
  px(tx + 1, BH, PAPER, 1, 1);
  (ICONS[id] ?? ICONS.dots).forEach((row, y) => [...row].forEach((ch, x) => {
    if (COLORS[ch]) px(PAD + x, PAD + y, COLORS[ch]);
  }));
  return g;
}

// Bark bubbles: text inside, wrapped to BARK.wrap px, BARK.pad px of paper around it.
const BARK = { size: 26, wrap: 250, pad: 10, tail: 4 }; // tail: steps of PX

/**
 * A bubble holding a line of text, its tail's tip at (0, 0): a Container to
 * position and destroy. Its width and height are whole art pixels.
 */
export function barkBubble(scene, str) {
  const text = body(scene, 0, 0, str, BARK.size, { color: '#1b1226', wordWrap: { width: BARK.wrap }, align: 'center' });
  const even = (v) => Math.ceil(v / PX) * PX;
  const w = even(text.width + BARK.pad * 2);
  const h = even(text.height + BARK.pad);
  const x0 = -even(w / 2);
  const y0 = -(h + BARK.tail * PX);
  const g = scene.add.graphics();
  const rect = (x, y, rw, rh, color) => g.fillStyle(color, 1).fillRect(x, y, rw, rh);
  // Ink outline with clipped corners, paper inside, and a tail down to her head.
  rect(x0 + PX, y0, w - PX * 2, h, INK);
  rect(x0, y0 + PX, w, h - PX * 2, INK);
  rect(x0 + PX * 2, y0 + PX, w - PX * 4, h - PX * 2, PAPER);
  rect(x0 + PX, y0 + PX * 2, w - PX * 2, h - PX * 4, PAPER);
  // The tail: steps narrowing to a point, paper inside, open into the bubble.
  for (let k = 0; k < BARK.tail; k++) {
    const half = (BARK.tail - k) * PX;
    const y = -(BARK.tail - k) * PX;
    rect(-half, y, half * 2, PX, INK);
    if (half > PX) rect(-half + PX, y - PX, half * 2 - PX * 2, PX * 2, PAPER);
  }
  text.setPosition(Math.round(x0 + (w - text.width) / 2), Math.round(y0 + (h - text.height) / 2));
  return scene.add.container(0, 0, [g, text]);
}
