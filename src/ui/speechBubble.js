// Bars as lyric ribbons over the speaker (CLAUDE.md §9).
//
// Each line of the couplet sits on its own dark slanted strip, with an accent
// edge in the speaker's color, like lyric captions in a music video. The
// first ribbon pops in from the speaker; each later ribbon slides in once the
// line before it has fully landed.
//
// Words punch in one at a time, roughly on the beat. Each letter is its own
// image (see glyphs.js) and jitters on its own: plain letters only twitch now
// and then, rhyme letters shake constantly. Rhymes land bigger and bold, with
// a thump, a small screen shake, and a jolt of the ribbons. Same tap rules as
// the dialog box: a tap while words are landing shows them all, the next tap
// closes the bars. Like the timing bar, it ignores taps for a moment after it opens.

import { FONTS, GAME_H, LAYOUT } from '../config.js';
import { parseCouplet } from '../systems/bars.js';
import { Audio } from '../systems/audio.js';
import { rng } from '../systems/rng.js';
import { label } from './text.js';
import { glyph, prewarmGlyphs } from './glyphs.js';

const RIBBON = {
  fill: 0x0d0820,
  alpha: 0.92,
  skew: 12, // how far the top edge leans right of the bottom edge
  accentW: 6,
  shadow: 5,
  maxW: 440,
  stagger: 22, // each line's ribbon sits this much further right
  padX: 16,
  padY: 4,
  lineGap: 8,
  rowH: 40,
};
const SLIDE = { dx: 90, ms: 220 }; // later ribbons slide in from the right

const TEXT = {
  word: { size: 34, color: '#f5f1e8' },
  rhyme: { size: 42, color: '#ffd166', fontStyle: 'bold', stroke: '#1a1030', strokeThickness: 3 },
  direction: { size: 30, color: '#b9acdf', fontStyle: 'italic' },
};
const WORD_MS = 95; // one word per beat-ish step
const RHYME_WINDUP_MS = 70; // a tiny pause before a rhyme lands
const LINE_PAUSE_MS = 200; // the next ribbon slides in during this pause
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
// If a couplet is too tall for the room it has, the text steps down in size.
const FIT_STEPS = [1, 0.9, 0.8, 0.7];

/**
 * Spit a couplet. Resolves when the player taps past it.
 * @param {Phaser.Scene} scene
 * @param {import('./tapBus.js').TapBus} bus
 * @param {{ couplet: string[], speaker: string, character: object, side: 'left'|'right', tagColor?: string, instant?: boolean, maxBottom?: number }} o
 *   maxBottom: the lowest y the ribbons may reach (e.g. just above $cott's head for an enemy's bars)
 */
