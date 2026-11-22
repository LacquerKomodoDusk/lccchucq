// Low-poly environment kit. Every helper adds meshes to game.scene and, where
// solid, registers colliders.
import * as THREE from 'three';
import { ps1Material } from '../engine/ps1.js';
import * as T from '../engine/textures.js';

export const M = (o) => ps1Material(o);

// large polygons wobble and "sink" with PS1 vertex snapping, so big surfaces are tessellated
const seg = (v) => Math.max(1, Math.min(24, Math.ceil(v / 1.2)));
export function box(g, w, h, d, mat, x = 0, y = 0, z = 0, { solid = false, pad = 0, rotY = 0, parent = null } = {}) {
  const big = w > 2.5 || h > 2.5 || d > 2.5;
  const mesh = new THREE.Mesh(big ? new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)) : new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = rotY;
  (parent || g.scene).add(mesh);
  if (solid) {
    if (rotY === 0 || Math.abs(Math.abs(rotY) - Math.PI) < 0.01) g.collider(x - w / 2 - pad, x + w / 2 + pad, z - d / 2 - pad, z + d / 2 + pad);
    else if (Math.abs(Math.abs(rotY) - Math.PI / 2) < 0.01) g.collider(x - d / 2 - pad, x + d / 2 + pad, z - w / 2 - pad, z + w / 2 + pad);
    else g.colliderFromMesh(mesh, pad);
  }
  return mesh;
}

export function plane(g, w, d, mat, x = 0, y = 0, z = 0, rotX = -Math.PI / 2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, Math.min(48, seg(w)), Math.min(160, seg(d))), mat);
  m.rotation.x = rotX; m.position.set(x, y, z);
  g.scene.add(m);
  return m;
}

/** Rectangular room centred on (cx, cz). openings: [{wall:'n'|'s'|'e'|'w', at, width}] */
export function room(g, { cx = 0, cz = 0, w = 6, d = 6, h = 2.7, floor, wall, ceil, openings = [], thickness = 0.15 }) {
  const skirting = M({ map: T.woodTex([2, 1], '#3e2e22') });
  const fl = plane(g, w, d, floor, cx, 0, cz);
  if (ceil) plane(g, w, d, ceil, cx, h, cz, Math.PI / 2);
  const walls = [];
  const mk = (side) => {
    const horiz = side === 'n' || side === 's';
    const len = horiz ? w : d;
    const ops = openings.filter((o) => o.wall === side).sort((a, b) => a.at - b.at);
    let start = -len / 2;
    const segs = [];
    for (const o of ops) { segs.push([start, o.at - o.width / 2]); start = o.at + o.width / 2; }
    segs.push([start, len / 2]);
    for (const [a, b] of segs) {
      const L = b - a; if (L <= 0.01) continue;
      const mid = (a + b) / 2;
      let x, z, ww, dd;
      if (side === 'n') { x = cx + mid; z = cz - d / 2; ww = L; dd = thickness; }
      if (side === 's') { x = cx + mid; z = cz + d / 2; ww = L; dd = thickness; }
      if (side === 'w') { x = cx - w / 2; z = cz + mid; ww = thickness; dd = L; }
      if (side === 'e') { x = cx + w / 2; z = cz + mid; ww = thickness; dd = L; }
      const m = box(g, ww, h, dd, wall, x, 0, z, { solid: true });
      walls.push(m);
      // skirting board on both faces of the wall
      box(g, ww + (horiz ? 0 : 0.04), 0.1, dd + (horiz ? 0.04 : 0), skirting, x, 0, z);
    }
    // lintels over openings
    for (const o of ops) {
      const lh = o.height ?? 2.1;
      if (lh >= h) continue;
      let x, z, ww, dd;
      if (side === 'n') { x = cx + o.at; z = cz - d / 2; ww = o.width; dd = thickness; }
      if (side === 's') { x = cx + o.at; z = cz + d / 2; ww = o.width; dd = thickness; }
      if (side === 'w') { x = cx - w / 2; z = cz + o.at; ww = thickness; dd = o.width; }
      if (side === 'e') { x = cx + w / 2; z = cz + o.at; ww = thickness; dd = o.width; }
      box(g, ww, h - lh, dd, wall, x, lh, z);
    }
  };
  ['n', 's', 'e', 'w'].forEach(mk);
  return { floor: fl, walls };
}

