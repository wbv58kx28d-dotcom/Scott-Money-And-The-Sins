"""Bake $cott's jet ski into a ride sheet of 16 headings.

    python3 tools/region-art/jetski.py

Reads the views in tools/region-art/jetski/views/, one per heading on the west half of the
compass, south round through west to north (PixelLab, tools/region-art/isles/README.md):

    s ssw sw wsw w wnw nw nnw n

and writes assets/field/field_scott_ski.png: one CELL (84×78 art px, 168×156 on screen at
2 screen px per art px) per view, a row each in that order. The east half is the same rows
mirrored in-engine (systems/ride.js headingRow), so the sheet covers 16 headings, 22.5° apart.
Each view's hull bottom sits on one waterline (WATERLINE) and keeps its place across PixelLab's
canvas, so turning from one view to the next doesn't jump. Any baked-in spray is cut away: the game draws its own
wake and splash (ui/wake.js, ui/splash.js).
"""

import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'region-art', 'jetski', 'views')
OUT = os.path.join(ROOT, 'assets', 'field', 'field_scott_ski.png')
VIEWS = ['s', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw', 'n']
CELL = (84, 78)
WATERLINE = 76  # art row the hull's bottom sits on
ART_PX = 2


def spray(px, x, y):
    """A light, bluish pixel: foam and splash, not the pink and gold hull or its dark outline."""
    r, g, b, a = px[x, y]
    return a > 0 and min(r, g, b) > 140 and b >= r - 10


def strip_spray(im):
    """Cut the foam from the bottom third, then any bits left floating apart from the body."""
    im = im.copy()
    px = im.load()
    w, h = im.size
    for y in range(h * 2 // 3, h):
        for x in range(w):
            if spray(px, x, y):
                px[x, y] = (0, 0, 0, 0)
    # Keep only the biggest connected blob (the rider on the ski).
    seen, blobs = set(), []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0 or (x, y) in seen:
                continue
            stack, blob = [(x, y)], []
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                blob.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny][3] > 0:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            blobs.append(blob)
    blobs.sort(key=len, reverse=True)
    for blob in blobs[1:]:
        for x, y in blob:
            px[x, y] = (0, 0, 0, 0)
    return im


def seat(im):
    """
    Into a cell, hull bottom on the waterline. Across, it keeps its place on PixelLab's canvas, which
    holds the ski's pivot steady from view to view, so turning doesn't shuffle it sideways.
    """
    x0, y0, x1, y1 = im.getbbox()
    left = (im.width - CELL[0]) // 2
    assert x0 >= left and x1 <= left + CELL[0] and y1 - y0 <= WATERLINE, f"a view at {im.getbbox()} won't fit the {CELL} cell"
    cell = Image.new('RGBA', CELL)
    cell.alpha_composite(im.crop((left, y0, left + CELL[0], y1)), (0, WATERLINE - (y1 - y0)))
    return cell


def main():
    sheet = Image.new('RGBA', (CELL[0], CELL[1] * len(VIEWS)))
    for row, name in enumerate(VIEWS):
        view = strip_spray(Image.open(os.path.join(SRC, f'{name}.png')).convert('RGBA'))
        sheet.alpha_composite(seat(view), (0, row * CELL[1]))
    sheet.resize((sheet.width * ART_PX, sheet.height * ART_PX), Image.NEAREST).save(OUT, optimize=True)
    print(f'jetski: {OUT} ({CELL[0] * ART_PX}×{CELL[1] * ART_PX} frames, rows {" ".join(VIEWS)}; east mirrored)')


if __name__ == '__main__':
    main()
