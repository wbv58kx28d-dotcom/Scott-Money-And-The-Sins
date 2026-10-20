// Draws a region's ground from its terrain grid (systems/terrain.js) and its
// tileset's art (assets/regions/<set>/, built by tools/region-art/tileset.py):
// each cell's tile, soft patches breaking up big fields (the tileset's
// `patches`), the water darkening toward the middle of pools, small details
// scattered on solid cells, low earth banks over the water's far edges, cliff
// faces under high ground (with rocky side walls and shaded ends), and
// boardwalks over the water (or stairs up a cliff). The ground is cut into square chunks, each its own canvas
// texture, so a big map never needs one texture past a phone's size limit,
// and the map editor can repaint just the chunks a brush stroke touched.

import { noise } from '../systems/terrain.js';

const CHUNK = 16; // cells per chunk side (512 px)
// The ground's edge at a drop: how ragged it is, and its lip (a dark line on the ground side, a lit one above it).
const DROP = { wobble: 0.35, scale: 0.9, lip: 'rgba(14,8,22,0.9)', lit: 'rgba(255,240,200,0.18)' };
// The shadow a bank casts on the water just below it, top row first.
const BANK_SHADOW = ['rgba(20,6,30,0.42)', 'rgba(20,6,30,0.3)', 'rgba(20,6,30,0.18)', 'rgba(20,6,30,0.08)'];
// The shadow at a cliff's foot, top row first (every other one dithered).
const FOOT_SHADOW = [0.34, 0.3, 0.24, 0.18, 0.12, 0.07];
// How wide a cliff's side wall shows beside an edge running down the screen, px; how dark its ends get.
const SIDE = 6;

const key = (set, part) => `ts_${set}_${part}`;

/** In preload(): the tileset's json and images, if not loaded yet. */
export function preloadTileset(scene, set) {
  const dir = `assets/regions/${set}`;
  if (!scene.cache.json.exists(key(set, 'json'))) scene.load.json(key(set, 'json'), `${dir}/tileset.json`);
  for (const part of ['tiles', 'decals', 'bridge', 'bridge_h', 'cliff', 'bank', 'stairs']) {
    if (!scene.textures.exists(key(set, part))) scene.load.image(key(set, part), `${dir}/${part}.png`);
  }
}

/** The loaded tileset.json. */
export const tilesetOf = (scene, set) => scene.cache.json.get(key(set, 'json'));

export class TerrainView {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../systems/terrain.js').Terrain} terrain
   * @param {object} o  set: tileset id; bridges: [{x, y, w, h, kind?}] (kind 'stairs' for steps); depth; id: texture key prefix;
   *                    parent: a Layer to draw into (default: a new one)
   */
  constructor(scene, terrain, { set, bridges = [], depth = 0, id = 'ground', parent = null }) {
    this.scene = scene;
    this.terrain = terrain;
    this.set = set;
    this.bridges = bridges;
    this.depth = depth;
    this.id = id;
    this.tiles = scene.textures.get(key(set, 'tiles')).getSourceImage();
    this.decals = scene.textures.get(key(set, 'decals')).getSourceImage();
    this.bridgeImg = scene.textures.get(key(set, 'bridge')).getSourceImage();
    this.bridgeHImg = scene.textures.get(key(set, 'bridge_h')).getSourceImage();
    this.stairsImg = scene.textures.get(key(set, 'stairs')).getSourceImage();
    this.cliffImg = scene.textures.get(key(set, 'cliff')).getSourceImage();
    this.bankImg = scene.textures.get(key(set, 'bank')).getSourceImage();
    this.cliffCols = columnColors(this.cliffImg);
    this.chunks = new Map();
    this.ownLayer = !parent;
    this.layer = parent ?? scene.add.layer().setDepth(depth);
    this.rebuild();
  }

