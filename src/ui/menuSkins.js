// Combat-menu looks. `LAYOUT.menuStyle` picks one; debug `&menu=` overrides.
// A skin draws the bottom panel, each menu button (centered on 0, 0), and the
// prompt tag. Menu logic and tap handling are the same for every skin.
//
//   classic  framed purple panel, gold-bordered buttons
//   ribbon   slanted dark strips with colored accent edges, like the bars
//   pads     MPC-style drum pads that glow in their color, LCD prompt
//   phone    $cott's phone: bezel, bold rounded app-style buttons, notification prompt

import { LAYOUT } from '../config.js';
import { DEBUG } from '../systems/debug.js';
import { drawPanel } from './panel.js';

const NEUTRAL = 0x8a80a8;

const SKINS = {
  classic: null,

  ribbon: {
    panel(g, { x, y, w, h }) {
      const skew = 12;
      g.fillStyle(0x000000, 0.45).fillPoints(quad(x + 6, y + 6, w - skew, h, skew), true);
      g.fillStyle(0x0d0820, 0.94).fillPoints(quad(x, y, w - skew, h, skew), true);
      // Gold accent along the top edge (a left edge would collide with dialog text).
      g.fillStyle(0xffd166, 1).fillRect(x + skew, y, w - skew, 4);
    },
    button(g, { w, h, accent, fill, enabled, pressed, hover }) {
      const skew = 10;
      const x = -w / 2;
      const y = -h / 2;
      const edge = enabled ? accent ?? NEUTRAL : 0x4a3a7a;
      g.fillStyle(0x000000, 0.4).fillPoints(quad(x + 4, y + 4, w, h, skew), true);
      g.fillStyle(fill ?? (pressed || hover ? 0x2a1a48 : 0x1a1030), enabled ? 1 : 0.6).fillPoints(quad(x, y, w, h, skew), true);
      g.fillStyle(edge, 1).fillPoints(quad(x, y, 7, h, skew), true);
    },
    prompt: { font: 'header', size: 16, color: '#ffd166', bg: '#0d0820', flash: '#ffffff' },
  },

  pads: {
    panel(g, { x, y, w, h }) {
      g.fillStyle(0x000000, 0.5).fillRoundedRect(x + 5, y + 5, w, h, 14);
      g.fillStyle(0x0a090d, 1).fillRoundedRect(x, y, w, h, 14);
      g.fillStyle(0x24212b, 1).fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 12);
      g.fillStyle(0xffffff, 0.05).fillRect(x + 12, y + 6, w - 24, 3);
      g.fillStyle(0x0a090d, 1);
      for (const [sx, sy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) g.fillCircle(sx, sy, 3);
    },
    button(g, { w, h, accent, fill, enabled, pressed }) {
      const x = -w / 2;
      const y = -h / 2;
      const color = accent ?? NEUTRAL;
      const lit = enabled && (pressed || fill);
      g.fillStyle(0x0a090d, 1).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 12);
      g.fillStyle(0x34303d, 1).fillRoundedRect(x, y, w, h, 10);
      if (enabled) g.fillStyle(lit ? fill ?? color : color, lit ? 0.95 : 0.42).fillRoundedRect(x, y, w, h, 10);
      g.fillStyle(0xffffff, lit ? 0.25 : 0.08).fillRoundedRect(x + 4, y + 3, w - 8, h * 0.3, 8);
      if (lit) g.lineStyle(3, 0xffffff, 0.6).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 10);
    },
    text: ({ fill }) => (fill ? { textColor: '#1a1030', subColor: '#1a1030' } : null),
    prompt: { font: 'body', size: 30, color: '#9dff9d', bg: '#071407', flash: '#eaffea' },
  },

  phone: {
    panel(g, { x, y, w, h }) {
      g.fillStyle(0x000000, 0.5).fillRoundedRect(x + 5, y + 5, w, h, 30);
      g.fillStyle(0x2a2a33, 1).fillRoundedRect(x, y, w, h, 30);
      g.fillStyle(0x0b0b10, 1).fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 24);
      g.fillStyle(0x2a2a33, 1).fillRoundedRect(x + w / 2 - 40, y - 4, 80, 12, 6);
    },
    button(g, { w, h, accent, fill, enabled, pressed }) {
      const x = -w / 2;
      const y = -h / 2;
      const color = enabled ? fill ?? accent ?? 0x3a3a46 : 0x24242c;
      g.fillStyle(color, 1).fillRoundedRect(x, y, w, h, 16);
      g.fillStyle(0xffffff, 0.12).fillRoundedRect(x + 3, y + 3, w - 6, h * 0.4, 13);
      if (pressed) g.fillStyle(0x000000, 0.25).fillRoundedRect(x, y, w, h, 16);
    },
    // Bold color tiles take dark text; neutral grey tiles keep white.
    text: ({ accent, fill, enabled }) => {
      if (!enabled) return { textColor: '#8a8496', subColor: '#6b6478', noStroke: true };
      return accent || fill
        ? { textColor: '#14121c', subColor: '#2a2440', noStroke: true }
        : { textColor: '#ffffff', subColor: '#c8c4d4', noStroke: true };
    },
    prompt: { font: 'header', size: 14, color: '#14121c', bg: '#f5f1e8', flash: '#c2185b' },
  },
};

/** A parallelogram whose top edge leans `skew` px right of its bottom edge. */
function quad(x, y, w, h, skew) {
  return [
    { x: x + skew, y },
    { x: x + w + skew, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export const menuSkinName = () => (DEBUG.menu in SKINS ? DEBUG.menu : LAYOUT.menuStyle);

/** The active skin, or null for classic. */
export const menuSkin = () => SKINS[menuSkinName()];

/** Draw the bottom panel behind the menu and dialog in the active skin. */
export function drawMenuPanel(scene) {
  const skin = menuSkin();
  if (!skin) return drawPanel(scene, LAYOUT.panel);
  const g = scene.add.graphics();
  skin.panel(g, LAYOUT.panel);
  return g;
}

