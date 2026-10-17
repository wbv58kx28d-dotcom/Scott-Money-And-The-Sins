// A walkable region (CLAUDE.md §6.6): $cott explores the region's map in a
// 3/4 top-down view, Chained Echoes style, and finds its villain.
//
// Phone controls: tap anywhere to walk there (he paths around water and
// props), hold and drag to steer, or use the joystick in the bottom-right
// corner. Tap an NPC to walk over and talk, or press the TALK button beside
// the joystick when someone's close (it lights up). The villain's talk ends
// with FIGHT / NOT YET. Minor characters can offer a challenge (a beat tap, a
// quiz, or a day trade); winning it reveals intel on the villain that shows in the fight
// (systems/intel.js). Walking into an exit leaves for the overworld map, or,
// if it's a door, into another of the region's maps (Derek's basement).
//
// Talking to someone can unlock one of $cott's classic posts for his social
// app (data/social.js), and a velvet rope (map `gates`) blocks a side area
// until he has the Clout; its bouncer lets him through, and it stays open.
//
// A recruited Sin can walk behind him on his own trail, Pikachu style
// (data/followers.js, systems/follower.js): Lil' Turnt, for now. Tap her (or
// press TALK with nobody else around) to hear what she thinks; she gets
// jealous when he talks to anyone else.
//
// World objects are depth-sorted by their feet (depth = y - WORLD_DEPTH), so
// everything in the world sits below the UI's ordinary depths. UI is created
// inside ui(), which pins it to the screen.

import { FIELD, LAYOUT, GAME_W, GAME_H } from '../config.js';
import { TIMING } from '../data/rules.js';
import { MAPS } from '../data/maps/index.js';
import { FIELD_SHEETS, PROP_IMAGES, FX_SHEETS } from '../data/assets.js';
import { regionById, TIER_NAMES } from '../data/regions.js';
import { ENEMIES } from '../data/enemies/index.js';
import { Save } from '../systems/save.js';
import { Audio } from '../systems/audio.js';
import { DEBUG } from '../systems/debug.js';
import { Terrain, hash } from '../systems/terrain.js';
import { buildRegionGrid } from '../systems/mapcheck.js';
import { present, secretSpots, secretKey, signal, heading } from '../systems/secrets.js';
import { revealLines } from '../systems/intel.js';
import { formatClout, fillIn } from '../systems/social.js';
import { money } from '../systems/market.js';
import { ITEMS } from '../data/items.js';
import { APPS } from '../data/phone.js';
import { FOLLOWERS } from '../data/followers.js';
import { Trail, facingOf, moodOf, followerLines } from '../systems/follower.js';
import { PhoneBadge } from '../ui/badge.js';
import { rng, createRng } from '../systems/rng.js';
import trade from '../minigames/trade.js';
import { bakeProps, bakeWalkerSheet, walkerAnims, facingFrame, SHEET_COLS } from '../systems/fieldArt.js';
import { TerrainView, preloadTileset, tilesetOf } from '../ui/terrainView.js';
import { TapBus } from '../ui/tapBus.js';
import { DialogBox } from '../ui/dialog.js';
import { Menu } from '../ui/menu.js';
import { Button } from '../ui/button.js';
import { TimingBar } from '../ui/timingBar.js';
import { Joystick } from '../ui/joystick.js';
import { InteractButton } from '../ui/interactButton.js';
import { emoteBubble } from '../ui/emote.js';
import { pixelText, pixelTextWidth, signLabel } from '../ui/pixelFont.js';
import { drawCard, drawRibbonPanel, RIBBON_GOLD, CARD_INSET } from '../ui/ribbon.js';
import { label, body, fitWidth, fitWrapped, snapCenter } from '../ui/text.js';

const WORLD_DEPTH = 100000;
const GOLD = 0xffd166;
const INTEL = 0x9fdcff; // challenges and the intel they reveal
const INTEL_CSS = '#9fdcff';
const SOCIAL_CSS = '#ff8ad8'; // social app news (unlocked posts, Clout)
// The quiz question's card, above the menu's prompt tag.
const QUESTION_CARD = { x: 16, y: 930, w: 688, h: 116 };
// The tap area around an NPC's body, and around the follower's (she's a kitten).
const NPC_HIT = { w: 100, h: 140 };
const FOLLOWER_HIT = { w: 90, h: 90 };
// How long an emote bubble stays up, and how far over the head it floats.
const EMOTE_MS = 1300;
const EMOTE_GAP = 6;

const worldDepth = (y) => y - WORLD_DEPTH;

export default class RegionScene extends Phaser.Scene {
  constructor() {
    super('Region');
  }

  /**
   * data: { region } to play a region from its own map; a door passes { mapId, from }
   * (the map to play and the one $cott came from); the map editor adds { map, playtest } to try a draft.
   */
  init(data) {
    this.map = data?.map ?? MAPS[data?.mapId] ?? MAPS[data?.region] ?? MAPS.start;
    this.region = regionById(this.map.region) ?? regionById(data?.region) ?? regionById('start');
    this.from = data?.from ?? null;
    this.playtest = !!data?.playtest;
  }

