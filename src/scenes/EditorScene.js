// The map editor (CLAUDE.md §6.11): index.html?debug=1&edit=<region id>.
// It edits a region's LAYOUT, the file that says where things are
// (src/data/maps/<id>.layout.js, systems/mapfile.js), with the game's own
// tiles, props and characters, so what you see is what the region plays like.
//   VIEW    drag to look around (two fingers or the mouse wheel zoom anywhere)
//   PAINT   paint the ground: water, grass, dirt, reeds (edges blend on their own)
//   SELECT  tap a thing to pick it, drag to move it; its options show below
//   ADD     props, NPCs, velvet ropes, boardwalks, exits
//   MAP     grow or shrink the map, PLAYTEST, EXPORT, IMPORT, REVERT
// CHECK runs the map checks (systems/mapcheck.js) and shades where $cott can
// walk. Every change autosaves a draft in this browser; EXPORT downloads the
// layout file to commit (send it to Claude, or upload it on GitHub). What NPCs
// say stays in src/data/maps/<id>.js; new NPCs get stand-in lines.
//
// Two cameras: the map's (main, between the bars, zoomable) and the UI's on top.

import { GAME_W, GAME_H, FIELD, COLORS } from '../config.js';
import { FIELD_SHEETS, PROP_IMAGES } from '../data/assets.js';
import { LAYOUTS, CONTENT } from '../data/maps/index.js';
import { regionById } from '../data/regions.js';
import { Terrain } from '../systems/terrain.js';
import { checkMap } from '../systems/mapcheck.js';
import { mergeMap, layoutToSource, cloneLayout } from '../systems/mapfile.js';
import { bakeProps, bakeWalkerSheet, facingFrame, SHEET_COLS } from '../systems/fieldArt.js';
import { Audio } from '../systems/audio.js';
import { TerrainView, preloadTileset, tilesetOf } from '../ui/terrainView.js';
import { signLabel } from '../ui/pixelFont.js';
import { Button } from '../ui/button.js';
import { label, body, fitWidth } from '../ui/text.js';
import { hex } from '../ui/ribbon.js';

const TOP = 112; // the top bar
const BOTTOM = 1000; // the tool panel starts here
const VIEW = { x: 0, y: TOP, w: GAME_W, h: BOTTOM - TOP };
const BAR = 0x120d22;
const ACCENT = 0x9fdcff;
const SEL = 0xffd166;
const ZOOM = { min: 0.2, max: 2.5 };
const UNDO_MAX = 60;
const DRAFT_KEY = (id) => `scottmoney.mapdraft.${id}`;
const FACINGS = ['down', 'left', 'right', 'up'];
// Which layout list each kind of thing lives in.
const LISTS = { prop: 'props', npc: 'npcs', gate: 'gates', bridge: 'bridges', exit: 'exits' };
/** The next value after `v` in a list (wrapping round; the first if `v` isn't in it). */
const cycle = (list, v, d = 1) => list[(list.indexOf(v) + d + list.length) % list.length];
/** An id the content files can key by: lowercase letters, digits, underscores. */
const cleanId = (v) => v.toLowerCase().replace(/[^a-z0-9_]/g, '');
const TABS = ['VIEW', 'PAINT', 'SELECT', 'ADD', 'MAP'];
const BRUSHES = [1, 2, 3];
const GROW = 4; // cells per GROW press

/** A blank map for a region that doesn't have one yet: grass inside a wall of reeds, an exit at the bottom. */
function blankLayout(id) {
  const cols = 34;
  const rows = 60;
  const terrain = [];
  for (let j = 0; j <= rows; j++) {
    let row = '';
    for (let i = 0; i <= cols; i++) {
      const edge = Math.min(i, j, cols - i, rows - j);
      const exitGap = j > rows - 3 && Math.abs(i - cols / 2) <= 2;
      row += edge < 2 && !exitGap ? 'r' : 'g';
    }
    terrain.push(row);
  }
  const w = cols * 32;
  return {
    id, tileset: 'swamp', cell: 32, cols,
    spawn: { x: w / 2, y: rows * 32 - 140, facing: 'up' },
    exits: [{ to: 'map', x: w / 2 - 70, y: rows * 32 - 40, w: 140, h: 40 }],
    bridges: [], npcs: [], gates: [], props: [], terrain,
  };
}

