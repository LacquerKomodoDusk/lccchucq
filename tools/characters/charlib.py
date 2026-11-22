"""
Low-poly PS1 character construction for Blender (bpy), reproducible from code.

Coordinates: Blender Z-up, the character faces -Y (glTF export turns that into +Z
forward / +Y up, which is what the game uses). Units are metres.

A character is built from *parts*. Every part:
  - is a small closed mesh (box, tapered box, cylinder, icosphere, sculpted head),
  - is bound rigidly to one bone (or two, top/bottom, for coat flaps),
  - owns a rectangle in the 256x256 texture atlas; its faces are box-projected
    into 6 sub-islands (+X, -X, +Y, -Y, +Z, -Z) inside that rectangle, with padding.
The head's front is projected planar into a large FACE island for the painted face.
"""
import math
import random

# ---------------------------------------------------------------- primitives

def _v(x, y, z):
    return [float(x), float(y), float(z)]


def box(center, size, taper=(1.0, 1.0), segs=(1, 1, 1), bevel=0.0):
    """Axis-aligned box; `taper` scales the top (+Z) face in x,y. segs subdivide x,y,z."""
    cx, cy, cz = center
    sx, sy, sz = size
    nx, ny, nz = segs
    verts, faces = [], []
    index = {}

    def vid(i, j, k):
        key = (i, j, k)
        if key in index:
            return index[key]
        u, v, w = i / nx, j / ny, k / nz
        t = taper[0] + (1 - taper[0]) * (1 - w), taper[1] + (1 - taper[1]) * (1 - w)
        x = (u - 0.5) * sx * t[0]
        y = (v - 0.5) * sy * t[1]
        z = (w - 0.5) * sz
        if bevel:
            # pull the vertical edges in a little so the box reads as rounded
            ex = abs(u - 0.5) * 2
            ey = abs(v - 0.5) * 2
            k2 = 1 - bevel * (ex * ey) ** 3
            x *= k2
            y *= k2
        index[key] = len(verts)
        verts.append(_v(cx + x, cy + y, cz + z))
        return index[key]

    # 6 faces as grids of quads (outward winding)
    for j in range(ny):
        for k in range(nz):
            faces.append([vid(0, j, k), vid(0, j, k + 1), vid(0, j + 1, k + 1), vid(0, j + 1, k)])        # -X
            faces.append([vid(nx, j, k), vid(nx, j + 1, k), vid(nx, j + 1, k + 1), vid(nx, j, k + 1)])   # +X
    for i in range(nx):
        for k in range(nz):
            faces.append([vid(i, 0, k), vid(i + 1, 0, k), vid(i + 1, 0, k + 1), vid(i, 0, k + 1)])        # -Y
            faces.append([vid(i, ny, k), vid(i, ny, k + 1), vid(i + 1, ny, k + 1), vid(i + 1, ny, k)])   # +Y
    for i in range(nx):
        for j in range(ny):
            faces.append([vid(i, j, 0), vid(i, j + 1, 0), vid(i + 1, j + 1, 0), vid(i + 1, j, 0)])        # -Z
            faces.append([vid(i, j, nz), vid(i + 1, j, nz), vid(i + 1, j + 1, nz), vid(i, j + 1, nz)])   # +Z
    return verts, faces


def cylinder(p0, p1, r0, r1, sides=6, caps=True, squash=(1.0, 1.0), rings=1):
    """Tapered cylinder between two points (mostly vertical limbs)."""
    ax = [p1[i] - p0[i] for i in range(3)]
    L = math.sqrt(sum(a * a for a in ax)) or 1.0
    d = [a / L for a in ax]
    # build an orthonormal frame
    up = [0, 0, 1] if abs(d[2]) < 0.9 else [1, 0, 0]
    u = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]
    ul = math.sqrt(sum(a * a for a in u)); u = [a / ul for a in u]
    w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]
    verts, faces = [], []
    for r in range(rings + 1):
        t = r / rings
        rad = r0 + (r1 - r0) * t
        c = [p0[i] + ax[i] * t for i in range(3)]
        for s in range(sides):
            a = 2 * math.pi * s / sides + math.pi / sides
            ca, sa = math.cos(a) * rad * squash[0], math.sin(a) * rad * squash[1]
            verts.append(_v(*[c[i] + u[i] * ca + w[i] * sa for i in range(3)]))
    for r in range(rings):
        for s in range(sides):
            a = r * sides + s
            b = r * sides + (s + 1) % sides
            faces.append([a, b, b + sides, a + sides])
    if caps:
        bottom = list(range(sides))[::-1]
        top = [rings * sides + s for s in range(sides)]
        faces.append(bottom)
        faces.append(top)
    return verts, faces


