// A map's atmosphere (CLAUDE.md §6.6): the light and air over the world.
// Each frame the Region scene hands it the hour and the weather; systems/sky.js
// works out the light (data/looks.js), and this draws it: one color the whole
// world is multiplied by, a low sun's warm light washing in from the top of
// the screen, haze, darkened edges, shadows under everyone and the props that
// need one, props' glows and puffs (`shadow`, `glow`, `puffs` in
// data/assets.js), fireflies and spores drifting in view, mist banks over the
// water, fog drifting over everything, rain, and lightning.
//
// Everything is procedural and baked on the art's 2 px grid, so it stays
// crisp like the sprites. It works the same on Canvas and WebGL: the grade is
// a multiply at full alpha, light is additive, and each glow color gets its
// own texture (Canvas can't tint).
//
// The light map (`lightmap`): instead of one flat grade, the world is
// multiplied by a picture of the light, redrawn each frame at the art's
// resolution: the grade's color everywhere, with a pool of each prop's light
// screened in around it, so the ground and anyone standing near a torch show
// their own colors again. Screened, not added, so pools that overlap brighten
// without washing out to white. The glows stay on top, dimmer, as the bright
// core of each light. It's a render texture: drawn on the GPU under WebGL
// (no picture uploaded each frame), on a canvas under Canvas.
//
// Depths: shadows and mist lie on the ground under everything standing; the
// grade, haze, fog and vignette sit over the world; the sun, glows, motes and
// rain over those, so light isn't dimmed by the dark; overhead bubbles and the
// UI stay on top.

import { GAME_W, GAME_H } from '../config.js';
import { hash } from '../systems/terrain.js';
import { createRng } from '../systems/rng.js';
import { skyAt, easeMix, lerpColor as blendColor } from '../systems/sky.js';

const PX = 2; // screen px per art pixel
const SHADOW = 0x140a1e;
const SUN_RES = 4; // the sun's light is drawn at a quarter of the screen's resolution
const RAIN = { drops: 150, speed: 1300, wind: -260, splashes: 36 };
// The light map: how far a light's pool reaches (× its glow's radius), how much
// whiter than the glow it is, how strong the glows stay over it, how flat the
// pool lies (3/4 view), how far down from the glow toward the prop's feet it
// sits, its falloff's steps, and how much darker the dark gets where no light
// reaches, at full night (the lights carry it now).
const LIGHTMAP = { reach: 2.6, whiten: 0.12, glows: 0.55, squash: 0.72, drop: 0.6, steps: 12, darken: 0.3 };
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

/**
 * A contact shadow under a prop, traced from its own art: wherever its base
 * meets the ground (the lowest painted pixel of each column, if it's within
 * `rise` px of the feet), dark right at the edge and fading `reach` px out.
 * It follows the base's real shape (a box drawn at an angle has a diamond
 * footprint, its sides rising from the front corner), which an ellipse can't.
 * Returns the key and where its top-left sits from the prop's feet.
 */
