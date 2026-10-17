"""Export scenery props: trim each source PNG and scale it to ART_PX.

    python3 tools/region-art/props.py

Sources are PixelLab images in `tools/region-art/props/<texture key>.png`, drawn
with their base at the bottom. Output goes to `assets/props/<texture key>.png`,
which `src/data/assets.js` lists; the game places each by its bottom center.
"""

import glob
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART_PX = 2  # screen px per art pixel, like the walkers and the ground

# Wall decor (posters, signs) hangs on an interior's back wall: its feet stay on
# the floor at the wall's foot, so it sorts in front of the wall, and this many
# art px of empty space under the art lift it up onto the wall face.
HANG = {'prop_poster': 26, 'prop_apesign': 24}

# Props generated standing on a ground plate that the canvas cut off flat (the
# house): the bottom this many art px get rounded into an outlined mound.
ROUND_BASE = {'prop_house': 30}
OUTLINE = (18, 13, 28, 255)


def round_base(im, depth):
    """Clear the plate outside a half-ellipse along the bottom, and outline the new edge."""
    px = im.load()
    w, h = im.size
    top = h - depth
    cx, rx = (w - 1) / 2, w / 2 - 1
    keep = lambda x, y: y < top or ((x - cx) / rx) ** 2 + ((y - top) / depth) ** 2 <= 1
    for y in range(top, h):
        for x in range(w):
            if not keep(x, y):
                px[x, y] = (0, 0, 0, 0)
    edge = [(x, y) for y in range(top, h) for x in range(w)
            if px[x, y][3] and any(not (0 <= x + dx < w and 0 <= y + dy < h) or not px[x + dx, y + dy][3]
                                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        px[x, y] = OUTLINE
    return im

out_dir = os.path.join(ROOT, 'assets', 'props')
os.makedirs(out_dir, exist_ok=True)
for src in sorted(glob.glob(os.path.join(ROOT, 'tools', 'region-art', 'props', '*.png'))):
    im = Image.open(src).convert('RGBA')
    im = im.crop(im.getbbox())
    key = os.path.splitext(os.path.basename(src))[0]
    if key in ROUND_BASE:
        im = round_base(im, ROUND_BASE[key])
        im = im.crop(im.getbbox())
    if key in HANG:
        hung = Image.new('RGBA', (im.width, im.height + HANG[key]))
        hung.alpha_composite(im, (0, 0))
        im = hung
    im = im.resize((im.width * ART_PX, im.height * ART_PX), Image.NEAREST)
    im.save(os.path.join(out_dir, os.path.basename(src)), optimize=True)
    print(os.path.basename(src), im.size)
