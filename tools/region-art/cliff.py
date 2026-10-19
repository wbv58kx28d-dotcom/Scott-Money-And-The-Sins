"""Draw the faces a 3/4 view shows below raised ground and along water.

    python3 tools/region-art/cliff.py swamp

Two strips, each CLIFF_W art px wide, tiling seamlessly sideways (the game
picks columns by world x):

cliff.png (FACE art px tall): the rock below every south-facing edge of high
ground (a terrain with a `level` in art.json; ui/terrainView.js hangs it).
Like the cliffs in 16-bit RPGs it's built from vertical ridges of rock, each
lit on its left and shaded on its right, under an overhanging grass lip with
tufts drooping off it, and it darkens toward a foot of rubble where it meets
the ground.

bank.png (BANK art px tall): the low earth bank hung where ground meets water
on the water's far (north) side, so the water reads as sitting below the
ground: an ink edge, wet mud with roots, and a dark waterline.

Drawn here rather than generated: they have to tile exactly. Colors match the
toxic bog (grey-violet rock, the plateau's olive moss, black mud, a few glowing
pink fungus spots). Output: tools/region-art/<set>/cliff.png and bank.png (art
px), which tileset.py scales into assets/regions/<set>/.
"""

import math
import os
import random
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CLIFF_W, FACE, BANK = 64, 36, 8

INK = (18, 13, 28)
LIP = [(124, 133, 70), (111, 120, 60), (95, 104, 52)]  # the plateau's mossy top, curling over the edge
LIP_SHADOW = (40, 32, 52)
# Rock, lightest to darkest: a ridge's lit edge, its face (top, middle, bottom of the cliff), its shaded edge.
HI = (126, 112, 140)
FACE_TONES = [(98, 84, 114), (80, 67, 96), (62, 51, 78)]
SHADE = [(66, 54, 82), (54, 44, 70), (42, 33, 56)]
CREVICE = (26, 20, 38)
MOSS = [(104, 116, 64), (86, 98, 52)]
FUNGUS = [(255, 79, 216), (200, 60, 170)]
FOOT = [(34, 27, 46), (24, 18, 32)]

MUD = [(62, 50, 46), (52, 42, 40), (44, 36, 36)]
ROOTS = (92, 74, 58)
WATERLINE = (30, 14, 40)


def tone(y, height):
    """Which of the three face tones row y falls in: lit top, middle, dark bottom (dithered where they meet)."""
    t = y / (height - 1)
    return 0 if t < 0.32 else 1 if t < 0.68 else 2


def wave(x, k, phase):
    """A smooth wave across the strip that wraps exactly (k whole periods in CLIFF_W)."""
    return math.sin(phase + x * 2 * math.pi * k / CLIFF_W)


