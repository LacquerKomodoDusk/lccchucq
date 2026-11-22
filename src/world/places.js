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

/** Park with a pond (Chapter 4). `snow` = snowy November. */
export function pondPark(g, { warm = false, summer = false, snow = false, evening = false } = {}) {
  const bg = evening ? 0x1a2030 : snow ? 0x8c9098 : warm ? 0x9aa6a0 : 0x5a6268;
  g.newScene({
    bg, fog: [bg, snow ? 7 : 8, snow ? 38 : 45],
    hemi: evening ? [0x6a7898, 0x1a1a18, 0.65] : snow ? [0xe4e8f0, 0x707078, 1.15] : warm ? [0xfff0d0, 0x5a5a3a, 1.15] : [0xd0d8d8, 0x404838, 1.0],
    sun: [evening ? 0x8090c0 : snow ? 0xdde4f0 : 0xfff0c8, evening ? 0.2 : snow ? 0.4 : warm ? 0.9 : 0.5, [5, 10, 4]],
  });
  B.plane(g, 80, 80, B.M({ map: snow ? B.snowGround([30, 30]) : T.grassTex([30, 30], summer ? '#5a7a3a' : '#5a6a3a') }), 0, 0, 0);
  // pond (ellipse made from a circle); in November it is dark, with thin ice at the edge
  const water = new THREE.Mesh(new THREE.CircleGeometry(6, 14), B.M({ map: T.waterTex([4, 4]), color: snow ? '#7a8a94' : '#ffffff', emissive: 0x0a1418 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(1.4, 1, 1); water.position.set(0, 0.02, 0);
  g.add(water);
  if (snow) {
    const ice = new THREE.Mesh(new THREE.RingGeometry(4.6, 6, 14), B.M({ color: '#b8c8d4', transparent: true, opacity: 0.75 }));
    ice.rotation.x = -Math.PI / 2; ice.scale.set(1.4, 1, 1); ice.position.y = 0.025; g.add(ice);
  }
  const shore = new THREE.Mesh(new THREE.RingGeometry(6, 6.8, 14), B.M({ map: T.noiseTex(snow ? '#b8bcc2' : '#6a5a42', { amount: 0.3, seed: 2 }) }));
  shore.rotation.x = -Math.PI / 2; shore.scale.set(1.4, 1, 1); shore.position.y = 0.015; g.add(shore);
  g.onUpdate((dt) => { water.material.map.offset.x += dt * (snow ? 0.003 : 0.01); });
  // path ring (trodden snow in winter)
  const path = new THREE.Mesh(new THREE.RingGeometry(8, 9.4, 20), B.M({ map: T.noiseTex(snow ? '#a4a6ac' : '#8a7a62', { amount: 0.25, seed: 4 }) }));
  path.rotation.x = -Math.PI / 2; path.scale.set(1.3, 1, 1); path.position.y = 0.01; g.add(path);
  const snowCap = B.M({ color: '#eef0f4' });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, d = 12 + (i % 3) * 3;
    const x = Math.cos(a) * d * 1.3, z = Math.sin(a) * d;
    if (snow) {
      const h = 4 + (i % 4);
      if (i % 3 === 0) {
        // snowy fir
        const fir = new THREE.Group(); fir.position.set(x, 0, z); g.add(fir);
        for (let k = 0; k < 3; k++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3 - k * 0.35, 1.6, 6), B.M({ color: '#2e3e34', flat: true }));
          cone.position.y = 1.2 + k * 1.0; fir.add(cone);
          const capM = new THREE.Mesh(new THREE.ConeGeometry(1.0 - k * 0.3, 0.6, 6), snowCap);
          capM.position.y = 1.75 + k * 1.0; fir.add(capM);
        }
        g.collider(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
      } else {
        B.bareTree(g, x, z, { h });
        const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), snowCap); cap.scale.set(1.4, 0.5, 1.4); cap.position.set(x, h * 0.98, z); g.add(cap);
      }
    } else {
      B.tree(g, x, z, { h: 4 + (i % 4), autumn: !summer, color: summer ? '#4a6a30' : ['#8a6a2a', '#6a7a30', '#9a5a22'][i % 3] });
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const bx = Math.cos(a) * 10.4 * 1.3, bz = Math.sin(a) * 10.4;
    B.bench(g, bx, bz, -a - Math.PI / 2);
    if (snow) B.box(g, 1.5, 0.06, 0.4, snowCap, bx, 0.49, bz, { rotY: -a - Math.PI / 2 });
  }
  if (snow || evening) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.2; B.lampPost(g, Math.cos(a) * 9.9 * 1.3, Math.sin(a) * 9.9, { on: true, intensity: 0.7, dist: 7, color: 0xffe0b0 }); }
  // visible border of the park: a low fence
  B.fenceRing(g, 22 * 1.3, 22, { segments: 40, color: snow ? '#3a3030' : '#4a3a2c', solid: false });
  // pond blocks walking; the fence holds you in
  g.bounds = (p) => {
    const d = Math.hypot(p.x / 1.4, p.z);
    if (d < 6.6) { const k = 6.6 / d; p.x *= k; p.z *= k; }
    const far = Math.hypot(p.x / 1.3, p.z);
    if (far > 21.4) { p.x *= 21.4 / far; p.z *= 21.4 / far; }
  };
  if (snow) B.snow(g, { count: 1000 });
  g.surface = snow ? 'snow' : 'grass';
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

