// The battle UI's look: slanted dark strips with a colored accent edge, the
// same style as the lyric ribbons (ui/speechBubble.js). The bottom panel, the
// menu buttons, the HUD cards, and the stat bars all draw from here.

import { LAYOUT } from '../config.js';

export const RIBBON_FILL = 0x0d0820;
export const RIBBON_GOLD = 0xffd166;
const NEUTRAL = 0x8a80a8;
const DISABLED_EDGE = 0x4a3a7a;
const CARD_SKEW = 12;
const BUTTON_SKEW = 10;
export const EDGE_W = 7;

/** A parallelogram whose top edge leans `skew` px right of its bottom edge. */
export function quad(x, y, w, h, skew) {
  return [
    { x: x + skew, y },
    { x: x + w + skew, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/**
 * A HUD card: shadow, dark slanted body, accent edge on the left. The top
 * edge leans right, so content should start `CARD_INSET` px in.
 */
export function drawCard(g, { x, y, w, h }, accent, { skew = CARD_SKEW, alpha = 0.92 } = {}) {
  g.fillStyle(0x000000, 0.45).fillPoints(quad(x + 6, y + 6, w, h, skew), true);
  g.fillStyle(RIBBON_FILL, alpha).fillPoints(quad(x, y, w, h, skew), true);
  g.fillStyle(accent, 1).fillPoints(quad(x, y, EDGE_W, h, skew), true);
  return g;
}
export const CARD_INSET = CARD_SKEW + EDGE_W + 10;

/** The bottom panel behind the menu, dialog, and timing bar. */
export function drawMenuPanel(scene) {
  const { x, y, w, h } = LAYOUT.panel;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45).fillPoints(quad(x + 6, y + 6, w - CARD_SKEW, h, CARD_SKEW), true);
  g.fillStyle(RIBBON_FILL, 0.94).fillPoints(quad(x, y, w - CARD_SKEW, h, CARD_SKEW), true);
  // Gold accent along the top edge (a left edge would collide with dialog text).
  g.fillStyle(RIBBON_GOLD, 1).fillRect(x + CARD_SKEW, y, w - CARD_SKEW, 4);
  return g;
}

/**
 * Button skin for ui/button.js. Buttons are drawn centered on (0, 0); the
 * label starts `inset` px in from the left edge when left-aligned.
 */
export const RIBBON_BUTTON = {
  inset: BUTTON_SKEW + EDGE_W + 12,
  button(g, { w, h, accent, fill, enabled, pressed, hover }) {
    const x = -w / 2;
    const y = -h / 2;
    const edge = enabled ? accent ?? NEUTRAL : DISABLED_EDGE;
    g.fillStyle(0x000000, 0.4).fillPoints(quad(x + 4, y + 4, w, h, BUTTON_SKEW), true);
    g.fillStyle(fill ?? (pressed || hover ? 0x2a1a48 : 0x1a1030), enabled ? 1 : 0.6).fillPoints(quad(x, y, w, h, BUTTON_SKEW), true);
    g.fillStyle(edge, 1).fillPoints(quad(x, y, EDGE_W, h, BUTTON_SKEW), true);
  },
};

/** The menu's prompt tag, above the panel. */
export const PROMPT_STYLE = { size: 16, color: '#ffd166', bg: '#0d0820', flash: '#ffffff' };
