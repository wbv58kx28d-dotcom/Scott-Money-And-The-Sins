"""Draw the Sky Deck's art: its bridges and the lagoon far below.

    python3 tools/region-art/skydeck.py

The Sky Deck (CLAUDE.md §6.6) is the top of Envy's castle: rooftops over a drop,
joined by bridges, with the Influencer Isles far below. Drawn here rather than
generated, since each piece has to tile exactly. Colors come from the castle's
turrets (cream stone, pink bands, gold trim) and the rooftops' marble. (The
towers' bodies under the rooftops are PixelLab art: tools/region-art/isles/README.md.)

tools/region-art/skydeck/:
  bridge.png   a marble walkway running down the screen, gold rails on both sides;
               its middle rows repeat to any length.
  bridge_h.png the same running across the screen: a back rail, the deck, a front
               rail and the bridge's edge below; its middle columns repeat.

assets/vista/isles_below.png: the lagoon seen from the top of the castle, drawn
from the Isles' own tiles at 1 screen px per art px (half the world's, so it
reads as far away) and tiling both ways (islands wrap at the edges), with a few
of the castle's turrets standing on islands. The haze over it and the clouds
drifting between are added by the game (ui/vista.js), since they follow the clock.
"""

import json
import math
import os
import random

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'region-art', 'skydeck')

INK = (21, 14, 9)
GOLD = [(252, 251, 175), (247, 226, 120), (219, 161, 75), (160, 104, 48)]
PINK = [(246, 139, 144), (220, 116, 124), (197, 96, 106)]
MARBLE = [(251, 250, 236), (244, 239, 222), (229, 229, 217), (192, 179, 161)]