  /** Recreate every chunk (after the map is resized). */
  rebuild() {
    for (const c of this.chunks.values()) this.dropChunk(c);
    this.chunks.clear();
    const { cols, rows, cell } = this.terrain;
    for (let cy = 0; cy * CHUNK < rows; cy++) {
      for (let cx = 0; cx * CHUNK < cols; cx++) {
        const w = Math.min(CHUNK, cols - cx * CHUNK) * cell;
        const h = Math.min(CHUNK, rows - cy * CHUNK) * cell;
        const tkey = `${this.id}_chunk_${cx}_${cy}`;
        if (this.scene.textures.exists(tkey)) this.scene.textures.remove(tkey);
        const tex = this.scene.textures.createCanvas(tkey, w, h);
        const img = this.scene.add.image(cx * CHUNK * cell, cy * CHUNK * cell, tkey).setOrigin(0).setDepth(this.ownLayer ? 0 : this.depth);
        this.layer.add(img);
        const chunk = { cx, cy, tex, img, tkey };
        this.chunks.set(`${cx},${cy}`, chunk);
        this.draw(chunk);
      }
    }
  }

  dropChunk(c) {
    c.img.destroy();
    this.scene.textures.remove(c.tkey);
  }

  /** Redraw the chunks covering cells i0..i1, j0..j1. */
  redrawCells({ i0, j0, i1, j1 }) {
    const { cols, rows } = this.terrain;
    for (let cy = Math.max(0, Math.floor(j0 / CHUNK)); cy <= Math.floor(Math.min(rows - 1, j1) / CHUNK); cy++) {
      for (let cx = Math.max(0, Math.floor(i0 / CHUNK)); cx <= Math.floor(Math.min(cols - 1, i1) / CHUNK); cx++) {
        const c = this.chunks.get(`${cx},${cy}`);
        if (c) this.draw(c);
      }
    }
  }

  /** New bridges: redraw everything they might touch (cheap enough to just redraw all). */
  setBridges(bridges) {
    this.bridges = bridges;
    for (const c of this.chunks.values()) this.draw(c);
  }

