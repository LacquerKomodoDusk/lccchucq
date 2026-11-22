// Flashbacks during the mirror battle. Every blow throws the hero back into a
// hard moment of the past — and this time he notices something good in it
// that he did not see then. The scene starts almost colourless; the good
// detail brings the colour back.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import * as B from '../world/build.js';
import * as T from '../engine/textures.js';
import { apartment, toyWarehouse } from '../world/places.js';
import { heroSpec, wifeSpec } from '../config/family.js';
import { setWorldMood } from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function shardsOnFloor(g, x, z) {
  const white = B.M({ color: '#e8e4da' });
  for (let i = 0; i < 12; i++) {
    const geo = new THREE.TetrahedronGeometry(0.03 + Math.random() * 0.04, 0); geo.scale(1, 0.3, 1);
    const m = new THREE.Mesh(geo, white);
    m.position.set(x + (Math.random() - 0.5) * 0.9, 0.02, z + (Math.random() - 0.5) * 0.9);
    m.rotation.y = Math.random() * 6;
    g.add(m);
  }
}

/** shared frame: colourless memory → the good detail → colour returns */
async function frame(g, { build, bad, good, reveal, shot, goodShot }) {
  const post = g.r.post;
  await g.tween(0.25, (k) => { post.uWhite.value = k; });
  g.pushScene();
  const ctx = build();
  const key = new THREE.PointLight(0xffe2b8, 2.2, 7, 1.2);
  const lk = goodShot ? goodShot.look : shot.look;
  key.position.set(lk[0] + 0.6, lk[1] + 1.6, lk[2] + 0.8); g.add(key);
  g.hemi.intensity = Math.max(g.hemi.intensity, 0.85);
  setWorldMood(g, { sat: 0.08, tint: [1.05, 1.0, 0.92], noise: 0.07, distort: 0.03 });
  g.letterbox(true);
  g.handheld = 0.5;
  g.camera.fov = shot.fov ?? 40; g.camera.updateProjectionMatrix();
  g.camSet(shot.pos, shot.look);
  audio.whisper(1.2, 0.08);
  await g.tween(0.5, (k) => { post.uWhite.value = 1 - k; });
  g.pushIn(0.4, 3.2).catch(() => {});
  g.ui.subtitle(bad, 3.2);
  await g.wait(3.2);
  // the good detail
  if (goodShot) { g.camera.fov = goodShot.fov ?? 34; g.camera.updateProjectionMatrix(); g.camSet(goodShot.pos, goodShot.look); g.pushIn(0.3, 4).catch(() => {}); }
  audio.piano(74, audio.now, { vel: 0.3, dur: 4 });
  audio.piano(78, audio.now + 0.4, { vel: 0.25, dur: 4 });
  const revealDone = reveal ? reveal(ctx) : Promise.resolve();
  await g.tween(2.2, (k) => {
    post.uSat.value = 0.08 + k * 0.9;
    post.uTint.value.set(1.05 + k * 0.03, 1.0, 0.92 - k * 0.06);
  });
  g.ui.subtitle(good, 4.5);
  await Promise.all([g.wait(4.5), revealDone]);
  await g.tween(0.4, (k) => { post.uWhite.value = k; });
  g.ui.subtitle(null);
  g.popScene();
  await g.tween(0.6, (k) => { post.uWhite.value = 1 - k; });
}