function contactTexture(scene, key, { rise = 40, reach = 12 } = {}) {
  const src = scene.textures.get(key).getSourceImage();
  const cols = Math.floor(src.width / PX);
  const rows = Math.floor(src.height / PX);
  const up = Math.round(rise / PX);
  const out = Math.round(reach / PX);
  const read = document.createElement('canvas');
  read.width = src.width;
  read.height = src.height;
  const rc = read.getContext('2d');
  rc.drawImage(src, 0, 0);
  const data = rc.getImageData(0, 0, src.width, src.height).data;
  const opaque = (ax, ay) => data[((ay * PX + PX / 2) * src.width + ax * PX + PX / 2) * 4 + 3] > 40;
  // Each column's base, in art rows up from the feet (null: nothing near the ground there).
  const base = Array.from({ length: cols }, (_, ax) => {
    for (let ay = rows - 1; ay >= rows - up; ay--) if (opaque(ax, ay)) return rows - 1 - ay;
    return null;
  });
  const w = (cols + out * 2) * PX;
  const h = (up + out + 1) * PX;
  const tex = bake(scene, `fx_contact_${key}`, w, h, (ctx) => {
    pixels(ctx, w, h, SHADOW, (ax, ay) => {
      const col = ax - out;
      const height = up - ay; // art rows above the feet (negative below them)
      let a = 0;
      for (let c = Math.max(0, col - out); c <= Math.min(cols - 1, col + out); c++) {
        if (base[c] === null) continue;
        const below = base[c] - height; // how far under this column's base the pixel is
        if (below < -1) continue;
        const d = Math.hypot((col - c) / out, Math.max(0, below) / (out * 0.6));
        a = Math.max(a, 1 - d);
      }
      return a <= 0 ? 0 : Math.ceil(a * 4) / 4;
    });
  });
  return { key: tex, x: -w / 2, y: -up * PX - PX };
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

/** Fog that tiles both ways: soft white banks, their edges in stepped rings. */
function fogTexture(scene) {
  const size = 512;
  return bake(scene, 'fx_fog', size, size, (ctx, w, h) => {
    const rand = createRng(23).random;
    const banks = Array.from({ length: 14 }, () => ({ x: rand() * w, y: rand() * h, rx: 90 + rand() * 140, ry: 30 + rand() * 50 }));
    pixels(ctx, w, h, 0xffffff, (ax, ay) => {
      let a = 0;
      for (const b of banks) {
        // Distance on a torus, so the edges meet.
        const dx = Math.min(Math.abs(ax * PX - b.x), w - Math.abs(ax * PX - b.x)) / b.rx;
        const dy = Math.min(Math.abs(ay * PX - b.y), h - Math.abs(ay * PX - b.y)) / b.ry;
        a = Math.max(a, 1 - Math.hypot(dx, dy));
      }
      return a <= 0 ? 0 : Math.ceil(a ** 1.5 * 10) / 10;
    });
  });
}

/** A raindrop: a short slanted streak. */
function dropTexture(scene) {
  return bake(scene, 'fx_drop', PX * 4, PX * 10, (ctx, w, h) => {
    pixels(ctx, w, h, 0xdce8ff, (ax, ay) => (ax === Math.floor((9 - ay) * 0.4) ? 0.35 + ay * 0.05 : 0));
  });
}

/** A splash: a little ring on the ground. */
function splashTexture(scene) {
  return bake(scene, 'fx_splash', PX * 8, PX * 4, (ctx, w, h) => {
    pixels(ctx, w, h, 0xe8f0ff, (ax, ay) => {
      const d = Math.hypot((ax + 0.5 - 4) / 4, (ay + 0.5 - 2) / 2);
      return d <= 1 && d > 0.55 ? 0.7 : 0;
    });
  });
}

/** A pool of light on the light map, drawn at art resolution (1 px per art pixel): rx across, stepped rings. Returns its key. */
function poolTexture(scene, rx, color) {
  rx = Math.max(2, Math.round(rx / PX));
  const ry = Math.max(2, Math.round(rx * LIGHTMAP.squash));
  return bake(scene, `fx_pool_${rx}_${hex(color)}`, rx * 2, ry * 2, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot((x + 0.5 - rx) / rx, (y + 0.5 - ry) / ry);
        if (d >= 1) continue;
        ctx.fillStyle = rgba(color, Math.ceil((1 - d) ** 1.4 * LIGHTMAP.steps) / LIGHTMAP.steps);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
}

function vignetteTexture(scene, color) {
  return bake(scene, `fx_vignette_${hex(color)}`, GAME_W, GAME_H, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, 1));
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
   * @param {object} opts  { ground: the ground's depth, over: the depth just over the world, terrain,
   *                         hour, weather: the kind it is when the scene starts }
   */
  constructor(scene, look, { ground, over, terrain, hour = 12, weather = 'clear', lightmap = true }) {
    this.scene = scene;
    this.look = look;
    this.ground = ground;
    this.over = over;
    this.terrain = terrain;
    this.lightmap = lightmap;
    this.pools = []; // the light map's lights: { a: the glow's entry, x, y, pool: its canvas }
    this.mix = easeMix({}, weather, 1, 1); // the weather it is when he arrives, already in
    this.light = skyAt(look, hour, this.mix);
    this.shadows = []; // { obj, sprite } following a character
    this.attached = []; // a prop's shadows and glows: { obj, shadow?, glow?, flicker, pulse, phase, owner }
    this.puffers = []; // { x, y, spec, owner, next }
    this.motes = [];
    this.mists = [];
    this.drops = [];
    this.splashes = [];
    this.flash = null;
    this.nextBolt = 0;
    this.rand = createRng(11).random; // its own stream, so the air never shifts gameplay rolls
    this.buildOverlays();
    this.buildMist();
    this.buildRain();
    this.apply(0, 0);
  }

  // ---- What's on the map ---------------------------------------------------------

  /** A prop's shadow, glows and puffs, as its entry in PROP_IMAGES says. `img` is the prop's image. */
  addProp(img, def) {
    if (!def) return;
    const { x, y } = img;
    if (def.shadow) {
      const s = typeof def.shadow === 'number' ? { w: def.shadow } : def.shadow;
      if (s.w) {
        const obj = this.scene.add.image(Math.round(x + (s.x ?? 0)), Math.round(y + (s.y ?? -2)), shadowTexture(this.scene, s.w))
          .setDepth(this.ground + 1);
        this.attached.push({ obj, shadow: s.contact ? 0.6 : 1, owner: img });
      }
      // A contact shadow traced from the art, hugging its base where it meets the ground.
      if (s.contact) {
        const c = contactTexture(this.scene, def.key, s.contact === true ? {} : s.contact);
        const obj = this.scene.add.image(Math.round(x + c.x), Math.round(y + c.y), c.key).setOrigin(0).setDepth(this.ground + 1.5);
        this.attached.push({ obj, shadow: 2.2, owner: img });
      }
    }
    for (const g of def.glow ?? []) {
      const obj = this.scene.add.image(Math.round(x + g.x), Math.round(y + g.y), glowTexture(this.scene, g.r, g.color))
        .setDepth(this.over + 2).setBlendMode(Phaser.BlendModes.ADD);
      const a = { obj, glow: g.alpha ?? 1, flicker: g.flicker, pulse: g.pulse, phase: this.rand() * 100, owner: img, wobble: 1 };
      this.attached.push(a);
      if (this.lightmap) {
        // The pool lies on the ground: down from the glow toward the prop's feet.
        const reach = g.reach ?? g.r * LIGHTMAP.reach;
        const color = blendColor(g.color, 0xffffff, LIGHTMAP.whiten);
        this.pools.push({ a, x: x + g.x, y: y + g.y * (1 - LIGHTMAP.drop), reach, pool: poolTexture(this.scene, reach, color) });
      }
    }
    if (def.puffs) {
      for (const p of [].concat(def.puffs)) this.puffers.push({ x: x + p.x, y: y + p.y, p, spec: PUFFS[p.kind], owner: img, next: this.rand() * p.every });
    }
  }

  /** A shadow under a character that walks: it follows the sprite's feet. */
  follow(sprite, w = 44) {
    const obj = this.scene.add.image(sprite.x, sprite.y - 2, shadowTexture(this.scene, w)).setDepth(this.ground + 1).setAlpha(this.light.shadows);
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
    const pin = (o, depth) => o.setScrollFactor(0).setOrigin(0).setDepth(depth);
    this.grade = pin(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff), over).setBlendMode(Phaser.BlendModes.MULTIPLY);
    if (this.lightmap) {
      // The light map takes the grade's place: a canvas at art resolution, shown at full size.
      const w = GAME_W / PX;
      const h = GAME_H / PX;
      this.lightRT = pin(scene.add.renderTexture(0, 0, w, h), over).setScale(PX).setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.grade.setVisible(false);
    }
    this.haze = pin(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 0), over + 0.1);
    // Two layers of fog drifting at different speeds, moving with the world as the camera does.
    this.fog = [0, 1].map((k) => pin(scene.add.tileSprite(0, 0, GAME_W, GAME_H, fogTexture(scene)), over + 0.2 + k * 0.1).setAlpha(0));
    this.vignette = pin(scene.add.image(0, 0, vignetteTexture(scene, look.vignetteColor ?? 0x14081e)), over + 1).setAlpha(0);
    // The sun's light, redrawn on a small canvas as it changes and shown at full screen size.
    this.sunTex = scene.textures.exists('fx_sun') ? scene.textures.get('fx_sun') : scene.textures.createCanvas('fx_sun', GAME_W / SUN_RES, GAME_H / SUN_RES);
    this.sun = pin(scene.add.image(0, 0, 'fx_sun'), over + 1.5).setScale(SUN_RES).setBlendMode(Phaser.BlendModes.ADD);
    this.sunDrawn = null;
    this.flash = pin(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0xf0f4ff, 0), over + 4);
    const kinds = [['firefly', look.fireflyColors], ['spore', look.sporeColors]];
    for (const [kind, colors] of kinds) {
      if (!colors?.length) continue;
      for (let k = 0; k < (look.motes ?? 0); k++) {
        const obj = scene.add.image(0, 0, moteTexture(scene, colors[k % colors.length])).setDepth(over + 3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.motes.push({ kind, obj, x: 0, y: 0, phase: this.rand() * 1000, speed: 0.6 + this.rand() * 0.8, life: 0, age: 0, placed: false });
      }
    }
  }

  /** Banks of mist over solid water cells (`mistOn`, default 'w'). */
  buildMist() {
    const { look, terrain } = this;
    if (!look.mistDensity || !terrain) return;
    const { cols, rows, cell } = terrain;
    const solid = (look.mistOn ?? 'w').repeat(4);
    const tex = blobTexture(this.scene, 192, 56, look.mistColor ?? 0xffffff);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (terrain.key(i, j) !== solid || hash(i, j, 60) >= look.mistDensity) continue;
        const x = i * cell + cell / 2;
        const y = j * cell + cell / 2;
        const obj = this.scene.add.image(x, y, tex).setDepth(this.ground + 2).setAlpha(0);
        this.mists.push({ obj, x, y, phase: hash(i, j, 61) * 1000 });
      }
    }
  }

  /** Raindrops falling across the screen, and splashes on the ground in view. Only built where it can rain. */
  buildRain() {
    if (!this.look.weather?.odds?.rain && !this.look.weather?.odds?.storm) return;
    for (let k = 0; k < RAIN.drops; k++) {
      const obj = this.scene.add.image(0, 0, dropTexture(this.scene)).setScrollFactor(0).setDepth(this.over + 3).setVisible(false);
      this.drops.push({ obj, x: this.rand() * GAME_W, y: this.rand() * GAME_H, v: 0.8 + this.rand() * 0.4 });
    }
    for (let k = 0; k < RAIN.splashes; k++) {
      this.splashes.push({ obj: this.scene.add.image(0, 0, splashTexture(this.scene)).setDepth(this.ground + 2).setVisible(false), life: 0 });
    }
  }

  // ---- Every frame -------------------------------------------------------------------

  /** Move the light toward `hour` under `weather` (a kind; mixes fade in and out), and animate the air. */
  update(time, delta, { hour, weather, fade = 8 }) {
    this.mix = easeMix(this.mix, weather, delta / 1000, 1 / fade);
    this.light = skyAt(this.look, hour, this.mix);
    this.apply(time, delta);
  }

  /** Put `kind` of weather fully in at once, with no fade (SETTINGS' weather slider). */
  snapWeather(kind) {
    this.mix = easeMix({}, kind, 1, 1);
  }

  apply(time, delta) {
    const L = this.light;
    const view = this.scene.cameras.main.worldView;
    this.grade.setFillStyle(L.grade, 1);
    this.haze.setFillStyle(L.haze.color, L.haze.alpha);
    this.vignette.setAlpha(L.vignette);
    this.drawSun(L.sun);
    this.fog.forEach((f, k) => {
      f.setAlpha(L.fog * (k ? 0.2 : 0.32));
      f.tilePositionX = view.x * (k ? 0.9 : 1) + time * (k ? 0.012 : 0.02);
      f.tilePositionY = view.y * (k ? 0.9 : 1) + (k ? 256 : 0);
    });
    for (const s of this.shadows) s.obj.setPosition(s.sprite.x, s.sprite.y - 2).setVisible(s.sprite.visible).setAlpha(L.shadows);
    for (const a of this.attached) {
      const shown = a.owner.visible && a.owner.alpha > 0.3; // a see-through tree keeps its glow (ui/seeThrough.js)
      a.obj.setVisible(shown);
      if (!shown) continue;
      if (a.shadow) {
        a.obj.setAlpha(Math.min(1, L.shadows * a.shadow));
        continue;
      }
      const base = Math.min(1, L.lights * a.glow);
      const t = time / 1000 + a.phase;
      a.wobble = a.flicker ? 0.8 + 0.12 * Math.sin(t * 9.1) + 0.08 * Math.sin(t * 23.7) : a.pulse ? 0.75 + 0.25 * Math.sin(time / 700 + a.phase) : 1;
      a.obj.setAlpha(base * a.wobble * (this.lightmap ? LIGHTMAP.glows : 1));
    }
    if (this.lightmap) this.drawLightmap(L, view);
    for (const m of this.mists) {
      const t = time / 1000 + m.phase;
      m.obj.setPosition(even(m.x + Math.sin(t * 0.15) * 36), even(m.y + Math.sin(t * 0.11) * 8)).setAlpha(L.mist);
    }
    this.updateMotes(time, delta, view);
    this.updatePuffs(delta, view);
    this.updateRain(delta, view);
    this.updateLightning(time);
  }

  /** The light map: the grade's color, with each light in view screening its pool in. */
  drawLightmap(L, view) {
    // The darker the hour (the stronger its lights), the darker the dark between them.
    const dark = (this.look.lightmapDarken ?? LIGHTMAP.darken) * Math.min(1, Math.max(0, (L.lights - 0.6) / 0.9));
    const rt = this.lightRT;
    rt.fill(blendColor(L.grade, 0x000000, dark), 1);
    const stamp = { originX: 0.5, originY: 0.5, blendMode: Phaser.BlendModes.SCREEN, alpha: 1 };
    for (const p of this.pools) {
      if (!p.a.owner.visible || p.a.owner.alpha <= 0.3) continue;
      const sx = p.x - view.x;
      const sy = p.y - view.y;
      if (sx < -p.reach || sx > GAME_W + p.reach || sy < -p.reach || sy > GAME_H + p.reach) continue;
      stamp.alpha = Math.min(1, L.lights * 0.9 * p.a.glow * p.a.wobble);
      if (stamp.alpha <= 0.02) continue;
      rt.stamp(p.pool, undefined, Math.round(sx / PX), Math.round(sy / PX), stamp);
    }
  }

  /** Redraw the sun's light when it's changed enough to see. */
  drawSun(sun) {
    const last = this.sunDrawn;
    if (last && last.color === sun.color && Math.abs(last.alpha - sun.alpha) < 0.01 && Math.abs(last.x - sun.x) < 0.02) return;
    this.sunDrawn = { ...sun };
    const ctx = this.sunTex.getContext();
    const w = GAME_W / SUN_RES;
    const h = GAME_H / SUN_RES;
    ctx.clearRect(0, 0, w, h);
    this.sun.setVisible(sun.alpha > 0.005);
    if (sun.alpha > 0.005) {
      // Low in the sky past the top of the screen, toward its side: a warm wash fading down and across.
      const cx = w * sun.x;
      const g = ctx.createRadialGradient(cx, -h * 0.05, 0, cx, -h * 0.05, h * 0.9);
      g.addColorStop(0, rgba(sun.color, sun.alpha));
      g.addColorStop(0.35, rgba(sun.color, sun.alpha * 0.5));
      g.addColorStop(1, rgba(sun.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    this.sunTex.refresh();
  }

  updateMotes(time, delta, view) {
    const margin = 80;
    for (const mote of this.motes) {
      const amount = mote.kind === 'spore' ? this.light.spores : this.light.fireflies;
      if (amount <= 0.01) {
        mote.obj.setAlpha(0);
        continue;
      }
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
      if (mote.kind === 'spore') {
        // Spores rise and sway, fading in and out over their life.
        mote.y -= delta * 0.012 * mote.speed;
        mote.x += Math.sin(t * 1.3) * delta * 0.01;
        alpha = Math.min(1, mote.age / 800, mote.life / 800) * 0.7;
      } else {
        // Fireflies wander in loops and blink.
        mote.x += Math.sin(t * 0.9) * delta * 0.02;
        mote.y += Math.cos(t * 0.7) * delta * 0.014;
        alpha = Math.max(0, Math.sin(t * 2.2)) * Math.min(1, mote.age / 600, mote.life / 600);
      }
      mote.obj.setPosition(even(mote.x), even(mote.y)).setAlpha(alpha * amount);
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

  /** Drops fall across the screen (as many as the rain is heavy); splashes pop on the ground in view. */
  updateRain(delta, view) {
    if (!this.drops.length) return;
    const rain = this.light.rain;
    const live = Math.round(Math.min(1, rain) * this.drops.length);
    const dt = delta / 1000;
    this.drops.forEach((d, k) => {
      if (k >= live) {
        d.obj.setVisible(false);
        return;
      }
      d.y += RAIN.speed * d.v * dt;
      d.x += RAIN.wind * d.v * dt;
      if (d.y > GAME_H + 20 || d.x < -20) {
        d.y = -20 - this.rand() * 60;
        d.x = this.rand() * (GAME_W + 120);
      }
      d.obj.setPosition(even(d.x), even(d.y)).setVisible(true).setAlpha(Math.min(1, rain));
    });
    for (const s of this.splashes) {
      s.life -= delta;
      if (s.life > 0) {
        s.obj.setAlpha(Math.min(1, s.life / 120) * 0.8);
        continue;
      }
      if (this.rand() < rain * 0.25) {
        s.life = 240;
        s.obj.setPosition(even(view.x + this.rand() * view.width), even(view.y + this.rand() * view.height)).setVisible(true);
      } else s.obj.setVisible(false);
    }
  }

  /** In a storm, now and then a double flash of lightning. */
  updateLightning(time) {
    if (this.light.lightning < 0.5) return;
    if (!this.nextBolt) this.nextBolt = time + 4000 + this.rand() * 8000;
    if (time < this.nextBolt) return;
    this.nextBolt = time + 9000 + this.rand() * 16000;
    this.scene.tweens.killTweensOf(this.flash);
    this.flash.setFillStyle(0xf0f4ff, 0.55);
    this.scene.tweens.add({
      targets: this.flash, fillAlpha: 0, duration: 380, ease: 'Cubic.easeOut',
      onComplete: () => {
        this.flash.setFillStyle(0xf0f4ff, 0.35);
        this.scene.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 260, delay: 80 });
      },
    });
  }
}
