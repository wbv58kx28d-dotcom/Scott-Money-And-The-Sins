# Property ladder art (PixelLab)

Isometric buildings for the property ladder (CLAUDE.md §6.9), one folder per
city in `src/`. All are 64 px wide, 2:1 isometric, transparent, each standing
on its own small diamond plot; the game anchors a sprite by the bottom of its
plot (the lowest opaque row, centered at x 32) onto a 64×32 lot tile, and
draws it at 2× like the rest of the field art. `tokyo_mockup.png` shows a
neighborhood composed from them (roads and grass are drawn tiles, not art).

Made with `create_image_pixflux` (1 generation each), `isometric: true`,
`no_background: true`, `outline: single color black outline`,
`shading: medium shading`, no init image. Free generation looked better than
painting over a layout template; plots vary a little in size, which reads fine
inside the lots. Sizes: 64×64 low, 64×96 mid, 64×128 high, 64×160 trophy.
Every prompt ends with "isometric city builder building on a diamond plot".

| File | Prompt (start) | Job |
|---|---|---|
| low_machiya | small traditional Japanese wooden machiya house with dark tiled roof, red lantern | ac7738c4 |
| low_noren | old Japanese wooden townhouse with a blue noren curtain over the door, dark tiled roof, potted plants | 0e468198 |
| low_twostory | small two-story Japanese house with white walls, dark tiled roof and a tiny bonsai garden | efe0058d |
| mid_neon | mid-rise Tokyo apartment building, five floors, beige concrete with balconies and lit windows, vertical pink neon sign on the corner | 33cd6991 |
| mid_capsule | Tokyo capsule apartment block, six floors, white concrete with round porthole windows, vending machines at the entrance | f0fd69cd |
| mid_karaoke | Tokyo karaoke and apartment building, five floors, grey tile facade, colorful glowing signs, shop on the ground floor | 7ee04d2f |
| high_glass | tall Tokyo skyscraper of dark blue glass with grids of glowing windows, pink neon stripe near the top, rooftop antenna | c2ade317 |
| high_neon, high_block | (create_image_pro, 4 candidates; #0 and #3) isometric skyscraper, dark blue glass, glowing windows, pink neon stripe, rooftop antenna | 8f159605 |
| trophy_spire | luxury neon spire penthouse supertall tower in Tokyo, sleek black and gold glass, glowing gold crown at the top with a tall needle spire | da57b800 |
| site_construction | (init image: a 64×96 lot-and-box template, strength 40) construction site on a dirt lot, steel girder frame, small yellow tower crane, cones, safety fence | b8e21986 |
| site_empty | (init image: a 64×64 lot template, strength 60) empty grass lot with a small wooden FOR SALE sign and a pink cherry blossom sapling | bd3f61df |
