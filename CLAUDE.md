# $cott Money: Redemption Arc — Project Brief

Shared context for every chat and for Claude Code. In the repo this file is `CLAUDE.md`. In claude.ai, keep it in Project knowledge.

_Last updated: Oct 17, 2026. Replaces `SCOTT_MONEY_RPG.md`._

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
- Whichever region in a tier is played second will be a bit easier, because $cott has one more Sin. That's intended: the order is a strategic choice. If it feels too easy, villains can gain a small amount of Ego for each Sin already recruited.
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
- HYPE type, 150 Ego. Weak to FLEX, resists ROAST.
- Soft spots: FLEX→WEALTH (crit), ROAST→INTELLECT (bypass), WORDPLAY→CAREER (nerve).
- Status: becomes *Short Squeezed* at 40% Ego or below.

**Planned archetypes** (sprites already in `assets/sprites/enemies/`, named by file; no battle data yet):
- A thrift-shop rapper (`vince.png`).
- A rocket-obsessed billionaire (`max.png`). One idea is pairing him with Six Pac's (Pride) finale region.
- The **everything-store overlord** who rules from the final tower (`fulfiller.png`, boss-sized at 395 px tall).

**Still needed:** about **5 more regional villains**, for 7 regional villains total plus the final boss. Pairing each villain thematically with their region's Sin is encouraged. A villain's soft spots can reward that tier's Sin summons, but no summon should ever be required.

## 5. Combat (built in the prototype)

The legacy prototype (`legacy/scott-money-battle.html`) is the **source of truth for every number** below.

### 5.1 Stats and turn flow
- **Ego** is HP. $cott has 100. (It was called Clout until the social app (§6.10) took that name for its meter.)
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
- **Short Squeezed** (enemy, at 40% Ego or below): the enemy deals 1.3× damage for the rest of the fight.
- Ideas not built yet: *Ratio'd*, *Cancelled*.

### 5.8 Items
- **Cold Brew** (2 per fight): restores 30 Flow.
- **Hype Man Voicemail** (1 per fight): restores 35 Ego.
- **Shop extras:** items bought in the phone's shop (§6.7) wait in a saved stash and add to the per-fight counts; the free ones are used first.
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
  - **Good results:** reveal a soft spot early, the enemy starts *Rattled* (lower Ego), or $cott starts with crowd hype.
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
- **Title screen:** with progress saved, it offers **CONTINUE** or **START FRESH** (a second tap confirms, then the save is wiped). A new player just sees TAP TO START. Debug: `&title=1` shows the title even in debug mode.
- Not built yet: side-quest stops inside regions.

