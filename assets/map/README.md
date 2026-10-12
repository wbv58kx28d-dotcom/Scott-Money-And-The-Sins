# Overworld map layers (720x1280, Phaser 3.80)

All coordinates are in canvas pixels (the map fills the 720x1280 canvas at scale 1).

## Files
- `map_base.webp`: the full map. Draw first at (0,0), origin 0.
- `regions/<key>_fog.webp`: locked look (dark, desaturated, cloudy). Place at the region's x,y (origin 0). Fade alpha to 0 when the region unlocks.
- `regions/<key>_mask.png`: white silhouette. Use for hover/current highlight, e.g. `setTint(0xffe68c).setAlpha(0.22)` with an alpha pulse tween, or `setBlendMode('ADD')`.
- `regions/<key>_outline.png`: glowing gold border for the selected/current region.
- `map_regions.json`:
  - `regions[]`: key, order (0 = start ... 8 = citadel), name, sin, x, y, w, h (bbox for placing layers), node (landmark point for the token, pins, labels), poly (hit-test polygon, canvas coords).
  - `route[]`: one segment per step (frm, to, points). Draw progressively as a dashed line as regions are cleared.

## Keys in order
start (Subreddit Swamps, prologue) -> isles (Lil' Turnt) -> ratio (Babarbara) -> riviera (Susan) -> lofi (Toking) -> bubble (Keezus) -> offshore (Louis) -> apex (Six Pac) -> citadel (final tower)

## Tap handling
`new Phaser.Geom.Polygon(region.poly.flat())` and `Phaser.Geom.Polygon.Contains(poly, x, y)` on pointerdown.

## Layer order
base -> fog (locked regions) -> highlight mask -> outline -> route -> node pins -> $cott token -> UI.
Keep the bottom ~160 px for the region info panel.
