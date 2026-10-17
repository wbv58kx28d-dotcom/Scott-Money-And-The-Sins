"""Export a region tileset for the game's tile-drawn ground and the map editor.

    python3 tools/region-art/tileset.py swamp

Reads `tools/region-art/<set>/`:

    tiles/<pair>.png + .json   PixelLab top-down Wang tilesets (sheet + metadata), one per
                               terrain pair (lower_upper, e.g. water_grass)
    art.json                   `terrains` (code, name, which ones block walking), `base`
                               (the terrain two others meet through), the color `grade`,
                               which `scatter` decals go on which terrain, and optional
                               `bubbles` (animated fx_bubble pops on a terrain, Region scene)
    decals/*.png, bridge.png

and writes `assets/regions/<set>/`: tiles.png (every tile, color-graded, at the
game's 2 screen px per art pixel), decals.png (the decals, packed), bridge.png
(a boardwalk to stretch over water), and tileset.json, which the game
(systems/terrain.js) reads to pick a tile for each cell from its four corners.
"""

import json
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART_PX = 2  # screen px per art pixel, like the walkers (CLAUDE.md §8.4)
PER_ROW = 16


def up(im):
    return im.resize((im.width * ART_PX, im.height * ART_PX), Image.NEAREST)


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


def solid_colors(sheet, meta):
    """The average color of each pair's all-lower and all-upper tile."""
    out = {}
    for t in meta['tileset_data']['tiles']:
        sides = set(t['corners'].values())
        if len(sides) == 1:
            b = t['bounding_box']
            tile = sheet.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height'])).convert('RGB')
            out[sides.pop()] = tile.resize((1, 1), Image.BOX).getpixel((0, 0))
    return out


def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))


def swapped_pairs(spec, sheets):
    """
    PixelLab sometimes labels a set's two terrains the wrong way round (the art is
    right, the 'lower'/'upper' tags are swapped), which paints land as water. Pairs
    share a terrain (the base), so a pair whose shared terrain looks like the other
    side's art is swapped. Returns the names of the pairs to flip.
    """
    colors = {pair: solid_colors(*sheets[pair]) for pair in spec['pairs']}
    flip = []
    for pair in spec['pairs']:
        lower, upper = pair.split('_')
        for side, terr in (('lower', lower), ('upper', upper)):
            others = [colors[o]['lower' if o.split('_')[0] == terr else 'upper']
                      for o in spec['pairs'] if o != pair and terr in o.split('_')]
            if not others:
                continue
            other_side = 'upper' if side == 'lower' else 'lower'
            near = min(dist(colors[pair][side], c) for c in others)
            far = min(dist(colors[pair][other_side], c) for c in others)
            if far * 4 < near:
                flip.append(pair)
            break
    return flip


def main(name):
    src = os.path.join(ROOT, 'tools', 'region-art', name)
    out = os.path.join(ROOT, 'assets', 'regions', name)
    os.makedirs(out, exist_ok=True)
    spec = json.load(open(os.path.join(src, 'art.json')))
    code = {t['name']: c for c, t in spec['terrains'].items()}  # 'water' -> 'w'

    sheets = {pair: (Image.open(os.path.join(src, 'tiles', f'{pair}.png')).convert('RGBA'),
                     json.load(open(os.path.join(src, 'tiles', f'{pair}.json')))) for pair in spec['pairs']}
    flip = swapped_pairs(spec, sheets)
    for pair in flip:
        print(f'{pair}: PixelLab labelled its terrains the wrong way round; flipping them')

    tiles, keys = [], {}
    for pair in spec['pairs']:
        lower, upper = pair.split('_')
        sheet = graded(sheets[pair][0].copy(), spec.get('grade', {}))
        meta = sheets[pair][1]
        side = {'lower': code[lower], 'upper': code[upper]}
        if pair in flip:
            side = {'lower': code[upper], 'upper': code[lower]}
        for t in meta['tileset_data']['tiles']:
            c, b = t['corners'], t['bounding_box']
            key = ''.join(side[c[k]] for k in ('NW', 'NE', 'SW', 'SE'))
            keys.setdefault(key, []).append(len(tiles))
            tiles.append(sheet.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height'])))
    size = tiles[0].width
    rows = (len(tiles) + PER_ROW - 1) // PER_ROW
    atlas = Image.new('RGBA', (PER_ROW * size, rows * size))
    for i, t in enumerate(tiles):
        atlas.alpha_composite(t, ((i % PER_ROW) * size, (i // PER_ROW) * size))
    up(atlas).save(os.path.join(out, 'tiles.png'), optimize=True)

    # Each terrain's average color, for the editor's swatches and minimap.
    colors = {}
    for c in spec['terrains']:
        solid = tiles[keys[c * 4][0]].convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
        colors[c] = '#%02x%02x%02x' % solid

    # Decals, trimmed and packed in one row.
    files = sorted({f for s in spec.get('scatter', []) for f in s['files']})
    ims = []
    for f in files:
        im = Image.open(os.path.join(src, 'decals', f)).convert('RGBA')
        im = im.crop(im.getbbox())
        ims.append(im)
    frames, x = [], 0
    sheet = Image.new('RGBA', (sum(i.width + 1 for i in ims) or 1, max((i.height for i in ims), default=1)))
    for im in ims:
        sheet.alpha_composite(im, (x, 0))
        frames.append([x * ART_PX, 0, im.width * ART_PX, im.height * ART_PX])
        x += im.width + 1
    up(sheet).save(os.path.join(out, 'decals.png'), optimize=True)

    bridge = Image.open(os.path.join(src, 'bridge.png')).convert('RGBA')
    up(bridge.crop(bridge.getbbox())).save(os.path.join(out, 'bridge.png'), optimize=True)

    tileset = {
        'id': name,
        'cell': size * ART_PX,
        'perRow': PER_ROW,
        'terrains': {c: {**t, 'color': colors[c]} for c, t in spec['terrains'].items()},
        'base': spec['base'],
        'pairs': [''.join(code[p] for p in pair.split('_')) for pair in spec['pairs']],
        'tiles': keys,
        'decals': {
            'frames': frames,
            'scatter': [{'on': code[s['on']], 'density': s['density'], 'frames': [files.index(f) for f in s['files']]} for s in spec.get('scatter', [])],
        },
    }
    if 'bubbles' in spec:
        tileset['bubbles'] = {**spec['bubbles'], 'on': code[spec['bubbles']['on']]}
    json.dump(tileset, open(os.path.join(out, 'tileset.json'), 'w'), separators=(',', ':'))
    print(f'{name}: {len(tiles)} tiles of {size * ART_PX}px, {len(frames)} decals, keys {len(keys)}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'swamp')