export function lamp(g, x, y, z, color = 0xffd89a, intensity = 1.2, dist = 6, { bulb = true } = {}) {
  const l = new THREE.PointLight(color, intensity, dist, 1.4);
  l.position.set(x, y, z);
  g.scene.add(l);
  if (bulb) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), M({ color, unlit: true }));
    b.position.set(x, y, z); g.scene.add(b);
  }
  return l;
}

/* ------------------------------------------------------------ furniture */

export function bed(g, x, z, rotY = 0, { color = '#6a7280' } = {}) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; g.scene.add(grp);
  const wood = M({ map: T.woodTex([1, 1], '#5a4030') });
  box(g, 1.6, 0.35, 2.1, wood, 0, 0, 0, { parent: grp });
  box(g, 1.55, 0.18, 2.0, M({ map: T.fabricTex('#c9c4b6') }), 0, 0.35, 0, { parent: grp });
  box(g, 1.58, 0.1, 1.4, M({ map: T.fabricTex(color) }), 0, 0.5, 0.3, { parent: grp });
  box(g, 0.6, 0.12, 0.35, M({ color: '#d8d4c8' }), -0.35, 0.53, -0.8, { parent: grp });
  box(g, 0.6, 0.12, 0.35, M({ color: '#d8d4c8' }), 0.35, 0.53, -0.8, { parent: grp });
  box(g, 1.6, 0.9, 0.08, wood, 0, 0, -1.05, { parent: grp });
  grp.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(grp);
  g.collider(b.min.x, b.max.x, b.min.z, b.max.z);
  return grp;
}

export function table(g, x, z, w = 1.2, d = 0.8, h = 0.75, { color = '#6b4a30', solid = true } = {}) {
  const wood = M({ map: T.woodTex([1, 1], color) });
  box(g, w, 0.05, d, wood, x, h - 0.05, z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.06, h - 0.05, 0.06, wood, x + dx * (w / 2 - 0.06), 0, z + dz * (d / 2 - 0.06));
  if (solid) g.collider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
}

export function chair(g, x, z, rotY = 0, color = '#5a4030') {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; g.scene.add(grp);
  const wood = M({ map: T.woodTex([1, 1], color) });
  box(g, 0.42, 0.05, 0.42, wood, 0, 0.44, 0, { parent: grp });
  box(g, 0.42, 0.45, 0.05, wood, 0, 0.49, -0.19, { parent: grp });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.04, 0.44, 0.04, wood, dx * 0.18, 0, dz * 0.18, { parent: grp });
  return grp;
}

export function sofa(g, x, z, rotY = 0, color = '#5a5f52') {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; g.scene.add(grp);
  const f = M({ map: T.fabricTex(color, [2, 1]) });
  box(g, 2, 0.42, 0.85, f, 0, 0, 0, { parent: grp });
  box(g, 2, 0.5, 0.2, f, 0, 0.42, -0.33, { parent: grp });
  box(g, 0.2, 0.25, 0.85, f, -0.9, 0.42, 0, { parent: grp });
  box(g, 0.2, 0.25, 0.85, f, 0.9, 0.42, 0, { parent: grp });
  grp.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(grp);
  g.collider(b.min.x, b.max.x, b.min.z, b.max.z);
  return grp;
}