def draw_cliff(seed=11):
    rnd = random.Random(seed)
    im = Image.new('RGBA', (CLIFF_W, FACE))
    px = im.load()
    # Ridges: runs of columns 3-8 wide across the strip, the last one closing the wrap.
    ridges, x = [], 0
    while x < CLIFF_W:
        w = rnd.randint(5, 10)
        if CLIFF_W - (x + w) < 5:
            w = CLIFF_W - x
        ridges.append((x, w))
        x += w
    phases = [rnd.random() * 6.28 for _ in range(3)]
    lips = [2 + rnd.choice([0, 0, 1, 1, 2]) for _ in range(CLIFF_W)]
    for x0, w in ridges:
        # The crevice before this ridge: about half the ridges have one, running part way down from below the lip.
        c0 = rnd.randint(7, 12)
        c1 = c0 + rnd.randint(4, FACE - c0 - 2) if rnd.random() < 0.55 else c0
        for dx in range(w):
            x = x0 + dx
            # A ridge bulges: lighter toward its lit left side, darker toward its right, with soft waves along the strip.
            lean = 1 - dx / max(1, w - 1)
            for y in range(FACE):
                t = tone(y, FACE)
                if 0 < y < FACE - 1 and tone(y - 1, FACE) != t and (x + y) % 2:
                    t -= 1
                bump = lean * 1.2 + 0.35 * wave(x, 3, phases[0]) + 0.25 * wave(x + y, 5, phases[1])
                if dx == 0 and c0 <= y < c1:
                    c = CREVICE
                elif bump > 1.15 and t < 2:
                    c = HI if t == 0 else FACE_TONES[0]
                elif bump < 0.15:
                    c = SHADE[t]
                else:
                    c = FACE_TONES[t]
                px[x, y] = c
            # Next to the crevice, the right edge of the ridge before is in shade.
            for y in range(c0, c1):
                if px[(x0 - 1) % CLIFF_W, y] != CREVICE:
                    px[(x0 - 1) % CLIFF_W, y] = SHADE[tone(y, FACE)]
    # A few boulders set in the face: a lit top-left, a shaded bottom-right, an ink rim underneath.
    for _ in range(4):
        bx, by, bw, bh = rnd.randrange(CLIFF_W), rnd.randint(8, FACE - 7), rnd.randint(4, 6), rnd.randint(3, 4)
        for dy in range(bh):
            for dx in range(bw):
                if (dx in (0, bw - 1)) and (dy in (0, bh - 1)):
                    continue
                c = HI if dy == 0 or (dx == 0 and dy < bh - 1) else SHADE[1] if dy == bh - 1 or dx == bw - 1 else FACE_TONES[0]
                px[(bx + dx) % CLIFF_W, by + dy] = c
        for dx in range(1, bw - 1):
            px[(bx + dx) % CLIFF_W, by + bh] = CREVICE
    # Moss streaks running down from the lip, and a few glowing fungus spots.
    for _ in range(7):
        x = rnd.randrange(CLIFF_W)
        for y in range(3, 3 + rnd.randint(2, 7)):
            px[x, y] = MOSS[(x + y) % 2]
    for _ in range(3):
        x, y = rnd.randrange(CLIFF_W), rnd.randint(9, FACE - 6)
        px[x, y] = FUNGUS[0]
        px[(x + 1) % CLIFF_W, y] = FUNGUS[0]
        px[x, y + 1] = FUNGUS[1]
    # The lip: the plateau's moss curling over the edge, ragged underneath, with tufts hanging off it.
    for x in range(CLIFF_W):
        lip = lips[x]
        for y in range(lip):
            px[x, y] = LIP[min(2, y)] if (x + y) % 3 else LIP[0]
        px[x, lip] = INK
        if lip + 1 < FACE:
            px[x, lip + 1] = LIP_SHADOW
    for _ in range(10):
        x = rnd.randrange(CLIFF_W)
        length = rnd.randint(2, 5)
        for y in range(lips[x], lips[x] + length):
            px[x, y] = LIP[1 if y < lips[x] + length - 1 else 2]
        px[x, lips[x] + length] = INK
    # The foot: rubble and the darkest rock where the face meets the ground.
    for x in range(CLIFF_W):
        px[x, FACE - 2] = FOOT[0] if (x * 3) % 7 else SHADE[2]
        px[x, FACE - 1] = FOOT[1]
    for _ in range(8):
        x = rnd.randrange(CLIFF_W - 1)
        px[x, FACE - 3] = FACE_TONES[1]
        px[x + 1, FACE - 3] = SHADE[2]
    return im


def draw_bank(seed=5):
    rnd = random.Random(seed)
    im = Image.new('RGBA', (CLIFF_W, BANK))
    px = im.load()
    for x in range(CLIFF_W):
        # A ragged top: the ground's edge crumbles a pixel lower here and there.
        top = 1 if (x * 7) % 9 == 0 else 0
        px[x, top] = INK
        for y in range(top + 1, BANK - 1):
            t = (y - 1) / (BANK - 3)
            c = MUD[0] if t < 0.3 else MUD[1] if t < 0.7 else MUD[2]
            px[x, y] = MUD[min(2, MUD.index(c) + 1)] if (x * 5 + y * 3) % 11 == 0 else c
        px[x, BANK - 1] = WATERLINE
    # Roots poking out of the mud, and lit crumbs of earth along the top.
    for _ in range(10):
        x = rnd.randrange(CLIFF_W)
        for y in range(2, rnd.randint(4, BANK - 1)):
            px[(x + y // 3) % CLIFF_W, y] = ROOTS
    for _ in range(14):
        x = rnd.randrange(CLIFF_W)
        if px[x, 1] != INK:
            px[x, 1] = ROOTS if rnd.random() < 0.5 else (88, 72, 64)
    return im


if __name__ == '__main__':
    tset = sys.argv[1] if len(sys.argv) > 1 else 'swamp'
    out = os.path.join(ROOT, 'tools', 'region-art', tset)
    draw_cliff().save(os.path.join(out, 'cliff.png'))
    draw_bank().save(os.path.join(out, 'bank.png'))
    print(out, 'cliff', (CLIFF_W, FACE), 'bank', (CLIFF_W, BANK))
