"""
Frontal 128x128 face textures + 6 expressions, made from the approved face sheet.

The neutral face is the frontal 128x128 texture from the sheet. The other
expressions are made by repainting the expression elements (brows, eyelids,
mouth) on top of it, in the same pixel grid and palette — "swappable texture
elements" as allowed by the face spec.
usage: python face_expressions.py <sheet.webp> <out_dir>
"""
import os
import sys
from PIL import Image, ImageDraw

EXPRS = ['neutral', 'surprise', 'anxiety', 'tired', 'sad', 'joy']

# hero layout in the 128 texture (x0, y0, x1, y1)
HERO = {
    'crop': (169, 287, 293, 416),
    'eyeL': (36, 42, 58, 48), 'eyeR': (74, 42, 96, 48),
    'browL': (34, 36, 58, 42), 'browR': (74, 36, 98, 42),
    'mouth': (48, 72, 80, 80),
}


def avg(img, box):
    px = img.load(); x0, y0, x1, y1 = box
    cs = [px[x, y] for y in range(y0, y1) for x in range(x0, x1)]
    return tuple(sum(c[i] for c in cs) // len(cs) for i in range(3))


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def make(sheet_path, out_dir, L=HERO, prefix='hero'):
    sheet = Image.open(sheet_path).convert('RGB')
    base = sheet.crop(L['crop']).resize((128, 128), Image.NEAREST)
    skin = avg(base, (56, 28, 72, 34))            # forehead
    lid = shade(skin, 0.8)
    brow = avg(base, (38, 37, 54, 41))
    dark = (36, 22, 18)
    white = (196, 182, 170)
    lipc = avg(base, (52, 72, 60, 76))
    os.makedirs(out_dir, exist_ok=True)
    out = {}
    for e in EXPRS:
        im = base.copy()
        d = ImageDraw.Draw(im)
        (bl0, by0, bl1, by1), (br0, _, br1, _) = L['browL'], L['browR']

        def brows(dy_in, dy_out):
            """move the brows: dy for the inner and the outer end (negative = up)"""
            d.rectangle([bl0, by0 - 6, bl1 - 1, by1 - 1], fill=skin)
            d.rectangle([br0, by0 - 6, br1 - 1, by1 - 1], fill=skin)
            for x0, x1, inner_right in ((bl0, bl1, True), (br0, br1, False)):
                n = (x1 - x0) // 4
                for i in range(n):
                    t = (i + 0.5) / n
                    t = t if inner_right else 1 - t
                    dy = round((dy_out + (dy_in - dy_out) * t) / 2) * 2
                    xx = x0 + i * 4
                    d.rectangle([xx, by0 + dy, xx + 3, by0 + dy + 3], fill=brow)

        def lids(upper=0.0, lower=0.0):
            for (x0, y0, x1, y1) in (L['eyeL'], L['eyeR']):
                h = y1 - y0
                if upper:
                    c = max(2, round(h * upper / 2) * 2)
                    d.rectangle([x0, y0, x1 - 1, y0 + c - 1], fill=lid)
                    d.rectangle([x0, y0 + c, x1 - 1, y0 + c], fill=dark)
                if lower:
                    c = max(2, round(h * lower / 2) * 2)
                    d.rectangle([x0, y1 - c, x1 - 1, y1 - 1], fill=lid)

        def wide():
            for (x0, y0, x1, y1) in (L['eyeL'], L['eyeR']):
                d.rectangle([x0 + 4, y0 - 2, x1 - 5, y0 - 1], fill=white)        # a little more white above the iris
                d.rectangle([x0 + 4, y0 - 3, x1 - 5, y0 - 3], fill=dark)

        mx0, my0, mx1, my1 = L['mouth']
        mc = (mx0 + mx1) // 2
        if e == 'surprise':
            brows(-4, -4); wide()
            d.rectangle([mc - 6, my0 + 1, mc + 5, my1 - 1], fill=dark)            # open mouth
            d.rectangle([mc - 6, my0, mc + 5, my0], fill=lipc)
        elif e == 'anxiety':
            brows(-4, 0)
            d.rectangle([mx0 + 2, my0 + 3, mx1 - 3, my0 + 4], fill=dark)          # pressed lips
        elif e == 'tired':
            brows(2, 2); lids(0.5)
        elif e == 'sad':
            brows(-4, 2); lids(0.34)
            d.rectangle([mx0 + 6, my0 + 3, mx1 - 7, my0 + 4], fill=dark)
            d.rectangle([mx0 + 2, my0 + 5, mx0 + 5, my0 + 6], fill=dark)          # corners down
            d.rectangle([mx1 - 6, my0 + 5, mx1 - 3, my0 + 6], fill=dark)
        elif e == 'joy':
            brows(-2, 0); lids(0, 0.34)
            d.rectangle([mx0 + 4, my0 + 2, mx1 - 5, my0 + 5], fill=(230, 218, 200))  # teeth
            d.rectangle([mx0 + 4, my0 + 6, mx1 - 5, my0 + 6], fill=dark)
            d.rectangle([mx0, my0, mx0 + 3, my0 + 2], fill=dark)                  # corners up
            d.rectangle([mx1 - 4, my0, mx1 - 1, my0 + 2], fill=dark)
        im.save(os.path.join(out_dir, f'{prefix}_face_{e}.png'))
        out[e] = im
    # contact sheet of the 6 expressions
    sheet_out = Image.new('RGB', (128 * 6 + 50, 128), (24, 20, 26))
    for i, e in enumerate(EXPRS):
        sheet_out.paste(out[e], (i * 138, 0))
    sheet_out.save(os.path.join(out_dir, f'{prefix}_expressions_flat.png'))
    return out


if __name__ == '__main__':
    make(sys.argv[1], sys.argv[2])