const readDraft = (id) => {
  try {
    const raw = globalThis.localStorage?.getItem(DRAFT_KEY(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeDraft = (id, layout) => {
  try {
    if (layout) globalThis.localStorage?.setItem(DRAFT_KEY(id), JSON.stringify(layout));
    else globalThis.localStorage?.removeItem(DRAFT_KEY(id));
  } catch {
    // storage unavailable: the draft lives until the page closes
  }
};

export default class EditorScene extends Phaser.Scene {
  constructor() {
    super('Editor');
  }

  init(data) {
    this.mapId = data?.id ?? 'start';
    this.saved = LAYOUTS[this.mapId] ? cloneLayout(LAYOUTS[this.mapId]) : blankLayout(this.mapId);
    this.layout = readDraft(this.mapId) ?? cloneLayout(this.saved);
  }

  preload() {
    preloadTileset(this, this.layout.tileset);
    const { w, h } = FIELD.frame;
    for (const s of FIELD_SHEETS) if (s.path && !this.textures.exists(s.key)) this.load.spritesheet(s.key, s.path, { frameWidth: w, frameHeight: h });
    for (const p of PROP_IMAGES) if (p.path && !this.textures.exists(p.key)) this.load.image(p.key, p.path);
  }

  create() {
    this.buttons = new Set();
    this.tab = 'PAINT';
    this.paintWith = 'w';
    this.brush = 2;
    this.selected = null; // { kind: 'prop' | 'npc' | 'gate' | 'bridge' | 'exit' | 'spawn', index }
    this.undoStack = [];
    this.redoStack = [];
    this.checking = false;
    this.problems = [];
    this.toastTimer = null;
    // The scene object is reused (PLAYTEST, then EDIT), so nothing carries over from last time.
    this.revertArmed = false;
    this.lastExport = null;
    this.drag = null;
    this.stroke = null;
    this.pinch = null;
    bakeProps(this);
    for (const s of FIELD_SHEETS) if (!this.textures.exists(s.key)) bakeWalkerSheet(this, s.key);

    this.world = this.add.layer();
    this.ui = this.add.layer();
    const cam = this.cameras.main;
    cam.setViewport(VIEW.x, VIEW.y, VIEW.w, VIEW.h).setBackgroundColor('#05030a');
    this.uiCam = this.cameras.add(0, 0, GAME_W, GAME_H);
    cam.ignore(this.ui);
    this.uiCam.ignore(this.world);

    this.loadTerrain();
    this.objs = []; // what drawObjects() made (straight in the world layer: Phaser layers don't nest)
    this.overlay = null;
    this.marks = this.add.graphics();
    this.cursor = this.add.graphics();
    this.world.add([this.marks, this.cursor]);
    this.drawObjects();
    this.fitView();

    this.buildTop();
    this.panel = this.add.container(0, 0);
    this.ui.add(this.panel);
    this.ui.add(this.add.rectangle(0, BOTTOM, GAME_W, GAME_H - BOTTOM, BAR, 1).setOrigin(0).setDepth(-1));
    this.buildTabs();
    this.showTab(this.tab);

    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('wheel', (p, over, dx, dy) => this.zoomAt(p.x, p.y, this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1)));
    this.input.keyboard?.on('keydown', (e) => this.onKey(e));
    this.input.mouse?.disableContextMenu();
  }

  // ---- The map ------------------------------------------------------------------------

  loadTerrain() {
    this.ground?.destroy();
    this.terrain = new Terrain(this.layout.terrain, tilesetOf(this, this.layout.tileset));
    this.ground = new TerrainView(this, this.terrain, {
      set: this.layout.tileset, bridges: this.layout.bridges, id: `editor_${this.mapId}`, parent: this.world, depth: -1e7,
    });
    this.border?.destroy();
    this.border = this.add.graphics().lineStyle(4, ACCENT, 0.6).strokeRect(0, 0, this.terrain.width, this.terrain.height);
    this.world.add(this.border);
  }

  get map() {
    return mergeMap(this.layout, CONTENT[this.mapId]);
  }

  /** Every placeable thing, with its world bounds (for drawing the selection and hit-testing). */
  things() {
    const L = this.layout;
    const frame = FIELD.frame;
    const out = [];
    const tex = (key) => this.textures.get(key).getSourceImage();
    L.props.forEach((p, index) => {
      const img = tex(p.texture);
      out.push({ kind: 'prop', index, ref: p, bounds: { x: p.x - img.width / 2, y: p.y - img.height, w: img.width, h: img.height } });
    });
    L.npcs.forEach((n, index) => out.push({ kind: 'npc', index, ref: n, bounds: { x: n.x - frame.w / 2, y: n.y - frame.h + 10, w: frame.w, h: frame.h - 10 } }));
    L.gates.forEach((g, index) => {
      const img = tex('prop_rope');
      out.push({ kind: 'gate', index, ref: g, bounds: { x: g.x - img.width / 2, y: g.y - img.height - 24, w: img.width, h: img.height + 24 } });
    });
    L.bridges.forEach((b, index) => out.push({ kind: 'bridge', index, ref: b, bounds: { ...b } }));
    L.exits.forEach((e, index) => out.push({ kind: 'exit', index, ref: e, bounds: { ...e } }));
    const s = L.spawn;
    out.push({ kind: 'spawn', index: 0, ref: s, bounds: { x: s.x - frame.w / 2, y: s.y - frame.h + 10, w: frame.w, h: frame.h - 10 } });
    return out;
  }

  selectedThing() {
    if (!this.selected) return null;
    return this.things().find((t) => t.kind === this.selected.kind && t.index === this.selected.index) ?? null;
  }

  /** Redraw every object (a few hundred on the big swamp; a drag redraws on every move). */
  drawObjects() {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    const add = (o) => {
      this.world.add(o);
      this.objs.push(o);
      return o;
    };
    const L = this.layout;
    for (const b of L.bridges) add(this.add.rectangle(b.x, b.y, b.w, b.h).setOrigin(0).setStrokeStyle(2, 0xc8a070, 0.6).setDepth(-1));
    for (const e of L.exits) {
      add(this.add.rectangle(e.x, e.y, e.w, e.h, ACCENT, 0.25).setOrigin(0).setStrokeStyle(3, ACCENT, 0.9).setDepth(-1));
      add(label(this, e.x + e.w / 2, e.y - 6, `EXIT → ${e.to.toUpperCase()}`, 12, { color: '#9fdcff' }).setOrigin(0.5, 1).setDepth(1e6));
    }
    for (const p of L.props) {
      const img = add(this.add.image(p.x, p.y, p.texture).setOrigin(0.5, 1).setDepth(p.y));
      if (p.label) add(signLabel(this, p, img).setDepth(p.y + 0.5));
    }
    for (const g of L.gates) {
      add(this.add.image(g.x, g.y, 'prop_rope').setOrigin(0.5, 1).setDepth(g.y));
      add(label(this, g.x, g.y - 70, `ROPE ${g.id.toUpperCase()}`, 12, { color: '#ffd166' }).setOrigin(0.5, 1).setDepth(1e6));
    }
    for (const n of L.npcs) {
      const { row, flip } = facingFrame(n.facing);
      add(this.add.sprite(n.x, n.y, n.sprite, row * SHEET_COLS).setOrigin(0.5, 1).setFlipX(flip).setDepth(n.y));
      add(label(this, n.x, n.y - FIELD.frame.h + 4, n.id.toUpperCase(), 12).setOrigin(0.5, 1).setDepth(1e6));
    }
    const s = L.spawn;
    const { row, flip } = facingFrame(s.facing);
    add(this.add.sprite(s.x, s.y, 'field_scott', row * SHEET_COLS).setOrigin(0.5, 1).setFlipX(flip).setAlpha(0.6).setDepth(s.y));
    add(label(this, s.x, s.y - FIELD.frame.h + 4, 'START', 12, { color: '#7cf29c' }).setOrigin(0.5, 1).setDepth(1e6));
    this.drawSelection();
  }

  /** Footprints of everything, and the selected thing's bounds. */
  drawSelection() {
    const g = this.marks.clear().setDepth(2e6);
    const fp = (x, y, b, color, a) => g.lineStyle(2, color, a).strokeRect(x - b.w / 2, y - b.h / 2, b.w, b.h);
    for (const p of this.layout.props) if (p.block) fp(p.x, p.y, p.block, 0xffffff, 0.25);
    for (const n of this.layout.npcs) fp(n.x, n.y, FIELD.npcBlock, 0xffffff, 0.25);
    for (const gt of this.layout.gates) fp(gt.x, gt.y, gt.block, 0xff5c5c, 0.7);
    const t = this.selectedThing();
    if (t) {
      const b = t.bounds;
      g.lineStyle(4, SEL, 1).strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    }
    if (this.checking) {
      for (const p of this.problems) {
        g.lineStyle(5, p.level === 'error' ? 0xff3b3b : 0xffb020, 1).strokeCircle(p.x, p.y, 36);
      }
    }
  }

  // ---- View ----------------------------------------------------------------------------

  fitView() {
    const cam = this.cameras.main;
    const z = Math.min(VIEW.w / this.terrain.width, VIEW.h / this.terrain.height, 1);
    cam.setZoom(Math.max(ZOOM.min, z));
    cam.centerOn(this.terrain.width / 2, this.terrain.height / 2);
  }

  /** Screen point → world point (the camera zooms around its center). */
  toWorld(px, py) {
    const cam = this.cameras.main;
    return {
      x: cam.scrollX + cam.width / 2 + (px - cam.x - cam.width / 2) / cam.zoom,
      y: cam.scrollY + cam.height / 2 + (py - cam.y - cam.height / 2) / cam.zoom,
    };
  }

  zoomAt(px, py, zoom) {
    const cam = this.cameras.main;
    const z = Phaser.Math.Clamp(zoom, ZOOM.min, ZOOM.max);
    const before = this.toWorld(px, py);
    cam.setZoom(z);
    cam.scrollX = before.x - cam.width / 2 - (px - cam.x - cam.width / 2) / z;
    cam.scrollY = before.y - cam.height / 2 - (py - cam.y - cam.height / 2) / z;
  }

  inView(p) {
    return p.y >= VIEW.y && p.y < VIEW.y + VIEW.h;
  }

  // ---- Input ---------------------------------------------------------------------------

  /** Both touch points, when two fingers are down. */
  pinchPointers() {
    const ps = [this.input.pointer1, this.input.pointer2].filter((p) => p?.isDown);
    return ps.length === 2 ? ps : null;
  }

  onDown(p, over) {
    if (over.length || !this.inView(p)) return;
    const pinch = this.pinchPointers();
    if (pinch) {
      // A second finger: finish whatever the first one was doing and pinch.
      this.endGesture();
      const [a, b] = pinch;
      this.pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.cameras.main.zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }
    const w = this.toWorld(p.x, p.y);
    const panButton = p.rightButtonDown?.() || p.middleButtonDown?.();
    const pan = { kind: 'pan', x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
    if (this.tab === 'VIEW' || panButton) {
      this.drag = pan;
    } else if (this.tab === 'PAINT') {
      this.snapshot();
      this.stroke = { last: this.cornerAt(w) };
      this.paintAt(this.stroke.last);
    } else if (this.tab === 'SELECT' || this.tab === 'ADD') {
      const hit = this.hitTest(w);
      this.select(hit);
      this.drag = hit ? { kind: 'move', w, ox: hit.ref.x, oy: hit.ref.y, moved: false } : pan;
    }
  }

  onMove(p) {
    const pinch = this.pinchPointers();
    if (pinch && this.pinch) {
      const [a, b] = pinch;
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.zoomAt(mid.x, mid.y, this.pinch.zoom * (dist / this.pinch.dist));
      const cam = this.cameras.main;
      cam.scrollX -= (mid.x - this.pinch.mid.x) / cam.zoom;
      cam.scrollY -= (mid.y - this.pinch.mid.y) / cam.zoom;
      this.pinch.mid = mid;
      return;
    }
    const w = this.toWorld(p.x, p.y);
    this.drawCursor(w);
    if (!p.isDown) return;
    if (this.stroke) {
      const c = this.cornerAt(w);
      // Fill the gap from the last corner, so a fast stroke doesn't skip.
      const { last } = this.stroke;
      const steps = Math.max(Math.abs(c.i - last.i), Math.abs(c.j - last.j));
      for (let k = 1; k <= steps; k++) {
        this.paintAt({ i: Math.round(last.i + ((c.i - last.i) * k) / steps), j: Math.round(last.j + ((c.j - last.j) * k) / steps) });
      }
      this.stroke.last = c;
    } else if (this.drag?.kind === 'pan') {
      const cam = this.cameras.main;
      cam.scrollX = this.drag.sx - (p.x - this.drag.x) / cam.zoom;
      cam.scrollY = this.drag.sy - (p.y - this.drag.y) / cam.zoom;
    } else if (this.drag?.kind === 'move') {
      const t = this.selectedThing();
      if (!t) return;
      if (!this.drag.moved) {
        this.snapshot();
        this.drag.moved = true;
      }
      // Whole art pixels (2 px), so sprites stay on the grid.
      t.ref.x = Math.round((this.drag.ox + w.x - this.drag.w.x) / 2) * 2;
      t.ref.y = Math.round((this.drag.oy + w.y - this.drag.w.y) / 2) * 2;
      this.drawObjects();
      if (t.kind === 'bridge') this.ground.setBridges(this.layout.bridges);
      this.refreshInfo();
    }
  }

  onUp() {
    if (this.pinchPointers()) return;
    this.pinch = null;
    this.endGesture();
  }

  /** Commit a paint stroke or a move (a drag that was cut short by a second finger, too). */
  endGesture() {
    this.endStroke();
    if (this.drag?.kind === 'move' && this.drag.moved) this.changed();
    this.drag = null;
  }

  endStroke() {
    if (!this.stroke) return;
    this.stroke = null;
    this.layout.terrain = this.terrain.toRows();
    this.changed();
  }

  onKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') return e.shiftKey ? this.redo() : this.undo();
    if (mod && e.key.toLowerCase() === 'y') return this.redo();
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) return this.deleteSelected();
    const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    const t = this.selectedThing();
    if (nudge && t) {
      e.preventDefault?.();
      const step = e.shiftKey ? this.terrain.cell : 2;
      this.edit(() => {
        t.ref.x += nudge[0] * step;
        t.ref.y += nudge[1] * step;
      });
    }
  }

  /** The topmost thing under a world point. */
  hitTest(w) {
    const hits = this.things().filter(({ bounds: b }) => w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h);
    // Characters, props and ropes first, the front-most (lowest feet) on top; then exits, then boardwalks.
    const rank = (h) => (h.kind === 'bridge' ? 2 : h.kind === 'exit' ? 1 : 0);
    hits.sort((a, b) => rank(a) - rank(b) || b.ref.y - a.ref.y);
    return hits[0] ?? null;
  }

  select(hit) {
    this.selected = hit ? { kind: hit.kind, index: hit.index } : null;
    this.drawSelection();
    if (this.tab === 'ADD' && hit) return this.showTab('SELECT');
    if (this.tab === 'SELECT') this.showTab('SELECT');
  }

  // ---- Painting ------------------------------------------------------------------------

  cornerAt(w) {
    return { i: Math.round(w.x / this.terrain.cell), j: Math.round(w.y / this.terrain.cell) };
  }

  paintAt({ i, j }) {
    const box = this.terrain.paint(i, j, this.brush, this.paintWith);
    if (box) this.ground.redrawCells(box);
  }

  drawCursor(w) {
    const g = this.cursor.clear().setDepth(3e6);
    if (this.tab !== 'PAINT') return;
    const { i, j } = this.cornerAt(w);
    const cell = this.terrain.cell;
    const color = hex(this.terrain.tileset.terrains[this.paintWith].color);
    g.lineStyle(3, 0xffffff, 0.9).strokeCircle(i * cell, j * cell, Math.max(8, (this.brush - 0.5) * cell));
    g.fillStyle(color, 0.5).fillCircle(i * cell, j * cell, 8);
  }

  // ---- Undo, drafts ---------------------------------------------------------------------

  snapshot() {
    this.undoStack.push(JSON.stringify(this.layout));
    if (this.undoStack.length > UNDO_MAX) this.undoStack.shift();
    this.redoStack = [];
  }

  restore(json) {
    const terrainBefore = this.layout.terrain.length + ':' + this.layout.cols;
    this.layout = JSON.parse(json);
    const sel = this.selectedThing();
    if (!sel) this.selected = null;
    if (terrainBefore !== `${this.layout.terrain.length}:${this.layout.cols}`) {
      this.loadTerrain();
    } else {
      this.terrain.grid = this.layout.terrain.map((r) => [...r]);
      this.ground.setBridges(this.layout.bridges);
    }
    this.changed(true);
  }

  undo() {
    if (!this.undoStack.length) return this.toast('Nothing to undo.');
    this.redoStack.push(JSON.stringify(this.layout));
    this.restore(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return this.toast('Nothing to redo.');
    this.undoStack.push(JSON.stringify(this.layout));
    this.restore(this.redoStack.pop());
  }

  /** After any edit: autosave the draft, redraw, recheck. */
  changed(redraw = false) {
    writeDraft(this.mapId, this.layout);
    if (redraw) this.drawObjects();
    this.refreshStatus();
    this.refreshInfo();
    if (this.checking) this.runCheck();
  }

  get dirty() {
    return JSON.stringify(this.layout) !== JSON.stringify(this.saved);
  }

  // ---- Checks --------------------------------------------------------------------------

  toggleCheck() {
    this.checking = !this.checking;
    if (this.checking) this.runCheck();
    else {
      this.overlay?.destroy();
      this.overlay = null;
      this.problems = [];
      this.drawSelection();
      this.refreshStatus();
      this.problemList?.destroy();
    }
  }

  /** Run the map checks and shade the walk grid: green = walkable from the start, gold = behind a rope, red = cut off. */
  runCheck() {
    const map = this.map;
    const result = checkMap(map, this.terrain);
    this.problems = result.problems;
    const { open, closed, grid } = result;
    const key = `editor_check_${this.mapId}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, grid.cols, grid.rows);
    const ctx = tex.getContext();
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const i = r * grid.cols + c;
        if (!grid.isOpen(c, r)) continue;
        ctx.fillStyle = closed[i] ? 'rgba(124,242,156,0.22)' : open[i] ? 'rgba(255,209,102,0.45)' : 'rgba(255,59,59,0.5)';
        ctx.fillRect(c, r, 1, 1);
      }
    }
    tex.refresh();
    this.overlay?.destroy();
    this.overlay = this.add.image(0, 0, key).setOrigin(0).setScale(grid.cell).setDepth(1.5e6);
    this.world.add(this.overlay);
    this.drawSelection();
    this.refreshStatus();
    this.showProblems();
  }

  /** The first few problems, under the top bar; tap one to look at it. */
  showProblems() {
    this.problemList?.destroy();
    if (!this.checking) return;
    const c = this.add.container(0, TOP);
    this.ui.add(c);
    this.problemList = c;
    const list = this.problems.length ? this.problems.slice(0, 4) : [{ level: 'ok', msg: 'No problems. Green: walkable. Gold: behind a rope. Red: cut off.' }];
    list.forEach((p, k) => {
      const y = k * 38;
      c.add(this.add.rectangle(0, y, GAME_W, 36, 0x05030a, 0.82).setOrigin(0));
      const color = p.level === 'error' ? '#ff6b6b' : p.level === 'warn' ? '#ffb020' : '#7cf29c';
      const t = fitWidth(body(this, 16, y + 4, `${p.level === 'ok' ? '' : p.level === 'error' ? 'ERROR  ' : 'WARN  '}${p.msg}`, 26, { color }), GAME_W - 32);
      c.add(t);
      if (p.x !== undefined) {
        const zone = this.add.zone(0, y, GAME_W, 36).setOrigin(0).setInteractive().on('pointerup', () => this.cameras.main.centerOn(p.x, p.y));
        c.add(zone);
      }
    });
    if (this.problems.length > 4) c.add(body(this, GAME_W - 16, 4 * 38 + 2, `+${this.problems.length - 4} more`, 24, { color: COLORS.textDim }).setOrigin(1, 0));
  }

  // ---- Top bar --------------------------------------------------------------------------

  buildTop() {
    this.ui.add(this.add.rectangle(0, 0, GAME_W, TOP, BAR, 1).setOrigin(0));
    const region = regionById(this.mapId);
    this.ui.add(label(this, 16, 16, 'MAP EDITOR', 16, { color: '#9fdcff' }));
    this.ui.add(fitWidth(label(this, 16, 42, (region?.name ?? this.mapId).toUpperCase(), 14), 300));
    this.statusText = body(this, 16, 66, '', 26, { color: COLORS.textDim });
    this.ui.add(this.statusText);
    this.button(400, 56, 92, 70, 'UNDO', () => this.undo(), { size: 13 });
    this.button(500, 56, 92, 70, 'REDO', () => this.redo(), { size: 13 });
    this.checkButton = this.button(626, 56, 140, 70, 'CHECK', () => this.toggleCheck(), { size: 14, accent: ACCENT });
    this.refreshStatus();
  }

  refreshStatus() {
    const errors = this.problems.filter((p) => p.level === 'error').length;
    const warns = this.problems.length - errors;
    this.statusText?.setText(`${this.terrain.cols}×${this.terrain.rows} CELLS · ${this.dirty ? 'DRAFT (unsaved)' : 'SAVED'}`);
    this.checkButton?.setText(this.checking ? (errors ? `${errors} ERR` : warns ? `${warns} WARN` : 'ALL OK') : 'CHECK');
  }

  toast(text) {
    this.toastText?.destroy();
    this.toastText = label(this, GAME_W / 2, BOTTOM - 20, text, 14, { color: '#ffd166', backgroundColor: '#05030a', padding: { x: 10, y: 8 }, align: 'center', wordWrap: { width: 660 } })
      .setOrigin(0.5, 1);
    this.ui.add(this.toastText);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(3200, () => this.toastText?.destroy());
  }

  // ---- The tool panel ---------------------------------------------------------------------

  /** A ribbon button in the UI layer. Returns it. */
  button(x, y, w, h, text, onPress, { size = 13, accent = null, parent = null } = {}) {
    const b = new Button(this, { x, y, w, h, text, size, accent, onPress, depth: 20 });
    (parent ?? this.ui).add(b.container);
    return b;
  }

  buildTabs() {
    const w = GAME_W / TABS.length;
    this.tabButtons = TABS.map((t, i) => this.button(w * i + w / 2, BOTTOM + 34, w - 8, 56, t, () => this.showTab(t), { size: 13 }));
  }

  showTab(tab) {
    this.tab = tab;
    this.cursor.clear();
    this.tabButtons.forEach((b, i) => b.setAccent(TABS[i] === tab ? SEL : null, TABS[i] === tab ? '#ffd166' : COLORS.text));
    for (const b of [...this.buttons]) if (b.container.parentContainer === this.panel) b.destroy();
    this.panel.removeAll(true);
    this.info = null;
    ({ VIEW: () => this.viewPanel(), PAINT: () => this.paintPanel(), SELECT: () => this.selectPanel(), ADD: () => this.addPanel(), MAP: () => this.mapPanel() })[tab]();
  }

  panelText(y, text, size = 26) {
    const t = body(this, 20, y, text, size, { color: COLORS.textDim, wordWrap: { width: GAME_W - 40 } });
    this.panel.add(t);
    return t;
  }

  /** A row of buttons across the panel at y. items: [text, onPress, opts]. */
  row(y, items, h = 76) {
    const gap = 8;
    const w = (GAME_W - 16 - gap * (items.length - 1)) / items.length;
    return items.map(([text, fn, opts = {}], i) => this.button(8 + w / 2 + i * (w + gap), y, w, h, text, fn, { ...opts, parent: this.panel }));
  }

  viewPanel() {
    this.panelText(BOTTOM + 76, 'Drag to look around. Pinch or scroll to zoom.\nRight-drag pans in every tool.');
    this.row(BOTTOM + 220, [['FIT', () => this.fitView()], ['ZOOM 1:1', () => this.cameras.main.setZoom(1)], ['ZOOM IN', () => this.zoomAt(GAME_W / 2, VIEW.y + VIEW.h / 2, this.cameras.main.zoom * 1.25)], ['ZOOM OUT', () => this.zoomAt(GAME_W / 2, VIEW.y + VIEW.h / 2, this.cameras.main.zoom / 1.25)]]);
  }

  paintPanel() {
    const terrains = Object.entries(this.terrain.tileset.terrains);
    const ys = BOTTOM + 128;
    const gap = 8;
    const w = (GAME_W - 16 - gap * (terrains.length - 1)) / terrains.length;
    terrains.forEach(([code, t], i) => {
      const x = 8 + i * (w + gap);
      const on = code === this.paintWith;
      const color = hex(t.color);
      const g = this.add.graphics();
      g.fillStyle(color, 1).fillRoundedRect(x, ys - 40, w, 80, 12);
      g.lineStyle(on ? 6 : 2, on ? SEL : 0x000000, 1).strokeRoundedRect(x, ys - 40, w, 80, 12);
      this.panel.add(g);
      this.panel.add(label(this, x + w / 2, ys, t.label ?? t.name, 14, { color: '#ffffff', align: 'center', wordWrap: { width: w - 8 } }).setOrigin(0.5));
      const zone = this.add.zone(x, ys - 40, w, 80).setOrigin(0).setInteractive().on('pointerup', () => {
        Audio.sfx('blip');
        this.paintWith = code;
        this.showTab('PAINT');
      });
      this.panel.add(zone);
    });
    this.row(BOTTOM + 226, BRUSHES.map((b) => [`BRUSH ${b}`, () => {
      this.brush = b;
      this.showTab('PAINT');
    }, { accent: b === this.brush ? SEL : null }]), 64);
  }

  selectPanel() {
    const t = this.selectedThing();
    this.info = this.panelText(BOTTOM + 70, '');
    this.refreshInfo();
    if (!t) return;
    const r = t.ref;
    const rows = [];
    const del = ['DELETE', () => this.deleteSelected(), { accent: 0xff5c5c }];
    const dup = ['COPY', () => this.duplicateSelected()];
    if (t.kind === 'prop') {
      const placeable = PROP_IMAGES.filter((p) => p.place !== false);
      const swap = (d) => this.edit(() => {
        const next = cycle(placeable, placeable.find((p) => p.key === r.texture), d);
        r.texture = next.key;
        if (next.block) r.block = { ...next.block };
        else delete r.block;
        if (next.label && !r.label) r.label = next.label;
        if (!next.label) delete r.label;
      });
      rows.push([['◀ PROP', () => swap(-1)], ['PROP ▶', () => swap(1)], ...(r.label !== undefined ? [['LABEL', () => this.ask('Sign label', r.label, (v) => this.edit(() => { r.label = v.toUpperCase().slice(0, 12); }))]] : [])]);
      rows.push([dup, del]);
    } else if (t.kind === 'npc') {
      const sheets = FIELD_SHEETS.map((s) => s.key);
      rows.push([
        ['LOOK ▶', () => this.edit(() => { r.sprite = cycle(sheets, r.sprite); })],
        ['FACE ▶', () => this.edit(() => { r.facing = cycle(FACINGS, r.facing); })],
        ['RENAME', () => this.ask('NPC id (their lines are keyed by it)', r.id, (v) => this.renameNpc(r, v))],
      ]);
      rows.push([dup, del]);
    } else if (t.kind === 'gate') {
      const ids = this.layout.npcs.map((n) => n.id);
      rows.push([
        ['BOUNCER ▶', () => this.edit(() => { r.bouncer = ids.length ? cycle(ids, r.bouncer) : undefined; })],
        ['WIDER', () => this.edit(() => { r.block.w += 16; })],
        ['NARROWER', () => this.edit(() => { r.block.w = Math.max(48, r.block.w - 16); })],
        ['RENAME', () => this.ask('Rope id (its price and lines are keyed by it)', r.id, (v) => this.renameGate(r, v))],
      ]);
      rows.push([dup, del]);
    } else if (t.kind === 'bridge' || t.kind === 'exit') {
      const c = this.terrain.cell;
      rows.push([
        ['W−', () => this.edit(() => { r.w = Math.max(32, r.w - c / 2); })], ['W+', () => this.edit(() => { r.w += c / 2; })],
        ['H−', () => this.edit(() => { r.h = Math.max(32, r.h - c / 2); })], ['H+', () => this.edit(() => { r.h += c / 2; })],
      ]);
      if (t.kind === 'exit') {
        // Where it leads: the overworld, or a door into another map of this region.
        const region = CONTENT[this.mapId]?.region ?? this.mapId;
        const dests = ['map', ...Object.keys(LAYOUTS).filter((id) => id !== this.mapId && (CONTENT[id]?.region ?? id) === region)];
        rows.push([['LEADS TO ▶', () => this.edit(() => { r.to = cycle(dests, r.to); })], dup, del]);
      } else {
        // A boardwalk can be stairs instead: steps up a cliff to high ground.
        const stairs = r.kind === 'stairs';
        rows.push([[stairs ? 'MAKE BOARDWALK' : 'MAKE STAIRS', () => this.edit(() => {
          if (stairs) delete r.kind;
          else r.kind = 'stairs';
        })], dup, del]);
      }
    } else if (t.kind === 'spawn') {
      rows.push([['FACE ▶', () => this.edit(() => { r.facing = cycle(FACINGS, r.facing); })]]);
    }
    rows.forEach((items, k) => this.row(BOTTOM + 152 + k * 84, items, 72));
  }

  refreshInfo() {
    if (!this.info) return;
    const t = this.selectedThing();
    if (!t) return this.info.setText('Tap something on the map to pick it. Drag to move it.\nArrow keys nudge (shift: a whole cell).');
    const r = t.ref;
    const what = {
      prop: () => `${r.texture.replace('prop_', '').toUpperCase()}${r.label ? ` "${r.label}"` : ''}`,
      npc: () => `NPC ${r.id} (${r.sprite.replace('field_', '')}, faces ${r.facing})${CONTENT[this.mapId]?.npcs?.[r.id] ? '' : ' · no lines yet'}`,
      gate: () => `ROPE ${r.id} · bouncer ${r.bouncer ?? 'none'} · ${CONTENT[this.mapId]?.gates?.[r.id]?.clout ?? '?'} Clout`,
      bridge: () => `${r.kind === 'stairs' ? 'STAIRS' : 'BOARDWALK'} ${r.w}×${r.h}`,
      exit: () => `EXIT to ${r.to} ${r.w}×${r.h}`,
      spawn: () => `$COTT STARTS HERE (faces ${r.facing})`,
    }[t.kind]();
    this.info.setText(`${what} at ${Math.round(r.x)}, ${Math.round(r.y)}`);
  }

  /** NPCs, ropes, boardwalks and exits always on top; the props below, a page at a time (there are more than fit). */
  addPanel() {
    this.panelText(BOTTOM + 70, 'Tap to drop one in the middle of the view.', 24);
    const other = [['NPC', () => this.addThing('npc')], ['ROPE', () => this.addThing('gate')], ['BOARDWALK', () => this.addThing('bridge')], ['EXIT', () => this.addThing('exit')]];
    const props = PROP_IMAGES.filter((p) => p.place !== false).map((p) => [p.name, () => this.addThing('prop', p)]);
    const perPage = 6;
    const pages = Math.ceil(props.length / perPage);
    this.addPage = Math.min(this.addPage ?? 0, pages - 1);
    const page = props.slice(this.addPage * perPage, this.addPage * perPage + perPage);
    const turn = (d) => () => {
      this.addPage = (this.addPage + d + pages) % pages;
      this.showTab('ADD');
    };
    const small = (items) => items.map(([t, f, o = {}]) => [t, f, { size: 11, ...o }]);
    this.row(BOTTOM + 132, small(other), 44);
    this.row(BOTTOM + 182, small(page.slice(0, 4)), 44);
    this.row(BOTTOM + 232, small([['◀ PROPS', turn(-1), { accent: SEL }], ...page.slice(4), [`PROPS ▶ ${this.addPage + 1}/${pages}`, turn(1), { accent: SEL }]]), 44);
  }

  mapPanel() {
    const c = GROW;
    this.row(BOTTOM + 96, [
      ['+ LEFT', () => this.grow({ left: c })], ['+ RIGHT', () => this.grow({ right: c })],
      ['+ TOP', () => this.grow({ top: c })], ['+ BOTTOM', () => this.grow({ bottom: c })],
    ], 64);
    this.row(BOTTOM + 166, [
      ['− LEFT', () => this.grow({ left: -c })], ['− RIGHT', () => this.grow({ right: -c })],
      ['− TOP', () => this.grow({ top: -c })], ['− BOTTOM', () => this.grow({ bottom: -c })],
    ], 64);
    this.row(BOTTOM + 238, [
      ['PLAYTEST', () => this.playtest(), { accent: 0x7cf29c }], ['EXPORT', () => this.exportLayout(), { accent: SEL }],
      ['IMPORT', () => this.importLayout()], ['REVERT', () => this.revert(), { accent: 0xff5c5c }],
    ], 64);
  }

  // ---- Edits ------------------------------------------------------------------------------

  /** Apply one change to the layout as a single undo step (then show SELECT, if it's up or `toSelect`). */
  edit(fn, toSelect = false) {
    this.snapshot();
    fn();
    this.ground.setBridges(this.layout.bridges);
    this.changed(true);
    if (toSelect || this.tab === 'SELECT') this.showTab('SELECT');
  }

  ask(question, current, then) {
    const v = globalThis.prompt?.(question, current ?? '');
    if (v === null || v === undefined) return;
    const clean = String(v).trim();
    if (clean) then(clean);
  }

  renameNpc(npc, id) {
    const clean = cleanId(id);
    if (!clean) return;
    if (this.layout.npcs.some((n) => n !== npc && n.id === clean)) return this.toast(`There's already an NPC called ${clean}.`);
    this.edit(() => {
      for (const g of this.layout.gates) if (g.bouncer === npc.id) g.bouncer = clean;
      npc.id = clean;
    });
  }

  renameGate(gate, id) {
    const clean = cleanId(id);
    if (!clean) return;
    if (this.layout.gates.some((g) => g !== gate && g.id === clean)) return this.toast(`There's already a rope called ${clean}.`);
    this.edit(() => { gate.id = clean; });
  }

  uniqueId(prefix, list) {
    for (let k = 1; ; k++) if (!list.some((o) => o.id === `${prefix}${k}`)) return `${prefix}${k}`;
  }

  addThing(kind, prop = null) {
    const cam = this.cameras.main;
    const at = { x: Math.round(cam.midPoint.x / 2) * 2, y: Math.round(cam.midPoint.y / 2) * 2 };
    const L = this.layout;
    const made = {
      // A prop you walk over or into (floor clutter, the cellar door) has no footprint.
      prop: () => ({ texture: prop.key, ...at, ...(prop.block ? { block: { ...prop.block } } : {}), ...(prop.label ? { label: prop.label } : {}) }),
      npc: () => ({ id: this.uniqueId('npc', L.npcs), sprite: FIELD_SHEETS[1]?.key ?? 'field_scott', ...at, facing: 'down' }),
      gate: () => ({ id: this.uniqueId('rope', L.gates), ...at, block: { w: 150, h: 50 }, bouncer: L.npcs[0]?.id }),
      bridge: () => ({ x: at.x - 48, y: at.y - 96, w: 96, h: 192 }),
      exit: () => ({ to: 'map', x: at.x - 70, y: at.y - 20, w: 140, h: 40 }),
    }[kind];
    if (!made) return;
    this.edit(() => {
      const list = L[LISTS[kind]];
      list.push(made());
      this.selected = { kind, index: list.length - 1 };
    }, true);
  }

  deleteSelected() {
    const t = this.selectedThing();
    if (!t || t.kind === 'spawn') return;
    this.edit(() => {
      this.layout[LISTS[t.kind]].splice(t.index, 1);
      this.selected = null;
    }, true);
  }

  duplicateSelected() {
    const t = this.selectedThing();
    if (!t || t.kind === 'spawn') return;
    this.edit(() => {
      const list = this.layout[LISTS[t.kind]];
      const copy = { ...cloneLayout(t.ref), x: t.ref.x + 48, y: t.ref.y + 16 };
      if (t.kind === 'npc') copy.id = this.uniqueId('npc', this.layout.npcs);
      if (t.kind === 'gate') copy.id = this.uniqueId('rope', this.layout.gates);
      list.push(copy);
      this.selected = { kind: t.kind, index: list.length - 1 };
    }, true);
  }

  /** Grow (or shrink) the map by whole cells; everything shifts with a left or top change. */
  grow(sides) {
    // The layout is untouched until it's known to fit, so a refusal costs no undo (or redo) history.
    const shift = this.terrain.resize(sides);
    if (!shift) return this.toast('The map can\'t get that small.');
    this.snapshot();
    const L = this.layout;
    L.terrain = this.terrain.toRows();
    L.cols = this.terrain.cols;
    for (const o of [...L.props, ...L.npcs, ...L.gates, ...L.bridges, ...L.exits, L.spawn]) {
      o.x += shift.dx;
      o.y += shift.dy;
    }
    this.loadTerrain();
    this.changed(true);
    this.cameras.main.scrollX += shift.dx;
    this.cameras.main.scrollY += shift.dy;
  }

  // ---- Playtest, export, import, revert ----------------------------------------------------

  playtest() {
    writeDraft(this.mapId, this.layout);
    const map = this.map;
    const errors = checkMap(map, this.terrain).problems.filter((p) => p.level === 'error');
    if (errors.length) this.toast(`Heads up: ${errors.length} error${errors.length > 1 ? 's' : ''} (CHECK lists them).`);
    this.scene.start('Region', { region: this.mapId, map, playtest: true });
  }

  exportLayout() {
    const src = layoutToSource(this.layout);
    const name = `${this.mapId}.layout.js`;
    try {
      const blob = new Blob([src], { type: 'text/javascript' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      // no downloads here: the clipboard copy below still works
    }
    globalThis.navigator?.clipboard?.writeText(src).catch(() => {});
    this.lastExport = src;
    this.toast(`Downloaded ${name} (and copied it).\nSend it to Claude, or upload it to src/data/maps/ on GitHub.`);
  }

  importLayout() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js,text/javascript';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const mod = await import(`data:text/javascript,${encodeURIComponent(text)}`);
        const layout = mod.default;
        if (!layout?.terrain || !layout.cols) throw new Error('not a layout file');
        // Another map's file would load into the wrong tileset and save under this map's name.
        if (layout.id !== this.mapId) throw new Error(`that's ${layout.id}'s layout, not ${this.mapId}'s`);
        if (layout.tileset !== this.layout.tileset && !tilesetOf(this, layout.tileset)) throw new Error(`the ${layout.tileset} tileset isn't loaded`);
        this.snapshot();
        this.layout = cloneLayout(layout);
        this.loadTerrain();
        this.selected = null;
        this.changed(true);
        this.fitView();
        this.toast(`Imported ${file.name}.`);
      } catch (e) {
        this.toast(`Couldn't read that file: ${e.message}`);
      }
    };
    input.click();
  }

  revert() {
    if (!this.dirty) return this.toast('Nothing to revert: this is the saved map.');
    if (!this.revertArmed) {
      this.revertArmed = true;
      this.time.delayedCall(2500, () => {
        this.revertArmed = false;
      });
      return this.toast('Tap REVERT again to throw away the draft.');
    }
    this.revertArmed = false;
    this.snapshot();
    this.layout = cloneLayout(this.saved);
    this.loadTerrain();
    this.selected = null;
    this.changed(true);
    writeDraft(this.mapId, null);
    this.toast('Back to the saved map. (UNDO brings the draft back.)');
  }

  /** Read by the debug hook / smoke test. Points are canvas coordinates. */
  debugState() {
    const cam = this.cameras.main;
    return {
      editor: {
        id: this.mapId, tab: this.tab, cols: this.terrain.cols, rows: this.terrain.rows, dirty: this.dirty,
        selected: this.selected, zoom: cam.zoom, problems: this.problems.map((p) => `${p.level}: ${p.msg}`),
        counts: { props: this.layout.props.length, npcs: this.layout.npcs.length, gates: this.layout.gates.length },
        terrain: this.layout.terrain,
        export: this.lastExport,
      },
    };
  }
}