export function shelf(g, x, z, rotY = 0, { w = 1, h = 1.8 } = {}) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; g.scene.add(grp);
  const wood = M({ map: T.woodTex([1, 2], '#4f3a2a') });
  box(g, w, h, 0.32, wood, 0, 0, 0, { parent: grp });
  const colors = ['#7a3a32', '#3a4a6a', '#6a6a3a', '#3a5a4a', '#8a7a5a'];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) {
    if (Math.random() < 0.25) continue;
    box(g, 0.1, 0.24, 0.22, M({ color: colors[(r * 3 + i) % 5] }), -w / 2 + 0.12 + i * 0.15, 0.15 + r * 0.42, 0.06, { parent: grp });
  }
  grp.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(grp);
  g.collider(b.min.x, b.max.x, b.min.z, b.max.z);
  return grp;
}

export function windowPane(g, x, y, z, w, h, rotY = 0, { color = '#4a5a78', emissive = 0x1a2233 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M({ color, emissive, unlit: false }));
  m.position.set(x, y, z); m.rotation.y = rotY; g.scene.add(m);
  const frame = M({ color: '#d0ccc0' });
  const f1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.06, 0.06), frame); f1.position.set(0, h / 2, 0); m.add(f1);
  const f2 = f1.clone(); f2.position.y = -h / 2; m.add(f2);
  const f3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05), frame); m.add(f3);
  return m;
}

export function door(g, x, z, rotY = 0, { color = '#5a4232', glow = false } = {}) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; g.scene.add(grp);
  const mat = M({ map: T.woodTex([1, 2], color), emissive: glow ? 0x332211 : undefined });
  box(g, 0.9, 2.05, 0.06, mat, 0, 0, 0, { parent: grp });
  box(g, 0.06, 0.06, 0.1, M({ color: '#c8b070' }), 0.33, 1.0, 0.05, { parent: grp });
  return grp;
}

export function crib(g, x, z, rotY = 0) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; g.scene.add(grp);
  const w = M({ color: '#d8d0c0' });
  box(g, 1.2, 0.06, 0.65, w, 0, 0.45, 0, { parent: grp });
  for (let i = 0; i <= 8; i++) { box(g, 0.03, 0.5, 0.03, w, -0.58 + i * 0.145, 0.45, -0.31, { parent: grp }); box(g, 0.03, 0.5, 0.03, w, -0.58 + i * 0.145, 0.45, 0.31, { parent: grp }); }
  box(g, 1.2, 0.04, 0.04, w, 0, 0.94, -0.31, { parent: grp }); box(g, 1.2, 0.04, 0.04, w, 0, 0.94, 0.31, { parent: grp });
  for (const dx of [-0.58, 0.58]) box(g, 0.05, 0.95, 0.65, w, dx, 0, 0, { parent: grp });
  box(g, 1.1, 0.08, 0.58, M({ map: T.fabricTex('#a8b8c8') }), 0, 0.5, 0, { parent: grp });
  grp.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(grp);
  g.collider(b.min.x, b.max.x, b.min.z, b.max.z);
  return grp;
}

export function babyBundle(color = '#e0d8c8') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 2, 6), M({ map: T.fabricTex(color, [1, 1], 12) }));
  body.rotation.z = Math.PI / 2; g.add(body);
  const face = new THREE.Mesh(new THREE.IcosahedronGeometry(0.065, 0), M({ color: '#dcb49a' }));
  face.position.set(0.16, 0.02, 0.02); g.add(face);
  return g;
}

/* ------------------------------------------------------------ outdoor */

export function tree(g, x, z, { h = 4, color = '#7a5a2a', autumn = true, solid = true, scale = 1 } = {}) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.scale.setScalar(scale); g.scene.add(grp);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, h * 0.5, 5), M({ map: T.noiseTex('#3d2e22', { amount: 0.4, seed: 8 }) }));
  trunk.position.y = h * 0.25; grp.add(trunk);
  const cols = autumn ? [color, '#8a4a22', '#9a7a2a'] : [color];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(h * (0.28 - i * 0.04), 0), M({ color: cols[i % cols.length], flat: true }));
    c.position.set((i - 1) * 0.3, h * (0.55 + i * 0.13), (i % 2) * 0.2);
    grp.add(c);
  }
  if (solid) g.collider(x - 0.25 * scale, x + 0.25 * scale, z - 0.25 * scale, z + 0.25 * scale);
  return grp;
}

