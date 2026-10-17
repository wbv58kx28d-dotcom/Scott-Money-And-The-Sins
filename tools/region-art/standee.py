"""Build an idle-only walker sheet from one front-facing PixelLab image.

    python3 tools/region-art/standee.py <front image png> <texture key>
    python3 tools/region-art/standee.py tools/region-art/standees/field_floyd.png field_floyd

For NPCs who only stand around (the hot-tub regulars, the day traders): a
`create_image_pro` pick at 48×72 art px, facing the viewer. Writes
`assets/field/<texture key>.png` in the walker layout (CLAUDE.md §8.4: rows
down, up, left; columns idle, walk 1-4) with that one pose in every cell, drawn
at ART_PX with the lowest foot on y 141 like walker.py. Face them `down` in the
layout: they look the same whichever way they "turn". Sources live in
tools/region-art/standees/.
"""

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART_PX = 2
FRAME_W, FRAME_H = 96, 144
FEET_Y = 141
COLS, ROWS = 5, 3


def main(src, key):
    im = Image.open(src).convert('RGBA')
    im = im.resize((im.width * ART_PX, im.height * ART_PX), Image.NEAREST)
    box = im.getbbox()
    dx = (FRAME_W - im.width) // 2
    dy = FEET_Y - box[3]
    sheet = Image.new('RGBA', (FRAME_W * COLS, FRAME_H * ROWS))
    for r in range(ROWS):
        for c in range(COLS):
            cell = Image.new('RGBA', (FRAME_W, FRAME_H))
            cell.alpha_composite(im, (dx, dy)) if dy >= 0 else cell.paste(im.crop((0, -dy, im.width, im.height)), (dx, 0))
            sheet.alpha_composite(cell, (c * FRAME_W, r * FRAME_H))
    out = os.path.join(ROOT, 'assets', 'field', f'{key}.png')
    sheet.save(out, optimize=True)
    print(key, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