const FLASHBACKS = [
  // 1. the quarrel with the broken plate
  (g) => frame(g, {
    bad: 'Ссора. Разбитая тарелка. Я запомнил только крик.',
    good: 'А она потом собирала осколки — чтобы я не порезался.',
    build() {
      apartment(g, { night: true });
      const h = g.spawn(heroSpec('everyday'), [-0.6, 0, 0.8], Math.PI * 0.8);
      const w = g.spawn(wifeSpec('home'), [0.6, 0, -1.5], -Math.PI * 0.2);
      h.setExpression('angry'); w.setExpression('sad'); w.state = 'kneel';
      shardsOnFloor(g, 0.5, -1.1);
      return { h, w };
    },
    shot: { pos: [-1.4, 1.7, 2.2], look: [0.2, 0.9, -0.8], fov: 46 },
    goodShot: { pos: [-1.5, 0.85, 0.3], look: [0.5, 0.5, -1.4], fov: 46 },
    reveal: async ({ h, w }) => { await g.wait(1.0); w.setExpression('neutral'); await g.tween(0.8, (k) => { w.lookPitch = -0.55 * k; w.lookYaw = 0.5 * k; }); h.setExpression('sad'); },
  }),
  // 2. sleepless nights with the baby
  (g) => frame(g, {
    bad: 'Бессонные ночи. Мне казалось, что я один.',
    good: 'Она тоже не спала. Всё это время она была рядом.',
    build() {
      apartment(g, { night: true, crib: true });
      const h = g.spawn(heroSpec('tired'), [0.4, 0, 1.0], 0.3);
      h.setBaby(true); h.state = 'hold'; h.setExpression('sad');
      const w = g.spawn(wifeSpec('home', { scarf: '#8a7a9a' }), [-2.6, 0, 2.4], Math.PI * 0.75);
      w.setExpression('sad');
      return { h, w };
    },
    shot: { pos: [2.0, 1.5, -0.4], look: [0.4, 1.15, 1.0], fov: 42 },
    goodShot: { pos: [-1.0, 1.6, -0.8], look: [-0.1, 1.2, 1.4], fov: 46 },
    reveal: async ({ h, w }) => {
      await g.walkTo(w, [0.0, 0, 1.4], { speed: 0.7 });
      w.root.rotation.y = Math.atan2(h.root.position.x - w.root.position.x, h.root.position.z - w.root.position.z);
      w.state = 'hug'; w.setExpression('smile'); h.setExpression('smile');
    },
  }),
  // 3. late shifts at the warehouse
  (g) => frame(g, {
    bad: '«Опять допоздна?» — я слышал в этом только упрёк.',
    good: 'А она просто скучала по мне.',
    build() {
      const WH = toyWarehouse(g);
      WH.setClock('23:12');
      const h = g.spawn(heroSpec('work'), [8.0, 0, 0.9], -Math.PI / 2);
      h.state = 'phone'; h.setExpression('sad');
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowSpriteTex('#ffe0b0'), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending }));
      glow.scale.set(0.8, 0.8, 1); glow.position.set(7.75, 1.35, 0.95); g.add(glow);
      return { h, glow };
    },
    shot: { pos: [6.2, 1.7, 2.6], look: [8.0, 1.2, 0.9], fov: 44 },
    goodShot: { pos: [7.0, 1.5, 0.3], look: [8.0, 1.4, 0.9], fov: 34 },
    reveal: async ({ h, glow }) => { await g.tween(1.2, (k) => { glow.material.opacity = k; }); h.setExpression('smile'); },
  }),
  // 4. the anxious mornings
  (g) => frame(g, {
    bad: 'Тревога. Утро. Таблетка. Я справлялся сам.',
    good: 'Я не замечал записку на столе: «Я рядом».',
    build() {
      apartment(g, {});
      const h = g.spawn(heroSpec('tired'), [2.4, 0.02, 0.12], Math.PI);
      h.state = 'sit'; h.setExpression('sad');
      B.box(g, 0.06, 0.12, 0.06, B.M({ color: '#d8d8e0' }), 2.2, 0.75, -0.5);
      const note = B.inscription(g, 'Я рядом', 2.55, 0.762, -0.55, 0, { w: 0.26, h: 0.12, color: '#3a2a20' });
      note.rotation.x = -Math.PI / 2;
      const paper = B.box(g, 0.28, 0.004, 0.16, B.M({ color: '#f0e8d0' }), 2.55, 0.752, -0.55);
      return { h, note, paper };
    },
    shot: { pos: [3.8, 1.6, 1.3], look: [2.4, 0.9, -0.3], fov: 44 },
    goodShot: { pos: [2.55, 1.25, -0.15], look: [2.55, 0.76, -0.55], fov: 34 },
    reveal: async ({ h }) => { await g.wait(1.5); h.lookPitch = 0.4; h.setExpression('neutral'); },
  }),
  // 5. the talk about separating
  (g) => frame(g, {
    bad: '«Может, нам пожить отдельно?»',
    good: 'Она говорила это — и не отпускала мою руку.',
    build() {
      apartment(g, { night: true, cold: true });
      const h = g.spawn(heroSpec('tired'), [2.4, 0.02, 0.12], Math.PI); h.state = 'sit'; h.setExpression('sad');
      const w = g.spawn(wifeSpec('home'), [2.4, 0.02, -1.3], 0); w.state = 'sit'; w.setExpression('cry');
      return { h, w };
    },
    shot: { pos: [3.7, 1.45, -0.6], look: [2.4, 1.0, -0.6], fov: 42 },
    goodShot: { pos: [3.2, 0.95, -0.55], look: [2.4, 0.8, -0.6], fov: 36 },
    reveal: async ({ h, w }) => {
      // their hands meet on the table
      h.armR.sh.rotation.set(-1.2, 0, 0.2);
      await g.tween(1.2, (k) => { w.pose.uArmLX = -1.3 * k; w.pose.fArmLX = -0.3 * k; h.pose.uArmRX = -1.3 * k; h.pose.fArmRX = -0.3 * k; });
      w.state = 'reach'; h.state = 'reach';
      w.setExpression('sad'); h.setExpression('sad');
    },
  }),
];

export const FLASHBACK_COUNT = FLASHBACKS.length;
export function playFlashback(g, i) { return FLASHBACKS[i % FLASHBACKS.length](g); }
