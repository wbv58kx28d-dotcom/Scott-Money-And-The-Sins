// A walkable region (CLAUDE.md §6.6): $cott explores the region's map in a
// 3/4 top-down view, Chained Echoes style, and finds its villain.
//
// Phone controls: tap anywhere to walk there (he paths around water and
// props), hold and drag to steer, or use the joystick in the bottom-right
// corner. Tap an NPC to walk over and talk, or press the TALK button beside
// the joystick when someone's close (it lights up). The villain's talk ends
// with FIGHT / NOT YET. Minor characters can offer a challenge (a beat tap or
// a quiz); winning it reveals intel on the villain that shows in the fight
// (systems/intel.js). Walking into an exit leaves for the overworld map.
//
// World objects are depth-sorted by their feet (depth = y - WORLD_DEPTH), so
// everything in the world sits below the UI's ordinary depths. UI is created
// inside ui(), which pins it to the screen.

import { FIELD, LAYOUT } from '../config.js';
import { TIMING } from '../data/rules.js';
import { MAPS } from '../data/maps/index.js';
import { REGION_ART, FIELD_SHEETS, PROP_IMAGES } from '../data/assets.js';
import { regionById, TIER_NAMES } from '../data/regions.js';
import { ENEMIES } from '../data/enemies/index.js';
import { Save } from '../systems/save.js';
import { Audio } from '../systems/audio.js';
import { DEBUG } from '../systems/debug.js';
import { WalkGrid } from '../systems/walkGrid.js';
import { revealLines } from '../systems/intel.js';
import { rng } from '../systems/rng.js';
import {
  bakeRegionPlaceholder, bakeProps, bakeWalkerSheet, walkerAnims, facingFrame, maskSampler, SHEET_COLS,
} from '../systems/fieldArt.js';
import { TapBus } from '../ui/tapBus.js';
import { DialogBox } from '../ui/dialog.js';
import { Menu } from '../ui/menu.js';
import { Button } from '../ui/button.js';
import { TimingBar } from '../ui/timingBar.js';
import { Joystick } from '../ui/joystick.js';
import { InteractButton } from '../ui/interactButton.js';
import { pixelText, pixelTextWidth } from '../ui/pixelFont.js';
import { drawCard, drawRibbonPanel, RIBBON_GOLD, CARD_INSET } from '../ui/ribbon.js';
import { label, body, fitWidth, fitWrapped, snapCenter } from '../ui/text.js';

const WORLD_DEPTH = 100000;
const GOLD = 0xffd166;
const INTEL = 0x9fdcff; // challenges and the intel they reveal
const INTEL_CSS = '#9fdcff';
// The quiz question's card, above the menu's prompt tag.
const QUESTION_CARD = { x: 16, y: 930, w: 688, h: 116 };
// An NPC's own footprint, and the tap area around its body.
const NPC_BLOCK = { w: 70, h: 30 };
const NPC_HIT = { w: 100, h: 140 };

const worldDepth = (y) => y - WORLD_DEPTH;

export default class RegionScene extends Phaser.Scene {
  constructor() {
    super('Region');
  }

  init(data) {
    this.region = regionById(data?.region) ?? regionById('start');
    this.map = MAPS[this.region.id];
  }

  // Real art loads when src/data/assets.js lists it; anything missing is baked in create().
  preload() {
    const art = REGION_ART[this.map.id];
    if (art?.base) this.load.image(`${this.map.id}_base`, art.base);
    if (art?.walk) this.load.image(`${this.map.id}_walk`, art.walk);
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
    if (!this.textures.exists(`${map.id}_base`) || !this.textures.exists(`${map.id}_walk`)) bakeRegionPlaceholder(this, map);
    bakeProps(this);
    for (const key of new Set(['field_scott', ...map.npcs.map((n) => n.sprite)])) {
      if (!this.textures.exists(key)) bakeWalkerSheet(this, key);
      walkerAnims(this, key);
    }

    this.add.image(0, 0, `${map.id}_base`).setOrigin(0).setDepth(-WORLD_DEPTH * 2);

    // The walk grid: the mask, minus every prop's and NPC's footprint, eroded
    // so feet keep a little distance from walls.
    const sample = maskSampler(this, `${map.id}_walk`);
    const { cell } = FIELD;
    const cols = Math.ceil(map.size.w / cell);
    const rows = Math.ceil(map.size.h / cell);
    this.grid = new WalkGrid(cols, rows, cell, (c, r) => sample(((c + 0.5) * cell) / map.size.w, ((r + 0.5) * cell) / map.size.h));
    const footprint = (x, y, b) => ({ x: x - b.w / 2, y: y - b.h / 2, w: b.w, h: b.h });

    for (const p of map.props) {
      const img = this.add.image(p.x, p.y, p.texture).setOrigin(0.5, 1).setDepth(worldDepth(p.y));
      if (p.block) this.grid.block(footprint(p.x, p.y, p.block));
      if (p.label) {
        // Painted on the sign's board, centered ~59% up from the feet, in the pixel
        // font on the sign's own 2 px art grid so it doesn't shimmer when the camera moves.
        const px = pixelTextWidth(p.label, 2) <= img.width - 22 ? 2 : 1;
        const left = p.x - img.width / 2;
        const onGrid = (v, origin) => origin + Math.round((v - origin) / px) * px;
        const x = onGrid(p.x - pixelTextWidth(p.label, px) / 2, left);
        const y = onGrid(p.y - img.height * 0.59 - (5 * px) / 2, p.y - img.height);
        pixelText(this, x, y, p.label, { px }).setDepth(worldDepth(p.y) + 0.5);
      }
    }

    const cleared = Save.cleared.has(this.region.id);
    this.npcs = map.npcs.map((n) => {
      const sprite = this.add.sprite(n.x, n.y, n.sprite).setOrigin(0.5, 1).setDepth(worldDepth(n.y));
      this.face(sprite, n.facing);
      this.grid.block(footprint(n.x, n.y, NPC_BLOCK));
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
    this.grid.erode(FIELD.clearance);

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
    await this.sayAll((won && npc.talkWon) || (cleared && npc.talkCleared) || npc.talk);
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

  sayAll(lines = []) {
    return lines.reduce((p, line) => p.then(() => this.dialog.say(line.text, line.speaker ?? null)), Promise.resolve());
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

    const won = c.kind === 'quiz' ? await this.runQuiz(c) : await this.runBeat(c);
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
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Overworld'));
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
    };
  }
}
