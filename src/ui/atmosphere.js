// A map's atmosphere (CLAUDE.md §6.6): the light and air over the world.
// The look (data/looks.js) grades the whole world with one multiplied color,
// can wash it in haze, and darkens the screen's edges; props bring their own
// shadows on the ground, glows and puffs (`shadow`, `glow`, `puffs` in
// data/assets.js); fireflies or spores drift in view, and mist banks lie low
// over the water.
//
// Everything is procedural and baked on the art's 2 px grid, so it stays
// crisp like the sprites. It works the same on Canvas and WebGL: the grade is
// a multiply at full alpha, glows and motes are additive, and each glow color
// gets its own texture (Canvas can't tint).
//
// Depths: shadows and mist lie on the ground under everything standing; the
// grade, haze and vignette sit over the world; glows and motes over those, so
// light isn't dimmed by the dusk; overhead bubbles and the UI stay on top.

import { GAME_W, GAME_H } from '../config.js';
import { hash } from '../systems/terrain.js';
import { createRng } from '../systems/rng.js';

const PX = 2; // screen px per art pixel
const SHADOW = 0x140a1e;
const even = (v) => Math.max(PX, Math.round(v / PX) * PX);
const hex = (c) => c.toString(16).padStart(6, '0');
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/** A texture drawn once on a canvas, under `key`. */
function bake(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext(), w, h);
  tex.refresh();
  return key;
}

/** Fill art pixels (PX × PX) of a w × h canvas wherever `alpha(ax, ay)` > 0, in `color`. */
function pixels(ctx, w, h, color, alpha) {
  for (let ay = 0; ay < h / PX; ay++) {
    for (let ax = 0; ax < w / PX; ax++) {
      const a = alpha(ax, ay);
      if (a <= 0) continue;
      ctx.fillStyle = rgba(color, Math.min(1, a));
      ctx.fillRect(ax * PX, ay * PX, PX, PX);
    }
  }
}

/** A solid pixel ellipse, w px wide, for a shadow on the ground. */
function shadowTexture(scene, w) {
  w = even(w);
  const h = even(Math.max(6, w * 0.34));
  return bake(scene, `fx_shadow_${w}`, w, h, (ctx) => {
    const rx = w / PX / 2;
    const ry = h / PX / 2;
    pixels(ctx, w, h, SHADOW, (ax, ay) => (((ax + 0.5 - rx) / rx) ** 2 + ((ay + 0.5 - ry) / ry) ** 2 <= 1 ? 1 : 0));
  });
}

/** A round glow r px across its radius, its falloff in stepped rings like pixel art. */
function glowTexture(scene, r, color) {
  r = even(r);
  return bake(scene, `fx_glow_${r}_${hex(color)}`, r * 2, r * 2, (ctx, w, h) => {
    const c = r / PX;
    pixels(ctx, w, h, color, (ax, ay) => {
      const d = Math.hypot(ax + 0.5 - c, ay + 0.5 - c) / c;
      if (d >= 1) return 0;
      return Math.floor((1 - d) ** 2 * 9) / 9 * 0.7;
    });
  });
}

/** A speck: a bright 2×2 art-pixel core with a dimmer cross around it. */
function moteTexture(scene, color) {
  return bake(scene, `fx_mote_${hex(color)}`, PX * 4, PX * 4, (ctx, w, h) => {
    const mid = (v) => v === 1 || v === 2;
    pixels(ctx, w, h, color, (ax, ay) => (mid(ax) && mid(ay) ? 1 : mid(ax) || mid(ay) ? 0.3 : 0));
  });
}

/** A soft blob of steam or mist, w × h px, its edge in stepped rings. */
function blobTexture(scene, w, h, color) {
  return bake(scene, `fx_blob_${w}x${h}_${hex(color)}`, w, h, (ctx) => {
    const rx = w / PX / 2;
    const ry = h / PX / 2;
    pixels(ctx, w, h, color, (ax, ay) => {
      const d = Math.hypot((ax + 0.5 - rx) / rx, (ay + 0.5 - ry) / ry);
      return d >= 1 ? 0 : Math.ceil((1 - d) * 4) / 4;
    });
  });
}

function vignetteTexture(scene, color, alpha) {
  return bake(scene, `fx_vignette_${hex(color)}_${alpha}`, GAME_W, GAME_H, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, alpha));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

