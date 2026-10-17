"""Draw interior back-wall segments: the face of a wall seen from the front.

    python3 tools/region-art/wall.py && python3 tools/region-art/props.py

The basement's ground tiles only show the TOPS of walls (they're seen from
above), so the back wall's face, the part a 3/4 view shows, is a prop: a row
of these segments stands along the top of the room, feet on the floor's edge,
over two cells of wall-top terrain. Each segment is 64×64 art px with a
cinder-block bond that repeats every 64 px, so segments placed 128 screen px
apart join seamlessly; the `_pipe` one adds a pipe and cables to break the
repeat. Colors match the wall-top tiles (assets/regions/basement).

Drawn here rather than generated: a tiling wall needs exact edges. Output goes
to tools/region-art/props/prop_wall*.png, which props.py exports like any prop,
plus the basement tileset's floor grate (tools/region-art/basement/bridge.png).
"""

import os
import random

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
W, H = 64, 64
BLOCK_W, BLOCK_H = 16, 8

MORTAR = (22, 18, 31)
FACE = [(50, 42, 64), (54, 45, 69), (47, 40, 60)]
LIGHT = (72, 62, 90)  # top edge of each block (light from above)
DARK = (35, 29, 47)   # bottom edge
BASE = (14, 11, 20)   # contact shadow along the floor
PIPE = (88, 92, 104)
PIPE_LIGHT = (132, 136, 148)
PIPE_DARK = (52, 54, 64)
CABLE = (20, 18, 26)
CABLE_PINK = (214, 58, 178)


def wall(seed):
    rand = random.Random(seed)
    im = Image.new('RGBA', (W, H), MORTAR + (255,))
    px = im.load()
    for row in range(H // BLOCK_H):
        y0 = row * BLOCK_H
        offset = (BLOCK_W // 2) * (row % 2)
        for col in range(-1, W // BLOCK_W + 1):
            x0 = col * BLOCK_W + offset
            face = FACE[(row * 7 + col * 3) % len(FACE)]
            for y in range(y0 + 1, y0 + BLOCK_H):
                for x in range(x0 + 1, x0 + BLOCK_W):
                    if not 0 <= x < W:
                        continue
                    c = LIGHT if y == y0 + 1 else DARK if y == y0 + BLOCK_H - 1 else face
                    # A little grit, kept sparse so the pattern stays calm behind characters.
                    if c is face and rand.random() < 0.06:
                        c = DARK
                    px[x, y] = c + (255,)
    for y in range(H - 3, H):
        for x in range(W):
            px[x, y] = BASE + (255,)
    return im


def with_pipe(im):
    """A pipe along the top (rising into the ceiling at both ends) with brackets, and two cables (one pink) hanging down the wall."""
    px = im.load()
    for x in range(6, W - 6):
        px[x, 6] = PIPE_LIGHT + (255,)
        px[x, 7] = PIPE + (255,)
        px[x, 8] = PIPE + (255,)
        px[x, 9] = PIPE_DARK + (255,)
    for x0 in (4, W - 8):
        for y in range(0, 10):
            px[x0, y] = PIPE_LIGHT + (255,)
            px[x0 + 1, y] = PIPE + (255,)
            px[x0 + 2, y] = PIPE + (255,)
            px[x0 + 3, y] = PIPE_DARK + (255,)
    for bx in (12, 44):
        for y in range(5, 11):
            px[bx, y] = PIPE_DARK + (255,)
            px[bx + 1, y] = PIPE_DARK + (255,)
    for x0, color in ((24, CABLE), (27, CABLE_PINK)):
        for y in range(10, H - 3):
            sway = (y // 9) % 2
            px[x0 + sway, y] = color + (255,)
    return im


def grate():
    """A steel floor grate: the basement tileset's "bridge" (tileset.py needs one; it stretches over any span)."""
    im = Image.new('RGBA', (24, 24), PIPE_DARK + (255,))
    px = im.load()
    for y in range(24):
        for x in range(24):
            if x in (0, 23) or y in (0, 23):
                px[x, y] = MORTAR + (255,)
            elif x % 4 == 2 or y % 4 == 2:
                px[x, y] = PIPE + (255,)
            elif x % 4 == 1 and y % 4 == 1:
                px[x, y] = PIPE_LIGHT + (255,)
    return im


def main():
    out = os.path.join(ROOT, 'tools', 'region-art', 'props')
    wall(1).save(os.path.join(out, 'prop_wall.png'))
    with_pipe(wall(1)).save(os.path.join(out, 'prop_wall_pipe.png'))
    grate().save(os.path.join(ROOT, 'tools', 'region-art', 'basement', 'bridge.png'))
    print('prop_wall, prop_wall_pipe', (W, H), 'and the basement grate')


if __name__ == '__main__':
    main()
