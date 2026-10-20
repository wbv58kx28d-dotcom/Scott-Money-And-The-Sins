"""Bake the Sky Deck's tower bodies for the game.

    python3 tools/region-art/skytowers.py

The towers under the Sky Deck's rooftops (CLAUDE.md §6.6) are PixelLab art,
one tall image each (tools/region-art/skytowers/<name>.png, art px; prompts and
job ids in tools/region-art/isles/README.md): the tower's own rooftop floor at
the top, its body plunging down to the bottom of the image. For each it writes:

  assets/skydeck/sky_<name>.png       the body, at 2 screen px per art px
  assets/skydeck/sky_<name>_band.png  a floor from near its foot that repeats
                                      seamlessly, which the game tiles below
                                      the body so the tower runs on past the
                                      bottom of the screen (the body ends where
                                      that floor does)

and prints each one's anchor (the middle of its rooftop floor, where the
layout puts the prop) and floor radii, for its PROP_IMAGES entry.
"""

import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'region-art', 'skytowers')
OUT = os.path.join(ROOT, 'assets', 'skydeck')
ART_PX = 2

# The rooftop floor in each picture (art px): its middle, and its half-width and half-height.
FLOORS = {
    'keep': {'x': 128, 'y': 62, 'rx': 83, 'ry': 42},
    'turret': {'x': 80, 'y': 42, 'rx': 70, 'ry': 30},
    'rose': {'x': 80, 'y': 61, 'rx': 75, 'ry': 38},
    'twin': {'x': 78, 'y': 43, 'rx': 44, 'ry': 19},
}


def up(im):
    return im.resize((im.width * ART_PX, im.height * ART_PX), Image.NEAREST)


def open_foot(im):
    """How many rows to keep: the art closes its foot with a few rows of dark outline, which would
    seam every repeat of the band, so they go."""
    a = np.asarray(im).astype(int)
    h = a.shape[0]
    while h > 1:
        row = a[h - 1]
        solid = row[:, 3] > 0
        if solid.any() and row[solid, :3].mean() > 90:
            break
        h -= 1
    return h


def extent(row):
    xs = np.where(row[:, 3] > 0)[0]
    return (xs.min(), xs.max()) if len(xs) else (0, -1)


def repeat_band(im, lo=40, hi=128, search=320):
    """
    A whole floor near the tower's foot that repeats cleanly: the rows (e - k, e] for the e and k
    whose seam (row e against row e - k) matches best, compared across row e's width, giving up a
    little match for every row of drawn body it would cut off. The body ends
    at row e, and the band is trimmed to row e's width with its edge outlined again, since floors
    higher up a tapering tower are a little wider. Returns (body, band, k, seam difference).
    """
    a = np.asarray(im).astype(int)
    h = a.shape[0]
    best = None
    for e in range(h - 1, max(lo, h - search), -1):
        x0, x1 = extent(a[e])
        if x1 < x0:
            continue
        for k in range(lo, min(hi, e)):
            up_row = a[e - k]
            u0, u1 = extent(up_row)
            if u0 > x0 or u1 < x1:  # the band must be at least as wide as the foot
                continue
            d = np.abs(up_row[x0:x1 + 1] - a[e][x0:x1 + 1]).mean()
            score = d + 0.08 * (h - 1 - e)  # and keep as much of the drawn body as it can
            if best is None or score < best[0]:
                best = (score, e, k, d)
    _, e, k, d = best
    x0, x1 = extent(a[e])
    band = a[e - k + 1:e + 1].copy()
    band[:, :x0] = 0
    band[:, x1 + 1:] = 0
    ink = a[e][x0, :3]
    for row in band:  # the edge outline, where the trim cut through the stone
        row[x0, :3], row[x0, 3] = ink, 255
        row[x1, :3], row[x1, 3] = ink, 255
    body = im.crop((0, 0, im.width, e + 1))
    return body, Image.fromarray(band.astype(np.uint8), 'RGBA'), k, d


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, f in FLOORS.items():
        im = Image.open(os.path.join(SRC, f'{name}.png')).convert('RGBA')
        im = im.crop((0, 0, im.width, im.getbbox()[3]))  # no empty rows under its foot
        im = im.crop((0, 0, im.width, open_foot(im)))
        im, band, k, d = repeat_band(im)
        up(im).save(os.path.join(OUT, f'sky_{name}.png'), optimize=True)
        up(band).save(os.path.join(OUT, f'sky_{name}_band.png'), optimize=True)
        print(f"sky_{name}: {im.width * ART_PX}x{im.height * ART_PX}, anchor ({f['x'] * ART_PX}, {f['y'] * ART_PX}), "
              f"floor {f['rx'] * ART_PX}x{f['ry'] * ART_PX}, band {k * ART_PX} px (seam diff {d:.1f})")


if __name__ == '__main__':
    main()
