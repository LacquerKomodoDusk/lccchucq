"""
Frontal 128x128 face textures + 6 expressions for every character.

Sources (src/assets/heads/src_<char>.png):
  * wife and both sons: the frontal 128x128 face textures from the face sheet;
  * hero: the sheet's frontal hero texture is much coarser than his renders and
    has an oversized beard, so his frontal face is built from the large portrait
    on the same sheet (the near half of the face, mirrored).
Expressions are swappable texture elements (brows, eyelids, mouth) repainted in
the same pixel grid and palette. The wife also gets look_left / look_right
(pupils moved) for eye movement and the quick look-away.

usage: python face_expressions.py [char ...]
"""
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, '..', '..', 'src', 'assets', 'heads')
EXPRS = ['neutral', 'surprise', 'anxiety', 'tired', 'sad', 'joy']

# ---------------------------------------------------------------- uniform pixel density
# Every face must have the same pixels-per-metre on the model. Measured
# cheek-to-cheek width of the face in each source texture (px of 128) and head
# width (m); the target density is the wife's (the coarsest source, so nothing
# is upscaled). Each source is rescaled about its centre by SCALE and snapped to
# a common 2x2 pixel grid.
FACE_PX = {'hero': 107.5, 'wife': 64.0, 'son_older': 87.0, 'son_younger': 94.7}
HEAD_W = {'hero': 0.215, 'wife': 0.19, 'son_older': 0.2, 'son_younger': 0.2}
DENSITY = FACE_PX['wife'] / (HEAD_W['wife'] * 0.96)          # px per metre
SCALE = {c: DENSITY * HEAD_W[c] * 0.96 / FACE_PX[c] for c in FACE_PX}
GRID = 2


