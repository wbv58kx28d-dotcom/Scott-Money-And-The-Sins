// A cache of single-character textures, so speech bubbles can draw each
// letter as its own Image and jitter letters independently. Each character is
// rendered once per style (with Phaser's Text) and reused from then on;
// textures are game-wide, so the cache survives scene restarts.

const cache = new Map(); // `${styleId}|${char}` -> { key, advance }

/**
 * The texture for one character in a named style.
 * @param {Phaser.Scene} scene
 * @param {string} styleId  any stable name for `style`
 * @param {Phaser.Types.GameObjects.Text.TextStyle} style
 * @param {string} ch  a single character
 * @returns {{ key: string, advance: number }} advance = the font's width for ch (no outline)
 */
export function glyph(scene, styleId, style, ch) {
  const id = `${styleId}|${ch}`;
  const hit = cache.get(id);
  if (hit && scene.textures.exists(hit.key)) return hit;

  const t = scene.make.text({ x: 0, y: 0, text: ch, style, add: false });
  // Phaser's width includes the outline; letters are spaced by the font's own advance.
  const advance = t.context.measureText(ch).width;
  const canvas = document.createElement('canvas');
  canvas.width = t.canvas.width;
  canvas.height = t.canvas.height;
  canvas.getContext('2d').drawImage(t.canvas, 0, 0);
  t.destroy();

  const key = `glyph:${id}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
  const entry = { key, advance };
  cache.set(id, entry);
  return entry;
}

/** Render every printable ASCII character in a style ahead of time. */
export function prewarmGlyphs(scene, styleId, style) {
  for (let c = 33; c < 127; c++) glyph(scene, styleId, style, String.fromCharCode(c));
}
