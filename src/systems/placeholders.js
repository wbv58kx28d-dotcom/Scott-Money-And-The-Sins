// Procedural placeholder textures, generated when real art is missing.
// Per CLAUDE.md §8.1 they bake an integer pixel size into the texture at
// creation; nothing is ever scaled with setScale.

import { GAME_W, GAME_H, PLACEHOLDER_PX, OUTLINE_PX } from '../config.js';
import { PIXEL_SPRITES } from '../data/placeholders.js';
import { createRng } from './rng.js';

const OUTLINE_COLOR = '#120d1c';

/** Bake a pixel map into a canvas texture with a dark outline. */
export function bakePixelSprite(scene, key, { rows, palette }, px = PLACEHOLDER_PX, outline = OUTLINE_PX) {
  const h = rows.length;
  const w = rows[0].length;
  const tex = scene.textures.createCanvas(key, w * px + outline * 2, h * px + outline * 2);
  const ctx = tex.getContext();
  const solid = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && solid.push([x, y, ch])));

  // Outline: an oversized dark block behind every pixel; colors paint over it.
  ctx.fillStyle = OUTLINE_COLOR;
  for (const [x, y] of solid) ctx.fillRect(x * px, y * px, px + outline * 2, px + outline * 2);
  for (const [x, y, ch] of solid) {
    ctx.fillStyle = palette[ch] ?? '#ff00ff';
    ctx.fillRect(outline + x * px, outline + y * px, px, px);
  }
  tex.refresh();
}

/**
 * Night-city battle background (stand-in for bg_tokyo.webp). Drawn at
 * quarter resolution, then blown up 4× with nearest-neighbor so it reads as
 * pixel art. Follows the background rules: dimmed, horizon about halfway
 * down, bottom band dark for the menu.
 */
export function bakeCityBackground(scene, key) {
  const S = 4;
  const w = GAME_W / S;
  const h = GAME_H / S;
  const rand = createRng(20261011); // fixed: same skyline every time
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const c = small.getContext('2d');
  const horizon = 168;

  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#0d0820');
  sky.addColorStop(1, '#3b1d4a');
  c.fillStyle = sky;
  c.fillRect(0, 0, w, horizon);

  // Stars and the moon (everything here goes to the moon eventually).
  c.fillStyle = '#cfc7ff';
  for (let i = 0; i < 60; i++) c.fillRect(rand.int(0, w), rand.int(0, horizon - 60), 1, 1);
  c.fillStyle = '#f6e7b0';
  c.beginPath();
  c.arc(140, 40, 14, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#d9c78f';
  c.fillRect(134, 34, 4, 3);
  c.fillRect(144, 44, 3, 3);

  const skyline = (color, minH, maxH, windowColors, litChance) => {
    let x = -4;
    while (x < w) {
      const bw = rand.int(12, 26);
      const bh = rand.int(minH, maxH);
      const top = horizon - bh;
      c.fillStyle = color;
      c.fillRect(x, top, bw, bh);
      for (let wy = top + 4; wy < horizon - 3; wy += 4) {
        for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
          if (rand.chance(litChance)) {
            c.fillStyle = rand.pick(windowColors);
            c.fillRect(wx, wy, 1, 2);
          }
        }
      }
      x += bw + rand.int(0, 3);
    }
  };
  skyline('#24183a', 40, 110, ['#5a4a7a', '#6b4f6f'], 0.25);
  skyline('#150e24', 20, 70, ['#ffd27a', '#ff7ab6', '#7ad7ff'], 0.18);

  // Neon signs.
  for (const [x, y, color] of [[22, horizon - 52, '#ff4fa3'], [96, horizon - 38, '#4fe0ff'], [156, horizon - 60, '#ffd84f']]) {
    c.fillStyle = color;
    c.fillRect(x, y, 10, 3);
    c.globalAlpha = 0.25;
    c.fillRect(x - 2, y - 2, 14, 7);
    c.globalAlpha = 1;
  }

  // Street with wet reflections and perspective lines.
  const ground = c.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, '#2a1d3d');
  ground.addColorStop(1, '#0f0a18');
  c.fillStyle = ground;
  c.fillRect(0, horizon, w, h - horizon);
  c.fillStyle = '#3a2a55';
  for (let i = -6; i <= 6; i++) {
    for (let y = horizon; y < h; y += 2) {
      const t = (y - horizon) / (h - horizon);
      c.fillRect(Math.round(w / 2 + i * 6 + i * t * 40), y, 1, 1);
    }
  }
  for (let i = 0; i < 40; i++) {
    c.fillStyle = rand.pick(['#ff4fa355', '#4fe0ff44', '#ffd84f33']);
    c.fillRect(rand.int(0, w), rand.int(horizon + 4, h - 50), rand.int(2, 6), 1);
  }

  // Dim everything, then darken the bottom band for the menu panel.
  c.fillStyle = 'rgba(8, 5, 16, 0.25)';
  c.fillRect(0, 0, w, h);
  const band = c.createLinearGradient(0, h * 0.78, 0, h);
  band.addColorStop(0, 'rgba(5, 3, 10, 0)');
  band.addColorStop(1, 'rgba(5, 3, 10, 0.85)');
  c.fillStyle = band;
  c.fillRect(0, h * 0.78, w, h * 0.22);

  const tex = scene.textures.createCanvas(key, GAME_W, GAME_H);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, GAME_W, GAME_H);
  tex.refresh();
}

/** Generate a named placeholder under `key`. */
export function makePlaceholder(scene, key, placeholder) {
  if (placeholder === 'bgCity') return bakeCityBackground(scene, key);
  const map = PIXEL_SPRITES[placeholder];
  if (!map) throw new Error(`No placeholder named ${placeholder}`);
  bakePixelSprite(scene, key, map);
}