  // Real art loads when src/data/assets.js lists it; any walker or prop missing is baked in create().
  preload() {
    preloadTileset(this, this.map.tileset);
    for (const f of FX_SHEETS) if (!this.textures.exists(f.key)) this.load.spritesheet(f.key, f.path, { frameWidth: f.w, frameHeight: f.h });
    const { w, h } = FIELD.frame;
    for (const s of FIELD_SHEETS) if (s.path) this.load.spritesheet(s.key, s.path, { frameWidth: w, frameHeight: h });
    for (const p of PROP_IMAGES) if (p.path) this.load.image(p.key, p.path);
  }

  create() {
    this.buttons = new Set();
    this.mode = 'explore'; // explore | talk | leaving
    this.path = [];
    this.pendingNpc = null;
    this.dragging = false;
    this.lastAim = 0;
    this.emoting = null; // the scene restarts through doors: no bubble carries over
    this.pinning = false;
    const onAdded = (obj) => {
      if (this.pinning) obj.setScrollFactor?.(0);
    };
    this.sys.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    this.events.once('shutdown', () => this.sys.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded));

    this.buildWorld();
    this.buildUi();

    this.input.on('pointerdown', (p, over) => this.onPointerDown(p, over));
    this.input.on('pointermove', (p) => this.onPointerMove(p));
    this.input.on('pointerup', (p) => this.onPointerUp(p));
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  /** Run `fn`, pinning every object it creates to the screen. */
  ui(fn) {
    this.pinning = true;
    try {
      return fn();
    } finally {
      this.pinning = false;
    }
  }

  // ---- World -------------------------------------------------------------------

