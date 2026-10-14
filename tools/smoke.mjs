// Smoke test: serve the repo, load the game in headless Chromium on a phone-
// sized touch viewport, play full battles through debug mode, and save
// screenshots to tools/screenshots/. Exits non-zero on any failure.
//
//   npm i            (once; installs Playwright as a dev dependency)
//   npm run smoke
//
// If Playwright can't find a browser, point it at one:
//   CHROMIUM_PATH=/path/to/chrome npm run smoke

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
 * In a walkable region: screenshot it, tap the villain until $cott has walked
 * over and started talking, tap through the talk, then press FIGHT.
 */
async function walkToVillain(page, failures, { shots = true } = {}) {
  await page.waitForFunction(() => window.__smm.state().scene === 'Region', null, { timeout: 15_000 });
  await sleep(700);
  if (shots) await page.screenshot({ path: path.join(SHOTS, '11b-region.png') });
  const started = Date.now();
  let s = await state(page);
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
  if (shots && Math.hypot(s.player.x - start.x, s.player.y - start.y) < 500) failures.push('region: $cott should have walked up the path to Derek');
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
      console.log(`perfect run: ${result.result} in ${result.round} rounds (${result.actions} taps), renderer ${renderer}, $cott ${result.scott.clout} Clout, Derek ${result.enemy.clout}`);
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
      await page.goto(`${base}?debug=1&battle=derek&seed=7&fast=1`);
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
      await page.goto(`${base}?debug=1&region=start&perfect=1&seed=9&fast=1`);
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

    // 5. The journey: map -> walk the swamp to Derek -> fight -> back to the map with Tier 1 unlocked -> reload keeps it.
    {
      const errors = [];
      const page = await newPage(browser, errors);
      const url = `${base}?debug=1&perfect=1&seed=123&fast=1`;
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
