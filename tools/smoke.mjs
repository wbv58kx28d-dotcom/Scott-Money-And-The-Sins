// Smoke test: serve the repo, load the game in headless Chromium on a phone-
// sized touch viewport, play full battles through debug mode, and save
// screenshots to tools/screenshots/. Exits non-zero on any failure.
//
//   npm i            (once; installs Playwright as a dev dependency)
//   npm run smoke
//
// If Playwright can't find a browser, point it at one:
//   CHROMIUM_PATH=/path/to/chrome npm run smoke
//
// Headless Chromium has no GPU: WebGL falls back to software and runs at a few
// frames a second, which makes timing-based checks flaky. Every step but the
// scripted battle (which checks the WebGL renderer) loads with &canvas=1, the
// Canvas renderer, which holds 60 fps headless. Checks should also wait on
// game state (page.waitForFunction) rather than sleep a fixed time.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'tools', 'screenshots');
const GAME_W = 720;
const STEP_MS = 90;
const BATTLE_TIMEOUT_MS = 120_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.css': 'text/css',
  '.md': 'text/plain; charset=utf-8',
};

function serve() {
  const server = http.createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Missing art falls back to placeholders and an unreachable Google Fonts
// falls back after 2.5 s, so those are warnings, not failures.
const warnings = new Set();
function isExpectedError(msg) {
  const url = msg.location()?.url ?? '';
  if (!msg.text().startsWith('Failed to load resource')) return false;
  if (/\/assets\//.test(url)) warnings.add(`missing art (placeholder used): ${new URL(url).pathname}`);
  else if (/fonts\.(googleapis|gstatic)\.com/.test(url)) warnings.add('Google Fonts unreachable (fallback fonts used)');
  else return false;
  return true;
}

async function newPage(browser, errors) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isExpectedError(msg)) errors.push(`console: ${msg.text()}`);
  });
  return page;
}

/** Tap at game coordinates (720×1280 space), mapped through FIT scaling. */
async function tapGame(page, gx, gy) {
  const box = await page.locator('canvas').boundingBox();
  const s = box.width / GAME_W;
  await page.touchscreen.tap(box.x + gx * s, box.y + gy * s);
}

const state = (page) => page.evaluate(() => window.__smm?.state() ?? null);

/**
 * The swamp is big (3200×5248): walk most of the way to an NPC with the
 * scene's own pathing, so the taps that follow land on someone on screen.
 */
async function walkNear(page, id) {
  await page.evaluate((npcId) => {
    const scene = window.__smm.game.scene.getScene('Region');
    const n = scene.npcs.find((x) => x.id === npcId);
    scene.walkTo(n.x, n.y + 130);
  }, id);
  for (let i = 0; i < 400 && (await state(page)).walking; i++) await sleep(150);
}

/**
 * Go through a door (an exit to another map): walk most of the way with the
 * scene's own pathing, since the door can start far off screen, then tap the
 * door itself until $cott walks in and the next map is up.
 */
async function goThroughDoor(page, to) {
  let s = await state(page);
  const exit = s.exits.find((e) => e.to === to);
  if (!exit) throw new Error(`region: no door to ${to} on ${s.map}`);
  if (!exit.open) {
    // A hidden door (Derek's cellar): find it the way the WIFI app's TRACE does (step 5d plays the app itself).
    await page.evaluate((door) => {
      const scene = window.__smm.game.scene.getScene('Region');
      const e = scene.map.exits.find((x) => x.to === door);
      scene.traceSecret(e.secret);
      scene.revealSecret(e.secret);
    }, to);
  }
  await page.evaluate((to) => {
    const scene = window.__smm.game.scene.getScene('Region');
    const e = scene.map.exits.find((x) => x.to === to);
    scene.walkTo(e.x + e.w / 2, e.y + e.h + 90);
  }, to);
  for (let i = 0; i < 400 && ((await state(page)).walking || (await state(page)).mode === 'talk'); i++) {
    if ((await state(page)).mode === 'talk') await tapGame(page, GAME_W / 2, 1170);
    await sleep(150);
  }
  const started = Date.now();
  for (s = await state(page); !(s.scene === 'Region' && s.map === to && s.mode === 'explore'); s = await state(page)) {
    if (Date.now() - started > 30_000) throw new Error(`region: never got through the door to ${to}`);
    if (s.scene === 'Region' && s.mode === 'talk') await tapGame(page, GAME_W / 2, 1170);
    else if (s.scene === 'Region' && s.mode === 'explore' && !s.walking) {
      const { tap } = s.exits.find((e) => e.to === to);
      await tapGame(page, tap.x, tap.y);
    }
    await sleep(250);
  }
  return s;
}

/**
 * In a walkable region: screenshot it, go down to Derek's basement if he's
 * there, tap the villain until $cott has walked over and started talking,
 * tap through the talk, then press FIGHT.
 */
async function walkToVillain(page, failures, { shots = true } = {}) {
  await page.waitForFunction(() => window.__smm.state().scene === 'Region', null, { timeout: 15_000 });
  await sleep(700);
  if (shots) await page.screenshot({ path: path.join(SHOTS, '11b-region.png') });
  let s = await state(page);
  if (!s.npcs.some((n) => n.id === 'derek')) {
    s = await goThroughDoor(page, 'start_lair');
    await sleep(500);
    if (shots) await page.screenshot({ path: path.join(SHOTS, '11b-region-basement.png') });
  }
  const started = Date.now();
  const start = s.player;
  while (s.mode === 'explore') {
    if (Date.now() - started > 30_000) throw new Error('region: never reached the villain');
    if (!s.walking) {
      const { tap } = s.npcs.find((n) => n.id === 'derek');
      await tapGame(page, Math.min(Math.max(tap.x, 10), GAME_W - 10), Math.min(Math.max(tap.y, 140), 1270));
    }
    await sleep(250);
    s = await state(page);
  }
  if (shots && Math.hypot(s.player.x - start.x, s.player.y - start.y) < 300) failures.push('region: $cott should have walked across the basement to Derek');
  if (shots) await page.screenshot({ path: path.join(SHOTS, '11c-region-talk.png') });
  for (let i = 0; i < 20; i++) {
    const fight = (await state(page)).buttons.find((b) => b.text === 'FIGHT');
    if (fight) return tapGame(page, fight.x, fight.y);
    await tapGame(page, GAME_W / 2, 1170);
    await sleep(250);
  }
  throw new Error('region: no FIGHT button after talking to Derek');
}