  buildWorld() {
    const { map } = this;
    bakeProps(this);
    for (const key of new Set(['field_scott', ...map.npcs.map((n) => n.sprite)])) {
      if (!this.textures.exists(key)) bakeWalkerSheet(this, key);
      walkerAnims(this, key);
    }

    // The ground, drawn from the layout's terrain grid (CLAUDE.md §6.11).
    this.terrain = new Terrain(map.layout.terrain, tilesetOf(this, map.tileset));
    this.ground = new TerrainView(this, this.terrain, { set: map.tileset, bridges: map.bridges, depth: -WORLD_DEPTH * 2, id: `region_${map.id}` });
    this.addBubbles();

    // Props tagged with a secret show once it's found; a `cover` shows until then (systems/secrets.js).
    this.secretProps = [];
    for (const p of map.props) {
      const img = this.add.image(p.x, p.y, p.texture).setOrigin(0.5, 1).setDepth(worldDepth(p.y));
      const tag = p.label ? signLabel(this, p, img).setDepth(worldDepth(p.y) + 0.5) : null;
      if (p.secret || p.cover) this.secretProps.push({ p, objs: [img, tag].filter(Boolean) });
    }
    this.found = new Set(Object.keys(map.secrets ?? {}).filter((id) => Save.isFound(secretKey(this.region.id, id))));
    this.showSecrets();

    const cleared = Save.cleared.has(this.region.id);
    this.npcs = map.npcs.map((n) => {
      const sprite = this.add.sprite(n.x, n.y, n.sprite).setOrigin(0.5, 1).setDepth(worldDepth(n.y));
      this.face(sprite, n.facing);
      // A bouncing "!" over a villain you haven't beaten, "?" over a challenge you haven't won.
      const mark = n.fight && !cleared ? ['!', '#ffd166'] : n.challenge && !Save.hasWon(this.challengeId(n)) ? ['?', INTEL_CSS] : null;
      let alert = null;
      if (mark) {
        alert = label(this, 0, 0, mark[0], 28, { color: mark[1], strokeThickness: 8 }).setDepth(-1);
        snapCenter(alert, n.x, n.y - FIELD.frame.h - 6 - alert.height / 2);
        this.tweens.add({ targets: alert, y: alert.y - 10, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      return { ...n, sprite, alert };
    });

    // Velvet ropes, each with its Clout price lettered above it.
    this.gates = (map.gates ?? []).map((g) => {
      const open = Save.gateOpen(this.gateId(g));
      const rope = this.add.image(g.x, g.y, open ? 'prop_rope_open' : 'prop_rope').setOrigin(0.5, 1).setDepth(worldDepth(g.y));
      const text = `${formatClout(g.clout)} CLOUT`;
      const sign = pixelText(this, Math.round(g.x - pixelTextWidth(text, 2) / 2), Math.round(g.y - rope.height - 22), text, { px: 2, color: '#ffd166' })
        .setDepth(worldDepth(g.y) + 0.5).setVisible(!open);
      return { ...g, open, rope, sign };
    });
    this.buildGrid();

    const spawn = this.arrival() ?? map.spawn;
    this.player = this.add.sprite(spawn.x, spawn.y, 'field_scott').setOrigin(0.5, 1).setDepth(worldDepth(spawn.y));
    this.facing = spawn.facing;
    this.face(this.player, this.facing);

    this.tapMark = this.add.ellipse(0, 0, 36, 16).setStrokeStyle(3, 0xffffff, 0.9).setDepth(-WORLD_DEPTH * 2 + 1).setVisible(false);

    const cam = this.cameras.main;
    // A room smaller than the screen (Derek's basement) sits centered in the dark around it.
    const bw = Math.max(map.size.w, GAME_W);
    const bh = Math.max(map.size.h, GAME_H);
    cam.setBounds((map.size.w - bw) / 2, (map.size.h - bh) / 2, bw, bh);
    cam.startFollow(this.player, true, FIELD.cameraLerp, FIELD.cameraLerp);
    cam.setFollowOffset(0, FIELD.frame.h / 2);

    this.follower = null;
    this.syncFollower();
  }

  /**
   * Toxic bubbles (the tileset's `bubbles`): a few solid cells of that terrain
   * each play fx_bubble's rise-and-pop on their own random beat, just above the ground.
   */
  addBubbles() {
    const spec = this.terrain.tileset.bubbles;
    if (!spec || !this.textures.exists('fx_bubble')) return;
    if (!this.anims.exists('fx_bubble_pop')) {
      this.anims.create({ key: 'fx_bubble_pop', frames: this.anims.generateFrameNumbers('fx_bubble'), frameRate: 8 });
    }
    const rand = createRng(7).random; // its own stream, so bubbles never shift gameplay rolls
    const { cols, rows, cell } = this.terrain;
    const solid = spec.on.repeat(4);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (this.terrain.key(i, j) !== solid || hash(i, j, 40) >= spec.density) continue;
        const x = i * cell + 6 + Math.floor(hash(i, j, 41) * (cell - 12) / 2) * 2;
        const y = j * cell + cell - 4;
        const bubble = this.add.sprite(x, y, 'fx_bubble', 0).setOrigin(0.5, 1).setDepth(-WORLD_DEPTH * 2 + 1).setVisible(false);
        const pop = () => {
          bubble.setVisible(true).play('fx_bubble_pop');
          bubble.once('animationcomplete', () => {
            bubble.setVisible(false);
            this.time.delayedCall(spec.gapMs[0] + rand() * (spec.gapMs[1] - spec.gapMs[0]), pop);
          });
        };
        this.time.delayedCall(rand() * spec.gapMs[1], pop);
      }
    }
  }

  /**
   * Where $cott stands after coming through a door: just outside the door on
   * this map that leads back, on its `arrive` side (down, up, left, right), or
   * else the side toward the middle of the map, facing away from the door.
   */
  arrival() {
    const door = this.from && this.map.exits.find((e) => e.to === this.from);
    if (!door) return null;
    const gap = 44;
    const cx = door.x + door.w / 2;
    const cy = door.y + door.h / 2;
    const dx = this.map.size.w / 2 - cx;
    const dy = this.map.size.h / 2 - cy;
    const side = door.arrive ?? (Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : dx > 0 ? 'right' : 'left');
    const at = {
      down: { x: cx, y: door.y + door.h + gap },
      up: { x: cx, y: door.y - gap },
      right: { x: door.x + door.w + gap, y: cy },
      left: { x: door.x - gap, y: cy },
    }[side];
    at.facing = side;
    // Props or water in the way: the nearest spot he can stand on.
    if (!this.grid.walkableAt(at.x, at.y)) {
      const c = this.grid.nearestOpen(at.x, at.y, 6);
      if (c) Object.assign(at, this.grid.center(c[0], c[1]));
    }
    return { ...at, x: Math.round(at.x), y: Math.round(at.y) };
  }

  /** The walk grid (systems/mapcheck.js), with the ropes that are still up. Rebuilt when one opens. */
  buildGrid() {
    this.grid = buildRegionGrid(this.map, this.terrain, { isClosed: (g) => !this.gates.find((o) => o.id === g.id)?.open });
  }

  gateId(gate) {
    return `${this.region.id}:${gate.id}`;
  }

  /** Show a walker's idle frame for a facing (right mirrors left). */
  face(sprite, facing) {
    const { row, flip } = facingFrame(facing);
    sprite.anims.stop();
    sprite.setFrame(row * SHEET_COLS).setFlipX(flip);
  }

  // ---- UI ----------------------------------------------------------------------------

  buildUi() {
    this.ui(() => {
      const c = FIELD.card;
      drawCard(this.add.graphics(), c, RIBBON_GOLD);
      fitWidth(label(this, c.x + CARD_INSET, c.y + 16, (this.map.name ?? this.region.name).toUpperCase(), 18, { color: '#ffd166' }), c.w - CARD_INSET - 12);
      // The villain may be behind a door (Derek's in his basement), so name them from the region.
      const fighter = this.npcs.find((n) => n.fight)?.fight ?? this.region.villain;
      const sub = ENEMIES[fighter] ? `${TIER_NAMES[this.region.tier]} · find ${ENEMIES[fighter].name}` : TIER_NAMES[this.region.tier];
      fitWidth(body(this, c.x + CARD_INSET, c.y + 44, sub, 28, { color: '#e2d9ff' }), c.w - CARD_INSET - 12, 16);

      // The phone holds the map, settings (sound), stonks and the shop (scenes/PhoneScene.js).
      const b = FIELD.buttons;
      const phoneW = 124;
      new Button(this, {
        x: b.right - phoneW / 2, y: b.y, w: phoneW, h: b.h, text: 'PHONE', size: 16, accent: GOLD, system: true, depth: 30,
        onPress: () => this.openPhone(),
      });
      if (this.playtest) {
        // Trying a draft from the map editor: a way back to it.
        const w = 100;
        new Button(this, {
          x: b.right - phoneW - b.gap - w / 2, y: b.y, w, h: b.h, text: 'EDIT', size: 16, accent: 0x9fdcff, system: true, depth: 30,
          onPress: () => this.leave(),
        });
      }
      // New posts in the social app.
      this.badge = new PhoneBadge(this, b.right - 6, b.y - b.h / 2 + 4, 31);
      // Off again at shutdown: the scene restarts through every door, and a stale
      // listener would refresh the last visit's (destroyed) badge.
      const refresh = () => {
        this.badge.refresh();
        this.syncFollower(); // SETTINGS can switch her on or off
        if (this.revealing) this.revealSecret(this.revealing);
      };
      this.events.on('resume', refresh);
      this.events.once('shutdown', () => this.events.off('resume', refresh));

      // The bottom panel only shows while someone's talking.
      this.panel = drawRibbonPanel(this, LAYOUT.panel).setVisible(false);
      this.bus = new TapBus(this);
      this.dialog = new DialogBox(this, this.bus, { instant: DEBUG.fast });
      this.menu = new Menu(this);
      this.timing = new TimingBar(this, this.bus);
      this.stick = new Joystick(this, FIELD.stick);
      this.talkButton = new InteractButton(this, FIELD.talkButton);
    });
  }

  // ---- Input and walking ----------------------------------------------------------

  onPointerDown(pointer, over) {
    if (over.length || this.mode !== 'explore') return;
    if (this.talkButton.contains(pointer)) return this.interact();
    if (this.stick.contains(pointer)) {
      this.path = [];
      this.pendingNpc = null;
      this.stick.begin(pointer);
      return;
    }
    this.dragging = true;
    this.lastAim = this.time.now;
    const npc = this.npcAt(pointer.worldX, pointer.worldY);
    if (npc) this.approach(npc);
    else if (this.followerAt(pointer.worldX, pointer.worldY)) this.talkToFollower();
    else this.walkTo(pointer.worldX, pointer.worldY);
  }

  /** Holding and dragging steers: re-aim at the finger every so often. */
  onPointerMove(pointer) {
    if (this.stick.active) return this.stick.move(pointer);
    if (!this.dragging || !pointer.isDown || this.mode !== 'explore') return;
    if (this.time.now - this.lastAim < FIELD.dragRepathMs) return;
    if (Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.x, pointer.y) < FIELD.tapSlop) return;
    this.lastAim = this.time.now;
    this.walkTo(pointer.worldX, pointer.worldY, { quiet: true });
  }

