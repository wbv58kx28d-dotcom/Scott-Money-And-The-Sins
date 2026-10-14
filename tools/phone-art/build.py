"""Turn the phone's PixelLab sources into game-ready art (scenes/PhoneScene.js).

    python3 tools/phone-art/build.py

Sources in tools/phone-art/src/ (all 1 px per art pixel):
    flip_body.png          create_ui_asset output, 384×688 with the phone in the middle
    smart_body.png         the same for the smartphone
    wallpaper.png          the smartphone wallpaper, 218×540
    icon_<model>_<app>.png 16×16 (flip) or 32×32 (smart) app icons

Writes assets/phone/, scaled with nearest-neighbor: the body and wallpaper at
2× (the walkers' density, CLAUDE.md §8.4), flip icons at 3× (the LCD's
lettering grid) and smart icons at 2×. The flip body is cropped to the phone,
and the glare streaks on its glass are lifted into flip_glare.png so the game
can draw them over the LCD's contents. The smartphone's wallpaper is laid into
its glass (everything inside the black bezel line except the camera pill), so
smart_body.png is one image with the screen already lit.
"""

import glob
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'phone-art', 'src')
OUT = os.path.join(ROOT, 'assets', 'phone')

# Where the glass is on flip_body.png (source px), measured from the art.
GLASS = (129, 117, 254, 284)  # inclusive x0, y0, x1, y1
# On smart_body.png: a point inside the glass, and the bezel line around it
# (and around the camera pill) that the wallpaper fills up to.
SMART_GLASS_SEED = (192, 344)
SMART_BEZEL = (16, 12, 28)


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def flood(im, seed, wall):
    """The pixels reachable from `seed` without crossing `wall`-colored or clear ones."""
    seen, stack = set(), [seed]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < im.width and 0 <= y < im.height):
            continue
        p = im.getpixel((x, y))
        if p[3] == 0 or p[:3] == wall:
            continue
        seen.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return seen


def main():
    os.makedirs(OUT, exist_ok=True)

    body = Image.open(os.path.join(SRC, 'flip_body.png')).convert('RGBA')
    box = body.getbbox()
    # Glare: the streaks a little lighter than the glass, as white on a transparent
    # layer (the game draws it faintly over the LCD).
    glare = Image.new('RGBA', body.size)
    gx0, gy0, gx1, gy1 = GLASS
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            r, g, b, a = body.getpixel((x, y))
            if a and r + g + b >= 460:
                glare.putpixel((x, y), (255, 255, 255, 255))
    up(body.crop(box), 2).save(os.path.join(OUT, 'flip_body.png'), optimize=True)
    up(glare.crop(box), 2).save(os.path.join(OUT, 'flip_glare.png'), optimize=True)
    print('flip body', box, '-> glass at', ((gx0 - box[0]) * 2, (gy0 - box[1]) * 2, (gx1 - gx0 + 1) * 2, (gy1 - gy0 + 1) * 2))

    smart = Image.open(os.path.join(SRC, 'smart_body.png')).convert('RGBA')
    glass = flood(smart, SMART_GLASS_SEED, SMART_BEZEL)
    xs = [x for x, _ in glass]
    ys = [y for _, y in glass]
    gx0, gy0, gx1, gy1 = min(xs), min(ys), max(xs), max(ys)
    wall = Image.open(os.path.join(SRC, 'wallpaper.png')).convert('RGBA')
    ox = gx0 - (wall.width - (gx1 - gx0 + 1)) // 2  # center the wallpaper on the glass
    oy = gy0 - (wall.height - (gy1 - gy0 + 1)) // 2
    for x, y in glass:
        smart.putpixel((x, y), wall.getpixel((x - ox, y - oy)))
    box = smart.getbbox()
    up(smart.crop(box), 2).save(os.path.join(OUT, 'smart_body.png'), optimize=True)
    print('smart body', box, '-> screen at', ((gx0 - box[0]) * 2, (gy0 - box[1]) * 2, (gx1 - gx0 + 1) * 2, (gy1 - gy0 + 1) * 2))

    for path in sorted(glob.glob(os.path.join(SRC, 'icon_*.png'))):
        name = os.path.basename(path)
        model = name.split('_')[1]
        im = Image.open(path).convert('RGBA')
        up(im, 3 if model == 'flip' else 2).save(os.path.join(OUT, name), optimize=True)
    print('wrote', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
