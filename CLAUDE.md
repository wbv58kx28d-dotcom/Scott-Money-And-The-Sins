# $cott Money: Redemption Arc — Project Brief

Shared context for every chat and for Claude Code. In the repo this file is `CLAUDE.md`. In claude.ai, keep it in Project knowledge.

_Last updated: Oct 14, 2026. Replaces `SCOTT_MONEY_RPG.md`._

**Who does what**
- **claude.ai chats** handle art, lore, writing, and design decisions.
- **Claude Code** builds the game in the GitHub repo.
- When a decision changes, update this file first.

---

## 1. What this is

A joke pixel-art RPG for a friend group, starring **$cott Money**, a character Zach created over the years. $cott is an over-the-top egomaniac tech/crypto bro (think *American Psycho*, but for tech-bro culture). Combat is turn-based, and **the attacks are disses**, with heavy rap and diss-track flavor.

- Played on phones through a shared link, so it runs in the browser, in portrait.
- Villains are **original parodies only**. Never real, named people.
- Another friend has written lore and character material that is still being folded in.

## 2. Story and structure

$cott is **framed** and loses his status, fortune, and fame. To win them back, he travels a **Lord of the Rings–style overworld map** (a weathered, illustrated journey map), recruits his crew of **seven Sins** one region at a time (like *Octopath Traveler*), and ends at the **final villain's tower**.

| Step | Regions (map key) | Recruits | Notes |
|---|---|---|---|
| Prologue | Subreddit Swamps (`start`) | none | $cott alone vs. **Diamond Hands Derek** (built) |
| Tier 1 | Influencer Isles (`isles`), Mount Ratio (`ratio`), either order | **Lil' Turnt** (Envy), **Babarbara** (Wrath) | Simplest minigames; teaches the systems |
| Tier 2 | Swipe Right Riviera (`riviera`), Lo-Fi Lowlands (`lofi`), either order | **Susan G. Kummin** (Lust), **J.R.R Toking** (Sloth) | Knowledge and dialogue minigames |
| Tier 3 | Bubble Bay (`bubble`), Offshore Archipelago (`offshore`), either order | **Keezus** (Gluttony), **Louis Change** (Greed) | Money-themed, high-risk minigames |
| Finale | Apex Launch Range (`apex`) | **Six Pac** (Pride) | Pride is traditionally the deadliest sin |
| Tower | The Fulfillment Citadel (`citadel`) | — | The everything-store overlord |

Region names come from the overworld map pack (`assets/map/`).

- Both regions in a tier must be cleared before the next tier opens. That gives players a choice while difficulty only steps up four times.
- Whichever region in a tier is played second will be a bit easier, because $cott has one more Sin. That's intended: the order is a strategic choice. If it feels too easy, villains can gain a small amount of Clout for each Sin already recruited.
- Each region has its own villain, a Sin to recruit, and optional side quests.

## 3. The crew

Only **$cott is on screen in battle.** The Sins are summons and parley partners (§6), not party members.

| Character | Sin | Look (short) | Parley minigame | Proposed summon targets |
|---|---|---|---|---|
| **$cott Money** | Leader | Crypto bro: slicked hair, shades, vest | — | — |
| **Lil' Turnt** | Envy | Orange tabby kitten, pearls, pink tutu, jealous side-eye | Cat quiz | REP |
| **Babarbara** | Wrath | Pink-red curly mohawk, black leather jumpsuit, scowl | Rage meter | any ROAST |
| **Susan G. Kummin** | Lust | Long wavy red hair, red leather dress, sly smirk | Rizz check | LOOKS, STYLE |
| **J.R.R Toking** | Sloth | Elderly wizard, huge white beard, velvet robe, long pipe | Lore quiz | INTELLECT |
| **Keezus** | Gluttony | Beard, aviators, open white hoodie, maxed-out credit cards | Crypto bet | LIFESTYLE |
| **Louis Change** | Greed | Frosted tips, hot pink brocade suit, fanning cash | Haggle | WEALTH |
| **Six Pac** | Pride | Shirtless, abs, admiring his own bicep | Flex hold | PHYSIQUE, STATUS |

Keezus's gluttony is **financial**: FOMO, excessive borrowing, scheming, and risky bets. It's never food.

## 4. Villains

