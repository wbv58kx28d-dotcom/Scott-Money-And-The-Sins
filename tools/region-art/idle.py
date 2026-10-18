"""Build a character's idle-action sheet from PixelLab animate_image strips.

    python3 tools/region-art/idle.py <name> [<name> ...]
    python3 tools/region-art/idle.py quentin chad

An idle action is a short clip a character plays now and then while standing
around, about what they're holding: Quentin sips his coffee, the doorman
writes on his clipboard (CLAUDE.md §6.6). Each clip is an `animate_image` call
on the character's idle frame at 48×72 art px, with the same frame as its last
frame so it ends back on the idle pose. Sources live in
tools/region-art/idles/<name>_<view>.png: one row of 48×72 frames, the first
being the idle frame the clip starts from (PixelLab's frame 0), then the clip.

Writes assets/field/field_<name>_idle.png in the walker layout (rows down, up,
left), FRAMES columns, each frame drawn at ART_PX and lined up on the
character's own idle cell in assets/field/field_<name>.png, so the clip starts
and ends on exactly the pixels the sheet stands on. A standee (one pose in
every row, tools/region-art/standee.py) has only a `down` strip, copied to
every row (a standee's sheet has the same idle frame in every row); a walker
leaves rows without a strip empty.
"""

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(os.path.dirname(__file__), 'idles')
ART_PX = 2
ART_W, ART_H = 48, 72
FRAME_W, FRAME_H = 96, 144
VIEWS = ['down', 'up', 'left']
SHEET_COLS = 5


def strip_frames(path):
    im = Image.open(path).convert('RGBA')
    return [im.crop((i * ART_W, 0, (i + 1) * ART_W, ART_H)) for i in range(im.width // ART_W)]


def upscaled(frame):
    return frame.resize((ART_W * ART_PX, ART_H * ART_PX), Image.NEAREST)


def placed(frame, ox, oy):
    cell = Image.new('RGBA', (FRAME_W, FRAME_H))
    cell.alpha_composite(upscaled(frame).crop((0, 0, FRAME_W - ox, FRAME_H - oy)), (ox, oy))
    return cell


def alignment(idle, cell):
    """
    The offset (0 or 1 px each way) that puts the clip's idle frame on the sheet's
    idle cell, and how many pixels still differ. A few edge pixels (and a shade or
    two of the outline) of PixelLab's frame 0 differ from its input, so it's a best
    fit, not an exact match.
    """
    best = None
    for ox in (0, 1):
        for oy in (0, 1):
            a = placed(idle, ox, oy).tobytes()
            b = cell.tobytes()
            diff = sum(1 for i in range(3, len(a), 4) if (a[i] > 0) != (b[i] > 0))
            if best is None or diff < best[0]:
                best = (diff, ox, oy)
    return best


def build(name):
    sheet = Image.open(os.path.join(ROOT, 'assets', 'field', f'field_{name}.png')).convert('RGBA')
    strips = {v: os.path.join(SRC, f'{name}_{v}.png') for v in VIEWS}
    strips = {v: strip_frames(p) for v, p in strips.items() if os.path.exists(p)}
    cells = [sheet.crop((0, r * FRAME_H, FRAME_W, (r + 1) * FRAME_H)).tobytes() for r in range(len(VIEWS))]
    standee = len(set(cells)) == 1
    rows = {v: strips.get(v) or (strips['down'] if standee else None) for v in VIEWS}
    n = max(len(f) - 1 for f in strips.values())
    out = Image.new('RGBA', (FRAME_W * n, FRAME_H * len(VIEWS)))
    for r, view in enumerate(VIEWS):
        frames = rows[view]
        if not frames:
            continue
        cell = sheet.crop((0, r * FRAME_H, FRAME_W, (r + 1) * FRAME_H))
        diff, ox, oy = alignment(frames[0], cell)
        if diff > 40:
            print(f'  {name} {view}: idle frame is {diff} px off the sheet', file=sys.stderr)
        for c, frame in enumerate(frames[1:]):
            out.alpha_composite(placed(frame, ox, oy), (c * FRAME_W, r * FRAME_H))
    path = os.path.join(ROOT, 'assets', 'field', f'field_{name}_idle.png')
    out.save(path, optimize=True)
    print(f'field_{name}_idle', out.size, f'{n} frames', ', '.join(v for v in VIEWS if rows[v]))


if __name__ == '__main__':
    for name in sys.argv[1:]:
        build(name)
