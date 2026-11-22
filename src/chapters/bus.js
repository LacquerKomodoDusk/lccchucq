// Chapter 1 — the bus No. 77. The first meeting. The world builder is reused
// for the final memory.
//
// Layout follows the chapter-1 artbook: rainy autumn bus stop, the bus
// approaches with its headlights on; inside — blue patterned seats and yellow
// rails; the hero sits at the back on the door side, she sits at the other end.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import * as T from '../engine/textures.js';
import { heroSpec, wifeSpec } from '../config/family.js';
import { think, chapterStart, endMemory, isLooking, setWorldMood, V3 } from './common.js';
import { lerpAngle } from '../engine/game.js';

export const BUS_NUMBER = '77';
const BUS_W = 2.5, BUS_L = 11, BUS_H = 2.35;
export const DOOR_Z = [3.0, 4.15];

// seat positions (hero at the back on the door side, she at the front opposite)
export const HERO_SEAT = { x: -0.72, z: -3.15, rot: 0 };
export const GIRL_SEAT = { x: 1.0, z: 2.35, rot: -Math.PI / 2 }; // side-facing seat

/** Builds the rainy autumn street + bus. Returns handles for animation. */
export function buildBusWorld(g, { fogColor = 0x4c4a58 } = {}) {
  g.newScene({ bg: fogColor, fog: [fogColor, 3, 30], hemi: [0xa8a4c0, 0x3a3440, 1.0], sun: [0xc8c0e0, 0.3, [-4, 8, 3]] });
  setWorldMood(g, { sat: 0.72, tint: [0.96, 0.94, 1.06] });
  g.surface = 'wet';

  /* ---------------- street ---------------- */
  const scene = g.scene;
  const capture = (fn) => { const before = new Set(scene.children); fn(); return [...scene.children].filter((c) => !before.has(c)); };
  const groundPlanes = capture(() => {
    B.plane(g, 7, 400, B.M({ map: T.leavesTex([3, 160], '#34343e', 6) }), 1.0, -0.42, -80);
    B.plane(g, 0.2, 400, B.M({ map: T.roadLineTex([1, 120]), unlit: true }), 2.6, -0.41, -80);
    B.plane(g, 3, 400, B.M({ map: T.leavesTex([2, 150], '#4a4850', 26) }), -3.9, -0.25, -80);
    B.plane(g, 30, 400, B.M({ map: T.leavesTex([10, 120], '#3a3a30', 30) }), -19, -0.3, -80);
    B.plane(g, 30, 400, B.M({ map: T.leavesTex([10, 120], '#3a3a30', 30) }), 19, -0.44, -80);
  });
  // repeating roadside props (wrap around while driving)
  const props = [];
  for (let i = 0; i < 18; i++) {
    const z = 20 - i * 9;
    const seg = new THREE.Group(); seg.userData.z = z;
    const added = capture(() => {
      B.tree(g, 7 + Math.random() * 5, z, { h: 4 + Math.random() * 2.5, autumn: true, solid: false, color: ['#8a4a22', '#a0622a', '#6a3a1e'][i % 3] });
      if (i % 3 !== 1) B.bareTree(g, -6.5 - Math.random() * 4, z + 4, { h: 4.5 + Math.random() * 2, solid: false });
      else B.tree(g, -7 - Math.random() * 3, z + 4, { h: 4 + Math.random() * 2, autumn: true, solid: false, color: '#9a5a26' });
      if (i % 2 === 0) B.lampPost(g, -5.2, z + 2, { on: i % 4 === 0, solid: false, intensity: 0.8, dist: 6 });
    });
    added.forEach((c) => seg.add(c));
    g.add(seg);
    props.push(seg);
  }
  const houses = capture(() => { for (let i = 0; i < 10; i++) B.building(g, -16 - Math.random() * 4, 30 - i * 22, 8, 6 + Math.random() * 8, 10, { lit: 0.25, base: '#4a4852', seed: i, solid: false }); });
  // bus stop shelter (left side of the road)
  const stop = new THREE.Group(); g.add(stop);
  {
    const m = B.M({ color: '#2e3036' });
    const glass = B.M({ color: '#8a90a8', transparent: true, opacity: 0.3, depthWrite: false });
    B.box(g, 0.08, 2.3, 0.08, m, -4.3, -0.25, 0.2, { parent: stop });
    B.box(g, 0.08, 2.3, 0.08, m, -4.3, -0.25, 3.8, { parent: stop });
    B.box(g, 0.08, 2.3, 0.08, m, -5.4, -0.25, 0.2, { parent: stop });
    B.box(g, 0.08, 2.3, 0.08, m, -5.4, -0.25, 3.8, { parent: stop });
    B.box(g, 1.5, 0.08, 3.9, m, -4.85, 2.05, 2.0, { parent: stop });
    B.box(g, 0.04, 1.8, 3.6, glass, -5.4, 0.05, 2.0, { parent: stop });
    B.box(g, 1.1, 1.8, 0.04, glass, -4.85, 0.05, 3.8, { parent: stop });
    B.box(g, 1.0, 0.06, 0.35, B.M({ map: T.woodTex([2, 1], '#5a4232') }), -5.1, 0.2, 2.0, { parent: stop });
    B.box(g, 0.06, 2.2, 0.06, m, -3.9, -0.25, -0.6, { parent: stop });
    B.box(g, 0.05, 0.6, 0.45, B.M({ map: T.textTex(BUS_NUMBER, { w: 32, h: 32, color: '#fff', bg: '#2a4a8a', font: 16 }), unlit: true }), -3.9, 1.6, -0.6, { parent: stop });
    B.box(g, 0.3, 0.45, 0.3, B.M({ color: '#2a3a2e' }), -4.0, -0.25, 4.3, { parent: stop });
  }
  const stopCol = g.collider(-5.5, -5.3, 0.1, 3.9);

  /* ---------------- the bus ---------------- */
  const bus = new THREE.Group(); g.add(bus);
  const wallM = B.M({ color: '#bcb6b0', side: THREE.DoubleSide });
  const panelM = B.M({ map: T.fabricTex('#8a8690', [4, 1]), side: THREE.DoubleSide });
  const stripeM = B.M({ color: '#7a2a2a' });
  const glassM = B.M({ color: '#9aa0c0', transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const floorM = B.M({ map: T.noiseTex('#3e3c44', { amount: 0.3, seed: 9, repeat: [3, 12] }) });
  const seatM = B.M({ map: T.seatTex([1, 1]) });
  const poleM = B.M({ color: '#d8b830' });
  const hx = BUS_W / 2, hz = BUS_L / 2;
  B.box(g, BUS_W, 0.05, BUS_L, floorM, 0, -0.05, 0, { parent: bus });
  B.box(g, BUS_W, 0.38, BUS_L, B.M({ color: '#26262a' }), 0, -0.43, 0, { parent: bus });
  B.box(g, BUS_W + 0.05, 0.12, BUS_L + 0.05, B.M({ color: '#aaa6a0' }), 0, BUS_H, 0, { parent: bus });
  const sideWall = (side, doorRange) => {
    const x = side * hx;
    const segs = doorRange ? [[-hz, doorRange[0]], [doorRange[1], hz]] : [[-hz, hz]];
    for (const [a, b] of segs) {
      const len = b - a, mid = (a + b) / 2;
      B.box(g, 0.06, 0.95, len, panelM, x, 0, mid, { parent: bus });
      B.box(g, 0.08, 0.25, len, stripeM, x + side * 0.02, 0.2, mid, { parent: bus });
      B.box(g, 0.06, 0.35, len, wallM, x, 2.0, mid, { parent: bus });
      const n = Math.max(1, Math.round(len / 1.45));
      for (let i = 0; i <= n; i++) B.box(g, 0.07, 1.05, 0.1, wallM, x, 0.95, a + (len * i) / n, { parent: bus });
      B.box(g, 0.02, 1.05, len, glassM, x, 0.95, mid, { parent: bus });
    }
    if (doorRange) B.box(g, 0.06, 0.35, doorRange[1] - doorRange[0], wallM, x, 2.0, (doorRange[0] + doorRange[1]) / 2, { parent: bus });
  };
  sideWall(-1, DOOR_Z); // door on the right-hand side (−x) in the direction of travel
  sideWall(1, null);
  // front & back
  B.box(g, BUS_W, 0.95, 0.06, panelM, 0, 0, hz, { parent: bus });
  B.box(g, BUS_W, 1.05, 0.02, glassM, 0, 0.95, hz, { parent: bus });
  B.box(g, BUS_W, 0.95, 0.06, panelM, 0, 0, -hz, { parent: bus });
  B.box(g, BUS_W, 0.9, 0.02, glassM, 0, 1.0, -hz, { parent: bus });
  B.box(g, BUS_W, 0.45, 0.06, wallM, 0, 1.9, -hz, { parent: bus });
  B.box(g, BUS_W, 0.4, 0.06, wallM, 0, 1.95, hz, { parent: bus });
  // route number sign
  B.box(g, 1.0, 0.28, 0.04, B.M({ map: T.textTex(BUS_NUMBER, { w: 64, h: 16, color: '#ffb040', bg: '#140c06', font: 13 }), unlit: true }), 0, 2.03, hz + 0.04, { parent: bus });
  // headlights + glow + wet-road reflections
  const glowTex = T.glowSpriteTex('#ffe0a0');
  const reflections = [];
  for (const x of [-0.85, 0.85]) {
    B.box(g, 0.32, 0.18, 0.05, B.M({ color: '#fff2c8', unlit: true }), x, 0.05, hz + 0.03, { parent: bus });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
    s.scale.set(1.6, 1.6, 1); s.position.set(x, 0.15, hz + 0.15); bus.add(s);
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 5), B.M({ color: '#d8a860', unlit: true, transparent: true, opacity: 0.35, depthWrite: false }));
    refl.rotation.x = -Math.PI / 2; refl.position.set(x, -0.4, hz + 2.7); bus.add(refl);
    reflections.push(refl);
  }
  const headLight = new THREE.PointLight(0xffe0b0, 2.0, 14); headLight.position.set(0, 0.5, hz + 1.5); bus.add(headLight);
  for (const [x, z] of [[-hx, 3.6], [hx, 3.6], [-hx, -3.4], [hx, -3.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 8), B.M({ color: '#151515' }));
    w.rotation.z = Math.PI / 2; w.position.set(x, -0.4, z); bus.add(w);
  }
  // driver cabin (left-hand drive → +x)
  B.box(g, 1.0, 1.3, 0.06, wallM, 0.7, 0, 4.4, { parent: bus });
  B.box(g, 0.5, 0.9, 0.6, B.M({ color: '#2a2a30' }), 0.7, 0, 4.9, { parent: bus });
  const seat = (x, z, rotY = 0) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rotY; bus.add(grp);
    B.box(g, 0.42, 0.45, 0.42, seatM, 0, 0, 0, { parent: grp });
    B.box(g, 0.42, 0.55, 0.08, seatM, 0, 0.45, -0.2, { parent: grp });
    return grp;
  };
  const rows = [];
  for (let i = 0; i < 6; i++) {
    const z = 1.2 - i * 0.95;
    rows.push(z);
    for (const x of [0.5, 0.95, -0.5, -0.95]) seat(x, z);
  }
  // hero's seat row at the back
  seat(-0.5, HERO_SEAT.z); seat(-0.95, HERO_SEAT.z); seat(0.5, HERO_SEAT.z); seat(0.95, HERO_SEAT.z);
  rows.push(HERO_SEAT.z);
  // front side-facing seats (hers) on the +x side
  seat(GIRL_SEAT.x + 0.04, GIRL_SEAT.z, -Math.PI / 2);
  seat(GIRL_SEAT.x + 0.04, GIRL_SEAT.z + 0.48, -Math.PI / 2);
  // back bench
  B.box(g, BUS_W - 0.1, 0.45, 0.5, seatM, 0, 0, -hz + 0.35, { parent: bus });
  B.box(g, BUS_W - 0.1, 0.55, 0.1, seatM, 0, 0.45, -hz + 0.12, { parent: bus });
  for (const [x, z] of [[-0.27, 3.0], [-0.27, 1.6], [0.27, 0.2], [-0.27, -1.3], [0.27, -2.6], [-0.27, -4.3], [0.27, -4.3], [-1.0, 2.2]]) B.box(g, 0.04, BUS_H, 0.04, poleM, x, 0, z, { parent: bus });
  B.box(g, 0.03, 0.03, BUS_L - 1, poleM, 0.3, 2.0, 0, { parent: bus });
  B.box(g, 0.03, 0.03, BUS_L - 1, poleM, -0.3, 2.0, 0, { parent: bus });
  for (const z of [3, 0.5, -2, -4.2]) B.box(g, 0.4, 0.04, 0.8, B.M({ color: '#f0e4c0', unlit: true }), 0, BUS_H - 0.04, z, { parent: bus });
  const inner = new THREE.PointLight(0xf8e0b0, 0.9, 10); inner.position.set(0, 2.1, 0); bus.add(inner);
  const inner2 = new THREE.PointLight(0xf8e0b0, 0.6, 7); inner2.position.set(0, 2.1, -3.5); bus.add(inner2);
  B.box(g, 0.02, 0.3, BUS_L - 0.4, B.M({ color: '#c89030' }), hx + 0.04, 1.95, 0, { parent: bus });
  // doors (two folding leaves) on the −x side
  const doorM = B.M({ color: '#aaa6a0', side: THREE.DoubleSide });
  const leaves = [];
  for (const k of [0, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(-hx - 0.02, 0, k ? DOOR_Z[1] : DOOR_Z[0]); bus.add(pivot);
    B.box(g, 0.04, 2.0, 0.56, doorM, 0, 0, k ? -0.28 : 0.28, { parent: pivot });
    B.box(g, 0.03, 1.1, 0.42, glassM, -0.01, 0.8, k ? -0.28 : 0.28, { parent: pivot });
    leaves.push(pivot);
  }
  const setDoor = (open) => { leaves[0].rotation.y = open * 1.45; leaves[1].rotation.y = -open * 1.45; };
  setDoor(0);

  // colliders (bus space; the bus only moves before passengers board)
  const busCols = [];
  const col = (a, b, c, d) => { const cc = g.collider(a, b, c, d); busCols.push(cc); return cc; };
  col(hx - 0.05, hx + 0.2, -hz, hz);
  col(-hx - 0.2, -hx + 0.05, -hz, DOOR_Z[0]);
  col(-hx - 0.2, -hx + 0.05, DOOR_Z[1], hz);
  col(-hx, hx, hz - 0.05, hz + 0.3);
  col(-hx, hx, -hz - 0.3, -hz + 0.65);
  for (const z of rows) { col(0.27, hx, z - 0.25, z + 0.22); col(-hx, -0.27, z - 0.25, z + 0.22); }
  col(0.75, hx, GIRL_SEAT.z - 0.3, GIRL_SEAT.z + 0.8);
  col(0.15, hx, 4.0, hz);
  const doorBlock = col(-hx - 0.3, -hx + 0.05, DOOR_Z[0], DOOR_Z[1]);
  busCols.forEach((c) => { c.on = false; });

  /* ---------------- rain (hidden while the camera is inside) ---------------- */
  const rain = B.rain(g, { count: 1100, area: 34, speed: 13 });
  const rainTarget = new THREE.Vector3();
  rain.follow.target = rainTarget;

  let speed = 0, target = 0;
  g.onUpdate((dt, t) => {
    speed += (target - speed) * Math.min(1, dt * 0.5);
    const dz = speed * dt;
    stop.position.z -= dz;
    if (dz > 0) stopCol.on = false;
    for (const p of props) { p.position.z -= dz; if (p.userData.z + p.position.z < -60) p.position.z += 162; }
    for (const h of houses) { h.position.z -= dz * 0.6; if (h.position.z < -190) h.position.z += 220; }
    for (const pl of groundPlanes) { const m = pl.material.map; if (m) m.offset.y -= dz * m.repeat.y / 400; }
    bus.position.y = speed > 0.5 ? Math.sin(t * 9) * 0.008 + Math.sin(t * 2.3) * 0.01 : 0;
    if (audio.busOsc) audio.busOsc.frequency.value = 40 + speed * 2.5;
    const c = g.camera.position;
    const inside = Math.abs(c.x - bus.position.x) < hx && Math.abs(c.z - bus.position.z) < hz && c.y < BUS_H + bus.position.y;
    rain.lines.visible = !inside;
    rainTarget.set(c.x, 0, c.z);
    for (const r of reflections) r.material.opacity = 0.25 + Math.sin(t * 3 + r.position.x) * 0.05;
  });

  return {
    bus, stop, setDoor, doorBlock,
    enableInterior(on) { busCols.forEach((c) => { c.on = on; }); doorBlock.on = on; },
    drive(v) { target = v; },
    get speed() { return speed; },
    hx, hz,
  };
}