**Built: Diamond Hands Derek** (prologue), a meme-stock trader on the Subreddit Swamps stage.
- HYPE type, 150 Clout. Weak to FLEX, resists ROAST.
- Soft spots: FLEX→WEALTH (crit), ROAST→INTELLECT (bypass), WORDPLAY→CAREER (nerve).
- Status: becomes *Short Squeezed* at 40% Clout or below.

**Planned archetypes** (sprites already in `assets/sprites/enemies/`, named by file; no battle data yet):
- A thrift-shop rapper (`vince.png`).
- A rocket-obsessed billionaire (`max.png`). One idea is pairing him with Six Pac's (Pride) finale region.
- The **everything-store overlord** who rules from the final tower (`fulfiller.png`, boss-sized at 395 px tall).

**Still needed:** about **5 more regional villains**, for 7 regional villains total plus the final boss. Pairing each villain thematically with their region's Sin is encouraged. A villain's soft spots can reward that tier's Sin summons, but no summon should ever be required.

## 5. Combat (built in the prototype)

The legacy prototype (`legacy/scott-money-battle.html`) is the **source of truth for every number** below.

### 5.1 Stats and turn flow
- **Clout** is HP. $cott has 100.
- **Flow** is MP and pays for disses. $cott has 60 max and regains 5 at the start of each of his turns after the first.
- Turn order: $cott acts, Derek acts, then end-of-round status ticks.
- Diss flow: pick a diss, pick a target, play the timing minigame, deliver the bars, then damage resolves.

### 5.2 Diss types and targets
| Type | Targets |
|---|---|
| FLEX | WEALTH, PHYSIQUE, STYLE, STATUS |
| ROAST | LOOKS, INTELLECT, LIFESTYLE, FAMILY |
| WORDPLAY | NAME, CAREER, REP |
| HYPE | Self-buffs, no target |

$cott's moves:

| Move | Type | Flow cost | Power | Timing speed |
|---|---|---|---|---|
| Lambo Lullaby | FLEX | 8 | 20 | 1.0 |
| Series A Slaughter | WORDPLAY | 12 | 23 | 1.25 |
| Cap Table Clapback | ROAST | 10 | 22 | 1.1 |
| Mooning | HYPE (buff) | 15 | — | — |
| Drop the Mic | none (finisher) | free | 45 | 1.4 |

### 5.3 Weaknesses, resistances, and soft spots
- A type the target is **weak** to does 2×. A type it **resists** does 0.5×.
- **Soft spots** are specific targets that hurt more:
  - Resisted type + soft spot: the resistance is ignored (1×). Called a *bypass*.
  - Neutral type + soft spot: 1.5×. Called a *nerve*.
  - Weak type + soft spot: **critical**, 3× total.
- The rules apply **both ways.** $cott is weak to ROAST (fragile ego) and resists FLEX. His soft spots are ROAST→LOOKS (the hairline, a crit) and FLEX→STYLE (the vest, a bypass).
- An enemy's weakness, resistance, and soft spots show as "???" on its HUD until discovered.

### 5.4 Beat-timing minigame
A marker sweeps across a bar, bouncing end to end from a random starting side, and the player taps when it's centered. A full sweep takes 820 ms divided by the move's speed. Distance is measured from the center as a fraction of **half** the bar (0 at center, 1 at either end), so PERFECT is the middle 8% of each half.

| Rating | Distance from center | Damage | Crowd change |
|---|---|---|---|
| PERFECT | ≤ 8% | 1.5× | +25 |
| FIRE | ≤ 20% | 1.25× | +18 |
| MID | ≤ 36% | 1.0× | +10 |
| WACK | beyond that | 0.6× | −5 |

### 5.5 Crowd meter and Drop the Mic
- The crowd meter runs from 0 to 100.
- It gains the rating amount above, plus a bonus by hit result: crit +20, bypass +12, nerve +12, weak +10, resisted −5.
- Mooning adds 8.
- Each enemy hit lowers it by 4, or by 10 on a crit against $cott.
- At 100, **Drop the Mic** unlocks. Using it resets the meter to 0, and the finisher earns no crowd itself.
- **Locked at 100:** once full, the meter stays at 100 until the mic is dropped. This fixes a prototype bug: there, the enemy's hit always landed before $cott's next turn and knocked the meter back under 100, so the finisher could never fire.

