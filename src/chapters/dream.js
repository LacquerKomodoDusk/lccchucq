// Nightmare pursuit segments between memories.
// The figure follows the player's exact trail. Collect memory shards to open
// the door to the next memory. Getting caught is never "death": the dream
// simply throws you back.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { NightmareFigure } from '../engine/character.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import * as T from '../engine/textures.js';
import { spawnHero, think, glitchBurst, fourthWall, setWorldMood } from './common.js';
import { WIFE_BASE } from '../config/family.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const THEMES = {
  field: { bg: 0x16181c, fog: [0x16181c, 2, 20], floor: () => T.grassTex([30, 30], '#2c3326'), wall: null, surface: 'grass' },
  apartment: { bg: 0x121214, fog: [0x121214, 1.5, 14], floor: () => T.woodTex([20, 20], '#3a2a20'), wall: () => T.wallpaperTex([2, 1], '#5d5648', '#4d4638'), surface: 'hard' },
  hospital: { bg: 0x141a1a, fog: [0x141a1a, 1.5, 15], floor: () => T.tilesTex('#6a706c', '#5e6460', [20, 20], '#3a3e3c'), wall: () => T.tilesTex('#7c8682', '#74807c', [2, 1], '#4a524e'), surface: 'hard' },
  concrete: { bg: 0x0f0f12, fog: [0x0f0f12, 1.2, 12], floor: () => T.concreteTex([20, 20], '#4a4a48'), wall: () => T.concreteTex([2, 1], '#55554f'), surface: 'hard' },
  flooded: { bg: 0x10151a, fog: [0x10151a, 1.5, 15], floor: () => T.waterTex([20, 20]), wall: () => T.concreteTex([2, 1], '#4a5052'), surface: 'wet' },
};

/**
 * cfg: {
 *   layout: 'field'|'maze', theme, size (maze cells), seed,
 *   reveal: 0..1, shards: [{text}], speed, delay,
 *   intro: async(g, ctx), events: [{at|shard, run}], caughtLine, doorLabel, outfit
 * }
 */
