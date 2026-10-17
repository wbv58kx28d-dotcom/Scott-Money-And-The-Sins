// Emote bubbles: a little speech bubble with a pixel icon that pops over a
// character's head, like Pikachu's moods in Pokémon Yellow (data/followers.js).
// Drawn on the world art's 2 px grid (CLAUDE.md §8.4) so it doesn't shimmer.

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