def normalize(img, s):
    """rescale about the centre (edge pixels extend outward), then snap to the pixel grid"""
    import numpy as np
    n = max(8, round(128 * s / GRID) * GRID)
    small = img.resize((n, n), Image.BOX)
    a = np.asarray(small)
    pad0 = (128 - n) // 2
    a = np.pad(a, ((pad0, 128 - n - pad0), (pad0, 128 - n - pad0), (0, 0)), mode='edge')
    out = Image.fromarray(a)
    out = out.resize((128 // GRID, 128 // GRID), Image.BOX).resize((128, 128), Image.NEAREST)
    return out, n / 128


def map_box(b, s):
    return tuple(int(round(64 + (v - 64) * s)) for v in b)


# landmarks in the ORIGINAL 128x128 source: (x0, y0, x1, y1) — rescaled with the image
LAYOUTS = {
    'hero': dict(browL=(35, 34, 57, 40), browR=(71, 34, 93, 40), brow_t=4,
                 eyeL=(36, 43, 57, 50), eyeR=(71, 43, 92, 50), mouth=(48, 86, 80, 93), forehead=(54, 26, 74, 32)),
    'wife': dict(browL=(37, 36, 57, 40), browR=(70, 36, 88, 40), brow_t=2,
                 eyeL=(36, 42, 55, 49), eyeR=(70, 42, 88, 49), mouth=(53, 66, 73, 72), forehead=(56, 28, 72, 34)),
    'son_older': dict(browL=(33, 38, 50, 42), browR=(75, 38, 92, 42), brow_t=2,
                      eyeL=(33, 44, 50, 54), eyeR=(75, 44, 92, 54), mouth=(51, 66, 71, 72), forehead=(54, 28, 72, 34)),
    'son_younger': dict(browL=(32, 45, 49, 48), browR=(74, 45, 92, 48), brow_t=2,
                        eyeL=(33, 51, 50, 59), eyeR=(74, 51, 92, 59), mouth=(47, 72, 74, 78), forehead=(56, 36, 72, 42)),
}


def avg(img, box):
    px = img.load(); x0, y0, x1, y1 = box
    cs = [px[x, y] for y in range(y0, y1) for x in range(x0, x1)]
    return tuple(sum(c[i] for c in cs) // len(cs) for i in range(3))


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def darkest(img, box):
    px = img.load(); x0, y0, x1, y1 = box
    cs = sorted((px[x, y] for y in range(y0, y1) for x in range(x0, x1)), key=sum)
    cs = cs[:max(1, len(cs) // 4)]
    return tuple(sum(c[i] for c in cs) // len(cs) for i in range(3))


def build_hero_source(sheet_path):
    """hero frontal face from the large portrait: near half mirrored. The mirror
    joins the two brows in the middle (a monobrow), so the glabella between the
    inner brow ends is repainted with forehead skin."""
    from PIL import ImageOps
    im = Image.open(sheet_path).convert('RGB')
    half = im.crop((38, 250, 116, 410))
    f = Image.new('RGB', (156, 160)); f.paste(half, (0, 0)); f.paste(ImageOps.mirror(half), (78, 0))
    f = f.resize((128, 128), Image.NEAREST)
    d = ImageDraw.Draw(f)
    skin = avg(f, (58, 26, 70, 31))
    bridge = avg(f, (60, 44, 68, 50))
    d.rectangle([57, 32, 70, 39], fill=skin)            # gap between the brows
    d.rectangle([60, 40, 67, 43], fill=bridge)          # soft nose bridge below it
    hair_l, hair_r = f.crop((44, 0, 58, 14)), f.crop((70, 0, 84, 14))
    f.paste(hair_l.crop((0, 0, 7, 14)), (57, 0)); f.paste(hair_r.crop((7, 0, 14, 14)), (64, 0))  # mirror seam in the hair
    f.save(os.path.join(DIR, 'src_hero.png'))


def make(char):
    base, sc = normalize(Image.open(os.path.join(DIR, f'src_{char}.png')).convert('RGB'), SCALE[char])
    L = {k: (map_box(v, sc) if isinstance(v, tuple) else v) for k, v in LAYOUTS[char].items()}
    L['brow_t'] = max(2, round(LAYOUTS[char]['brow_t'] * sc / 2) * 2)
    skin = avg(base, L['forehead'])
    lid = shade(skin, 0.8)
    brow = darkest(base, L['browL'])
    dark = shade(darkest(base, L['eyeL']), 0.8)
    white = shade((206, 194, 182), 0.95)
    lipc = avg(base, L['mouth'])
    bt = L['brow_t']
    out = {}
    variants = EXPRS + (['look_left', 'look_right'] if char == 'wife' else [])
    for e in variants:
        im = base.copy()
        d = ImageDraw.Draw(im)
        (bl0, by0, bl1, by1), (br0, _, br1, _) = L['browL'], L['browR']

        def brows(dy_in, dy_out):
            d.rectangle([bl0, by0 - 4, bl1 - 1, by1], fill=skin)
            d.rectangle([br0, by0 - 4, br1 - 1, by1], fill=skin)
            for x0, x1, inner_right in ((bl0, bl1, True), (br0, br1, False)):
                n = max(1, (x1 - x0) // 3)
                for i in range(n):
                    t = (i + 0.5) / n
                    t = t if inner_right else 1 - t
                    dy = round(dy_out + (dy_in - dy_out) * t)
                    xx = x0 + i * 3
                    d.rectangle([xx, by0 + dy, xx + 2, by0 + dy + bt - 1], fill=brow)

        def lids(upper=0.0, lower=0.0):
            for (x0, y0, x1, y1) in (L['eyeL'], L['eyeR']):
                h = y1 - y0
                if upper:
                    c = max(1, round(h * upper))
                    d.rectangle([x0, y0, x1 - 1, y0 + c - 1], fill=lid)
                    d.rectangle([x0, y0 + c, x1 - 1, y0 + c], fill=dark)
                if lower:
                    c = max(1, round(h * lower))
                    d.rectangle([x0, y1 - c, x1 - 1, y1 - 1], fill=lid)

        def wide():
            for (x0, y0, x1, y1) in (L['eyeL'], L['eyeR']):
                d.rectangle([x0 + 3, y0 - 2, x1 - 4, y0 - 1], fill=white)
                d.rectangle([x0 + 3, y0 - 3, x1 - 4, y0 - 3], fill=dark)

        def look(dx):
            for (x0, y0, x1, y1) in (L['eyeL'], L['eyeR']):
                eye = base.crop((x0 + 2, y0, x1 - 2, y1))
                d.rectangle([x0 + 2, y0 + 1, x1 - 3, y1 - 2], fill=white)
                im.paste(eye.crop((max(0, -dx), 0, eye.width - max(0, dx), eye.height)), (x0 + 2 + max(0, dx), y0))

        mx0, my0, mx1, my1 = L['mouth']
        mc, mh = (mx0 + mx1) // 2, my1 - my0
        mid = my0 + mh // 2
        if e == 'surprise':
            brows(-3, -3); wide()
            d.ellipse([mc - 4, mid - 2, mc + 4, mid + 4], fill=dark)
        elif e == 'anxiety':
            brows(-3, 0)
            d.rectangle([mx0 + 2, mid, mx1 - 3, mid], fill=dark)
        elif e == 'tired':
            brows(1, 1); lids(0.5)
        elif e == 'sad':
            brows(-3, 1); lids(0.3)
            d.rectangle([mx0 + 4, mid, mx1 - 5, mid], fill=dark)
            d.rectangle([mx0 + 1, mid + 1, mx0 + 3, mid + 2], fill=dark)
            d.rectangle([mx1 - 4, mid + 1, mx1 - 2, mid + 2], fill=dark)
        elif e == 'joy':
            brows(-1, 0); lids(0, 0.3)
            d.rectangle([mx0 + 3, mid - 1, mx1 - 4, mid + 1], fill=(232, 222, 206))
            d.rectangle([mx0 + 3, mid + 2, mx1 - 4, mid + 2], fill=shade(lipc, 0.7))
            d.rectangle([mx0, mid - 2, mx0 + 2, mid - 1], fill=shade(lipc, 0.6))
            d.rectangle([mx1 - 3, mid - 2, mx1 - 1, mid - 1], fill=shade(lipc, 0.6))
        elif e == 'look_left':
            look(-3)
        elif e == 'look_right':
            look(3)
        im.save(os.path.join(DIR, f'{char}_face_{e}.png'))
        out[e] = im
    sheet = Image.new('RGB', (138 * len(variants), 128), (24, 20, 26))
    for i, e in enumerate(variants):
        sheet.paste(out[e], (i * 138, 0))
    sheet.save(os.path.join(DIR, f'{char}_expressions_flat.png'))


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0].endswith(('.webp', '.png', '.jpg')):
        build_hero_source(args.pop(0))
    for c in (args or list(LAYOUTS)):
        make(c)