export async function dreamSegment(g, cfg) {
  const th = THEMES[cfg.theme || 'field'];
  g.newScene({ bg: th.bg, fog: th.fog, hemi: [0x6a7080, 0x151515, 0.55], sun: [0x8090b0, 0.25, [2, 6, 3]] });
  g.surface = th.surface;
  setWorldMood(g, { sat: 0.6, warp: cfg.warp ?? 0.15, noise: 0.05, distort: 0.02, tint: [0.92, 0.95, 1.05] });
  audio.playMusic('nightmare', { fade: 2 });
  audio.ambience('void', true, 0.7);
  const R = rng(cfg.seed ?? 7);
  const ctx = { start: new THREE.Vector3(), door: new THREE.Vector3(), shardPos: [] };

  if ((cfg.layout || 'field') === 'field') buildField(g, th, R, ctx, cfg);
  else buildMaze(g, th, R, ctx, cfg);

  B.motes(g, { color: 0x8d8a80 });

  // hero
  const hero = spawnHero(g, cfg.outfit || 'everyday', [ctx.start.x, 0, ctx.start.z], ctx.startRot ?? Math.PI);
  g.followCamera({ dist: 3.2, height: 1.8, lookH: 1.4 });
  g.snapCamera();

  // figure
  const fig = new NightmareFigure(WIFE_BASE);
  fig.setReveal(cfg.reveal ?? 0);
  g.add(fig.root);
  g.addActor(fig);
  fig.root.visible = false;

  // door (closed until shards collected)
  const doorGrp = new THREE.Group(); doorGrp.position.copy(ctx.door); doorGrp.rotation.y = ctx.doorRot ?? 0; g.add(doorGrp);
  const frameM = B.M({ color: '#2a2622' });
  B.box(g, 0.15, 2.3, 0.2, frameM, -0.55, 0, 0, { parent: doorGrp });
  B.box(g, 0.15, 2.3, 0.2, frameM, 0.55, 0, 0, { parent: doorGrp });
  B.box(g, 1.25, 0.15, 0.2, frameM, 0, 2.3, 0, { parent: doorGrp });
  const doorLeafM = B.M({ map: T.woodTex([1, 2], '#4a3a2a') });
  const leaf = B.box(g, 0.95, 2.25, 0.08, doorLeafM, 0, 0, 0, { parent: doorGrp });
  const doorLight = new THREE.PointLight(0xffd59a, 0, 6); doorLight.position.set(0, 1.4, 0.6); doorGrp.add(doorLight);
  g.collider(ctx.door.x - 0.7, ctx.door.x + 0.7, ctx.door.z - 0.2, ctx.door.z + 0.2);

  // shards
  const shards = cfg.shards || [];
  let collected = 0;
  const objective = () => g.ui.objective(collected < shards.length ? `Осколки воспоминаний: ${collected} / ${shards.length}` : 'Дверь открыта. Найди её.');
  objective();
  shards.forEach((s, i) => {
    const p = ctx.shardPos[i];
    const sh = B.memoryShard(g, p.x, 1.0, p.z);
    g.interact({
      pos: new THREE.Vector3(p.x, 0, p.z), radius: 1.3, label: 'Коснуться осколка', once: true, facing: false,
      onInteract: async () => {
        sh.remove();
        audio.ping();
        collected++;
        g.r.post.uWhite.value = 0.35;
        g.tween(0.6, (k) => { g.r.post.uWhite.value = 0.35 * (1 - k); }).catch(() => {});
        objective();
        if (s.text) g.ui.subtitle(s.text, 5);
        if (collected === 1 && !chase.active) startChase(cfg.delay ?? 2);
        for (const ev of cfg.events || []) if (ev.shard === collected && !ev.done) { ev.done = true; ev.run(g, ctx, fig).catch(() => {}); }
        if (collected >= shards.length) openDoor();
      },
    });
  });

  let doorOpen = false;
  const doorDone = new Promise((resolve) => {
    ctx.finish = resolve;
  });
  function openDoor() {
    doorOpen = true;
    audio.door();
    doorLeafM.emissive = new THREE.Color(0x3a2a12);
    g.tween(1.5, (k) => { doorLight.intensity = k * 2.2; leaf.position.x = k * 0.0; }).catch(() => {});
    g.interact({
      pos: new THREE.Vector3(ctx.door.x, 0, ctx.door.z), radius: 1.6, label: cfg.doorLabel || 'Открыть дверь', once: true,
      onInteract: async () => { ctx.finish(); },
    });
  }
  if (shards.length === 0) openDoor();

  /* ---------------- chase logic ---------------- */
  const trail = [];
  const chase = { active: false, idx: 0, stamina: 1, catching: false, timer: 0 };
  let sample = 0;
  function startChase(delay = 2) {
    chase.active = true;
    chase.wait = delay;
    trail.length = 0;
    trail.push(hero.root.position.clone());
    chase.idx = 0;
  }
  ctx.startChase = startChase;
  const speed = cfg.speed ?? 2.25;
  let heartbeatT = 0;
  g.onUpdate((dt) => {
    // stamina
    const running = input.isDown('run') && input.isDown('up') && g.controlEnabled;
    if (running && !g.noRun) chase.stamina = Math.max(0, chase.stamina - dt * 0.2);
    else chase.stamina = Math.min(1, chase.stamina + dt * 0.14);
    if (chase.stamina <= 0) g.noRun = true;
    if (g.noRun && chase.stamina > 0.35) g.noRun = false;
    g.ui.meter(chase.active ? 'ДЫХАНИЕ' : null, chase.stamina);

    if (!chase.active || chase.catching) return;
    // record trail
    sample += dt;
    const last = trail[trail.length - 1];
    if (sample > 0.15 && hero.root.position.distanceTo(last) > 0.35) { trail.push(hero.root.position.clone()); sample = 0; }
    if (chase.wait > 0) {
      chase.wait -= dt;
      if (chase.wait <= 0) { fig.root.visible = true; fig.root.position.copy(trail[0]); audio.whisper(1.2, 0.2); }
      return;
    }
    // the figure freezes while the player can't act (cutscenes, fake crash, dialogs)
    if (!g.controlEnabled || g.busy || g.ui.dlg) return;
    // move along trail
    let move = speed * dt;
    const p = fig.root.position;
    while (move > 0 && chase.idx < trail.length) {
      const tgt = trail[chase.idx];
      const d = Math.hypot(tgt.x - p.x, tgt.z - p.z);
      if (d <= move) { p.x = tgt.x; p.z = tgt.z; move -= d; chase.idx++; }
      else { p.x += (tgt.x - p.x) / d * move; p.z += (tgt.z - p.z) / d * move; move = 0; fig.root.rotation.y = Math.atan2(tgt.x - p.x, tgt.z - p.z); }
    }
    // if too far behind on the trail, skip ahead (the dream bends)
    const remaining = trail.length - chase.idx;
    if (remaining > 70) { chase.idx = trail.length - 45; p.copy(trail[chase.idx]); glitchBurst(g, 0.3, 0.3).catch(() => {}); }
    const dist = Math.hypot(hero.root.position.x - p.x, hero.root.position.z - p.z);
    // proximity effects
    const near = Math.max(0, 1 - dist / 9);
    g.r.post.uDistort.value = 0.02 + near * 0.25;
    fig.setGlitch(near * 0.25);
    heartbeatT -= dt;
    if (near > 0.2 && heartbeatT <= 0) { audio.heartbeat(audio.now, audio.sfx, 0.4 + near * 0.6); heartbeatT = 1.1 - near * 0.6; }
    if (dist < 0.95 && g.controlEnabled && !g.busy) caught();
  });

  async function caught() {
    chase.catching = true;
    g.control(false);
    hero.state = 'fear';
    hero.setExpression('fear');
    audio.gasp();
    fig.setGlitch(0.8);
    await glitchBurst(g, 0.8, 0.9);
    if (cfg.caughtLine) { g.ui.subtitle(cfg.caughtLine, 3); audio.whisper(2, 0.3); }
    await g.fade(1, 0.8);
    await g.wait(cfg.caughtLine ? 1.6 : 0.6);
    // respawn at the last shard / start
    const sp = ctx.checkpoint || ctx.start;
    hero.root.position.set(sp.x, 0, sp.z);
    hero.state = 'idle'; hero.setExpression('neutral');
    fig.root.visible = false; fig.setGlitch(0);
    g.r.post.uDistort.value = 0.02;
    g.snapCamera();
    chase.catching = false;
    startChase(3.5);
    await g.fade(0, 1);
    g.control(true);
  }

  // checkpoint = last collected shard
  const origOnUpdate = g.onUpdate((dt) => {
    for (const it of g.interactables) if (!it.enabled && it.label === 'Коснуться осколка' && !it.cp) { it.cp = true; ctx.checkpoint = it.pos.clone(); }
  });

  // timed events
  let elapsed = 0;
  g.onUpdate((dt) => {
    elapsed += dt;
    for (const ev of cfg.events || []) if (ev.at !== undefined && !ev.done && elapsed >= ev.at) { ev.done = true; ev.run(g, ctx, fig).catch(() => {}); }
  });

  if (cfg.pauseExtra) g.pauseExtra = cfg.pauseExtra;

  await g.fade(0, 2);
  if (cfg.intro) await cfg.intro(g, ctx, fig, hero);
  g.control(true);
  if (cfg.chaseFromStart) startChase(cfg.delay ?? 4);

  await doorDone;
  origOnUpdate();
  g.pauseExtra = null;
  g.control(false);
  g.noRun = false;
  g.ui.meter(null);
  g.ui.objective(null);
  audio.door();
  g.r.post.uWhite.value = 0;
  await g.tween(1.6, (k) => { g.r.post.uWhite.value = k; });
  g.setFade(1);
  g.r.post.uWhite.value = 0;
  audio.stopMusic(1.5);
  audio.stopAllAmbience();
  setWorldMood(g, {});
  await g.wait(0.8);
  return ctx;
}

