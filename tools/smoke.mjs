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

    if (s.phase === 'timing') await snap('timing');
    if (s.phase === 'dialog') await snap('dialog');
    if (s.phase === 'dialog' && s.enemy.statuses.includes('shortSqueezed')) await snap('squeezed');
    // Dialog, timing bar, or animation: tap an empty spot.
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
