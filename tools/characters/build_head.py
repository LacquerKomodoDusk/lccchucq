"""
Face production spec v1.0 — game heads for all four characters (PS1 low-poly).

For each character: a sculpted head (300-600 tris without hair), separate hair,
beard (hero), removable knitted hat (wife, younger son), nose ring (wife), short
neck with a collar; a real seam-based UV unwrap with the face as the priority
128x128 island inside a 256x256 atlas (face texture pinned to the geometry by
landmarks: eye line and chin); 6 expressions (+ wife: look left/right) as
swappable face textures; neck/head bones matching the body skeleton; head
animations. Exports head.glb, head.blend, face_atlas*.png, face_uv.png.

usage: python tools/characters/build_head.py [hero wife son_older son_younger]
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_hero as bh  # reuse: unwrap, projection painting, Blender build/export
from charlib import Part, box, cylinder, icosphere, uv_sphere, sculpted_head, compute_uvs, tri_count, ATLAS
from PIL import Image

ROOT = bh.ROOT
HEADS_SRC = os.path.join(ROOT, 'src', 'assets', 'heads')
EXPRS = ['neutral', 'surprise', 'anxiety', 'tired', 'sad', 'joy']
bh.R = {'FACE': (0, 0, 128, 128), 'HEAD': (128, 0, 64, 64)}

# ------------------------------------------------------------------ per-character setup
# base: chin height (the head sits on the body skeleton at this height)
# W/H/D: head size, jaw: jaw taper (low = square), texture landmarks: eye_y / chin_y
# (fractions from the top of the 128 texture) and face_w (cheek-to-cheek width fraction)
CHARS = {
    'hero': dict(base=1.555, W=0.215, H=0.255, D=0.235, jaw=0.2, female=False, kid=False,
                 eye_y=0.37, chin_y=0.9, face_w=0.84, hair_front=0.78, hair_side=0.34, hair_back=0.0,
                 hair_scale=1.16, hair_jitter=0.3, fringe=True, beard=True, hat=None, ring=False,
                 hair_box=(4, 4, 30, 24), collar=(112, 108, 104)),
    'wife': dict(base=1.44, W=0.19, H=0.24, D=0.22, jaw=0.46, female=True, kid=False,
                 eye_y=0.355, chin_y=0.66, face_w=0.5, hair_front=0.86, hair_side=0.3, hair_back=-0.1,
                 hair_scale=1.1, hair_jitter=0.12, fringe=False, beard=False, hat=('red', 1.17), ring=True,
                 hair_box=(6, 64, 24, 110), hair_gain=1.7, collar=(118, 40, 36), long_hair=0.5),
    'son_older': dict(base=0.97, W=0.2, H=0.225, D=0.21, jaw=0.3, female=False, kid=True,
                      eye_y=0.385, chin_y=0.66, face_w=0.68, hair_front=0.8, hair_side=0.38, hair_back=0.05,
                      hair_scale=1.17, hair_jitter=0.34, fringe=True, beard=False, hat=None, ring=False,
                      hair_box=(4, 4, 30, 22), collar=(176, 132, 52)),
    'son_younger': dict(base=0.82, W=0.2, H=0.215, D=0.205, jaw=0.26, female=False, kid=True,
                        eye_y=0.43, chin_y=0.7, face_w=0.74, hair_front=0.78, hair_side=0.36, hair_back=0.05,
                        hair_scale=1.15, hair_jitter=0.3, fringe=False, beard=False, hat=('blue', 1.16), ring=False,
                        hair_box=(8, 40, 28, 60), collar=(206, 190, 160)),
}


# the face textures are normalised to one pixel density (see face_expressions.py):
# move the texture landmarks with them
import face_expressions as fe
for _k, _c in CHARS.items():
    _n = max(8, round(128 * fe.SCALE[_k] / fe.GRID) * fe.GRID) / 128
    _c['eye_y'] = 0.5 + (_c['eye_y'] - 0.5) * _n
    _c['chin_y'] = 0.5 + (_c['chin_y'] - 0.5) * _n
    _c['face_w'] = _c['face_w'] * _n
    _c['hair_box'] = fe.map_box(_c['hair_box'], _n)


def bones_for(c):
    s = c['base'] / 1.555
    def z(v): return v * s
    return [
        ('root', (0, 0, 0), (0, 0, z(0.15)), None),
        ('hips', (0, 0, z(0.93)), (0, 0, z(1.03)), 'root'),
        ('spine', (0, 0, z(1.03)), (0, 0, z(1.22)), 'hips'),
        ('chest', (0, 0, z(1.22)), (0, 0, c['base'] - 0.1), 'spine'),
        ('neck', (0, 0, c['base'] - 0.1), (0, 0, c['base']), 'chest'),
        ('head', (0, 0, c['base']), (0, 0, c['base'] + c['H']), 'neck'),
    ]


# ------------------------------------------------------------------ animations (pitch, yaw, roll)
def mk(fn):
    def g(t):
        p = {b[0]: [0.0, 0.0, 0.0] for b in bh.BONES}
        fn(p, t)
        return p, {}
    return g


def a_idle(p, t):
    s = math.sin(t * 2 * math.pi)
    p['head'][0] = -0.03 * s; p['neck'][1] = 0.03 * math.sin(t * 2 * math.pi + 1)


def a_head_turn_bus(p, t):
    if t < 0.06:
        k = 1 - (1 - t / 0.06) ** 3
    elif t < 0.62:
        k = 1 + 0.04 * math.sin((t - 0.06) * 40) * math.exp(-(t - 0.06) * 14)
    else:
        k = max(0.0, 1 - (t - 0.62) / 0.38); k = k * k * (3 - 2 * k)
    p['head'][1] = 0.95 * k; p['neck'][1] = 0.22 * k; p['head'][0] = -0.04 * k


def a_glance(p, t):
    k = t / 0.15 if t < 0.15 else 1 if t < 0.45 else max(0, 1 - (t - 0.45) / 0.07)
    p['head'][1] = 0.6 * k; p['head'][0] = 0.06 * k


def a_glance_away(p, t):
    """wife: meets the eyes, then quickly looks away and down"""
    k = 0 if t < 0.3 else min(1, (t - 0.3) / 0.06) if t < 0.85 else max(0, 1 - (t - 0.85) / 0.15)
    p['head'][1] = -0.55 * k; p['head'][0] = 0.18 * k; p['neck'][1] = -0.12 * k


def a_look_around(p, t):
    p['head'][1] = 0.8 * math.sin(t * 2 * math.pi); p['neck'][1] = 0.2 * math.sin(t * 2 * math.pi)
    p['head'][0] = 0.08 * math.sin(t * 4 * math.pi)


def a_nod(p, t):
    p['head'][0] = 0.22 * max(0, math.sin(t * 4 * math.pi))


ANIMS = {
    'hero': [('idle', a_idle, 72), ('head_turn_bus', a_head_turn_bus, 60), ('stolen_glance', a_glance, 72), ('look_around', a_look_around, 96), ('nod', a_nod, 36)],
    'wife': [('idle', a_idle, 72), ('glance_away', a_glance_away, 60), ('stolen_glance', a_glance, 72), ('look_around', a_look_around, 96), ('nod', a_nod, 36)],
}
ANIMS['son_older'] = ANIMS['son_younger'] = [('idle', a_idle, 72), ('look_around', a_look_around, 96), ('nod', a_nod, 36)]


# ------------------------------------------------------------------ geometry
def head_center(c):
    return (0, 0.0, c['base'] + c['H'] / 2)


def hair_shell(c, name, scale, rnd, cut):
    """hair cut out of a lumpy shell around the head: kept where the face-to-back cut
    allows (high at the forehead, down to the ears at the sides, nape at the back)"""
    cx, cy, cz = head_center(c)
    v, f = uv_sphere((0, 0, 0), 1.0, seg=18, rings=12)
    W, H, D = c['W'], c['H'], c['D']
    verts = []
    for (x, y, z) in v:
        k = 1 + (rnd.random() - 0.35) * c['hair_jitter'] * 0.6
        verts.append([cx + x * W / 2 * scale * k, cy + y * D / 2 * scale * k + 0.008, cz + z * H / 2 * scale * k])
    keep = []
    for q in f:
        mx = sum(verts[i][0] for i in q) / len(q); my = sum(verts[i][1] for i in q) / len(q); mz = sum(verts[i][2] for i in q) / len(q)
        ang = math.atan2(mx, -(my - cy))           # 0 = front, pi = back
        if mz > cut(abs(ang)):
            keep.append(q)
    return Part(name, verts, keep, 'head', bh.R['HEAD'])


def head_parts(char):
    c = CHARS[char]
    rnd = random.Random(hash(char) % 1000)
    P = []
    base, W, H, D = c['base'], c['W'], c['H'], c['D']
    hv, hf = sculpted_head((0, 0, base), W, H, D, female=c['female'], kid=c['kid'], seg=16, rings=12, jaw=c['jaw'])
    head = Part('head', hv, hf, 'head', bh.R['FACE'], mode='face'); head.rect2 = bh.R['HEAD']
    head.face_depth, head.face_width = 0.22, 0.4
    head.face_map = dict(eye_y=c['eye_y'], chin_y=c['chin_y'], face_w=c['face_w'], half_w=W / 2 * 0.96,
                         z_eye=base + H * 0.56, z_chin=base)
    P.append(head)
    # nose: part of the face silhouette, kept small; the texture draws the details
    ns = 0.7 if c['kid'] else 0.85 if c['female'] else 1.0
    v, f = box((0, -D / 2 - 0.004 * ns, base + H * 0.47), (0.022 * ns, 0.022 * ns, 0.046 * ns), taper=(0.45, 0.25))
    P.append(Part('nose', v, f, 'head', bh.R['HEAD']))
    # short neck + collar
    v, f = cylinder((0, 0.012, base - 0.07), (0, 0.006, base + 0.05), 0.05 * (0.85 if c['kid'] else 1), 0.054 * (0.85 if c['kid'] else 1), sides=8)
    P.append(Part('neck', v, f, 'neck', bh.R['HEAD']))
    r = 0.105 if not c['kid'] else 0.085
    v, f = cylinder((0, 0.012, base - 0.085), (0, 0.012, base - 0.02), r * 1.08, r * 0.82, sides=8, caps=False)
    P.append(Part('collar', v, f, 'neck', bh.R['HEAD']))
    # hair
    hf_, hs_, hb_ = c['hair_front'], c['hair_side'], c['hair_back']

    def cut(a):
        # fraction of H above the chin: front (a=0) -> temple (a~1.1) -> back (a=pi)
        if a < 0.9:
            t = hf_
        elif a < 1.5:
            t = hf_ + (hs_ - hf_) * (a - 0.9) / 0.6
        else:
            t = hs_ + (hb_ - hs_) * (a - 1.5) / (math.pi - 1.5)
        return base + t * H
    P.append(hair_shell(c, 'hair', c['hair_scale'], rnd, cut))
    if c['fringe']:
        # a lock falling onto the forehead, to one side (like the sheet)
        v, f = icosphere((-0.035, -D / 2 - 0.004, base + H * 0.86), 0.06, scale=(1.3, 0.55, 0.62), jitter=0.3, seed=3)
        P.append(Part('fringe', v, f, 'head', bh.R['HEAD']))
    if c.get('long_hair'):
        # long wavy hair down the back and two strands over the shoulders
        L = c['long_hair']
        v, f = box((0, D / 2 - 0.012, base + H * 0.55 - L / 2 + 0.06), (W * 1.12, 0.05, L), taper=(1.1, 1.0), segs=(4, 1, 6))
        v = [[x + math.sin(z * 40) * 0.006, y + math.cos(z * 30 + x * 50) * 0.008, z] for x, y, z in v]
        P.append(Part('hair_long', v, f, 'head', bh.R['HEAD']))
        for sx in (1, -1):
            v, f = box((sx * (W / 2 + 0.004), -0.01, base + H * 0.5 - L * 0.3), (0.035, 0.06, L * 0.62), taper=(1.0, 1.2), segs=(1, 1, 4))
            v = [[x + math.sin(z * 45) * 0.006, y, z] for x, y, z in v]
            P.append(Part('strand.' + ('L' if sx > 0 else 'R'), v, f, 'head', bh.R['HEAD']))
    # beard: a thin shell only along the jaw and chin (the texture draws moustache and goatee)
    if c['beard']:
        sv, sf = sculpted_head((0, 0.002, base - 0.004), W * 1.05, H * 1.02, D * 1.05, seg=16, rings=12, jaw=c['jaw'])
        keep = []
        for q in sf:
            cx = sum(sv[i][0] for i in q) / len(q); cy = sum(sv[i][1] for i in q) / len(q); cz = sum(sv[i][2] for i in q) / len(q)
            jawline = cz < base + H * 0.2 and cy < 0.06
            jawside = abs(cx) > W * 0.36 and cz < base + H * 0.36 and -0.06 < cy < 0.05
            if jawline or jawside:
                keep.append(q)
        P.append(Part('beard', sv, keep, 'head', bh.R['HEAD']))
    # knitted beanie (separate removable object)
    if c['hat']:
        sc = c['hat'][1]
        cx, cy, cz = head_center(c)
        brim0, brim1 = base + H * 0.72, base + H * 0.86          # folded brim, just above the brows
        dome_c = brim1 - 0.005
        v, f = uv_sphere((0, 0, 0), 1.0, seg=16, rings=10, top_only=True)
        dv = []
        for x, y, z in v:
            X, Y, Z = x * W / 2 * sc * 1.02, y * D / 2 * sc * 1.06 + 0.01, z * H * 0.46 * sc
            Y += max(0.0, y) * Z * 0.25              # slouch: the top leans back a little
            dv.append([X, cy + Y, dome_c + Z])
        P.append(Part('hat', dv, f, 'head', bh.R['HEAD']))
        v, f = cylinder((0, cy + 0.01, brim0), (0, cy + 0.01, brim1), W / 2 * sc * 1.06, W / 2 * sc * 1.04, sides=16, caps=False)
        P.append(Part('hat_brim', v, f, 'head', bh.R['HEAD']))
    # nose ring (septum)
    if c['ring']:
        rv, rf = [], []
        rc = (0, -D / 2 - 0.016, base + H * 0.385)
        for i in range(6):
            a0, a1 = 2 * math.pi * i / 6, 2 * math.pi * (i + 1) / 6
            p0 = (rc[0] + math.cos(a0) * 0.007, rc[1], rc[2] + math.sin(a0) * 0.007 - 0.004)
            p1 = (rc[0] + math.cos(a1) * 0.007, rc[1], rc[2] + math.sin(a1) * 0.007 - 0.004)
            v, f = cylinder(p0, p1, 0.0018, 0.0018, sides=4)
            rf += [[i_ + len(rv) for i_ in q] for q in f]; rv += v
        P.append(Part('ring', rv, rf, 'head', bh.R['HEAD']))
    return P


# ------------------------------------------------------------------ painting
class HeadPainter:
    def __init__(self, char, face_img):
        self.c = CHARS[char]
        f = face_img.convert('RGBA')
        hb = f.crop(self.c['hair_box'])
        g = self.c.get('hair_gain', 1.0)
        if g != 1.0:
            hb = hb.point(lambda v: min(255, int(v * g)))
        self.hair = self._tile(hb)
        if self.c['beard']:
            self.beard = self._tile(f.crop(fe.map_box((24, 104, 104, 120), max(8, round(128 * fe.SCALE['hero'] / fe.GRID) * fe.GRID) / 128)))
        if self.c['hat']:
            self.knit = self._knit((150, 44, 38) if self.c['hat'][0] == 'red' else (96, 98, 126))
        px = f.load()
        x0, y0 = 56, int(self.c['eye_y'] * 128) - 14
        cs = [px[x, y] for y in range(y0, y0 + 5) for x in range(x0, x0 + 16)]
        self.skin = tuple(sum(q[i] for q in cs) // len(cs) for i in range(3)) + (255,)

    @staticmethod
    def _tile(src):
        img = Image.new('RGBA', (ATLAS, ATLAS))
        for yy in range(0, ATLAS, src.height):
            for xx in range(0, ATLAS, src.width):
                img.paste(src, (xx, yy))
        return img.load()

    @staticmethod
    def _knit(col):
        img = Image.new('RGBA', (16, 16))          # chunky knit: big V stitches like the sheet
        p = img.load()
        for y in range(16):
            for x in range(16):
                v = 1.12 if ((x % 8 < 4) != (y % 4 < 2)) else 0.8
                if y % 8 >= 6:
                    v *= 0.85
                p[x, y] = tuple(min(255, int(c * v)) for c in col) + (255,)
        return HeadPainter._tile(img)

    @staticmethod
    def k(c, f):
        return (max(0, min(255, int(c[0] * f))), max(0, min(255, int(c[1] * f))), max(0, min(255, int(c[2] * f))), 255)

    def __call__(self, name, p, n, px, py):
        c = self.c
        x, y, z = p
        jitter = 0.97 + ((px * 7 + py * 13) % 7) / 100
        top = c['base'] + c['H']
        if name in ('hair', 'fringe', 'hair_long') or name.startswith('strand'):
            return self.hair[px, py]
        if name == 'beard':
            return self.beard[px, py]
        if name in ('hat', 'hat_brim'):
            return self.k(self.knit[px, py], 0.85 if name == 'hat_brim' and py % 3 == 0 else 1)
        if name == 'ring':
            return (214, 206, 190, 255)
        if name == 'collar':
            return self.k(c['collar'] + (255,), jitter * (0.85 if z < c['base'] - 0.07 else 1))
        if name == 'nose':
            return self.k(self.skin, (0.82 if n[2] < -0.3 else 0.97) * jitter)
        if name == 'neck':
            return self.k(self.skin, (0.72 if z > c['base'] - 0.01 else 0.84) * jitter)
        if name == 'head':
            if y > 0.02 or z > c['base'] + c['H'] * 0.82:
                return self.hair[px, py]
            if c['beard'] and z < c['base'] + c['H'] * 0.38:
                return self.beard[px, py]
            return self.k(self.skin, (0.9 if abs(x) > c['W'] * 0.42 else 0.97) * jitter)
        return (255, 0, 255, 255)


# ------------------------------------------------------------------ build
def main(char):
    import bpy
    c = CHARS[char]
    bh.BONES = bones_for(c)
    bh.ANIMS = [(n, mk(fn), fr, True) for n, fn, fr in ANIMS[char]]
    out = os.path.join(ROOT, 'assets', 'heads', char)
    os.makedirs(out, exist_ok=True)
    parts = head_parts(char)
    uvs = [compute_uvs(p) for p in parts]
    core = tri_count([p for p in parts if p.name in ('head', 'nose', 'neck')])
    print(f'{char}: head {core} tris without hair/beard/hat, total {tri_count(parts)}')
    atlas_path = os.path.join(out, 'face_atlas.png')
    Image.new('RGBA', (ATLAS, ATLAS), (128, 128, 128, 255)).save(atlas_path)
    arm, obj = bh.build_blender(parts, uvs, atlas_path, name=char + '_head')
    faces = bh.read_faces(obj, parts)
    variants = EXPRS + (['look_left', 'look_right'] if char == 'wife' else [])
    for e in variants:
        fp = os.path.join(HEADS_SRC, f'{char}_face_{e}.png')
        img = bh.paint_projected(faces, HeadPainter(char, Image.open(fp)), fp)
        img.save(atlas_path if e == 'neutral' else os.path.join(out, f'face_atlas_{e}.png'))
    bh.uv_layout_from_faces(faces, os.path.join(out, 'face_uv.png'))
    over = Image.open(atlas_path).convert('RGBA').resize((1024, 1024), Image.NEAREST)
    Image.alpha_composite(over, Image.open(os.path.join(out, 'face_uv.png'))).save(os.path.join(out, 'face_uv_on_atlas.png'))
    bh.apply_material(obj, atlas_path, name=char + '_head')
    # the hat is a separate, removable object
    if c['hat']:
        hat_idx = {i for i, p in enumerate(parts) if p.name.startswith('hat')}
        import bmesh
        bpy.context.view_layer.objects.active = obj
        for o in bpy.context.scene.objects:
            o.select_set(o == obj)
        bpy.ops.object.mode_set(mode='EDIT')
        bm = bmesh.from_edit_mesh(obj.data)
        pl = bm.faces.layers.int.get('part')
        for f in bm.faces:
            f.select = f[pl] in hat_idx
        bmesh.update_edit_mesh(obj.data)
        bpy.ops.mesh.separate(type='SELECTED')
        bpy.ops.object.mode_set(mode='OBJECT')
        for o in bpy.context.scene.objects:
            if o.type == 'MESH' and o != obj:
                o.name = char + '_hat'
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'head.blend'))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out, 'head.glb'), export_format='GLB',
        export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True,
        export_apply=False, export_texcoords=True, export_normals=True, export_materials='EXPORT')
    b1 = os.path.join(out, 'head.blend1')
    if os.path.exists(b1):
        os.remove(b1)
    import shutil
    pub = os.path.join(ROOT, 'public', 'heads', char)
    os.makedirs(pub, exist_ok=True)
    for fn in os.listdir(out):
        if fn.endswith('.glb') or fn.endswith('.png'):
            shutil.copy(os.path.join(out, fn), os.path.join(pub, fn))
    print('done ->', out)


if __name__ == '__main__':
    for ch in (sys.argv[1:] or list(CHARS)):
        main(ch)
