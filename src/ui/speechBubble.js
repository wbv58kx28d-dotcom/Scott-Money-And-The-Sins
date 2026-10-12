// Bars as a comic speech bubble over the speaker (CLAUDE.md §9).
//
// Words punch in one at a time, roughly on the beat. Each letter is its own
// image (see glyphs.js) and jitters on its own: plain letters only twitch now
// and then, rhyme letters shake constantly. Rhymes land bigger and bold, with
// a thump, a small screen shake, and a jolt of the bubble. Same tap rules as the dialog box:
// a tap while words are landing shows them all, the next tap closes the bubble.
// Like the timing bar, it ignores taps for a moment after it opens.

import { FONTS, LAYOUT } from '../config.js';
import { parseCouplet } from '../systems/bars.js';
import { Audio } from '../systems/audio.js';
import { rng } from '../systems/rng.js';
import { label } from './text.js';
import { glyph, prewarmGlyphs } from './glyphs.js';

const INK = 0x1a1030;
const PAPER = 0xfbf7ff;
const STYLE = {
  word: { size: 34, color: '#1a1030' },
  rhyme: { size: 42, color: '#e0245e', fontStyle: 'bold', stroke: '#1a1030', strokeThickness: 2 },
  direction: { size: 30, color: '#6b5a8e', fontStyle: 'italic' },
};
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
const LINE_GAP = 10;
const PAD_X = 24;
const PAD_Y = 26;

/**
 * Spit a couplet in a bubble. Resolves when the player taps past it.
 * @param {Phaser.Scene} scene
 * @param {import('./tapBus.js').TapBus} bus
 * @param {{ couplet: string[], speaker: string, character: object, side: 'left'|'right', tagColor?: string, instant?: boolean }} o
 */
