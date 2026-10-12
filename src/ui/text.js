// Text helpers. Fitting measures rendered text, which is why the game waits
// for both fonts before booting (src/main.js).

import { FONTS, COLORS } from '../config.js';

const BASE = {
  color: COLORS.text,
  stroke: COLORS.outline,
};

/** Press Start 2P label. */
export function label(scene, x, y, str, size = 20, style = {}) {
  return scene.add.text(x, y, str, {
    ...BASE,
    fontFamily: FONTS.header,
    fontSize: `${size}px`,
    strokeThickness: Math.max(2, Math.round(size / 5)),
    ...style,
  });
}

/** VT323 body text. */
export function body(scene, x, y, str, size = 36, style = {}) {
  return scene.add.text(x, y, str, {
    ...BASE,
    fontFamily: FONTS.body,
    fontSize: `${size}px`,
    strokeThickness: 0,
    ...style,
  });
}

/** Shrink a one-line text object until it fits `maxWidth`. */
export function fitWidth(textObj, maxWidth, minSize = 8) {
  let size = parseInt(textObj.style.fontSize, 10);
  while (textObj.width > maxWidth && size > minSize) {
    size -= 1;
    textObj.setFontSize(size);
  }
  return textObj;
}

/**
 * Word-wrap `str` into a box, shrinking the font until it fits. Returns the
 * wrapped lines joined with "\n" so a typewriter can reveal them without
 * words jumping between lines mid-type. Leaves the text object empty.
 */
export function fitWrapped(textObj, str, { maxWidth, maxHeight, maxSize, minSize = 16 }) {
  let size = maxSize;
  textObj.setWordWrapWidth(maxWidth, true);
  for (;;) {
    textObj.setFontSize(size);
    const lines = textObj.getWrappedText(str);
    textObj.setText(lines.join('\n'));
    if (textObj.height <= maxHeight || size <= minSize) {
      const wrapped = lines.join('\n');
      textObj.setWordWrapWidth(null);
      textObj.setText('');
      return wrapped;
    }
    size -= 2;
  }
}
