# Field art: prompts and tools

Starter prompts and a workflow for the walkable-region art (`CLAUDE.md` §6.6, §8.4): walking sprites, the painted ground, and props. The look to aim for is *Chained Echoes*: a steep 3/4 top-down view, crisp 16-bit-style pixels, bright hue-shifted color.

## Files in `docs/art/`

| File | What it's for |
|---|---|
| `start-ground.png` | The Subreddit Swamps ground layout (path, pools, boardwalk, clearing, edges). Attach it to the ground prompt. |
| `start-layout.png` | The same map with props and characters where the game puts them. Attach it to show scale and placement. |
| `start-walkmask.png` | Where $cott can walk (white). If the painted ground follows the layout, this mask still works. |
| `field-sheet-template.png` | The walker sheet grid: 5 columns × 3 rows of 96×144 frames. The red line is the feet; the blue line is the head height (~126 px). |
| `field-sheet-example.png` | The placeholder $cott sheet in the game now: same grid, filled in. |

Keep the layout and the game's positions for props and characters stay valid. A different layout is fine too; the map data just gets redone to match.

## Which tool for what

ChatGPT's image generator is good at **one-off illustrations**: a style target, the ground, a page of props, a character turnaround. It's weak at **consistent animation frames**: walk cycles drift in size, proportions, and details from frame to frame. So:

