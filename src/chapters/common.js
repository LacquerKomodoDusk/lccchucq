import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { globalUniforms, ps1Material as ps1Mat } from '../engine/ps1.js';
import { heroSpec, wifeSpec } from '../config/family.js';

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function spawnHero(g, outfit, pos, rotY = 0, { control = true, extra = {} } = {}) {
  const h = g.spawn(heroSpec(outfit, extra), pos, rotY);
  g.setPlayer(h, { control });
  return h;
}
export function spawnWife(g, outfit, pos, rotY = 0, extra = {}) {
  return g.spawn(wifeSpec(outfit, extra), pos, rotY);
}

/** thought line (italic, no speaker) */
export const think = (g, text, opts = {}) => g.ui.say(null, text, { thought: true, ...opts });

export async function chapterStart(g, chap) {
  g.setFade(1);
  g.ui.clearAll();
  document.title = 'ВОПРЕКИ';
  await g.ui.chapterCard(chap.num, chap.title);
}

/** Close a memory chapter with a gentle fade. */
export async function endMemory(g, text = 'Воспоминание сохранено') {
  g.control(false);
  g.ui.prompt(null);
  g.ui.objective(null);
  g.ui.toast(`◆ ${text}`, { dur: 3 });
  audio.ping();
  await g.wait(1.2);
  await g.fade(1, 2.5);
  audio.stopMusic(2);
  audio.stopAllAmbience();
  await g.wait(1);
}

/** Wait for the player to interact with a simple target (resolves when used). */
export function waitInteract(g, opts) {
  return new Promise((resolve) => {
    g.interact({ once: true, ...opts, onInteract: async (it) => { if (opts.onInteract) await opts.onInteract(it); resolve(); } });
  });
}

/** Wait until the player is within radius of a point. */
export function waitReach(g, pos, radius = 1.2) {
  g.debugGoal = pos;
  return g.until(() => g.player && Math.hypot(g.player.root.position.x - pos.x, g.player.root.position.z - pos.z) < radius).then((r) => { g.debugGoal = null; return r; });
}

/** Is `a` (character) facing point p within the given cosine threshold? (uses head yaw too) */
export function isLooking(c, p, thresh = 0.93) {
  const eye = c.eyePos();
  const dir = c.headDir();
  const to = new THREE.Vector3(p.x - eye.x, 0, p.z - eye.z).normalize();
  return dir.dot(to) > thresh;
}

export function setWorldMood(g, { warp = 0, distort = 0, sat = 0.85, tint = [1, 1, 1], noise = 0.035 } = {}) {
  const p = g.r.post;
  p.uSat.value = sat; p.uTint.value.set(...tint); p.uNoise.value = noise; p.uDistort.value = distort;
  globalUniforms.uWarp.value = warp;
}

/** short glitch burst for fourth-wall / nightmare moments */
export async function glitchBurst(g, dur = 0.5, amt = 0.6) {
  const p = g.r.post;
  const base = p.uDistort.value;
  audio.glitch(0.3);
  await g.tween(dur, (k) => { p.uDistort.value = base + amt * (1 - k) * (Math.random() * 0.6 + 0.4); }, (k) => k);
  p.uDistort.value = base;
}

/** Show the in-world "the game noticed you" message. */
export function fourthWall(g, text, opts = {}) {
  g.ui.toast(text, { glitch: true, dur: 4.5, ...opts });
}

export function realClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Bring two characters together into an embrace. */
export async function embrace(g, a, b, dist = 0.42) {
  const mid = a.root.position.clone().lerp(b.root.position, 0.5);
  const dir = b.root.position.clone().sub(a.root.position).setY(0).normalize();
  const pa = mid.clone().addScaledVector(dir, -dist / 2), pb = mid.clone().addScaledVector(dir, dist / 2);
  await Promise.all([g.walkTo(a, [pa.x, 0, pa.z], { speed: 0.8, stopDist: 0.03 }), g.walkTo(b, [pb.x, 0, pb.z], { speed: 0.8, stopDist: 0.03 })]);
  a.root.rotation.y = Math.atan2(dir.x, dir.z);
  b.root.rotation.y = a.root.rotation.y + Math.PI;
  a.state = 'hug'; b.state = 'hug';
}

/* ------------------------------------------------------------------ quarrels */

const GRAV = 9.8;

/**
 * A dish flies / falls from `from` to the floor near `to` and smashes into shards
 * that stay on the floor. Resolves on impact.
 */
export function breakDish(g, from, to, { kind = 'plate', dur = 0.5 } = {}) {
  const dish = new THREE.Group();
  const white = ps1Mat({ color: '#e8e4da' });
  if (kind === 'plate') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.025, 10), white); dish.add(m);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 3, 10), ps1Mat({ color: '#3a5a8a' })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.012; dish.add(rim);
  } else {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.1, 8), white); dish.add(m);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 3, 6), white); h.position.x = 0.05; h.rotation.y = Math.PI / 2; dish.add(h);
  }
  const a = from.clone(), b = to.clone().setY(0.02);
  dish.position.copy(a);
  g.add(dish);
  const up = 1.2;
  return g.tween(dur, (k) => {
    dish.position.lerpVectors(a, b, k);
    dish.position.y = a.y + (b.y - a.y) * k + up * 4 * k * (1 - k) * 0.25;
    dish.rotation.x = k * 6; dish.rotation.z = k * 3;
  }, (k) => k * k * 0.6 + k * 0.4).then(() => {
    g.scene.remove(dish);
    audio.plateBreak();
    g.shake(0.14, 0.5);
    const shards = [];
    for (let i = 0; i < 13; i++) {
      const geo = new THREE.TetrahedronGeometry(0.03 + Math.random() * 0.04, 0); geo.scale(1, 0.3, 1);
      const m = new THREE.Mesh(geo, i % 4 === 0 && kind === 'plate' ? ps1Mat({ color: '#3a5a8a' }) : white);
      m.position.copy(b).setY(0.03);
      const ang = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 2.2;
      m.userData.v = new THREE.Vector3(Math.cos(ang) * sp, 1 + Math.random() * 1.8, Math.sin(ang) * sp);
      m.userData.r = new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
      g.add(m); shards.push(m);
    }
    const off = g.onUpdate((dt) => {
      let moving = 0;
      for (const m of shards) {
        const v = m.userData.v;
        if (v.lengthSq() < 0.0004) continue;
        moving++;
        v.y -= GRAV * dt;
        m.position.addScaledVector(v, dt);
        m.rotation.x += m.userData.r.x * dt; m.rotation.z += m.userData.r.z * dt;
        if (m.position.y < 0.015) { m.position.y = 0.015; v.y = -v.y * 0.3; v.x *= 0.55; v.z *= 0.55; m.userData.r.multiplyScalar(0.5); }
      }
      if (!moving) off();
    });
  });
}

/** One shouted line: unintelligible raised voice + the words on screen + a little shake. */
export async function shout(g, speaker, c, text, gender, { anger = 0.8 } = {}) {
  if (c) { c.state = 'argue'; c.setExpression('angry'); }
  const dur = Math.max(1.0, Math.min(2.4, text.length * 0.055));
  audio.voice(gender, dur, anger);
  g.shake(0.05 + anger * 0.05, 0.4);
  await g.ui.say(speaker, text, { shout: true, auto: dur + 0.5, speed: 70, silent: true });
}
