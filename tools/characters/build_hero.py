"""
Builds the hero: low-poly mesh, real UV unwrap into one 256x256 atlas, pixel
texture painted from the approved character sheet, humanoid rig (18 bones),
animations, and exports hero.glb + hero.blend + atlas/UV PNGs.

Run (bpy = Blender as a Python module):
    python tools/characters/build_hero.py
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)

from charlib import (Part, box, cylinder, icosphere, uv_sphere, sculpted_head, compute_uvs,
                     sub_rects, mirror_x, tri_count, ATLAS)
from PIL import Image, ImageDraw, ImageEnhance

OUT = os.path.join(ROOT, 'assets', 'characters', 'hero')
FACES = os.path.join(ROOT, 'src', 'assets', 'faces')
FABRIC = os.path.join(ROOT, 'src', 'assets', 'fabric')
os.makedirs(OUT, exist_ok=True)

# ------------------------------------------------------------------ atlas layout (x, y, w, h), y from top
R = {
    'FACE':     (0, 0, 96, 120),
    'HEAD':     (96, 0, 72, 48),
    'HAIR':     (168, 0, 88, 48),
    'SKIN':     (96, 48, 48, 32),
    'SHIRT':    (144, 48, 40, 32),
    'COLLAR':   (184, 48, 72, 32),
    'NOSE':     (96, 80, 24, 24),
    'HANDS':    (120, 80, 48, 40),
    'PELVIS':   (168, 80, 88, 40),
    'CHEST':    (0, 120, 108, 72),
    'ABDOMEN':  (108, 120, 72, 48),
    'SLEEVE_U': (180, 120, 76, 36),
    'SLEEVE_F': (180, 156, 76, 36),
    'FLAPS':    (108, 168, 72, 56),
    'THIGH':    (0, 192, 54, 64),
    'SHIN':     (54, 192, 54, 64),
    'BOOTS':    (180, 192, 76, 32),
    'PACK':     (180, 224, 76, 32),
    'STRAPS':   (108, 224, 72, 32),
}

# ------------------------------------------------------------------ rig: name -> (head, tail, parent)
BONES = [
    ('root',        (0, 0, 0),         (0, 0, 0.15),       None),
    ('hips',        (0, 0, 0.93),      (0, 0, 1.03),       'root'),
    ('spine',       (0, 0, 1.03),      (0, 0, 1.22),       'hips'),
    ('chest',       (0, 0, 1.22),      (0, 0, 1.45),       'spine'),
    ('neck',        (0, 0, 1.45),      (0, 0, 1.55),       'chest'),
    ('head',        (0, 0, 1.55),      (0, 0, 1.82),       'neck'),
    ('upperarm.L',  (0.215, 0, 1.43),  (0.245, 0, 1.13),   'chest'),
    ('forearm.L',   (0.245, 0, 1.13),  (0.262, 0, 0.88),   'upperarm.L'),
    ('hand.L',      (0.262, 0, 0.88),  (0.27, 0, 0.77),    'forearm.L'),
    ('upperarm.R',  (-0.215, 0, 1.43), (-0.245, 0, 1.13),  'chest'),
    ('forearm.R',   (-0.245, 0, 1.13), (-0.262, 0, 0.88),  'upperarm.R'),
    ('hand.R',      (-0.262, 0, 0.88), (-0.27, 0, 0.77),   'forearm.R'),
    ('thigh.L',     (0.1, 0, 0.93),    (0.1, 0, 0.5),      'hips'),
    ('shin.L',      (0.1, 0, 0.5),     (0.1, 0, 0.09),     'thigh.L'),
    ('foot.L',      (0.1, 0, 0.09),    (0.1, -0.15, 0.03), 'shin.L'),
    ('thigh.R',     (-0.1, 0, 0.93),   (-0.1, 0, 0.5),     'hips'),
    ('shin.R',      (-0.1, 0, 0.5),    (-0.1, 0, 0.09),    'thigh.R'),
    ('foot.R',      (-0.1, 0, 0.09),   (-0.1, -0.15, 0.03), 'shin.R'),
]

# ------------------------------------------------------------------ geometry
def build_parts():
    P = []
    # head: sculpted skull, the front gets the painted face
    hv, hf = sculpted_head((0, 0, 1.555), 0.205, 0.255, 0.235, seg=14, rings=11)
    head = Part('head', hv, hf, 'head', R['FACE'], mode='face'); head.rect2 = R['HEAD']; P.append(head)
    v, f = box((0, -0.122, 1.655), (0.032, 0.04, 0.062), taper=(0.45, 0.35))
    P.append(Part('nose', v, f, 'head', R['NOSE']))
    # curly hair: a cap and a cloud of faceted curls (keeps the face clear)
    v, f = uv_sphere((0, 0.012, 1.705), 0.118, scale=(1.0, 1.08, 0.72), seg=10, rings=8, top_only=True)
    P.append(Part('hair_cap', v, f, 'head', R['HAIR']))
    rnd = random.Random(7)
    curls_v, curls_f = [], []
    n = 0
    while n < 22:
        th = rnd.random() * math.pi * 2
        ph = rnd.random() * math.pi * 0.55
        fx, fy, fz = math.sin(ph) * math.cos(th), math.sin(ph) * math.sin(th), math.cos(ph)
        if fy < -0.25 and ph > math.pi * 0.2:
            continue  # forehead / face
        r = 0.04 + rnd.random() * 0.018
        cv, cf = icosphere((fx * 0.112, 0.012 + fy * 0.12, 1.70 + fz * 0.085), r, jitter=0.35, seed=n)
        base = len(curls_v)
        curls_v += cv
        curls_f += [[i + base for i in q] for q in cf]
        n += 1
    P.append(Part('curls', curls_v, curls_f, 'head', R['HAIR']))
    # neck + turned-up coat collar
    v, f = cylinder((0, 0, 1.46), (0, 0, 1.58), 0.052, 0.056, sides=6)
    P.append(Part('neck', v, f, 'neck', R['SKIN']))
    v, f = cylinder((0, 0.005, 1.425), (0, 0.01, 1.53), 0.12, 0.095, sides=8, caps=False)
    P.append(Part('collar', v, f, 'chest', R['COLLAR']))
    # torso (coat), abdomen, pelvis
    v, f = box((0, 0, 1.335), (0.37, 0.24, 0.25), taper=(1.16, 1.0), segs=(2, 1, 2), bevel=0.25)
    P.append(Part('chest', v, f, 'chest', R['CHEST']))
    v, f = box((0, 0, 1.115), (0.345, 0.225, 0.2), taper=(1.06, 1.06), segs=(2, 1, 1), bevel=0.2)
    P.append(Part('abdomen', v, f, 'spine', R['ABDOMEN']))
    v, f = box((0, 0, 0.955), (0.34, 0.215, 0.14), segs=(2, 1, 1), bevel=0.15)
    P.append(Part('pelvis', v, f, 'hips', R['PELVIS']))
    # coat flaps: top follows the hips, bottom follows the thigh (opens when walking)
    fw = 0.2
    # A-line trench flaps: narrower at the waist, flaring a little toward the knee
    v, f = box((0.098, 0.012, 0.66), (fw, 0.235, 0.46), taper=(0.82, 0.86), segs=(2, 1, 2))
    fl = Part('flap.L', v, f, 'hips', R['FLAPS'], bone_low='thigh.L', split_z=0.8)
    fr = Part('flap.R', mirror_x(v), [q[::-1] for q in f], 'hips', R['FLAPS'], bone_low='thigh.R', split_z=0.8)
    P += [fl, fr]
    # arms
    for side, sfx in ((1, 'L'), (-1, 'R')):
        v, f = cylinder((0.215 * side, 0, 1.445), (0.245 * side, 0, 1.13), 0.058, 0.05, sides=7)
        P.append(Part('upperarm.' + sfx, v, f, 'upperarm.' + sfx, R['SLEEVE_U']))
        v, f = cylinder((0.245 * side, 0, 1.15), (0.262 * side, 0, 0.88), 0.05, 0.043, sides=7, rings=2)
        P.append(Part('forearm.' + sfx, v, f, 'forearm.' + sfx, R['SLEEVE_F']))
        v, f = box((0.268 * side, -0.004, 0.825), (0.055, 0.085, 0.115), taper=(1.0, 1.0), segs=(1, 1, 1), bevel=0.2)
        P.append(Part('hand.' + sfx, v, f, 'hand.' + sfx, R['HANDS']))
        v, f = box((0.262 * side, -0.05, 0.85), (0.03, 0.03, 0.06))
        P.append(Part('thumb.' + sfx, v, f, 'hand.' + sfx, R['HANDS']))
        # legs
        v, f = cylinder((0.1 * side, 0, 0.95), (0.1 * side, 0, 0.49), 0.082, 0.062, sides=7, rings=2)
        P.append(Part('thigh.' + sfx, v, f, 'thigh.' + sfx, R['THIGH']))
        v, f = cylinder((0.1 * side, 0, 0.51), (0.1 * side, 0, 0.09), 0.06, 0.048, sides=7)
        P.append(Part('shin.' + sfx, v, f, 'shin.' + sfx, R['SHIN']))
        v, f = box((0.1 * side, -0.035, 0.05), (0.115, 0.26, 0.1), taper=(0.92, 0.72), segs=(1, 2, 1), bevel=0.2)
        P.append(Part('boot.' + sfx, v, f, 'foot.' + sfx, R['BOOTS']))
    # grey backpack with flap and shoulder straps
    v, f = box((0, 0.185, 1.27), (0.3, 0.13, 0.36), segs=(1, 1, 2), bevel=0.3)
    P.append(Part('pack', v, f, 'chest', R['PACK']))
    v, f = box((0, 0.255, 1.39), (0.27, 0.03, 0.14))
    P.append(Part('pack_flap', v, f, 'chest', R['PACK']))
    for side in (1, -1):
        v, f = box((0.1 * side, -0.005, 1.33), (0.05, 0.27, 0.34), segs=(1, 1, 1))
        # hollow look: a thin strap frame around the shoulder (front + back slabs)
        v1, f1 = box((0.1 * side, -0.128, 1.32), (0.045, 0.012, 0.3))
        v2, f2 = box((0.1 * side, 0.004, 1.455), (0.05, 0.25, 0.02))
        sv = v1 + v2
        sf = f1 + [[i + len(v1) for i in q] for q in f2]
        P.append(Part('strap.' + ('L' if side > 0 else 'R'), sv, sf, 'chest', R['STRAPS']))
    return P


# ------------------------------------------------------------------ texture
def tile(img, rect, src, scale=1.0):
    x, y, w, h = [int(round(a)) for a in rect]
    s = src.resize((max(1, int(src.width * scale)), max(1, int(src.height * scale))), Image.NEAREST)
    for yy in range(y, y + h, s.height):
        for xx in range(x, x + w, s.width):
            img.paste(s.crop((0, 0, min(s.width, x + w - xx), min(s.height, y + h - yy))), (xx, yy))


def noise_fill(img, rect, color, amount=18, seed=1, speck=None):
    x, y, w, h = [int(round(a)) for a in rect]
    rnd = random.Random(seed)
    px = img.load()
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            j = rnd.randint(-amount, amount)
            c = tuple(max(0, min(255, v + j)) for v in color)
            if speck and rnd.random() < speck[1]:
                c = speck[0]
            px[xx, yy] = c + (255,)


def curly(img, rect, base, seed=3):
    x, y, w, h = [int(round(a)) for a in rect]
    noise_fill(img, rect, tuple(int(c * 0.72) for c in base), 10, seed)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(int(w * h / 9)):
        cx, cy = x + rnd.randint(0, w - 3), y + rnd.randint(0, h - 3)
        k = 0.95 + rnd.random() * 0.25
        d.rectangle([cx, cy, cx + 2, cy + 1], fill=tuple(min(255, int(c * k)) for c in base) + (255,))
        d.point((cx + 1, cy), fill=tuple(min(255, int(c * 1.35)) for c in base) + (255,))
        d.point((cx + 2, cy + 2), fill=tuple(int(c * 0.5) for c in base) + (255,))


def paint_atlas(face_name='hero_neutral'):
    img = Image.new('RGBA', (ATLAS, ATLAS), (20, 16, 14, 255))
    skin = (205, 160, 128)
    hair = (128, 92, 60)
    # face straight from the approved sheet
    face = Image.open(os.path.join(FACES, face_name + '.png')).convert('RGBA')
    fx, fy, fw, fh = R['FACE']
    img.paste(face.resize((fw, fh), Image.NEAREST), (fx, fy))
    # rest of the head: hair at the back/top, skin + ear on the sides
    curly(img, R['HEAD'], hair, 5)
    subs = sub_rects(R['HEAD'])
    d = ImageDraw.Draw(img)
    for k in ('+X', '-X'):
        sx, sy, sw, sh = [int(a) for a in subs[k]]
        noise_fill(img, (sx, sy + sh * 0.35, sw, sh * 0.65), skin, 8, 9)
        d.rectangle([sx + sw * 0.35, sy + sh * 0.45, sx + sw * 0.62, sy + sh * 0.78], fill=(178, 130, 102, 255))
        d.rectangle([sx + sw * 0.42, sy + sh * 0.52, sx + sw * 0.55, sy + sh * 0.7], fill=(150, 104, 82, 255))
        # beard on the jaw sides
        d.rectangle([sx, sy + sh * 0.78, sx + sw, sy + sh], fill=(92, 62, 42, 255))
    curly(img, R['HAIR'], hair, 7)
    noise_fill(img, R['SKIN'], skin, 10, 11)
    noise_fill(img, R['NOSE'], skin, 8, 12)
    # hands with finger lines
    noise_fill(img, R['HANDS'], skin, 8, 13)
    hx, hy, hw, hh = R['HANDS']
    for i in range(hx + 3, hx + hw, 4):
        d.line([(i, hy + hh * 0.5), (i, hy + hh)], fill=(160, 116, 92, 255))
    # coat: the sheet's beige check fabric
    coat = Image.open(os.path.join(FABRIC, 'hero_coat.png')).convert('RGBA')
    for k in ('CHEST', 'ABDOMEN', 'SLEEVE_U', 'SLEEVE_F', 'FLAPS', 'COLLAR', 'PELVIS'):
        tile(img, R[k], coat, 0.5)
    # coat front: navy shirt in a V between lapels, double row of buttons, belt
    shirt = Image.open(os.path.join(FABRIC, 'hero_shirt.png')).convert('RGBA')
    tile(img, R['SHIRT'], shirt, 0.5)
    cs = sub_rects(R['CHEST'])['-Y']
    sx, sy, sw, sh = [int(a) for a in cs]
    navy = (44, 50, 78, 255)
    for i in range(int(sh * 0.7)):
        half = int(sw * 0.16 * (1 - i / (sh * 0.7)))
        d.line([(sx + sw // 2 - half, sy + i), (sx + sw // 2 + half, sy + i)], fill=navy)
    lap = (150, 128, 96, 255)
    for i in range(int(sh * 0.7)):
        off = int(sw * 0.16 * (1 - i / (sh * 0.7)))
        d.point((sx + sw // 2 - off - 1, sy + i), fill=lap); d.point((sx + sw // 2 + off + 1, sy + i), fill=lap)
    for by in (0.72, 0.86):
        for bx in (0.38, 0.62):
            d.rectangle([sx + sw * bx - 1, sy + sh * by - 1, sx + sw * bx + 1, sy + sh * by + 1], fill=(70, 52, 36, 255))
    ab = sub_rects(R['ABDOMEN'])['-Y']
    ax, ay, aw, ah = [int(a) for a in ab]
    for by in (0.25, 0.55):
        for bx in (0.38, 0.62):
            d.rectangle([ax + aw * bx - 1, ay + ah * by - 1, ax + aw * bx + 1, ay + ah * by + 1], fill=(70, 52, 36, 255))
    d.rectangle([ax, ay + ah * 0.78, ax + aw, ay + ah * 0.9], fill=(120, 100, 72, 255))  # belt
    # jeans and boots
    jeans = Image.open(os.path.join(FABRIC, 'hero_jeans.png')).convert('RGBA')
    tile(img, R['THIGH'], jeans, 0.5)
    tile(img, R['SHIN'], jeans, 0.5)
    noise_fill(img, R['BOOTS'], (96, 64, 40), 10, 21)
    bx, by, bw, bh = R['BOOTS']
    d.rectangle([bx, by + bh - 6, bx + bw, by + bh], fill=(52, 38, 28, 255))
    # grey backpack with pocket and stitching, dark straps
    noise_fill(img, R['PACK'], (104, 108, 114), 10, 22)
    ps = sub_rects(R['PACK'])['+Y']
    px_, py_, pw_, ph_ = [int(a) for a in ps]
    d.rectangle([px_ + 3, py_ + ph_ * 0.45, px_ + pw_ - 3, py_ + ph_ - 2], outline=(70, 74, 80, 255))
    noise_fill(img, R['STRAPS'], (58, 60, 64), 8, 23)
    # a little overall grain so the atlas matches the sheet's look
    px = img.load()
    rnd = random.Random(99)
    for yy in range(ATLAS):
        for xx in range(ATLAS):
            r, g, b, a = px[xx, yy]
            j = rnd.randint(-4, 4)
            px[xx, yy] = (max(0, min(255, r + j)), max(0, min(255, g + j)), max(0, min(255, b + j)), a)
    return img


def uv_layout_png(parts, uvs_per_part, path, size=1024):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for part, uvs in zip(parts, uvs_per_part):
        for face_uv in uvs:
            pts = [(u * size, (1 - v) * size) for (u, v) in face_uv]
            d.line(pts + [pts[0]], fill=(255, 255, 255, 230), width=1)
    img.save(path)


# ------------------------------------------------------------------ animations
# Pose = {bone: (rx, ry, rz)} in bone-local euler radians (XYZ). Bones point along
# their length; for limbs hanging down, +X swings the end backward, -X forward.
def P0():
    return {b[0]: [0.0, 0.0, 0.0] for b in BONES}


def pose_idle(t):
    p = P0(); b = math.sin(t * 2 * math.pi)
    p['chest'][0] = 0.02 * b; p['head'][0] = -0.02 * b
    p['upperarm.L'][2] = -0.08; p['upperarm.R'][2] = 0.08
    p['forearm.L'][0] = -0.12; p['forearm.R'][0] = -0.12
    p['hips'][1] = 0.03 * math.sin(t * math.pi * 2)
    return p, {}


def pose_walk(t, run=False):
    p = P0(); ph = t * 2 * math.pi
    a = 0.8 if run else 0.48
    s1, c1 = math.sin(ph), math.cos(ph)
    p['thigh.L'][0] = -s1 * a; p['thigh.R'][0] = s1 * a
    p['shin.L'][0] = (max(0, -c1) * 1.25 + 0.08) * a * (1.6 if run else 1.2)
    p['shin.R'][0] = (max(0, c1) * 1.25 + 0.08) * a * (1.6 if run else 1.2)
    p['foot.L'][0] = max(0, s1) * 0.35 - max(0, -s1) * 0.3
    p['foot.R'][0] = max(0, -s1) * 0.35 - max(0, s1) * 0.3
    p['upperarm.L'][0] = s1 * a * 0.85; p['upperarm.R'][0] = -s1 * a * 0.85
    p['upperarm.L'][2] = -0.1; p['upperarm.R'][2] = 0.1
    p['forearm.L'][0] = -1.25 if run else -0.25 - max(0, -s1) * 0.3
    p['forearm.R'][0] = -1.25 if run else -0.25 - max(0, s1) * 0.3
    p['spine'][0] = 0.2 if run else 0.04
    p['hips'][1] = s1 * 0.07
    p['chest'][1] = -s1 * 0.1
    p['head'][0] = -0.08 if run else 0
    bob = (abs(s1) - 0.5) * (0.07 if run else 0.03)
    return p, {'root_up': bob}


def pose_turn(t):
    p, extra = pose_walk((t * 2) % 1.0)
    for k in ('thigh.L', 'thigh.R', 'shin.L', 'shin.R'):
        p[k][0] *= 0.4
    return p, {'root_rot': -math.pi / 2 * t, 'root_up': extra['root_up'] * 0.5}


def pose_look(t):
    p, _ = pose_idle(t)
    p['head'][1] = 0.9 * math.sin(t * 2 * math.pi)
    p['neck'][1] = 0.25 * math.sin(t * 2 * math.pi)
    return p, {}


def pose_sit(t):
    p, _ = pose_idle(t)
    for s in ('L', 'R'):
        p['thigh.' + s][0] = -1.5; p['shin.' + s][0] = 1.5
        p['upperarm.' + s][0] = -0.45; p['forearm.' + s][0] = -0.7
    return p, {'hips_z': -0.45}


def pose_interact(t):
    p, _ = pose_idle(t)
    k = math.sin(t * math.pi)
    p['upperarm.R'][0] = -1.1 * k; p['forearm.R'][0] = -0.4 * k; p['chest'][0] = 0.12 * k; p['head'][0] = 0.25 * k
    return p, {}


def pose_hug(t):
    p, _ = pose_idle(t)
    for s, sg in (('L', 1), ('R', -1)):
        p['upperarm.' + s][0] = -1.25; p['upperarm.' + s][2] = 0.45 * sg; p['forearm.' + s][0] = -0.95
    p['chest'][0] = 0.08; p['head'][0] = 0.12; p['head'][2] = 0.12
    p['spine'][2] = 0.03 * math.sin(t * 2 * math.pi)
    return p, {}


def pose_sleep(t):
    p, _ = pose_idle(t)
    p['upperarm.L'][2] = -0.15; p['upperarm.R'][2] = 0.15
    p['chest'][0] = 0.015 * math.sin(t * 2 * math.pi)
    return p, {'root_pitch': -math.pi / 2, 'root_up': 0.12}


def pose_firstmeet(t):
    # sharp head turn toward the door, a held look, then slowly back
    p, _ = pose_idle(t)
    k = min(1, t / 0.08) if t < 0.65 else max(0, 1 - (t - 0.65) / 0.35)
    p['head'][1] = 0.95 * k; p['neck'][1] = 0.2 * k; p['chest'][1] = 0.08 * k
    return p, {}


def pose_glance(t):
    p, _ = pose_idle(t)
    k = 0
    if 0.15 < t < 0.45:
        k = math.sin((t - 0.15) / 0.3 * math.pi)
    p['head'][1] = 0.6 * k; p['head'][0] = -0.05 * k
    return p, {}


def pose_family_walk(t):
    p, extra = pose_walk(t)
    # left hand holds a child's hand: arm slightly out and calm
    p['upperarm.L'][0] = 0.05; p['upperarm.L'][2] = -0.3; p['forearm.L'][0] = -0.15
    return p, extra


ANIMS = [
    ('idle', pose_idle, 48, True), ('walk', pose_walk, 24, True), ('run', lambda t: pose_walk(t, True), 16, True),
    ('turn', pose_turn, 32, False), ('look', pose_look, 72, True), ('sit', pose_sit, 48, True),
    ('interact', pose_interact, 30, False), ('hug', pose_hug, 48, True), ('sleep', pose_sleep, 72, True),
    ('first_meeting_head_turn', pose_firstmeet, 72, False), ('stolen_glance', pose_glance, 72, False),
    ('family_walk', pose_family_walk, 24, True),
]


# ------------------------------------------------------------------ Blender
def build_blender(parts, uvs_per_part, atlas_path, name='hero'):
    import bpy
    import bmesh
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 24
    # armature
    arm_data = bpy.data.armatures.new(name + '_rig')
    arm = bpy.data.objects.new(name + '_rig', arm_data)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for bname, head, tail, parent in BONES:
        eb = arm_data.edit_bones.new(bname)
        eb.head, eb.tail, eb.roll = head, tail, 0.0
        if parent:
            eb.parent = arm_data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    # mesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    groups = {}
    for part, uvs in zip(parts, uvs_per_part):
        verts = [bm.verts.new(v) for v in part.verts]
        for vi, v in enumerate(part.verts):
            bone = part.bone
            if part.bone_low and v[2] < part.split_z:
                bone = part.bone_low
            groups.setdefault(bone, []).append(verts[vi])
        for f, fuv in zip(part.faces, uvs):
            try:
                face = bm.faces.new([verts[i] for i in f])
            except ValueError:
                continue
            for loop, uv in zip(face.loops, fuv):
                loop[uv_layer].uv = uv
    bm.verts.index_update()
    group_idx = {b: [v.index for v in vs] for b, vs in groups.items()}
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = False  # flat shading, visible facets
    obj = bpy.data.objects.new(name, me)
    scene.collection.objects.link(obj)
    for b, idx in group_idx.items():
        vg = obj.vertex_groups.new(name=b)
        vg.add(idx, 1.0, 'REPLACE')
    obj.parent = arm
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    # material: one atlas, nearest filtering, matte
    mat = bpy.data.materials.new(name + '_mat')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    tex = nt.nodes.new('ShaderNodeTexImage')
    img = bpy.data.images.load(atlas_path)
    img.pack()
    tex.image = img
    tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.0
    mat.use_backface_culling = False
    obj.data.materials.append(mat)
    # animations (one action per clip, each on its own NLA track)
    arm.animation_data_create()
    bone_names = [b[0] for b in BONES]
    for clip, fn, frames, loop in ANIMS:
        action = bpy.data.actions.new(clip)
        arm.animation_data.action = action
        for fr in range(frames + 1):
            t = fr / frames
            pose, extra = fn(t)
            for bn in bone_names:
                pb = arm.pose.bones[bn]
                pb.rotation_mode = 'XYZ'
                pb.rotation_euler = pose[bn]
                pb.keyframe_insert('rotation_euler', frame=fr + 1)
            root = arm.pose.bones['root']
            root.location = (0, extra.get('root_up', 0), 0)  # root points up: its local Y is world up
            root.rotation_euler = (extra.get('root_pitch', 0), extra.get('root_rot', 0), 0)
            root.keyframe_insert('location', frame=fr + 1)
            root.keyframe_insert('rotation_euler', frame=fr + 1)
            hips = arm.pose.bones['hips']
            hips.location = (0, extra.get('hips_z', 0), 0)
            hips.keyframe_insert('location', frame=fr + 1)
        track = arm.animation_data.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, 1, action)
        strip.name = clip
        track.mute = True
        arm.animation_data.action = None
    # reset pose
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
    return arm, obj


def main():
    parts = build_parts()
    uvs = [compute_uvs(p) for p in parts]
    tris = tri_count(parts)
    print('hero triangles:', tris)
    atlas = paint_atlas('hero_neutral')
    atlas_path = os.path.join(OUT, 'hero_atlas.png')
    atlas.save(atlas_path)
    # expression / age variants of the atlas (the game swaps the face region)
    for expr in ('anxious', 'pain', 'tired', 'resolve'):
        paint_atlas('hero_' + expr).save(os.path.join(OUT, f'hero_atlas_{expr}.png'))
    for expr in ('neutral', 'anxious', 'pain', 'tired', 'resolve'):
        paint_atlas('hero_young_' + expr).save(os.path.join(OUT, f'hero_atlas_young_{expr}.png'))
    uv_layout_png(parts, uvs, os.path.join(OUT, 'hero_uv.png'))
    # UV overlay on the atlas (for review)
    over = atlas.resize((1024, 1024), Image.NEAREST)
    lay = Image.open(os.path.join(OUT, 'hero_uv.png'))
    Image.alpha_composite(over, lay).save(os.path.join(OUT, 'hero_uv_on_atlas.png'))
    import bpy
    build_blender(parts, uvs, atlas_path)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hero.blend'))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, 'hero.glb'), export_format='GLB',
        export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True,
        export_apply=False, export_texcoords=True, export_normals=True, export_materials='EXPORT')
    # copy what the browser viewer needs into public/ (served as /models/hero/...)
    import shutil
    pub = os.path.join(ROOT, 'public', 'models', 'hero')
    os.makedirs(pub, exist_ok=True)
    for fn in os.listdir(OUT):
        if fn.endswith('.glb') or fn.endswith('.png'):
            shutil.copy(os.path.join(OUT, fn), os.path.join(pub, fn))
    print('triangles', tris)
    print('done ->', OUT)


if __name__ == '__main__':
    main()
