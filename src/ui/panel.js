// Framed panels for the HUD, menu, and dialog.

import { COLORS } from '../config.js';

/** Draw a framed panel. Returns the Graphics object. */
export function drawPanel(scene, { x, y, w, h }, { alpha = COLORS.panelAlpha, border = COLORS.panelBorder, borderWidth = 4 } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.shadow, 0.5);
  g.fillRect(x + 6, y + 6, w, h);
  g.fillStyle(COLORS.panel, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(borderWidth, border, 1);
  g.strokeRect(x + borderWidth / 2, y + borderWidth / 2, w - borderWidth, h - borderWidth);
  // Notched corners for a pixel-frame look.
  g.fillStyle(COLORS.shadow, 1);
  for (const [cx, cy] of [[x, y], [x + w - 4, y], [x, y + h - 4], [x + w - 4, y + h - 4]]) {
    g.fillRect(cx, cy, 4, 4);
  }
  return g;
}