/** Hold a touch at game point `from`, slide it to `to`, keep it there `holdMs`, then lift. */
async function touchDrag(page, from, to, holdMs) {
  const box = await (await page.$('canvas')).boundingBox();
  const s = box.width / GAME_W;
  const pt = ({ x, y }) => [{ x: box.x + x * s, y: box.y + y * s, id: 1 }];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }) });
    await sleep(30);
  }
  const midway = await state(page);
  await sleep(holdMs);
  const held = await state(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
  return { midway, held, after: await state(page) };
}

/**
 * In a walkable region: walk to a local, take their challenge, and win it.
 * Beat challenges rely on &perfect=1; quiz answers and trades (the button a
 * sharp trader would press now) come from the debug state. A lost challenge
 * is simply taken again. `onTrade` gets a look at the trade minigame while its
 * market is open.
 */
async function winChallenge(page, id, accept, { onTrade } = {}) {
  await walkNear(page, id);
  const started = Date.now();
  let looked = false;
  for (;;) {
    if (Date.now() - started > 120_000) throw new Error(`region: never won ${id}'s challenge`);
    const s = await state(page);
    const npc = s.npcs.find((n) => n.id === id);
    if (s.mode === 'explore' && npc.won) return;
    if (s.mode === 'explore') {
      if (!s.walking) await tapGame(page, Math.min(Math.max(npc.tap.x, 10), GAME_W - 10), Math.min(Math.max(npc.tap.y, 140), 1270));
    } else {
      const buttons = s.buttons.filter((b) => !b.system);
      const answer = s.quizAnswer ?? s.tradeAnswer;
      const pick = buttons.find((b) => b.text === accept) ?? (answer && buttons.find((b) => b.text === answer));
      if (onTrade && !looked && s.trade?.phase === 'open' && s.trade.tick > 120) {
        looked = true;
        await onTrade(s);
      }
      if (pick) await tapGame(page, pick.x, pick.y);
      else if (!buttons.length && !s.trade) await tapGame(page, GAME_W / 2, 1170);
    }
    await sleep(200);
  }
}

/**
 * Play one battle to the end. `plan` is a list of button labels to press, in
 * order, whenever they show up; otherwise a simple policy picks.
 */
async function playBattle(page, { plan = [], shots = {}, label }) {
  const seen = new Set();
  const snap = async (key) => {
    if (!shots[key] || seen.has(key)) return;
    seen.add(key);
    await page.screenshot({ path: path.join(SHOTS, shots[key]) });
  };
  const queue = [...plan];
  const started = Date.now();
  let actions = 0;

  for (;;) {
    if (Date.now() - started > BATTLE_TIMEOUT_MS) throw new Error(`${label}: battle timed out`);
    const s = await state(page);
    if (!s || s.scene !== 'Battle') {
      await sleep(STEP_MS);
      continue;
    }
    if (s.phase === 'error') throw new Error(`${label}: battle loop crashed`);
    if (s.phase === 'over') {
      await sleep(400);
      await snap('over');
      return { ...s, actions };
    }

    // Corner buttons (? and SND) are "system" buttons; the policy skips them.
    const enabled = s.buttons.filter((b) => b.enabled && !b.system);
    if (s.phase === 'menu' && enabled.length && !s.overlay) {
      const has = (text) => enabled.find((b) => b.text === text || b.text.startsWith(`${text} x`));
      await snap(has('LAMBO LULLABY') ? 'dissMenu' : has('WEALTH') ? 'targetMenu' : has('COLD BREW') ? 'bagMenu' : 'menu');
      const planned = queue.length ? has(queue[0]) : null;
      if (planned) queue.shift();
      // Like a player: finish when the mic is ready, diss while there's Flow,
      // otherwise reach into the bag (or STALL once it's empty).
      const canDiss = s.scott.flow >= 8;
      const pick =
        planned ??
        has('MIC DROP') ??
        (canDiss ? has('DISS') : has('STALL') ?? has('BAG')) ??
        has('LAMBO LULLABY') ??
        has('CAP TABLE CLAPBACK') ??
        has('WEALTH') ??
        has('COLD BREW') ??
        has('HYPE MAN VOICEMAIL') ??
        enabled.find((b) => b.text !== 'BACK') ??
        enabled[0];
      await tapGame(page, pick.x, pick.y);
      actions += 1;
      await sleep(STEP_MS * 2);
      continue;
    }

    if (s.phase === 'bars') {
      await sleep(250); // let the bubble pop in
      await snap(s.bubble === '$COTT' ? 'scottBubble' : 'enemyBubble');
    }
    if (s.phase === 'timing') await snap('timing');
    if (s.phase === 'dialog') await snap('dialog');
    if (s.phase === 'dialog' && s.enemy.statuses.includes('shortSqueezed')) await snap('squeezed');
    // Nothing to tap during an animation.
    if (s.phase === 'anim') {
      await sleep(STEP_MS);
      continue;
    }
    // Dialog, bubble, or timing bar: tap an empty spot.
    await tapGame(page, 360, 560);
    actions += 1;
    await sleep(STEP_MS);
  }
}

