// Reusable memory locations.
import * as THREE from 'three';
import * as B from './build.js';
import * as T from '../engine/textures.js';

/**
 * Small apartment: living room + kitchen corner + sleeping area.
 * Centered at origin, 8 x 6 m. Door on the south wall at x = -3.
 * opts: { night, warm, boxes, crib, kidsToys, cold }
 */
export function apartment(g, opts = {}) {
  const night = !!opts.night;
  const bg = night ? 0x0c0d12 : 0x2a2a30;
  g.newScene({
    bg, fog: [bg, 6, 20],
    hemi: night ? [0x5a6080, 0x1a1510, 0.55] : [0xd8d0c0, 0x4a4038, 0.95],
    sun: night ? [0x8090c0, 0.15, [3, 5, 2]] : [0xfff0d8, 0.5, [3, 6, 4]],
  });
  const wp = opts.cold ? T.wallpaperTex([4, 1], '#5d6264', '#4d5254') : T.wallpaperTex([4, 1], '#8a7f68', '#7a6f58');
  B.room(g, {
    w: 8, d: 6, h: 2.7,
    floor: B.M({ map: T.woodTex([6, 5], '#6a4a32') }),
    wall: B.M({ map: wp }),
    ceil: B.M({ color: '#c8c4b8' }),
    openings: [{ wall: 's', at: -3, width: 1.0, height: 2.1 }],
  });
  B.door(g, -3, 3.05, Math.PI);
  // kitchen corner (NE)
  const counterM = B.M({ map: T.woodTex([2, 1], '#8a7a62') });
  B.box(g, 2.6, 0.9, 0.6, counterM, 2.6, 0, -2.65, { solid: true });
  B.box(g, 2.6, 0.04, 0.62, B.M({ color: '#d8d0c0' }), 2.6, 0.9, -2.65);
  B.box(g, 0.6, 1.8, 0.6, B.M({ color: '#d8d8d0' }), 3.6, 0, -1.5, { solid: true }); // fridge
  B.box(g, 0.5, 0.02, 0.4, B.M({ color: '#222' }), 2.2, 0.93, -2.65);
  B.table(g, 2.4, -0.6, 1.1, 0.8, 0.75);
  B.chair(g, 2.4, 0.1, Math.PI);
  B.chair(g, 2.4, -1.3, 0);
  // living area (W)
  B.sofa(g, -2.2, -2.4, 0, opts.cold ? '#4a5056' : '#5a5f52');
  B.box(g, 1.0, 0.4, 0.5, B.M({ map: T.woodTex([1, 1], '#4a3a2a') }), -2.2, 0, -1.2, { solid: true });
  B.box(g, 1.2, 0.7, 0.08, B.M({ color: '#151518', emissive: night ? 0x0a0f1a : 0x000000 }), -2.2, 0.9, 2.9); // TV
  B.box(g, 1.4, 0.5, 0.4, B.M({ map: T.woodTex([1, 1], '#3e3024') }), -2.2, 0, 2.75, { solid: true });
  B.shelf(g, -3.8, 0.2, Math.PI / 2, { w: 1.2, h: 1.7 });
  // sleeping corner (SE)
  B.bed(g, 2.9, 1.9, Math.PI / 2, { color: opts.cold ? '#5a6068' : '#7a6a72' });
  // windows
  B.windowPane(g, -0.5, 1.5, -2.92, 1.4, 1.1, 0, night ? { color: '#1a2238', emissive: 0x0a1020 } : { color: '#a8b8c8', emissive: 0x405060 });
  B.windowPane(g, 3.92, 1.5, 0.3, 1.1, 1.0, -Math.PI / 2, night ? { color: '#1a2238', emissive: 0x0a1020 } : { color: '#a8b8c8', emissive: 0x405060 });
  // lights
  const lights = [];
  if (night) {
    lights.push(B.lamp(g, -2.6, 0.9, -1.2, 0xffb060, 1.1, 5));
    lights.push(B.lamp(g, 2.4, 2.3, -0.6, 0xffd8a0, 0.7, 6));
  } else {
    lights.push(B.lamp(g, 0, 2.55, 0, 0xfff0d8, 0.9, 10, { bulb: true }));
  }
  if (opts.warm) g.hemi.color.set(0xf0d8b0);
  // moving boxes
  const boxes = [];
  if (opts.boxes) {
    const cardboard = B.M({ map: T.noiseTex('#9a7a50', { amount: 0.2, seed: 22 }) });
    const spots = [[-0.6, 0.6], [0.2, 1.4], [-1.2, 1.8], [0.9, 0.2], [-0.2, -0.5]];
    for (const [x, z] of spots) boxes.push(B.box(g, 0.55, 0.45, 0.45, cardboard, x, 0, z));
  }
  if (opts.crib) B.crib(g, 1.0, 2.4, 0);
  if (opts.kidsToys) {
    const cols = ['#c84a3a', '#3a7ac8', '#e0b030', '#4aa860'];
    for (let i = 0; i < 6; i++) B.box(g, 0.14, 0.14, 0.14, B.M({ color: cols[i % 4] }), -1 + Math.random() * 2, 0, 0.5 + Math.random() * 1.5);
  }
  return { lights, boxes };
}

