// A tiny 3×5 pixel font for lettering painted on world art (sign boards).
//
// World art uses 2 screen px per art pixel (CLAUDE.md §8.4). Ordinary text has
// 1 px strokes, and when a phone scales the canvas by a non-whole factor
// (e.g. 1.625×), a 1 px stroke flips between 1 and 2 device pixels as the
// camera moves, so lettering seems to shimmer. Drawing letters on the same
// 2 px grid as the art keeps them as steady as everything around them.

const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  ' ': ['...', '...', '...', '...', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'],
  '.': ['...', '...', '...', '...', '.#.'], '-': ['...', '...', '###', '...', '...'],
  "'": ['.#.', '.#.', '...', '...', '...'], $: ['.##', '##.', '.#.', '.##', '##.'],
  r: ['...', '...', '.##', '#..', '#..'], // lowercase, for "r/APES"
  '+': ['...', '.#.', '###', '.#.', '...'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  ':': ['...', '.#.', '...', '.#.', '...'], ',': ['...', '...', '...', '.#.', '#..'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '*': ['#.#', '.#.', '###', '.#.', '#.#'], '#': ['#.#', '###', '#.#', '###', '#.#'],
};
const W = 3;
const H = 5;
const GAP = 1;

/** The glyph for a character: an exact match, else its uppercase, else "?". */
const glyph = (ch) => GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS['?'];

/** Width in screen px of `str` drawn at `px` screen px per font pixel. */
export const pixelTextWidth = (str, px) => (str.length * (W + GAP) - GAP) * px;

/**
 * An image of `str` in the pixel font at `px` screen px per font pixel, with
 * its top-left at (x, y). Each string is drawn once and cached as a texture.
 */
export function pixelText(scene, x, y, str, { px = 2, color = '#2a1a10' } = {}) {
  const key = `pxfont:${px}:${color}:${str}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, pixelTextWidth(str, px), H * px);
    const ctx = tex.getContext();
    ctx.fillStyle = color;
    [...str].forEach((ch, i) => {
      glyph(ch).forEach((row, gy) => {
        [...row].forEach((cell, gx) => {
          if (cell === '#') ctx.fillRect((i * (W + GAP) + gx) * px, gy * px, px, px);
        });
      });
    });
    tex.refresh();
  }
  return scene.add.image(x, y, key).setOrigin(0, 0);
}
