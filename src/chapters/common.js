import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { globalUniforms } from '../engine/ps1.js';
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
  document.title = 'THE LAST MEMORY';
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