export function bareTree(g, x, z, { h = 4, solid = true } = {}) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); g.scene.add(grp);
  const mat = M({ color: '#1e1b1a', flat: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, h, 5), mat); trunk.position.y = h / 2; grp.add(trunk);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.05, h * 0.4, 4), mat);
    b.position.set(0, h * (0.5 + i * 0.09), 0); b.rotation.z = (i % 2 ? 1 : -1) * (0.6 + i * 0.1); b.rotation.y = i * 1.3;
    b.translateY(h * 0.18); grp.add(b);
  }
  if (solid) g.collider(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
  return grp;
}

export function lampPost(g, x, z, { on = true, color = 0xffd08a, intensity = 1.4, dist = 8, h = 3.6, solid = true } = {}) {
  const mat = M({ color: '#2a2c30' });
  box(g, 0.1, h, 0.1, mat, x, 0, z);
  box(g, 0.5, 0.06, 0.08, mat, x + 0.2, h - 0.06, z);
  const head = box(g, 0.28, 0.12, 0.2, M({ color: on ? '#ffe8b0' : '#555', unlit: on }), x + 0.4, h - 0.2, z);
  let light = null;
  if (on) { light = new THREE.PointLight(color, intensity, dist, 1.3); light.position.set(x + 0.4, h - 0.3, z); g.scene.add(light); }
  if (solid) g.collider(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
  return { head, light };
}

export function bench(g, x, z, rotY = 0) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; g.scene.add(grp);
  const wood = M({ map: T.woodTex([2, 1], '#5a4232') });
  const metal = M({ color: '#2a2a2c' });
  box(g, 1.6, 0.05, 0.45, wood, 0, 0.44, 0, { parent: grp });
  box(g, 1.6, 0.4, 0.05, wood, 0, 0.5, -0.22, { parent: grp });
  for (const dx of [-0.7, 0.7]) box(g, 0.06, 0.44, 0.42, metal, dx, 0, 0, { parent: grp });
  grp.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(grp);
  g.collider(b.min.x, b.max.x, b.min.z, b.max.z);
  return grp;
}

export function building(g, x, z, w, h, d, { lit = 0.35, base = '#3a3d44', seed = 21, solid = true } = {}) {
  const m = M({ map: T.windowsTex([Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3))], lit, base, seed) });
  return box(g, w, h, d, m, x, 0, z, { solid });
}

export function rain(g, { count = 900, area = 30, center = null, height = 12, speed = 14, color = 0x9aa6b8 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 6);
  const c = center || new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * area, y = Math.random() * height, z = (Math.random() - 0.5) * area;
    pos.set([x, y, z, x + 0.02, y - 0.35, z], i * 6);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, fog: true }));
  lines.frustumCulled = false;
  g.scene.add(lines);
  const follow = { target: null };
  g.onUpdate((dt) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      a[o + 1] -= speed * dt; a[o + 4] -= speed * dt;
      if (a[o + 4] < 0) { const y = height + Math.random() * 2; a[o + 1] = y; a[o + 4] = y - 0.35; }
    }
    geo.attributes.position.needsUpdate = true;
    const t = follow.target || (g.player ? g.player.root.position : c);
    lines.position.set(t.x, 0, t.z);
  });
  return { lines, follow };
}

/** floating dust / ash particles around a point */
export function motes(g, { count = 160, area = 16, color = 0xbfb8a0, size = 2 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pos.set([(Math.random() - 0.5) * area, Math.random() * 4, (Math.random() - 0.5) * area], i * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.7 }));
  pts.frustumCulled = false;
  g.scene.add(pts);
  g.onUpdate((dt, t) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) { a[i * 3 + 1] += Math.sin(t + i) * dt * 0.05 - dt * 0.03; if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 4; }
    geo.attributes.position.needsUpdate = true;
    if (g.player) pts.position.set(g.player.root.position.x, 0, g.player.root.position.z);
  });
  return pts;
}