/** head yaw needed for character c to look at point p (clamped) */
export function lookAtYaw(c, p, max = 1.25) {
  const pos = c.root.position;
  const a = Math.atan2(p.x - pos.x, p.z - pos.z);
  const d = lerpAngle(0, a - c.root.rotation.y, 1);
  return Math.max(-max, Math.min(max, d));
}

/** Over-the-shoulder camera that follows a seated character's head direction. */
export function headCamera(g, c, { back = 0.95, up = 0.02, side = 0.42 } = {}) {
  g.camMode = 'script';
  return g.onUpdate(() => {
    const eye = c.eyePos();
    const yaw = c.root.rotation.y + c.lookYaw;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const want = eye.clone().addScaledVector(dir, -back).addScaledVector(right, side).add(new THREE.Vector3(0, up, 0));
    g.camera.position.lerp(want, 0.25);
    const look = eye.clone().addScaledVector(dir, 5).add(new THREE.Vector3(0, -0.25, 0));
    g.camLook = g.camLook ? g.camLook.lerp(look, 0.25) : look;
    g.camera.lookAt(g.camLook);
  });
}

export function sitAt(c, seat) {
  c.root.position.set(seat.x, 0.02, seat.z + (seat.rot === 0 ? 0.05 : 0));
  c.root.rotation.y = seat.rot;
  c.state = 'sit';
}