### 5.6 Damage formula
- $cott's damage = power × timing multiplier × hit multiplier × 1.5 if Mooning × a random factor from 0.9 to 1.1.
- Enemy damage = power × hit multiplier × 1.3 if Short Squeezed × 1.25 if $cott is Mooning × a random factor from 0.85 to 1.15.
- Both round to a whole number, with a minimum of 1.

### 5.7 Status effects
- **Mooning** ($cott, 3 turns): he deals 1.5× damage and takes 1.25×. It counts down at the end of every round, including the one it's used in, so it boosts his next 2 attacks.
- **Rug Pulled** ($cott, 2 turns): he loses 8 Flow at the start of each of his next 2 turns, with no regen. It counts down as it drains.
- **Short Squeezed** (enemy, at 40% Clout or below): the enemy deals 1.3× damage for the rest of the fight.
- Ideas not built yet: *Ratio'd*, *Cancelled*.

### 5.8 Items
- **Cold Brew** (2 per fight): restores 30 Flow.
- **Hype Man Voicemail** (1 per fight): restores 35 Clout.
- Using an item takes the turn. **Run** doesn't consume a turn ("$cott doesn't run. He pivots.").
- **STALL:** if $cott can't afford any diss, has no items left, and the mic isn't ready, RUN becomes STALL, which skips his turn so Flow can regen. This fixes a prototype soft-lock.

### 5.9 Derek's AI
- If $cott isn't Rug Pulled and has at least 15 Flow, there's a 30% chance Derek uses **Pump & Dump**.
- Otherwise Derek picks by weight: Loss Porn 30, Due Diligence 20, Apes Together Strong 20, Hairline Short 15, Drip Check 15, Tendie Tower 10.
- His moves (type→target, power): Loss Porn ROAST→LIFESTYLE 13, Hairline Short ROAST→LOOKS 10, Due Diligence WORDPLAY→CAREER 14, Apes Together Strong WORDPLAY→REP 14, Drip Check FLEX→STYLE 14, Tendie Tower FLEX→WEALTH 16, Pump & Dump HYPE 7 (+ Rug Pulled).

### 5.10 Audio
- The beat is a procedural boom-bap loop at 92 BPM, generated with WebAudio. Sound effects use the same system.
- Phaser's own audio is disabled.

## 6. Planned systems (decided, not built)

### 6.1 Sin summons
- Once a Sin is recruited, $cott can **call them in** after choosing a type and target, but only when the target matches that Sin's trait (see the proposed targets in §3).
- The Sin appears as a **cut-in portrait** sliding in from the screen edge, adds a feature verse, applies their effect, and leaves. No extra characters stay on screen.
- Each summon has a **cooldown** measured in turns.
- Proposed effects (not final):
  - **Louis Change:** steals Flow from the enemy.
  - **Six Pac:** big crit chance.
  - **Susan G. Kummin:** charms the enemy so their next diss misfires.
  - **Babarbara:** ignores resistance, but $cott takes recoil damage.
  - **Lil' Turnt:** copies the enemy's last buff.
  - **Keezus:** double or nothing.
  - **J.R.R Toking:** slows the timing marker, and the enemy skips a turn.
- **Posse Cut** (idea): Drop the Mic upgrades into a finisher where every recruited Sin jumps in.
- **Writing cost:** $cott keeps his per-villain bars (about 11 couplets per villain, one per type and target). Each Sin needs one **feature line per eligible target**, and those lines work against **every** villain. A `{villain}` placeholder can personalize them.

### 6.2 Pre-battle parley
- Before each fight there's a short RPG-style conversation with the villain, with **1 to 3 choices**.
- Each choice is a recruited Sin's approach, and it's resolved by **that Sin's minigame**. There are no dice.
- Results:
  - **Good results:** reveal a soft spot early, the enemy starts *Rattled* (lower Clout), or $cott starts with crowd hype.
  - **Bad results:** the enemy starts buffed, or $cott starts shaken.
  - **Legendary or Fail:** something absurd happens.
- Each villain's parley lives in that villain's data file. This is a natural place for the lore writer to contribute.
- Open question: the prologue (Derek) has no Sins yet. It could skip the parley, or use a $cott-only tutorial version.

### 6.3 Sin minigames
Every minigame follows **one contract**, so the parley and side quests can use any of them:

