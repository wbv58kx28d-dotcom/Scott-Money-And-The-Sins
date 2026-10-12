# Handoff: $cott Money RPG → Claude Code + GitHub

This hands the game build off from claude.ai chat to Claude Code. **Read `CLAUDE.md` first.** That's the full project brief: story, region structure, crew, combat numbers, planned systems, art rules, and the decision log. This file covers the migration, the known quirks of the prototype, and the build order.

_Last updated: Oct 12, 2026._

---

## Build status

_Updated by Claude Code at the end of each session._

**Phase 1 is built, against the spec.** The repo has the target structure, a
modular Phaser 3.80.1 battle at 720×1280 ($cott vs. Diamond Hands Derek), debug
mode, 16 unit tests for the combat math (`npm test`), and a Playwright smoke test
that plays full battles on a touch phone viewport (`npm run smoke`). All of it
passes. Every quirk in "Prototype quirks to preserve" is implemented.

**Art:** the crew pack is in. The 8 crew sprites are in `assets/sprites/crew/`
and `bg_tokyo.webp` is in `assets/bg/`. The battle uses `scott.png` and the
Tokyo background. The 7 Sin sprites wait for Phase 3 (summons, parley).
`crew_assets.js` and the 1 MB `bg_tokyo.png` from the pack were left out on
purpose. Derek is still procedural until he has art. Any art listed in
`src/data/assets.js` that's missing falls back to a procedural placeholder.

**Still missing:** `legacy/scott-money-battle.html` wasn't available, so the
battle was rebuilt from the numbers in `CLAUDE.md` §5. Once it's dropped into
`legacy/`, reconcile the items below against it.

**Reconstructed while the legacy file was missing** (search the code for `RECONSTRUCTED`):
1. **Derek's moves:** type/target and power for each, from their names. Loss Porn WORDPLAY→CAREER 12, Due Diligence ROAST→INTELLECT 9, Hairline Short ROAST→LOOKS 9, Drip Check FLEX→STYLE 13, Tendie Tower FLEX→WEALTH 16, Pump & Dump WORDPLAY→REP 8 (+ Rug Pulled), and Apes Together Strong heals 15 Clout.
2. **All writing:** $cott's 11 couplets plus the Drop the Mic couplet, Derek's 7 move couplets, the intro/victory/defeat lines, and the hit, status, and item messages. These are placeholders for the legacy bars and the lore writer's material.
3. **Status durations:** a status doesn't tick down in the round it's applied, so Mooning boosts $cott's next 3 attacks and Rug Pulled drains on his next 2 turns.
4. **Crowd lock:** once the meter hits 100, it stays at 100 until Drop the Mic is used (`CROWD.lockWhenFull`). Without the lock, Derek's hit always lands before $cott's next turn, knocks the meter below 100, and the finisher can almost never fire.
5. **Drop the Mic** empties the meter when used and earns no crowd itself.
6. **Timing bar:** the marker bounces end to end. If nobody taps within 8 sweeps, the result is WACK.
7. **Items** use $cott's turn. Run doesn't (per spec).
8. **Discovery:** a crit reveals the weakness and the soft spot, a bypass reveals the resistance and the soft spot, a nerve reveals the soft spot, and a plain weak or resisted hit reveals the weakness or resistance.
9. **STALL:** a soft-lock guard. It only appears when $cott can't afford any diss and has no items left, and it skips his turn.

## Where things stand

- **A working single-file Phaser prototype** (`scott-money-battle.html`) built in chat.
  - $cott Money vs. Diamond Hands Derek.
  - Includes diss types, targeting and soft spots, a beat-timing minigame, a crowd meter, status effects, items, and procedural audio.
  - Runs at **360×640** with procedural pixel sprites.
- **A finished art pack** (`phaser_crew_pack.zip`) for **720×1280**: 8 outlined crew sprites and a portrait Tokyo battle background.
- **New design since the pack was made:**
  - Only $cott is on screen in battle; the Sins are summons.
  - A pre-battle parley that uses Sin minigames.
  - Octopath-style regions in tier pairs.
  - See `CLAUDE.md` §2 and §6.

Art and lore keep happening in chat. Finished PNGs get dropped into `assets/`.

## Files to put in the project folder before starting

| File | Where it goes |
|---|---|
| `CLAUDE.md` | Repo root |
| `HANDOFF.md` | Repo root (this file) |
| `scott-money-battle.html` | `legacy/` (download it from the Battle 1 artifact) |
| `phaser_crew_pack.zip` | Unzip. Sprites go to `assets/sprites/crew/`, and the background goes to `assets/bg/`. |
| Original GPT character images | `art-source/`, kept for re-cuts at other sizes |