/** Evening city street running along -Z. */
export function cityStreet(g, { length = 80, night = true, snow = false } = {}) {
  const bg = night ? 0x141620 : 0x5a5a64;
  g.newScene({ bg, fog: [bg, 5, 32], hemi: night ? [0x6a7090, 0x2a2018, 0.6] : [0xc0c0d0, 0x4a4038, 0.9], sun: [0xa0a8d0, 0.2, [-3, 6, 2]] });
  B.plane(g, 8, length + 20, B.M({ map: T.asphaltTex([3, (length + 20) / 3]) }), 4.5, -0.15, -length / 2 + 5);
  B.plane(g, 4, length + 20, B.M({ map: T.tilesTex('#6a6a68', '#62625f', [2, (length + 20) / 2], '#4a4a48') }), 0, 0, -length / 2 + 5);
  B.plane(g, 4, length + 20, B.M({ map: T.leavesTex([2, (length + 20) / 2], '#4a4a40', snow ? 2 : 18) }), -4, 0, -length / 2 + 5);
  for (let z = 4; z > -length; z -= 10) {
    B.lampPost(g, 1.8, z, { on: true, intensity: 1.5, dist: 9 });
    B.tree(g, -3.2, z - 5, { h: 4.5, autumn: true, color: '#7a5a2a' });
  }
  for (let z = 0; z > -length - 10; z -= 14) {
    B.building(g, -10, z, 8, 10 + Math.random() * 10, 12, { lit: 0.45, base: '#3a3d48', seed: Math.floor(-z) });
    B.building(g, 16, z - 6, 8, 12 + Math.random() * 10, 12, { lit: 0.4, base: '#3a3a44', seed: Math.floor(-z) + 3 });
  }
  for (let z = -6; z > -length; z -= 22) B.bench(g, -1.4, z, Math.PI / 2);
  g.collider(-6.2, -5.9, -length - 10, 10);
  g.collider(2.1, 2.4, -length - 10, 10);
  g.collider(-6, 2.4, 8, 8.3);
  g.surface = 'hard';
}