```js
// src/minigames/<sin>.js
export default {
  id: 'catquiz', sin: 'lilturnt', title: "Lil' Turnt's Cat Quiz",
  // Launched as an overlay scene; resolves when finished.
  run(scene, { difficulty, level, context }) { /* ... */ return Promise.resolve({ grade, score }); }
};
// grade: 'fail' | 'pass' | 'great' | 'legendary'
```

A Sin's **level** makes their minigame easier: more time, fewer wrong options, or bigger payouts.

| Sin | Minigame | How it plays |
|---|---|---|
| Lil' Turnt | Cat quiz | Multiple choice. The right answer is **always** the one about cats being superior, however illogical. Players slowly figure out that logic doesn't matter. |
| Babarbara | Rage meter | Tap to build fury up to the max line without overflowing. Push your luck. |
| Susan G. Kummin | Rizz check | Pick the pickup line that fits the target's personality, scored on charm. |
| J.R.R Toking | Lore quiz | Multiple choice about the Sins' lore, drawn from the lore writer's material. Toking may "forget" to show the timer. |
| Keezus | Crypto bet | Live candle chart. Go long, go short, or cash out; leverage multiplies the result both ways. |
| Louis Change | Haggle | Push a price slider against the rival's patience meter. Push too hard and the deal walks. |
| Six Pac | Flex hold | Hold a pose while the meter climbs. Release in the sweet spot; hold too long and you pull something. |

Content these need: question banks for the cat quiz and lore quiz, and pickup lines matched to each villain's personality.

### 6.4 Sin levels and side quests
- Each Sin goes from **level 1 to 3.** A level makes their parley minigame easier and strengthens their summon.
- **Side quests** are optional stops on the overworld map. They reuse the existing systems (short battles, parleys, minigames) and reward Sin levels.

### 6.5 Overworld map (built)
- An illustrated portrait map from the map pack (`assets/map/`, see its README): a base image, plus fog, highlight, and gold-outline layers per region, tap polygons, landmark points, and the route.
- Flow: Title → map → tap a region → ENTER → walk the region to its villain (§6.6) → fight → back to the map. A region without a walkable map yet goes straight to its fight. Regions open by tier (§2): locked ones are fogged, open ones glow, cleared ones get a check. Clearing a region lifts the fog off whatever it opened and extends the dashed route. An open region without a villain file shows "coming soon".
- $cott's gold coin token stands on the last region he entered.
- Progress saves in `localStorage` (cleared regions, recruited Sins and levels, quests, token position). Clearing a region recruits its Sin at level 1.
- Not built yet: side-quest stops inside regions.

### 6.6 Walkable regions (built)
- Each region is a map $cott walks around in a **3/4 top-down view, like *Chained Echoes***: one painted map bigger than the screen, with the camera following him. Characters face down, up, left, or right.
- **Phone controls:** tap anywhere to walk there (he paths around water and props), hold and drag to steer, or use the **joystick**: a faint ring and knob in the bottom-right corner (`FIELD.stick` in `src/config.js`). A touch that starts on it steers him directly, sliding along walls. Beside it, down-left like a gamepad's A button, a **TALK button** (`FIELD.talkButton`) lights up gold when an NPC is in range and talks to the nearest one when pressed; it works with a thumb still on the stick (two touches are enabled). Both hide while someone's talking. Tapping an NPC to walk over and talk still works too.
- **Lettering on world art** (sign boards) uses a tiny 3×5 pixel font drawn on the art's 2 px grid (`ui/pixelFont.js`). Ordinary text has 1 px strokes, which shimmer when a phone scales the canvas by a non-whole factor and the camera moves.
- The villain waits somewhere in the region. Their talk ends with **FIGHT / NOT YET** (REMATCH once cleared). The pre-battle parley (§6.2) will hang off this talk, and side quests (§6.4) become NPCs and spots in the regions.
- Walking into an exit, or the MAP button, goes back to the overworld.
- Data: `src/data/maps/<region>.js` holds the map size, spawn, exits, NPCs (sprite, position, facing, lines, who they fight), and props (texture, feet position, footprint).
- **Scouting challenges (built):** minor characters in a region can hold a `challenge`. Win it and they spill intel on the region's villain: a weakness, a resistance, or soft spots (§5.3). Intel is saved, and in the fight those tags start filled in instead of "???", with an opening line saying so. Two kinds so far: **beat** (taps on the battle's timing bar, each at a set rating or better) and **quiz** (multiple choice; the first listed answer is right, shown shuffled). Losing costs nothing; try again. Data lives on the NPC in `src/data/maps/<region>.js`; logic is in `systems/intel.js`.
- **Subreddit Swamps locals:** **Bagholder Brad** (beat; reveals WEAK FLEX), **Mod Morgan** (rules quiz; reveals RESISTS ROAST and ROAST→INTELLECT), and **Chad**, Derek's wife's boyfriend (two harder beats; reveals FLEX→WEALTH and WORDPLAY→CAREER). Together they reveal all of Derek. Their lines are placeholders for the writing chat.
- Built for the Subreddit Swamps, with PixelLab art (§8.4): $cott, Derek, the three locals, the ground, and the props.

