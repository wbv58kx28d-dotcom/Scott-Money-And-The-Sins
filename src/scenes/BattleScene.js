// Battle: $cott vs. one villain (CLAUDE.md §5).
//
// The whole fight is one async loop. Every dialog line, menu, and timing bar
// is an `await`, so the turn order reads top to bottom (HANDOFF quirk: keep it).
// Rules and numbers come from src/data/ and src/systems/combat.js; this scene
// only sequences them and draws the results.

import { COLORS, LAYOUT, RESULT_COLORS } from '../config.js';
import SCOTT from '../data/scott.js';
import { ENEMIES, DEFAULT_ENEMY } from '../data/enemies/index.js';
import { DISS_TYPES } from '../data/types.js';
import { ITEMS } from '../data/items.js';
import { STATUSES } from '../data/statuses.js';
import { CROWD, DAMAGE } from '../data/rules.js';
import {
  createBattler, resolveHit, rollDamage, discover, applyDamage, restore,
  startOfTurnFlow, checkStatusTriggers, scottBarsFor, softSpotKey,
} from '../systems/combat.js';
import { chooseEnemyMove } from '../systems/ai.js';
import { Crowd } from '../systems/crowd.js';
import { rng } from '../systems/rng.js';
import { Audio } from '../systems/audio.js';
import { DEBUG } from '../systems/debug.js';
import { TapBus } from '../ui/tapBus.js';
import { DialogBox } from '../ui/dialog.js';
import { Menu } from '../ui/menu.js';
import { TimingBar } from '../ui/timingBar.js';
import { EnemyHud, ScottHud, CrowdMeter } from '../ui/hud.js';
import { drawPanel } from '../ui/panel.js';
import { floatText, headPoint, lunge, hitShake, wait } from '../ui/fx.js';
import { label } from '../ui/text.js';