From the pack, don't load `crew_assets.js`; the base64 bundle only existed for the single-file artifact. Its layout coordinates are already copied into `CLAUDE.md` §8.2.

## Tech decisions

- **Phaser 3.80.1, pinned.** Vendor `phaser.min.js` into `lib/`. Don't upgrade without asking.
- **No build step.** Plain ES modules served as static files.
- **Loading Phaser with modules:** load `lib/phaser.min.js` as a classic `<script>` *before* the `<script type="module" src="src/main.js">` tag, and use the global `Phaser` everywhere. Don't `import` it.
- **Canvas: 720×1280 portrait.**
  ```js
  pixelArt: true,
  roundPixels: true,
  audio: { noAudio: true },   // the beat is WebAudio; revisit when real audio files arrive
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  ```
- **Keep the prototype's `index.html` head:**
  - `viewport-fit=cover` and the safe-area padding CSS.
  - `touch-action: manipulation` and no text selection.
  - The Google Fonts links.
  - The fallback message if Phaser fails to load.
- **Relative asset paths only** (`assets/...`, never `/assets/...`), because the site is served from a sub-path.
- **Local dev:** run `python3 -m http.server` from the repo root. ES modules don't work over `file://`. Test on a phone over the LAN at `http://<computer-ip>:8000`.
- **One random number source.** Route all randomness through `src/systems/rng.js` so debug mode can seed it.

## Target structure

```
index.html
lib/phaser.min.js
src/
  main.js              game config + scene list
  config.js            W/H, colors, fonts, layout constants (no magic numbers in scenes)
  scenes/              Boot, Preload, Title, Battle (later: Parley, Overworld, Minigame host)
  systems/             combat.js (damage, types, soft spots), timing.js, crowd.js, status.js,
                       audio.js, rng.js, save.js, debug.js
  minigames/           one file per Sin minigame, all using the contract in CLAUDE.md §6.3
  data/                types.js, crew.js, statuses.js, items.js, regions.js,
                       enemies/derek.js (one file per villain, including its parley)
  ui/                  buttons, panels, dialog box, text helpers
assets/
  sprites/crew/        8 crew PNGs (outline baked in, facing left)
  sprites/enemies/
  bg/                  battle backgrounds, 720×1280 WebP
art-source/            GPT originals (not loaded by the game)
legacy/                original single-file prototype, for reference
tools/                 dev-only scripts (e.g., the Playwright smoke test)
CLAUDE.md  HANDOFF.md  README.md
```

`art-source/` can get large. Consider Git LFS, or keep it out of the repo.

## Prototype quirks to preserve

These look like bugs or clutter, but they're deliberate. Removing them breaks the game.

- **Buttons act on `pointerup`, with the callback deferred by about 1 ms.** The global tap-to-advance handler runs on `pointerdown` and **ignores taps that land on interactive objects.** Without both, the tap that picks a menu option also skips the next dialog line or ends the timing minigame immediately. Deferring the callback also avoids destroying a button inside its own input event.
- **The timing minigame ignores taps in its first 150 ms**, for the same reason.
- **Boot waits for fonts** (`document.fonts.load` for both families, with a 2.5 s fallback). The text-fitting helper measures text width, so drawing too early gives wrong sizes.
- **Audio unlocks on the first user gesture**, through `window` listeners for `pointerup`, `touchend`, and `click`. On iPhones, the hardware silent switch mutes WebAudio; that's expected.
- **Typewriter dialog:** a tap during typing completes the text, and the next tap advances. Every dialog step is an `await` in an async turn loop. Keep that pattern; it keeps battle logic readable.
- **HUD bars animate** by tweening a display copy of the stats, so the real values change instantly while the bars catch up.

## Phase 1: Migrate (first session)

1. `git init`, create the structure above, and add a `.gitignore` (OS files, `node_modules`).
2. **Split `legacy/scott-money-battle.html` into modules, preserving combat behavior.** Every number comes from the legacy file (listed in `CLAUDE.md` §5) and goes into `src/data/` or `config.js` so it can be tuned. Keep all disses, targets, and soft spots as data.
3. **Re-lay the screen for the new art. Don't just double coordinates.**
   - The prototype has $cott bottom-left facing right and Derek top-right. The new layout has $cott lower-right and enemies upper-left (`CLAUDE.md` §8.2), with all art facing left.
   - Flip the lunge directions.
   - Recompute the damage-number and hit-effect offsets for feet origins (`setOrigin(0.5, 1)`); the prototype assumed centered sprites.
   - Rebuild the HUD and menu panel at 720×1280, routing every position through `config.js`.
