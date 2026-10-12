// Bars as a comic speech bubble over the speaker (CLAUDE.md §9).
//
// Words punch in one at a time, roughly on the beat. Each letter is its own
// image (see glyphs.js) and jitters on its own: plain letters only twitch now
// and then, rhyme letters shake constantly. Rhymes land bigger and bold, with
// a thump, a small screen shake, and a jolt of the bubble. Same tap rules as the dialog box:
// a tap while words are landing shows them all, the next tap closes the bubble.
// Like the timing bar, it ignores taps for a moment after it opens.

import { FONTS, GAME_H, LAYOUT } from '../config.js';
import { DEBUG } from '../systems/debug.js';
import { parseCouplet } from '../systems/bars.js';
import { Audio } from '../systems/audio.js';
import { rng } from '../systems/rng.js';
import { label } from './text.js';
import { glyph, prewarmGlyphs } from './glyphs.js';

const INK = 0x1a1030;
const PAPER = 0xfbf7ff;

// Bubble styles. `LAYOUT.bubble.style` picks one; debug `&bubble=` overrides.
//   classic  white comic box, name tag above it
//   compact  tighter, rounded white box, name tag set into the border
//   ribbon   no box: each line on its own dark slanted strip, like lyric captions
//   thread   each line its own chat bubble: $cott blue on the right, enemies grey on the left
// perLine styles give every line of the couplet its own block.
const VARIANTS = {
  classic: { padX: 24, padY: 26, lineGap: 10, maxW: 384, rowScale: 1, perLine: false, tagInside: false },
  compact: { padX: 14, padY: 12, lineGap: 4, maxW: 400, rowScale: 0.92, perLine: false, tagInside: true },
  ribbon: { padX: 16, padY: 4, lineGap: 8, maxW: 440, rowScale: 0.95, perLine: true, tagInside: true, stagger: 22 },
  thread: { padX: 16, padY: 6, lineGap: 6, maxW: 420, rowScale: 0.95, perLine: true, tagInside: true },
};

// Text colors per palette. Sizes are shared.
const SIZES = { word: 34, rhyme: 42, direction: 30 };
const PALETTES = {
  paper: {
    word: { color: '#1a1030' },
    rhyme: { color: '#e0245e', fontStyle: 'bold', stroke: '#1a1030', strokeThickness: 2 },
    direction: { color: '#6b5a8e', fontStyle: 'italic' },
  },
  dark: {
    word: { color: '#f5f1e8' },
    rhyme: { color: '#ffd166', fontStyle: 'bold', stroke: '#1a1030', strokeThickness: 3 },
    direction: { color: '#b9acdf', fontStyle: 'italic' },
  },
  blue: {
    word: { color: '#ffffff' },
    rhyme: { color: '#ffd166', fontStyle: 'bold', stroke: '#0b2f73', strokeThickness: 3 },
    direction: { color: '#d6e6ff', fontStyle: 'italic' },
  },
};
const paletteFor = (style, side) =>
  style === 'ribbon' ? 'dark' : style === 'thread' && side === 'right' ? 'blue' : 'paper';
const WORD_MS = 95; // one word per beat-ish step
const RHYME_WINDUP_MS = 70; // a tiny pause before a rhyme lands
const LINE_PAUSE_MS = 200;
const JITTER_MS = 45;
// Letter jitter. Every tick, a letter shifts up to `amp` px (rounded) with
// probability `chance`, otherwise it sits on its spot. Landing adds `land`
// energy on top of amp, which fades by `decay` per tick.
const JITTER = {
  plain: { amp: 0.8, chance: 0.12, land: 1.2, maxAngle: 0 },
  rhyme: { amp: 1.6, chance: 1, land: 5, maxAngle: 2.5 },
  decay: 0.7,
};
const IGNORE_TAPS_MS = 200; // a tap meant for something else can't skip the bars
const ROW_H = 42;
// If a couplet is too tall for the room it has, the text steps down in size.
const FIT_STEPS = [1, 0.9, 0.8, 0.7];