## 7. Tech stack

- **Engine:** Phaser **3.80.1**, pinned. Ask before changing versions.
- **Canvas:** **720×1280 portrait.** The prototype ran at 360×640, so its layout and font sizes double.
- **Config:** `pixelArt: true`, `roundPixels: true`, `scale: { mode: FIT, autoCenter: CENTER_BOTH }`, `audio: { noAudio: true }` until real audio files are added.
- **Fonts:** Press Start 2P (headers and labels) and VT323 (body text), from Google Fonts. Wait for both to load before booting the game.
- **Repo:** GitHub, plain ES modules with no build step. Deployed as a static site (see `HANDOFF.md`).
- **Version:** `src/version.js` holds the version and release date, shown small in the title screen's bottom-right corner. **Bump it in every change that goes to `main`** (minor for features, patch for fixes). It loads with the rest of the game code, so if the title shows an old version, the browser is running a cached copy: GitHub Pages lets browsers keep files about 10 minutes, and phones may keep the page in memory until it's fully reloaded.

## 8. Art pipeline

### 8.1 Character sprites
Source art is generated in GPT and cleaned up in a claude.ai chat:
1. Background and baked-in effects are removed. Effects come back as animated layers.
2. Sprites are mirrored so the crew **faces left**, toward the enemies, and villains **face right**, toward $cott.
3. They're snapped to a true pixel grid and quantized to a shared 128-color palette.
4. A 3 px dark outline is baked in.

In-engine rules:
- Draw at **scale 1**. Never use `setScale` on finished art.
  - **Temporary exception:** $cott is drawn at **1.3×** in battle (`LAYOUT.scottScale` in `src/config.js`), because he stands in the foreground and should read bigger than the enemies. **Art request:** re-export `scott.png` at about **420 px tall**, with the same 3 px outline and mirrored like the current repo copy; then the scale goes back to 1.
- **Exception:** procedural placeholder sprites (like Derek's) bake an integer pixel size into their texture at creation, rather than being scaled later.
- Use `setOrigin(0.5, 1)` so the origin is at the feet, and keep positions on whole pixels.
- Humans are about 320 px tall. Lil' Turnt is about 175 px.
- Idle animation: a 2–3 px sine bob tween.
- Active-turn highlight: `preFX.addGlow(0x9fdcff, 4, 0, false)`. It's WebGL-only, so guard it with `if (sprite.preFX)`.
- Now that only $cott is on screen, the 7 Sin sprites are used as **summon cut-ins** and **parley portraits**.

### 8.2 Battle layout (720×1280)
From the art chat's portrait mockup:
- Enemies stand upper-left, with feet around y 735. Allow 1–2 enemies per fight.
- The menu panel spans y 1090 to 1260.
- The mockup's party positions were (345, 905), (585, 860), and (540, 1050). With only $cott on screen, he takes a single lower-right spot, feet at (500, 1040).
- Depth: $cott is in the foreground, so he's drawn about 30% bigger than the enemies (about 420 px vs. about 330 px).
- Sin cut-ins slide in from the right edge.
- HUD, in the lyric ribbons' style (dark slanted strips, accent edge in the owner's color): the enemy's card is top-left and $cott's is lower-left, matching row for row (name, type or status row, Clout; $cott adds Flow and items). The crowd meter is top-right under the ? and SND buttons. The enemy's WEAK / RESISTS / SOFT SPOTS intel sits as small tags under its feet, not in its card.
- The menu panel and buttons use the same ribbon style, with text left-aligned.

