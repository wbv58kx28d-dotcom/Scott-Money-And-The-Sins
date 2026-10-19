# Influencer Isles: art sources (in progress)

Picked so far, step by step with the user. Nothing here is wired into the game yet: no `art.json`, no `PROP_IMAGES` entries, no layout.

## Direction
- Islands dot a lagoon; $cott crosses between them on a **jet ski**.
- Envy (Lil' Turnt) holds court in a **fantasy princess castle**: a tall central keep linked to smaller turrets by **sky bridges**. She sees herself as a princess.
- **Sky Deck:** the towers stand as tall props on their islands, and an elevator leads up to a separate rooftop map: the tower tops are platforms over a drop with the lagoon far below (the swamp's drop terrain plus a looking-down vista, not built yet), joined by the bridges. Envy waits in the central keep's penthouse.

## Ground (`tiles/`), the "golden-hour" look
Standard PixelLab top-down tilesets, 16 px, chained through the sand base tile (`03cc7f28-09c3-4f12-84ac-3d32d0885ad4`).
| Pair | Tileset | Notes |
|---|---|---|
| `water_sand` | `41ef5c06-cb4b-4d74-b608-8fafee6bf68c` | teal "filter" water, golden peach sand, cream foam on wet amber sand; round, transition 0.25 |
| `sand_grass` | `a75812f7-232d-4580-a4ca-f18d6592a1d5` | trimmed resort lawn with tiny flowers; round, 0.25 (grass base tile `9406bb30-365e-4fbb-8761-1c4deb76d10b`) |
| `sand_marble` | `6db0a99a-0f8a-4bc0-8876-cfea2f71ff04` | cream marble paving with gold inlay for the castle grounds; square, 0 (marble base tile `fd1f3253-be39-4931-b192-db2488b0eb46`) |

Passed over: a postcard turquoise and white-sand set (`d1406b24…`) and a pastel pink and lavender set (`d5dbb61b…`); both came back with their labels swapped.

## Sky Deck (`../skydeck/tiles/`)
`marble_hedge` (`c224dc9d-d791-45b8-9705-6681a7e6926d`): the castle grounds' marble (chained from its base tile) with clipped rose-hedge planters, which ring each rooftop as railings. Passed over: pink flagstone with marble inlay (`d99c8432…`), and a sky-garden lawn ringed by clouds (`e50c4927…`).

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
