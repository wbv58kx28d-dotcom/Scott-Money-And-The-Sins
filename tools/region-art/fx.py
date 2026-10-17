"""Draw the regions' little looping effects as sprite sheets.

    python3 tools/region-art/fx.py

fx_bubble: a toxic bubble rising out of the swamp water and popping, in the
neon pink and violet of the bog's banks (5 frames of 16×16 art px, drawn at
2 screen px per art pixel, so 32×32 frames; feet at the bottom center). The
Region scene plays it on random solid water cells (the tileset's `bubbles`).
Drawn by hand here rather than generated: it's tiny, and the frames have to
line up exactly. Output: assets/fx/fx_bubble.png (src/data/assets.js FX_SHEETS).
"""

import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART_PX = 2
SIZE = 16

OUTLINE = (42, 10, 51, 255)
RIM = (255, 63, 210, 255)
FILL = (178, 58, 214, 200)
SHINE = (255, 214, 246, 255)


def disc(im, cx, cy, r, color, ring=False):
    """A pixel disc (or ring) centered on (cx, cy)."""
    px = im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if (r - 1 < d <= r + 0.2) if ring else d <= r + 0.2:
                px[x, y] = color


def bubble(r, rise):
    """A bubble of radius r, its bottom `rise` px above the frame's bottom."""
    im = Image.new('RGBA', (SIZE, SIZE))
    cx, cy = 7.5, SIZE - 1 - rise - r
    disc(im, cx, cy, r + 1, OUTLINE)
    disc(im, cx, cy, r, FILL)
    disc(im, cx, cy, r, RIM, ring=True)
    if r >= 2:
        im.putpixel((round(cx - r / 2), round(cy - r / 2)), SHINE)
    return im


def pop(spread):
    """The burst: rim pixels flung out on a broken ring, then a fading splash ring on the water."""
    im = Image.new('RGBA', (SIZE, SIZE))
    px = im.load()
    cx, cy = 7.5, SIZE - 6
    for k, (dx, dy) in enumerate([(-1, 0), (1, 0), (0, -1), (-0.7, -0.7), (0.7, -0.7), (-0.7, 0.7), (0.7, 0.7)]):
        x, y = round(cx + dx * spread), round(cy + dy * spread)
        if 0 <= x < SIZE and 0 <= y < SIZE:
            px[x, y] = SHINE if k % 3 == 0 else RIM
    return im


def splash():
    im = Image.new('RGBA', (SIZE, SIZE))
    px = im.load()
    for x in range(3, 13):
        if x in (3, 12) or x % 3 == 0:
            px[x, SIZE - 2] = (255, 63, 210, 150)
    for x in (5, 10):
        px[x, SIZE - 3] = (255, 63, 210, 110)
    return im


def main():
    frames = [bubble(1, 1), bubble(2, 2), bubble(3, 3), pop(5), splash()]
    sheet = Image.new('RGBA', (SIZE * len(frames), SIZE))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * SIZE, 0))
    out = os.path.join(ROOT, 'assets', 'fx')
    os.makedirs(out, exist_ok=True)
    sheet.resize((sheet.width * ART_PX, sheet.height * ART_PX), Image.NEAREST).save(os.path.join(out, 'fx_bubble.png'), optimize=True)
    print('fx_bubble', len(frames), 'frames')


if __name__ == '__main__':
    main()
