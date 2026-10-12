// Battle: $cott vs. one villain (CLAUDE.md §5), following the turn flow of
// legacy/scott-money-battle.html on the 720×1280 layout.
//
// The whole fight is one async loop. Every dialog line, menu, and timing bar
// is an `await`, so the turn order reads top to bottom (HANDOFF quirk: keep it).
// Rules and numbers come from src/data/ and src/systems/combat.js; this scene
// only sequences them and draws the results.

import { GAME_W, GAME_H, COLORS, LAYOUT } from '../config.js';
import SCOTT from '../data/scott.js';
import { ENEMIES, DEFAULT_ENEMY } from '../data/enemies/index.js';
import { regionById } from '../data/regions.js';
import { Save } from '../systems/save.js';
import { DISS_TYPES, HIT_KINDS, TARGET_INFO } from '../data/types.js';
import { ITEMS } from '../data/items.js';
import { STATUSES } from '../data/statuses.js';
import { CROWD, DAMAGE } from '../data/rules.js';
import { HIT_TEXT } from '../data/battleText.js';
import {
  createBattler, resolveHit, rollDamage, discover, applyDamage, restore,
  startOfTurnFlow, checkStatusTriggers, scottBarsFor, pickCouplet, softSpotKey,
} from '../systems/combat.js';
import { chooseEnemyMove } from '../systems/ai.js';
import { Crowd } from '../systems/crowd.js';
import { rng } from '../systems/rng.js';
import { Audio } from '../systems/audio.js';
import { DEBUG } from '../systems/debug.js';
import { TapBus } from '../ui/tapBus.js';
import { DialogBox } from '../ui/dialog.js';
import { Menu } from '../ui/menu.js';
import { Button } from '../ui/button.js';
import { TimingBar } from '../ui/timingBar.js';
import { EnemyHud, ScottHud, CrowdMeter } from '../ui/hud.js';
import { drawPanel } from '../ui/panel.js';
import { showHowTo } from '../ui/howTo.js';
import { spitBars } from '../ui/speechBubble.js';
import { lunge, hitFx, reTint, wait } from '../ui/fx.js';
import { label, body } from '../ui/text.js';

