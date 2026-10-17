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
| `&edit=start` | Open the **map editor** on that region (see below) |
| `&cash=5000` / `&clout=600` | Preset $cott's cash / social Clout (in memory only) |
| `&phone=smart` | Start on the smartphone instead of the flip phone (in memory only) |
| `&speed=4` | Run minigame clocks (day trade, property ladder) faster |
| `&canvas=1` | Use the Canvas renderer (fast in headless browsers) |
| `&title=1` | Show the title screen anyway |

For example: `http://localhost:8000/?debug=1&battle=derek&perfect=1&seed=123&fast=1`

## Map editor

Regions are laid out in an editor built into the game:
<https://wbv58kx28d-dotcom.github.io/Scott-Money-And-The-Sins/?debug=1&edit=start>
(any region id works; one without a map opens blank). Paint the ground, place
props, NPCs, velvet ropes, boardwalks, and exits, run CHECK, and PLAYTEST the
draft. Drafts autosave in your browser. **EXPORT** downloads
`<id>.layout.js`: commit it to `src/data/maps/` (or send it to Claude). What
NPCs say lives in `src/data/maps/<id>.js`. Details: `CLAUDE.md` §6.11.

## Tests

The game itself has no dependencies. Dev tooling needs Node 18+:

```sh
npm install      # once: installs Playwright (dev only)
npm test         # unit tests: combat, parity with the legacy prototype, minigames, social app, map checks (no browser)
npm run smoke    # plays the game in headless Chromium (battles, a region, the phone, the map editor), saves screenshots
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
src/scenes/           Boot → Preload → Title → Overworld (map) → Region (walk) → Battle; the Phone, the Y social app, the map Editor
src/minigames/        overlay minigames on one contract: day trade, property ladder, posting
src/systems/          combat math, AI, statuses, crowd, timing, audio, rng, save, progress, walking and pathfinding,
                      terrain, map files and map checks, markets, realty, social, placeholder art, debug
src/data/             all content and tuning: moves, items, statuses, villains, crew, regions, phone, social, minigames
src/data/maps/        per region: <id>.layout.js (where things are; the editor writes it) + <id>.js (who's there, what they say)
src/ui/               buttons, menus, dialog, HUD, timing bar, effects, terrain drawing
assets/               finished art (see assets/README.md); assets/regions/<set>/ holds the ground tilesets
tools/                unit tests, the Playwright smoke test, and art build scripts (tools/region-art/, phone-art/, realty-art/)
legacy/               the original single-file prototype (reference only)
```

Content is data-driven. To add a villain, copy `src/data/enemies/derek.js`,
edit it, and list it in `src/data/enemies/index.js`. To lay out a region, use
the map editor; for what its people say, edit `src/data/maps/<id>.js`. To add
finished art, drop the file in `assets/` and point `src/data/assets.js` at it. Missing art falls
back to a procedural placeholder, so nothing breaks while art is in progress.

All villains are original parodies. Any resemblance to real people is coincidental.