### 8.3 Backgrounds
- Size: 720×1280 WebP, pre-dimmed, with the bottom band darkened for the menu.
- Built: `bg_tokyo.webp` (a portrait crop of the Tokyo street scene). Its region is still to be decided.
- GPT prompts for new backgrounds:
  - Ask for **9:16 portrait at 1080×1920**.
  - Put the horizon about halfway down, with open ground below it for both sides.
  - Keep the bottom 15% dark and simple.

### 8.4 Field art: walking sprites and region maps (art request)
For the walkable regions (§6.6). Placeholders are in the game now; finished files drop in under the same names. **Prompts, tools, layout guides, and file names: `docs/field-art-prompts.md`** (guide images in `docs/art/`). In short: ChatGPT for the style target, ground, props, and character turnarounds; a pixel-art tool like PixelLab for walk cycles, which ChatGPT can't keep consistent.

**Walker sprite sheets** (one per character who appears in a region: $cott first, then each villain, later the Sins):
- 3/4 top-down view, like *Chained Echoes*: the front when walking down, the back when walking up.
- A sheet of **96×144 px frames, 5 columns × 3 rows.** Rows face down, up, and left. Columns are idle, then a 4-frame walk (contact, passing, other contact, passing). Right-facing is the left row mirrored in-engine; add a 4th row only if the character is lopsided (a bag on one shoulder, say).
- The character stands about **120–130 px tall**, feet at the bottom center of each frame, on a transparent background.
- True pixel grid and a dark outline, like the battle sprites. Density: **2 screen px per art pixel**, so each frame is **48×72 art pixels**, drawn at 2×, and the character is about 62 art pixels tall. At 3 px (32×48 art pixels) every generator drew him chibi, under 3 heads tall; 2 px leaves room for about 4 heads. The outline is 2 px, not 3.
- **Built: $cott and Derek** (`assets/field/field_scott.png`, `field_derek.png`), made in PixelLab from their battle art, plus the swamp locals (`field_brad.png`, `field_morgan.png`, `field_chad.png`), made from text with $cott and Derek as the style reference. The recipe is in `docs/field-art-prompts.md`; `tools/region-art/walker.py` turns a PixelLab character into a sheet.
- NPCs who only stand still need just the idle column (the down row, plus left if they turn to face $cott).

**Region maps** (one per region):
- **Base:** the ground, 3/4 top-down, portrait, at the map's size (**1080×1920**, 1.5× the screen each way). WebP, at the walkers' 2 px density. No characters, and nothing tall that $cott should walk behind.
- **Built: the Subreddit Swamps.** Its ground isn't painted: `tools/region-art/compose.py` lays PixelLab terrain tiles (water, grass, dirt, reeds) over the map's own shapes, scatters small details, and writes the base and the walk mask. Re-run it after changing the tiles or the shapes. Props come from `tools/region-art/props.py`.
- **Props:** anything tall (trees, signs, tents, buildings) as separate transparent PNGs, placed by their bottom center. They sort by depth with the characters, so $cott walks behind a canopy and in front of a trunk.
- **Walk mask:** a PNG at the base's aspect ratio (a quarter size is fine): white where $cott can walk, black where he can't. If a painted map follows the placeholder's layout guide, the placeholder's mask still fits.
- **Points:** spawn, exits, NPC spots, and each prop's position and footprint, as a list (like the map pack's JSON). They go in `src/data/maps/<region>.js`.

## 9. Content and data conventions

- **Data-driven:** adding a diss, villain, Sin, quest, or minigame question should mean editing data files, not game logic.
- **One file per villain** (`src/data/enemies/<id>.js`) containing:
  - Stats, type, weaknesses, resistances, and soft spots, plus the messages shown when each is hit.
  - `scottBars[type][target]`: $cott's couplets against this villain.
  - Their moves, each with a type, target, power, AI weight, and bars.
  - Their parley script.
