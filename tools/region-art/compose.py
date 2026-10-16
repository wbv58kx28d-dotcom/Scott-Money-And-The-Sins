"""Compose a walkable region's ground and walk mask from PixelLab Wang tilesets.

    python3 tools/region-art/compose.py start

Reads the region's shapes from `src/data/maps/<region>.js` (the same `placeholder`
block the procedural stand-in paints from, so every position in the map data
stays valid; `islands` are dry land inside pools, and a `calm` pool keeps its shape,
for a moat around a velvet-rope area) and the sources in `tools/region-art/<region>/`:

    tiles/<pair>.png + .json   PixelLab top-down tilesets (sheet + metadata), one per
                               terrain pair: water_grass, dirt_grass, grass_reeds
    art.json                   the tiles' color grade, and which decals to scatter where
    decals/*.png, boardwalk.png

and writes `assets/regions/<region>/base.webp` (world size) and `walk.png` (art
size; white is walkable). Needs Node (to read the map) and Pillow.

Terrain lives on a vertex grid one tile apart. Each cell picks the tile whose four
corners match (Wang autotiling). Only pairs that share a tileset can meet in a
cell, so a cell that would mix water and dirt, say, has its dirt corners turned
back into grass: that's the grass verge between the path and a pool.
"""

import json
import math
import os
import random
import subprocess
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART_PX = 2  # screen px per art pixel, like the walker sheets (CLAUDE.md §8.4)

# Terrain codes, and the tileset each pair comes from: (file, lower, upper).
W, G, D, R = 'water', 'grass', 'dirt', 'reeds'
PAIRS = {
    frozenset([W, G]): ('water_grass', W, G),
    frozenset([D, G]): ('dirt_grass', D, G),
    frozenset([G, R]): ('grass_reeds', G, R),
}


def load_map(region):
    js = f"import('./src/data/maps/{region}.js').then(m => console.log(JSON.stringify(m.default)))"
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))


def graded(im, grade):
    """Pull saturation and brightness down so the ground sits under the props."""
    sat, bright = grade.get('saturation', 1.0), grade.get('brightness', 1.0)
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            px[x, y] = tuple(max(0, min(255, round((lum + (c - lum) * sat) * bright))) for c in (r, g, b)) + (a,)
    return im