/**
 * Spit a couplet in a bubble. Resolves when the player taps past it.
 * @param {Phaser.Scene} scene
 * @param {import('./tapBus.js').TapBus} bus
 * @param {{ couplet: string[], speaker: string, character: object, side: 'left'|'right', tagColor?: string, instant?: boolean, maxBottom?: number }} o
 *   maxBottom: the lowest y the bubble may reach (e.g. just above $cott's head for an enemy's bars)
 */
export function spitBars(scene, bus, { couplet, speaker, character, side, tagColor = '#ffd166', instant = false, maxBottom = Infinity }) {
  const cfg = LAYOUT.bubble;
  const style = VARIANTS[DEBUG.bubble] ? DEBUG.bubble : cfg.style;
  const v = VARIANTS[style];
  const palette = paletteFor(style, side);
  const { container: body, sprite } = character;
  const headY = Math.round(body.y - sprite.displayHeight);

  // Where the tail points: $cott's head (right side), or beside the enemy's face (left).
  const tip = side === 'right'
    ? { x: Math.round(body.x), y: headY - 6 }
    : { x: Math.round(body.x + sprite.displayWidth / 2 - 10), y: Math.round(headY + sprite.displayHeight * 0.22) };
  const maxW = side === 'right' ? v.maxW : Math.min(v.maxW, cfg.right - (tip.x + cfg.gap));

  // $cott's bubble sits above his head; the enemy's starts at the top of the
  // stage and grows down beside them. Either way, shrink the text to fit.
  const lines = parseCouplet(couplet);
  const room = side === 'right' ? tip.y - cfg.gap - cfg.minTop : Math.min(maxBottom, GAME_H) - cfg.minTop;
  let layout;
  for (const fit of FIT_STEPS) {
    layout?.words.forEach((word) => word.node.destroy());
    layout = layoutWords(scene, lines, maxW, fit, v, palette, side);
    if (layout.h <= room) break;
  }
  const { words, w, h, blocks } = layout;

  // Place the bubble: up and to the right of the speaker, inside the stage area.
  const left = side === 'right' ? cfg.right - w : tip.x + cfg.gap;
  const top = side === 'right' ? Math.max(cfg.minTop, tip.y - cfg.gap - h) : cfg.minTop;

  // Everything lives in a container at the tail tip, so the pop-in grows from the speaker.
  const layer = scene.add.container(tip.x, tip.y).setDepth(35);
  const ox = left - tip.x;
  const oy = top - tip.y;
  const g = scene.add.graphics();
  DRAW[style](g, { ox, oy, w, h, blocks, side, tagColor });
  layer.add(g);
  // The name tag sits above the box, or is set into its top edge to save space.
  const tag = label(scene, ox + 14, oy + (v.tagInside ? 6 : -4), speaker, v.tagInside ? 12 : 14, {
    color: '#1a1030',
    backgroundColor: tagColor,
    padding: { x: 6, y: 4 },
    strokeThickness: 0,
  }).setOrigin(0, 1);
  layer.add(tag);
  for (const word of words) {
    word.node.setPosition(word.bx + ox, word.by + oy).setAlpha(0);
    layer.add(word.node);
  }
  const arrow = scene.add.triangle(ox + w - 18, oy + h - 12, 0, 0, 14, 0, 7, 9, palette === 'paper' ? INK : 0xffffff).setVisible(false);
  layer.add(arrow);
  scene.tweens.add({ targets: arrow, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });

  layer.setScale(0.4).setAlpha(0);
  scene.tweens.add({ targets: layer, scale: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' });

  // Letter jitter, stronger right after a word lands. Stage directions stay still.
  const jitter = scene.time.addEvent({
    delay: JITTER_MS,
    loop: true,
    callback: () => {
      const fx = rng.fx;
      for (const word of words) {
        if (!word.shown || word.direction) continue;
        const j = word.rhyme ? JITTER.rhyme : JITTER.plain;
        const amp = j.amp + word.energy;
        const excited = word.energy > 0.3;
        word.energy = word.energy * JITTER.decay < 0.05 ? 0 : word.energy * JITTER.decay;
        for (const l of word.letters) {
          if (!excited && !fx.chance(j.chance)) {
            l.img.setPosition(l.bx, 0).setAngle(0);
            continue;
          }
          l.img.setPosition(l.bx + Math.round(fx.range(-amp, amp)), Math.round(fx.range(-amp, amp)));
          if (j.maxAngle) l.img.setAngle(fx.range(-j.maxAngle, j.maxAngle));
        }
      }
    },
  });

  const land = (word, quiet = false) => {
    word.shown = true;
    word.node.setAlpha(1);
    if (quiet) return;
    word.energy = (word.rhyme ? JITTER.rhyme : JITTER.plain).land;
    word.node.setScale(word.rhyme ? 1.9 : 1.35);
    scene.tweens.add({ targets: word.node, scale: 1, duration: word.rhyme ? 160 : 90, ease: 'Back.easeOut' });
    if (word.rhyme) {
      Audio.sfx('punch');
      scene.cameras.main.shake(80, 0.004);
      scene.tweens.add({ targets: layer, y: tip.y + 6, duration: 45, yoyo: true, ease: 'Quad.easeOut' });
    }
  };

  // Schedule each word. Rhymes get a short wind-up, and a new line gets a breath.
  const timers = [];
  let at = 160;
  let prevLine = 0;
  let wordIndex = 0;
  lines.forEach((line, li) => {
    for (let k = 0; k < line.words.length; k++, wordIndex++) {
      const word = words[wordIndex];
      if (li !== prevLine) {
        at += LINE_PAUSE_MS;
        prevLine = li;
      }
      if (word.rhyme) at += RHYME_WINDUP_MS;
      timers.push(scene.time.delayedCall(at, () => land(word)));
      at += WORD_MS;
    }
  });

  return new Promise((resolve) => {
    let revealed = false;
    const done = scene.time.delayedCall(at, () => finishReveal());
    function finishReveal() {
      if (revealed) return;
      revealed = true;
      done.remove();
      for (const t of timers) t.remove();
      for (const word of words) if (!word.shown) land(word, true);
      arrow.setVisible(true);
    }
    const opened = scene.time.now;
    const onTap = () => {
      if (scene.time.now - opened < IGNORE_TAPS_MS) return;
      if (!revealed) return finishReveal();
      bus.off('tap', onTap);
      jitter.remove();
      scene.tweens.add({
        targets: layer,
        scale: 0.85,
        alpha: 0,
        duration: 110,
        onComplete: () => {
          layer.destroy();
          resolve();
        },
      });
    };
    bus.on('tap', onTap);
    if (instant) finishReveal();
  });
}

/**
 * Lay the words out in rows, relative to the bubble's top-left, with text at
 * `fit` times its normal size. Each word's node is centered on the word, so
 * its pop-in scales from the middle. Per-line styles get one block per line;
 * otherwise the whole couplet is one block.
 */
function layoutWords(scene, lines, maxW, fit, v, palette, side) {
  const rowH = Math.round(ROW_H * v.rowScale * fit);
  const space = Math.round(SIZES.word * fit * 0.3);
  const words = [];
  const blocks = [];
  let block = null;
  let x = 0;
  let y = 0;
  const openBlock = () => {
    block = { x: 0, y, w: 0, h: 0, words: [] };
    blocks.push(block);
    x = v.padX;
    y += v.padY + rowH / 2;
  };
  const closeBlock = () => {
    block.h = Math.round(y + rowH / 2 + v.padY - block.y);
    y = block.y + block.h;
  };
  openBlock();
  lines.forEach((line, li) => {
    if (li > 0) {
      if (v.perLine) {
        closeBlock();
        y += v.lineGap;
        openBlock();
      } else {
        x = v.padX;
        y += rowH + v.lineGap;
      }
    }
    for (const w of line.words) {
      const kind = line.direction ? 'direction' : w.rhyme ? 'rhyme' : 'word';
      const word = buildWord(scene, w.text, kind, palette, fit);
      if (x > v.padX && x + word.width > maxW - v.padX) {
        x = v.padX;
        y += rowH;
      }
      Object.assign(word, { bx: Math.round(x + word.width / 2), by: y, rhyme: w.rhyme, direction: line.direction, energy: 0, shown: false });
      words.push(word);
      block.words.push(word);
      x += word.width + space;
      block.w = Math.max(block.w, Math.min(maxW, Math.round(x - space + v.padX)));
    }
  });
  closeBlock();

  // Line up the blocks: staggered ribbons; chat bubbles hug the speaker's side.
  let w = 0;
  blocks.forEach((b, i) => {
    if (v.stagger) b.x = i * v.stagger;
    w = Math.max(w, b.x + b.w);
  });
  if (v.perLine && !v.stagger && side === 'right') for (const b of blocks) b.x = w - b.w;
  for (const b of blocks) for (const word of b.words) word.bx += b.x;
  return { words, blocks, w, h: Math.round(y) };
}

const textStyle = (st) => ({
  fontFamily: FONTS.body,
  fontSize: `${st.size}px`,
  color: st.color,
  fontStyle: st.fontStyle ?? '',
  stroke: st.stroke ?? '#000000',
  strokeThickness: st.strokeThickness ?? 0,
});

/**
 * One word as a container centered on the word. Bars words are one Image per
 * letter (so letters can jitter); stage directions are a single italic Text.
 */
function buildWord(scene, text, kind, palette, fit = 1) {
  const node = scene.add.container(0, 0);
  const st = { size: Math.round(SIZES[kind] * fit), ...PALETTES[palette][kind] };
  if (kind === 'direction') {
    const t = scene.add.text(0, 0, text, textStyle(st)).setOrigin(0.5);
    node.add(t);
    return { node, width: t.width, letters: [] };
  }
  const style = textStyle(st);
  const glyphs = [...text].map((ch) => glyph(scene, `${palette}:${kind}@${st.size}`, style, ch));
  const width = Math.round(glyphs.reduce((sum, g) => sum + g.advance, 0));
  let x = -width / 2;
  const letters = glyphs.map((g) => {
    const bx = Math.round(x + g.advance / 2);
    x += g.advance;
    return { img: scene.add.image(bx, 0, g.key), bx };
  });
  node.add(letters.map((l) => l.img));
  return { node, width, letters };
}

/** Render the bubble's letters ahead of time (call once fonts are loaded). */
export function prewarmBubbleGlyphs(scene) {
  const palette = paletteFor(LAYOUT.bubble.style, 'right');
  for (const kind of ['word', 'rhyme']) {
    prewarmGlyphs(scene, `${palette}:${kind}@${SIZES[kind]}`, textStyle({ size: SIZES[kind], ...PALETTES[palette][kind] }));
  }
}

/**
 * A tail from a box's edge to the tip at (0, 0): from the bottom edge when the
 * speaker is below ($cott), from the left edge when they're to the left (enemy).
 * Returns the base points, plus "out"/"in" versions for an outline pass.
 */
function tailFor({ x, y, w, h }, side) {
  let a, b, aOut, bOut, aIn, bIn;
  if (side === 'right') {
    const ax = Math.min(Math.max(10, x + 16), x + w - 44);
    a = { x: ax, y: y + h };
    b = { x: ax + 26, y: y + h };
    [aOut, bOut] = [{ x: a.x - 4, y: a.y }, { x: b.x + 4, y: b.y }];
    [aIn, bIn] = [{ x: a.x, y: a.y - 5 }, { x: b.x, y: b.y - 5 }];
  } else {
    // Base level with the tip, kept inside the box's left edge.
    const ay = Math.min(Math.max(-26, y + 16), y + h - 40);
    a = { x, y: ay };
    b = { x, y: ay + 30 };
    [aOut, bOut] = [{ x: a.x, y: a.y - 4 }, { x: b.x, y: b.y + 4 }];
    [aIn, bIn] = [{ x: a.x + 5, y: a.y }, { x: b.x + 5, y: b.y }];
  }
  // The inner tip stops short of the real tip so the outline wraps around it.
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(mx, my) || 1;
  return { aOut, bOut, aIn, bIn, tipIn: { x: (mx / len) * 7, y: (my / len) * 7 } };
}

/** The block nearest the speaker: the last line for $cott (below), the first for an enemy. */
const nearest = (blocks, ox, oy, side) => {
  const b = side === 'right' ? blocks[blocks.length - 1] : blocks[0];
  return { x: ox + b.x, y: oy + b.y, w: b.w, h: b.h };
};

const DRAW = {
  /** White box with a dark outline, a hard shadow, and notched corners. */
  classic(g, { ox: x, oy: y, w, h, side }) {
    const t = tailFor({ x, y, w, h }, side);
    g.fillStyle(0x000000, 0.45).fillRect(x + 6, y + 6, w, h);
    g.fillStyle(INK, 1).fillTriangle(t.aOut.x, t.aOut.y, t.bOut.x, t.bOut.y, 0, 0);
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle(PAPER, 1).fillRect(x, y, w, h);
    g.fillTriangle(t.aIn.x, t.aIn.y, t.bIn.x, t.bIn.y, t.tipIn.x, t.tipIn.y);
    g.fillStyle(INK, 1);
    for (const [cx, cy] of [[x - 4, y - 4], [x + w, y - 4], [x - 4, y + h], [x + w, y + h]]) g.fillRect(cx, cy, 4, 4);
  },

  /** Tighter white box with rounded corners. */
  compact(g, { ox: x, oy: y, w, h, side }) {
    const t = tailFor({ x, y, w, h }, side);
    const r = 12;
    g.fillStyle(0x000000, 0.45).fillRoundedRect(x + 5, y + 5, w, h, r);
    g.fillStyle(INK, 1).fillTriangle(t.aOut.x, t.aOut.y, t.bOut.x, t.bOut.y, 0, 0);
    g.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, r + 4);
    g.fillStyle(PAPER, 1).fillRoundedRect(x, y, w, h, r);
    g.fillTriangle(t.aIn.x, t.aIn.y, t.bIn.x, t.bIn.y, t.tipIn.x, t.tipIn.y);
  },

  /** A dark slanted strip per line, with an accent edge in the speaker's color. */
  ribbon(g, { ox, oy, blocks, side, tagColor }) {
    const accent = Phaser.Display.Color.HexStringToColor(tagColor).color;
    const skew = 12;
    const near = nearest(blocks, ox, oy, side);
    const t = tailFor(near, side);
    g.fillStyle(0x0d0820, 0.92).fillTriangle(t.aOut.x, t.aOut.y, t.bOut.x, t.bOut.y, 0, 0);
    for (const b of blocks) {
      const x = ox + b.x;
      const y = oy + b.y;
      const quad = (dx, dy, color, alpha) => {
        g.fillStyle(color, alpha);
        g.fillPoints([
          { x: x + skew + dx, y: y + dy },
          { x: x + b.w + skew + dx, y: y + dy },
          { x: x + b.w + dx, y: y + b.h + dy },
          { x: x + dx, y: y + b.h + dy },
        ], true);
      };
      quad(5, 5, 0x000000, 0.4);
      quad(0, 0, 0x0d0820, 0.92);
      g.fillStyle(accent, 1).fillPoints([
        { x: x + skew, y }, { x: x + skew + 6, y }, { x: x + 6, y: y + b.h }, { x, y: y + b.h },
      ], true);
    }
  },

  /** One rounded chat bubble per line: blue for $cott, grey for enemies. */
  thread(g, { ox, oy, blocks, side }) {
    const fill = side === 'right' ? 0x2f7cf6 : 0xe5e5ea;
    const near = nearest(blocks, ox, oy, side);
    const t = tailFor(near, side);
    g.fillStyle(fill, 1).fillTriangle(t.aOut.x, t.aOut.y, t.bOut.x, t.bOut.y, 0, 0);
    for (const b of blocks) {
      const r = Math.min(18, b.h / 2);
      g.fillStyle(0x000000, 0.35).fillRoundedRect(ox + b.x + 4, oy + b.y + 4, b.w, b.h, r);
      g.fillStyle(fill, 1).fillRoundedRect(ox + b.x, oy + b.y, b.w, b.h, r);
    }
  },
};