  onPointerUp(pointer) {
    this.dragging = false;
    if (this.stick.active && pointer.id === this.stick.pointerId) {
      this.stick.release();
      if (this.mode === 'explore') this.face(this.player, this.facing);
    }
  }

  /** The TALK button: talk to the nearest NPC in range, walking the last steps if needed. */
  interact() {
    this.talkButton.pulse(this);
    const npc = this.nearbyNpc();
    this.stick.release();
    if (npc) return this.approach(npc);
    // Nobody else around: the follower's always close.
    if (this.follower) return this.talkToFollower();
    Audio.sfx('blip');
  }

  /** The nearest NPC within the TALK button's range of $cott, or null. */
  nearbyNpc() {
    let best = null;
    let bestD = FIELD.talkButton.range;
    for (const n of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.x, n.y);
      if (d <= bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  npcAt(x, y) {
    return this.npcs.find((n) => Math.abs(x - n.x) <= NPC_HIT.w / 2 && y <= n.y + 10 && y >= n.y - NPC_HIT.h);
  }

  walkTo(x, y, { quiet = false } = {}) {
    this.pendingNpc = null;
    const path = this.grid.findPath({ x: this.player.x, y: this.player.y }, { x, y });
    this.path = path ?? [];
    if (!path) return false;
    if (!quiet) {
      const end = path[path.length - 1];
      this.tapMark.setPosition(end.x, end.y).setVisible(true).setAlpha(1).setScale(1);
      this.tweens.killTweensOf(this.tapMark);
      this.tweens.add({ targets: this.tapMark, alpha: 0, scale: 0.4, duration: 450 });
    }
    return true;
  }

  /** Walk up to an NPC (from $cott's side), then talk. */
  approach(npc) {
    Audio.sfx('blip');
    if (this.closeTo(npc)) return this.talkTo(npc);
    const dx = this.player.x - npc.x;
    const dy = this.player.y - npc.y;
    const len = Math.hypot(dx, dy) || 1;
    const stand = FIELD.talkRange * 0.6;
    this.walkTo(npc.x + (dx / len) * stand, npc.y + (dy / len) * stand);
    this.pendingNpc = npc;
  }

  closeTo(npc) {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) <= FIELD.talkRange;
  }

  update(time, delta) {
    this.placeEmote();
    if (this.mode !== 'explore') return;
    this.talkButton.setReady(!!this.nearbyNpc());
    if (this.stick.active) this.steer(delta);
    else if (this.path.length) this.walkPath(delta);
    else if (this.follower) this.follower.stillMs += delta;
    this.moveFollower();
  }

  /** Tap-to-walk: follow the path, then leave, talk, or stop at its end. */
  walkPath(delta) {
    let step = (FIELD.speed * delta) / 1000;
    let mx = 0;
    let my = 0;
    while (step > 0 && this.path.length) {
      const t = this.path[0];
      const dx = t.x - this.player.x;
      const dy = t.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) {
        mx = dx;
        my = dy;
      }
      if (dist <= step) {
        this.player.setPosition(t.x, t.y);
        this.path.shift();
        step -= dist;
      } else {
        this.player.setPosition(this.player.x + (dx / dist) * step, this.player.y + (dy / dist) * step);
        step = 0;
      }
    }
    this.player.setDepth(worldDepth(this.player.y));
    if (mx || my) this.walkAnim(Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 'left' : 'right') : my < 0 ? 'up' : 'down');

