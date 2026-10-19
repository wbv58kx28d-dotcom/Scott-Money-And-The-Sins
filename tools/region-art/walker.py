"""Build a walker sprite sheet from a PixelLab character.

    python3 tools/region-art/walker.py <character id> <texture key> [<animation>]
    python3 tools/region-art/walker.py 9a98e7a2-fda8-4b7b-a119-66ec4547c71a field_scott walk8_template

Downloads the character's zip (rotations plus a walk animation, named "walk"
unless given), and writes `assets/field/<texture key>.png` in the layout the
Region scene expects (CLAUDE.md §8.4): rows down, up, left; columns idle, then
the walk cycle (4 frames, or 8 for PixelLab's walking-8-frames: the game reads
the count off the image). Each 48×72 art frame is drawn at ART_PX into a
96×144 cell, feet on y 141 (the template's feet line):

- A cycle that's registered (every frame's lowest foot within an art pixel of
  the others, like walking-8-frames) moves as a whole, so the art's own
  weight shift survives. One that isn't (PixelLab's older walking-4-frames
  drifts several pixels from frame to frame) has each frame seated on the
  line, or the character bobs up off its shadow.
- The upper body dips one art pixel on the frames where a foot lands and
  takes the weight (the "down" of a contact-down-passing-up cycle), the
  classic pixel-art walk bob; on the others the head stands at the cycle's
  usual height, evening out the pixel or two a generator's frames wander. Contacts are found in the side view, where the
  legs spread widest; the template keeps every view in step. Only cycles of 6
  or more frames: in 4 a dip lands on every other frame and reads as a march.
- A view whose rotation stands taller or shorter than its walk (more than an
  art pixel) stands on the walk's feet-together frame instead, so starting
  and stopping don't pop.

A character without a walk yet gets its idle in every column.
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
WAIST = 0.55  # the dip moves everything above this share of the body's height, like ui/motion.js breathing


def lowest(im):
    """The art row of the lowest opaque pixel."""
    return im.getbbox()[3] - 1


def legs_width(im):
    """How wide the legs spread: the opaque span of the bottom quarter of the body."""
    top, bottom = im.getbbox()[1], im.getbbox()[3]
    box = im.crop((0, bottom - (bottom - top) // 4, im.width, bottom)).getbbox()
    return box[2] - box[0] if box else 0


def contacts(side):
    """The two frames a foot lands on (legs widest), half a cycle apart."""
    n = len(side)
    half = n // 2
    widths = [legs_width(f) for f in side]
    c = max(range(half), key=lambda i: widths[i] + widths[i + half])
    return {c, c + half}


def shift_upper(im, k):
    """The frame with its upper body k art pixels lower (higher if k < 0); the legs stay put."""
    if not k:
        return im
    top, bottom = im.getbbox()[1], im.getbbox()[3]
    waist = round(top + (bottom - top) * WAIST)
    out = im.copy()
    out.paste(Image.new('RGBA', (im.width, waist + max(k, 0))), (0, 0))
    out.alpha_composite(im.crop((0, 0, im.width, waist - min(k, 0))), (0, min(k, 0)) if k < 0 else (0, k))
    return out


def main(char_id, key, anim='walk'):
    url = f'https://api.pixellab.ai/mcp/characters/{char_id}/download'
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url).read()))
    meta = json.loads(z.read('metadata.json'))
    frames = meta['states'][0]['frames']
    walk = frames.get('animations', {}).get(anim, {})
    load = lambda p: Image.open(io.BytesIO(z.read(p))).convert('RGBA')

    idles = [load(frames['rotations'][d]) for _, d in ROWS]
    cycles = [[load(p) for p in walk.get(d, [])] for _, d in ROWS]
    n = min(len(c) for c in cycles)
    if n < 4:
        cycles, n = [[idle] * 4 for idle in idles], 4
    cycles = [c[:n] for c in cycles]
    down = contacts(cycles[2]) if n >= 6 and walk else set()
    if down:
        down |= {(c + 1) % n for c in down}

    sheet = Image.new('RGBA', (FRAME_W * (n + 1), FRAME_H * len(ROWS)))
    # Frames sit at the bottom of the cell (a 48×48 kitten as well as a 48×72 person), so measure from there.
    feet = lambda im, low: FRAME_H - im.height * ART_PX + low * ART_PX + ART_PX - 1
    for r, (idle, cycle) in enumerate(zip(idles, cycles)):
        # A rotation drawn taller than its walk (PixelLab's side view can stand 3 art px taller than
        # it walks) would pop up and down at every start and stop: stand on the cycle's own feet-together frame.
        tall = lambda im: lowest(im) - im.getbbox()[1]
        if walk and abs(tall(idle) - sorted(map(tall, cycle))[n // 2]) > 1:
            idle = min(cycle, key=legs_width)
            print(f'  {ROWS[r][0]}: idle from the walk (the rotation stands {tall(idles[r]) - tall(idle):+d} art px taller)')
        lows = [lowest(f) for f in cycle]
        registered = max(lows) - min(lows) <= 1
        row_low = max(set(lows), key=lows.count)
        heads = [row_low - f.getbbox()[1] for f in cycle]
        row_head = max(set(heads), key=heads.count)  # how far the head stands above the feet, most frames
        for c, im in enumerate([idle] + cycle):
            low = lowest(im) if c == 0 or not registered else row_low
            if c > 0 and down:
                # Every frame's head at the cycle's usual height, one art pixel lower on the dips:
                # a clean bob, whatever pixel or two the generator's frames wander.
                want = row_head - ((c - 1) in down)
                im = shift_upper(im, max(-2, min(2, (low - im.getbbox()[1]) - want)))
            big = im.resize((im.width * ART_PX, im.height * ART_PX), Image.NEAREST)
            frame = Image.new('RGBA', (FRAME_W, FRAME_H))
            frame.alpha_composite(big, ((FRAME_W - big.width) // 2, FRAME_H - big.height))
            dy = FEET_Y - feet(im, low)
            sheet.alpha_composite(frame.transform(frame.size, Image.AFFINE, (1, 0, 0, 0, 1, -dy)), (c * FRAME_W, r * FRAME_H))
    out = os.path.join(ROOT, 'assets', 'field', f'{key}.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out, optimize=True)
    print(out, sheet.size, f'{anim}: {n} frames, dip on {sorted(down)}' if walk else 'idle only')


if __name__ == '__main__':
    main(*sys.argv[1:4])
