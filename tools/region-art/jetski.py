"""Bake $cott's jet ski into a ride sheet.

    python3 tools/region-art/jetski.py

Reads the picked views in tools/region-art/jetski/ (PixelLab create_image_pro, straight-on, CLAUDE.md §8.4):

    front.png  coming toward the camera (72×72 art px)
    back.png   driving away (72×72)
    side.png   in profile, nose to the right as generated (84×72); mirrored here to face left

and writes assets/field/field_scott_ski.png: one 84×72 art-px cell per view (168×144 on screen,
2 screen px per art px), rows down, up, left like a walker sheet (right is the left row mirrored
in-engine). Each view's hull bottom sits on one waterline (WATERLINE), centered across the cell, so
switching views doesn't jump. Baked-in spray is cut away: the game draws its own wake (RegionScene).
"""

import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'region-art', 'jetski')
OUT = os.path.join(ROOT, 'assets', 'field', 'field_scott_ski.png')
CELL = (84, 72)
WATERLINE = 70  # art row the hull's bottom sits on
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
    """Into a cell, centered across, hull bottom on the waterline."""
    im = im.crop(im.getbbox())
    cell = Image.new('RGBA', CELL)
    cell.alpha_composite(im, ((CELL[0] - im.width) // 2, WATERLINE - im.height))
    return cell


def main():
    views = {
        'down': strip_spray(Image.open(os.path.join(SRC, 'front.png')).convert('RGBA')),
        'up': strip_spray(Image.open(os.path.join(SRC, 'back.png')).convert('RGBA')),
        'left': strip_spray(Image.open(os.path.join(SRC, 'side.png')).convert('RGBA')).transpose(Image.FLIP_LEFT_RIGHT),
    }
    sheet = Image.new('RGBA', (CELL[0], CELL[1] * 3))
    for row, key in enumerate(('down', 'up', 'left')):
        sheet.alpha_composite(seat(views[key]), (0, row * CELL[1]))
    sheet.resize((sheet.width * ART_PX, sheet.height * ART_PX), Image.NEAREST).save(OUT, optimize=True)
    print(f'jetski: {OUT} ({CELL[0] * ART_PX}×{CELL[1] * ART_PX} frames, rows down, up, left)')


if __name__ == '__main__':
    main()