  draw(chunk) {
    const { terrain } = this;
    const { cell } = terrain;
    const ctx = chunk.tex.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, chunk.tex.width, chunk.tex.height);
    const i0 = chunk.cx * CHUNK;
    const j0 = chunk.cy * CHUNK;
    const i1 = Math.min(terrain.cols, i0 + CHUNK);
    const j1 = Math.min(terrain.rows, j0 + CHUNK);
    const perRow = terrain.tileset.perRow;
    const frames = terrain.tileset.decals.frames;
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const tile = terrain.tileFor(i, j);
        if (!tile) continue; // all drop: nothing here
        const { frame, flip } = tile;
        const sx = (frame % perRow) * cell;
        const sy = Math.floor(frame / perRow) * cell;
        const x = (i - i0) * cell;
        const y = (j - j0) * cell;
        if (flip) {
          ctx.save();
          ctx.translate(x + cell, y);
          ctx.scale(-1, 1);
          ctx.drawImage(this.tiles, sx, sy, cell, cell, 0, 0, cell, cell);
          ctx.restore();
        } else {
          ctx.drawImage(this.tiles, sx, sy, cell, cell, x, y, cell, cell);
        }
      }
    }
    const ox = i0 * cell;
    const oy = j0 * cell;
    this.drawPatches(ctx, ox, oy, (i1 - i0) * cell, (j1 - j0) * cell);
    this.drawDepth(ctx, ox, oy, i0, j0, i1, j1);
    // Details on top of the tiles (a pass of their own, so a neighbor's tile never covers one).
    // Big ones spill right and down, so the cells just up and left of the chunk can reach into it.
    for (let j = Math.max(0, j0 - 1); j < j1; j++) {
      for (let i = Math.max(0, i0 - 1); i < i1; i++) {
        for (const d of terrain.decalsFor(i, j)) {
          const [fx, fy, fw, fh] = frames[d.frame];
          ctx.drawImage(this.decals, fx, fy, fw, fh, (i - i0) * cell + d.x, (j - j0) * cell + d.y, fw, fh);
        }
      }
    }
    this.cutDrops(ctx, ox, oy, i0, j0, i1, j1);
    this.drawBanks(ctx, ox, oy, (i1 - i0) * cell, (j1 - j0) * cell);
    this.drawCliffs(ctx, ox, oy, (i1 - i0) * cell, (j1 - j0) * cell);
    for (const b of this.bridges) this.drawBridge(ctx, b, ox, oy, (i1 - i0) * cell, (j1 - j0) * cell);
    chunk.tex.refresh();
  }

  /**
   * Cliff faces (systems/terrain.js facesAt): for each 2 px column, the face
   * art's matching column (by world x, so it tiles across chunks) hung below
   * each south-facing rim, and a soft shadow on the ground at its foot.
   */
  /**
   * The tileset's patches (systems/terrain.js patchAt), in 4 px blocks: each a
   * color laid over the tiles (`blend`, default normal), its edge dithered in a
   * checkerboard of 2 px art pixels so it frays like pixel art.
   */
  drawPatches(ctx, ox, oy, w, h) {
    const patches = this.terrain.tileset.patches;
    if (!patches?.length) return;
    const B = 4;
    patches.forEach((p, k) => {
      ctx.globalCompositeOperation = p.blend ?? 'source-over';
      ctx.fillStyle = p.color;
      for (let y = 0; y < h; y += B) {
        for (let x = 0; x < w; x += B) {
          const at = this.terrain.patchAt(p, k, ox + x + B / 2, oy + y + B / 2);
          if (!at) continue;
          ctx.globalAlpha = p.alpha;
          if (at === 2) ctx.fillRect(x, y, B, B);
          else {
            ctx.fillRect(x, y, B / 2, B / 2);
            ctx.fillRect(x + B / 2, y + B / 2, B / 2, B / 2);
          }
        }
      }
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Where the ground meets a drop (systems/terrain.js voidAt), cut it away on
   * the 2 px grid along a ragged line, leaving a dark lip on the ground's side
   * so the edge reads as an edge.
   */
  cutDrops(ctx, ox, oy, i0, j0, i1, j1) {
    const { terrain } = this;
    if (!terrain.voids.size) return;
    const { cell } = terrain;
    const isVoid = (x, y) => terrain.voidAt(x, y) + (noise(x / (cell * DROP.scale), y / (cell * DROP.scale), 77) - 0.5) * DROP.wobble > 0.5;
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const corners = [terrain.grid[j][i], terrain.grid[j][i + 1], terrain.grid[j + 1][i], terrain.grid[j + 1][i + 1]];
        const n = corners.filter((c) => terrain.voids.has(c)).length;
        if (!n) continue;
        const cx = (i - i0) * cell;
        const cy = (j - j0) * cell;
        if (n === 4) {
          ctx.clearRect(cx, cy, cell, cell);
          continue;
        }
        for (let y = 0; y < cell; y += 2) {
          for (let x = 0; x < cell; x += 2) {
            const wx = i * cell + x + 1;
            const wy = j * cell + y + 1;
            if (isVoid(wx, wy)) ctx.clearRect(cx + x, cy + y, 2, 2);
            else if (isVoid(wx, wy - 2) || isVoid(wx - 2, wy) || isVoid(wx + 2, wy)) {
              ctx.fillStyle = DROP.lip;
              ctx.fillRect(cx + x, cy + y, 2, 2);
            } else if (isVoid(wx, wy + 2) || isVoid(wx, wy - 4)) {
              ctx.fillStyle = DROP.lit;
              ctx.fillRect(cx + x, cy + y, 2, 2);
            }
          }
        }
      }
    }
  }

  /**
   * The water's depth (the tileset's `depth`): bands of a darker color laid
   * over the water the farther it is from any shore (systems/terrain.js
   * wetDepths), in 4 px blocks, each band's edge dithered on the 2 px grid.
   */
  drawDepth(ctx, ox, oy, i0, j0, i1, j1) {
    const spec = this.terrain.tileset.depth;
    const { terrain } = this;
    if (!spec || !terrain.wet.size) return;
    let any = false;
    for (let j = j0; j <= j1 && !any; j++) for (let i = i0; i <= i1 && !any; i++) any = terrain.wet.has(terrain.grid[j][i]);
    if (!any) return;
    const depthAt = terrain.wetDepths(i0, j0, i1, j1, Math.ceil(spec.steps.at(-1).at / terrain.cell) + 1);
    const B = 4;
    const w = (i1 - i0) * terrain.cell;
    const h = (j1 - j0) * terrain.cell;
    ctx.globalCompositeOperation = spec.blend ?? 'multiply';
    ctx.fillStyle = spec.color;
    const { cell } = terrain;
    for (let y = 0; y < h; y += B) {
      for (let x = 0; x < w; x += B) {
        const wx = ox + x + B / 2;
        const wy = oy + y + B / 2;
        if (x % cell === 0 && !terrain.wet.has(terrain.at(wx / cell | 0, wy / cell | 0)) && !terrain.wet.has(terrain.at((wx / cell | 0) + 1, wy / cell | 0))
          && !terrain.wet.has(terrain.at(wx / cell | 0, (wy / cell | 0) + 1)) && !terrain.wet.has(terrain.at((wx / cell | 0) + 1, (wy / cell | 0) + 1))) {
          x += cell - B; // a dry cell: on to the next
          continue;
        }
        if (!terrain.wetAt(wx, wy)) continue;
        const d = depthAt(wx, wy);
        // The deepest band reached, and how far into it (its first `fray` px are dithered with the band before).
        let k = -1;
        for (let s = 0; s < spec.steps.length && d >= spec.steps[s].at; s++) k = s;
        if (k < 0) continue;
        const fray = d - spec.steps[k].at < (spec.fray ?? 8);
        const alpha = spec.steps[k].alpha;
        const under = k > 0 ? spec.steps[k - 1].alpha : 0;
        if (!fray) {
          ctx.globalAlpha = alpha;
          ctx.fillRect(x, y, B, B);
          continue;
        }
        for (let q = 0; q < 4; q++) {
          const a = (q === 0 || q === 3) ? alpha : under;
          if (!a) continue;
          ctx.globalAlpha = a;
          ctx.fillRect(x + (q % 2) * 2, y + (q >> 1) * 2, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Banks (systems/terrain.js banksAt): where ground meets water on the
   * water's far side, the bank art's matching column hung over the edge, and
   * a shadow on the water below it, so the water sits below the ground.
   */
  drawBanks(ctx, ox, oy, w, h) {
    const { terrain } = this;
    const img = this.bankImg;
    if (!terrain.bank || img.width < 2) return;
    // Nothing to draw unless there's water in (or just above) this chunk.
    const { cell } = terrain;
    const i0 = Math.floor(ox / cell);
    let any = false;
    for (let j = Math.max(0, Math.floor((oy - terrain.bank) / cell)); j <= Math.min(terrain.rows, Math.ceil((oy + h) / cell)) && !any; j++) {
      for (let i = i0; i <= Math.min(terrain.cols, i0 + Math.ceil(w / cell)) && !any; i++) any = terrain.wet.has(terrain.grid[j][i]);
    }
    if (!any) return;
    for (let x = 0; x < w; x += 2) {
      const wx = ox + x;
      const sx = wx % img.width;
      for (const b of terrain.banksAt(wx + 1, oy, oy + h)) {
        ctx.drawImage(img, sx, 0, 2, b.height, x, b.top - oy, 2, b.height);
        BANK_SHADOW.forEach((color, k) => {
          const y = b.top + b.height + k * 2;
          if (!terrain.wetAt(wx + 1, y + 1)) return;
          ctx.fillStyle = color;
          ctx.fillRect(x, y - oy, 2, 2);
        });
      }
    }
  }

  /**
   * A cliff's side walls: beside an edge of raised ground that runs down the
   * screen, a strip of the face's rock SIDE px wide on the lower ground (lit on
   * the west side of a plateau, in shade on its east), with an ink line on its
   * outer edge, so the plateau has sides as well as a front.
   */
  drawSides(ctx, ox, oy, w, h) {
    const { terrain } = this;
    const cols = this.cliffCols;
    const { cell, levels } = terrain;
    // Only cells beside a change of level can have a side wall: the cell's corners and its neighbors' across.
    const near = (i, j) => {
      const lv = levels[terrain.at(i, j)];
      for (let a = i - 1; a <= i + 2; a++) for (let b = j; b <= j + 1; b++) if (levels[terrain.at(a, b)] !== lv) return true;
      return false;
    };
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const wx = ox + x + 1;
        const wy = oy + y + 1;
        if (x % cell === 0 && !near(Math.floor(wx / cell), Math.floor(wy / cell))) {
          x += cell - 2; // nothing in this cell: on to the next
          continue;
        }
        const lv = terrain.levelAt(wx, wy);
        if (terrain.voidAt(wx, wy) > 0.5) continue;
        for (const dir of [-1, 1]) {
          // How far toward `dir` the higher ground starts, if within SIDE px.
          let at = 0;
          for (let d = 2; d <= SIDE && !at; d += 2) if (terrain.levelAt(wx + dir * d, wy) > lv) at = d;
          if (!at) continue;
          const c = cols[Math.floor(wy / 2) % cols.length];
          // Lit facing west (the higher ground to the east, dir 1), shaded facing east.
          ctx.fillStyle = at === SIDE ? 'rgba(18,13,28,0.9)' : dir === 1 ? c.lit : c.shade;
          ctx.fillRect(x, y, 2, 2);
          break;
        }
      }
    }
  }

  drawCliffs(ctx, ox, oy, w, h) {
    const { terrain } = this;
    const img = this.cliffImg;
    if (!terrain.face || img.width < 2) return;
    // Nothing to draw unless raised ground or a drop is somewhere in (or just above) this chunk.
    const { cell } = terrain;
    const ci0 = Math.floor(ox / cell);
    const cj0 = Math.max(0, Math.floor((oy - terrain.maxFace) / cell));
    let any = false;
    for (let j = cj0; j <= Math.min(terrain.rows, Math.ceil((oy + h) / cell)) && !any; j++) {
      for (let i = ci0; i <= Math.min(terrain.cols, ci0 + Math.ceil(w / cell)) && !any; i++) any = terrain.levels[terrain.grid[j][i]] !== 0;
    }
    if (!any) return;
    this.drawSides(ctx, ox, oy, w, h);
    // Every column's faces first, so each can see whether its neighbors have one.
    const faces = [];
    for (let x = -2; x <= w; x += 2) faces.push(terrain.facesAt(ox + x + 1, oy, oy + h));
    const hasFace = (k, f) => (faces[k] ?? []).some((g) => Math.abs(g.top - f.top) <= 4);
    for (let x = 0; x < w; x += 2) {
      const sx = (ox + x) % img.width;
      const k = x / 2 + 1;
      for (const f of faces[k]) {
        const y = f.top - oy;
        // A drop of more than one level stacks the strip.
        for (let s = 0; s < f.height; s += img.height) {
          const sh = Math.min(img.height, f.height - s);
          ctx.drawImage(img, sx, 0, 2, sh, x, y + s, 2, sh);
        }
        // Where the face ends (it turns the corner into a side wall), an ink edge, and shade beside it.
        const left = !hasFace(k - 1, f);
        const right = !hasFace(k + 1, f);
        if (left || right) {
          ctx.fillStyle = 'rgba(18,13,28,0.9)';
          ctx.fillRect(x, y + 4, 2, f.height - 4);
        } else if (!hasFace(k - 2, f) || !hasFace(k + 2, f)) {
          ctx.fillStyle = 'rgba(18,13,28,0.35)';
          ctx.fillRect(x, y + 4, 2, f.height - 4);
        }
        // A shadow at its foot, unless it ends in a drop (nothing there to cast it on).
        if (f.height === f.full && terrain.voidAt(ox + x + 1, f.top + f.height + 1) <= 0.5) {
          FOOT_SHADOW.forEach((a, r) => {
            if (r % 2 && (x / 2) % 2) return; // dithered toward the bottom
            ctx.fillStyle = `rgba(10, 6, 16, ${a})`;
            ctx.fillRect(x, y + f.height + r * 2, 2, 2);
          });
        }
      }
    }
  }

  /**
   * A boardwalk running down the screen: the bridge art, centered on the
   * bridge's rect, as tall as the rect. It stretches by repeating its middle
   * plank rows (never by scaling pixels).
   */
  drawBridge(ctx, b, ox, oy, w, h) {
    if (b.kind !== 'stairs' && b.w > b.h && this.bridgeHImg.width > 1) {
      this.drawBridgeAcross(ctx, b, ox, oy, w, h);
      return;
    }
    const img = b.kind === 'stairs' ? this.stairsImg : this.bridgeImg;
    const x = Math.round(b.x + b.w / 2 - img.width / 2) - ox;
    const y = Math.round(b.y) - oy;
    if (x > w || y > h || x + img.width < 0 || y + b.h < 0) return;
    const head = Math.floor(img.height / 2) - 8; // the top half, minus the repeating band
    const band = 16; // px of plank rows that repeat
    const tail = img.height - head - band;
    const want = Math.round(b.h);
    if (want <= head + tail) {
      // Shorter than the art: the middle of it.
      const sy = Math.floor((img.height - want) / 2);
      ctx.drawImage(img, 0, sy, img.width, want, x, y, img.width, want);
      return;
    }
    ctx.drawImage(img, 0, 0, img.width, head, x, y, img.width, head);
    let yy = y + head;
    const end = y + want - tail;
    while (yy < end) {
      const hh = Math.min(band, end - yy);
      ctx.drawImage(img, 0, head, img.width, hh, x, yy, img.width, hh);
      yy += hh;
    }
    ctx.drawImage(img, 0, head + band, img.width, tail, x, end, img.width, tail);
  }

  /**
   * A boardwalk running across the screen (a set with bridge_h.png, the Sky
   * Deck's): the art centered on the rect's height, as wide as the rect,
   * stretched by repeating its middle columns.
   */
  drawBridgeAcross(ctx, b, ox, oy, w, h) {
    const img = this.bridgeHImg;
    const x = Math.round(b.x) - ox;
    const y = Math.round(b.y + b.h / 2 - img.height / 2) - oy;
    const want = Math.round(b.w);
    if (x > w || y > h || x + want < 0 || y + img.height < 0) return;
    const head = Math.floor(img.width / 2) - 8;
    const band = 16;
    const tail = img.width - head - band;
    if (want <= head + tail) {
      const sx = Math.floor((img.width - want) / 2);
      ctx.drawImage(img, sx, 0, want, img.height, x, y, want, img.height);
      return;
    }
    ctx.drawImage(img, 0, 0, head, img.height, x, y, head, img.height);
    let xx = x + head;
    const end = x + want - tail;
    while (xx < end) {
      const ww = Math.min(band, end - xx);
      ctx.drawImage(img, head, 0, ww, img.height, xx, y, ww, img.height);
      xx += ww;
    }
    ctx.drawImage(img, head + band, 0, tail, img.height, end, y, tail, img.height);
  }

  destroy() {
    for (const c of this.chunks.values()) this.dropChunk(c);
    this.chunks.clear();
    if (this.ownLayer) this.layer.destroy();
  }
}

/**
 * A lit and a shaded tone per row of a cliff strip, taken from its rock (its
 * middle columns' average), for the side walls.
 */
function columnColors(img) {
  if (img.width < 2) return [{ lit: '#000', shade: '#000' }];
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, img.width, img.height).data;
  const rows = [];
  // The rock only: below the lip, above the foot.
  for (let y = Math.round(img.height * 0.3); y < img.height * 0.85; y += 2) {
    let r = 0;
    let gg = 0;
    let b = 0;
    let n = 0;
    for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * 4;
      if (data[i + 3] < 128) continue;
      r += data[i];
      gg += data[i + 1];
      b += data[i + 2];
      n++;
    }
    n = Math.max(1, n);
    const tone = (f) => `rgb(${Math.round((r / n) * f)},${Math.round((gg / n) * f)},${Math.round((b / n) * f)})`;
    rows.push({ lit: tone(1.05), shade: tone(0.62) });
  }
  return rows;
}