const GOLD = 0xffd166;
const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const hexColor = (css) => Phaser.Display.Color.HexStringToColor(css).color;

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  init(data) {
    this.enemyId = ENEMIES[data?.enemy] ? data.enemy : DEFAULT_ENEMY;
    // The map region this fight is for; null for debug battles (&battle=).
    this.regionId = regionById(data?.region)?.id ?? null;
    // Only a first clear unlocks anything (a rematch win shouldn't replay the reveal).
    this.firstClear = !!this.regionId && !Save.cleared.has(this.regionId);
  }

  create() {
    this.buttons = new Set();
    this.phase = 'intro';
    this.result = null;
    this.round = 0;
    this.overlayOpen = false;
    this.bubbleSpeaker = null;

    const def = ENEMIES[this.enemyId];
    this.def = def;
    this.scott = createBattler(SCOTT);
    this.enemy = createBattler(def);
    this.crowd = new Crowd();

    this.add.image(0, 0, regionById(this.regionId)?.background ?? def.background).setOrigin(0);
    this.crowdPeople = this.makeCrowd();
    if (def.stage) label(this, LAYOUT.stageLabel.x, LAYOUT.stageLabel.y, def.stage, 14, { color: '#8f7fc0' });
    this.enemyChar = this.makeCharacter(def.texture, LAYOUT.enemySlots[0], -1);
    this.scottChar = this.makeCharacter(SCOTT.texture, LAYOUT.scott, 1);

    this.enemyHud = new EnemyHud(this, this.enemy);
    this.crowdMeter = new CrowdMeter(this, this.crowd);
    this.scottHud = new ScottHud(this, this.scott);
    drawPanel(this, LAYOUT.panel);
    this.makeCornerButtons();

    this.bus = new TapBus(this);
    this.dialog = new DialogBox(this, this.bus, { instant: DEBUG.fast });
    this.menu = new Menu(this);
    this.timing = new TimingBar(this, this.bus);

    this.run().catch((err) => {
      console.error('[$cott] battle loop crashed', err);
      this.phase = 'error';
    });
  }

  // ---- Stage --------------------------------------------------------------

  /** A character is a container at the feet holding a feet-origin sprite. */
  makeCharacter(texture, { x, y }, enterFrom) {
    const { offscreen, ms } = LAYOUT.entrance;
    const startX = enterFrom < 0 ? -offscreen : GAME_W + offscreen;
    const container = this.add.container(startX, y);
    const sprite = this.add.image(0, 0, texture).setOrigin(0.5, 1);
    container.add(sprite);
    this.tweens.add({ targets: container, x, duration: ms, ease: 'Quad.easeOut' });
    const { px, ms: bobMs } = LAYOUT.idleBob;
    const bob = this.tweens.add({ targets: sprite, y: -px, duration: bobMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: ms });
    // Active-turn glow is WebGL-only (CLAUDE.md §8.1).
    let glow = null;
    if (sprite.preFX) {
      sprite.preFX.setPadding(12);
      glow = sprite.preFX.addGlow(COLORS.glow, 4, 0, false);
      glow.active = false;
    }
    return { container, sprite, glow, bob };
  }

  /** The crowd: silhouettes bobbing along the horizon (from the prototype). */
  makeCrowd() {
    const { y, count, spacing } = LAYOUT.crowdRow;
    const fx = rng.fx;
    const people = [];
    for (let i = 0; i < count; i++) {
      const cx = 16 + i * spacing + fx.int(-6, 6);
      const cy = y + fx.int(-4, 4);
      const person = this.add.container(cx, cy);
      const g = this.add.graphics();
      g.fillStyle(fx.pick([0x0f0820, 0x140a2a, 0x1a0f33]), 1);
      g.fillRect(-10, -40, 20, 18);
      g.fillRect(-16, -22, 32, 22);
      if (fx.chance(0.35)) {
        g.fillRect(6, -56, 6, 18); // a raised phone
        g.fillStyle(0xfff6c0, 0.9);
        g.fillRect(4, -66, 10, 10);
      }
      person.add(g);
      person.inner = g;
      this.tweens.add({ targets: person, y: cy - 4, duration: fx.int(300, 500), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: fx.int(0, 400) });
      people.push(person);
    }
    return people;
  }

  crowdJump() {
    this.crowdPeople.forEach((p, i) =>
      this.tweens.add({ targets: p.inner, y: -16, duration: 120, yoyo: true, delay: i * 18, ease: 'Quad.easeOut' }),
    );
  }

  /** "?" opens the cheat sheet; SND toggles sound. */
  makeCornerButtons() {
    const { y, h, gap, right } = LAYOUT.cornerButtons;
    const sndW = 72;
    const helpW = 52;
    const snd = new Button(this, {
      x: right - sndW / 2, y, w: sndW, h, text: Audio.muted ? 'OFF' : 'SND', size: 14, system: true, depth: 30,
      onPress: () => snd.setText(Audio.toggleMute() ? 'OFF' : 'SND'),
    });
    new Button(this, {
      x: right - sndW - gap - helpW / 2, y, w: helpW, h, text: '?', size: 20, textColor: COLORS.textGold, system: true, depth: 30,
      onPress: () => {
        if (this.overlayOpen) return;
        this.overlayOpen = true;
        showHowTo(this, () => (this.overlayOpen = false));
      },
    });
  }

  setActiveTurn(active) {
    for (const c of [this.scottChar, this.enemyChar]) {
      if (c.glow) c.glow.active = c === active;
    }
  }

  say(text, speaker = null, opts) {
    this.phase = 'dialog';
    return this.dialog.say(text, speaker, opts);
  }

  sayLine(line) {
    return this.say(line.text, line.speaker ?? null);
  }

  /** Bars go in a speech bubble over the speaker, not the bottom panel. */
  async spit(couplet, who) {
    const isScott = who === 'scott';
    this.phase = 'bars';
    this.bubbleSpeaker = isScott ? SCOTT.short : this.def.short;
    await spitBars(this, this.bus, {
      couplet,
      speaker: this.bubbleSpeaker,
      character: isScott ? this.scottChar : this.enemyChar,
      side: isScott ? 'right' : 'left',
      tagColor: isScott ? '#ffd166' : DISS_TYPES[this.def.type]?.color,
      instant: DEBUG.fast,
    });
    this.bubbleSpeaker = null;
  }

  // ---- Turn loop ----------------------------------------------------------

  async run() {
    await wait(this, LAYOUT.entrance.ms + 100);
    for (const line of this.def.script.intro) await this.sayLine(line);

    for (this.round = 1; ; this.round += 1) {
      await this.scottTurn(this.round === 1);
      if (this.enemy.clout <= 0) return this.finish('victory');
      await this.enemyTurn();
      if (this.scott.clout <= 0) return this.finish('defeat');
      await this.endOfRound();
    }
  }

  async scottTurn(isFirstTurn) {
    this.setActiveTurn(this.scottChar);
    const flow = startOfTurnFlow(this.scott, isFirstTurn);
    this.scottHud.refresh();
    if (flow.kind === 'drain') {
      const ended = flow.expired.map((s) => `\n${s.endMsg}`).join('');
      await this.say(flow.drained.map((s) => s.drainMsg).join('\n') + ended);
    }

    for (;;) {
      const action = await this.chooseAction();
      if (action.kind === 'run') {
        await this.say(SCOTT.lines.run); // doesn't use the turn
        continue;
      }
      if (action.kind === 'item') return this.useItem(action.item);
      if (action.kind === 'stall') return this.say(SCOTT.lines.stall);
      if (action.kind === 'mic') return this.attack(SCOTT.micDrop, null);
      if (action.move.applyStatus) return this.useBuff(action.move);
      return this.attack(action.move, action.target);
    }
  }

  async enemyTurn() {
    const { enemy, scott, def } = this;
    this.setActiveTurn(this.enemyChar);
    const move = chooseEnemyMove(enemy, scott, rng);
    this.phase = 'anim';
    this.dialog.show(`${def.short} fires back with ${move.name}!${move.target ? `\nTarget: ${move.target}` : ''}`);
    await wait(this, 850);
    await lunge(this, this.enemyChar, LAYOUT.enemyLunge);
    await this.spit(pickCouplet(move.bars, rng.fx), 'enemy');

    const hit = resolveHit(scott, move.type, move.target);
    const dmg = rollDamage({
      power: move.power, hitMult: hit.mult, attacker: enemy, defender: scott,
      variance: DAMAGE.enemyVariance, rng,
    });
    applyDamage(scott, dmg);
    this.addCrowd(hit.id === 'crit' ? CROWD.enemyCritHit : CROWD.enemyHit);
    this.dialog.hide();
    hitFx(this, this.scottChar, scott, dmg, hit);
    this.scottHud.refresh();

    const msg = this.hitMessage(HIT_TEXT.onScott, SCOTT, move.type, move.target, hit);
    if (msg) await this.say(msg);
    else await wait(this, 500);

    if (move.applyStatus && !scott.statuses.has(move.applyStatus) && scott.clout > 0) {
      const status = scott.statuses.apply(move.applyStatus);
      this.scottHud.refresh();
      await this.say(status.applyMsg);
    }
  }

  async endOfRound() {
    for (const [battler, character] of [[this.scott, this.scottChar], [this.enemy, this.enemyChar]]) {
      for (const status of battler.statuses.tick()) {
        reTint(character, battler);
        this.scottHud.refresh();
        this.enemyHud.refresh();
        if (status.endMsg) await this.say(status.endMsg);
      }
    }
  }

  // ---- $cott's actions ----------------------------------------------------

  async attack(move, target) {
    const { scott, enemy, def } = this;
    const isMic = !!move.finisher;
    if (!isMic) {
      scott.flow -= move.cost;
      this.scottHud.refresh();
    }

    this.dialog.hide();
    this.phase = 'timing';
    const title = `$COTT SPITS ${move.name}!${target ? ` · ${target}` : ''}`;
    const rating = await this.timing.play({ speed: move.speed, title, perfect: DEBUG.perfect });
    this.phase = 'anim';
    this.dialog.show(`$COTT spits ${move.name}!${target ? `\nTarget: ${target}` : ''}`);
    await lunge(this, this.scottChar, LAYOUT.scottLunge);
    await this.spit(scottBarsFor(def, move, target, rng.fx), 'scott');

    const hit = isMic ? { ...HIT_KINDS.normal, softSpot: null } : resolveHit(enemy, move.type, target);
    const dmg = rollDamage({
      power: move.power, timingMult: rating.mult, hitMult: hit.mult,
      attacker: scott, defender: enemy, variance: DAMAGE.scottVariance, rng,
    });
    applyDamage(enemy, dmg);
    if (isMic) {
      this.crowd.reset(); // using Drop the Mic empties the meter (§5.5)
      this.crowdMeter.refresh();
    } else {
      this.addCrowd(rating.crowd + hit.crowd);
    }
    this.dialog.hide();
    hitFx(this, this.enemyChar, enemy, dmg, hit);
    if (rating.crowd >= CROWD.bigHitJump || hit.mult > 1 || isMic) this.crowdJump();
    discover(enemy, move.type, hit);
    this.enemyHud.refresh();

    const msg = isMic ? null : this.hitMessage(HIT_TEXT.onEnemy, def, move.type, target, hit);
    if (msg) await this.say(msg);
    else await wait(this, 550);
    if (isMic && enemy.clout > 0) await this.say(SCOTT.lines.micDropped);

    if (enemy.clout > 0) {
      for (const trigger of checkStatusTriggers(enemy)) {
        reTint(this.enemyChar, enemy);
        this.cameras.main.flash(250, 255, 80, 80);
        this.enemyHud.refresh();
        await this.say(trigger.msg ?? STATUSES[trigger.status].applyMsg);
      }
    }
  }

  async useBuff(move) {
    this.scott.flow -= move.cost;
    this.scottHud.refresh();
    this.phase = 'anim';
    this.dialog.show(`$COTT MONEY spits ${move.name}!`);
    await wait(this, 400);
    await lunge(this, this.scottChar, LAYOUT.scottLunge);
    await this.spit(scottBarsFor(this.def, move, null, rng.fx), 'scott');
    const status = this.scott.statuses.apply(move.applyStatus);
    Audio.sfx('buff');
    reTint(this.scottChar, this.scott);
    this.addCrowd(CROWD.mooning);
    this.scottHud.refresh();
    await this.say(status.applyMsg);
  }

  async useItem(id) {
    const item = ITEMS[id];
    this.scott.items[id] -= 1;
    restore(this.scott, item.restore);
    Audio.sfx('heal');
    this.scottHud.refresh();
    await this.say(item.line);
  }

  // ---- Menus --------------------------------------------------------------

  async chooseAction() {
    this.dialog.hide();
    for (;;) {
      this.phase = 'menu';
      const { scott, crowd } = this;
      const ready = crowd.full;
      const affordable = SCOTT.moves.some((m) => scott.flow >= m.cost);
      const hasItems = Object.values(scott.items).some((n) => n > 0);
      const bag = SCOTT.items.map((id) => `${ITEMS[id].short} x${scott.items[id]}`).join('  ');
      const options = [
        { id: 'diss', text: 'DISS', sub: 'Spit some bars', accent: GOLD, textColor: '#ffd166' },
        { id: 'bag', text: 'BAG', sub: bag, accent: 0x4cc9f0, textColor: '#4cc9f0' },
        ready
          ? { id: 'mic', text: 'MIC DROP', sub: 'Finisher ready', accent: 0xff5c8a, fill: GOLD, textColor: '#1a1030', subColor: '#1a1030' }
          : { id: 'mic', text: 'MIC DROP', sub: `Crowd at ${Math.round(crowd.value)}%`, accent: 0xff5c8a, textColor: '#ff5c8a', enabled: false, disabledMsg: SCOTT.lines.micNotReady },
        // Soft-lock guard: with no Flow for any diss, no items, and no mic,
        // RUN (which doesn't use the turn) becomes STALL (which does).
        !affordable && !hasItems && !ready
          ? { id: 'stall', text: 'STALL', sub: 'Catch your breath.', textColor: '#b9acdf' }
          : { id: 'run', text: 'RUN', sub: 'Pivot. Strategically.', textColor: '#b9acdf' },
      ];

      const pick = await this.menu.choose(options, { prompt: "WHAT'S THE PLAY, $COTT?" });
      if (pick === 'run') return { kind: 'run' };
      if (pick === 'stall') return { kind: 'stall' };
      if (pick === 'mic') return { kind: 'mic' };
      if (pick === 'bag') {
        const item = await this.chooseItem();
        if (item) return { kind: 'item', item };
      }
      if (pick === 'diss') {
        const diss = await this.chooseDiss();
        if (diss) return diss;
      }
    }
  }

  async chooseDiss() {
    for (;;) {
      const { flow, maxFlow } = this.scott;
      const options = SCOTT.moves.map((m) => {
        const type = DISS_TYPES[m.type];
        return {
          id: m.id,
          text: m.name,
          sub: `${m.type}${m.applyStatus ? ' (buff)' : ''} · ${m.cost} Flow`,
          subColor: type.color,
          accent: hexColor(type.color),
          enabled: flow >= m.cost,
          disabledMsg: SCOTT.lines.noFlow,
        };
      });
      options.push({ id: 'back', text: 'BACK' });
      const id = await this.menu.choose(options, { prompt: `PICK YOUR BARS. FLOW: ${flow}/${maxFlow}` });
      if (id === 'back') return null;

      const move = SCOTT.moves.find((m) => m.id === id);
      if (move.applyStatus) return { kind: 'move', move, target: null };
      const target = await this.chooseTarget(move);
      if (target) return { kind: 'move', move, target };
    }
  }

  async chooseTarget(move) {
    const type = DISS_TYPES[move.type];
    const known = this.enemy.discovered.softSpots;
    const options = type.targets.map((t) => {
      const soft = known.has(softSpotKey(move.type, t));
      return {
        id: t,
        text: t,
        sub: soft ? 'Soft spot' : TARGET_INFO[t],
        textColor: soft ? '#ffd166' : COLORS.text,
        subColor: soft ? '#ffd166' : '#cfc3ef',
        accent: soft ? GOLD : hexColor(type.color),
      };
    });
    options.push({ id: 'back', text: 'BACK' });
    const id = await this.menu.choose(options, { prompt: `AIM YOUR ${move.type} AT...`, columns: options.length > 4 ? 3 : 2 });
    return id === 'back' ? null : id;
  }

  async chooseItem() {
    const options = SCOTT.items.map((id) => {
      const item = ITEMS[id];
      return {
        id,
        text: `${item.name.toUpperCase()} x${this.scott.items[id]}`,
        sub: item.desc,
        textColor: item.color,
        accent: hexColor(item.color),
        enabled: this.scott.items[id] > 0,
        disabledMsg: item.emptyMsg,
      };
    });
    options.push({ id: 'back', text: 'BACK' });
    const id = await this.menu.choose(options, { prompt: 'THE BAG. MOSTLY RECEIPTS.', columns: 1 });
    return id === 'back' ? null : id;
  }

  // ---- Helpers ------------------------------------------------------------

  /** The line after a hit, from battleText.js templates; null for a plain hit. */
  hitMessage(templates, defenderDef, type, target, hit) {
    if (hit.id === 'normal') return null;
    if (hit.id === 'resisted') return defenderDef.resistMsg?.[type] ?? templates.resisted;
    const template = templates[hit.id];
    const text = Array.isArray(template) ? rng.fx.pick(template) : template;
    return fill(text, {
      enemy: this.def.short,
      target,
      targetLower: target?.toLowerCase(),
      type,
      why: hit.softSpot?.msg ?? '',
    }).trimEnd();
  }

  addCrowd(amount) {
    this.crowd.add(amount);
    this.crowdMeter.refresh();
  }

  async finish(result) {
    this.result = result;
    this.setActiveTurn(null);
    const won = result === 'victory';
    const loser = won ? this.enemyChar : this.scottChar;
    loser.bob.stop();
    if (won) {
      Audio.sfx('crit');
      this.crowdJump();
      this.tweens.add({ targets: loser.sprite, alpha: 0, y: '+=30', angle: -20, duration: 800 });
    } else {
      Audio.sfx('bad');
      this.tweens.add({ targets: loser.sprite, angle: 90, y: '+=24', alpha: 0.5, duration: 700 });
    }
    for (const line of won ? this.def.script.victory : this.def.script.defeat) await this.sayLine(line);
    this.dialog.hide();
    if (won && this.regionId) Save.clearRegion(this.regionId);
    this.showEndScreen(won);
  }

  showEndScreen(won) {
    this.overlayOpen = true;
    const screen = this.def.endScreen[won ? 'victory' : 'defeat'];
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x07040f, 0.9).setOrigin(0).setDepth(50).setInteractive();
    label(this, GAME_W / 2, 340, screen.title, 48, {
      color: won ? '#ffd166' : '#ff5c8a',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(51);
    const text = fill(screen.body, { soft: this.enemy.discovered.softSpots.size, softTotal: this.def.softSpots.length });
    body(this, GAME_W / 2, 444, text, 44, { color: '#f2eaff', align: 'center', wordWrap: { width: 632 } })
      .setOrigin(0.5, 0)
      .setDepth(51);
    this.phase = 'over';
    // A win heads back to the map (which reveals what just opened); a loss
    // offers the rematch first.
    const toMap = () => this.scene.start('Overworld', { justCleared: won && this.firstClear ? this.regionId : null });
    const rematch = () => this.scene.restart({ enemy: this.enemyId, region: this.regionId });
    const [first, second] = won
      ? [{ text: 'CONTINUE', onPress: toMap }, { text: 'RUN IT BACK', onPress: rematch }]
      : [{ text: 'RUN IT BACK', onPress: rematch }, { text: 'MAP', onPress: toMap }];
    new Button(this, { x: GAME_W / 2, y: 1000, w: 440, h: 112, size: 24, accent: GOLD, textColor: '#ffd166', depth: 60, ...first });
    new Button(this, { x: GAME_W / 2, y: 1140, w: 440, h: 80, size: 18, depth: 60, ...second });
  }

  /** Read by the debug hook / smoke test. */
  debugState() {
    return {
      phase: this.phase,
      result: this.result,
      round: this.round,
      overlay: this.overlayOpen,
      bubble: this.bubbleSpeaker,
      crowd: this.crowd.value,
      scott: { clout: this.scott.clout, flow: this.scott.flow, statuses: this.scott.statuses.list().map((s) => s.id) },
      enemy: { id: this.enemy.id, clout: this.enemy.clout, statuses: this.enemy.statuses.list().map((s) => s.id) },
    };
  }
}
