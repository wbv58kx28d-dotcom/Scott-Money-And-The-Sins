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
Glam pink and gold with a phone mount, drawn straight-on in three views (`create_image_pro`, 9 candidates each):
| File | Job | Notes |
|---|---|---|
| `front.png` | `89764031` #4 | 72×72, his idle front frame as style image and identity reference; least baked-in spray |
| `back.png` | `db0db924` #1 | 72×72, the front pick as the design reference and his back frame for identity; stripes and nozzle match |
| `side.png` | `df4d9716` #3 | 84×72, plus his side frame and a flat side-elevation guide; came back nose-right (all nine did), mirrored by `jetski.py`; jacket flapping |

## Sky Deck (`../skydeck/`, `../skytowers/`)
`python3 tools/region-art/skydeck.py` cuts the picked bridges (`picks/bridge_h.png`, `picks/bridge_v.png`) to one seamless segment each (`bridge_h.png`, `bridge.png`) and draws the lagoon below (`assets/vista/isles_below.png`); then `tileset.py skydeck`.

**Bridges and gates** (`create_image_pro`, the turret's top as the style image): across, 168×96 with `prop_skybridge` as the design reference, job `b7ae67cc` #1 (pointed pink arches with roses; passed over a scalloped one, a single big arch and a gothic arcade); down, 80×168, job `157f10e9` #1 (a pink runner, balustrades hung with banners; passed over plain, rose-vined and gold-carpet ones); the first gates (job `a5a8d95f`, and `ba87082a` side-on) came out turned at an angle and were replaced. **Gates now are straight-on** (CLAUDE.md §8.4): a front elevation at 84×84, job `4bbf8bd3` #3 (domed pillar caps, a crown, lanterns: `../props/prop_sky_gate.png`), made with a composition guide drawn in code (two slim pillars at the edges, a wide opening; the model still narrowed it to about 54 px on screen) and an earlier straight-on take (`9ea532cc` #3, opening too narrow) as the design reference; `../props/prop_sky_pillar.png` is its left pillar, cut out with the cut edge outlined, used in pairs for bridges running across. An edge-on side view (`809ef158`, `2e4ce11c`) came out angled every time. Numbers count from 0.

**Tower bodies** (`../skytowers/<name>.png`, baked by `python3 tools/region-art/skytowers.py` into `assets/skydeck/`): one tall `create_image_pro` image per tower (1 candidate at that size, 25 generations each), the tower's own rooftop at the top and its body plunging down past the bottom, with its exterior castle prop as the style image and the design reference, and a procedural silhouette (`../skytowers/guides/`, the turret's or the keep's) as the composition reference. Prompts asked for a corbelled crown, varied floors (arched galleries, balconies, banners, vines, a rose window, a clock on the keep), narrowing slightly toward the bottom, and no clouds (the game drifts its own wisps across). Two takes each; picks:
| File | Job | From | Notes |
|---|---|---|---|
| `keep.png` | `bdb8b12d` | `prop_castle_keep` | gold crown ring around the railed rooftop, a clock, a rose window, banners, a gothic arcade lower down; 256×640 art px |
| `turret.png` | `b0c3b6b3` | `prop_castle_turret` | arched gallery, balcony, banners, vines, rose window |
| `rose.png` | `f421ce4c` | `prop_castle_turret_b` | draped in rose vines, an arched window with flower boxes |
| `twin.png` | `3fc416fd` | `prop_castle_turret_c` | slim, side doorways near the top, gold filigree; the smallest top |

Passed over: keep `2988a7dd` (its tiers widen going down), turret `e08a6d65`, rose `ee08f9f5`, twin `0ae40e01`; the first test turret `5b16a13b` (a baked-in cloud). Procedural bodies (stacked bands and windows drawn in code) and image-to-image passes over the guide (`create_image_pixflux`, 1 generation each) were tried first and didn't reach the castle art's look.

`marble_hedge` (`c224dc9d-d791-45b8-9705-6681a7e6926d`): the castle grounds' marble (chained from its base tile) with clipped rose-hedge planters, for terraces painted onto the deck (the towers bring their own rooftops now). Passed over: pink flagstone with marble inlay (`d99c8432…`), and a sky-garden lawn ringed by clouds (`e50c4927…`).

## Castle props (`../props/`)
All from `create_image_pro`, with the picked concept as both style image and reference. Concept round: job `cd0a41fb` ("pink fairytale keep + halo", 4 takes), picked over a cat-ear castle (`d8c77621`) and a mirror palace (`b74daef0`).
| File | Size (art px) | Job | Notes |
|---|---|---|---|
| `prop_castle_keep.png` | 176×288 | `13a3d38f` | central keep: crown roof, halo, side balcony doors for bridges, pink carpet; about 4.6× $cott on screen |
| `prop_castle_turret.png` | 80×168 | `7241ff84` #1 | satellite turret, bridge door on its left (mirror it for the right) |
| `prop_castle_turret_b.png` | 80×168 | `ea910075` #2 | wider and rose-draped, a balcony door |
| `prop_castle_turret_c.png` | 80×168 | `6ca71689` #2 | bridge doors on both sides, a junction partway along a chain of bridges |
| `prop_skybridge.png` | 168×72 | `0b25495b` #0 | covered bridge, straight-on 3/4, for the outside view; the Sky Deck walks on a top-down version |

Every candidate is also saved in the PixelLab gallery.