/**
 * A lonely children's playground between panel blocks, fenced on all sides.
 * 20 x 16 m centred at origin, gate on the south side.
 */
export function playground(g, { warm = true } = {}) {
  const bg = warm ? 0x9a948a : 0x6a6c70;
  g.newScene({ bg, fog: [bg, 10, 48], hemi: warm ? [0xffe8c8, 0x5a5040, 1.1] : [0xc8ccd4, 0x404040, 0.9], sun: [0xffd8a0, warm ? 0.85 : 0.4, [-6, 7, 4]] });
  B.plane(g, 90, 90, B.M({ map: T.grassTex([30, 30], '#5e6a44') }), 0, -0.01, 0);
  // rubber / sand ground of the playground
  B.plane(g, 20, 16, B.M({ map: T.noiseTex('#8a7a62', { amount: 0.25, seed: 61, repeat: [8, 6] }) }), 0, 0, 0);
  const W = 10, D = 8;
  // fence with a gate on the south side
  const fc = { color: '#3a4a3a', height: 1.0 };
  B.fenceLine(g, -W, -D, W, -D, fc);
  B.fenceLine(g, -W, -D, -W, D, fc);
  B.fenceLine(g, W, -D, W, D, fc);
  B.fenceLine(g, -W, D, -1.2, D, fc);
  B.fenceLine(g, 1.2, D, W, D, fc);
  g.bounds = (p) => { p.x = Math.max(-W + 0.4, Math.min(W - 0.4, p.x)); p.z = Math.max(-D + 0.4, Math.min(D + 6, p.z)); if (p.z > D - 0.4 && Math.abs(p.x) > 1.0) p.z = Math.min(p.z, D - 0.4); };
  const metal = B.M({ color: '#7a3a32' });
  const metal2 = B.M({ color: '#3a5a7a' });
  // swings (one swaying a little on its own)
  const swX = -5, swZ = -3;
  B.box(g, 0.08, 2.2, 0.08, metal, swX - 1.6, 0, swZ, { solid: true });
  B.box(g, 0.08, 2.2, 0.08, metal, swX + 1.6, 0, swZ, { solid: true });
  B.box(g, 3.3, 0.08, 0.08, metal, swX, 2.2, swZ);
  const swings = [];
  for (const dx of [-0.8, 0.8]) {
    const pivot = new THREE.Group(); pivot.position.set(swX + dx, 2.2, swZ); g.add(pivot);
    const ch = B.M({ color: '#555' });
    B.box(g, 0.02, 1.7, 0.02, ch, -0.22, -1.7, 0, { parent: pivot });
    B.box(g, 0.02, 1.7, 0.02, ch, 0.22, -1.7, 0, { parent: pivot });
    B.box(g, 0.5, 0.05, 0.25, B.M({ map: T.woodTex([1, 1], '#6a4a30') }), 0, -1.72, 0, { parent: pivot });
    swings.push(pivot);
  }
  g.onUpdate((dt, t) => { swings[0].rotation.x = Math.sin(t * 1.4) * 0.18; swings[1].rotation.x = Math.sin(t * 1.4 + 2) * 0.04; });
  // slide
  B.box(g, 0.08, 1.6, 0.08, metal2, 4.2, 0, -4.4, { solid: true });
  B.box(g, 0.08, 1.6, 0.08, metal2, 5.0, 0, -4.4, { solid: true });
  B.box(g, 0.9, 0.06, 0.9, metal2, 4.6, 1.5, -4.4);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 3.0), B.M({ color: '#b8a040' }));
  slide.position.set(4.6, 0.8, -2.5); slide.rotation.x = -0.52; g.add(slide);
  for (let i = 0; i < 5; i++) B.box(g, 0.8, 0.04, 0.12, metal2, 4.6, i * 0.3, -4.95);
  g.collider(4.2, 5.0, -4.9, -1.2);
  // sandbox
  const wood = B.M({ map: T.woodTex([2, 1], '#6a4a30') });
  B.box(g, 3, 0.3, 0.15, wood, 4.5, 0, 3.2); B.box(g, 3, 0.3, 0.15, wood, 4.5, 0, 5.8);
  B.box(g, 0.15, 0.3, 2.6, wood, 3.0, 0, 4.5); B.box(g, 0.15, 0.3, 2.6, wood, 6.0, 0, 4.5);
  B.plane(g, 2.8, 2.5, B.M({ map: T.noiseTex('#c8b088', { amount: 0.2, seed: 7 }) }), 4.5, 0.15, 4.5);
  B.box(g, 0.25, 0.25, 0.25, B.M({ color: '#c84a3a' }), 4.0, 0.15, 4.2);
  g.collider(2.9, 6.1, 3.1, 5.9);
  // carousel
  const car = new THREE.Group(); car.position.set(-4.5, 0, 3.8); g.add(car);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 10), B.M({ color: '#3a6a4a' })); disk.position.y = 0.3; car.add(disk);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; B.box(g, 0.05, 0.7, 0.05, metal, Math.cos(a) * 1.1, 0.36, Math.sin(a) * 1.1, { parent: car }); }
  g.onUpdate((dt) => { car.rotation.y += dt * 0.05; });
  g.collider(-5.9, -3.1, 2.4, 5.2);
  // one bench and one lamp
  B.bench(g, -1.5, -6.6, 0);
  B.lampPost(g, 1.6, -6.9, { on: !warm, intensity: 1.0 });
  // panel blocks around — the playground is empty, it's just us
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    B.building(g, Math.cos(a) * 30, Math.sin(a) * 28, 14, 16 + (i % 3) * 5, 10, { lit: 0.15, base: '#7a7468', seed: 70 + i, solid: false });
  }
  for (let i = 0; i < 8; i++) B.bareTree(g, -16 + i * 4.5, 12 + (i % 2) * 2, { solid: false, h: 4 + (i % 3) });
  g.surface = 'hard';
}