async function main() {
  await fs.mkdir(SHOTS, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const failures = [];

  try {
    // 1. Title screen, no debug flags.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(base);
      await page.waitForSelector('canvas', { timeout: 15_000 });
      await sleep(3500); // fonts (2.5 s fallback) + preload
      await page.screenshot({ path: path.join(SHOTS, '01-title.png') });
      const debugHook = await page.evaluate(() => 'window.__smm' in window || !!window.__smm);
      if (debugHook) failures.push('title: debug hook exists without ?debug=1');
      failures.push(...errors.map((e) => `title: ${e}`));
      await page.context().close();
    }

    // 1b. With a save in progress, the title asks: CONTINUE, or START FRESH (two taps).
    {
      const errors = [];
      const page = await newPage(browser, errors);
      const url = `${base}?debug=1&canvas=1&title=1`;
      const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('scottmoney.save') ?? 'null'));
      const onTitle = async () => {
        await page.waitForFunction(() => window.__smm?.state().scene === 'Title', null, { timeout: 15_000 });
        await sleep(300);
        return (await state(page)).buttons.map((b) => b.text);
      };
      const press = async (text) => {
        const b = (await state(page)).buttons.find((x) => x.text === text);
        if (!b) throw new Error(`title: no ${text} button`);
        await tapGame(page, b.x, b.y);
        await sleep(300);
      };
      await page.goto(url);
      await page.evaluate(() => localStorage.removeItem('scottmoney.save'));
      await page.reload();
      if ((await onTitle()).length) failures.push('title: a fresh game should just say TAP TO START');
      await page.evaluate(() => localStorage.setItem('scottmoney.save', JSON.stringify({ v: 1, cash: 1234, won: ['start:brad'] })));
      await page.reload();
      const offered = await onTitle();
      if (!offered.includes('CONTINUE') || !offered.includes('START FRESH')) failures.push(`title: with a save, expected CONTINUE and START FRESH (got ${offered})`);
      await page.screenshot({ path: path.join(SHOTS, '01b-title-continue.png') });
      await press('CONTINUE');
      await page.waitForFunction(() => window.__smm.state().scene === 'Overworld', null, { timeout: 10_000 }).catch(() => failures.push('title: CONTINUE should go to the map'));
      if ((await saved())?.cash !== 1234) failures.push('title: CONTINUE should keep the save');
      await page.reload();
      await onTitle();
      await press('START FRESH');
      if ((await state(page)).scene !== 'Title' || (await saved())?.cash !== 1234) failures.push('title: one tap on START FRESH should only ask to confirm');
      await press('TAP AGAIN TO WIPE');
      await page.waitForFunction(() => window.__smm.state().scene === 'Overworld', null, { timeout: 10_000 }).catch(() => failures.push('title: START FRESH should go to the map'));
      const wiped = await saved();
      if (wiped?.cash !== 500 || wiped?.won?.length) failures.push(`title: START FRESH should wipe the save (${JSON.stringify(wiped)})`);
      console.log('title: CONTINUE kept the save; START FRESH wiped it after a confirm');
      failures.push(...errors.map((e) => `title: ${e}`));
      await page.context().close();
    }

    // 2. Seeded battle with PERFECT taps and a scripted opening.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(`${base}?debug=1&battle=derek&perfect=1&seed=123&fast=1`);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Battle', null, { timeout: 15_000 });
      const renderer = await page.evaluate(() => (window.__smm.game.renderer.type === 2 ? 'WebGL' : 'Canvas'));

      // The "?" cheat sheet opens over the menu and closes on a tap.
      for (let i = 0; i < 40 && (await state(page)).phase !== 'menu'; i++) {
        await tapGame(page, 360, 560);
        await sleep(STEP_MS);
      }
      const help = (await state(page)).buttons.find((b) => b.text === '?');
      if (!help) failures.push('perfect run: no ? button');
      else {
        await tapGame(page, help.x, help.y);
        await sleep(300);
        if (!(await state(page)).overlay) failures.push('perfect run: ? did not open the cheat sheet');
        await page.screenshot({ path: path.join(SHOTS, '10-how-to.png') });
        await tapGame(page, 360, 640);
        await sleep(300);
        if ((await state(page)).overlay) failures.push('perfect run: cheat sheet did not close');
      }

      const result = await playBattle(page, {
        label: 'perfect run',
        plan: ['MOONING', 'RUN', 'BAG', 'COLD BREW'],
        shots: {
          dialog: '02-intro.png',
          menu: '03-menu.png',
          dissMenu: '04-diss-menu.png',
          targetMenu: '05-target-menu.png',
          bagMenu: '05b-bag-menu.png',
          timing: '06-timing.png',
          scottBubble: '06b-scott-bars.png',
          enemyBubble: '06c-enemy-bars.png',
          squeezed: '07-short-squeezed.png',
          over: '08-victory.png',
        },
      });
      console.log(`perfect run: ${result.result} in ${result.round} rounds (${result.actions} taps), renderer ${renderer}, $cott ${result.scott.ego} Ego, Derek ${result.enemy.ego}`);
      if (result.result !== 'victory') failures.push(`perfect run: expected victory, got ${result.result}`);

      // Restart from the end screen.
      const again = result.buttons.find((b) => b.text === 'RUN IT BACK');
      if (!again) failures.push('perfect run: no RUN IT BACK button');
      else {
        await tapGame(page, again.x, again.y);
        await page.waitForFunction(() => window.__smm.state().phase === 'dialog' && window.__smm.state().round === 0, null, { timeout: 5000 })
          .catch(() => failures.push('perfect run: RUN IT BACK did not restart the battle'));
      }
      failures.push(...errors.map((e) => `perfect run: ${e}`));
      await page.context().close();
    }

    // 3. Real timing taps (no perfect flag): just has to finish cleanly.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(`${base}?debug=1&canvas=1&battle=derek&seed=7&fast=1`);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Battle', null, { timeout: 15_000 });
      const result = await playBattle(page, { label: 'timed run', shots: { over: '09-timed-end.png' } });
      console.log(`timed run: ${result.result} in ${result.round} rounds (${result.actions} taps)`);
      failures.push(...errors.map((e) => `timed run: ${e}`));
      await page.context().close();
    }
    // 4. Swamp locals: win Brad's day trade and Morgan's quiz, then Derek's fight starts with that intel showing.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(`${base}?debug=1&canvas=1&region=start&perfect=1&seed=9&fast=1`);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Region', null, { timeout: 20_000 });
      await sleep(600);
      const before = await state(page);
      // The joystick: push it up for a second and $cott should walk up the path, then stop on release.
      const { stick } = before;
      const push = await touchDrag(page, stick, { x: stick.x, y: stick.y - stick.radius }, 1000);
      const climbed = before.player.y - push.held.player.y;
      if (!push.midway.stick.active) failures.push('joystick: a touch on it should grab it');
      // Headless Chromium runs slow frames, so this only checks he clearly moved (on a phone it's ~320 px/s).
      if (climbed < 60) failures.push(`joystick: pushing up should walk $cott up (moved ${climbed}px)`);
      if (push.held.player.facing !== 'up') failures.push(`joystick: $cott should face up, faced ${push.held.player.facing}`);
      await sleep(300);
      const settled = await state(page);
      if (push.after.stick.active || settled.player.y !== push.after.player.y) failures.push('joystick: letting go should stop him');
      console.log(`joystick: walked ${climbed}px up in 1 s, stopped on release`);
      const locals = before.npcs.filter((n) => n.challenge).map((n) => n.id);
      // The TALK button: walk up beside Brad, check it lights up for him, press it, and he talks.
      {
        await walkNear(page, 'brad');
        const brad = (await state(page)).npcs.find((n) => n.id === 'brad');
        await tapGame(page, brad.tap.x - 90, brad.tap.y + 60);
        for (let i = 0; i < 40 && (await state(page)).walking; i++) await sleep(150);
        const near = await state(page);
        if (!near.talkButton.ready || near.talkButton.near !== 'brad') failures.push(`talk button: should light up beside Brad (${JSON.stringify(near.talkButton)})`);
        await tapGame(page, near.talkButton.x, near.talkButton.y);
        for (let i = 0; i < 30 && (await state(page)).mode === 'explore'; i++) await sleep(150);
        const talking = await state(page);
        if (talking.mode !== 'talk') failures.push(`talk button: pressing it should start talking to Brad (mode ${talking.mode})`);
        else console.log('talk button: lit up beside Brad and started the conversation');
      }
      if (locals.length < 3) failures.push(`locals: expected 3 challenge NPCs, got ${locals.join(',')}`);
      let traded = null;
      await winChallenge(page, 'brad', 'SHOW HIM', {
        onTrade: async (s) => {
          traded = s.trade;
          await page.screenshot({ path: path.join(SHOTS, '14-trade.png') });
        },
      });
      if (!traded) failures.push("trade: never saw Brad's market open");
      await page.screenshot({ path: path.join(SHOTS, '14-local-brad.png') });
      await winChallenge(page, 'morgan', 'TAKE THE QUIZ');
      await walkToVillain(page, failures, { shots: false });
      await page.waitForFunction(() => window.__smm?.state().scene === 'Battle', null, { timeout: 10_000 });
      await page.waitForFunction(() => window.__smm.state().phase !== 'intro', null, { timeout: 20_000 }).catch(() => {});
      const intel = (await state(page)).enemy.intel;
      await page.screenshot({ path: path.join(SHOTS, '15-scouted-battle.png') });
      if (!intel.weak.includes('FLEX')) failures.push(`locals: Brad's FLEX intel missing in battle (${JSON.stringify(intel)})`);
      if (!intel.resist.includes('ROAST') || !intel.softSpots.includes('ROAST>INTELLECT')) failures.push(`locals: Morgan's intel missing in battle (${JSON.stringify(intel)})`);
      if (intel.softSpots.includes('FLEX>WEALTH')) failures.push("locals: Chad's intel showed up without winning his challenge");
      console.log(`locals: won ${locals.filter((id) => id !== 'chad').join(' + ')}, battle intel ${JSON.stringify(intel)}`);
      failures.push(...errors.map((e) => `locals: ${e}`));
      await page.context().close();
    }

    // 5. $cott's phone: trade on Stonks, shop (including the smartphone upgrade), and the MAP app.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(`${base}?debug=1&canvas=1&region=start&fast=1&seed=4&cash=3000&speed=3`);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Region', null, { timeout: 20_000 });
      await sleep(600);
      const press = async (text) => {
        const s = await state(page);
        const t = (s.targets ?? s.buttons).find((b) => b.text === text);
        if (!t) throw new Error(`phone: no "${text}" to press (have ${JSON.stringify((s.targets ?? s.buttons).map((b) => b.text))})`);
        await tapGame(page, t.x, t.y);
        await sleep(350);
      };
      await press('PHONE');
      await page.waitForFunction(() => window.__smm.state().scene === 'Phone', null, { timeout: 5000 });
      let s = await state(page);
      if (s.phone !== 'flip') failures.push(`phone: should start as a flip phone, got ${s.phone}`);
      await page.screenshot({ path: path.join(SHOTS, '16-phone-flip.png') });
      // Stonks stakes cash on the day trade; trade it the way a sharp trader would.
      await press('STONKS');
      await press('$100');
      const tradeStarted = Date.now();
      let tradeShot = false;
      for (s = await state(page); s.page !== 'stonks-result'; s = await state(page)) {
        if (Date.now() - tradeStarted > 60_000) throw new Error(`phone: the Stonks trade never settled (${JSON.stringify({ page: s.page, trade: s.trade })})`);
        if (!tradeShot && s.trade?.phase === 'open' && s.trade.tick > 120) {
          tradeShot = true;
          await page.screenshot({ path: path.join(SHOTS, '16b-phone-stonks.png') });
        }
        const pick = s.tradeAnswer && s.buttons.find((b) => b.text === s.tradeAnswer);
        if (pick) await tapGame(page, pick.x, pick.y);
        await sleep(200);
      }
      if (s.trades !== 2 || s.cash === 2900) failures.push(`phone: a trade should spend one of 3 trades and settle (${JSON.stringify({ page: s.page, trades: s.trades, cash: s.cash })})`);
      const afterTrade = s.cash;
      await press('DONE');
      // REALTY: the property ladder. Buy a listed home, sell it, then let the clock run out.
      // (Headless Chromium draws it at a few frames a second, so wait for each tap to land.)
      await press('REALTY');
      await press('TOKYO');
      const pressButton = async (texts) => {
        const b = (await state(page)).buttons.find((x) => texts.includes(x.text) && x.enabled);
        if (b) await tapGame(page, b.x, b.y);
        return !!b;
      };
      const until = (fn, arg = null, ms = 5000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
      await until(() => window.__smm.state().realty?.phase === 'ready');
      await page.screenshot({ path: path.join(SHOTS, '16c-realty-ready.png') });
      await pressButton(['OPEN HOUSE']);
      // Tap a green (affordable) price tag to buy; tap it again to sell.
      await until(() => window.__smm.state().realtyUnits?.some((u) => u.buyable && u.tagX !== null));
      const home = (await state(page)).realtyUnits.find((u) => u.buyable && u.tagX !== null);
      if (!home) failures.push('phone: the property ladder opened with no affordable price tag to tap');
      else {
        await tapGame(page, home.tagX, home.tagY);
        if (!(await until((id) => window.__smm.state().realty?.owned.includes(id), home.id))) failures.push('phone: tapping an affordable price tag should buy it');
        await page.screenshot({ path: path.join(SHOTS, '16d-realty-owned.png') });
        const again = (await state(page)).realtyUnits.find((u) => u.id === home.id);
        if (again?.tagX === null || again?.tagX === undefined) failures.push("phone: $cott's tag should still show after buying");
        else {
          await tapGame(page, again.tagX, again.tagY);
          if (!(await until(() => window.__smm.state().realty?.history.some((h) => h.type === 'sell')))) failures.push('phone: tapping his own price tag should sell it');
        }
      }
      const realtyStarted = Date.now();
      let history = [];
      for (s = await state(page); s.page !== 'realty-result'; s = await state(page)) {
        if (Date.now() - realtyStarted > 120_000) throw new Error(`phone: the property ladder never ended (${JSON.stringify(s.realty)})`);
        if (s.realty) history = s.realty.history;
        if (s.realtyAnswer === 'CONTINUE') await pressButton(['CONTINUE']);
        await sleep(400);
      }
      if (s.cash !== afterTrade) failures.push(`phone: the property ladder is play money, but cash went ${afterTrade} -> ${s.cash}`);
      await page.screenshot({ path: path.join(SHOTS, '16e-realty-result.png') });
      await press('DONE');
      // The work-in-progress toggle in SETTINGS swaps models both ways.
      await press('SETTINGS');
      await press('TRY SMARTPHONE');
      await page.waitForFunction(() => window.__smm.state().phone === 'smart', null, { timeout: 5000 }).catch(() => failures.push('phone: the SETTINGS toggle should swap to the smartphone'));
      await sleep(500);
      await press('TRY FLIP PHONE');
      await page.waitForFunction(() => window.__smm.state().phone === 'flip', null, { timeout: 5000 }).catch(() => failures.push('phone: the SETTINGS toggle should swap back to the flip phone'));
      await sleep(500);
      await press('BACK');
      await press('SHOP');
      await press('BREW $150');
      s = await state(page);
      if (s.cash !== afterTrade - 150) failures.push(`phone: buying a Cold Brew should cost $150 (${afterTrade} -> ${s.cash})`);
      await press('SMARTPHONE $2,500');
      await page.waitForFunction(() => window.__smm.state().phone === 'smart', null, { timeout: 5000 }).catch(() => failures.push('phone: buying the smartphone should upgrade the phone'));
      await sleep(500);
      await page.screenshot({ path: path.join(SHOTS, '17-phone-smart.png') });
      await press('MAP');
      await page.waitForFunction(() => window.__smm.state().scene === 'Overworld', null, { timeout: 10_000 }).catch(() => failures.push('phone: the MAP app should go to the overworld'));
      await sleep(600);
      await press('PHONE');
      await page.waitForFunction(() => window.__smm.state().scene === 'Phone', null, { timeout: 5000 });
      await press('HOME');
      await page.waitForFunction(() => window.__smm.state().scene === 'Overworld', null, { timeout: 5000 }).catch(() => failures.push('phone: HOME on the home screen should put the phone away'));
      console.log(`phone: traded $100 -> $${afterTrade - 2900}, made ${history.length} property deals, toggled models, bought a Cold Brew and the smartphone, MAP app reached the overworld`);
      failures.push(...errors.map((e) => `phone: ${e}`));
      await page.context().close();
    }

    // 5b. Y, $cott's social app, and the velvet rope it opens: the bouncer turns him away,
    // he replies and posts his way to the Clout, then the rope opens onto the Yacht Club.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(`${base}?debug=1&canvas=1&region=start&fast=1&seed=7&perfect=1&speed=2`);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Region', null, { timeout: 20_000 });
      await sleep(600);
      const until = (fn, arg = null, ms = 5000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
      const press = async (text) => {
        const s = await state(page);
        const t = [...(s.targets ?? []), ...s.buttons].find((b) => b.text === text && b.enabled !== false);
        if (!t) throw new Error(`social: no "${text}" to press (have ${JSON.stringify([...(s.targets ?? []), ...s.buttons].map((b) => b.text))})`);
        await tapGame(page, t.x, t.y);
        await sleep(350);
      };
      // Walk up to an NPC and tap through whatever they say.
      const talkTo = async (id) => {
        await walkNear(page, id);
        const started = Date.now();
        let s = await state(page);
        while (s.mode === 'explore') {
          if (Date.now() - started > 30_000) throw new Error(`social: never reached ${id}`);
          const npc = s.npcs.find((n) => n.id === id);
          if (!s.walking) await tapGame(page, Math.min(Math.max(npc.tap.x, 10), GAME_W - 10), Math.min(Math.max(npc.tap.y, 140), 1270));
          await sleep(250);
          s = await state(page);
        }
        for (let i = 0; i < 30 && s.mode !== 'explore'; i++) {
          await tapGame(page, GAME_W / 2, 1170);
          await sleep(250);
          s = await state(page);
        }
        return s;
      };
      let s = await talkTo('vinny');
      if (s.gates[0].open) failures.push('social: the velvet rope should stay up with no Clout');
      await page.screenshot({ path: path.join(SHOTS, '18-rope.png') });

      await press('PHONE');
      await until(() => window.__smm.state().scene === 'Phone');
      await press('Y');
      if (!(await until(() => !!window.__smm.state().social))) throw new Error('social: the Y app never opened');
      await sleep(500);
      await page.screenshot({ path: path.join(SHOTS, '18b-social-feed.png') });
      // Reply to every post that takes one (the right reply each time), then post three times.
      let replies = 0;
      for (s = await state(page); s.social.replies.length && replies < 6; s = await state(page)) {
        const r = s.social.replies[0];
        await tapGame(page, r.x, r.y);
        await until(() => !!window.__smm.state().socialAnswer);
        const a = (await state(page)).socialAnswer;
        await tapGame(page, a.x, a.y);
        await until(() => window.__smm.state().buttons.some((b) => b.text === 'DONE'));
        await press('DONE');
        await sleep(300);
        replies += 1;
      }
      const afterReplies = (await state(page)).social.clout;
      if (afterReplies !== replies * 60) failures.push(`social: ${replies} right replies should earn ${replies * 60} Clout, got ${afterReplies}`);
      for (let i = 0; i < 3; i++) {
        await press('NEW POST');
        await until(() => window.__smm.state().postAnswer?.text === 'DRAFT');
        const d = (await state(page)).postAnswer;
        await tapGame(page, d.x, d.y);
        await until(() => window.__smm.state().post?.phase === 'time');
        if (i === 0) await page.screenshot({ path: path.join(SHOTS, '18c-social-post.png') });
        await press('POST');
        await until(() => window.__smm.state().postAnswer?.text === 'CONTINUE');
        if (i === 0) {
          await sleep(1400);
          await page.screenshot({ path: path.join(SHOTS, '18d-social-posted.png') });
        }
        await press('CONTINUE');
        await until(() => !!window.__smm.state().social && !window.__smm.state().post);
      }
      s = await state(page);
      if (s.social.posts !== 0) failures.push(`social: three posts should use all three (${s.social.posts} left)`);
      if (s.social.clout < 500) failures.push(`social: replies and three viral posts should pass the 500-Clout rope (got ${s.social.clout})`);
      if (s.buttons.find((b) => b.text === 'NEW POST')?.enabled) failures.push('social: NEW POST should be disabled with no posts left');
      await page.screenshot({ path: path.join(SHOTS, '18e-social-after.png') });
      const clout = s.social.clout;
      await press('BACK');
      await until(() => window.__smm.state().scene === 'Phone' && !window.__smm.state().social);
      await press('END');
      await until(() => window.__smm.state().scene === 'Region');
      await sleep(400);

      s = await talkTo('vinny');
      if (!s.gates[0].open) failures.push(`social: with ${clout} Clout the bouncer should open the rope`);
      const cashBefore = s.cash;
      s = await talkTo('wendy');
      await page.screenshot({ path: path.join(SHOTS, '18f-yacht-club.png') });
      if (s.cash !== cashBefore + 750) failures.push(`social: Wendy's gift should pay $750 (${cashBefore} -> ${s.cash})`);
      console.log(`social: turned away at the rope, ${replies} right repl${replies === 1 ? 'y' : 'ies'} + 3 posts -> ${clout} Clout, rope opened, Wendy's gift paid $${s.cash - cashBefore}`);
      failures.push(...errors.map((e) => `social: ${e}`));
      await page.context().close();
    }

    // 5c. The map editor: paint, add an NPC, undo, check, grow, export, playtest, and back.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(`${base}?debug=1&canvas=1&fast=1&edit=start`);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Editor', null, { timeout: 20_000 });
      await sleep(600);
      const ed = async () => (await state(page)).editor;
      const press = async (text) => {
        const b = (await state(page)).buttons.find((x) => x.text === text && x.enabled);
        if (!b) throw new Error(`editor: no "${text}" to press`);
        await tapGame(page, b.x, b.y);
        await sleep(300);
      };
      const before = await ed();
      const saved = (await import('../src/data/maps/start.layout.js')).default;
      if (before.dirty || before.cols !== saved.cols) failures.push(`editor: should open the saved swamp (${JSON.stringify({ dirty: before.dirty, cols: before.cols })})`);
      await page.screenshot({ path: path.join(SHOTS, '19-editor.png') });
      // PAINT is the starting tool, with WATER picked: paint a stroke across the whole map, wall to wall.
      await touchDrag(page, { x: 120, y: 500 }, { x: 600, y: 520 }, 200);
      await sleep(300);
      let e = await ed();
      if (!e.dirty || JSON.stringify(e.terrain) === JSON.stringify(before.terrain)) failures.push('editor: a paint stroke should change the terrain');
      await press('ADD');
      await press('NPC');
      e = await ed();
      if (e.counts.npcs !== before.counts.npcs + 1 || e.tab !== 'SELECT') failures.push(`editor: ADD > NPC should add one and select it (${JSON.stringify(e.counts)})`);
      await press('UNDO');
      if ((await ed()).counts.npcs !== before.counts.npcs) failures.push('editor: UNDO should take the NPC back out');
      await press('CHECK');
      const notes = (await ed()).problems;
      // The water stroke cut the swamp in two, wall to wall: CHECK should say something's out of reach.
      if (!notes.some((n) => /^error: .*can't be reached/.test(n))) failures.push(`editor: CHECK should catch the stroke cutting the swamp in two (${JSON.stringify(notes)})`);
      await page.screenshot({ path: path.join(SHOTS, '19b-editor-check.png') });
      await press('MAP');
      await press('+ RIGHT');
      if ((await ed()).cols !== saved.cols + 4) failures.push('editor: + RIGHT should grow the map 4 cells');
      await press('EXPORT');
      e = await ed();
      if (!new RegExp(`^// Region 'start'[\\s\\S]*export default \\{[\\s\\S]*cols: ${saved.cols + 4},`).test(e.export ?? '')) failures.push('editor: EXPORT should write the layout file');
      await press('PLAYTEST');
      await page.waitForFunction(() => window.__smm.state().scene === 'Region', null, { timeout: 10_000 }).catch(() => failures.push('editor: PLAYTEST should open the region'));
      await sleep(600);
      await page.screenshot({ path: path.join(SHOTS, '19c-editor-playtest.png') });
      await press('EDIT');
      await page.waitForFunction(() => window.__smm.state().scene === 'Editor', null, { timeout: 10_000 }).catch(() => failures.push('editor: EDIT should come back from the playtest'));
      e = await ed();
      if (e && (e.cols !== saved.cols + 4 || !e.dirty)) failures.push('editor: the draft should survive a playtest');
      console.log(`editor: painted, added and undid an NPC, CHECK listed ${notes.length} notes, grew to ${e?.cols} cols, exported, playtested, came back`);
      failures.push(...errors.map((x) => `editor: ${x}`));
      await page.context().close();
    }

    // 5d. The tower and the WIFI app: Clout gets $cott past the doorman, Helena's trade wins
    // him the app, and tracing DIAMONDHANDS-5G uncovers Derek's cellar in the woods.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(`${base}?debug=1&canvas=1&region=start&fast=1&seed=5&clout=600&phone=smart&speed=3`);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Region', null, { timeout: 30_000 });
      await sleep(600);
      const talkThrough = async (id) => {
        await walkNear(page, id);
        let s = await state(page);
        for (let i = 0; i < 60 && s.mode === 'explore'; i++) {
          const npc = s.npcs.find((n) => n.id === id);
          if (!s.walking) await tapGame(page, npc.tap.x, npc.tap.y);
          await sleep(250);
          s = await state(page);
        }
        for (let i = 0; i < 40 && s.mode !== 'explore'; i++) {
          await tapGame(page, GAME_W / 2, 1170);
          await sleep(250);
          s = await state(page);
        }
        return s;
      };
      let s = await state(page);
      if (s.exits.find((e) => e.to === 'start_lair').open) failures.push("wifi: Derek's cellar should start hidden");
      s = await talkThrough('doorman');
      if (!s.gates.find((g) => g.id === 'office').open) failures.push('wifi: 600 Clout should get past the doorman');
      s = await goThroughDoor(page, 'start_office');
      await page.screenshot({ path: path.join(SHOTS, '19d-office.png') });
      await winChallenge(page, 'helena', 'WATCH THIS');
      for (let i = 0; i < 40 && (await state(page)).mode !== 'explore'; i++) {
        await tapGame(page, GAME_W / 2, 1170);
        await sleep(250);
      }
      s = await state(page);
      if (!s.apps.includes('wifi')) failures.push(`wifi: winning Helena's trade should install the WIFI app (${JSON.stringify(s.apps)})`);
      s = await goThroughDoor(page, 'start');
      // Walk to Derek's yard, then let the app find him.
      await page.evaluate(() => {
        const scene = window.__smm.game.scene.getScene('Region');
        const e = scene.map.exits.find((x) => x.to === 'start_lair');
        scene.walkTo(e.x + e.w / 2, e.y + e.h + 70);
      });
      for (let i = 0; i < 400 && (await state(page)).walking; i++) await sleep(150);
      const phone = async (text) => {
        const t = [...((await state(page)).targets ?? []), ...(await state(page)).buttons].find((x) => x.text === text && x.enabled !== false);
        if (!t) throw new Error(`wifi: no "${text}" to press`);
        await tapGame(page, t.x, t.y);
        await sleep(500);
      };
      await phone('PHONE');
      await phone('WIFI');
      await page.screenshot({ path: path.join(SHOTS, '19e-wifi.png') });
      await phone('TRACE');
      await phone('LOOK');
      for (let i = 0; i < 40 && (await state(page)).scene !== 'Region'; i++) await sleep(150);
      await sleep(900);
      await page.screenshot({ path: path.join(SHOTS, '19f-wifi-found.png') });
      for (let i = 0; i < 30 && (await state(page)).mode !== 'explore'; i++) {
        await tapGame(page, GAME_W / 2, 1170);
        await sleep(250);
      }
      s = await state(page);
      if (!s.exits.find((e) => e.to === 'start_lair').open) failures.push("wifi: TRACE should uncover Derek's cellar door");
      else {
        s = await goThroughDoor(page, 'start_lair');
        if (s.map !== 'start_lair') failures.push('wifi: the cellar should lead down to the basement');
      }
      console.log(`wifi: doorman let him in, won Helena's trade, got ${s.apps.join(',')}, traced Derek's router, went down to ${s.map}`);
      failures.push(...errors.map((x) => `wifi: ${x}`));
      await page.context().close();
    }

    // 5e. Lil' Turnt follows him, Pikachu style: SETTINGS' test toggle brings her in, she walks
    // his trail, talks when tapped (or on TALK with nobody else around), gets jealous when he
    // talks to someone else, and comes through doors with him.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      await page.goto(`${base}?debug=1&canvas=1&region=start&fast=1&seed=5&phone=smart`);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Region', null, { timeout: 30_000 });
      await sleep(600);
      let s = await state(page);
      if (s.follower) failures.push('follow: nobody should follow before she is recruited or tried');
      const press = async (text) => {
        const t = [...((await state(page)).targets ?? []), ...((await state(page)).buttons ?? [])].find((x) => x.text === text && x.enabled !== false);
        if (!t) throw new Error(`follow: no "${text}" to press`);
        await tapGame(page, t.x, t.y);
        await sleep(500);
      };
      await press('PHONE');
      await press('SETTINGS');
      await press("TRY LIL' TURNT");
      await page.evaluate(() => window.__smm.game.scene.getScene('Phone').close());
      for (let i = 0; i < 40 && (await state(page)).scene !== 'Region'; i++) await sleep(150);
      await sleep(400);
      s = await state(page);
      if (!s.follower) throw new Error("follow: SETTINGS' toggle should bring Lil' Turnt in");
      const gap = await page.evaluate(() => window.__smm.game.scene.getScene('Region').follower.data.gap);

      // Walk a good way up the path: she stays on his heels, never farther than her gap.
      await page.evaluate(() => {
        const scene = window.__smm.game.scene.getScene('Region');
        scene.walkTo(scene.player.x, scene.player.y - 700);
      });
      let farthest = 0;
      let moved = false;
      for (let i = 0; i < 200 && (s = await state(page)).walking; i++) {
        farthest = Math.max(farthest, Math.hypot(s.player.x - s.follower.x, s.player.y - s.follower.y));
        moved ||= s.follower.moving;
        await sleep(100);
      }
      await sleep(300);
      s = await state(page);
      if (!moved) failures.push('follow: she should walk while he does');
      if (farthest > gap + 6) failures.push(`follow: she fell ${Math.round(farthest)} px behind (gap ${gap})`);
      if (s.follower.moving) failures.push('follow: she should stop when he stops');
      await page.screenshot({ path: path.join(SHOTS, '19g-follower.png') });

      // Tap her: her intro the first time.
      await tapGame(page, s.follower.tap.x, s.follower.tap.y);
      await sleep(400);
      s = await state(page);
      if (s.mode !== 'talk') failures.push('follow: tapping her should start a talk');
      await page.screenshot({ path: path.join(SHOTS, '19h-follower-talk.png') });
      for (let i = 0; i < 30 && (s = await state(page)).mode !== 'explore'; i++) {
        await tapGame(page, GAME_W / 2, 1170);
        await sleep(250);
      }

      // Talk to Brad: she gets jealous, and says so over her head.
      await walkNear(page, 'brad');
      for (let i = 0; i < 60 && (s = await state(page)).mode === 'explore'; i++) {
        const npc = s.npcs.find((n) => n.id === 'brad');
        if (!s.walking) await tapGame(page, npc.tap.x, npc.tap.y);
        await sleep(250);
      }
      for (let i = 0; i < 40 && (s = await state(page)).mode !== 'explore'; i++) {
        // Brad offers his trade: NOT NOW.
        const notNow = (s.buttons ?? []).find((b) => b.text === 'NOT NOW');
        if (notNow) await tapGame(page, notNow.x, notNow.y);
        else await tapGame(page, GAME_W / 2, 1170);
        await sleep(250);
      }
      s = await state(page);
      if (s.follower.jealousy !== 1) failures.push(`follow: talking to Brad should make her jealous (${s.follower.jealousy})`);
      if (!s.emote) failures.push('follow: she should pop an emote when he talks to someone else');

      // Walking up to someone she has an opinion on, she barks (odds forced to always, so it's certain).
      await page.evaluate(() => {
        const scene = window.__smm.game.scene.getScene('Region');
        Object.assign(scene.follower.barker, { chance: 1, nextAny: 0 });
        scene.follower.barker.nextFor.clear();
        scene.walkTo(scene.map.spawn.x, scene.map.spawn.y);
      });
      for (let i = 0; i < 400 && (await state(page)).walking; i++) await sleep(150);
      await walkNear(page, 'morgan');
      let bark = null;
      for (let i = 0; i < 40 && !bark; i++) {
        bark = (await state(page)).bark;
        await sleep(100);
      }
      if (!bark) failures.push('follow: walking up to Mod Morgan should get a bark out of her');
      else await page.screenshot({ path: path.join(SHOTS, '19i-follower-bark.png') });

      // Away from everyone, TALK talks to her, and that settles her down.
      await page.evaluate(() => {
        const scene = window.__smm.game.scene.getScene('Region');
        scene.walkTo(scene.map.spawn.x, scene.map.spawn.y);
      });
      for (let i = 0; i < 400 && (await state(page)).walking; i++) await sleep(150);
      s = await state(page);
      if (s.talkButton.near) failures.push(`follow: expected nobody near the spawn, found ${s.talkButton.near}`);
      await tapGame(page, s.talkButton.x, s.talkButton.y);
      await sleep(300);
      if ((await state(page)).mode !== 'talk') failures.push('follow: TALK with nobody else around should talk to her');
      for (let i = 0; i < 30 && (s = await state(page)).mode !== 'explore'; i++) {
        await tapGame(page, GAME_W / 2, 1170);
        await sleep(250);
      }
      if (s.follower.jealousy !== 0) failures.push(`follow: talking to her should settle her jealousy (${s.follower.jealousy})`);

      // Through a door, she comes too.
      s = await goThroughDoor(page, 'start_lair');
      await sleep(300);
      s = await state(page);
      if (!s.follower) failures.push('follow: she should come down to the basement with him');
      else if (Math.hypot(s.player.x - s.follower.x, s.player.y - s.follower.y) > gap + 6) failures.push('follow: she should arrive right behind him');
      console.log(`follow: Lil' Turnt trailed him (max ${Math.round(farthest)} px, gap ${gap}), talked, got jealous of Brad, barked "${bark}", settled, followed him to ${s.map}`);
      failures.push(...errors.map((x) => `follow: ${x}`));
      await page.context().close();
    }

    // 6. The journey: map -> walk the swamp to Derek -> fight -> back to the map with Tier 1 unlocked -> reload keeps it.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      const url = `${base}?debug=1&canvas=1&perfect=1&seed=123&fast=1`;
      await page.goto(url);
      await page.waitForFunction(() => window.__smm?.state().scene === 'Overworld', null, { timeout: 20_000 });
      await sleep(600);
      let map = await state(page);
      await page.screenshot({ path: path.join(SHOTS, '11-map-start.png') });
      const locked = Object.entries(map.statuses).filter(([, v]) => v === 'locked').length;
      if (map.statuses.start !== 'open' || locked !== 8) failures.push(`map: fresh save should open only start (${JSON.stringify(map.statuses)})`);
      if (map.selected !== 'start') failures.push(`map: should start with start selected, got ${map.selected}`);

      const enter = map.buttons.find((b) => b.text === 'ENTER');
      if (!enter) throw new Error('map: no ENTER button for the Subreddit Swamps');
      await tapGame(page, enter.x, enter.y);
      await walkToVillain(page, failures);
      const result = await playBattle(page, { label: 'map run' });
      if (result.result !== 'victory') failures.push(`map run: expected victory, got ${result.result}`);
      const cont = result.buttons.find((b) => b.text === 'CONTINUE');
      if (!cont) throw new Error('map run: no CONTINUE button after the win');
      await tapGame(page, cont.x, cont.y);
      await page.waitForFunction(() => window.__smm.state().scene === 'Overworld', null, { timeout: 10_000 });
      await sleep(900);
      await page.screenshot({ path: path.join(SHOTS, '12-map-unlocking.png') });
      await page.waitForFunction(() => window.__smm.state().revealing === false, null, { timeout: 10_000 });
      await sleep(300);
      map = await state(page);
      await page.screenshot({ path: path.join(SHOTS, '13-map-tier1.png') });
      const want = { start: 'cleared', isles: 'open', ratio: 'open', riviera: 'locked' };
      for (const [id, st] of Object.entries(want)) if (map.statuses[id] !== st) failures.push(`map: after the win ${id} should be ${st}, got ${map.statuses[id]}`);
      if (!map.buttons.some((b) => b.text === 'SOON' && !b.enabled)) failures.push('map: an unwritten region should show a disabled SOON button');

      const [rx, ry] = map.nodes.ratio;
      await tapGame(page, rx, ry);
      await sleep(300);
      if ((await state(page)).selected !== 'ratio') failures.push('map: tapping Mount Ratio did not select it');

      await page.reload();
      await page.waitForFunction(() => window.__smm?.state().scene === 'Overworld', null, { timeout: 20_000 });
      if ((await state(page)).statuses.start !== 'cleared') failures.push('map: progress was not saved across a reload');
      console.log(`map run: ${result.result}, then ${Object.values(map.statuses).filter((v) => v === 'open').length} regions open`);
      failures.push(...errors.map((e) => `map run: ${e}`));
      await page.context().close();
    }
  } catch (err) {
    failures.push(err.stack ?? String(err));
  } finally {
    await browser.close();
    server.close();
  }

  for (const w of warnings) console.warn(`warning: ${w}`);
  console.log(`screenshots: ${path.relative(process.cwd(), SHOTS)}/`);
  if (failures.length) {
    console.error(`\nSMOKE TEST FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log('SMOKE TEST PASSED');
}

main();
