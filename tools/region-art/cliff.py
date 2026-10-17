"""Draw the face of a cliff: the rock a 3/4 view shows below raised ground.

    python3 tools/region-art/cliff.py swamp

A tileset's high ground (a terrain with `cliff` in art.json) only shows its
top in the Wang tiles; the game hangs this face below every south-facing edge
of it (ui/terrainView.js), so a plateau stands up off the ground. The strip is
CLIFF_W art px wide and tiles seamlessly sideways (the game picks columns by
world x), FACE art px tall: a grassy lip with moss hanging off it, layered
wet rock, and a dark foot where it meets the ground.

Drawn here rather than generated: it has to tile exactly. Colors match the
toxic bog (grey-violet rock and moss, a few glowing pink fungus spots).
Output: tools/region-art/<set>/cliff.png (art px), which tileset.py scales
into assets/regions/<set>/.
"""

import os
import random
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CLIFF_W, FACE = 64, 24

INK = (18, 13, 28)
LIP = [(150, 141, 36), (122, 116, 34)]  # the plateau grass, curling over the edge
ROCK = [(68, 56, 84), (61, 50, 76), (74, 61, 90)]
ROCK_LIGHT = (96, 82, 112)
ROCK_DARK = (44, 35, 58)
CRACK = (30, 23, 40)
MOSS = [(125, 116, 148), (101, 93, 124)]
FUNGUS = (255, 79, 216)
FOOT = (24, 18, 32)


def draw(seed=11):
    rnd = random.Random(seed)
    im = Image.new('RGBA', (CLIFF_W, FACE))
    px = im.load()
    # Strata: bands of rock whose seams wander a little, each with a lit top row and a dark bottom row.
    seams = []
    y = 4
    while y < FACE - 3:
        h = rnd.randint(4, 6)
        phase, amp = rnd.random() * 6.28, rnd.choice([0, 1, 1])
        seams.append((y, h, phase, amp))
        y += h
    import math

    for x in range(CLIFF_W):
        # Wrap-safe noise: everything that varies by x uses a period that divides CLIFF_W.
        for yy in range(FACE):
            px[x, yy] = ROCK[(x // 3 + yy // 2 + (x * 7 + yy * 3) % 5) % len(ROCK)]
        for (sy, h, phase, amp) in seams:
            off = round(amp * math.sin(phase + x * 2 * math.pi / 32))
            top = sy + off
            if 0 <= top < FACE:
                px[x, top] = ROCK_LIGHT
            seam = top + h - 1
            if 0 <= seam < FACE:
                px[x, seam] = CRACK
            if 0 <= seam - 1 < FACE and px[x, seam - 1] != ROCK_LIGHT:
                px[x, seam - 1] = ROCK_DARK
    # Vertical cracks within bands.
    for _ in range(9):
        x = rnd.randrange(CLIFF_W)
        y0 = rnd.randint(5, FACE - 6)
        for yy in range(y0, min(FACE - 2, y0 + rnd.randint(2, 5))):
            px[x, yy] = CRACK
            if px[(x + 1) % CLIFF_W, yy] != CRACK:
                px[(x + 1) % CLIFF_W, yy] = ROCK_DARK
    # The lip: plateau grass curling over the top edge, with an ink line under it.
    for x in range(CLIFF_W):
        lip = 2 + (1 if (x * 5) % 7 == 0 else 0)
        for yy in range(lip):
            px[x, yy] = LIP[(x + yy) % 2]
        px[x, lip] = INK
    # Moss hanging off the lip.
    for _ in range(12):
        x = rnd.randrange(CLIFF_W)
        length = rnd.randint(2, 9)
        for yy in range(3, min(FACE - 4, 3 + length)):
            px[x, yy] = MOSS[(yy + x) % 2]
        if rnd.random() < 0.5:
            px[(x + 1) % CLIFF_W, 4] = MOSS[1]
    # A few glowing fungus spots.
    for _ in range(3):
        x, yy = rnd.randrange(CLIFF_W), rnd.randint(8, FACE - 6)
        px[x, yy] = FUNGUS
        px[(x + 1) % CLIFF_W, yy] = FUNGUS
        px[x, yy + 1] = (200, 60, 170)
    # The foot: dark where the rock meets the ground.
    for x in range(CLIFF_W):
        px[x, FACE - 2] = ROCK_DARK
        px[x, FACE - 1] = FOOT
    return im


if __name__ == '__main__':
    tset = sys.argv[1] if len(sys.argv) > 1 else 'swamp'
    out = os.path.join(ROOT, 'tools', 'region-art', tset, 'cliff.png')
    draw().save(out)
    print(out, (CLIFF_W, FACE))
