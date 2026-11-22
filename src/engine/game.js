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
    this.camera = new THREE.PerspectiveCamera(60, this.r.aspect, 0.1, 160);
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
    this.dlgCam = null;
    this.lockCam = false;
    this.handheld = 0;
    this.shakeAmt = 0;
    this.activeInteract = null;
    this.busy = false;
    globalUniforms.uWarp.value = 0;
    const p = this.r.post;
    p.uDistort.value = 0; p.uWhite.value = 0; p.uSat.value = 0.85; p.uTint.value.set(1, 1, 1); p.uNoise.value = 0.035;
  }

  /** Create a fresh scene. opts: bg, fog [color, near, far], ambient, hemi [sky, ground, int], sun [color, int, dir] */
  newScene(opts = {}) {
    if (!this._keepScene) this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this._keepScene = false;
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
      // soft fill from the opposite side, tinted toward the sky colour (warm key / cool fill)
      this.fill = new THREE.DirectionalLight(new THREE.Color(h[0]).lerp(new THREE.Color(0x8090b0), 0.5), s[1] * 0.35);
      this.fill.position.set(-s[2][0], s[2][1] * 0.6, -s[2][2]);
      this.scene.add(this.fill);
    }
    this.ui.prompt(null); this.ui.objective(null); this.ui.meter(null); this.ui.battle(false);
    this.camera.fov = 60; this.camera.updateProjectionMatrix();
    this.letterbox(false);
    return this.scene;
  }

  add(obj) { this.scene.add(obj); return obj; }

  /** Keep the current scene aside (e.g. the arena) while a flashback plays. */
  pushScene() {
    const p = this.r.post;
    this._stack = this._stack || [];
    this._stack.push({
      scene: this.scene, colliders: this.colliders, interactables: this.interactables, triggers: this.triggers,
      updaters: this.updaters, chars: this.chars, player: this.player, playerState: this.playerState,
      controlEnabled: this.controlEnabled, camMode: this.camMode, camFollow: { ...this.camFollow }, bounds: this.bounds,
      surface: this.surface, camYaw: this.camYaw, camPitch: this.camPitch, fov: this.camera.fov,
      camPos: this.camera.position.clone(), camLook: this.camLook ? this.camLook.clone() : null,
      hemi: this.hemi, sun: this.sun, fill: this.fill, warp: globalUniforms.uWarp.value,
      post: { d: p.uDistort.value, sat: p.uSat.value, tint: p.uTint.value.clone(), noise: p.uNoise.value },
    });
    this._keepScene = true;
  }
  popScene() {
    const st = this._stack.pop();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    Object.assign(this, {
      scene: st.scene, colliders: st.colliders, interactables: st.interactables, triggers: st.triggers, updaters: st.updaters,
      chars: st.chars, player: st.player, playerState: st.playerState, controlEnabled: st.controlEnabled, camMode: st.camMode,
      bounds: st.bounds, surface: st.surface, camYaw: st.camYaw, camPitch: st.camPitch, camLook: st.camLook,
      hemi: st.hemi, sun: st.sun, fill: st.fill,
    });
    this.camFollow = st.camFollow;
    this.camera.fov = st.fov; this.camera.updateProjectionMatrix();
    this.camera.position.copy(st.camPos);
    if (st.camLook) this.camera.lookAt(st.camLook);
    globalUniforms.uWarp.value = st.warp;
    const p = this.r.post;
    p.uDistort.value = st.post.d; p.uSat.value = st.post.sat; p.uTint.value.copy(st.post.tint); p.uNoise.value = st.post.noise;
    this.letterbox(false);
    this._occ = null;
  }
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
  addActor(obj) {
    obj._last = obj.root.position.clone(); obj.speed = 0; this.chars.push(obj);
    obj.root.traverse((o) => { o.userData.character = true; });
    return obj;
  }

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

  /* ---------------- camera never goes through geometry ---------------- */

  buildOccluders() {
    const list = [];
    const v = new THREE.Vector3();
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.visible || o.userData.character || o.userData.noOcclude) return;
      let p = o.parent, hidden = false;
      while (p) { if (!p.visible || p.userData.character) { hidden = true; break; } p = p.parent; }
      if (hidden) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || (m.transparent && m.opacity < 0.9) || m.blending === THREE.AdditiveBlending) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(v);
      if (o.geometry.boundingSphere.radius * Math.max(v.x, v.y, v.z) < 0.22) return; // small props don't push the camera
      list.push(o);
    });
    this._occ = list;
  }

  /** pull the camera in front of anything between it and what it looks at */
  avoidOcclusion() {
    const look = this.camLook;
    if (!look || this.noOcclusion) return;
    this._occFrame = (this._occFrame ?? 0) + 1;
    if (!this._occ || this._occScene !== this.scene || this._occFrame % 45 === 0) { this.buildOccluders(); this._occScene = this.scene; }
    const cam = this.camera.position;
    const dir = cam.clone().sub(look);
    const dist = dir.length();
    if (dist < 0.35) return;
    dir.divideScalar(dist);
    if (!this._ray) this._ray = new THREE.Raycaster();
    this._ray.set(look, dir);
    this._ray.near = 0.05; this._ray.far = dist;
    const hits = this._ray.intersectObjects(this._occ, false);
    if (hits.length) {
      const d = Math.max(0.3, hits[0].distance - 0.2);
      cam.copy(look).addScaledVector(dir, d);
    }
  }

  updateCamera(dt, snap = false) {
    const cam = this.camera;
    if (this.camMode === 'follow' && this.player) {
      const f = this.camFollow;
      const p = this.player.root.position;
      if (snap) { this.camYaw = this.player.root.rotation.y; this.camPitch = 0.25; }
      // mouse orbit
      this.camYaw = (this.camYaw ?? 0) - input.mouseDX * 0.0032;
      this.camPitch = Math.max(-0.35, Math.min(1.1, (this.camPitch ?? 0.25) + input.mouseDY * 0.0026));
      const pitch = this.camPitch;
      let dist = f.dist;
      const dir = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
      // pull camera in if it would sit inside a wall
      for (let d = 0.6; d <= f.dist; d += 0.15) {
        const x = p.x - dir.x * d, z = p.z - dir.z * d;
        if (this.pointBlocked(x, z, 0.12)) { dist = Math.max(0.6, d - 0.2); break; }
      }
      const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(f.side);
      const hd = dist * Math.cos(pitch - 0.25);
      const want = new THREE.Vector3(p.x - dir.x * hd + side.x, p.y + f.lookH + (f.height - f.lookH) + Math.sin(pitch - 0.25) * dist, p.z - dir.z * hd + side.z);
      want.y = Math.max(p.y + 0.3, want.y);
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
    if (!this.controlEnabled || this.busy || this.ui.dlg) {
      if (this.playerState && this.playerState.vel) this.playerState.vel.set(0, 0, 0);
      if (c.state === 'walk' || c.state === 'run') c.state = 'idle';
      return;
    }
    const ps = this.playerState;
    const ix = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const iz = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
    const moving = (ix !== 0 || iz !== 0) && (this.speedMul ?? 1) > 0;
    const running = input.isDown('run') && moving && !this.noRun;
    const vel = ps.vel || (ps.vel = new THREE.Vector3());
    const want = new THREE.Vector3();
    if (moving) {
      // directions relative to the camera: W = away from camera, A/D = strafe
      const yaw = this.camMode === 'follow' ? this.camYaw : c.root.rotation.y;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const rx = -fz, rz = fx; // screen-right
      let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const speed = (running ? 3.7 : 1.75) * (this.speedMul ?? 1);
      want.set(mx * speed, 0, mz * speed);
      // turn toward the movement direction; a sharp turn slows you down a little
      const target = Math.atan2(mx, mz);
      const before = c.root.rotation.y;
      c.root.rotation.y = lerpAngle(before, target, Math.min(1, dt * (running ? 7 : 9)));
      const turnErr = Math.abs(lerpAngle(0, target - c.root.rotation.y, 1));
      if (turnErr > 1.2) want.multiplyScalar(0.35);
    }
    // acceleration / deceleration instead of instant start & stop
    const rate = moving ? (want.length() > vel.length() ? 7 : 5) : 9;
    vel.lerp(want, 1 - Math.exp(-dt * rate));
    if (!moving && vel.length() < 0.05) vel.set(0, 0, 0);
    const sp = vel.length();
    if (sp > 0) {
      const p = c.root.position;
      p.x += vel.x * dt;
      p.z += vel.z * dt;
      const ox = p.x, oz = p.z;
      this.resolve(p, this.playerRadius ?? 0.28);
      // sliding along walls: drop the blocked part of the velocity
      if (Math.abs(p.x - ox) > 1e-4) vel.x *= 0.3;
      if (Math.abs(p.z - oz) > 1e-4) vel.z *= 0.3;
    }
    if (c.state !== 'scary') {
      if (sp > 0.25) c.state = sp > 2.6 ? 'run' : 'walk';
      else if (c.state === 'walk' || c.state === 'run') c.state = 'idle';
    }

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

  /* ---------------- cinematic camera ---------------- */

  /** tween the field of view */
  fovTo(fov, dur = 1, ease) {
    const f0 = this.camera.fov;
    return this.tween(dur, (k) => { this.camera.fov = f0 + (fov - f0) * k; this.camera.updateProjectionMatrix(); }, ease);
  }

  /** slow orbit around a point: angles in radians, height & radius may change during the move */
  camOrbit(center, { r0 = 3, r1 = r0, h0 = 1.6, h1 = h0, a0 = 0, a1 = 1, look = 1.4, dur = 6 } = {}) {
    this.camMode = 'script';
    const c = new THREE.Vector3(...(Array.isArray(center) ? center : center.toArray()));
    return this.tween(dur, (k) => {
      const a = a0 + (a1 - a0) * k, r = r0 + (r1 - r0) * k, h = h0 + (h1 - h0) * k;
      this.camera.position.set(c.x + Math.sin(a) * r, h, c.z + Math.cos(a) * r);
      this.camLook = new THREE.Vector3(c.x, look, c.z);
      this.camera.lookAt(this.camLook);
    }, (k) => k * k * (3 - 2 * k));
  }

  /** slow push-in toward the current look target */
  pushIn(amount = 0.6, dur = 3) {
    this.camMode = 'script';
    const p0 = this.camera.position.clone();
    const look = this.camLook ? this.camLook.clone() : p0.clone().add(this.camera.getWorldDirection(new THREE.Vector3()));
    const dir = look.clone().sub(p0).normalize();
    return this.tween(dur, (k) => { this.camera.position.copy(p0).addScaledVector(dir, amount * k); this.camera.lookAt(look); }, (k) => 1 - (1 - k) * (1 - k));
  }

  /** "vertigo" dolly-zoom: the subject keeps its size while the world stretches */
  async dollyZoom(target, { dist0 = 1.2, dist1 = 3.2, fov0 = 60, height = 1.6, dir = null, dur = 1.6 } = {}) {
    this.camMode = 'script';
    const t = new THREE.Vector3(...(Array.isArray(target) ? target : target.toArray()));
    const d = dir ? new THREE.Vector3(...dir).normalize() : this.camera.position.clone().sub(t).setY(0).normalize();
    const width = 2 * dist0 * Math.tan(THREE.MathUtils.degToRad(fov0 / 2));
    await this.tween(dur, (k) => {
      const dist = dist0 + (dist1 - dist0) * k;
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(width / (2 * dist)));
      this.camera.updateProjectionMatrix();
      this.camera.position.set(t.x + d.x * dist, height, t.z + d.z * dist);
      this.camLook = t.clone();
      this.camera.lookAt(t);
    });
  }

  /** reset lens after a cinematic shot */
  resetLens() { this.camera.fov = 60; this.camera.updateProjectionMatrix(); this.handheld = 0; this.letterbox(false); }

  /* ---------------- dialogue coverage (shot / reverse shot) ---------------- */

  /** find the character who speaks a line */
  speakerChar(name) {
    if (name === 'Ты') return this.player;
    if (name === 'Она') {
      let best = null, bd = 1e9;
      for (const c of this.chars) {
        if (!c.spec || c.spec.name !== 'wife' || !c.root.visible) continue;
        const d = this.player ? c.root.position.distanceTo(this.player.root.position) : 0;
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    }
    return null;
  }

  /**
   * Cut to a dialogue shot for this line: over-the-shoulder, close-up or two-shot,
   * varied line by line. Returns false if no shot was taken.
   */
  dialogShot(name) {
    if (this.lockCam || (this.controlEnabled && !this.busy)) return false;
    const S = this.speakerChar(name);
    if (!S) return false;
    const L = name === 'Ты' ? this.speakerChar('Она') : this.player;
    if (!this.dlgCam) this.dlgCam = { n: 0, saved: null };
    const dc = this.dlgCam;
    if (!dc.saved) dc.saved = { mode: this.camMode, pos: this.camera.position.clone(), look: this.camLook ? this.camLook.clone() : null, fov: this.camera.fov, fixed: { ...this.camFixed, pos: this.camFixed.pos.clone(), look: this.camFixed.look.clone() } };
    clearTimeout(dc.restoreT);
    const se = S.eyePos();
    const n = dc.n++;
    const near = L && L !== S && L.root.position.distanceTo(S.root.position) < 4;
    const shots = [];
    if (near) {
      const le = L.eyePos();
      const axis = new THREE.Vector3(se.x - le.x, 0, se.z - le.z).normalize();
      const right = new THREE.Vector3(-axis.z, 0, axis.x);
      const side = n % 2 ? 1 : -1;
      // over the listener's shoulder onto the speaker
      const gap = L.root.position.distanceTo(S.root.position);
      if (gap < 2.6) shots.push({ pos: le.clone().addScaledVector(axis, -1.0).addScaledVector(right, 0.5 * side).add(new THREE.Vector3(0, 0.12, 0)), look: se.clone().add(new THREE.Vector3(0, -0.05, 0)), fov: 40 });
      // close-up of the speaker, slightly off-axis
      shots.push({ pos: se.clone().addScaledVector(axis, -1.25).addScaledVector(right, 0.55 * side).add(new THREE.Vector3(0, -0.02, 0)), look: se.clone().add(new THREE.Vector3(0, -0.08, 0)), fov: 32 });
      // two-shot from the side
      const mid = se.clone().lerp(le, 0.5);
      shots.push({ pos: mid.clone().addScaledVector(right, 2.6 * side).add(new THREE.Vector3(0, 0.05, 0)), look: mid.clone().add(new THREE.Vector3(0, -0.15, 0)), fov: 44 });
    } else {
      const f = S.headDir();
      shots.push({ pos: se.clone().addScaledVector(f, 1.3).add(new THREE.Vector3(0.3, 0, 0)), look: se.clone(), fov: 34 });
    }
    const order = [0, 1, 0, 2, 1, 0];
    let shot = shots[order[n % order.length] % shots.length];
    // never put the camera inside a wall: fall back to another framing
    for (let i = 0; i < shots.length && this.pointBlocked(shot.pos.x, shot.pos.z, 0.1); i++) shot = shots[(order[n % order.length] + i + 1) % shots.length];
    if (this.pointBlocked(shot.pos.x, shot.pos.z, 0.1)) return false;
    // standing characters turn to each other when they talk
    if (near) {
      for (const [a, b] of [[S, L], [L, S]]) {
        if (a.state !== 'idle' && a.state !== 'walk') continue;
        const want = Math.atan2(b.root.position.x - a.root.position.x, b.root.position.z - a.root.position.z);
        const from = a.root.rotation.y;
        this.tween(0.35, (k) => { a.root.rotation.y = lerpAngle(from, want, k); }).catch(() => {});
      }
    }
    // don't put the lens inside somebody's head
    const headHit = (pos) => this.chars.some((c) => c.eyePos && c.root.visible && c.eyePos().distanceTo(pos) < 0.32);
    if (headHit(shot.pos)) { const alt = shots.find((sh) => !headHit(sh.pos) && !this.pointBlocked(sh.pos.x, sh.pos.z, 0.1)); if (alt) shot = alt; }
    this.camMode = 'script';
    this.camera.fov = shot.fov; this.camera.updateProjectionMatrix();
    this.camera.position.copy(shot.pos);
    this.camLook = shot.look.clone();
    this.camera.lookAt(this.camLook);
    this.avoidOcclusion();
    this.camera.lookAt(this.camLook);
    shot = { ...shot, pos: this.camera.position.clone() };
    this.handheld = Math.max(this.handheld ?? 0, 0.25);
    dc.usedHand = true;
    dc.shotPos = shot.pos.clone();
    return true;
  }

  /** after the last line of an exchange, put the camera back where the scene had it */
  endDialogShot() {
    const dc = this.dlgCam;
    if (!dc || !dc.saved) return;
    clearTimeout(dc.restoreT);
    dc.restoreT = setTimeout(() => {
      if (this.ui.dlg) return; // another line already started
      const sv = dc.saved; dc.saved = null; dc.n = 0;
      if (this.session !== dc.session) return;
      if (dc.usedHand) { this.handheld = 0; dc.usedHand = false; }
      // the script already moved the camera on: leave its new shot alone
      if (dc.shotPos && this.camera.position.distanceTo(dc.shotPos) > 0.05) return;
      this.camera.fov = sv.fov; this.camera.updateProjectionMatrix();
      this.camMode = sv.mode;
      if (sv.mode !== 'follow') { this.camera.position.copy(sv.pos); if (sv.look) { this.camLook = sv.look; this.camera.lookAt(sv.look); } }
      if (dc.usedHand) { this.handheld = 0; dc.usedHand = false; }
    }, 180);
    dc.session = this.session;
  }

  /** camera shake: amount ~0.1 small, 0.3 strong */
  shake(amount = 0.2, decay = 0.6) { this.shakeAmt = Math.max(this.shakeAmt ?? 0, amount); this.shakeDecay = decay; }

  /** cinematic letterbox bars */
  letterbox(on) { document.getElementById('letterbox').classList.toggle('on', !!on); }

  /** real-world minutes since the game was opened (used by fourth-wall moments) */
  playMinutes() { return Math.max(1, Math.round((performance.now() - this.startedAt) / 60000)); }

  /* ------------------------------------------------------------ main frame */

  frame() {
    let dt = Math.min(0.05, this.clock.getDelta()) * (this.timeScale ?? 1);
    if (this.paused) dt = 0;
    this.dt = dt;
    this.time += dt;
    globalUniforms.uTime.value += dt;

    input.beginFrame();
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
      // footsteps follow the walk animation (one per foot contact)
      const pl = this.player;
      if (pl && pl.stepped && (pl.state === 'walk' || pl.state === 'run') && pl.speed > 0.3) audio.step(this.surface, pl.state === 'run');
      for (const c of this.chars) c.stepped = false;
      this.updateCamera(dt);
      this.avoidOcclusion();
      this.ui.update(dt);
    }
    this.actConsumed = false;
    if (this.onFrame) this.onFrame(dt);
    document.getElementById('fade').style.opacity = this.fadeV;
    // camera shake (handheld / impacts): applied only for this render
    this.shakeAmt = Math.max(0, (this.shakeAmt ?? 0) - dt * (this.shakeDecay ?? 1));
    const hand = this.handheld ?? 0;
    const sh = this.shakeAmt * this.shakeAmt + hand * 0.012;
    const off = new THREE.Vector3();
    if (sh > 0) {
      const tt = this.time;
      off.set((Math.sin(tt * 23.1) + Math.sin(tt * 7.3)) * sh, (Math.sin(tt * 19.7) + Math.cos(tt * 5.1)) * sh * 0.7, (Math.cos(tt * 17.3)) * sh * 0.5);
      if (hand) off.add(new THREE.Vector3(Math.sin(tt * 0.9) * hand * 0.02, Math.sin(tt * 1.3) * hand * 0.015, 0));
      this.camera.position.add(off);
    }
    this.r.render(this.scene, this.camera);
    if (sh > 0) this.camera.position.sub(off);
    input.endFrame();
  }
}

export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
