# assets/

Finished, game-ready art. Paths are always relative (`assets/...`, never
`/assets/...`) because the site is served from a sub-path.

| Folder | Contents | Rules |
|---|---|---|
| `sprites/crew/` | `scott.png` + the 7 Sin PNGs from `phaser_crew_pack.zip` | Facing left, 3 px outline baked in, drawn at scale 1 |
| `sprites/enemies/` | Villain sprites, one PNG per villain id (e.g. `derek.png`) | Same rules as crew |
| `bg/` | Battle backgrounds, 720×1280 WebP (e.g. `bg_tokyo.webp`) | Pre-dimmed, bottom band dark for the menu |

The asset list the game loads lives in `src/data/assets.js`. Every entry is
optional: if a file is missing, the game draws a procedural placeholder instead,
so the build never breaks while art is still in progress.
