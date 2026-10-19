"""Put every frame of a walker sheet's feet on one line.

    python3 tools/region-art/feet.py field_scott [field_derek ...]

PixelLab's walk frames aren't anchored: from frame to frame the lowest foot
drifts up and down by several pixels, so in the game the character bobs up
off the ground (and off its shadow) as it walks, worst walking north. This
moves each 96×144 frame of `assets/field/<key>.png` up or down, by whole art
pixels, so its lowest opaque pixel sits on the feet line, y 141 (the same for
every character, so shadows sit alike under all of them). walker.py does the
same for new sheets built from a drifting cycle like that.
"""

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FRAME_W, FRAME_H = 96, 144
ART_PX = 2
FEET_Y = 141


def seat(sheet):
    """Each frame re-seated on the feet line; returns (sheet, how many frames moved)."""
    cols, rows = sheet.width // FRAME_W, sheet.height // FRAME_H
    frame = lambda c, r: sheet.crop((c * FRAME_W, r * FRAME_H, (c + 1) * FRAME_W, (r + 1) * FRAME_H))
    feet = FEET_Y + 1
    out = Image.new('RGBA', sheet.size)
    moved = 0
    for r in range(rows):
        for c in range(cols):
            f = frame(c, r)
            box = f.getbbox()
            dy = 0
            if box:
                dy = (feet - box[3]) // ART_PX * ART_PX
                moved += dy != 0
            out.alpha_composite(f.transform(f.size, Image.AFFINE, (1, 0, 0, 0, 1, -dy)), (c * FRAME_W, r * FRAME_H))
    return out, moved


if __name__ == '__main__':
    for key in sys.argv[1:]:
        path = os.path.join(ROOT, 'assets', 'field', f'{key}.png')
        sheet, moved = seat(Image.open(path).convert('RGBA'))
        sheet.save(path, optimize=True)
        print(path, f'{moved} frames moved')