### 6.6 Walkable regions (built)
- Each region is a map $cott walks around in a **3/4 top-down view, like *Chained Echoes***: one painted map bigger than the screen, with the camera following him. Characters face down, up, left, or right.
- **Phone controls:** tap anywhere to walk there (he paths around water and props), hold and drag to steer, or use the **joystick**: a faint ring and knob in the bottom-right corner (`FIELD.stick` in `src/config.js`). A touch that starts on it steers him directly, sliding along walls. Beside it, down-left like a gamepad's A button, a **TALK button** (`FIELD.talkButton`) lights up gold when an NPC is in range and talks to the nearest one when pressed; it works with a thumb still on the stick (two touches are enabled). Both hide while someone's talking. Tapping an NPC to walk over and talk still works too.
- **Lettering on world art** (sign boards) uses a tiny 3×5 pixel font drawn on the art's 2 px grid (`ui/pixelFont.js`). Ordinary text has 1 px strokes, which shimmer when a phone scales the canvas by a non-whole factor and the camera moves.
- The villain waits somewhere in the region. Their talk ends with **FIGHT / NOT YET** (REMATCH once cleared). The pre-battle parley (§6.2) will hang off this talk, and side quests (§6.4) become NPCs and spots in the regions.
- Walking into an exit, or the phone's MAP app (§6.7), goes back to the overworld.
- Data: each region is two files (§6.11): `src/data/maps/<region>.layout.js` says where things are (the ground as a terrain grid, the spawn, exits, boardwalks, props, and the spot of every NPC and rope) and is written by the map editor; `src/data/maps/<region>.js` says what they are (names, lines, challenges, fights, classic posts, gifts, rope prices), keyed by id.
- **Scouting challenges (built):** minor characters in a region can hold a `challenge`. Win it and they spill intel on the region's villain: a weakness, a resistance, or soft spots (§5.3). Intel is saved, and in the fight those tags start filled in instead of "???", with an opening line saying so. Three kinds so far: **beat** (taps on the battle's timing bar, each at a set rating or better), **quiz** (multiple choice; the first listed answer is right, shown shuffled), and **trade** ($cott's day trade, §6.8). Losing costs nothing; try again. Data lives on the NPC in `src/data/maps/<region>.js`; logic is in `systems/intel.js`.
- **Subreddit Swamps locals:** **Bagholder Brad** (day trade, "teach Brad to sell"; reveals WEAK FLEX), **Mod Morgan** (rules quiz; reveals RESISTS ROAST and ROAST→INTELLECT), and **Chad**, Derek's wife's boyfriend (two harder beats; reveals FLEX→WEALTH and WORDPLAY→CAREER). Together they reveal all of Derek. Their lines are placeholders for the writing chat.
- **Velvet ropes (built), like *Super Mario 64*'s star doors:** a region's map can hold `gates`, a rope with a Clout price lettered over it (social Clout, §6.10). Its footprint blocks the way until $cott talks to the rope's bouncer with enough Clout; then it unhooks and stays open for good (saved). Clout only goes up, so a rope never closes again. The Subreddit Swamps has the first: **Velvet Vinny** guards the **Swamp Yacht Club**, an island in a lagoon reached by a boardwalk, for **500 Clout**. Inside, **Whale Wendy** gives a one-time gift ($750 and a Hype Man Voicemail) and unlocks a classic post. A first run can reach it before beating Derek.
- **Talking unlocks posts:** an NPC with `unlocks` hands $cott one of his classic posts (§6.10) after their first talk. Brad, Morgan, Chad and Wendy each have one. An NPC's `talkAgain` lines replace `talk` once he's met them, and `gift` is given once.
- Built for the Subreddit Swamps, with PixelLab art (§8.4): $cott, Derek, the three locals, Vinny and Wendy, the ground, and the props (including the rope, open and closed, and Wendy's lounge chair).

### 6.7 $cott's phone (built)
- A **PHONE** button (top-right in regions, top-left on the overworld map) opens $cott's phone over the game, which pauses underneath. It's the in-game menu: it replaced the region's MAP button and the map's SND button.
- **Apps** (`src/data/phone.js`): **MAP** (out to the overworld), **Y** ($cott's social app, §6.10), **STONKS** (stake cash on the day trade), **REALTY** (the property ladder, §6.9), **SHOP** (spend it), **SETTINGS** (sound, reset progress, version, and for now a **phone toggle**: TRY SMARTPHONE / TRY FLIP PHONE swaps models for free while the phone is a work in progress; take it out before release). More apps go in the same list.
- **Two models.** $cott starts on a **flip phone**: a green LCD with pixel-font lettering, a 2×2 icon grid, and a keypad whose right soft key is BACK and red key hangs up. The shop sells the **smartphone** ($2,500): wallpaper, status bar, a cash widget, a 4-column grid of app tiles, and a home bar.
- **Money:** $cott starts with $500. Winning a fight pays the villain's `reward` (Derek: $1,000 on the first clear, $150 for a rematch). **Stonks:** stake $100/$250/$500 on **$cott's day trade** (§6.8) under a random parody ticker. The trade opens with the stake as its cash, and whatever it's worth at the closing bell comes back. The phone steps aside while the trade plays full-screen, then shows the profit or loss. Each fight refills **3 trades**, so the market can't be farmed forever.
- **Shop:** Cold Brew $150, Hype Man Voicemail $300 (they stack in the stash, §5.8), and the smartphone.
- Saved with the rest of the progress: cash, phone model, stash, trades left. Debug flags: `&cash=5000`, `&phone=smart`.
- **Art (PixelLab):** both phone bodies come from `create_ui_asset` with a layout template of the screen and keys, so the art lands where the code expects it. Also from PixelLab: the flip phone's 2-tone LCD icons (palette-locked to the LCD), the smartphone's app tiles, and its synthwave wallpaper. Sources live in `tools/phone-art/src/`; `tools/phone-art/build.py` crops and scales them into `assets/phone/` (bodies at 2×, LCD icons at 3×, tiles at 2×), lifts the flip phone's glass glare into an overlay drawn over the LCD, and lays the wallpaper into the smartphone's glass (a gold-framed slab). The screen and key rects in `PhoneScene.js` were measured from the art; if art is missing, a drawn stand-in uses the same rects.
- A red count on the PHONE button (and on the Y icon) shows what's new in the social app: unseen posts plus classic posts waiting to go out (`ui/badge.js`). The smartphone's home widget shows his Clout beside his cash.
- Code: `scenes/PhoneScene.js` (both bodies, the home screens, the apps),  `ui/phoneIcons.js` (fallback pixel icons).

### 6.8 $cott's day trade (built)
$cott's own minigame, not a Sin's. It's played for Bagholder Brad's challenge and, with real cash at stake, in the phone's Stonks app (§6.7); its result includes the account's final `value` for that. It follows the §6.3 contract (`src/minigames/trade.js`, an overlay scene), so the parley and side quests can use it too.
- A live price chart draws across the screen for **24 seconds**. One big button flips between **BUY** (all in at the current price) and **SELL** (cash out). Whatever's still held at the **closing bell** is sold.
- **Goal:** finish up **25%** or better. Grades: under the goal is *fail* ("PAPER LOSSES"), the goal is *pass*, 2× the goal is *great* ("TENDIES!"), 4× is *legendary* ("TO THE MOON!").
- The price swings in legs that alternate up and down. Some legs are **news**: a BREAKING headline (parody only) shows about 0.6 s before a sharp move, so reading the news pays.
- Every market is checked before it's played: holding from open to close never reaches the goal (diamond hands don't pay), and trading the swings clears it with room to spare. By simulation, reacting 0.7 s late to every turn always passes, and 1 s late passes about 90% of the time.
- Tuning and headlines: `src/data/trade.js`. A challenge can override the ticker, length, stake, goal, and headlines. Price paths and account math: `src/systems/market.js` (pure, unit-tested). A natural base for Keezus's crypto bet (§6.3), which adds shorting and leverage.

### 6.9 $cott's property ladder (built)
$cott's own minigame, played from the phone's REALTY app (§6.7). Play money for now: it doesn't touch his cash. It follows the §6.3 contract (`src/minigames/realty.js`, an overlay scene).
- **Pick a city:** Tokyo (towers over a village of old wooden homes), Los Angeles (bungalows, stucco villas, hilltop mansions), or Seattle (craftsman houses, condos, glass towers). Each has its own buildings, unit names (a random first part plus a second, like "KOI POND COTTAGE"), and local headlines.
- **The map:** an **isometric neighborhood** like web real-estate games: a 7×7 grid of lots with a road cross, so four blocks. The back block is the skyline (high tier, with the **trophy** on its back corner), the side blocks are midtown (mid), the front block is the village (low). It's wider than the screen: **drag to pan**, tap a building to select it (the frontmost building drawn under the finger wins). 20 units stand at the start (6 low, 10 mid, 4 high, plus the trophy); the other lots are empty.
- **One building at a time:** prices move **twice a month** (every ~1.75 s; inside, the session runs in half-month ticks, `REALTY.perMonth`, and the config's month values are converted by `inTicks`). Every lot updates on its own moment within each tick (a fixed shuffle), so prices, listings, cranes, and wrecking balls ripple across the map one building at a time instead of the whole city changing at once. A tag's up/down arrow shows briefly when its price moves, then fades.
- **Development:** every 3–4 months something happens on a lot, and the ticker says so (LOCAL news). A **crane** goes up on an empty lot and opens 3–5 months later as a new unit of the zone's tier, listed for its first 3 months. Or a unit is **booked for the wrecking ball**: off the market from the booking, torn down 2 months later (rubble for a month, then the lot can be built on); if it's $cott's, the developer **buys him out** at market price, no fee. Or a unit is **booked for a renovation**: 2 months later it's worth 25% more and gets a new look. The trophy is never touched.
- **Money:** $cott starts with enough to buy the cheapest home outright. The **bank lends 60%** of any price but the trophy's, which is **cash only**. A sale repays the loan, less a **6% realtor fee**.
- **Clock:** 36 months, a month every 3.5 s (about 2 minutes), prices moving twice a month.
- **Trends:** each kind of property (village, midtown, skyline) moves in **trends 4–6 months long**, alternating up and down (now and then flat), leaning back toward where it started so holding pays nothing. Trends are **front-loaded**: the biggest moves come first, then taper off, so a trend shows on the map right away. A row of **trend chips** under the ticker shows where each kind is heading (HOT ▲▲, RISING ▲, STEADY, COOLING ▼, CRASHING ▼▼), flipping **half a month (one tick) before** each trend starts: buy what's turning green, sell before it cools. (A full month's lead plus once-a-month updates left 3.5–7 s between a chip and the prices, too long to feel connected.)
- **News is flavor:** a BREAKING headline only for the big trends (HOT or CRASHING), matching which way it went; LOCAL news for wrecking-ball and glow-up bookings, new buildings opening, and buyouts. Filler and reruns crawl in between. (The first version made headlines the only signal; they came too fast to read, so the chips took over.)
- **On the map:** listed and owned units show a price tag. **Tap a tag to buy** (if it's listed and he can make the down payment), **tap it again to sell**; tapping anywhere else on a building just selects it, and the BUY/SELL button still works. Tags he can afford right now are **green**; his own carry his gold flag, with the value lettered **green while it's worth more than he paid and red while it's worth less**. Unlisted units are dimmed (grey tint on WebGL, see-through on Canvas). The info card under the map covers whatever's selected: a unit (price, change, down payment or what selling brings back, any booking), a crane (when it opens), rubble, or an empty lot.
- **Grades:** trophy by half time is *legendary* ("REAL ESTATE MOGUL"), by 70% *great*, by the end *pass*; otherwise *fail* ("STILL RENTING").
- **Fairness:** every session is checked before it's played: a player who acts half a month after each chip flips wins (around month 19 of 36 by simulation), one acting a month late still wins (around month 25), and buying a home and holding it never does.
- **Art:** Tokyo's buildings are PixelLab isometric sprites (64 px wide, each on its own little plot): three variants per tier, the gold-spire trophy, and a construction site. Sources, prompts, and job ids are in `tools/realty-art/` (README); `tools/realty-art/build.py` trims and scales them 2× into `assets/realty/<city>/` and draws the ground tiles (grass, roads, rubble) on an exact 2:1 grid. Los Angeles and Seattle use drawn isometric stand-ins (`src/ui/buildings.js`) until their art is made the same way.
- Tuning, cities, headlines, and development: `src/data/realty.js`. Sessions, development, and account math: `src/systems/realty.js` (pure, unit-tested in `tools/realty.test.mjs`). Debug: `&speed=4` runs minigame clocks faster.

### 6.10 Y, $cott's social app (built)
A parody of the bird site ("Y, the everything app (formerly Chirper)"), opened from his phone; it takes the whole screen on either model. NPCs talk to $cott through it, and posting there wins back his **Clout**: the meter that opens velvet ropes around the world (§6.6), the way stars open doors in *Super Mario 64*. Battle HP was renamed **Ego** so the two don't collide (§5.1).
- **Clout only goes up.** He starts at 0. A bad post earns a little, never a loss, and an opened rope stays open.
- **The feed:** NPC posts, newest first, mixed with his own. Each feed post can wait on the story (`when`: a region cleared, a challenge won, an NPC met, a rope opened, or a Clout level), so new posts land as he plays: Derek taunts him from the start, Chad posts once $cott has met him, Lil' Turnt and Babarbara post once the swamp is cleared (teasing Tier 1), and so on. Posts new since his last look get a pink edge. Drag to scroll (the feed is its own camera, no mask). Avatars are the head of each character's field sprite; accounts without one get an initial.
- **Replies:** some posts take a REPLY: pick one of three. The right one (the first in the data, shown shuffled) earns **60 Clout** and a good answer from the poster; the others earn 5 and a cold one. One reply per post.
- **Posting** (`src/minigames/post.js`, the §6.3 contract): **3 posts per fight**, refilled after every fight like Stonks trades. (1) **Write:** three hashtags are trending; pick one of three drafts. A draft on a trending hashtag reaches **2×**; a **classic** (below) always does. (2) **Time it:** a day's "followers online" curve, with a marker sweeping back and forth (2.2 s a pass); tap POST at **prime time**. The share of the peak sets the rating: PRIME TIME (≥90%) 2×, GOOD HOUR (≥70%) 1.5×, SLOW HOUR (≥45%) 1×, EVERYONE WAS ASLEEP 0.25×. A smaller second bump is a decoy that never reaches GOOD HOUR. Clout = the draft's base (35–50) × reach × timing; 4× or more is WENT VIRAL. Then the likes roll in, with a reply or two from fans. NOT NOW backs out without using the post. Drafts he posted lately sit out.
- **Classic posts:** talking to certain NPCs unlocks one of $cott's classic posts (base 150–200, always 2× reach). It waits at the top of his drafts until he posts it, once. **The four in the game are placeholders**, to be replaced with real posts from the account Zach made for $cott.
- **Big moments post themselves:** a first clear (Derek: +250 Clout, rematches +25), a Stonks trade graded great (+40) or legendary (+80), and a REALTY climb the first time per city and grade (+50 / +100 / +200).
- **The numbers** are set so the swamp's 500-Clout rope opens on a first run: the pre-fight replies plus three decent posts (or two and a classic) get there; three flops don't (unit-tested).
- Data (accounts, feed, drafts, classics, trends, tuning): `src/data/social.js`. Feed rules and scoring: `src/systems/social.js` (pure, unit-tested in `tools/social.test.mjs`). The app: `scenes/SocialScene.js`. Saved: Clout, posts left, unlocked and posted classics, NPCs met, replies, his own posts, the order the feed arrived in, ropes opened, and the big moments already bragged about. Debug: `&clout=600`.

### 6.11 The map editor (built)
Regions are laid out in an editor built into the game: open `index.html?debug=1&edit=<region id>` (works on the live site, best on a desktop or tablet; phones work too). It uses the game's own tiles, props, and characters, so what you see is what the region plays like. A region without a map yet opens as a blank one.
- **Tools** (tabs along the bottom): **VIEW** (drag to look around), **PAINT** (paint water, grass, dirt, or reeds with a 1–3 brush; edges blend on their own, and terrains with no tile between them give way to grass), **SELECT** (tap a thing to pick it, drag to move it; it can be copied, deleted, renamed, turned, swapped for another prop, resized for boardwalks and exits, and a rope gets a bouncer), **ADD** (props, NPCs, velvet ropes, boardwalks, exits), and **MAP** (grow or shrink the map 4 cells at a time on any side, PLAYTEST, EXPORT, IMPORT, REVERT). Pinch or scroll to zoom in any tool; right-drag pans; UNDO/REDO; Ctrl+Z, Delete, and arrow-key nudges on a keyboard.
- **CHECK** runs the map checks and shades the map: green where $cott can walk from the start, gold behind a rope, red cut off. Problems list under the top bar; tap one to look at it.
- **Drafts and saving:** every change autosaves a draft in that browser. **PLAYTEST** plays the draft as the real region (progress stays in memory, so the real save is untouched); its EDIT button comes back. **EXPORT** downloads `<id>.layout.js` (and copies it): send it to Claude or upload it to `src/data/maps/` on GitHub. A static site can't save to the repo itself. A brand-new region also needs a line in `src/data/maps/index.js`.
- **The layout file** (`systems/mapfile.js` writes it, one object per line so diffs stay readable): the tileset, cell size (32 px), and the **terrain grid**, one letter per cell corner (`w` water, `g` grass, `d` dirt, `r` reeds); each cell is drawn with the tile whose four corners match (`systems/terrain.js`). The game draws the ground in 512 px chunks (`ui/terrainView.js`), so maps can grow past a phone's texture size limit.
- **Map checks** (`systems/mapcheck.js`), run by the editor, the unit tests (every committed map must pass), and anything generated: $cott can reach every exit and NPC from the spawn (ropes down); every rope closes something off (no walking around it) and its bouncer is reachable without passing it; nothing stands off the map; warnings for things standing in water or reeds. The Region scene builds its walk grid from the same code.
- **Where it's headed:** the same files are meant for AI to draft and people to touch up: Claude can write a layout (and check it) for the editor to refine, and a scripting tool can edit the content files (NPC lines, challenges, quests) the way the editor edits layouts.

## 7. Tech stack

- **Engine:** Phaser **3.80.1**, pinned. Ask before changing versions.
- **Canvas:** **720×1280 portrait.** The prototype ran at 360×640, so its layout and font sizes double.
- **Config:** `pixelArt: true`, `roundPixels: true`, `scale: { mode: FIT, autoCenter: CENTER_BOTH }`, `audio: { noAudio: true }` until real audio files are added.
- **Fonts:** Press Start 2P (headers and labels) and VT323 (body text), from Google Fonts. Wait for both to load before booting the game.
- **Repo:** GitHub, plain ES modules with no build step. Deployed as a static site (see `HANDOFF.md`).
- **Tests:** `npm test` (unit tests in `tools/*.test.mjs`) and `npm run smoke` (Playwright plays the game in headless Chromium; screenshots land in `tools/screenshots/`). Headless Chromium has no GPU, so WebGL runs in software at a few frames a second and timing checks give false failures. The smoke test loads every step but one with `&canvas=1` (Phaser's Canvas renderer, 60 fps headless) and waits on game state instead of fixed sleeps. Do the same in any new browser check.
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
- HUD, in the lyric ribbons' style (dark slanted strips, accent edge in the owner's color): the enemy's card is top-left and $cott's is lower-left, matching row for row (name, type or status row, Ego; $cott adds Flow and items). The crowd meter is top-right under the ? and SND buttons. The enemy's WEAK / RESISTS / SOFT SPOTS intel sits as small tags under its feet, not in its card.
- The menu panel and buttons use the same ribbon style, with text left-aligned.
- The lean only suits short strips: any card, panel, or button taller than 140 px (`TALL` in `src/ui/ribbon.js`) stands upright, with a vertical accent edge.

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
- **Built: $cott and Derek** (`assets/field/field_scott.png`, `field_derek.png`), made in PixelLab from their battle art, plus the swamp locals (`field_brad.png`, `field_morgan.png`, `field_chad.png`), made from text with $cott and Derek as the style reference. Velvet Vinny and Whale Wendy (`field_vinny.png`, `field_wendy.png`, idle only) were made the same way for the Swamp Yacht Club. The recipe is in `docs/field-art-prompts.md`; `tools/region-art/walker.py` turns a PixelLab character into a sheet.
- NPCs who only stand still need just the idle column (the down row, plus left if they turn to face $cott).

**Region maps** (one per region), made in the map editor (§6.11):
- **Ground:** drawn from tiles, not painted as one image (below). There's no size limit: maps grow in the editor 4 cells (128 px) at a time. The swamp is 34×60 cells (1088×1920, about 1.5× the screen each way).
- **Built: the Subreddit Swamps.** Its ground isn't painted, and there's no ground image: the layout's terrain grid (§6.11) picks a PixelLab tile (water, grass, dirt, reeds) for every cell, and the game draws them, with small details scattered on top, when the region loads. `tools/region-art/tileset.py swamp` builds the tileset the game reads (`assets/regions/swamp/`: the tiles color-graded to sit under the props, the decals, the boardwalk, and `tileset.json`). Shape the ground in the map editor. Props come from `tools/region-art/props.py`.
- **A new region's ground** needs a tileset like the swamp's: PixelLab top-down Wang tilesets for each pair of terrains that meet (each through a shared base terrain, like grass), plus decals, in `tools/region-art/<set>/` with an `art.json`; then `tileset.py <set>`.
- **Props:** anything tall (trees, signs, tents, buildings) as separate transparent PNGs, placed by their bottom center. They sort by depth with the characters, so $cott walks behind a canopy and in front of a trunk. To offer one in the editor, list it in `PROP_IMAGES` (`src/data/assets.js`) with a name and a footprint.
- **Where $cott can walk** comes from the terrain (water and reeds block), boardwalks and exits (always walkable), and the footprints of props, NPCs, and closed ropes (`systems/mapcheck.js`).

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
- Parley outcome sizes: how much Ego *Rattled* removes, how much crowd hype a good result gives, and so on.
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
- **$cott's phone is the in-game menu** (§6.7): MAP, STONKS, SHOP, and SETTINGS apps. He starts on a flip phone and buys the smartphone upgrade in the shop. Cash comes from fight rewards and Stonks trades (3 per fight) and buys battle items.
- **Stonks plays the day trade** (§6.8) with real cash at stake, replacing the placeholder ticker bet. While the phone is in progress, SETTINGS has a toggle to swap models (§6.7).
- **The title screen asks CONTINUE or START FRESH** when there's a save (§6.5).
- **Regions are made in a map editor built into the game** (§6.11), not by asking Claude to generate bigger maps blind. A region is a layout file (a terrain grid plus where everything stands, written by the editor) and a content file (who's there and what they say). The ground is drawn from tiles at runtime instead of one baked image, so maps can grow past phone texture limits and repaint live. Shared map checks keep hand-made, editor-made, and AI-made maps playable. Picked over generating maps by description (fast, but layout is judgment Claude makes blind) and over Tiled (a desktop install that can't preview the game). Meant to grow into AI drafts plus human touch-ups, and a scripting tool for content.
- **$cott has a social app, Y, and Clout is its meter** (§6.10): NPCs post and @ him there, and posting, replying, and big wins earn Clout. Clout only goes up and opens **velvet ropes** in the regions, like *Super Mario 64*'s star doors (§6.6). Battle HP is now **Ego**, since Clout took the name. Talking to people in the world unlocks $cott's classic posts (placeholders until the real ones from his account are in).
- **$cott's property ladder** (§6.9): flip homes in a city neighborhood, reading a news ticker, up to a cash-only trophy property. The bank lends half on everything else; without that, the climb was out of reach in a session. Play money for now.
- **Property ladder prices move twice a month, and trends hit right away** (§6.9): chips flip half a month ahead and trends are front-loaded, so a chip flip shows on the map within a couple of seconds.
- **Property ladder trends are shown, not read** (§6.9): a chip per kind of property says where it's heading a month ahead, headlines are flavor, the clock is slower (36 months of 3.5 s), and lots update one at a time. Headlines as the only signal came faster than anyone could read them, and the whole map changing at once was jarring.
- **The property ladder is an isometric map** (§6.9), like web real-estate games, on a 7×7 lot grid you pan around, with buildings that go up, come down, and get renovated during a session. Building art comes from PixelLab's isometric image mode, generated freely (painting over a layout template came out flat); ground tiles are drawn so they sit exactly on the grid. Tokyo first.
- **Browser tests use the Canvas renderer** (`&canvas=1`): headless Chromium's software WebGL is too slow to time anything (§7).
- **$cott has his own day-trading minigame** (§6.8): buy and sell as a live stock chart swings, finish up 25% by the closing bell. Bagholder Brad's challenge became this trade ("teach Brad to sell") instead of a beat tap; Chad keeps the beat challenge.
- **Tall ribbon shapes stand upright.** Slanted edges looked odd on tall cards (the trade chart, the battle HUD cards), so anything over 140 px tall drops the lean (§8.2).