export default {
  num: 'ГЛАВА 1',
  title: 'Автобус',
  async run(g) {
    await chapterStart(g, this);
    const W = buildBusWorld(g);
    audio.ambience('rain', true, 0.55);
    audio.ambience('wind', true, 0.25);

    // other passengers (anonymous silhouettes of a memory)
    for (const [x, z, c] of [[0.95, 1.2, '#4a4f5a'], [0.5, -0.7, '#5a4a40'], [0.95, -1.65, '#3f4a44'], [-0.95, -0.7, '#3a3a48']]) {
      const p = g.spawn({ ...heroSpec('everyday'), beard: null, hair: '#3a3430', hairStyle: 'short', top: c, coat: c, longCoat: false, backpack: null, height: 1.72, skin: '#b0a098', thickBrows: false }, [x, 0.02, z + 0.05], 0);
      p.state = 'sit'; p.setExpression('closed');
      W.bus.attach(p.root);
    }

    /* ---------- 1. at the bus stop, the bus approaches ---------- */
    const hero = g.spawn(heroSpec('trench'), [-4.3, -0.25, 4.6], Math.PI);
    g.setPlayer(hero, { control: false });
    g.surface = 'wet';
    g.followCamera({ dist: 2.4, height: 1.75, lookH: 1.45, side: -0.45 });
    g.snapCamera();
    W.bus.position.z = -70;
    const approach = g.onUpdate((dt) => {
      const z = W.bus.position.z;
      if (z < 0) W.bus.position.z = Math.min(0, z + Math.min(9, Math.max(1.2, -z * 0.35)) * dt);
    });
    audio.ambience('bus', true, 0.4);
    await g.fade(0, 2.5);
    g.ui.subtitle('Осень. Туманное утро. Дождь.', 4);
    g.control(true);
    g.bounds = (p) => { p.x = Math.max(-5.3, Math.min(-2.8, p.x)); p.z = Math.max(-4, Math.min(7, p.z)); };
    g.ui.objective(`Дождаться автобуса № ${BUS_NUMBER}`);
    await g.until(() => W.bus.position.z > -0.01);
    approach();
    audio.noise({ dur: 0.9, f: 300, q: 1, vel: 0.15, type: 'lowpass' }); // brakes
    await g.wait(0.6);
    audio.noise({ dur: 0.8, f: 2500, q: 0.6, vel: 0.12, type: 'highpass' });
    await g.tween(0.8, (k) => W.setDoor(k));
    g.ui.objective('Сесть в автобус');
    g.debugGoal = V3(-2.6, 0, 3.55);
    await g.until(() => hero.root.position.z > DOOR_Z[0] - 0.7 && hero.root.position.z < DOOR_Z[1] + 0.7 && hero.root.position.x > -3.5);
    g.control(false);
    g.bounds = null;
    g.debugGoal = null;
    g.ui.objective(null);
    await g.fade(1, 0.8);
    W.enableInterior(true);
    W.doorBlock.on = false;
    sitAt(hero, HERO_SEAT);
    hero.lookYaw = -1.05; // looking out of the window
    g.surface = 'metal';

    /* ---------- 2. she jumps in at the last moment ---------- */
    const girl = g.spawn(wifeSpec('busCoat'), [-4.0, -0.25, 12], Math.PI);
    g.camSet([-0.55, 1.45, -1.2], [-1.2, 1.1, 3.6]);
    await g.fade(0, 1);
    await g.wait(1.0);
    audio.noise({ dur: 0.8, f: 2500, q: 0.6, vel: 0.12, type: 'highpass' });
    const closing = g.tween(1.4, (k) => W.setDoor(1 - k * 0.6));
    girl.blendRate = 12;
    await g.walkTo(girl, [-2.2, 0, 3.55], { speed: 5.0, run: true });
    await closing;
    girl.root.position.y = 0;
    await g.tween(0.2, (k) => W.setDoor(0.4 + k * 0.6));
    audio.step('metal', true);
    await g.walkTo(girl, [-0.6, 0, 3.55], { speed: 3.4, run: true });
    audio.noise({ dur: 0.6, f: 2500, q: 0.6, vel: 0.14, type: 'highpass' });
    g.tween(0.5, (k) => W.setDoor(1 - k)).catch(() => {});
    W.doorBlock.on = true;
    girl.state = 'idle';
    W.drive(9);

    /* ---------- 3. the hero notices her ---------- */
    g.camera.fov = 32; g.camera.updateProjectionMatrix();
    g.camSet([0.05, 1.3, -1.6], [HERO_SEAT.x, 1.3, HERO_SEAT.z]);
    hero.blendRate = 20;
    const yawTo = lookAtYaw(hero, girl.root.position);
    await g.wait(0.35);
    await g.tween(0.2, (k) => { hero.lookYaw = -1.05 + (yawTo + 1.05) * k; }, (k) => k);
    audio.playMusic('theme', { fade: 0.4 });
    await g.wait(1.0);

    /* ---------- 4. their eyes meet ---------- */
    await g.faceTo(girl, hero.root.position, 0.3);
    g.camera.fov = 26; g.camera.updateProjectionMatrix();
    g.camSet([-0.35, 1.55, -1.0], [-0.6, 1.5, 3.55]);
    await g.wait(1.8);

    /* ---------- 5. ...but she quickly looks away ---------- */
    g.camSet([0.2, 1.5, 1.9], [-0.6, 1.5, 3.55]);
    await g.tween(0.35, (k) => { girl.root.rotation.y = lerpAngle(girl.root.rotation.y, Math.PI * 0.5, k); });
    await g.wait(1.0);
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    await g.walkTo(girl, [0.55, 0, 2.5], { speed: 1.3 });
    sitAt(girl, GIRL_SEAT);
    girl.lookYaw = 0.35;

    /* ---------- player: stolen glances ---------- */
    hero.blendRate = 8;
    const camOff = headCamera(g, hero);
    await g.tween(0.8, (k) => { hero.lookYaw = yawTo + (-0.9 - yawTo) * k; });
    g.ui.objective('Посмотри на неё. Украдкой.');
    g.ui.subtitle('A / D — повернуть голову', 4);
    let shared = 0;
    const NEED = 3;
    const glance = { on: false, t: 0, cool: 3.5, dur: 1.5 };
    let stare = 0, lastShared = -10;
    g.ui.meter('ВЗГЛЯДЫ', 0);
    await g.until(() => {
      const dt = g.dt;
      const turn = (input.isDown('left') ? 1 : 0) - (input.isDown('right') ? 1 : 0);
      hero.lookYaw = Math.max(-1.3, Math.min(1.3, hero.lookYaw + turn * dt * 1.4));
      if (window.__autoplay) hero.lookYaw = lookAtYaw(hero, girl.eyePos(), 1.3);
      const heroLooks = isLooking(hero, girl.eyePos(), 0.97);
      stare = heroLooks ? stare + dt : Math.max(0, stare - dt * 2);
      glance.cool -= dt;
      if (!glance.on && (glance.cool <= 0 || (stare > 2.0 && glance.cool < 2))) { glance.on = true; glance.t = 0; glance.dur = 1.3 + Math.random() * 0.8; }
      const toHero = lookAtYaw(girl, hero.eyePos(), 1.5);
      if (glance.on) {
        glance.t += dt;
        girl.lookYaw = THREE.MathUtils.lerp(girl.lookYaw, toHero, Math.min(1, dt * 7));
        if (glance.t > glance.dur) { glance.on = false; glance.cool = 3 + Math.random() * 3.5; }
      } else girl.lookYaw = THREE.MathUtils.lerp(girl.lookYaw, 0.35, Math.min(1, dt * 5));
      const girlLooks = glance.on && Math.abs(girl.lookYaw - toHero) < 0.25;
      if (heroLooks && girlLooks && g.time - lastShared > 2.5) {
        shared++; lastShared = g.time;
        g.ui.meter('ВЗГЛЯДЫ', shared / NEED);
        audio.piano(74 + shared * 2, audio.now, { vel: 0.35, dur: 3 });
        glance.t = glance.dur - 0.35; // shy: looks away
        girl.setExpression('smile');
        g.wait(1.6).then(() => girl.setExpression('neutral')).catch(() => {});
        hero.setExpression('smile');
        g.wait(2.2).then(() => hero.setExpression('neutral')).catch(() => {});
        g.ui.subtitle(['Она снова посмотрела.', 'И снова отвела глаза.', 'Я даже не знаю, как её зовут.'][shared - 1], 3);
      }
      return shared >= NEED;
    });
    camOff();
    g.ui.meter(null);
    g.ui.objective(null);
    await g.wait(2.0);
    await think(g, 'Мы не сказали друг другу ни слова.');
    await think(g, 'Но эту красную шапку я запомнил.');
    g.camSet([1.0, 2.1, -4.6], [0.2, 1.1, 2.4]);
    await g.camMove([0.9, 2.1, -1.2], [0.4, 1.1, 2.4], 4);
    await endMemory(g, 'Воспоминание: «Автобус»');
  },
};