/**
 * Toy warehouse at night: metal racks full of toy boxes, pallets, a packing table.
 * 18 x 14 m centred at origin. Returns pickup piles and rack slots for the work task.
 */
export function toyWarehouse(g) {
  g.newScene({ bg: 0x14161c, fog: [0x14161c, 6, 28], hemi: [0xa8b0c0, 0x2a2620, 0.9], sun: null });
  const W = 18, D = 14, H = 6;
  B.room(g, { w: W, d: D, h: H, floor: B.M({ map: T.warehouseFloorTex([9, 7]) }), wall: B.M({ map: T.corrugatedTex([12, 3]) }), ceil: B.M({ color: '#2a2c30' }) });
  // yellow safety lines along the aisles
  const yellow = B.M({ color: '#c8a030', unlit: false });
  for (const z of [-3.1, 0.9, 4.9]) B.plane(g, 14, 0.08, yellow, 0, 0.005, z);
  // racks: 3 rows, 3 levels, full of toy boxes
  const upright = B.M({ color: '#2a4a7a' });
  const beam = B.M({ color: '#d0781e' });
  const colors = ['#c84a3a', '#3a7ac8', '#e0b030', '#4aa860', '#a04ab0', '#e07a30'];
  const slots = [];
  const rows = [-5.2, -1.2, 2.8];
  rows.forEach((z, ri) => {
    for (let x = -7; x <= 7; x += 2.8) {
      for (const dz of [-0.45, 0.45]) B.box(g, 0.08, 4.2, 0.08, upright, x, 0, z + dz);
    }
    for (let lvl = 0; lvl < 4; lvl++) {
      const y = 0.15 + lvl * 1.3;
      B.box(g, 14.2, 0.08, 0.06, beam, 0, y, z - 0.45);
      B.box(g, 14.2, 0.08, 0.06, beam, 0, y, z + 0.45);
      B.box(g, 14.0, 0.03, 0.9, B.M({ map: T.woodTex([6, 1], '#7a6a50') }), 0, y + 0.08, z);
      if (lvl === 3) continue;
      for (let x = -6.6; x < 6.8; x += 0.7) {
        const empty = (lvl === 1 && ri === 1 && x > -1.6 && x < 0.6); // gap the player fills
        if (empty) { if (slots.length < 3 && Math.abs(x + 0.5 + slots.length * 0.7 - 0.0) < 3) slots.push(new THREE.Vector3(x, y + 0.11, z)); continue; }
        if ((((Math.round(x * 10) * 7 + lvl * 13 + ri * 5) % 7) + 7) % 7 === 0) continue;
        const c = colors[Math.abs(Math.round(x * 3 + lvl * 2 + ri)) % colors.length];
        const h = 0.35 + ((Math.abs(x * 7) + lvl) % 3) * 0.12;
        B.box(g, 0.6, h, 0.7, B.M({ map: T.toyBoxTex(c, Math.abs(Math.round(x * 5 + lvl))) }), x, y + 0.11, z);
      }
    }
    g.collider(-7.2, 7.2, z - 0.55, z + 0.55);
  });
  // pallets with brown cardboard boxes near the gate
  const card = B.M({ map: T.noiseTex('#9a7a50', { amount: 0.2, seed: 22 }) });
  const pallet = B.M({ map: T.woodTex([1, 1], '#8a7050') });
  const piles = [];
  for (const [x, z] of [[-6.2, 5.6], [-3.6, 5.8], [-1.0, 5.6]]) {
    B.box(g, 1.2, 0.14, 1.0, pallet, x, 0, z);
    for (let i = 0; i < 6; i++) B.box(g, 0.5, 0.4, 0.45, card, x - 0.28 + (i % 2) * 0.56, 0.14 + Math.floor(i / 2) * 0.4, z - 0.22 + ((i >> 1) % 2) * 0.44);
    g.collider(x - 0.6, x + 0.6, z - 0.5, z + 0.5);
    piles.push(new THREE.Vector3(x, 0, z - 0.9));
  }
  // packing table with lamp, scanner and tape
  B.table(g, 5.2, 5.8, 1.8, 0.8, 0.9, { color: '#6a5a48' });
  B.box(g, 0.3, 0.06, 0.2, B.M({ color: '#222' }), 4.7, 0.9, 5.8);
  B.box(g, 0.12, 0.12, 0.12, B.M({ color: '#c8a030' }), 5.6, 0.9, 5.7);
  const deskLamp = B.lamp(g, 5.2, 1.5, 5.8, 0xffd8a0, 1.2, 4);
  void deskLamp;
  // a hand pallet truck
  B.box(g, 0.5, 0.08, 1.2, B.M({ color: '#b03a2a' }), 7.4, 0.05, 4.0);
  B.box(g, 0.05, 1.0, 0.05, B.M({ color: '#222' }), 7.4, 0.1, 4.7);
  // fluorescent strips, one of them flickering
  const lights = [];
  for (const [x, z] of [[-4, -3.1], [4, -3.1], [-4, 0.9], [4, 0.9], [0, 4.9]]) {
    const strip = B.box(g, 1.6, 0.06, 0.18, B.M({ color: '#e8f0f0', unlit: true }), x, H - 0.4, z);
    const l = new THREE.PointLight(0xdfe8f0, 1.0, 9, 1.4); l.position.set(x, H - 0.6, z); g.add(l);
    lights.push({ strip, l });
  }
  g.onUpdate((dt, t) => {
    const f = lights[2];
    const on = Math.sin(t * 13) > -0.85 || Math.random() < 0.7;
    f.l.intensity = on ? 1.0 : 0.1; f.strip.material.color.set(on ? '#e8f0f0' : '#555');
  });
  // wall clock
  const clock = B.inscription(g, '21:47', 0, 3.6, D / 2 - 0.1, Math.PI, { w: 1.2, h: 0.3, color: '#e05030' });
  const setClock = (txt) => { clock.material.map = T.textTex(txt, { w: 256, h: 64, color: '#e05030', font: 13 }); clock.material.needsUpdate = true; };
  g.surface = 'hard';
  // the three empty places on the middle rack, at the aisle side (z + 0.55)
  return { piles, slots: slots.slice(0, 3), setClock };
}