4. **Load assets in a Preload scene**, for example `this.load.image('scott', 'assets/sprites/crew/scott.png');`.
5. **Replace $cott's procedural sprite with `scott.png`.**
6. **Derek keeps his procedural sprite until he has art,** but it needs a size fix. Bake an integer pixel size into the texture when it's created (about 11 screen pixels per sprite pixel, so he stands about 320 px tall next to $cott). Don't call `setScale`.
7. **Use `bg_tokyo.webp` as the battle background** for now.
8. **Add debug mode** (`src/systems/debug.js`). It's off unless URL parameters are present:
   - `?debug=1` skips the title.
   - `&battle=derek` jumps straight to that battle.
   - `&perfect=1` makes every timing tap land PERFECT.
   - `&seed=123` seeds the random number source.
   - `&fast=1` shows dialog instantly.
9. **Add a smoke test** in `tools/`: a dev-only Playwright script (`npm i -D playwright`, with `node_modules` git-ignored) that loads the game with debug parameters, plays a battle, and saves screenshots. Claude Code uses it to check its own changes instead of relying on phone testing for every commit.
10. Verify on desktop and on a phone, then commit.

**Done when:** the battle plays exactly as before, at 720×1280, with the new $cott art on the Tokyo background, and the smoke test passes.

## Phase 2: GitHub and hosting

1. Create a GitHub repo (e.g., `scott-money-rpg`) and push. With the GitHub CLI: `gh repo create`.
2. **Hosting choice:**
   - **GitHub Pages** is free but requires a **public** repo, so anyone could see the code, art, and lore. Set it up under Settings → Pages → *Deploy from a branch* → `main` / root.
   - **Cloudflare Pages or Netlify** deploy free from a **private** repo. Use one of these if any crew characters are based on real friends who'd rather not be public.
3. Confirm the live URL works on a phone, then add it to `README.md`.
4. **Caching:** hosts may cache files for several minutes (GitHub Pages uses about 10). After a push, wait before sharing, or add a version query string to the entry script.
5. From then on, the workflow is: commit, push, and the group-chat link updates.

## Phase 3: New systems (in order)

Each step should be playable and committed before starting the next.

1. **Save system.** Use `localStorage` for recruited Sins, Sin levels, and cleared regions and quests. Add a debug parameter to preset a save (e.g., `&sins=lilturnt,babarbara`).
2. **Crew data and Sin summons** (`CLAUDE.md` §6.1).
   - Add `src/data/crew.js`.
   - Add the summon step to the diss flow, offered only when the chosen target matches a recruited Sin.
   - Build the cut-in animation from the crew sprites, the feature verse, the effect, and the cooldown.
   - Prove it with one Sin first (Lil' Turnt, since she's in Tier 1), using placeholder feature lines.
3. **Minigame framework** (`CLAUDE.md` §6.3).
   - Build the host overlay scene and the shared result contract.
   - Build the two Tier 1 minigames first: Lil' Turnt's cat quiz and Babarbara's rage meter.
   - Each minigame must work standalone through a debug parameter (`&minigame=catquiz`).
4. **Parley scene** (`CLAUDE.md` §6.2). Read the villain's parley data, offer choices for recruited Sins only, run the minigame, and carry the results into the battle as starting modifiers.
5. **Overworld map** (`CLAUDE.md` §2, §6.5). Tier-gated regions, side-quest stops, and the tower at the end, all driven by `src/data/regions.js`.
6. **Sin levels and side quests** (`CLAUDE.md` §6.4).
7. **Remaining minigames, villains, and backgrounds** as content and art arrive from chat, one data file per villain.

Polish to work in along the way:
- An idle bob on $cott.
- An active-turn glow (`preFX`, guarded).
- A foreground rain or particle layer in front of the characters.

## Working conventions

- **Data-driven content:** adding a diss, villain, Sin, quest, or quiz question should mean editing data files, not game logic.
- **Parody villains only.** No real named people.
- **Pixel rules:** never `setScale` finished art; use `setOrigin(0.5, 1)`; all characters face left; whole-pixel positions. Procedural placeholders bake their pixel size into the texture.
- **Small commits** after each working change, with clear messages.
- **Keep `CLAUDE.md` current** when decisions change. It's shared with the chat side of the project.
- **Ask before** changing the Phaser version, the canvas size, or the combat formulas. Tuning numbers in data files is fine when the user asks for it.
