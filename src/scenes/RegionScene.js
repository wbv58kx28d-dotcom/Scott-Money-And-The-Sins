// A walkable region (CLAUDE.md §6.6): $cott explores the region's map in a
// 3/4 top-down view, Chained Echoes style, and finds its villain.
//
// Phone controls: tap anywhere to walk there (he paths around water and
// props), hold and drag to steer, or use the joystick in the bottom-right
// corner. Tap an NPC to walk over and talk, or press the TALK button beside
// the joystick when someone's close (it lights up). The villain's talk ends
// with FIGHT / NOT YET. Minor characters can offer a challenge (a beat tap, a
// quiz, or a day trade); winning it reveals intel on the villain that shows in the fight
// (systems/intel.js). Walking into an exit leaves for the overworld map.
//
// Talking to someone can unlock one of $cott's classic posts for his social
// app (data/social.js), and a velvet rope (map `gates`) blocks a side area
// until he has the Clout; its bouncer lets him through, and it stays open.
//
// World objects are depth-sorted by their feet (depth = y - WORLD_DEPTH), so
// everything in the world sits below the UI's ordinary depths. UI is created
// inside ui(), which pins it to the screen.

import { FIELD, LAYOUT } from '../config.js';
import { TIMING } from '../data/rules.js';
import { MAPS } from '../data/maps/index.js';
import { FIELD_SHEETS, PROP_IMAGES } from '../data/assets.js';
import { regionById, TIER_NAMES } from '../data/regions.js';
import { ENEMIES } from '../data/enemies/index.js';
import { Save } from '../systems/save.js';
import { Audio } from '../systems/audio.js';
import { DEBUG } from '../systems/debug.js';
import { Terrain } from '../systems/terrain.js';
import { buildRegionGrid } from '../systems/mapcheck.js';
import { revealLines } from '../systems/intel.js';
import { formatClout, fillIn } from '../systems/social.js';
import { money } from '../systems/market.js';
import { ITEMS } from '../data/items.js';
import { PhoneBadge } from '../ui/badge.js';
import { rng } from '../systems/rng.js';
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
// The tap area around an NPC's body.
const NPC_HIT = { w: 100, h: 140 };

const worldDepth = (y) => y - WORLD_DEPTH;

export default class RegionScene extends Phaser.Scene {
  constructor() {
    super('Region');
  }

  /** data: { region } to play a region; the map editor adds { map, playtest } to try a draft. */
  init(data) {
    this.region = regionById(data?.region) ?? regionById('start');
    this.map = data?.map ?? MAPS[this.region.id];
    this.playtest = !!data?.playtest;
  }

  // Real art loads when src/data/assets.js lists it; any walker or prop missing is baked in create().
  preload() {
    preloadTileset(this, this.map.tileset);
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

    for (const p of map.props) {
      const img = this.add.image(p.x, p.y, p.texture).setOrigin(0.5, 1).setDepth(worldDepth(p.y));
      if (p.label) signLabel(this, p, img).setDepth(worldDepth(p.y) + 0.5);
    }

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

    const { spawn } = map;
    this.player = this.add.sprite(spawn.x, spawn.y, 'field_scott').setOrigin(0.5, 1).setDepth(worldDepth(spawn.y));
    this.facing = spawn.facing;
    this.face(this.player, this.facing);

    this.tapMark = this.add.ellipse(0, 0, 36, 16).setStrokeStyle(3, 0xffffff, 0.9).setDepth(-WORLD_DEPTH * 2 + 1).setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.size.w, map.size.h);
    cam.startFollow(this.player, true, FIELD.cameraLerp, FIELD.cameraLerp);
    cam.setFollowOffset(0, FIELD.frame.h / 2);
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
      fitWidth(label(this, c.x + CARD_INSET, c.y + 16, this.region.name.toUpperCase(), 18, { color: '#ffd166' }), c.w - CARD_INSET - 12);
      const villain = this.npcs.find((n) => n.fight);
      const sub = villain ? `${TIER_NAMES[this.region.tier]} · find ${ENEMIES[villain.fight].name}` : TIER_NAMES[this.region.tier];
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
      this.events.on('resume', () => this.badge.refresh());

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
    if (!npc) return Audio.sfx('blip');
    this.stick.release();
    this.approach(npc);
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
    if (this.mode !== 'explore') return;
    this.talkButton.setReady(!!this.nearbyNpc());
    if (this.stick.active) return this.steer(delta);
    if (!this.path.length) return;
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

    if (this.atExit()) return this.leave();
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
    if (this.atExit()) this.leave();
  }

  atExit() {
    return this.map.exits.some((e) => Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(e.x, e.y, e.w, e.h), this.player.x, this.player.y));
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
    if (npc.gift && Save.brag(`gift:${this.challengeId(npc)}`)) {
      const { cash = 0, items = {} } = npc.gift;
      if (cash) Save.earn(cash);
      for (const [id, n] of Object.entries(items)) Save.addStash(id, n);
      const got = [cash ? `+${money(cash)}` : null, ...Object.entries(items).map(([id, n]) => `+${n} ${ITEMS[id]?.name ?? id}`)].filter(Boolean);
      Audio.sfx('heal');
      await this.dialog.say(got.join('\n'), null, { color: '#ffd166' });
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
    for (const line of revealLines(ENEMIES[c.reveal.enemy], c.reveal)) await this.dialog.say(line.text, null, { color: INTEL_CSS });
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

  leave() {
    if (this.mode === 'leaving') return;
    this.mode = 'leaving';
    this.stick.setVisible(false);
    this.talkButton.setVisible(false);
    this.stop();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    // A playtest from the map editor goes back to the editor.
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(this.playtest ? 'Editor' : 'Overworld', { id: this.map.id }));
  }

  /** Read by the debug hook / smoke test. Screen points are canvas coordinates. */
  debugState() {
    const cam = this.cameras.main;
    const screen = (x, y) => ({ x: Math.round(x - cam.worldView.x), y: Math.round(y - cam.worldView.y) });
    return {
      region: this.region.id,
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
    };
  }
}
