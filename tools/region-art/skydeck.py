"""Make the Sky Deck's art: its bridges and the lagoon far below.

    python3 tools/region-art/skydeck.py

The Sky Deck (CLAUDE.md §6.6) is the top of Envy's castle: rooftops over a drop,
joined by bridges, with the Influencer Isles far below. Each piece has to tile
exactly, so the generated bridges are cut to seamless segments here, and the
lagoon is drawn from the Isles' tiles. Colors come from the castle's
turrets (cream stone, pink bands, gold trim) and the rooftops' marble. (The
towers' bodies under the rooftops are PixelLab art: tools/region-art/isles/README.md.)

tools/region-art/skydeck/:
  bridge.png   a walkway running down the screen (picks/bridge_v.png, PixelLab: a
               pink runner on marble, balustrades hung with banners), cut to one
               segment that repeats seamlessly; the game tiles it along a bridge
               (art.json's bridges `tile`).
  bridge_h.png one running across the screen (picks/bridge_h.png: a balustraded
               deck over pointed pink arches with roses), cut the same way and
               padded so its deck sits at the image's middle.

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

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', 'region-art', 'skydeck')

DECK_H = 31  # the middle row of bridge_h's walkway deck in its pick (art px)

def seamless(im, axis, lo, hi, window=3):
    """
    Cut a generated bridge down to one segment that repeats without a seam: of every cut [x0, x0 + k)
    along `axis` (1 across, 0 down) with k from lo to hi, the one whose next column (or row) best
    matches its first, over a few lines, so the copy after it carries on cleanly.
    """
    a = np.asarray(im).astype(int)
    a = a if axis == 0 else a.transpose(1, 0, 2)
    n = a.shape[0]
    best = None
    for k in range(lo, min(hi, n - window)):
        for x0 in range(0, n - k - window):
            d = np.abs(a[x0:x0 + window] - a[x0 + k:x0 + k + window]).mean()
            if best is None or d < best[0]:
                best = (d, x0, k)
    _, x0, k = best
    return (im.crop((0, x0, im.width, x0 + k)) if axis == 0 else im.crop((x0, 0, x0 + k, im.height))), k


def bridges():
    """The picked bridges (picks/), each cut to one seamless segment; the one running across padded so its deck is centered."""
    v, kv = seamless(Image.open(os.path.join(OUT, 'picks', 'bridge_v.png')).convert('RGBA'), 0, 70, 100)
    h, kh = seamless(Image.open(os.path.join(OUT, 'picks', 'bridge_h.png')).convert('RGBA'), 1, 70, 100)
    # The game centers bridge_h.png on the bridge's rect, so put its deck (DECK_H, art rows) in the middle.
    h = h.crop((0, 0, h.width, h.getbbox()[3]))
    pad = max(0, h.height - 2 * DECK_H)
    out = Image.new('RGBA', (h.width, h.height + pad))
    out.alpha_composite(h, (0, pad))
    return v, out, kv, kh


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
    v, h, kv, kh = bridges()
    v.save(os.path.join(OUT, 'bridge.png'))
    h.save(os.path.join(OUT, 'bridge_h.png'))
    vista = os.path.join(ROOT, 'assets', 'vista')
    os.makedirs(vista, exist_ok=True)
    draw_below().save(os.path.join(vista, 'isles_below.png'), optimize=True)
    print(f'skydeck: bridge ({kv} art px a segment), bridge_h ({kh}); assets/vista/isles_below.png')


if __name__ == '__main__':
    main()
