# $cott Money: Redemption Arc

A joke pixel-art RPG for the group chat. $cott Money, crypto bro and
egomaniac, gets framed, loses everything, and battles his way back with
**disses**: turn-based rap battles with beat timing, weak spots, and a crowd
that decides when he gets to drop the mic.

It runs in a phone browser, in portrait, from a shared link. No install.

- **Project brief:** [`CLAUDE.md`](CLAUDE.md) covers story, crew, combat numbers, art rules, and decisions.
- **Build plan and status:** [`HANDOFF.md`](HANDOFF.md).

## Play

**Live link:** <https://wbv58kx28d-dotcom.github.io/Scott-Money-And-The-Sins/>
(GitHub Pages, deployed from `main` on every push).

After a push, give it a few minutes before sharing: GitHub Pages caches files
for about 10 minutes.

## Run it locally

No build step. Any static file server works; ES modules don't load over `file://`.

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To test on a phone, put it on the same Wi-Fi
and open `http://<your-computer's-ip>:8000`.

### Debug URLs

Debug flags only work together with `?debug=1`:

| Flag | Effect |
|---|---|
| `?debug=1` | Skip the title screen (opens the map) |
| `&battle=derek` | Jump straight to that battle |
| `&perfect=1` | Every timing tap lands PERFECT |
| `&seed=123` | Seed the random number source (repeatable fights) |
| `&fast=1` | Dialog appears instantly |
| `&cleared=start,isles` | Preset cleared regions (in memory only; your real save is untouched) |
| `&sins=lilturnt,babarbara:2` | Preset recruited Sins, with optional levels (in memory only) |
| `&reset=1` | Wipe your saved progress |
| `&region=start` | Walk around that region (skips the map) |

For example: `http://localhost:8000/?debug=1&battle=derek&perfect=1&seed=123&fast=1`

## Tests

The game itself has no dependencies. Dev tooling needs Node 18+:

```sh
npm install      # once: installs Playwright (dev only)
npm test         # combat math + parity with the legacy prototype (no browser)
npm run smoke    # plays full battles in headless Chromium, saves screenshots
```

Smoke-test screenshots land in `tools/screenshots/` (git-ignored). If
Playwright can't find a browser, run `npx playwright install chromium` or set
`CHROMIUM_PATH`.

## How it's put together

```
index.html            page shell: fonts, safe-area CSS, loads Phaser then src/main.js
lib/phaser.min.js     Phaser 3.80.1, vendored and pinned
src/main.js           waits for fonts, starts the game
src/config.js         canvas size, colors, fonts, layout positions
src/scenes/           Boot → Preload → Title → Overworld (map) → Region (walk) → Battle
src/systems/          combat math, AI, statuses, crowd, timing, audio, rng, save, progress, walking and pathfinding, placeholder art, debug
src/data/             all content and tuning: moves, items, statuses, villains, crew, regions, region maps
src/ui/               buttons, menus, dialog, HUD, timing bar, effects
assets/               finished art (see assets/README.md)
tools/                unit tests and the Playwright smoke test
legacy/               the original single-file prototype (reference only)
```

Content is data-driven. To add a villain, copy `src/data/enemies/derek.js`,
edit it, and list it in `src/data/enemies/index.js`. To add finished art, drop
the file in `assets/` and point `src/data/assets.js` at it. Missing art falls
back to a procedural placeholder, so nothing breaks while art is in progress.

All villains are original parodies. Any resemblance to real people is coincidental.