/* ------------------------------------------------------------------ layouts */

function buildField(g, th, R, ctx, cfg) {
  B.plane(g, 80, 80, B.M({ map: th.floor() }), 0, 0, 0);
  const radius = 26;
  g.bounds = (p) => { const d = Math.hypot(p.x, p.z); if (d > radius) { p.x *= radius / d; p.z *= radius / d; } };
  // the edge of the forest is a visible old fence, not an invisible wall
  B.fenceRing(g, radius + 0.4, radius + 0.4, { segments: 56, color: '#2e2824', height: 1.4, solid: false });
  // a dense ring of dead trees just behind the fence
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + R() * 0.05;
    const d = radius + 1.6 + R() * 4;
    B.bareTree(g, Math.cos(a) * d, Math.sin(a) * d, { h: 4 + R() * 4, solid: false });
  }
  ctx.start.set(0, 0, 20); ctx.startRot = Math.PI;
  ctx.door.set(0, 0, -22); ctx.doorRot = 0;
  for (let i = 0; i < 40; i++) {
    const a = R() * Math.PI * 2, d = 6 + R() * 19;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - ctx.start.x, z - ctx.start.z) < 3 || Math.hypot(x - ctx.door.x, z - ctx.door.z) < 3) continue;
    if (R() < 0.35) B.lampPost(g, x, z, { on: R() < 0.6, intensity: 1.1, dist: 7, color: 0xd8c8a0 });
    else B.bareTree(g, x, z, { h: 3 + R() * 4 });
  }
  const n = (cfg.shards || []).length;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 1.1 + (R() - 0.5) * 0.3;
    const d = 10 + R() * 10;
    ctx.shardPos.push(new THREE.Vector3(Math.cos(a) * d * 1.1, 0, Math.sin(a) * d * 0.6 + 2));
  }
}