def deck(x, y):
    """Marble slabs 8 art px square with gold inlay seams (repeats every 8 px both ways)."""
    sx, sy = x % 8, y % 8
    if sx == 7 or sy == 7:
        return GOLD[2] if (sx + sy) % 2 else GOLD[1]
    if sx == 0 or sy == 0:
        return MARBLE[0]
    return MARBLE[1] if (x // 8 + y // 8) % 2 else MARBLE[0]


def draw_bridge():
    """A walkway running down the screen: 40 art px wide (a 32 px deck between gold rails), 48 tall."""
    W, H = 40, 48
    im = Image.new('RGBA', (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            if x in (0, W - 1):
                c = INK
            elif x in (1, 2, W - 3, W - 2):
                # Rails: posts every 8 rows, a gold bar between.
                post = y % 8 in (0, 1)
                c = GOLD[0] if x in (1, W - 3) else GOLD[2]
                if post:
                    c = GOLD[1] if x in (1, W - 3) else GOLD[3]
            elif x in (3, W - 4):
                c = MARBLE[3]  # the deck's edge, in the rails' shadow
            else:
                c = deck(x - 4, y)
            px[x, y] = c + (255,)
    # Thresholds at both ends, where the bridge meets a rooftop.
    for x in range(1, W - 1):
        for y in (0, 1, H - 2, H - 1):
            px[x, y] = (GOLD[1] if y in (0, H - 1) else GOLD[2]) + (255,)
    return im


def draw_bridge_h():
    """A walkway running across the screen: a back rail, a 32 px deck, a front rail, the bridge's edge. 48 wide."""
    W, H = 48, 44
    im = Image.new('RGBA', (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            post = x % 8 in (0, 1)
            if y == 0:
                c = INK
            elif y in (1, 2):
                c = (GOLD[1] if post else GOLD[0]) if y == 1 else (GOLD[3] if post else GOLD[2])  # back rail
            elif y == 3:
                c = MARBLE[3]
            elif y < 34:
                c = deck(x, y - 4)
            elif y in (34, 35):
                c = (GOLD[1] if post else GOLD[0]) if y == 34 else (GOLD[3] if post else GOLD[2])  # front rail
            elif y == 36:
                c = INK
            elif y < 42:
                c = PINK[0] if y < 38 else PINK[1] if y < 40 else PINK[2]  # the bridge's edge, in the castle's pink
            elif y == 42:
                c = (165, 108, 113)
            else:
                c = INK
            px[x, y] = c + (255,)
    return im


def wang_tiles(name):
    sheet = Image.open(os.path.join(ROOT, 'tools', 'region-art', 'isles', 'tiles', f'{name}.png')).convert('RGBA')
    meta = json.load(open(os.path.join(ROOT, 'tools', 'region-art', 'isles', 'tiles', f'{name}.json')))
    out = {}
    for t in meta['tileset_data']['tiles']:
        c, b = t['corners'], t['bounding_box']
        out.setdefault(tuple(c[k] for k in ('NW', 'NE', 'SW', 'SE')), sheet.crop((b['x'], b['y'], b['x'] + 16, b['y'] + 16)))
    return out


def draw_below(seed=5, cells=64):
    """The lagoon far below: islands on a torus, so the image tiles both ways."""
    rand = random.Random(seed)
    sea, lawn = wang_tiles('water_sand'), wang_tiles('sand_grass')
    isles = []
    while len(isles) < 22:
        x, y, r = rand.uniform(0, cells), rand.uniform(0, cells), rand.uniform(1.4, 4.6)
        if all(torus(x, y, ox, oy, cells) > r + orr + 2.5 for ox, oy, orr in isles):
            isles.append((x, y, r))

    def shape(x, y, grow=0.0):
        for bx, by, r in isles:
            dx, dy = wrap(x - bx, cells), wrap(y - by, cells)
            if math.hypot(dx, dy) < r + grow + 0.6 * math.sin(3 * math.atan2(dy, dx) + bx):
                return True
        return False

    def layer(tiles, grow, hi, lo):
        corner = [[hi if shape(i, j, grow) else lo for i in range(cells + 1)] for j in range(cells + 1)]
        im = Image.new('RGBA', (cells * 16, cells * 16))
        for j in range(cells):
            for i in range(cells):
                im.paste(tiles[(corner[j][i], corner[j][i + 1], corner[j + 1][i], corner[j + 1][i + 1])], (i * 16, j * 16))
        return im

    img = layer(sea, 0, 'upper', 'lower')
    # Lawn in the middle of the bigger islands.
    grass = layer(lawn, -1.6, 'upper', 'lower')
    mask = Image.new('L', img.size)
    mp = mask.load()
    for y in range(img.height):
        for x in range(img.width):
            if shape(x / 16, y / 16, -1.3):
                mp[x, y] = 255
    img.paste(grass, (0, 0), mask)
    # A few of the castle's turrets on the biggest islands (their art at 1 screen px per art px, like the tiles).
    turrets = [Image.open(os.path.join(ROOT, 'tools', 'region-art', 'props', f)).convert('RGBA')
               for f in ('prop_castle_turret.png', 'prop_castle_turret_b.png', 'prop_castle_turret_c.png')]
    big = sorted(isles, key=lambda s: -s[2])[:4]
    for k, (bx, by, r) in enumerate(big):
        t = turrets[k % len(turrets)]
        x, y = int(bx * 16 - t.width / 2), int(by * 16 - t.height + 24)
        # Drawn wrapped, so one standing near an edge shows on the other side too.
        for ox in (-img.width, 0, img.width):
            for oy in (-img.height, 0, img.height):
                img.paste(t, (x + ox, y + oy), t)
    return img


def wrap(d, n):
    return (d + n / 2) % n - n / 2


def torus(x0, y0, x1, y1, n):
    return math.hypot(wrap(x0 - x1, n), wrap(y0 - y1, n))


def main():
    os.makedirs(OUT, exist_ok=True)
    draw_bridge().save(os.path.join(OUT, 'bridge.png'))
    draw_bridge_h().save(os.path.join(OUT, 'bridge_h.png'))
    vista = os.path.join(ROOT, 'assets', 'vista')
    os.makedirs(vista, exist_ok=True)
    draw_below().save(os.path.join(vista, 'isles_below.png'), optimize=True)
    print('skydeck: bridge, bridge_h; assets/vista/isles_below.png')


if __name__ == '__main__':
    main()