/** a glowing memory fragment the player can pick up */
export function memoryShard(g, x, y, z, color = 0xffe2a0) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); g.scene.add(grp);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), M({ color, unlit: true, fog: false }));
  grp.add(core);
  // halo and a tall light beam that ignore the fog, so a shard is visible from far away
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowSpriteTex('#ffe8b0'), transparent: true, depthWrite: false, opacity: 0.9, fog: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(1.4, 1.4, 1); grp.add(halo);
  const beamM = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.28, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 14, 6, 1, true), beamM);
  beam.position.y = 7 - y; grp.add(beam);
  const light = new THREE.PointLight(color, 1.2, 5); grp.add(light);
  const off = g.onUpdate((dt, t) => {
    core.rotation.y += dt * 1.5; core.position.y = Math.sin(t * 2 + x) * 0.06;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + x);
    beamM.opacity = 0.18 + pulse * 0.18; halo.material.opacity = 0.7 + pulse * 0.3;
  });
  return { grp, remove() { off(); g.scene.remove(grp); } };
}

/** big text written on a surface (fourth-wall inscriptions) */
export function inscription(g, text, x, y, z, rotY = 0, { w = 3, h = 0.75, color = '#c9c2b0', font = 13 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M({ map: T.textTex(text, { w: 256, h: 64, color, font }), transparent: true, unlit: true, depthWrite: false }));
  m.position.set(x, y, z); m.rotation.y = rotY; g.scene.add(m);
  return m;
}

/** Snowfall that follows the camera/player. */
export function snow(g, { count = 900, area = 30, height = 10, speed = 1.1, color = 0xf2f2f6, size = 2 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos.set([(Math.random() - 0.5) * area, Math.random() * height, (Math.random() - 0.5) * area], i * 3); phase[i] = Math.random() * 6.28; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: true }));
  pts.frustumCulled = false;
  g.scene.add(pts);
  const follow = { target: null };
  g.onUpdate((dt, t) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      a[i * 3 + 1] -= speed * dt * (0.7 + (i % 5) * 0.12);
      a[i * 3] += Math.sin(t * 0.8 + phase[i]) * dt * 0.25;
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] = height;
    }
    geo.attributes.position.needsUpdate = true;
    const tg = follow.target || (g.player ? g.player.root.position : null);
    if (tg) pts.position.set(tg.x, 0, tg.z);
  });
  return { pts, follow };
}

/** A simple low fence along a straight line (posts + two rails). Solid. */
export function fenceLine(g, x1, z1, x2, z2, { color = '#4a3a2c', height = 1.1, solid = true, spacing = 2 } = {}) {
  const m = M({ map: T.woodTex([1, 1], color) });
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = Math.atan2(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(len / spacing));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    box(g, 0.1, height, 0.1, m, x1 + (x2 - x1) * k, 0, z1 + (z2 - z1) * k);
  }
  for (const y of [height * 0.35, height * 0.8]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, len), m);
    rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = ang;
    g.scene.add(rail);
  }
  if (solid) {
    // approximate the segment with small square colliders
    const steps = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 0; i <= steps; i++) {
      const x = x1 + (x2 - x1) * (i / steps), z = z1 + (z2 - z1) * (i / steps);
      g.collider(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
    }
  }
}

/** Fence around an ellipse (rx, rz) — makes a location's border visible. */
export function fenceRing(g, rx, rz, { segments = 36, cx = 0, cz = 0, gapAt = null, gapWidth = 0, ...opts } = {}) {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2;
    if (gapAt !== null) {
      const mid = (a0 + a1) / 2;
      let d = Math.abs(((mid - gapAt + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (d < gapWidth) continue;
    }
    fenceLine(g, cx + Math.cos(a0) * rx, cz + Math.sin(a0) * rz, cx + Math.cos(a1) * rx, cz + Math.sin(a1) * rz, opts);
  }
}

/** snowy ground texture */
export function snowGround(repeat = [1, 1]) {
  return T.noiseTex('#d8dce2', { amount: 0.12, seed: 51, repeat, speck: 14 });
}