function buildMaze(g, th, R, ctx, cfg) {
  const C = cfg.size ?? 5, S = 4;
  const H = 3;
  const cells = Array.from({ length: C * C }, () => ({ e: false, s: false, seen: false }));
  const at = (x, y) => cells[y * C + x];
  // DFS maze
  const stack = [[0, 0]]; at(0, 0).seen = true;
  const depth = new Map([['0,0', 0]]);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < C && b < C && !at(a, b).seen);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny] = nb[Math.floor(R() * nb.length)];
    if (nx > x) at(x, y).e = true; if (nx < x) at(nx, ny).e = true;
    if (ny > y) at(x, y).s = true; if (ny < y) at(nx, ny).s = true;
    at(nx, ny).seen = true;
    depth.set(`${nx},${ny}`, depth.get(`${x},${y}`) + 1);
    stack.push([nx, ny]);
  }
  const ox = -C * S / 2, oz = -C * S / 2;
  const wallM = B.M({ map: th.wall() });
  const floorM = B.M({ map: th.floor() });
  B.plane(g, C * S, C * S, floorM, 0, 0, 0);
  B.plane(g, C * S, C * S, B.M({ color: '#151517' }), 0, H, 0, Math.PI / 2);
  const t = 0.3;
  // outer walls
  B.box(g, C * S + t, H, t, wallM, 0, 0, oz, { solid: true });
  B.box(g, C * S + t, H, t, wallM, 0, 0, -oz, { solid: true });
  B.box(g, t, H, C * S + t, wallM, ox, 0, 0, { solid: true });
  B.box(g, t, H, C * S + t, wallM, -ox, 0, 0, { solid: true });
  const center = (x, y) => new THREE.Vector3(ox + x * S + S / 2, 0, oz + y * S + S / 2);
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    const c = at(x, y);
    const cx = ox + x * S, cz = oz + y * S;
    if (!c.e && x < C - 1) B.box(g, t, H, S + t, wallM, cx + S, 0, cz + S / 2, { solid: true });
    if (!c.s && y < C - 1) B.box(g, S + t, H, t, wallM, cx + S / 2, 0, cz + S, { solid: true });
    if (R() < 0.3) B.lamp(g, cx + S / 2, H - 0.25, cz + S / 2, 0xd8d0b0, 0.9, 6);
  }
  // start = (0,0); door = deepest cell
  let far = [0, 0], fd = -1;
  for (const [k, d] of depth) if (d > fd) { fd = d; far = k.split(',').map(Number); }
  const st = center(0, 0);
  ctx.start.copy(st); ctx.startRot = 0;
  const dc = center(far[0], far[1]);
  // place door against a wall of the far cell
  const fc = at(far[0], far[1]);
  const openN = far[1] > 0 && at(far[0], far[1] - 1).s;
  ctx.door.set(dc.x, 0, dc.z + (openN ? S / 2 - 0.35 : -S / 2 + 0.35));
  ctx.doorRot = openN ? Math.PI : 0;
  void fc;
  // shards in dead ends
  const ends = [];
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    if ((x === 0 && y === 0) || (x === far[0] && y === far[1])) continue;
    const c = at(x, y);
    let n = 0;
    if (c.e) n++; if (c.s) n++; if (x > 0 && at(x - 1, y).e) n++; if (y > 0 && at(x, y - 1).s) n++;
    if (n === 1) ends.push([x, y]);
  }
  for (let y = 0; y < C && ends.length < (cfg.shards || []).length; y++) for (let x = 0; x < C; x++) if (!ends.some(([a, b]) => a === x && b === y) && !(x === 0 && y === 0) && !(x === far[0] && y === far[1])) ends.push([x, y]);
  ends.sort(() => R() - 0.5);
  (cfg.shards || []).forEach((_, i) => { const [x, y] = ends[i % ends.length]; ctx.shardPos.push(center(x, y)); });
  ctx.cell = center; ctx.C = C; ctx.S = S;
}

/** convenience: standard intro where the figure is seen far away */
export async function figureGlimpse(g, ctx, fig, hero, { dist = 14, text = null } = {}) {
  const dir = new THREE.Vector3(Math.sin(hero.root.rotation.y), 0, Math.cos(hero.root.rotation.y));
  fig.root.position.copy(hero.root.position).addScaledVector(dir, dist);
  fig.root.rotation.y = hero.root.rotation.y + Math.PI;
  fig.root.visible = true;
  audio.whisper(1.5, 0.15);
  if (text) await think(g, text);
  await g.wait(1.2);
  await glitchBurst(g, 0.4, 0.5);
  fig.root.visible = false;
}

export { fourthWall };