def load_tilesets(src, grade):
    """{pair file: {(NW, NE, SW, SE): [tile images]}}, corners as terrain codes."""
    sets = {}
    for name, lower, upper in PAIRS.values():
        sheet = graded(Image.open(os.path.join(src, 'tiles', f'{name}.png')).convert('RGBA'), grade)
        meta = json.load(open(os.path.join(src, 'tiles', f'{name}.json')))
        code = {'lower': lower, 'upper': upper}
        lut = {}
        for t in meta['tileset_data']['tiles']:
            c = t['corners']
            b = t['bounding_box']
            key = tuple(code[c[k]] for k in ('NW', 'NE', 'SW', 'SE'))
            lut.setdefault(key, []).append(sheet.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height'])))
        sets[name] = lut
    return sets


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def main(region):
    m = load_map(region)
    ph = m['placeholder']
    src = os.path.join(ROOT, 'tools', 'region-art', region)
    out = os.path.join(ROOT, 'assets', 'regions', region)
    os.makedirs(out, exist_ok=True)
    rand = random.Random(ph['seed'])

    spec = json.load(open(os.path.join(src, 'art.json')))
    sets = load_tilesets(src, spec.get('grade', {}))
    tile = next(iter(next(iter(sets.values())).values()))[0].width  # art px
    step = tile * ART_PX  # world px between vertices
    cols = math.ceil(m['size']['w'] / step)
    rows = math.ceil(m['size']['h'] / step)

    # ---- Terrain at each vertex, from the placeholder shapes. ----
    # A few random waves around each pool's rim, so pools aren't plain ellipses.
    # A `calm` pool keeps a third of the waves (its shape matters, like a moat),
    # drawn from its own random stream so adding one doesn't reshuffle the rest of the map.
    def wave(r, calm):
        return (r.uniform(0.1, 0.22) * (0.33 if calm else 1), r.randint(2, 5), r.uniform(0, math.tau))

    waves = [[wave(random.Random(ph['seed'] * 31 + k) if p.get('calm') else rand, p.get('calm')) for _ in range(2)]
             for k, p in enumerate(ph['pools'])]
    islands = ph.get('islands', [])

    def in_pool(x, y):
        if any(((x - i['x']) / i['rx']) ** 2 + ((y - i['y']) / i['ry']) ** 2 <= 1 for i in islands):
            return False
        for p, wv in zip(ph['pools'], waves):
            dx, dy = (x - p['x']) / p['rx'], (y - p['y']) / p['ry']
            ang = math.atan2(dy, dx)
            rim = 1 + sum(a * math.sin(k * ang + ph0) for a, k, ph0 in wv)
            if dx * dx + dy * dy <= rim * rim:
                return True
        return False

    def on_path(x, y):
        half = ph['pathWidth'] / 2
        pts = ph['path']
        if any(seg_dist(x, y, *pts[i - 1], *pts[i]) <= half for i in range(1, len(pts))):
            return True
        c = ph.get('clearing')
        return bool(c) and ((x - c['x']) / c['rx']) ** 2 + ((y - c['y']) / c['ry']) ** 2 <= 1

    border = ph['border']
    vert = {}
    for j in range(rows + 1):
        for i in range(cols + 1):
            x, y = i * step, j * step
            edge = min(x, y, m['size']['w'] - x, m['size']['h'] - y)
            if edge < border * 0.6:
                t = R  # the reed wall at the very edge stays solid, even beside a pool
            elif in_pool(x, y):
                t = W
            elif on_path(x, y):
                t = D
            elif edge < border + rand.uniform(-8, 24):
                t = R
            else:
                t = G
            vert[i, j] = t

    # Exits cut through the reeds.
    for e in m['exits']:
        for (i, j), t in vert.items():
            x, y = i * step, j * step
            if t == R and e['x'] - step <= x <= e['x'] + e['w'] + step and y >= e['y'] - border - step:
                vert[i, j] = G

    # Cells may only mix terrains that share a tileset: turn the offender into grass.
    def corners(i, j):
        return [(i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)]

    changed = True
    while changed:
        changed = False
        for j in range(rows):
            for i in range(cols):
                kinds = {vert[c] for c in corners(i, j)}
                if len(kinds) <= 1 or (len(kinds) == 2 and frozenset(kinds) in PAIRS):
                    continue
                # Keep water and the path's shape; reeds and dirt give way.
                drop = R if R in kinds and D in kinds else (W if R in kinds else D)
                for c in corners(i, j):
                    if vert[c] == drop:
                        vert[c] = G
                        changed = True

    # ---- Paint the tiles. ----
    full = {}  # terrain → every solid tile for it, across the tilesets
    for name, lower, upper in PAIRS.values():
        for t in (lower, upper):
            full.setdefault(t, []).extend(sets[name].get((t,) * 4, []))

    art = Image.new('RGBA', (cols * tile, rows * tile))
    kinds_at = {}
    for j in range(rows):
        for i in range(cols):
            key = tuple(vert[c] for c in corners(i, j))
            kinds = set(key)
            kinds_at[i, j] = kinds
            if len(kinds) == 1:
                im = rand.choice(full[key[0]])
                if rand.random() < 0.5:
                    im = im.transpose(Image.FLIP_LEFT_RIGHT)
            else:
                im = rand.choice(sets[PAIRS[frozenset(kinds)][0]][key])
            art.alpha_composite(im, (i * tile, j * tile))

    # ---- Decals on solid cells (grass details, lily pads). ----
    for scatter in spec.get('scatter', []):
        ims = [Image.open(os.path.join(src, 'decals', f)).convert('RGBA') for f in scatter['files']]
        cells = [k for k, v in kinds_at.items() if v == {scatter['on']}]
        for _ in range(int(len(cells) * scatter['density']) if ims else 0):
            i, j = rand.choice(cells)
            im = rand.choice(ims)
            bb = im.getbbox()
            if not bb:
                continue
            im = im.crop(bb)
            x = i * tile + rand.randint(0, max(0, tile - im.width))
            y = j * tile + rand.randint(0, max(0, tile - im.height))
            art.alpha_composite(im, (x, y))

    # ---- Boardwalks over the water. ----
    bw_img = Image.open(os.path.join(src, 'boardwalk.png')).convert('RGBA')
    bw_img = bw_img.crop(bw_img.getbbox())
    for b in ph['boardwalks']:
        cx = (b['x'] + b['w'] / 2) / ART_PX
        top = b['y'] / ART_PX
        want_h = round(b['h'] / ART_PX)
        # Stretch by repeating the middle plank rows, never by scaling pixels.
        im = bw_img
        while im.height < want_h:
            mid = im.height // 2
            band = im.crop((0, mid - 4, im.width, mid + 4))
            grown = Image.new('RGBA', (im.width, im.height + band.height))
            grown.alpha_composite(im.crop((0, 0, im.width, mid)), (0, 0))
            grown.alpha_composite(band, (0, mid))
            grown.alpha_composite(im.crop((0, mid, im.width, im.height)), (0, mid + band.height))
            im = grown
        im = im.crop((0, (im.height - want_h) // 2, im.width, (im.height - want_h) // 2 + want_h))
        art.alpha_composite(im, (round(cx - im.width / 2), round(top)))

    # ---- Write the ground at world size. ----
    w_art, h_art = math.ceil(m['size']['w'] / ART_PX), math.ceil(m['size']['h'] / ART_PX)
    art = art.crop((0, 0, w_art, h_art))
    base = art.resize((w_art * ART_PX, h_art * ART_PX), Image.NEAREST).crop((0, 0, m['size']['w'], m['size']['h']))
    base.convert('RGB').save(os.path.join(out, 'base.webp'), lossless=True, quality=100, method=6)

    # ---- Walk mask at art size: water and reeds are walls, blended between corners
    # like the tiles' own transitions. Boardwalks and exits are walkable. ----
    mask = Image.new('L', (w_art, h_art), 255)
    px = mask.load()
    blocked = {k: (1.0 if t in (W, R) else 0.0) for k, t in vert.items()}
    for y in range(h_art):
        for x in range(w_art):
            fx, fy = x / tile, y / tile
            i, j = int(fx), int(fy)
            u, v = fx - i, fy - j
            a = (blocked[i, j] * (1 - u) + blocked[i + 1, j] * u) * (1 - v)
            a += (blocked[i, j + 1] * (1 - u) + blocked[i + 1, j + 1] * u) * v
            if a > 0.5:
                px[x, y] = 0
    for b in ph['boardwalks']:
        x0, y0 = round(b['x'] / ART_PX), round(b['y'] / ART_PX)
        mask.paste(255, (x0, y0, x0 + round(b['w'] / ART_PX), y0 + round(b['h'] / ART_PX)))
    for e in m['exits']:
        x0 = math.floor(e['x'] / ART_PX)
        mask.paste(255, (x0, math.floor((e['y'] - border) / ART_PX), x0 + math.ceil(e['w'] / ART_PX), h_art))
    mask.save(os.path.join(out, 'walk.png'))
    print(f'{region}: {cols}×{rows} tiles → {base.size[0]}×{base.size[1]} base, {w_art}×{h_art} mask')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'start')