/** Park with a pond (Chapter 4 / 6). */
export function pondPark(g, { warm = false, summer = false } = {}) {
  const bg = warm ? 0x9aa6a0 : 0x5a6268;
  g.newScene({ bg, fog: [bg, 8, 45], hemi: warm ? [0xfff0d0, 0x5a5a3a, 1.15] : [0xd0d8d8, 0x404838, 1.0], sun: [0xfff0c8, warm ? 0.9 : 0.5, [5, 10, 4]] });
  B.plane(g, 80, 80, B.M({ map: T.grassTex([30, 30], summer ? '#5a7a3a' : '#5a6a3a') }), 0, 0, 0);
  // pond (ellipse made from a circle)
  const water = new THREE.Mesh(new THREE.CircleGeometry(6, 14), B.M({ map: T.waterTex([4, 4]), emissive: 0x0a1418 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(1.4, 1, 1); water.position.set(0, 0.02, 0);
  g.add(water);
  const shore = new THREE.Mesh(new THREE.RingGeometry(6, 6.8, 14), B.M({ map: T.noiseTex('#6a5a42', { amount: 0.3, seed: 2 }) }));
  shore.rotation.x = -Math.PI / 2; shore.scale.set(1.4, 1, 1); shore.position.y = 0.015; g.add(shore);
  g.onUpdate((dt) => { water.material.map.offset.x += dt * 0.01; });
  // path ring
  const path = new THREE.Mesh(new THREE.RingGeometry(8, 9.4, 20), B.M({ map: T.noiseTex('#8a7a62', { amount: 0.25, seed: 4 }) }));
  path.rotation.x = -Math.PI / 2; path.scale.set(1.3, 1, 1); path.position.y = 0.01; g.add(path);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, d = 12 + (i % 3) * 3;
    B.tree(g, Math.cos(a) * d * 1.3, Math.sin(a) * d, { h: 4 + (i % 4), autumn: !summer, color: summer ? '#4a6a30' : ['#8a6a2a', '#6a7a30', '#9a5a22'][i % 3] });
  }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; B.bench(g, Math.cos(a) * 10.4 * 1.3, Math.sin(a) * 10.4, -a - Math.PI / 2); }
  // pond blocks walking
  g.bounds = (p) => {
    const ex = p.x / 1.4, ez = p.z;
    const d = Math.hypot(ex, ez);
    if (d < 6.6) { const k = 6.6 / d; p.x *= k; p.z *= k; }
    const far = Math.hypot(p.x / 1.3, p.z);
    if (far > 22) { p.x *= 22 / far; p.z *= 22 / far; }
  };
  g.surface = 'grass';
  return { water };
}

/** Maternity ward corridor + room. Corridor along -Z, room at the end on the right. */
export function hospital(g) {
  g.newScene({ bg: 0x1a2020, fog: [0x1a2020, 6, 22], hemi: [0xd8e8e0, 0x404848, 0.9], sun: [0xe0f0ff, 0.25, [2, 5, 1]] });
  const wall = B.M({ map: T.tilesTex('#9aa6a0', '#94a09a', [6, 1], '#6a746e') });
  const floor = B.M({ map: T.tilesTex('#7a807c', '#72786f', [3, 10], '#4a504c') });
  B.room(g, { cx: 0, cz: -6, w: 2.6, d: 16, h: 2.8, floor, wall, ceil: B.M({ color: '#c8d0cc' }), openings: [{ wall: 'e', at: 5, width: 1.2 }] });
  B.room(g, { cx: 3.8, cz: -1, w: 5, d: 4.4, h: 2.8, floor, wall: B.M({ map: T.wallpaperTex([3, 1], '#c8c8b8', '#b8b8a8') }), ceil: B.M({ color: '#d8dcd8' }), openings: [{ wall: 'w', at: 0, width: 1.2 }] });
  for (let z = 0; z > -14; z -= 3.5) B.lamp(g, 0, 2.7, z, 0xe8f0e8, 0.8, 6);
  B.lamp(g, 4, 2.6, -1, 0xfff0d8, 1.0, 7);
  for (let z = -2; z > -14; z -= 4) B.door(g, -1.27, z, Math.PI / 2, { color: '#7a8a8a' });
  B.bench(g, -0.95, -8, Math.PI / 2);
  // bed in the room
  const bedGrp = B.bed(g, 5.2, -1.2, -Math.PI / 2, { color: '#d8dce0' });
  B.windowPane(g, 6.27, 1.5, 0.4, 1.2, 1.1, -Math.PI / 2, { color: '#c8d8e8', emissive: 0x506070 });
  g.surface = 'hard';
  return { bedGrp };
}

/** Night office with desks. */
export function office(g) {
  g.newScene({ bg: 0x0d0f14, fog: [0x0d0f14, 4, 16], hemi: [0x5a6a8a, 0x101010, 0.5], sun: null });
  B.room(g, { w: 10, d: 8, h: 2.8, floor: B.M({ map: T.noiseTex('#3a3e48', { amount: 0.2, seed: 6, repeat: [8, 6] }) }), wall: B.M({ map: T.wallpaperTex([4, 1], '#5a6068', '#4e545c') }), ceil: B.M({ color: '#6a6e74' }) });
  const deskM = B.M({ map: T.woodTex([1, 1], '#5a5048') });
  const screens = [];
  for (let i = 0; i < 6; i++) {
    const x = -3 + (i % 3) * 3, z = i < 3 ? -1.5 : 1.5;
    B.box(g, 1.6, 0.05, 0.8, deskM, x, 0.72, z, { solid: true });
    B.box(g, 0.05, 0.72, 0.7, deskM, x - 0.75, 0, z);
    B.box(g, 0.05, 0.72, 0.7, deskM, x + 0.75, 0, z);
    const on = i === 4;
    screens.push(B.box(g, 0.55, 0.35, 0.04, B.M({ color: on ? '#8ab0e0' : '#111', unlit: on }), x, 0.85, z - 0.25));
  }
  B.windowPane(g, 0, 1.6, -3.92, 6, 1.4, 0, { color: '#101828', emissive: 0x080c18 });
  const l = B.lamp(g, 0, 1.4, 1.2, 0x9ab8e8, 0.8, 4, { bulb: false });
  g.surface = 'hard';
  return { screens, light: l };
}