| Asset | Best tool | Why |
|---|---|---|
| Style target, ground, props, character turnarounds | **ChatGPT** (prompts below) | Good composition, follows a reference image and a layout guide |
| Walk cycles | **[PixelLab](https://www.pixellab.ai/)** | Built for game pixel art: makes a character in 4 or 8 directions from a description or a reference image, then animates walks. Also has an Aseprite plugin. |
| Props or tiles at an exact pixel size | **[Retro Diffusion](https://www.retrodiffusion.ai/)** (optional) | A pixel-art model with exact output sizes and palettes, also with an Aseprite plugin |
| Fixing frames, assembling the sheet | **[Aseprite](https://www.aseprite.org/)** (about $20), or free: **[Piskel](https://www.piskelapp.com/)** in the browser, **LibreSprite** | Frame-by-frame editing and sprite-sheet export at an exact frame size |
| Palettes | **[Lospec](https://lospec.com/palette-list)** | Browse pixel-art palettes if you want one fixed palette across everything |

PixelLab and Retro Diffusion are paid, with free trials or credits. Check their current plans before buying. The cleanup step (pixel grid, shared palette, outline) still happens in the claude.ai art chat like the battle sprites, whichever tool makes the art.

## Workflow

1. **Nail the look first.** Run prompt 0 until a mock screenshot looks right. Then attach that mock as the style reference to every other prompt, so everything matches it.
2. **Ground and props** in ChatGPT (prompts 3 and 4).
3. **Characters:** a turnaround in ChatGPT (prompts 1 and 2), then the walk cycle in PixelLab from that turnaround. Prompt 1b tries the walk cycle in ChatGPT if you want to see how close it gets first.
4. **Cleanup in the art chat:** remove the magenta, snap to a 3 px pixel grid, quantize to the shared palette, add the outline, and lay the walker frames into `field-sheet-template.png` (feet on the red line).
5. **Hand off to Claude Code** with the file names below.

## Prompts

Attach these to each prompt:
- the *Chained Echoes* screenshot (or your prompt 0 mock, once you have one) as the style reference;
- the file named in that prompt.

Paste the **style block** at the start of every prompt.

### Style block

```text
STYLE: 16-bit JRPG pixel art with a modern, detailed finish, matching the attached reference screenshot. Steep 3/4 top-down view, SNES-style: the ground is seen from high above, while characters and props are drawn mostly from the front, so you see their faces and full height. Crisp pixels that are all the same size, with no anti-aliasing, blur, smooth gradients, or painterly brushwork. Bright, saturated but slightly earthy colors with hue-shifted shading (shadows lean blue-purple, highlights lean warm yellow). Light from the upper left. A dark 1-pixel outline on characters and props, but not on the ground. No text, no UI, no watermark.
```

### 0. Style target (mock screenshot)

```text
[STYLE BLOCK]

Draw a mock gameplay screenshot, portrait orientation, of a murky swamp area called "The Subreddit Swamps", in the style of the attached reference. A winding dirt path runs up through grass and dark green swamp pools with lily pads, crossing one pool on a wooden boardwalk. There are mossy cypress trees, a few dead bare trees, and dense reeds at the edges. At the top is a trampled clearing with an orange tarp tent and a meme-stock trader's gaming setup: a desk with three monitors showing red crashing charts and a red gaming chair.

Two small characters, each about 3 heads tall, are on the path:
- $cott Money: slicked dark hair, black shades, short beard, red blazer over a white shirt, dark pants, burgundy dress shoes.
- Diamond Hands Derek, standing in the clearing: a schlubby meme-stock trader with messy brown hair and a beard, headphones around his neck, a stained grey hoodie, black track pants with white stripes, white socks and slides, and glowing blue crystal hands.

Characters should be about 1/12 of the image height.
```

### 1. Character turnaround: $cott

Attach `assets/sprites/crew/scott.png` (his battle sprite) for his look.

```text
[STYLE BLOCK]

Using the attached battle sprite for his design, draw $cott Money as a small overworld walking sprite for a top-down JRPG, at the scale of the characters in the attached reference. Show THREE poses side by side, evenly spaced, the same size, with their feet on the same baseline:
(1) facing the camera, (2) seen from behind, (3) facing left in profile.
Relaxed standing pose with arms at his sides. About 3 heads tall, slightly chunky, like the reference characters. Keep the details readable at a small size: slicked dark hair, black shades, short dark beard, red blazer over a white shirt, dark pants, burgundy dress shoes.
Plain flat magenta background (#FF00FF), with no shadow and no scenery. Each figure should be about 42 pixel-art pixels tall.
```

### 1b. Walk cycle in ChatGPT (optional; PixelLab is usually better)

Attach the turnaround from prompt 1.

```text
[STYLE BLOCK]

Using the attached three-view turnaround of this character, draw a walk-cycle sprite sheet. Lay it out as a grid of 3 rows and 5 columns, evenly spaced, every frame the same size, feet on the same baseline in each row:
rows = walking toward the camera, walking away, walking left;
columns = standing still, then right foot forward, passing, left foot forward, passing.
Keep the character identical in every frame. Only the legs, arms, and a 1-pixel body bob change. Plain flat magenta background (#FF00FF), no shadows, no text.
```

### 2. Character turnaround: Derek

Attach `assets/sprites/enemies/derek.png`. He stands still in his region, so he only needs the front and side views.

```text
[STYLE BLOCK]

Using the attached battle sprite for his design, draw Diamond Hands Derek as a small overworld sprite for a top-down JRPG, at the scale of the characters in the attached reference. Show TWO poses side by side, the same size, with their feet on the same baseline: (1) facing the camera, (2) facing left in profile. Standing idle, holding an energy drink, smug.
Design: a schlubby meme-stock trader, about 3 heads tall and a bit wider than average, with messy brown hair, a beard, headphones around his neck, a stained grey hoodie with an ape logo, black track pants with white side stripes, white socks, slides, and glowing pale-blue crystal "diamond" hands.
Plain flat magenta background (#FF00FF), with no shadow and no scenery. Each figure should be about 44 pixel-art pixels tall.
```

### 3. Ground: The Subreddit Swamps

Attach `docs/art/start-ground.png` as the layout guide.

```text
[STYLE BLOCK]

Paint the GROUND LAYER of a portrait top-down JRPG map called "The Subreddit Swamps". Follow the attached layout guide exactly: the same dirt path route, the same pools in the same places, the boardwalk crossing the middle pool, the trampled clearing at the top, dense reeds framing all four edges, and the gap at the bottom center where the path leaves the map. Repaint it in the style of the reference: richer grass with small flowers and tufts, wet mud around the pools, dark green swamp water with lily pads, ripples, and floating algae, a weathered plank boardwalk, and a dirt path with pebbles and footprints.
Small funny details at ground level only: crushed energy drink cans, a cracked phone showing a red chart, a lost "HODL" baseball cap, a toy rocket stuck in the mud.
GROUND ONLY: do NOT draw trees, signs, tents, furniture, characters, or anything taller than ankle height. Those are added as separate sprites. Even overhead daylight, no vignette, no text. Fill the whole image edge to edge.
```

### 4. Props sheet

Attach `docs/art/start-layout.png` to show scale (the trees are about 1.8× a character's height).

```text
[STYLE BLOCK]

A sprite sheet of SEPARATE props for the same swamp map, in the same 3/4 top-down angle and pixel scale as the reference. Each prop stands alone on a plain flat magenta background (#FF00FF), with generous empty space between props and nothing overlapping. The bottom of each prop sits flat on an invisible ground line, with a small soft shadow directly under its base.
1. Two different swamp cypress trees with flared roots and hanging Spanish moss (about twice as tall as a character).
2. Two dead, bare, grey tree snags.
3. A wooden signpost with a BLANK board (the text is added in-game).
4. A meme-stock trader's battle station: a cheap desk with three monitors showing red crashing candlestick charts, a red gaming chair, energy drink cans, and tangled cables.
5. An orange tarp camping tent with a blank cloth banner.
6. Two clumps of tall reeds and cattails.
No text anywhere, and no characters.
```

## Hand-off to Claude Code

Finished files go here, under the names the game already uses. Each one replaces its placeholder:

| Asset | Path | Notes |
|---|---|---|
| $cott walker sheet | `assets/field/field_scott.png` | 480×432: 5×3 frames of 96×144, in the template's layout |
| Derek walker sheet | `assets/field/field_derek.png` | Same grid. Fill only the idle column (down and left) and leave the rest blank. |
| Ground | `assets/regions/start/base.webp` | Any portrait size; the map data gets fit to it |
| Walk mask | `assets/regions/start/walk.png` | White is walkable; any size at the ground's aspect ratio |
| Props | `assets/props/prop_cypress.png`, `prop_snag.png`, `prop_sign.png`, `prop_setup.png`, `prop_tent.png` | One prop per file, trimmed, with feet at the bottom center. Extra variants (a second cypress, reeds) are welcome; they get new names. |

All of these use the same cleanup as the battle sprites: a true pixel grid at 3 screen px per art pixel, the shared palette, and a dark outline (3 px, which is 1 art pixel) on characters and props.