const PUFFS = {
  steam: { color: 0xf4eaff, w: 24, h: 16, rise: 70, ms: 1800, alpha: 0.35, add: false },
  ember: { color: 0xffb040, w: PX * 3, h: PX * 3, rise: 50, ms: 900, alpha: 1, add: true },
};

export class Atmosphere {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} look  data/looks.js
   * @param {object} opts  { ground: the ground's depth, over: the depth just over the world, terrain }
   */
  constructor(scene, look, { ground, over, terrain }) {
    this.scene = scene;
    this.look = look;
    this.ground = ground;
    this.over = over;
    this.terrain = terrain;
    this.shadows = []; // { obj, sprite } following a character
    this.attached = []; // a prop's shadows and glows: { obj, base, flicker, pulse, phase, owner }
    this.puffers = []; // { x, y, spec, owner, next }
    this.motes = [];
    this.mists = [];
    this.rand = createRng(11).random; // its own stream, so the air never shifts gameplay rolls
    this.buildOverlays();
    this.buildMist();
  }

  // ---- What's on the map ---------------------------------------------------------

  /** A prop's shadow, glows and puffs, as its entry in PROP_IMAGES says. `img` is the prop's image. */
  addProp(img, def) {
    if (!def) return;
    const { x, y } = img;
    if (def.shadow && this.look.shadows) {
      const s = typeof def.shadow === 'number' ? { w: def.shadow } : def.shadow;
      const obj = this.scene.add.image(Math.round(x + (s.x ?? 0)), Math.round(y + (s.y ?? -2)), shadowTexture(this.scene, s.w))
        .setDepth(this.ground + 1).setAlpha(this.look.shadows);
      this.attached.push({ obj, base: this.look.shadows, owner: img });
    }
    const lights = this.look.lights ?? 0;
    for (const g of (lights ? def.glow ?? [] : [])) {
      const obj = this.scene.add.image(Math.round(x + g.x), Math.round(y + g.y), glowTexture(this.scene, g.r, g.color))
        .setDepth(this.over + 2).setBlendMode(Phaser.BlendModes.ADD);
      const base = Math.min(1, lights * (g.alpha ?? 1));
      obj.setAlpha(base);
      this.attached.push({ obj, base, flicker: g.flicker, pulse: g.pulse, phase: this.rand() * 100, owner: img });
    }
    if (def.puffs) {
      for (const p of [].concat(def.puffs)) this.puffers.push({ x: x + p.x, y: y + p.y, p, spec: PUFFS[p.kind], owner: img, next: this.rand() * p.every });
    }
  }

  /** A shadow under a character that walks: it follows the sprite's feet. */
  follow(sprite, w = 44) {
    if (!this.look.shadows) return;
    const obj = this.scene.add.image(sprite.x, sprite.y - 2, shadowTexture(this.scene, w)).setDepth(this.ground + 1).setAlpha(this.look.shadows);
    this.shadows.push({ obj, sprite });
  }

  /** Stop following a sprite (and drop its shadow). */
  unfollow(sprite) {
    this.shadows = this.shadows.filter((s) => {
      if (s.sprite !== sprite) return true;
      s.obj.destroy();
      return false;
    });
  }

  // ---- Over the world ---------------------------------------------------------------

  buildOverlays() {
    const { scene, look, over } = this;
    const pin = (o) => o.setScrollFactor(0).setOrigin(0).setDepth(over);
    if (look.grade) pin(scene.add.rectangle(0, 0, GAME_W, GAME_H, look.grade)).setBlendMode(Phaser.BlendModes.MULTIPLY);
    if (look.haze) pin(scene.add.rectangle(0, 0, GAME_W, GAME_H, look.haze.color, look.haze.alpha));
    if (look.vignette) pin(scene.add.image(0, 0, vignetteTexture(scene, look.vignette.color, look.vignette.alpha))).setDepth(over + 1);
    const m = look.motes;
    if (m) {
      for (let k = 0; k < m.count; k++) {
        const color = m.colors[k % m.colors.length];
        const obj = scene.add.image(0, 0, moteTexture(scene, color)).setDepth(over + 3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.motes.push({ obj, x: 0, y: 0, phase: this.rand() * 1000, speed: 0.6 + this.rand() * 0.8, life: 0, placed: false });
      }
    }
  }

  /** Banks of mist over solid water cells (`mist.on`, default 'w'). */
  buildMist() {
    const m = this.look.mist;
    if (!m || !this.terrain) return;
    const { cols, rows, cell } = this.terrain;
    const solid = (m.on ?? 'w').repeat(4);
    const tex = blobTexture(this.scene, 192, 56, m.color);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (this.terrain.key(i, j) !== solid || hash(i, j, 60) >= m.density) continue;
        const x = i * cell + cell / 2;
        const y = j * cell + cell / 2;
        const obj = this.scene.add.image(x, y, tex).setDepth(this.ground + 2).setAlpha(m.alpha);
        this.mists.push({ obj, x, y, phase: hash(i, j, 61) * 1000 });
      }
    }
  }

  // ---- Every frame -------------------------------------------------------------------

  update(time, delta) {
    for (const s of this.shadows) s.obj.setPosition(s.sprite.x, s.sprite.y - 2).setVisible(s.sprite.visible);
    for (const g of this.attached) {
      const shown = g.owner.visible && g.owner.alpha > 0.5;
      g.obj.setVisible(shown);
      if (!shown) continue;
      if (g.flicker) {
        const t = time / 1000 + g.phase;
        g.obj.setAlpha(g.base * (0.8 + 0.12 * Math.sin(t * 9.1) + 0.08 * Math.sin(t * 23.7)));
      } else if (g.pulse) {
        g.obj.setAlpha(g.base * (0.75 + 0.25 * Math.sin(time / 700 + g.phase)));
      }
    }
    const view = this.scene.cameras.main.worldView;
    for (const m of this.mists) {
      const t = time / 1000 + m.phase;
      m.obj.setPosition(even(m.x + Math.sin(t * 0.15) * 36), even(m.y + Math.sin(t * 0.11) * 8));
    }
    this.updateMotes(time, delta, view);
    this.updatePuffs(delta, view);
  }

  updateMotes(time, delta, view) {
    const m = this.look.motes;
    if (!m) return;
    const margin = 80;
    for (const mote of this.motes) {
      mote.life -= delta;
      const out = mote.x < view.x - margin || mote.x > view.right + margin || mote.y < view.y - margin || mote.y > view.bottom + margin;
      if (!mote.placed || out || mote.life <= 0) {
        mote.x = view.x + this.rand() * view.width;
        mote.y = view.y + this.rand() * view.height;
        mote.life = 4000 + this.rand() * 6000;
        mote.age = 0;
        mote.placed = true;
      }
      mote.age += delta;
      const t = time / 1000 * mote.speed + mote.phase;
      let alpha;
      if (m.kind === 'spore') {
        // Spores rise and sway, fading in and out over their life.
        mote.y -= delta * 0.012 * mote.speed;
        mote.x += Math.sin(t * 1.3) * delta * 0.01;
        alpha = Math.min(1, mote.age / 800, mote.life / 800) * 0.8;
      } else {
        // Fireflies wander in loops and blink.
        mote.x += Math.sin(t * 0.9) * delta * 0.02;
        mote.y += Math.cos(t * 0.7) * delta * 0.014;
        alpha = Math.max(0, Math.sin(t * 2.2)) * Math.min(1, mote.age / 600, mote.life / 600);
      }
      mote.obj.setPosition(even(mote.x), even(mote.y)).setAlpha(alpha);
    }
  }

  updatePuffs(delta, view) {
    const margin = 200;
    for (const pf of this.puffers) {
      pf.next -= delta;
      if (pf.next > 0) continue;
      pf.next = pf.p.every * (0.6 + this.rand() * 0.8);
      if (!pf.owner.visible || pf.x < view.x - margin || pf.x > view.right + margin || pf.y < view.y - margin || pf.y > view.bottom + margin) continue;
      const s = pf.spec;
      const x = even(pf.x + (this.rand() - 0.5) * (pf.p.spread ?? 8));
      const obj = this.scene.add.image(x, even(pf.y), s.add ? moteTexture(this.scene, s.color) : blobTexture(this.scene, s.w, s.h, s.color))
        .setDepth(this.over + (s.add ? 3 : -1)).setAlpha(0);
      if (s.add) obj.setBlendMode(Phaser.BlendModes.ADD);
      const drift = (this.rand() - 0.5) * 30;
      this.scene.tweens.add({
        targets: obj,
        y: obj.y - s.rise * (0.7 + this.rand() * 0.6),
        x: obj.x + drift,
        duration: s.ms,
        onUpdate: (tw) => obj.setAlpha(s.alpha * Math.sin(Math.PI * tw.progress)).setPosition(even(obj.x), even(obj.y)),
        onComplete: () => obj.destroy(),
      });
    }
  }
}
