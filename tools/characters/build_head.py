"""
Face production spec v1.0 — game heads (PS1 low-poly).

Builds one head: sculpted head mesh (300-600 tris without hair), separate hair,
beard + moustache, ears, nose and neck; a real seam-based UV unwrap with the face
as the priority 128x128 island inside a 256x256 atlas; 6 expressions as
swappable face textures; neck/head bones (same names and positions as the body
skeleton); head animations; exports head.glb, head.blend, face_atlas*.png,
face_uv.png.

usage: python tools/characters/build_head.py hero
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_hero as bh  # reuse: unwrap, projection painting, Blender build/export
from charlib import Part, box, cylinder, uv_sphere, sculpted_head, compute_uvs, tri_count, ATLAS
from PIL import Image, ImageDraw

ROOT = bh.ROOT
HEADS_SRC = os.path.join(ROOT, 'src', 'assets', 'heads')
EXPRS = ['neutral', 'surprise', 'anxiety', 'tired', 'sad', 'joy']

# atlas: the face is the priority island, 128x128 in the top-left corner
bh.R = {'FACE': (0, 0, 128, 128), 'HEAD': (128, 0, 64, 64)}

# bones: the head part of the body skeleton (same names / positions)
HEAD_BONES = [
    ('root', (0, 0, 0), (0, 0, 0.15), None),
    ('hips', (0, 0, 0.93), (0, 0, 1.03), 'root'),
    ('spine', (0, 0, 1.03), (0, 0, 1.22), 'hips'),
    ('chest', (0, 0, 1.22), (0, 0, 1.45), 'spine'),
    ('neck', (0, 0, 1.45), (0, 0, 1.55), 'chest'),
    ('head', (0, 0, 1.55), (0, 0, 1.82), 'neck'),
]
bh.BONES = HEAD_BONES


def P0():
    return {b[0]: [0.0, 0.0, 0.0] for b in HEAD_BONES}


def a_idle(t):
    p = P0(); s = math.sin(t * 2 * math.pi)
    p['head'][0] = -0.03 * s; p['neck'][1] = 0.03 * math.sin(t * math.pi * 2 + 1)
    return p, {}


def a_head_turn_bus(t):
    """the sharp turn toward the door in the bus: snap (0.1 s), hold, slowly back"""
    p = P0()
    if t < 0.06:
        k = t / 0.06
        k = 1 - (1 - k) ** 3
    elif t < 0.62:
        k = 1 + 0.04 * math.sin((t - 0.06) * 40) * math.exp(-(t - 0.06) * 14)   # tiny overshoot settle
    else:
        k = max(0.0, 1 - (t - 0.62) / 0.38)
        k = k * k * (3 - 2 * k)
    p['head'][2] = 0.95 * k; p['neck'][2] = 0.22 * k
    p['head'][0] = -0.04 * k
    return p, {}


def a_glance(t):
    """a stolen glance: look, hold for a moment, quickly look away"""
    p = P0()
    if t < 0.15:
        k = t / 0.15
    elif t < 0.45:
        k = 1
    elif t < 0.52:
        k = 1 - (t - 0.45) / 0.07
    else:
        k = 0
    p['head'][2] = 0.6 * k; p['head'][0] = 0.06 * k
    return p, {}


def a_look_around(t):
    p = P0()
    p['head'][2] = 0.8 * math.sin(t * 2 * math.pi)
    p['neck'][2] = 0.2 * math.sin(t * 2 * math.pi)
    p['head'][0] = 0.08 * math.sin(t * 4 * math.pi)
    return p, {}


def a_nod(t):
    p = P0(); p['head'][0] = 0.22 * max(0, math.sin(t * 4 * math.pi))
    return p, {}


# head bones point up (+Z): local Y is up, so a turn left/right is rotation around local Y.
# build_hero keys rotation_euler XYZ; we keep (x, y, z) = (pitch, yaw, roll) in bone space.
def _yaw_fix(fn):
    def g(t):
        p, e = fn(t)
        for b in p:
            x, y, z = p[b]
            p[b] = [x, z, y]   # our helper used [2] for yaw; bone-local yaw is Y
        return p, e
    return g


bh.ANIMS = [
    ('idle', _yaw_fix(a_idle), 72, True),
    ('head_turn_bus', _yaw_fix(a_head_turn_bus), 60, False),
    ('stolen_glance', _yaw_fix(a_glance), 72, False),
    ('look_around', _yaw_fix(a_look_around), 96, True),
    ('nod', _yaw_fix(a_nod), 36, False),
]


# ------------------------------------------------------------------ hero head geometry
def hero_parts():
    P = []
    base = (0, 0, 1.555)
    W, H, D = 0.205, 0.255, 0.235
    hv, hf = sculpted_head(base, W, H, D, seg=16, rings=12)
    head = Part('head', hv, hf, 'head', bh.R['FACE'], mode='face'); head.rect2 = bh.R['HEAD']
    head.face_depth, head.face_width = 0.24, 0.34
    P.append(head)
    # nose: a faceted wedge (bridge to tip)
    v, f = box((0, -0.12, 1.7), (0.024, 0.026, 0.05), taper=(0.45, 0.3), segs=(1, 1, 1))
    P.append(Part('nose', v, f, 'head', bh.R['HEAD']))
    # ears
    for sx in (1, -1):
        v, f = box((sx * 0.1, 0.018, 1.695), (0.018, 0.04, 0.058), taper=(0.8, 0.8), bevel=0.3)
        P.append(Part('ear.' + ('L' if sx > 0 else 'R'), v, f, 'head', bh.R['HEAD']))
    # neck
    v, f = cylinder((0, 0.012, 1.44), (0, 0.006, 1.6), 0.055, 0.058, sides=8)
    P.append(Part('neck', v, f, 'neck', bh.R['HEAD']))
    # voluminous curly hair: one connected lumpy mass, hairline above the brows
    v, f = uv_sphere((0, 0.018, 1.728), 0.124, scale=(1.0, 1.06, 0.9), seg=16, rings=10, top_only=True)
    rnd = random.Random(7)
    hair = []
    for (x, y, z) in v:
        dx, dy, dz = x, y - 0.018, z - 1.728
        k = 1 + (rnd.random() - 0.3) * 0.3
        lift = 0.0
        if dy < -0.04:
            k = min(k, 1.04)
            lift = 0.045 * min(1.0, (-dy - 0.04) / 0.06)   # hairline up at the forehead
        rim = max(0.0, 1 - dz / 0.05)
        kr = k * (1 - 0.2 * rim) * 0.96
        hair.append([dx * kr, 0.018 + dy * kr, 1.728 + dz * k + lift])
    P.append(Part('hair', hair, f, 'head', bh.R['HEAD']))
    # back hair down to the nape
    v, f = box((0, 0.088, 1.69), (0.19, 0.05, 0.15), taper=(1.0, 1.0), segs=(2, 1, 2), bevel=0.4)
    rnd2 = random.Random(3)
    v = [[x * (1 + (rnd2.random() - 0.5) * 0.12), y + (rnd2.random() - 0.3) * 0.012, z] for x, y, z in v]
    P.append(Part('hair_back', v, f, 'head', bh.R['HEAD']))
    # thick beard: a shell around jaw and cheeks, the mouth stays open
    # the face texture already carries the beard on the front; the shell only gives
    # the jaw, chin and sideburns their volume in silhouette
    sv, sf = sculpted_head((0, 0.003, 1.549), W * 1.07, H * 1.03, D * 1.06, seg=16, rings=12)
    keep = []
    for q in sf:
        cx = sum(sv[i][0] for i in q) / len(q); cy = sum(sv[i][1] for i in q) / len(q); cz = sum(sv[i][2] for i in q) / len(q)
        chin = cz < 1.615
        jaw = cz < 1.66 and abs(cx) > 0.055
        side = abs(cx) > 0.085 and cz < 1.695 and cy < 0.04
        if chin or jaw or side:
            keep.append(q)
    P.append(Part('beard', sv, keep, 'head', bh.R['HEAD']))
    return P


class HeadPainter:
    """paints everything except the face island, sampling the face texture's own palette"""
    def __init__(self, face_img):
        f = face_img.convert('RGBA')
        hair = Image.new('RGBA', (64, 32))
        hair = Image.new('RGBA', (48, 24))
        hair.paste(f.crop((3, 3, 27, 27)), (0, 0)); hair.paste(f.crop((101, 3, 125, 27)), (24, 0))
        self.hair = self._tile(hair)
        self.beard = self._tile(f.crop((16, 98, 112, 124)))
        px = f.load()
        cs = [px[x, y] for y in range(28, 34) for x in range(56, 72)]
        self.skin = tuple(sum(c[i] for c in cs) // len(cs) for i in range(3)) + (255,)

    @staticmethod
    def _tile(src):
        img = Image.new('RGBA', (ATLAS, ATLAS))
        for yy in range(0, ATLAS, src.height):
            for xx in range(0, ATLAS, src.width):
                img.paste(src, (xx, yy))
        return img.load()

    def k(self, c, f):
        return (max(0, min(255, int(c[0] * f))), max(0, min(255, int(c[1] * f))), max(0, min(255, int(c[2] * f))), 255)

    def __call__(self, name, p, n, px, py):
        x, y, z = p
        jitter = 0.97 + ((px * 7 + py * 13) % 7) / 100
        if name in ('hair', 'hair_back'):
            return self.hair[px, py]
        if name in ('beard', 'moustache'):
            return self.beard[px, py]
        if name.startswith('ear'):
            inner = abs(z - 1.695) < 0.016 and abs(y - 0.018) < 0.012 and abs(x) > 0.105
            return self.k(self.skin, (0.62 if inner else 0.8) * jitter)
        if name == 'nose':
            return self.k(self.skin, (0.86 if n[2] < -0.3 else 1.0) * jitter)
        if name == 'neck':
            return self.k(self.skin, (0.78 if z > 1.53 else 0.88) * jitter)
        if name == 'head':
            if z > 1.74 or y > 0.03:
                return self.hair[px, py]
            if abs(x) > 0.065 and y > -0.07:          # temples / sideburns
                return self.hair[px, py] if z > 1.705 else self.beard[px, py]
            if z < 1.69:
                return self.beard[px, py]
            return self.k(self.skin, 0.9 * jitter)
        return (255, 0, 255, 255)


def main(char='hero'):
    import bpy
    out = os.path.join(ROOT, 'assets', 'heads', char)
    os.makedirs(out, exist_ok=True)
    parts = hero_parts()
    uvs = [compute_uvs(p) for p in parts]
    head_tris = tri_count([p for p in parts if p.name in ('head', 'nose', 'ear.L', 'ear.R', 'neck')])
    print('head triangles (without hair/beard):', head_tris, ' total:', tri_count(parts))
    atlas_path = os.path.join(out, 'face_atlas.png')
    Image.new('RGBA', (ATLAS, ATLAS), (128, 128, 128, 255)).save(atlas_path)
    arm, obj = bh.build_blender(parts, uvs, atlas_path, name=char + '_head')
    faces = bh.read_faces(obj, parts)
    for e in EXPRS:
        face_path = os.path.join(HEADS_SRC, f'{char}_face_{e}.png')
        img = bh.paint_projected(faces, HeadPainter(Image.open(face_path)), face_path)
        img.save(atlas_path if e == 'neutral' else os.path.join(out, f'face_atlas_{e}.png'))
    bh.uv_layout_from_faces(faces, os.path.join(out, 'face_uv.png'))
    over = Image.open(atlas_path).convert('RGBA').resize((1024, 1024), Image.NEAREST)
    Image.alpha_composite(over, Image.open(os.path.join(out, 'face_uv.png'))).save(os.path.join(out, 'face_uv_on_atlas.png'))
    bh.apply_material(obj, atlas_path, name=char + '_head')
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
    main(sys.argv[1] if len(sys.argv) > 1 else 'hero')
