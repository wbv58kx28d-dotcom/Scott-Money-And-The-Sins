# Influencer Isles: art sources (in progress)

Picked step by step with the user. The Isles has a first map (`src/data/maps/isles.layout.js`, CLAUDE.md §6.6) with the jet ski, and the Sky Deck above the castle's keep.

## Direction
- Islands dot a lagoon; $cott crosses between them on a **jet ski**.
- Envy (Lil' Turnt) holds court in a **fantasy princess castle**: a tall central keep linked to smaller turrets by **sky bridges**. She sees herself as a princess.
- **Sky Deck (built as a test map):** the towers stand as tall props on their islands, and an elevator leads up to a separate rooftop map: the tower tops are platforms over a drop with the lagoon far below (a looking-down vista: the lagoon with two cloud layers drifting between, following the clock), joined by the bridges. Each tower is a generated body whose own rooftop is the floor, running off the bottom of the screen. Envy waits in the central keep's penthouse.

## Ground (`tiles/`), the "golden-hour" look
Standard PixelLab top-down tilesets, 16 px, chained through the sand base tile (`03cc7f28-09c3-4f12-84ac-3d32d0885ad4`).
| Pair | Tileset | Notes |
|---|---|---|
| `water_sand` | `41ef5c06-cb4b-4d74-b608-8fafee6bf68c` | teal "filter" water, golden peach sand, cream foam on wet amber sand; round, transition 0.25 |
| `sand_grass` | `a75812f7-232d-4580-a4ca-f18d6592a1d5` | trimmed resort lawn with tiny flowers; round, 0.25 (grass base tile `9406bb30-365e-4fbb-8761-1c4deb76d10b`) |
| `sand_marble` | `6db0a99a-0f8a-4bc0-8876-cfea2f71ff04` | cream marble paving with gold inlay for the castle grounds; square, 0 (marble base tile `fd1f3253-be39-4931-b192-db2488b0eb46`) |

Passed over: a postcard turquoise and white-sand set (`d1406b24…`) and a pastel pink and lavender set (`d5dbb61b…`); both came back with their labels swapped.

`art.json` wires them up for `python3 tools/region-art/tileset.py isles`: LAGOON (`w`), SAND (`s`, the base), LAWN (`g`) and MARBLE (`m`), the water darkening in bands toward the middle, soft patches on each, and the decals below.

**Decals** (`decals/`, `create_image_pro` at 32×32, 64 candidates a round, a 64 px swatch of the `water_sand` tiles as the style image; the number in each file name is its candidate): beach litter, job `86f3eabb` (shells 0, 6, 16, conch 19, starfish 8 and 13, pebbles 40, seaweed 54, flip-flops 24, heart sunglasses 30, iced coffee 59, coconut 37, sandcastle 33, a gold coin 46, a palm frond 48, a lei 61; the big pink starfish 9 read head-sized and came out); on the lagoon, job `ffedec2c` (a flamingo float 1, a donut float 8, a rose 22, petals 21, a cork 32, a beach ball 42, lily pads 49 and 53, rubber swans 56, sparkles 63; foam rings 27 read as UI bubbles and came out).

**The dock** (`bridge.png`): `create_image_pro` at 56×112, job `97521174` #0: teak planks, gold-capped posts, a pink rope coil, plain planks in the middle so it stretches.

**Props** (`../props/`, a cypress as the style image for outline, detail and shading, not its palette): palms at 96×144, job `1a9c2cb4` (#0 `prop_palm`, #2 `prop_palm_b`, #1 `prop_palm_c`, pink-tinged with a gold garland; #3 had signs at its foot); the **jet-ski shack** at 112×96, job `7653a6cd` #1 (its sign reads JET-SKI), a straight-on front elevation from a composition guide (gable, awning, centered door). Passed over: beach umbrellas with loungers (`2eeabe14`, every lounger turned at an angle) and an empty parked jet ski (`8e99840a`, every candidate cut off at the canvas edge).

**People** (`../standees/`, `standee.py`): Dockhand Dylan, job `7f3bf039` #3 (pink STAFF tank, clipboard, shades); the castle guard, job `581413d8` #6 (pink and gold tabard, a ring-light halberd, bored). Both at 48×72 with the jet ski's front as the style image and $cott's front frame for proportions.

## The jet ski (`../jetski/`, baked by `python3 tools/region-art/jetski.py`)
Glam pink and gold with a phone mount. 16 headings from 9 drawn views (`views/`: s ssw sw wsw w wnw nw nnw n; the east half is mirrored in-engine).
| View | Source |
|---|---|
| `s` | the front pick: `create_image_pro` job `89764031` #4, 72×72, his idle front frame as style image and identity reference (least baked-in spray), cleaned by the first `jetski.py` |
| `sw` `w` `nw` `n` | `create_object_pro_flash` object `360c9249` (8 directions from the front, 96×96, low top-down; about 2 generations) |
| `ssw` | `animate_image` job `995f6ff4` (S turning to SW, interpolated, 4 frames), frame 2 |
| `wsw` | job `14c98032` (SW to W), frame 2 |
| `wnw` | job `0cd3863b` (W to NW), frame 2 |
| `nnw` | job `054dd46e` (NW to N), frame 3 (that turn eases out, so its frame 2 is still nearly NW) |

Passed over: a halfway view from `create_image_pro` (job `d7c23508`, the S and SW views as references): all four candidates drew the front again, two waving. The first three views (`front.png`, `back.png` job `db0db924` #1, `side.png` job `df4d9716` #3, straight-on with a side-elevation guide) were replaced by the rotation so every heading matches; they stay in `../jetski/` for reference.