export function spitBars(scene, bus, { couplet, speaker, character, side, tagColor = '#ffd166', instant = false, maxBottom = Infinity }) {
  const cfg = LAYOUT.bubble;
  const { container: body, sprite } = character;
  const headY = Math.round(body.y - sprite.displayHeight);

  // Where the tail points: $cott's head (right side), or beside the enemy's face (left).
  const tip = side === 'right'
    ? { x: Math.round(body.x), y: headY - 6 }
    : { x: Math.round(body.x + sprite.displayWidth / 2 - 10), y: Math.round(headY + sprite.displayHeight * 0.22) };
  const maxW = side === 'right' ? RIBBON.maxW : Math.min(RIBBON.maxW, cfg.right - (tip.x + cfg.gap));

  // $cott's bars sit above his head; an enemy's start at the top of the stage
  // and grow down beside them. Either way, shrink the text to fit.
  const lines = parseCouplet(couplet);
  const room = side === 'right' ? tip.y - cfg.gap - cfg.minTop : Math.min(maxBottom, GAME_H) - cfg.minTop;
  let layout;
  for (const fit of FIT_STEPS) {
    layout?.words.forEach((word) => word.node.destroy());
    layout = layoutWords(scene, lines, maxW, fit);
    if (layout.h <= room) break;
  }
  const { words, blocks, w, h } = layout;

  const left = side === 'right' ? cfg.right - w : tip.x + cfg.gap;
  const top = side === 'right' ? Math.max(cfg.minTop, tip.y - cfg.gap - h) : cfg.minTop;

  // Everything lives in a container at the tail tip, so the pop-in grows from
  // the speaker. Each ribbon is its own container so it can slide in.
  const layer = scene.add.container(tip.x, tip.y).setDepth(35);
  const ox = left - tip.x;
  const oy = top - tip.y;
  const accent = Phaser.Display.Color.HexStringToColor(tagColor).color;
  const nearIndex = side === 'right' ? blocks.length - 1 : 0;
  blocks.forEach((b, i) => {
    const rect = { x: ox + b.x, y: oy + b.y, w: b.w, h: b.h };
    const g = scene.add.graphics();
    if (i === nearIndex) drawTail(g, rect, side);
    drawRibbon(g, rect, accent);
    b.node = scene.add.container(0, 0, [g]);
    for (const word of b.words) {
      word.node.setPosition(word.bx + ox, word.by + oy).setAlpha(0);
      b.node.add(word.node);
    }
    if (i > 0) b.node.setAlpha(0).setX(SLIDE.dx);
    layer.add(b.node);
  });
  const tag = label(scene, ox + blocks[0].x + RIBBON.skew + RIBBON.accentW + 6, oy + 6, speaker, 12, {
    color: '#1a1030',
    backgroundColor: tagColor,
    padding: { x: 6, y: 4 },
    strokeThickness: 0,
  }).setOrigin(0, 1);
  blocks[0].node.add(tag);
  const last = blocks[blocks.length - 1];
  const arrow = scene.add.triangle(ox + last.x + last.w - 14, oy + last.y + last.h - 10, 0, 0, 14, 0, 7, 9, 0xffffff).setVisible(false);
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

  const slideIn = (block, quiet = false) => {
    scene.tweens.killTweensOf(block.node);
    if (quiet) {
      block.node.setX(0).setAlpha(1);
      return;
    }
    scene.tweens.add({ targets: block.node, x: 0, alpha: 1, duration: SLIDE.ms, ease: 'Back.easeOut' });
  };

  // Schedule each ribbon and word. A new line's ribbon slides in during the
  // pause after the previous line, then its words land; rhymes get a wind-up.
  const timers = [];
  let at = 160;
  blocks.forEach((block, i) => {
    if (i > 0) {
      timers.push(scene.time.delayedCall(at, () => slideIn(block)));
      at += Math.max(LINE_PAUSE_MS, SLIDE.ms);
    }
    for (const word of block.words) {
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
      for (const block of blocks.slice(1)) slideIn(block, true);
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
 * Lay the words out, one ribbon block per line, relative to the bars' top-left,
 * with text at `fit` times its normal size. Each word's node is centered on
 * the word, so its pop-in scales from the middle.
 */
function layoutWords(scene, lines, maxW, fit) {
  const { padX, padY, lineGap, stagger } = RIBBON;
  const rowH = Math.round(RIBBON.rowH * fit);
  const space = Math.round(TEXT.word.size * fit * 0.3);
  const words = [];
  const blocks = [];
  let y = 0;
  lines.forEach((line, li) => {
    const block = { x: li * stagger, y, w: 0, h: 0, words: [] };
    blocks.push(block);
    const width = maxW - block.x;
    let x = padX;
    y += padY + rowH / 2;
    for (const w of line.words) {
      const kind = line.direction ? 'direction' : w.rhyme ? 'rhyme' : 'word';
      const word = buildWord(scene, w.text, kind, fit);
      if (x > padX && x + word.width > width - padX) {
        x = padX;
        y += rowH;
      }
      Object.assign(word, { bx: block.x + Math.round(x + word.width / 2), by: y, rhyme: w.rhyme, direction: line.direction, energy: 0, shown: false });
      words.push(word);
      block.words.push(word);
      x += word.width + space;
      block.w = Math.max(block.w, Math.min(width, Math.round(x - space + padX)));
    }
    block.h = Math.round(y + rowH / 2 + padY - block.y);
    y = block.y + block.h + lineGap;
  });
  const w = Math.max(...blocks.map((b) => b.x + b.w)) + RIBBON.skew;
  return { words, blocks, w, h: Math.round(y - lineGap) };
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
function buildWord(scene, text, kind, fit = 1) {
  const node = scene.add.container(0, 0);
  const st = { ...TEXT[kind], size: Math.round(TEXT[kind].size * fit) };
  if (kind === 'direction') {
    const t = scene.add.text(0, 0, text, textStyle(st)).setOrigin(0.5);
    node.add(t);
    return { node, width: t.width, letters: [] };
  }
  const style = textStyle(st);
  const glyphs = [...text].map((ch) => glyph(scene, `ribbon:${kind}@${st.size}`, style, ch));
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

/** Render the bars' letters ahead of time (call once fonts are loaded). */
export function prewarmBubbleGlyphs(scene) {
  for (const kind of ['word', 'rhyme']) prewarmGlyphs(scene, `ribbon:${kind}@${TEXT[kind].size}`, textStyle(TEXT[kind]));
}

/** A dark slanted strip with a hard shadow and an accent edge on the left. */
function drawRibbon(g, { x, y, w, h }, accent) {
  const { skew, shadow, accentW } = RIBBON;
  const quad = (dx, dy, color, alpha) => {
    g.fillStyle(color, alpha);
    g.fillPoints([
      { x: x + skew + dx, y: y + dy },
      { x: x + w + skew + dx, y: y + dy },
      { x: x + w + dx, y: y + h + dy },
      { x: x + dx, y: y + h + dy },
    ], true);
  };
  quad(shadow, shadow, 0x000000, 0.4);
  quad(0, 0, RIBBON.fill, RIBBON.alpha);
  g.fillStyle(accent, 1).fillPoints([
    { x: x + skew, y }, { x: x + skew + accentW, y }, { x: x + accentW, y: y + h }, { x, y: y + h },
  ], true);
}

/**
 * A pointer from the ribbon nearest the speaker to the tip at (0, 0): from its
 * bottom edge down to $cott, or from its slanted left edge over to an enemy.
 */
function drawTail(g, { x, y, w, h }, side) {
  const { skew } = RIBBON;
  g.fillStyle(RIBBON.fill, RIBBON.alpha);
  if (side === 'right') {
    const ax = Math.min(Math.max(10, x + 16), x + w - 44);
    g.fillTriangle(ax, y + h, ax + 24, y + h, 0, 0);
    return;
  }
  // Points on the slanted left edge, kept level with the tip where possible.
  const edgeX = (py) => x + skew * (1 - (py - y) / h);
  const ay = Math.min(Math.max(y + 6, -12), y + h - 30);
  g.fillTriangle(edgeX(ay) + 2, ay, edgeX(ay + 24) + 2, ay + 24, 0, 0);
}
