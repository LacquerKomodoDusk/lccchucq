// Core game runtime: scene lifecycle, async scripting (wait / until), player
// controller, cameras, collisions, interactions, triggers, save data.
import * as THREE from 'three';
import { PS1Renderer, globalUniforms } from './ps1.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { Character } from './character.js';
import { UI } from '../ui/ui.js';

export class Abort extends Error { constructor() { super('aborted'); this.name = 'Abort'; } }

const SAVE_KEY = 'the-last-memory-save-v1';
const V = () => new THREE.Vector3();

export class Game {
  constructor(canvas) {
    this.r = new PS1Renderer(canvas);
    this.camera = new THREE.PerspectiveCamera(60, this.r.aspect, 0.05, 200);
    this.r.onResize = (a) => { this.camera.aspect = a; this.camera.updateProjectionMatrix(); };
    this.camera.aspect = this.r.aspect; this.camera.updateProjectionMatrix();
    this.ui = new UI(this);
    this.scene = new THREE.Scene();
    this.time = 0; this.dt = 0;
    this.session = 0;
    this.tasks = [];
    this.paused = false;
    this.fadeV = 1;
    this.fadeAnim = null;
    this.save = this.loadSave();
    this.startedAt = performance.now();
    this.resetSceneState();
    this.applySettings();
    this.clock = new THREE.Clock();
    const loop = () => { requestAnimationFrame(loop); this.frame(); };
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------ save */

  loadSave() {
    const def = { unlocked: 0, current: 0, settings: { crt: true, music: 0.8, sfx: 0.9 }, finished: false };
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) return { ...def, ...s, settings: { ...def.settings, ...(s.settings || {}) } }; } catch (e) { /* storage unavailable */ }
    return def;
  }
  writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* ignore */ } }
  applySettings() {
    this.r.setCRT(this.save.settings.crt);
    audio.setVolumes(this.save.settings.music, this.save.settings.sfx);
  }

  /* ------------------------------------------------------------ async scripting */

  /** Resolve when check() returns truthy. Rejects with Abort when the session changes. */
  until(check, onAbort = null) {
    const session = this.session;
    return new Promise((resolve, reject) => {
      this.tasks.push({ check, resolve, reject, session, onAbort });
    });
  }
  wait(sec) { let t = 0; return this.until(() => (t += this.dt) >= sec); }
  /** Abort all running scripts (chapter change / return to title). */
  abortAll() {
    this.session++;
    const tasks = this.tasks; this.tasks = [];
    for (const t of tasks) { try { t.onAbort && t.onAbort(); } catch (e) { /* noop */ } t.reject(new Abort()); }
  }
  /** Tween helper: fn(k) with k from 0..1 over dur seconds (smoothstep). */
  tween(dur, fn, ease = (k) => k * k * (3 - 2 * k)) {
    let t = 0;
    return this.until(() => { t += this.dt; const k = Math.min(1, t / dur); fn(ease(k)); return k >= 1; });
  }

  /* ------------------------------------------------------------ scene lifecycle */

  resetSceneState() {
    this.colliders = [];
    this.interactables = [];
    this.triggers = [];
    this.updaters = new Set();
    this.chars = [];
    this.player = null;
    this.controlEnabled = false;
    this.camMode = 'follow';
    this.camFixed = { pos: V(), look: V(), track: null };
    this.camFollow = { dist: 3.0, height: 1.75, lookH: 1.45, side: 0, smooth: 5 };
    this.bounds = null;
    this.surface = 'hard';
    this.playerRadius = null;
    this.speedMul = 1;
    this.turnSpeed = 2.6;
    this.debugGoal = null;
    this.activeInteract = null;
    this.busy = false;
    globalUniforms.uWarp.value = 0;
    const p = this.r.post;
    p.uDistort.value = 0; p.uWhite.value = 0; p.uSat.value = 0.85; p.uTint.value.set(1, 1, 1); p.uNoise.value = 0.035;
  }

  /** Create a fresh scene. opts: bg, fog [color, near, far], ambient, hemi [sky, ground, int], sun [color, int, dir] */
  newScene(opts = {}) {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.scene = new THREE.Scene();
    this.resetSceneState();
    const bg = new THREE.Color(opts.bg ?? 0x101114);
    this.scene.background = bg;
    if (opts.fog !== null) {
      const f = opts.fog ?? [opts.bg ?? 0x101114, 4, 22];
      this.scene.fog = new THREE.Fog(f[0], f[1], f[2]);
    }
    const h = opts.hemi ?? [0x8a8d99, 0x2a2622, 0.9];
    this.hemi = new THREE.HemisphereLight(h[0], h[1], h[2]);
    this.scene.add(this.hemi);
    if (opts.sun !== null) {
      const s = opts.sun ?? [0xffffff, 0.6, [3, 8, 4]];
      this.sun = new THREE.DirectionalLight(s[0], s[1]);
      this.sun.position.set(...s[2]);
      this.scene.add(this.sun);
    }
    this.ui.prompt(null); this.ui.objective(null); this.ui.meter(null); this.ui.battle(false);
    this.camera.fov = 60; this.camera.updateProjectionMatrix();
    return this.scene;
  }

  add(obj) { this.scene.add(obj); return obj; }
  onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  /** axis aligned box collider on XZ */
  collider(minX, maxX, minZ, maxZ, tag = null) { const c = { minX, maxX, minZ, maxZ, tag, on: true }; this.colliders.push(c); return c; }
  colliderFromMesh(mesh, pad = 0) {
    mesh.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(mesh);
    return this.collider(b.min.x - pad, b.max.x + pad, b.min.z - pad, b.max.z + pad);
  }

  /**
   * Interactable. opts: pos (Vector3), radius, label, onInteract(async), enabled, facing (bool)
   */
  interact(opts) {
    const it = { radius: 1.3, enabled: true, facing: true, once: false, ...opts };
    this.interactables.push(it);
    return it;
  }
  /** Trigger zone. opts: pos, radius OR box {minX,maxX,minZ,maxZ}; onEnter; once */
  trigger(opts) { const t = { once: true, fired: false, on: true, ...opts }; this.triggers.push(t); return t; }

  /* ------------------------------------------------------------ characters */

  spawn(spec, pos = [0, 0, 0], rotY = 0) {
    const c = new Character(spec);
    c.root.position.set(...pos);
    c.root.rotation.y = rotY;
    c._last = c.root.position.clone();
    c.speed = 0;
    this.scene.add(c.root);
    this.chars.push(c);
    return c;
  }
  addActor(obj) { obj._last = obj.root.position.clone(); obj.speed = 0; this.chars.push(obj); return obj; }

  setPlayer(c, { control = true } = {}) {
    this.player = c;
    this.playerState = { yaw: c.root.rotation.y, stepPhase: 0 };
    this.controlEnabled = control;
    this.camYaw = c.root.rotation.y;
    this.snapCamera();
  }
  control(on) { this.controlEnabled = on; if (!on && this.player) { this.player.state = 'idle'; } }

  /** Walk an NPC (or the player in a cutscene) to target, then resolve. */
  walkTo(c, target, { speed = 1.4, run = false, state = null, stopDist = 0.08 } = {}) {
    const tgt = new THREE.Vector3(target[0] ?? target.x, 0, target[2] ?? target.z);
    return this.until(() => {
      const p = c.root.position;
      const d = new THREE.Vector3(tgt.x - p.x, 0, tgt.z - p.z);
      const len = d.length();
      if (len < stopDist) { c.state = 'idle'; return true; }
      const ang = Math.atan2(d.x, d.z);
      c.root.rotation.y = lerpAngle(c.root.rotation.y, ang, Math.min(1, this.dt * 8));
      const step = Math.min(len, speed * this.dt);
      p.addScaledVector(d.normalize(), step);
      c.state = state || (run ? 'run' : 'walk');
      return false;
    });
  }
  faceTo(c, target, dur = 0.4) {
    const p = c.root.position;
    const ang = Math.atan2((target.x ?? target[0]) - p.x, (target.z ?? target[2]) - p.z);
    const from = c.root.rotation.y;
    return this.tween(dur, (k) => { c.root.rotation.y = lerpAngle(from, ang, k); });
  }

  /* ------------------------------------------------------------ camera */

  snapCamera() {
    if (!this.player) return;
    this.camYaw = this.player.root.rotation.y;
    this.updateCamera(1, true);
  }
  setFixedCamera(pos, look, track = null) {
    this.camMode = 'fixed';
    this.camFixed.pos.set(...pos); this.camFixed.look.set(...look); this.camFixed.track = track;
    this.camera.position.copy(this.camFixed.pos);
    this.camera.lookAt(this.camFixed.look);
  }
  followCamera(opts = {}) { this.camMode = 'follow'; Object.assign(this.camFollow, opts); }
  /** cinematic camera move */
  async camMove(pos, look, dur = 2) {
    this.camMode = 'script';
    const p0 = this.camera.position.clone();
    const l0 = this.camLook ? this.camLook.clone() : this.camera.getWorldDirection(V()).add(p0);
    const p1 = new THREE.Vector3(...pos), l1 = new THREE.Vector3(...look);
    this.camLook = l0.clone();
    await this.tween(dur, (k) => {
      this.camera.position.lerpVectors(p0, p1, k);
      this.camLook.lerpVectors(l0, l1, k);
      this.camera.lookAt(this.camLook);
    });
  }
  camSet(pos, look) {
    this.camMode = 'script';
    this.camera.position.set(...pos);
    this.camLook = new THREE.Vector3(...look);
    this.camera.lookAt(this.camLook);
  }

  updateCamera(dt, snap = false) {
    const cam = this.camera;
    if (this.camMode === 'follow' && this.player) {
      const f = this.camFollow;
      const p = this.player.root.position;
      this.camYaw = lerpAngle(this.camYaw ?? 0, this.player.root.rotation.y, snap ? 1 : Math.min(1, dt * 2.2));
      let dist = f.dist;
      const dir = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
      // pull camera in if it would sit inside a wall
      for (let d = 0.6; d <= f.dist; d += 0.15) {
        const x = p.x - dir.x * d, z = p.z - dir.z * d;
        if (this.pointBlocked(x, z, 0.12)) { dist = Math.max(0.6, d - 0.2); break; }
      }
      const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(f.side);
      const want = new THREE.Vector3(p.x - dir.x * dist + side.x, p.y + f.height, p.z - dir.z * dist + side.z);
      if (snap) cam.position.copy(want); else cam.position.lerp(want, Math.min(1, dt * f.smooth));
      const look = new THREE.Vector3(p.x + dir.x * 0.8, p.y + f.lookH, p.z + dir.z * 0.8);
      this.camLook = look;
      cam.lookAt(look);
    } else if (this.camMode === 'fixed') {
      cam.position.copy(this.camFixed.pos);
      const tr = this.camFixed.track;
      if (tr) {
        const want = tr.root ? tr.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)) : tr.clone();
        this.camLook = this.camLook ? this.camLook.lerp(want, Math.min(1, dt * 4)) : want;
        cam.lookAt(this.camLook);
      } else cam.lookAt(this.camFixed.look);
    }
  }

  /* ------------------------------------------------------------ collision */

  pointBlocked(x, z, r) {
    for (const c of this.colliders) {
      if (!c.on) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }
  resolve(pos, r = 0.28) {
    for (let it = 0; it < 2; it++) {
      for (const c of this.colliders) {
        if (!c.on) continue;
        if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
          const pushL = pos.x + r - c.minX, pushR = c.maxX - (pos.x - r);
          const pushB = pos.z + r - c.minZ, pushF = c.maxZ - (pos.z - r);
          const m = Math.min(pushL, pushR, pushB, pushF);
          if (m === pushL) pos.x -= pushL; else if (m === pushR) pos.x += pushR; else if (m === pushB) pos.z -= pushB; else pos.z += pushF;
        }
      }
    }
    if (this.bounds) this.bounds(pos);
  }

  /* ------------------------------------------------------------ player */

  updatePlayer(dt) {
    const c = this.player; if (!c) return;
    if (!this.controlEnabled || this.busy || this.ui.dlg) { if (c.state === 'walk' || c.state === 'run') c.state = 'idle'; return; }
    const ps = this.playerState;
    const turn = (input.isDown('left') ? 1 : 0) - (input.isDown('right') ? 1 : 0);
    const fwd = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
    const running = input.isDown('run') && fwd > 0 && !this.noRun;
    c.root.rotation.y += turn * dt * (this.turnSpeed ?? 2.6);
    const speed = fwd > 0 ? (running ? 3.7 : 1.75) * (this.speedMul ?? 1) : fwd < 0 ? -1.0 * (this.speedMul ?? 1) : 0;
    if (speed !== 0) {
      const yaw = c.root.rotation.y;
      const p = c.root.position;
      p.x += Math.sin(yaw) * speed * dt;
      p.z += Math.cos(yaw) * speed * dt;
      this.resolve(p, this.playerRadius ?? 0.28);
      if (c.state !== 'scary') c.state = running ? 'run' : 'walk';
      ps.stepPhase += dt * Math.abs(speed) * (running ? 1.6 : 1.9);
      if (ps.stepPhase > 1) { ps.stepPhase -= 1; audio.step(this.surface, running); }
    } else if (c.state === 'walk' || c.state === 'run') c.state = 'idle';
    else if (turn !== 0 && c.state === 'idle') { ps.stepPhase += dt * 1.5; if (ps.stepPhase > 1) { ps.stepPhase -= 1; audio.step(this.surface, false); } }

    // triggers
    for (const t of this.triggers) {
      if (!t.on || (t.once && t.fired)) continue;
      const p = c.root.position;
      let inside;
      if (t.box) inside = p.x > t.box.minX && p.x < t.box.maxX && p.z > t.box.minZ && p.z < t.box.maxZ;
      else inside = Math.hypot(p.x - t.pos.x, p.z - t.pos.z) < t.radius;
      if (inside && !t.inside) { t.fired = true; t.onEnter && t.onEnter(t); }
      t.inside = inside;
    }

    // interactables
    let best = null, bestD = 1e9;
    const fwdV = new THREE.Vector3(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y));
    for (const it of this.interactables) {
      if (!it.enabled) continue;
      const pos = typeof it.pos === 'function' ? it.pos() : it.pos;
      const d = Math.hypot(pos.x - c.root.position.x, pos.z - c.root.position.z);
      if (d > it.radius) continue;
      if (it.facing) {
        const to = new THREE.Vector3(pos.x - c.root.position.x, 0, pos.z - c.root.position.z).normalize();
        if (d > 0.45 && to.dot(fwdV) < 0.35) continue;
      }
      if (d < bestD) { best = it; bestD = d; }
    }
    this.activeInteract = best;
    this.ui.prompt(best ? `${this.promptKey ?? 'E'} — ${best.label}` : null);
    if (best && input.pressed('act') && !this.actConsumed) {
      this.ui.prompt(null);
      if (best.once) best.enabled = false;
      this.busy = true;
      c.state = 'idle';
      Promise.resolve(best.onInteract(best)).catch((e) => { if (!(e instanceof Abort)) console.error(e); }).finally(() => { this.busy = false; });
    }
  }

  /* ------------------------------------------------------------ fade */

  fade(to, dur = 1) {
    const from = this.fadeV;
    return this.tween(dur, (k) => { this.fadeV = from + (to - from) * k; }, (k) => k);
  }
  setFade(v) { this.fadeV = v; }

  /** real-world minutes since the game was opened (used by fourth-wall moments) */
  playMinutes() { return Math.max(1, Math.round((performance.now() - this.startedAt) / 60000)); }

  /* ------------------------------------------------------------ main frame */

  frame() {
    let dt = Math.min(0.05, this.clock.getDelta()) * (this.timeScale ?? 1);
    if (this.paused) dt = 0;
    this.dt = dt;
    this.time += dt;
    globalUniforms.uTime.value += dt;

    if (!this.paused) {
      // tasks
      const tasks = this.tasks;
      this.tasks = [];
      const keep = [];
      for (const t of tasks) {
        if (t.session !== this.session) { t.reject(new Abort()); continue; }
        let r;
        try { r = t.check(); } catch (e) { t.reject(e); continue; }
        if (r) t.resolve(r); else keep.push(t);
      }
      this.tasks = keep.concat(this.tasks);

      this.updatePlayer(dt);
      for (const fn of [...this.updaters]) fn(dt, this.time);
      for (const c of this.chars) {
        const p = c.root.position;
        const sp = dt > 0 ? Math.hypot(p.x - c._last.x, p.z - c._last.z) / dt : 0;
        c.speed = c.speed + (sp - c.speed) * Math.min(1, dt * 10);
        c._last.copy(p);
        c.update(dt, c.speed);
      }
      this.updateCamera(dt);
      this.ui.update(dt);
    }
    this.actConsumed = false;
    if (this.onFrame) this.onFrame(dt);
    document.getElementById('fade').style.opacity = this.fadeV;
    this.r.render(this.scene, this.camera);
    input.endFrame();
  }
}

export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
