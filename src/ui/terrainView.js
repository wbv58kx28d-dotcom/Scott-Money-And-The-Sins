// Draws a region's ground from its terrain grid (systems/terrain.js) and its
// tileset's art (assets/regions/<set>/, built by tools/region-art/tileset.py):
// each cell's tile, soft patches breaking up big fields (the tileset's
// `patches`), small details scattered on solid cells, cliff faces under
// high ground, and boardwalks over the water (or stairs up a cliff). The ground is cut into square chunks, each its own canvas
// texture, so a big map never needs one texture past a phone's size limit,
// and the map editor can repaint just the chunks a brush stroke touched.

const CHUNK = 16; // cells per chunk side (512 px)

const key = (set, part) => `ts_${set}_${part}`;

/** In preload(): the tileset's json and images, if not loaded yet. */
export function preloadTileset(scene, set) {
  const dir = `assets/regions/${set}`;
  if (!scene.cache.json.exists(key(set, 'json'))) scene.load.json(key(set, 'json'), `${dir}/tileset.json`);
  for (const part of ['tiles', 'decals', 'bridge', 'cliff', 'stairs']) {
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
    this.stairsImg = scene.textures.get(key(set, 'stairs')).getSourceImage();
    this.cliffImg = scene.textures.get(key(set, 'cliff')).getSourceImage();
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
        const { frame, flip } = terrain.tileFor(i, j);
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

  drawCliffs(ctx, ox, oy, w, h) {
    const { terrain } = this;
    const img = this.cliffImg;
    if (!terrain.face || img.width < 2) return;
    // Nothing to draw unless high ground is somewhere in (or just above) this chunk.
    const { cell } = terrain;
    const ci0 = Math.floor(ox / cell);
    const cj0 = Math.max(0, Math.floor((oy - terrain.maxFace) / cell));
    let any = false;
    for (let j = cj0; j <= Math.min(terrain.rows, Math.ceil((oy + h) / cell)) && !any; j++) {
      for (let i = ci0; i <= Math.min(terrain.cols, ci0 + Math.ceil(w / cell)) && !any; i++) any = terrain.levels[terrain.grid[j][i]] > 0;
    }
    if (!any) return;
    for (let x = 0; x < w; x += 2) {
      const wx = ox + x;
      const sx = wx % img.width;
      for (const f of terrain.facesAt(wx + 1, oy, oy + h)) {
        // A drop of more than one level stacks the strip.
        for (let k = 0; k < f.height; k += img.height) {
          const sh = Math.min(img.height, f.height - k);
          ctx.drawImage(img, sx, 0, 2, sh, x, f.top - oy + k, 2, sh);
        }
        if (f.height === f.full) {
          ctx.fillStyle = 'rgba(10, 6, 16, 0.28)';
          ctx.fillRect(x, f.top - oy + f.height, 2, 6);
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

  destroy() {
    for (const c of this.chunks.values()) this.dropChunk(c);
    this.chunks.clear();
    if (this.ownLayer) this.layer.destroy();
  }
}