export function spitBars(scene, bus, { couplet, speaker, character, side, tagColor = '#ffd166', instant = false }) {
  const cfg = LAYOUT.bubble;
  const { container: body, sprite } = character;
  const headY = Math.round(body.y - sprite.displayHeight);

  // Where the tail points: $cott's head (right side), or beside the enemy's face (left).
  const tip = side === 'right'
    ? { x: Math.round(body.x), y: headY - 6 }
    : { x: Math.round(body.x + sprite.displayWidth / 2 - 10), y: Math.round(headY + sprite.displayHeight * 0.22) };
  const maxW = side === 'right' ? cfg.maxW : Math.min(cfg.maxW, cfg.right - (tip.x + cfg.gap));

  // Lay the words out in rows, relative to the bubble's top-left. Each word's
  // node is centered on the word, so its pop-in scales from the middle.
  const words = [];
  const lines = parseCouplet(couplet);
  const space = Math.round(STYLE.word.size * 0.3);
  let x = PAD_X;
  let y = PAD_Y + ROW_H / 2;
  let widest = 0;
  lines.forEach((line, li) => {
    if (li > 0) {
      x = PAD_X;
      y += ROW_H + LINE_GAP;
    }
    for (const w of line.words) {
      const styleId = line.direction ? 'direction' : w.rhyme ? 'rhyme' : 'word';
      const word = buildWord(scene, w.text, styleId);
      if (x > PAD_X && x + word.width > maxW - PAD_X) {
        x = PAD_X;
        y += ROW_H;
      }
      Object.assign(word, { bx: Math.round(x + word.width / 2), by: y, rhyme: w.rhyme, direction: line.direction, energy: 0, shown: false });
      words.push(word);
      x += word.width + space;
      widest = Math.max(widest, x - space);
    }
  });
  const w = Math.min(maxW, Math.round(widest + PAD_X));
  const h = Math.round(y + ROW_H / 2 + PAD_Y);

  // Place the bubble: up and to the right of the speaker, inside the stage area.
  const left = side === 'right' ? cfg.right - w : tip.x + cfg.gap;
  // $cott's sits above his head; the enemy's starts at the top of the stage,
  // so a long couplet grows down beside them instead of over $cott.
  const top = side === 'right' ? Math.max(cfg.minTop, tip.y - cfg.gap - h) : cfg.minTop;

  // Everything lives in a container at the tail tip, so the pop-in grows from the speaker.
  const layer = scene.add.container(tip.x, tip.y).setDepth(35);
  const ox = left - tip.x;
  const oy = top - tip.y;
  const g = scene.add.graphics();
  drawBubble(g, ox, oy, w, h, side);
  layer.add(g);
  const tag = label(scene, ox + 14, oy - 4, speaker, 14, {
    color: '#1a1030',
    backgroundColor: tagColor,
    padding: { x: 8, y: 5 },
    strokeThickness: 0,
  }).setOrigin(0, 1);
  layer.add(tag);
  for (const word of words) {
    word.node.setPosition(word.bx + ox, word.by + oy).setAlpha(0);
    layer.add(word.node);
  }
  const arrow = scene.add.triangle(ox + w - 22, oy + h - 16, 0, 0, 14, 0, 7, 9, INK).setVisible(false);
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
function buildWord(scene, text, styleId) {
  const node = scene.add.container(0, 0);
  if (styleId === 'direction') {
    const t = scene.add.text(0, 0, text, textStyle(STYLE.direction)).setOrigin(0.5);
    node.add(t);
    return { node, width: t.width, letters: [] };
  }
  const style = textStyle(STYLE[styleId]);
  const glyphs = [...text].map((ch) => glyph(scene, styleId, style, ch));
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
  prewarmGlyphs(scene, 'word', textStyle(STYLE.word));
  prewarmGlyphs(scene, 'rhyme', textStyle(STYLE.rhyme));
}

/** White bubble with a dark outline, a hard shadow, and a tail to the tip at (0, 0). */
function drawBubble(g, x, y, w, h, side) {
  // Tail base on the bottom edge (pointing down at $cott) or the left edge
  // (pointing at the enemy). "Out" is the outline, "in" the paper inside it.
  let a, b, aOut, bOut, aIn, bIn;
  if (side === 'right') {
    const ax = Math.min(Math.max(10, x + 16), x + w - 44);
    a = { x: ax, y: y + h };
    b = { x: ax + 26, y: y + h };
    [aOut, bOut] = [{ x: a.x - 4, y: a.y }, { x: b.x + 4, y: b.y }];
    [aIn, bIn] = [{ x: a.x, y: a.y - 5 }, { x: b.x, y: b.y - 5 }];
  } else {
    // Base level with the tip, kept inside the bubble's left edge.
    const ay = Math.min(Math.max(-26, y + 16), y + h - 50);
    a = { x, y: ay };
    b = { x, y: ay + 30 };
    [aOut, bOut] = [{ x: a.x, y: a.y - 4 }, { x: b.x, y: b.y + 4 }];
    [aIn, bIn] = [{ x: a.x + 5, y: a.y }, { x: b.x + 5, y: b.y }];
  }
  // The paper tip stops short of the real tip so the outline wraps around it.
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(mx, my) || 1;
  const tipIn = { x: (mx / len) * 7, y: (my / len) * 7 };

  g.fillStyle(0x000000, 0.45);
  g.fillRect(x + 6, y + 6, w, h);
  g.fillStyle(INK, 1);
  g.fillTriangle(aOut.x, aOut.y, bOut.x, bOut.y, 0, 0);
  g.fillRect(x - 4, y - 4, w + 8, h + 8);
  g.fillStyle(PAPER, 1);
  g.fillRect(x, y, w, h);
  g.fillTriangle(aIn.x, aIn.y, bIn.x, bIn.y, tipIn.x, tipIn.y);
  // Notched corners, like the rest of the UI.
  g.fillStyle(INK, 1);
  for (const [cx, cy] of [[x - 4, y - 4], [x + w, y - 4], [x - 4, y + h], [x + w, y + h]]) g.fillRect(cx, cy, 4, 4);
}