const GOLD = 0xf4d35e;
const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  init(data) {
    this.enemyId = ENEMIES[data?.enemy] ? data.enemy : DEFAULT_ENEMY;
  }

  create() {
    this.buttons = new Set();
    this.phase = 'intro';
    this.result = null;
    this.round = 0;
    this.pendingCrowdFull = false;

    const def = ENEMIES[this.enemyId];
    this.def = def;
    this.scott = createBattler(SCOTT);
    this.enemy = createBattler(def);
    this.crowd = new Crowd();

    this.add.image(0, 0, def.background).setOrigin(0);
    this.enemyChar = this.makeCharacter(def.texture, LAYOUT.enemySlots[0], 0);
    this.scottChar = this.makeCharacter(SCOTT.texture, LAYOUT.scott, 300);

    this.enemyHud = new EnemyHud(this, this.enemy);
    this.crowdMeter = new CrowdMeter(this, this.crowd);
    this.scottHud = new ScottHud(this, this.scott);
    drawPanel(this, LAYOUT.panel);

    this.bus = new TapBus(this);
    this.dialog = new DialogBox(this, this.bus, { instant: DEBUG.fast });
    this.menu = new Menu(this);
    this.timing = new TimingBar(this, this.bus);

    Audio.startBeat();
    this.events.once('shutdown', () => Audio.stopBeat());
    this.cameras.main.fadeIn(250, 0, 0, 0);

    this.run().catch((err) => {
      console.error('[$cott] battle loop crashed', err);
      this.phase = 'error';
    });
  }

  /** A character is a container at the feet holding a feet-origin sprite. */
  makeCharacter(texture, { x, y }, bobDelay) {
    const container = this.add.container(x, y);
    const sprite = this.add.image(0, 0, texture).setOrigin(0.5, 1);
    container.add(sprite);
    const { px, ms } = LAYOUT.idleBob;
    this.tweens.add({ targets: sprite, y: -px, duration: ms / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: bobDelay });
    // Active-turn glow is WebGL-only (CLAUDE.md §8.1).
    let glow = null;
    if (sprite.preFX) {
      sprite.preFX.setPadding(12);
      glow = sprite.preFX.addGlow(COLORS.glow, 4, 0, false);
      glow.active = false;
    }
    return { container, sprite, glow };
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

  // ---- Turn loop ----------------------------------------------------------

  async run() {
    for (const line of this.def.script.intro) await this.say(line.text, line.speaker ?? null);

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
    if (flow.kind === 'regen' && flow.amount > 0) {
      const p = headPoint(this.scottChar);
      floatText(this, p.x, p.y, `+${flow.amount} FLOW`, { color: COLORS.textCool, size: 20 });
    }
    if (flow.kind === 'drain') {
      Audio.sfx('debuff');
      const rug = this.scott.statuses.get('rugPulled');
      await this.say(fill(rug.def.drainMsg, { name: SCOTT.short, n: flow.amount }), null, { color: COLORS.textBad });
    }

    for (;;) {
      const action = await this.chooseAction();
      if (action.kind === 'run') {
        await this.say(SCOTT.lines.run); // doesn't use the turn
        continue;
      }
      if (action.kind === 'item') return this.useItem(action.item);
      if (action.kind === 'stall') return this.say(SCOTT.lines.stall);
      if (action.move.type === 'HYPE') return this.useBuff(action.move);
      return this.diss(action.move, action.target);
    }
  }

  async enemyTurn() {
    const { enemy, scott, def } = this;
    this.setActiveTurn(this.enemyChar);
    const move = chooseEnemyMove(enemy, scott, rng);
    await this.say(`${def.short} hits back with ${move.name.toUpperCase()}!`);
    await this.say(move.bars, def.short);
    this.dialog.hide();
    this.phase = 'anim';

    if (move.heal) {
      const { clout } = restore(enemy, { clout: move.heal });
      Audio.sfx('heal');
      const p = headPoint(this.enemyChar);
      floatText(this, p.x, p.y, `+${clout}`, { color: COLORS.textGood, size: 34 });
      this.enemyHud.refresh();
      await wait(this, 500);
      await this.say(clout > 0 ? `${def.short} recovers ${clout} Clout.` : `${def.short} is already at full Clout.`);
      return;
    }

    await lunge(this, this.enemyChar, LAYOUT.enemyLunge);
    const hit = resolveHit(scott, move.type, move.target);
    const dmg = rollDamage({
      power: move.power, hitMult: hit.mult, attacker: enemy, defender: scott,
      variance: DAMAGE.enemyVariance, rng,
    });
    applyDamage(scott, dmg);
    Audio.sfx('hurt');
    hitShake(this, this.scottChar, hit.id === 'crit' ? 16 : 10);
    this.popDamage(this.scottChar, dmg, hit);
    this.addCrowd(hit.id === 'crit' ? CROWD.enemyCritHit : CROWD.enemyHit);
    this.scottHud.refresh();
    await wait(this, 550);

    const msg = this.hitMessage(SCOTT, hit);
    if (msg) await this.say(msg, null, { color: RESULT_COLORS[hit.id] });
    if (move.applyStatus && scott.clout > 0) {
      const status = scott.statuses.apply(move.applyStatus);
      Audio.sfx('debuff');
      this.scottHud.refresh();
      await this.say(fill(status.applyMsg, { name: SCOTT.short }), null, { color: status.color });
    }
  }

  async endOfRound() {
    for (const battler of [this.scott, this.enemy]) {
      for (const status of battler.statuses.tick()) {
        if (status.endMsg) await this.say(fill(status.endMsg, { name: battler.short }));
      }
    }
    this.scottHud.refresh();
    this.enemyHud.refresh();
  }

  // ---- $cott's actions ----------------------------------------------------

  async diss(move, target) {
    const { scott, enemy, def } = this;
    scott.flow -= move.cost;
    this.scottHud.refresh();
    if (move.finisher) {
      this.crowd.reset(); // using Drop the Mic empties the meter (§5.5)
      this.crowdMeter.refresh();
    }

    this.dialog.hide();
    this.phase = 'timing';
    const title = move.finisher ? move.name : `${move.name} on ${target}`;
    const rating = await this.timing.play({ speed: move.speed, title, perfect: DEBUG.perfect });
    Audio.sfx(rating.id);
    const sp = headPoint(this.scottChar);
    floatText(this, sp.x, sp.y, `${rating.id}!`, { color: RESULT_COLORS[rating.id], size: 30 });
    if (!move.finisher) this.addCrowd(rating.crowd);

    await this.say(scottBarsFor(def, move, target), SCOTT.short);
    this.dialog.hide();
    this.phase = 'anim';

    await lunge(this, this.scottChar, LAYOUT.scottLunge);
    const hit = resolveHit(enemy, move.type, target);
    const dmg = rollDamage({
      power: move.power, timingMult: rating.mult, hitMult: hit.mult,
      attacker: scott, defender: enemy, variance: DAMAGE.scottVariance, rng,
    });
    applyDamage(enemy, dmg);
    Audio.sfx(move.finisher ? 'mic' : hit.id === 'crit' ? 'crit' : 'hit');
    hitShake(this, this.enemyChar, hit.id === 'crit' || move.finisher ? 18 : 10);
    if (move.finisher) this.cameras.main.shake(260, 0.012);
    this.popDamage(this.enemyChar, dmg, hit);
    discover(enemy, move.type, hit);
    if (!move.finisher) this.addCrowd(hit.crowd);
    this.enemyHud.refresh();
    await wait(this, 550);

    const msg = this.hitMessage(def, hit);
    if (msg) await this.say(msg, null, { color: RESULT_COLORS[hit.id] });
    if (enemy.clout > 0) {
      for (const trigger of checkStatusTriggers(enemy)) {
        Audio.sfx('buff');
        this.enemyHud.refresh();
        const status = STATUSES[trigger.status];
        await this.say(trigger.msg ?? fill(status.applyMsg, { name: def.short }), null, { color: status.color });
      }
    }
    await this.announceCrowd();
  }

  async useBuff(move) {
    this.scott.flow -= move.cost;
    this.scottHud.refresh();
    await this.say(SCOTT.lines.mooning, SCOTT.short);
    const status = this.scott.statuses.apply(move.applyStatus);
    Audio.sfx('buff');
    const p = headPoint(this.scottChar);
    floatText(this, p.x, p.y, `${status.tag}!`, { color: status.color, size: 26 });
    this.scottHud.refresh();
    await this.say(fill(status.applyMsg, { name: SCOTT.short }), null, { color: status.color });
  }

  async useItem(id) {
    const item = ITEMS[id];
    this.scott.items[id] -= 1;
    const gained = restore(this.scott, item.restore);
    Audio.sfx('heal');
    const p = headPoint(this.scottChar);
    const parts = [];
    if (gained.clout) parts.push(`+${gained.clout} CLOUT`);
    if (gained.flow) parts.push(`+${gained.flow} FLOW`);
    floatText(this, p.x, p.y, parts.join(' ') || 'MAXED', { color: COLORS.textGood, size: 22 });
    this.scottHud.refresh();
    await this.say(item.line);
  }

  // ---- Menus --------------------------------------------------------------

  async chooseAction() {
    this.dialog.hide();
    for (;;) {
      this.phase = 'menu';
      const canDiss = SCOTT.moves.some((m) => this.canUse(m));
      const hasItems = Object.values(this.scott.items).some((n) => n > 0);
      const options = [
        { id: 'diss', text: 'DISS', sub: this.crowd.full ? 'MIC READY!' : null, accent: this.crowd.full ? GOLD : null },
        { id: 'items', text: 'ITEMS', enabled: hasItems },
        { id: 'run', text: 'RUN', sfx: 'back' },
      ];
      // Soft-lock guard: no affordable diss and no items left.
      if (!canDiss && !hasItems) options.push({ id: 'stall', text: 'STALL', sub: 'catch your breath' });

      const pick = await this.menu.choose(options, { prompt: "WHAT'S THE PLAY?", columns: options.length === 4 ? 2 : 3 });
      if (pick === 'run') return { kind: 'run' };
      if (pick === 'stall') return { kind: 'stall' };
      if (pick === 'items') {
        const item = await this.chooseItem();
        if (item) return { kind: 'item', item };
      }
      if (pick === 'diss') {
        const diss = await this.chooseDiss();
        if (diss) return diss;
      }
    }
  }

  canUse(move) {
    return move.finisher ? this.crowd.full : this.scott.flow >= move.cost;
  }

  async chooseDiss() {
    for (;;) {
      const options = SCOTT.moves.map((m) => ({
        id: m.id,
        text: m.name.toUpperCase(),
        sub: m.finisher ? (this.crowd.full ? 'FINISHER · FREE' : 'NEEDS FULL CROWD') : `${m.type} · ${m.cost} FLOW`,
        enabled: this.canUse(m),
        accent: m.finisher && this.crowd.full ? GOLD : null,
      }));
      options.push({ id: 'back', text: 'BACK', sfx: 'back' });
      const id = await this.menu.choose(options, { prompt: 'PICK A DISS' });
      if (id === 'back') return null;

      const move = SCOTT.moves.find((m) => m.id === id);
      if (move.type === 'HYPE' || move.finisher) return { kind: 'diss', move, target: null };
      const target = await this.chooseTarget(move);
      if (target) return { kind: 'diss', move, target };
    }
  }

  async chooseTarget(move) {
    const known = this.enemy.discovered.softSpots;
    const options = DISS_TYPES[move.type].targets.map((t) => {
      const soft = known.has(softSpotKey(move.type, t));
      return { id: t, text: t, sub: soft ? 'SOFT SPOT' : null, accent: soft ? 0xff4d6d : null };
    });
    options.push({ id: 'back', text: 'BACK', sfx: 'back' });
    const id = await this.menu.choose(options, { prompt: `${move.type}: AIM AT...`, columns: options.length > 4 ? 3 : 2 });
    return id === 'back' ? null : id;
  }

  async chooseItem() {
    const options = SCOTT.items.map((id) => {
      const item = ITEMS[id];
      const gives = Object.entries(item.restore).map(([stat, n]) => `+${n} ${stat.toUpperCase()}`).join(' ');
      return { id, text: item.name.toUpperCase(), sub: `x${this.scott.items[id]} · ${gives}`, enabled: this.scott.items[id] > 0 };
    });
    options.push({ id: 'back', text: 'BACK', sfx: 'back' });
    const id = await this.menu.choose(options, { prompt: 'ITEMS', columns: 1 });
    return id === 'back' ? null : id;
  }

  // ---- Helpers ------------------------------------------------------------

  popDamage(character, dmg, hit) {
    const p = headPoint(character);
    floatText(this, p.x, p.y, `-${dmg}`, { color: RESULT_COLORS[hit.id], size: hit.id === 'crit' ? 46 : 36 });
    if (hit.label) floatText(this, p.x, p.y - 56, hit.label, { color: RESULT_COLORS[hit.id], size: 20, delay: 120 });
  }

  /** The line shown after a hit: soft spot first, then weak/resisted. */
  hitMessage(defenderDef, hit) {
    if (hit.softSpot) return hit.softSpot.msg;
    if (hit.id === 'weak') return defenderDef.messages.weak;
    if (hit.id === 'resisted') return defenderDef.messages.resisted;
    return null;
  }

  addCrowd(amount) {
    const { becameFull } = this.crowd.add(amount);
    this.crowdMeter.refresh();
    if (becameFull) {
      this.pendingCrowdFull = true;
      Audio.sfx('crowd');
    }
  }

  async announceCrowd() {
    if (!this.pendingCrowdFull) return;
    this.pendingCrowdFull = false;
    await this.say(SCOTT.lines.crowdFull, null, { color: COLORS.textGold });
  }

  async finish(result) {
    this.result = result;
    this.setActiveTurn(null);
    Audio.stopBeat();
    const loser = result === 'victory' ? this.enemyChar : this.scottChar;
    this.tweens.add({ targets: loser.sprite, alpha: 0, angle: result === 'victory' ? -12 : 12, duration: 700 });
    Audio.sfx(result);

    const lines = result === 'victory' ? this.def.script.victory : this.def.script.defeat;
    for (const line of lines) await this.say(line.text, line.speaker ?? null);
    this.dialog.hide();

    const won = result === 'victory';
    label(this, 360, 560, won ? 'VICTORY' : 'COOKED', 56, {
      color: won ? COLORS.textGold : COLORS.textBad,
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(60);

    this.phase = 'over';
    const pick = await this.menu.choose(
      [{ id: 'again', text: 'RUN IT BACK' }, { id: 'title', text: 'TITLE', sfx: 'back' }],
      { prompt: won ? 'PROLOGUE CLEARED' : 'TRY AGAIN?' },
    );
    if (pick === 'again') this.scene.restart({ enemy: this.enemyId });
    else this.scene.start('Title');
  }

  /** Read by the debug hook / smoke test. */
  debugState() {
    return {
      phase: this.phase,
      result: this.result,
      round: this.round,
      crowd: this.crowd.value,
      scott: { clout: this.scott.clout, flow: this.scott.flow, statuses: this.scott.statuses.list().map((s) => s.id) },
      enemy: { id: this.enemy.id, clout: this.enemy.clout, statuses: this.enemy.statuses.list().map((s) => s.id) },
    };
  }
}