- **Crew** (`src/data/crew.js`): each Sin's eligible targets, summon effect, cooldown, feature lines by target, minigame id, and per-level modifiers.
- **Regions** (`src/data/regions.js`): tier, villain, Sin recruit, background, and side quests.
- **Bars are couplets:** two lines, delivered after the timing minigame. Every bar slot holds a **pool** of couplets, and one is picked at random, so adding variety means adding a couplet to the list.
- **Bars play as lyric ribbons** over whoever is spitting: each line on its own dark slanted strip with an accent edge in the speaker's color, and each later line's ribbon slides in once the line before it has landed. If a couplet is too tall for its space, the text steps down in size to fit. Words punch in one at a time, and individual **letters** jitter: plain letters only twitch now and then, rhyme letters shake constantly. **Rhyme words** are bolded: by default the last word of each line. To choose them yourself (internal or multi-word rhymes), wrap them in `[brackets]`, as in `"and your portfolio's [peak] was a Tuesday last [week]."`. A line wrapped in `*asterisks*` is a stage direction, shown as an italic action.

## 10. Open questions

- Villains for the seven remaining regions. Art exists for three (Vince, Max, Fulfiller); the map's Apex Launch Range has a rocket, which fits the rocket-billionaire idea (`max.png`). The Fulfillment Citadel is the everything-store overlord's (`fulfiller.png`).
- Which region the Tokyo background belongs to.
- Final Sin-to-target mapping, summon effects, and cooldown lengths. These should check against the lore writer's material.
- Prologue parley: skip it, or a $cott-only tutorial version?
- Parley outcome sizes: how much Clout *Rattled* removes, how much crowd hype a good result gives, and so on.
- Question banks for the cat quiz and lore quiz.

## 11. Decision log

- Browser game in Phaser, played on phones through a link.
- Combat is disses. Types and targets, with weaknesses, resistances, and soft spots applied both ways.
- Parody villains only.
- 720×1280 portrait canvas, with GPT art cleaned into pixel sprites.
- **Only $cott is on screen. Sins are summons, not party members.** This replaced the earlier party-of-3 plan.
- Pre-battle **parley uses Sin minigames, not dice.**
- Sins are recruited **one per region**, Octopath-style. Regions come in **pairs by tier**, plus a solo finale.
- Tier pairings: Lil' Turnt and Babarbara, then Susan and Toking, then Keezus and Louis, with Six Pac as the solo finale.
- Side quests raise Sin levels (1 to 3).
- The build moved to Claude Code and GitHub. Art and lore stay in claude.ai chats.
- The repo is **public**, so the game is hosted on **GitHub Pages** from `main`.
- Bars play over the speaker, not in the bottom text panel, as **lyric ribbons** (picked over classic, compact, and text-thread bubble mockups): rhymes bolded, jittery delivery, the second line sliding in after the first. The panel keeps narration and hit messages.
- Two fixes to prototype bugs are in: the **crowd meter locks at 100** until the mic drops (§5.5), and **STALL** replaces RUN when $cott is out of options (§5.8).
- The **overworld map** is the hub between fights, built from the map pack; region names come from it (§2, §6.5).
- **$cott is ~30% bigger than the enemies in battle** to sell depth (§8.2). In-engine 1.3× scaling is a stopgap until a ~420 px re-export of his sprite arrives (§8.1).
- **Regions are walkable**, in a *Chained Echoes*-style 3/4 top-down view with tap-to-move. $cott finds and challenges each villain in their region (§6.6). Field art is a separate set of smaller walking sprites and painted maps (§8.4).
- The **whole UI uses the ribbon style** (picked over classic, drum-pad, and phone mockups): every button, panel, HUD card, stat bar, and the timing bar. Battle menus have left-aligned text, $cott's and the enemy's HUD cards match, and the enemy's intel sits as tags at its feet (§8.2).
- **Walker sprites use 2 screen px per art pixel** (48×72 art-pixel frames), not 3, so characters can be about 4 heads tall instead of chibi (§8.4). $cott's sheet is the first one, made in PixelLab.
- **Region ground is built from PixelLab terrain tiles** laid over each map's shapes by a script, not painted as one image, so positions and the walk mask always line up (§8.4). The Subreddit Swamps is the first.
- **Minor characters can reveal villain intel** through small challenges (beat taps, quizzes). What you win is saved and shows on the villain's HUD from the start of the fight (§6.6).
- **Regions have a minimal joystick** (bottom-right) and a **TALK button** beside it, alongside tap-to-walk, since far taps are hard to reach one-handed in portrait. Sign lettering is pixel-font art on the 2 px grid, so it doesn't shimmer while the camera moves (§6.6).
- **The title screen shows the version** (`src/version.js`), bumped with every change to `main`, so players can tell whether they're on the latest build or a cached copy (§7). v0.5.0 is the first.
