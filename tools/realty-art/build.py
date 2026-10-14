"""Turn the property ladder's PixelLab art into game-ready files (minigames/realty.js).

    python3 tools/realty-art/build.py

Buildings: tools/realty-art/src/<city>/<name>.png (64 px wide, isometric, each
on its own little plot) are trimmed so the bottom of the plot is the bottom of
the image (the game stands them by their bottom center on a lot), then scaled
2× with nearest-neighbor into assets/realty/<city>/<name>.png.

Ground: the lot and road tiles are drawn here rather than generated, so they
sit exactly on the 2:1 grid: a 64×32 art-pixel diamond (128×64 on screen)
plus a 3 px slab edge. Written to assets/realty/ground_<name>.png:
    grass0..2   lawn with a little texture (three, to break up repeats)
    road_i      road running along the i axis (dashes down-right)
    road_j      road running along the j axis (dashes down-left)
    road_x      crossroads
    rubble      a lot just after the wrecking ball
"""

import glob
import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'realty-art', 'src')
OUT = os.path.join(ROOT, 'assets', 'realty')

TW, TH, EDGE = 64, 32, 3


def up(im, k=2):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def diamond(fill, edge, speckle=None, seed=0, dash=None, bricks=False):
    rnd = random.Random(seed)
    im = Image.new('RGBA', (TW, TH + EDGE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    top, right, bottom, left = (32, 0), (63, 16), (32, 31), (0, 16)
    d.polygon([left, bottom, (32, 31 + EDGE), (0, 16 + EDGE)], fill=(40, 36, 48, 255))
    d.polygon([right, bottom, (32, 31 + EDGE), (63, 16 + EDGE)], fill=(30, 27, 38, 255))
    d.polygon([top, right, bottom, left], fill=fill)
    px = im.load()
    inside = lambda x, y: abs(x - 31.5) / 32 + abs(y - 15.5) / 16 < 0.92
    if speckle:
        for _ in range(70):
            x, y = rnd.randrange(2, 62), rnd.randrange(1, 31)
            if inside(x, y):
                px[x, y] = speckle
    if bricks:
        for _ in range(26):
            x, y = rnd.randrange(8, 56), rnd.randrange(5, 27)
            if inside(x, y) and inside(x + 2, y + 1):
                c = rnd.choice([(150, 84, 64, 255), (120, 110, 104, 255), (176, 160, 140, 255)])
                for dx in range(3):
                    px[x + dx, y] = c
                    px[x + dx, y + 1] = c
    if dash:
        # Dashes along the road's axis, through the tile's center.
        for t in range(-30, 31):
            if (t // 4) % 2:
                continue
            x = 32 + (t if dash == 'i' else -t)
            y = 16 + t // 2
            if 0 <= x < TW and inside(x, y):
                px[x, y] = (232, 220, 170, 255)
    d.line([top, right, bottom, left, top], fill=edge)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(SRC, '*', '*.png'))):
        city = os.path.basename(os.path.dirname(path))
        im = Image.open(path).convert('RGBA')
        box = im.getbbox()
        # Keep the full width (the plot's bottom vertex stays at x 32), trim the bottom.
        im = im.crop((0, 0, im.width, box[3]))
        os.makedirs(os.path.join(OUT, city), exist_ok=True)
        up(im).save(os.path.join(OUT, city, os.path.basename(path)), optimize=True)

    asphalt, curb = (58, 58, 72, 255), (44, 44, 56, 255)
    tiles = {
        'grass0': diamond((86, 142, 74, 255), (60, 100, 52, 255), (104, 164, 88, 255), seed=1),
        'grass1': diamond((86, 142, 74, 255), (60, 100, 52, 255), (104, 164, 88, 255), seed=2),
        'grass2': diamond((82, 136, 70, 255), (60, 100, 52, 255), (74, 124, 64, 255), seed=3),
        'road_i': diamond(asphalt, curb, (66, 66, 80, 255), seed=4, dash='i'),
        'road_j': diamond(asphalt, curb, (66, 66, 80, 255), seed=5, dash='j'),
        'road_x': diamond(asphalt, curb, (66, 66, 80, 255), seed=6),
        'rubble': diamond((118, 102, 86, 255), (90, 76, 64, 255), (96, 84, 72, 255), seed=7, bricks=True),
    }
    for name, im in tiles.items():
        up(im).save(os.path.join(OUT, f'ground_{name}.png'), optimize=True)
    print('wrote', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
