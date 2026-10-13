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

out_dir = os.path.join(ROOT, 'assets', 'props')
os.makedirs(out_dir, exist_ok=True)
for src in sorted(glob.glob(os.path.join(ROOT, 'tools', 'region-art', 'props', '*.png'))):
    im = Image.open(src).convert('RGBA')
    im = im.crop(im.getbbox())
    im = im.resize((im.width * ART_PX, im.height * ART_PX), Image.NEAREST)
    im.save(os.path.join(out_dir, os.path.basename(src)), optimize=True)
    print(os.path.basename(src), im.size)
