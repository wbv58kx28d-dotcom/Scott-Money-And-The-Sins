"""Build a walker sprite sheet from a PixelLab character.

    python3 tools/region-art/walker.py <character id> <texture key>
    python3 tools/region-art/walker.py 8dced960-d408-466f-9ce3-0ff8a4674c48 field_derek

Downloads the character's zip (rotations plus an animation named "walk"), and
writes `assets/field/<texture key>.png` in the layout the Region scene expects
(CLAUDE.md §8.4): rows down, up, left; columns idle, then walk frames 1-4. Each
48×72 art frame is drawn at ART_PX into a 96×144 cell, and the whole sheet is
shifted by one amount so the lowest foot sits on y 141 (the template's feet
line). A character without a walk yet gets its idle in every column.
"""

import io
import json
import os
import sys
import urllib.request
import zipfile

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART_PX = 2
FRAME_W, FRAME_H = 96, 144
FEET_Y = 141
ROWS = [('down', 'south'), ('up', 'north'), ('left', 'west')]


def main(char_id, key):
    url = f'https://api.pixellab.ai/mcp/characters/{char_id}/download'
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url).read()))
    meta = json.loads(z.read('metadata.json'))
    frames = meta['states'][0]['frames']
    walk = frames.get('animations', {}).get('walk', {})
    load = lambda p: Image.open(io.BytesIO(z.read(p))).convert('RGBA')

    cells = []
    for _, d in ROWS:
        idle = load(frames['rotations'][d])
        steps = [load(p) for p in walk.get(d, [])][:4]
        cells.append([idle] + (steps if len(steps) == 4 else [idle] * 4))

    # Frames sit at the bottom of the cell (a 48×48 kitten as well as a 48×72 person), so measure from there.
    lowest = max(FRAME_H - im.height * ART_PX + im.getbbox()[3] * ART_PX for row in cells for im in row) - 1
    dy = FEET_Y - lowest
    sheet = Image.new('RGBA', (FRAME_W * 5, FRAME_H * len(ROWS)))
    for r, row in enumerate(cells):
        for c, im in enumerate(row):
            big = im.resize((im.width * ART_PX, im.height * ART_PX), Image.NEAREST)
            frame = Image.new('RGBA', (FRAME_W, FRAME_H))
            frame.alpha_composite(big, ((FRAME_W - big.width) // 2, FRAME_H - big.height))
            sheet.alpha_composite(frame.transform(frame.size, Image.AFFINE, (1, 0, 0, 0, 1, -dy)), (c * FRAME_W, r * FRAME_H))
    out = os.path.join(ROOT, 'assets', 'field', f'{key}.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out, optimize=True)
    print(out, sheet.size, 'walk' if walk else 'idle only', f'shifted {dy:+d}px')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