    const exit = this.exitAt();
    if (exit) return this.leave(exit);
    if (this.pendingNpc && this.closeTo(this.pendingNpc)) return this.talkTo(this.pendingNpc);
    if (!this.path.length) {
      this.face(this.player, this.facing);
      if (this.pendingNpc) this.pendingNpc = null; // couldn't get close enough
    }
  }

  /** Joystick walking: move along the stick, sliding along walls the way it can. */
  steer(delta) {
    const v = this.stick.vector();
    if (!v) {
      if (this.player.anims.isPlaying) this.face(this.player, this.facing);
      if (this.follower) this.follower.stillMs += delta;
      return;
    }
    const { minSpeed } = FIELD.stick;
    const step = (FIELD.speed * (minSpeed + (1 - minSpeed) * v.strength) * delta) / 1000;
    const { x, y } = this.player;
    const tries = [[v.x, v.y], [Math.sign(v.x), 0], [0, Math.sign(v.y)]];
    for (const [dx, dy] of tries) {
      if (!dx && !dy) continue;
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (this.grid.walkableAt(nx, ny)) {
        this.player.setPosition(nx, ny);
        break;
      }
    }
    this.player.setDepth(worldDepth(this.player.y));
    this.walkAnim(Math.abs(v.x) > Math.abs(v.y) ? (v.x < 0 ? 'left' : 'right') : v.y < 0 ? 'up' : 'down');
    const exit = this.exitAt();
    if (exit) this.leave(exit);
  }

  /** The exit $cott is standing in, or null. A secret exit (Derek's cellar) only works once it's found. */
  exitAt() {
    return this.map.exits.find((e) => present(e, (id) => this.found.has(id))
      && Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(e.x, e.y, e.w, e.h), this.player.x, this.player.y)) ?? null;
  }

  // ---- Secrets (systems/secrets.js) -------------------------------------------------

  /** Show what's found, hide what isn't, and the covers the other way round. */
  showSecrets() {
    for (const { p, objs } of this.secretProps) {
      const on = present(p, (id) => this.found.has(id));
      for (const o of objs) o.setVisible(on).setAlpha(1);
    }
  }

  /** For the WIFI app: this map's hidden networks, their signal at $cott's spot, and which way to go. */
  wifiNetworks() {
    const spots = secretSpots(this.map);
    return Object.entries(this.map.secrets ?? {}).filter(([id, s]) => s.app === 'wifi' && spots[id]).map(([id, s]) => {
      const at = spots[id];
      const { bars, trace } = signal(Phaser.Math.Distance.Between(this.player.x, this.player.y, at.x, at.y));
      return { id, ssid: s.ssid, bars, trace, heading: heading(this.player, at), found: this.found.has(id) };
    });
  }

  /** The WIFI app traced a secret: save it, and show it once the phone's put away. */
  traceSecret(id) {
    if (!Save.find(secretKey(this.region.id, id))) return;
    this.revealing = id;
  }

  /** Back from the phone with a fresh find: the cover comes off, the hidden thing fades in, and someone says so. */
  async revealSecret(id) {
    this.revealing = null;
    this.found.add(id);
    this.mode = 'talk';
    this.stop();
    const fadeIn = [];
    for (const { p, objs } of this.secretProps) {
      if (p.cover === id) this.tweens.add({ targets: objs, alpha: 0, duration: 500, onComplete: () => objs.forEach((o) => o.setVisible(false)) });
      if (p.secret === id) fadeIn.push(...objs.map((o) => o.setVisible(true).setAlpha(0)));
    }
    this.tweens.add({ targets: fadeIn, alpha: 1, duration: 700, delay: 300 });
    this.cameras.main.flash(220, 255, 63, 210);
    Audio.sfx('crit');
    const lines = this.map.secrets[id]?.found ?? [];
    if (lines.length) {
      this.stick.setVisible(false);
      this.talkButton.setVisible(false);
      this.panel.setVisible(true);
      await this.sayAll(lines);
      this.dialog.hide();
      this.panel.setVisible(false);
      this.stick.setVisible(true);
      this.talkButton.setVisible(true);
    }
    this.mode = 'explore';
  }

  walkAnim(facing) {
    const { view, flip } = facingFrame(facing);
    const key = `field_scott_walk_${view}`;
    this.player.setFlipX(flip);
    if (this.facing !== facing || this.player.anims.currentAnim?.key !== key || !this.player.anims.isPlaying) {
      this.player.play(key, true);
    }
    this.facing = facing;
  }

  stop() {
    this.path = [];
    this.pendingNpc = null;
    this.dragging = false;
    this.face(this.player, this.facing);
  }

  // ---- The follower (data/followers.js, systems/follower.js) -------------------------

  /** Bring the follower in or send her home to match the save (SETTINGS' test toggle can change it). */
  syncFollower() {
    const id = Save.follower;
    if ((this.follower?.id ?? null) === id) return;
    this.follower?.sprite.destroy();
    this.follower = null;
    this.clearEmote();
    const data = FOLLOWERS[id];
    if (!data || !this.textures.exists(data.sprite)) return;
    walkerAnims(this, data.sprite);
    // She starts right behind him, on the side he's facing away from (through a door, that's the doorway).
    const trail = new Trail(data.gap, this.player, { facing: this.facing });
    const at = trail.position();
    const x = Phaser.Math.Clamp(at.x, 0, this.map.size.w);
    const y = Phaser.Math.Clamp(at.y, 0, this.map.size.h);
    trail.points[0] = { x, y };
    const sprite = this.add.sprite(Math.round(x), Math.round(y), data.sprite).setOrigin(0.5, 1).setDepth(worldDepth(y));
    this.face(sprite, this.facing);
    this.follower = { id, data, trail, sprite, facing: this.facing, moving: false, stillMs: 0 };
  }

  /** She walks $cott's trail, `gap` px behind him, and pops an emote now and then when he stands still. */
  moveFollower() {
    const f = this.follower;
    if (!f) return;
    f.trail.record(this.player.x, this.player.y);
    const at = f.trail.position();
    const facing = facingOf(at.x - f.sprite.x, at.y - f.sprite.y);
    if (facing) {
      f.sprite.setPosition(at.x, at.y).setDepth(worldDepth(at.y));
      const { view, flip } = facingFrame(facing);
      const key = `${f.data.sprite}_walk_${view}`;
      f.sprite.setFlipX(flip);
      if (f.sprite.anims.currentAnim?.key !== key || !f.sprite.anims.isPlaying) f.sprite.play(key, true);
      f.facing = facing;
      f.moving = true;
      f.stillMs = 0;
      return;
    }
    if (f.moving) {
      f.moving = false;
      this.face(f.sprite, f.facing);
    }
    const idle = f.data.idle;
    if (idle && f.stillMs >= idle.afterMs) {
      f.stillMs = 0;
      this.emote(idle.emotes[rng.int(0, idle.emotes.length - 1)]);
    }
  }

  followerAt(x, y) {
    const s = this.follower?.sprite;
    return !!s && Math.abs(x - s.x) <= FOLLOWER_HIT.w / 2 && y <= s.y + 10 && y >= s.y - FOLLOWER_HIT.h;
  }

  /** Her mood right now (data/followers.js `moods`). */
  followerMood() {
    const f = this.follower;
    return moodOf(f.data.moods, Save.jealousy(f.id));
  }

  /** $cott talked to someone else: she noticed. */
  makeJealous() {
    const f = this.follower;
    if (!f) return;
    Save.setJealousy(f.id, Save.jealousy(f.id) + 1);
    this.emote(this.followerMood().emote);
  }

  /** Talk to her: they face each other, her mood pops over her head, and she says her piece. Then she's happy again. */
  async talkToFollower() {
    const f = this.follower;
    this.mode = 'talk';
    this.stick.setVisible(false);
    this.talkButton.setVisible(false);
    Audio.sfx('blip');
    this.facing = facingOf(f.sprite.x - this.player.x, f.sprite.y - this.player.y) ?? this.facing;
    this.stop();
    const opposite = { left: 'right', right: 'left', up: 'down', down: 'up' };
    this.face(f.sprite, opposite[this.facing]);
    f.facing = opposite[this.facing];

    const mood = this.followerMood();
    this.emote(mood.emote);
    const near = this.nearbyNpc()?.id ?? null;
    const lines = followerLines(f.data, { first: Save.brag(`follower:${f.id}`), near, map: this.map.id, mood: mood.id }, (n) => rng.int(0, n - 1));
    this.panel.setVisible(true);
    await this.sayAll(lines.map((l) => ({ speaker: f.data.speaker, ...l })));
    this.dialog.hide();
    this.panel.setVisible(false);
    if (Save.jealousy(f.id) > 0) this.emote('heart');
    Save.setJealousy(f.id, 0);
    f.stillMs = 0;
    this.stick.setVisible(true);
    this.talkButton.setVisible(true);
    this.mode = 'explore';
  }

  // ---- Emotes (ui/emote.js) ------------------------------------------------------------

  /** Pop an emote bubble over the follower's head for a moment (one at a time). */
  emote(id) {
    this.clearEmote();
    const g = emoteBubble(this, id).setDepth(-1).setAlpha(0);
    this.emoting = { id, g, until: this.time.now + EMOTE_MS };
    this.placeEmote();
    this.tweens.add({ targets: g, alpha: 1, duration: 120 });
    Audio.sfx(id === 'anger' ? 'bad' : 'blip');
  }

  /** Keep the bubble over her head (she may be walking), and take it down when its time's up. */
  placeEmote() {
    const e = this.emoting;
    if (!e) return;
    const f = this.follower;
    if (!f || this.time.now >= e.until) return this.clearEmote();
    e.g.setPosition(Math.round(f.sprite.x), Math.round(f.sprite.y - f.data.head - EMOTE_GAP));
  }

  clearEmote() {
    this.emoting?.g.destroy();
    this.emoting = null;
  }

  // ---- Talking, fighting, leaving -------------------------------------------------

  async talkTo(npc) {
    this.mode = 'talk';
    this.stick.setVisible(false);
    this.talkButton.setVisible(false);
    // Face each other.
    const dx = npc.x - this.player.x;
    const dy = npc.y - this.player.y;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    this.stop();
    const opposite = { left: 'right', right: 'left', up: 'down', down: 'up' };
    this.face(npc.sprite, opposite[this.facing]);

    this.panel.setVisible(true);
    const cleared = Save.cleared.has(this.region.id);
    const won = npc.challenge && Save.hasWon(this.challengeId(npc));
    const metBefore = Save.socialState.met.has(this.challengeId(npc));
    const gate = this.gates.find((g) => g.bouncer === npc.id);
    if (!(gate?.open)) {
      await this.sayAll((won && npc.talkWon) || (cleared && npc.talkCleared) || (metBefore && npc.talkAgain) || npc.talk);
    }
    Save.meet(this.challengeId(npc));
    this.badge.refresh();
    if (gate) await this.atTheRope(gate);
    await this.afterTalk(npc);
    this.dialog.hide();
    if (npc.challenge && !won) await this.offerChallenge(npc);

    if (npc.fight) {
      const enemy = ENEMIES[npc.fight];
      const choice = await this.ui(() => this.menu.choose([
        { id: 'fight', text: cleared ? 'REMATCH' : 'FIGHT', sub: `VS ${enemy.name}`, accent: GOLD, textColor: '#ffd166' },
        { id: 'leave', text: 'NOT YET', sub: 'Walk away. Strategically.' },
      ], { prompt: `${npc.name} WANTS SMOKE`, columns: 2 }));
      if (choice === 'fight') return this.fight(npc);
    }
    this.panel.setVisible(false);
    this.face(npc.sprite, npc.facing);
    this.stick.setVisible(true);
    this.talkButton.setVisible(true);
    this.mode = 'explore';
    this.makeJealous();
  }

  sayAll(lines = [], vars = null) {
    return lines.reduce((p, line) => p.then(() => this.dialog.say(vars ? fillIn(line.text, vars) : line.text, line.speaker ?? null)), Promise.resolve());
  }

  // ---- The social app's side of talking: classic posts, gifts, velvet ropes ---------

  /** A first talk can unlock a classic post and hand over a gift. */
  async afterTalk(npc) {
    if (npc.unlocks && Save.unlockClassic(npc.unlocks)) {
      Audio.sfx('good');
      await this.dialog.say('NEW DRAFT: that conversation gave $cott an idea for a classic post.\nIt\'s waiting in his phone, in Y.', null, { color: SOCIAL_CSS });
    }
    if (npc.gift && Save.brag(`gift:${this.challengeId(npc)}`)) await this.giveGift(npc.gift);
  }

  /** Hand over a gift: cash, stash items, and phone apps (the WIFI app). */
  async giveGift({ cash = 0, items = {}, apps = [] }) {
    if (cash) Save.earn(cash);
    for (const [id, n] of Object.entries(items)) Save.addStash(id, n);
    const newApps = apps.filter((id) => Save.addApp(id));
    const got = [cash ? `+${money(cash)}` : null, ...Object.entries(items).map(([id, n]) => `+${n} ${ITEMS[id]?.name ?? id}`)].filter(Boolean);
    if (got.length) {
      Audio.sfx('heal');
      await this.dialog.say(got.join('\n'), null, { color: '#ffd166' });
    }
    for (const id of newApps) {
      Audio.sfx('crit');
      const app = APPS.find((a) => a.id === id);
      await this.dialog.say(`NEW APP: ${app?.name ?? id.toUpperCase()}\nIt's on $cott's phone now.`, null, { color: '#7cf29c' });
    }
  }

  /** A bouncer checks $cott's Clout against the list, and opens the rope once he has it. */
  async atTheRope(gate) {
    const vars = { clout: formatClout(Save.clout), need: formatClout(gate.clout) };
    if (gate.open) return this.sayAll(gate.open, vars);
    if (Save.clout < gate.clout) {
      Audio.sfx('bad');
      return this.sayAll(gate.deny, vars);
    }
    await this.sayAll(gate.allow, vars);
    this.openGate(gate);
  }

  openGate(gate) {
    Save.openGate(this.gateId(gate));
    gate.open = true;
    gate.rope.setTexture('prop_rope_open');
    gate.sign.setVisible(false);
    Audio.sfx('crit');
    this.cameras.main.flash(160, 255, 209, 102);
    this.buildGrid();
    this.badge.refresh();
  }

  challengeId(npc) {
    return `${this.region.id}:${npc.id}`;
  }

  // ---- Challenges ------------------------------------------------------------------

  /** Offer an NPC's challenge; a win saves its intel and says what it revealed. */
  async offerChallenge(npc) {
    const c = npc.challenge;
    const choice = await this.ui(() => this.menu.choose([
      { id: 'go', text: c.accept ?? "YOU'RE ON", sub: c.acceptSub ?? 'Win and they talk.', accent: INTEL, textColor: INTEL_CSS },
      { id: 'leave', text: 'NOT NOW', sub: 'Come back later.' },
    ], { prompt: c.prompt, columns: 2 }));
    if (choice !== 'go') return;

    const run = { quiz: () => this.runQuiz(c), trade: () => this.runTrade(c) }[c.kind] ?? (() => this.runBeat(c));
    const won = await run();
    if (!won) {
      Audio.sfx('bad');
      await this.sayAll(c.lose);
      return this.dialog.hide();
    }
    Audio.sfx('good');
    await this.sayAll(c.win);
    Save.winChallenge(this.challengeId(npc), c.reveal);
    npc.alert?.destroy();
    npc.alert = null;
    if (c.reveal) for (const line of revealLines(ENEMIES[c.reveal.enemy], c.reveal)) await this.dialog.say(line.text, null, { color: INTEL_CSS });
    if (c.gift && Save.brag(`gift:${this.challengeId(npc)}:won`)) await this.giveGift(c.gift);
    this.dialog.hide();
  }

  /** Beat challenge: `rounds` taps on the timing bar, each at `need` or better. */
  async runBeat(c) {
    const need = TIMING.ratings.findIndex((r) => r.id === (c.need ?? 'FIRE'));
    const rounds = c.rounds ?? 1;
    for (let i = 0; i < rounds; i++) {
      const count = rounds > 1 ? ` ${i + 1}/${rounds}` : '';
      const rating = await this.ui(() => this.timing.play({
        speed: c.speed ?? 1, title: `${c.title}${count} · ${TIMING.ratings[need].id}+`, perfect: DEBUG.perfect,
      }));
      if (TIMING.ratings.indexOf(rating) > need) return false;
    }
    return true;
  }

  /** Quiz challenge: each question's first answer is the right one (they're shuffled on screen). */
  async runQuiz(c) {
    for (const q of c.questions) {
      const answers = q.answers.map((text, i) => ({ text, right: i === 0 }));
      for (let i = answers.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [answers[i], answers[j]] = [answers[j], answers[i]];
      }
      this.quizAnswer = q.answers[0];
      const card = this.ui(() => this.questionCard(q.q));
      const pick = await this.ui(() => this.menu.choose(
        answers.map((a, i) => ({ id: String(i), text: a.text, accent: INTEL })),
        { prompt: c.prompt, columns: 1 },
      ));
      card.forEach((o) => o.destroy());
      this.quizAnswer = null;
      if (!answers[Number(pick)].right) {
        await this.sayAll(q.wrong);
        return false;
      }
      await this.sayAll(q.right);
    }
    return true;
  }

  /** Trade challenge: $cott's day-trading minigame (minigames/trade.js); any passing grade wins. */
  async runTrade(c) {
    const { grade } = await trade.run(this, { difficulty: c.difficulty ?? 1, context: c });
    return grade !== 'fail';
  }

  questionCard(question) {
    const r = QUESTION_CARD;
    const g = drawCard(this.add.graphics(), r, INTEL).setDepth(20);
    const text = body(this, r.x + CARD_INSET, r.y + 10, '', 34).setDepth(20);
    text.setText(fitWrapped(text, question, { maxWidth: r.w - CARD_INSET - 24, maxHeight: r.h - 20, maxSize: 34, minSize: 22 }));
    return [g, text];
  }

  /** Pause the region under $cott's phone; the phone resumes it when put away. */
  openPhone() {
    if (this.mode !== 'explore') return;
    this.stop();
    this.stick.release();
    this.scene.launch('Phone', { from: this.scene.key });
    this.scene.pause();
  }

  fight(npc) {
    this.mode = 'leaving';
    Audio.sfx('crit');
    const cam = this.cameras.main;
    cam.flash(160, 255, 255, 255);
    cam.fadeOut(300, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => this.scene.start('Battle', { enemy: npc.fight, region: this.region.id }));
  }

  /**
   * Walk out: an exit with `to: 'map'` (or none, from the EDIT button) goes back to
   * the overworld, or to the editor from a playtest; any other `to` is a door
   * into that map of the region, and $cott comes out at its door back here.
   */
  leave(exit = null) {
    if (this.mode === 'leaving') return;
    this.mode = 'leaving';
    this.stick.setVisible(false);
    this.talkButton.setVisible(false);
    this.stop();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    const door = exit && exit.to !== 'map' && MAPS[exit.to] ? exit.to : null;
    if (door) Audio.sfx('blip');
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (door) this.scene.restart({ mapId: door, from: this.map.id, playtest: this.playtest });
      // A playtest from the map editor goes back to the editor.
      else this.scene.start(this.playtest ? 'Editor' : 'Overworld', { id: this.map.id });
    });
  }

  /** Read by the debug hook / smoke test. Screen points are canvas coordinates. */
  debugState() {
    const cam = this.cameras.main;
    const screen = (x, y) => ({ x: Math.round(x - cam.worldView.x), y: Math.round(y - cam.worldView.y) });
    return {
      region: this.region.id,
      map: this.map.id,
      mode: this.mode,
      walking: this.path.length > 0,
      stick: { ...FIELD.stick, active: this.stick.active },
      talkButton: { ...FIELD.talkButton, ready: this.talkButton.ready, near: this.nearbyNpc()?.id ?? null },
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), facing: this.facing },
      npcs: this.npcs.map((n) => ({
        id: n.id, tap: screen(n.x, n.y - 60), challenge: !!n.challenge, won: !!n.challenge && Save.hasWon(this.challengeId(n)),
      })),
      quizAnswer: this.quizAnswer ?? null,
      clout: Save.clout,
      cash: Save.cash,
      gates: this.gates.map((g) => ({ id: g.id, open: g.open, clout: g.clout, tap: screen(g.x, g.y - 20) })),
      exits: this.map.exits.map((e) => ({ to: e.to, open: present(e, (id) => this.found.has(id)), tap: screen(e.x + e.w / 2, e.y + e.h / 2) })),
      secrets: this.wifiNetworks(),
      apps: APPS.filter((x) => x.gift && Save.hasApp(x.id)).map((x) => x.id),
      follower: this.follower && {
        id: this.follower.id,
        x: Math.round(this.follower.sprite.x),
        y: Math.round(this.follower.sprite.y),
        facing: this.follower.facing,
        moving: this.follower.moving,
        jealousy: Save.jealousy(this.follower.id),
        mood: this.followerMood().id,
        tap: screen(this.follower.sprite.x, this.follower.sprite.y - 30),
      },
      emote: this.emoting?.id ?? null,
    };
  }
}