def icosphere(center, radius, scale=(1, 1, 1), jitter=0.0, seed=0):
    t = (1 + 5 ** 0.5) / 2
    vs = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
          (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    fs = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
          (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    rnd = random.Random(seed)
    verts = []
    for v in vs:
        l = math.sqrt(sum(a * a for a in v))
        j = 1 + (rnd.random() - 0.5) * jitter
        verts.append(_v(center[0] + v[0] / l * radius * scale[0] * j, center[1] + v[1] / l * radius * scale[1] * j,
                        center[2] + v[2] / l * radius * scale[2] * j))
    return verts, [list(f) for f in fs]


def uv_sphere(center, radius, scale=(1, 1, 1), seg=10, rings=8, top_only=False):
    verts, faces = [], []
    cx, cy, cz = center
    last = rings // 2 + 1 if top_only else rings
    verts.append(_v(cx, cy, cz + radius * scale[2]))
    for r in range(1, last):
        phi = math.pi * r / rings
        for s in range(seg):
            th = 2 * math.pi * s / seg
            verts.append(_v(cx + math.sin(phi) * math.cos(th) * radius * scale[0],
                            cy + math.sin(phi) * math.sin(th) * radius * scale[1],
                            cz + math.cos(phi) * radius * scale[2]))
    for s in range(seg):
        faces.append([0, 1 + s, 1 + (s + 1) % seg])
    for r in range(last - 2):
        for s in range(seg):
            a = 1 + r * seg + s
            b = 1 + r * seg + (s + 1) % seg
            faces.append([a, a + seg, b + seg, b][::-1])
    if not top_only:
        verts.append(_v(cx, cy, cz - radius * scale[2]))
        bi = len(verts) - 1
        base = 1 + (last - 2) * seg
        for s in range(seg):
            faces.append([bi, base + (s + 1) % seg, base + s])
    else:
        base = 1 + (last - 2) * seg
        faces.append([base + s for s in range(seg)][::-1])
    return verts, faces


def sculpted_head(base, w, h, d, female=False, kid=False, seg=12, rings=10):
    """Faceted skull: sphere pushed into brow ridge, sockets, cheekbones, jaw and chin.
    `base` is the bottom-centre (chin level) point. Faces -Y."""
    verts, faces = uv_sphere((0, 0, 0), 1.0, seg=seg, rings=rings)
    ax, ay, az = w / 2, d / 2, h / 2
    out = []
    for (nx, ny, nz) in verts:
        # here: ny<0 is the face (front), nz is up
        f = max(0.0, -ny)
        x, y, z = nx * ax, ny * ay, nz * az
        if ny < 0:
            y = y * (0.82 + 0.18 * (1 - f)) - ay * 0.14 * f
        x *= 0.96
        if nz < -0.15:
            t = (-nz - 0.15) / 0.85
            taper = 0.25 if kid else 0.48 if female else 0.40
            x *= 1 - t * taper
            if ny > 0:
                y *= 1 - t * 0.45
            else:
                y -= ay * 0.05 * t
        if kid and nz > 0:
            x *= 1.04
        if ny < -0.45 and 0.22 < nz < 0.45 and abs(nx) < 0.6:
            y -= ay * (0.03 if (female or kid) else 0.07)
        if ny < -0.45 and 0.02 < nz < 0.22 and 0.12 < abs(nx) < 0.55:
            y += ay * 0.06
        if ny < -0.15 and -0.3 < nz < 0.05 and abs(nx) > 0.45:
            x *= 1.05 if female else 1.07
        out.append(_v(base[0] + x, base[1] + y, base[2] + az + z))
    return out, faces


# ---------------------------------------------------------------- character assembly

class Part:
    def __init__(self, name, verts, faces, bone, rect, mode='box', bone_low=None, split_z=None):
        self.name, self.verts, self.faces, self.bone = name, verts, faces, bone
        self.rect = rect          # (x, y, w, h) in atlas pixels, y from top
        self.mode = mode          # 'box' | 'face' (planar front for the face)
        self.bone_low = bone_low  # second bone for vertices below split_z (coat flaps)
        self.split_z = split_z


ATLAS = 256


def sub_rects(rect, pad=2):
    """6 sub-islands inside a part rectangle: 3 columns x 2 rows."""
    x, y, w, h = rect
    cw, ch = w / 3, h / 2
    order = ['-Y', '+Y', '+X', '-X', '+Z', '-Z']
    out = {}
    for i, k in enumerate(order):
        cx, cy = x + (i % 3) * cw, y + (i // 3) * ch
        out[k] = (cx + pad, cy + pad, cw - 2 * pad, ch - 2 * pad)
    return out


def face_normal(vs):
    a, b, c = vs[0], vs[1], vs[2]
    u = [b[i] - a[i] for i in range(3)]
    v = [c[i] - a[i] for i in range(3)]
    n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    l = math.sqrt(sum(x * x for x in n)) or 1
    return [x / l for x in n]


def compute_uvs(part):
    """Return per-face list of per-corner UVs (0..1, v up as Blender expects)."""
    vs, fs = part.verts, part.faces
    xs = [v[0] for v in vs]; ys = [v[1] for v in vs]; zs = [v[2] for v in vs]
    mn = (min(xs), min(ys), min(zs)); mx = (max(xs), max(ys), max(zs))
    ext = [max(1e-6, mx[i] - mn[i]) for i in range(3)]
    ctr = [(mn[i] + mx[i]) / 2 for i in range(3)]
    subs = sub_rects(part.rect)
    out = []
    for f in fs:
        pts = [vs[i] for i in f]
        fc = [sum(p[i] for p in pts) / len(pts) for i in range(3)]
        if part.mode == 'face':
            # front third of the head -> planar projection onto the whole FACE island
            if fc[1] < ctr[1] - ext[1] * getattr(part, 'face_depth', 0.18) and abs(fc[0] - ctr[0]) < ext[0] * getattr(part, 'face_width', 0.42):
                rx, ry, rw, rh = part.rect
                uvs = []
                for p in pts:
                    u = (p[0] - mn[0]) / ext[0]
                    v = (p[2] - mn[2]) / ext[2]
                    px = rx + 1 + u * (rw - 2)
                    py = ry + 1 + (1 - v) * (rh - 2)
                    uvs.append((px / ATLAS, 1 - py / ATLAS))
                out.append(uvs)
                continue
            out.append(_box_uv(pts, fc, ctr, mn, ext, sub_rects(part.rect2)))
            continue
        out.append(_box_uv(pts, fc, ctr, mn, ext, subs))
    return out


def _box_uv(pts, fc, ctr, mn, ext, subs):
    n = face_normal(pts)
    off = [fc[i] - ctr[i] for i in range(3)]
    # dominant axis from the geometric normal, side from where the face sits on the part
    ai = max(range(3), key=lambda i: abs(n[i]))
    sign = off[ai] if abs(off[ai]) > 1e-6 else n[ai]
    key = ('+' if sign > 0 else '-') + 'XYZ'[ai]
    sx, sy, sw, sh = subs[key]
    if ai == 0:
        a, b = 1, 2
    elif ai == 1:
        a, b = 0, 2
    else:
        a, b = 0, 1
    uvs = []
    for p in pts:
        u = (p[a] - mn[a]) / ext[a]
        v = (p[b] - mn[b]) / ext[b]
        if key in ('-X', '+Y'):
            u = 1 - u
        px = sx + u * sw
        py = sy + (1 - v) * sh
        uvs.append((px / ATLAS, 1 - py / ATLAS))
    return uvs


def mirror_x(verts):
    return [[-v[0], v[1], v[2]] for v in verts]


def tri_count(parts):
    return sum(sum(len(f) - 2 for f in p.faces) for p in parts)
