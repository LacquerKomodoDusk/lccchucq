// FINALE — the mirror battle, the last memory (the bus), the embrace and the
// reveal, the world breaking apart, the road in the rain, the children.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import * as T from '../engine/textures.js';
import { NightmareFigure } from '../engine/character.js';
import { globalUniforms } from '../engine/ps1.js';
import { heroSpec, wifeSpec, CHILDREN, WIFE_BASE, YOUNG } from '../config/family.js';
import { STORY } from '../config/story.js';
import { buildBusWorld, lookAtYaw, sitAt, HERO_SEAT, GIRL_SEAT } from './bus.js';
import { think, chapterStart, setWorldMood, glitchBurst, fourthWall, V3 } from './common.js';
import { lerpAngle } from '../engine/game.js';
import { playFlashback, FLASHBACK_COUNT } from './flashbacks.js';

/* ======================================================================== */
/*  ARENA                                                                   */
/* ======================================================================== */

function buildArena(g) {
  g.newScene({ bg: 0x1e1220, fog: [0x1e1220, 8, 40], hemi: [0xb898b8, 0x2a1820, 1.1], sun: [0xe090a0, 0.6, [0, 10, 6]] });
  setWorldMood(g, { sat: 0.65, tint: [1.05, 0.92, 1.0], noise: 0.05, warp: 0.1 });
  const pieces = [];
  const tileM = B.M({ map: T.concreteTex([1, 1], '#4a4448') });
  // platform from wedge tiles (so it can shatter later)
  const rings = [[0, 3, 6], [3, 6, 12], [6, 9, 18]];
  for (const [r0, r1, n] of rings) {
    for (let i = 0; i < n; i++) {
      const geo = new THREE.RingGeometry(Math.max(0.01, r0), r1, 2, 1, (i / n) * Math.PI * 2, (Math.PI * 2) / n);
      const m = new THREE.Mesh(geo, tileM);
      m.rotation.x = -Math.PI / 2; m.position.y = 0;
      m.userData.d = (r0 + r1) / 2;
      g.add(m); pieces.push(m);
      const side = new THREE.Mesh(new THREE.CylinderGeometry(r1, r1 * 0.9, 1.4, 2, 1, true, (i / n) * Math.PI * 2, (Math.PI * 2) / n), B.M({ color: '#2a2228', side: THREE.DoubleSide }));
      if (r1 === 9) { side.position.y = -0.7; side.userData.d = 9; g.add(side); pieces.push(side); }
    }
  }
  // broken pillars & floating memories
  const pm = B.M({ map: T.concreteTex([1, 3], '#5a5458') });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const h = 1.5 + (i * 37 % 5) * 0.7;
    const p = B.box(g, 0.6, h, 0.6, pm, Math.cos(a) * 10.5, 0, Math.sin(a) * 10.5);
    p.rotation.z = (i % 3 - 1) * 0.08;
    pieces.push(p);
  }
  const floaters = [];
  const seat = B.M({ map: T.seatTex([1, 1]) });
  const card = B.M({ map: T.noiseTex('#9a7a50', { amount: 0.2, seed: 22 }) });
  const red = B.M({ map: T.knitTex('#b3382c') });
  const defs = [[seat, [0.45, 0.9, 0.45]], [card, [0.55, 0.45, 0.45]], [red, [0.3, 0.2, 0.3]], [seat, [0.45, 0.9, 0.45]], [card, [0.5, 0.4, 0.5]], [B.M({ color: '#d8b830' }), [0.05, 2.0, 0.05]]];
  for (let i = 0; i < 14; i++) {
    const [m, s] = defs[i % defs.length];
    const f = new THREE.Mesh(new THREE.BoxGeometry(...s), m);
    const a = Math.random() * Math.PI * 2, d = 13 + Math.random() * 10;
    f.position.set(Math.cos(a) * d, 2 + Math.random() * 7, Math.sin(a) * d);
    f.userData.spin = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.4);
    g.add(f); floaters.push(f); pieces.push(f);
  }
  g.onUpdate((dt, t) => { for (const f of floaters) { f.rotation.x += f.userData.spin.x * dt; f.rotation.y += f.userData.spin.y * dt; f.position.y += Math.sin(t + f.position.x) * dt * 0.1; } });
  const rim = new THREE.PointLight(0xd04050, 2.2, 25); rim.position.set(0, 4, -8); g.add(rim);
  const rim2 = new THREE.PointLight(0x7080d0, 1.8, 25); rim2.position.set(0, 4, 8); g.add(rim2);
  g.bounds = (p) => { const d = Math.hypot(p.x, p.z); if (d > 8.3) { p.x *= 8.3 / d; p.z *= 8.3 / d; } };
  g.surface = 'hard';
  return { pieces };
}

function shockwave(g, from, toward, color) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 12), B.M({ color, unlit: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  ring.position.copy(from).setY(1.2);
  ring.lookAt(toward.clone().setY(1.2));
  g.add(ring);
  const start = from.clone().setY(1.2), end = toward.clone().setY(1.2);
  return g.tween(0.35, (k) => {
    ring.position.lerpVectors(start, end, k);
    ring.scale.setScalar(1 + k * 2);
    ring.material.opacity = 0.9 * (1 - k * 0.6);
  }, (k) => k).then(() => g.scene.remove(ring));
}

/* ======================================================================== */

export default {
  num: 'ФИНАЛ',
  title: 'Зеркало',
  async run(g) {
    await chapterStart(g, this);

    /* -------------------- the mirror battle -------------------- */
    const arena = buildArena(g);
    const hero = g.spawn(heroSpec('trench'), [0, 0, 6], Math.PI);
    g.setPlayer(hero, { control: false });
    const fig = new NightmareFigure(WIFE_BASE);
    fig.setReveal(0.9);
    fig.root.scale.setScalar(0.86);
    g.add(fig.root); g.addActor(fig);
    const mirror = () => {
      const p = hero.root.position;
      fig.root.position.set(p.x, 0, -p.z);
      fig.root.rotation.y = Math.PI - hero.root.rotation.y;
    };
    mirror();
    g.followCamera({ dist: 3.6, height: 2.3, lookH: 1.4, side: 1.0 });
    g.snapCamera();
    audio.ambience('void', true, 0.6);
    await g.fade(0, 2);
    await think(g, 'Вот она. Наконец-то лицом к лицу.');
    audio.playMusic('battle', { fade: 1 });
    g.ui.battle(true, 1, 1, ['ТЫ', 'ОНА']);
    g.ui.objective('ЛКМ — удар · ПКМ — защита');
    g.control(true);
    if (window.__autoplay) {
      // test path: two blows (two flashbacks), then walk to her
      const tap = () => { input.simulate('KeyJ', true); setTimeout(() => input.simulate('KeyJ', false), 60); };
      setTimeout(tap, 1500); setTimeout(tap, 16000);
      setTimeout(() => { g.debugGoal = V3(0, 0, 0.05); }, 30000);
    }
    let hpH = 1, hpF = 1;
    let attacks = 0, blocks = 0, lastAttack = -100, fightTime = 0, flashIdx = 0;
    let acting = false;
    const hints = new Set();
    const hint = (k, text, opts) => { if (!hints.has(k)) { hints.add(k); g.ui.subtitle(text, 4); if (opts) fourthWall(g, opts); } };
    let frozen = false;

    const mirrorOff = g.onUpdate((dt) => {
      if (frozen) return;
      mirror();
      fig.state = hero.state === 'attack' ? 'attack' : hero.state === 'block' ? 'block' : 'idle';
      fightTime += dt;
    });

    await g.until(() => {
      if (!acting && g.controlEnabled) {
        if (input.pressed('attack')) {
          acting = true; attacks++; lastAttack = g.time;
          (async () => {
            g.control(false);
            hero.state = 'attack';
            audio.noise({ dur: 0.2, f: 1200, q: 0.8, vel: 0.2, sweep: 300 });
            const hp = hero.root.position.clone(), fp = fig.root.position.clone();
            await Promise.all([shockwave(g, hp, fp, '#e8c070'), shockwave(g, fp, hp, '#b03040')]);
            audio.impact();
            hero.state = 'hurt'; hero.setExpression('fear');
            fig.setGlitch(0.5);
            await glitchBurst(g, 0.3, 0.5);
            hpH -= 0.13; hpF -= 0.13;
            g.ui.battle(true, hpH, hpF, attacks >= 5 ? ['ОНА', 'ТЫ'] : ['ТЫ', 'ОНА']);
            fig.setGlitch(0);
            await g.wait(0.35);
            hero.state = 'idle'; hero.setExpression('neutral');
            // every blow throws him back into a memory — and he sees something new in it
            if (flashIdx < FLASHBACK_COUNT) {
              g.ui.battle(false);
              g.ui.objective(null);
              audio.stopMusic(0.6);
              await playFlashback(g, flashIdx++);
              audio.playMusic('battle', { fade: 1 });
              g.ui.battle(true, hpH, hpF);
              g.ui.objective('ЛКМ — удар · ПКМ — защита');
              lastAttack = g.time;
            }
            if (attacks === 2) hint('a2', 'Она ударила в тот же миг, что и ты.');
            if (attacks === 4) hint('a4', 'Каждый твой удар возвращается к тебе.');
            if (attacks === 5) hint('a5', 'Имена на полосках поменялись местами.', 'Кто здесь кто?');
            if (attacks >= 5) hint('a6', 'А что, если не бороться? Подойди к ней.');
            if (hpH <= 0.2) {
              hero.state = 'kneel';
              await think(g, 'Силой здесь не победить.');
              hpH = hpF = 0.7; g.ui.battle(true, hpH, hpF);
              hero.state = 'idle';
              hint('k', 'Перестань атаковать. Подойди к ней.');
            }
            g.control(true);
            acting = false;
          })().catch(() => {});
        } else if (input.isDown('block')) {
          if (hero.state !== 'block') { blocks++; audio.clang(); if (blocks === 2) hint('b', 'Ты защищаешься — и она защищается.'); }
          hero.state = 'block';
        } else if (hero.state === 'block') hero.state = 'idle';
      }
      if (fightTime > 25 && attacks + blocks < 2) hint('w', 'Она повторяет каждое твоё движение.');
      if (fightTime > 40) hint('w2', 'Она — как отражение. Может, стоит просто подойти?');
      // no attacks for a while + close enough → the world freezes
      const d = hero.root.position.distanceTo(fig.root.position);
      return !acting && g.time - lastAttack > 3.5 && d < 1.5 && hero.state !== 'block';
    });
    frozen = true;
    g.debugGoal = null;
    g.control(false);
    mirrorOff();
    g.ui.objective(null);
    g.ui.battle(false);
    hero.state = 'idle';
    audio.stopMusic(0.3);
    audio.stopAllAmbience();
    // everything stops
    const post = g.r.post;
    await g.tween(1.5, (k) => { post.uSat.value = 0.65 * (1 - k * 0.9); globalUniforms.uWarp.value = 0.1 * (1 - k); });
    g.letterbox(true);
    const midF = hero.root.position.clone().lerp(fig.root.position, 0.5);
    g.ui.subtitle('Мир замер.', 3);
    await g.camOrbit(midF, { r0: 4.2, r1: 3.0, h0: 1.4, h1: 2.0, a0: 1.6, a1: 2.9, look: 1.5, dur: 5 });
    post.uWhite.value = 0;
    await g.tween(1.2, (k) => { post.uWhite.value = k; });
    g.setFade(1);
    post.uWhite.value = 0;

    /* -------------------- the last memory: the bus -------------------- */
    const W = buildBusWorld(g);
    audio.ambience('rain', true, 0.45);
    audio.ambience('bus', true, 0.6);
    W.enableInterior(true);
    W.doorBlock.on = false;
    W.setDoor(1);
    for (const [x, z, c] of [[0.95, 1.2, '#4a4f5a'], [0.5, -0.7, '#5a4a40'], [0.95, -1.65, '#3f4a44'], [-0.95, -0.7, '#3a3a48']]) {
      const p = g.spawn({ ...heroSpec('everyday'), beard: null, hair: '#3a3430', hairStyle: 'short', top: c, coat: c, longCoat: false, backpack: null, height: 1.72, skin: '#b0a098', thickBrows: false }, [x, 0.02, z + 0.05], 0);
      p.state = 'sit'; p.setExpression('closed');
    }
    const h2 = g.spawn(heroSpec('trench', YOUNG), [0, 0, 0], 0);
    g.setPlayer(h2, { control: false });
    sitAt(h2, HERO_SEAT);
    h2.lookYaw = -1.05;
    const girl = g.spawn(wifeSpec('busCoat'), [-4.0, -0.25, 9], Math.PI);
    g.camSet([-0.55, 1.45, -1.2], [-1.2, 1.1, 3.6]);
    audio.playMusic('finale', { fade: 2, intensity: 0 });
    await g.fade(0, 2);
    g.ui.subtitle('То самое утро.', 3);
    await g.wait(1.2);
    girl.blendRate = 12;
    await g.walkTo(girl, [-2.2, 0, 3.55], { speed: 5.0, run: true });
    girl.root.position.y = 0;
    audio.step('metal', true);
    await g.walkTo(girl, [-0.6, 0, 3.55], { speed: 3.4, run: true });
    audio.noise({ dur: 0.6, f: 2500, q: 0.6, vel: 0.14, type: 'highpass' });
    g.tween(0.5, (k) => W.setDoor(1 - k)).catch(() => {});
    W.doorBlock.on = true;
    girl.state = 'idle';
    W.drive(9);
    g.camera.fov = 32; g.camera.updateProjectionMatrix();
    g.camSet([0.05, 1.3, -1.6], [HERO_SEAT.x, 1.3, HERO_SEAT.z]);
    h2.blendRate = 20;
    const yawTo = lookAtYaw(h2, girl.root.position);
    await g.wait(0.3);
    await g.tween(0.2, (k) => { h2.lookYaw = -1.05 + (yawTo + 1.05) * k; }, (k) => k);
    await g.faceTo(girl, h2.root.position, 0.3);
    g.camera.fov = 26; g.camera.updateProjectionMatrix();
    g.camSet([-0.35, 1.55, -1.0], [-0.6, 1.5, 3.55]);
    await g.wait(1.5);
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    await g.walkTo(girl, [0.55, 0, 2.5], { speed: 1.3 });
    sitAt(girl, GIRL_SEAT);
    girl.lookYaw = 0.35;
    // this time — he goes to her
    h2.blendRate = 8; h2.lookYaw = 0;
    h2.state = 'idle';
    g.playerRadius = 0.18;
    h2.root.position.set(0, 0, HERO_SEAT.z);
    h2.root.rotation.y = 0;
    g.followCamera({ dist: 2.2, height: 1.75, lookH: 1.5, side: 0, smooth: 6 });
    g.snapCamera();
    await think(g, 'В тот раз я так и не подошёл.');
    g.control(true);
    g.ui.objective('Подойди к ней');
    const gaze = g.onUpdate((dt) => {
      const d = h2.root.position.distanceTo(girl.root.position);
      const target = d < 3.5 ? lookAtYaw(girl, h2.eyePos(), 1.5) : 0.35;
      girl.lookYaw = THREE.MathUtils.lerp(girl.lookYaw, target, Math.min(1, dt * 3));
    });
    await new Promise((resolve) => {
      g.interact({ pos: () => girl.root.position, radius: 1.35, label: 'Посмотреть ей в глаза', once: true, onInteract: resolve });
    });
    g.control(false);
    g.ui.objective(null);
    gaze();
    g.playerRadius = null;
    await g.faceTo(h2, girl.root.position, 0.4);
    h2.lookPitch = 0.25;
    girl.lookYaw = lookAtYaw(girl, h2.eyePos(), 1.5);
    girl.lookPitch = -0.2;
    const e1 = h2.eyePos(), e2 = girl.eyePos();
    const midE = e1.clone().lerp(e2, 0.5);
    const sideV = new THREE.Vector3().subVectors(e2, e1).setY(0).normalize();
    g.camera.fov = 30; g.camera.updateProjectionMatrix();
    g.camSet(midE.clone().add(new THREE.Vector3(-sideV.z, 0, sideV.x).multiplyScalar(1.4)).toArray(), midE.toArray());
    await g.wait(1.5);
    girl.setExpression('smile');
    h2.setExpression('smile');
    await g.wait(1.5);
    await think(g, 'Её глаза. Те же самые. Все эти годы.');
    await g.wait(1.0);
    await g.tween(2.0, (k) => { post.uWhite.value = k; });
    audio.stopAllAmbience();
    g.setFade(1);
    post.uWhite.value = 0;
    g.camera.fov = 60; g.camera.updateProjectionMatrix();

    /* -------------------- back to the frozen figure: the embrace -------------------- */
    const A2 = buildArena(g);
    setWorldMood(g, { sat: 0.25, tint: [1.0, 0.95, 1.0], noise: 0.04 });
    const h3 = g.spawn(heroSpec('trench'), [0, 0, 1.4], Math.PI);
    g.setPlayer(h3, { control: false });
    const fig2 = new NightmareFigure(WIFE_BASE);
    fig2.setReveal(0.95);
    fig2.root.scale.setScalar(0.86);
    fig2.root.position.set(0, 0, -0.1);
    g.add(fig2.root); g.addActor(fig2);
    g.followCamera({ dist: 3.0, height: 2.0, lookH: 1.4 });
    g.snapCamera();
    await g.fade(0, 2);
    g.control(true);
    g.ui.objective('Подойди и обними её');
    await new Promise((resolve) => {
      g.interact({ pos: () => fig2.root.position, radius: 1.3, label: 'Обнять', once: true, onInteract: resolve });
    });
    g.control(false);
    g.ui.objective(null);
    await g.faceTo(h3, fig2.root.position, 0.3);
    await g.walkTo(h3, [0, 0, 0.42], { speed: 0.6, stopDist: 0.03 });
    h3.root.rotation.y = Math.PI;
    h3.state = 'hug';
    h3.setExpression('closed');
    g.camSet([2.4, 1.7, 1.6], [0, 1.4, 0.2]);
    await g.wait(1.2);
    // transformation through PS1 glitches
    const wife = g.spawn(wifeSpec('busCoat'), [0, 0, 0.0], 0);
    wife.state = 'hug';
    wife.root.visible = false;
    audio.playMusic('finale', { fade: 0.5, intensity: 0 });
    let k = 0;
    const tr = g.onUpdate((dt) => {
      k = Math.min(1, k + dt / 6);
      fig2.setGlitch(k * 1.1);
      fig2.setReveal(0.95 + k * 0.05);
      post.uDistort.value = 0.05 + Math.sin(k * Math.PI) * 0.35;
      // flicker between the two models, more and more of her
      const showWife = Math.random() < k * k * 1.2;
      wife.root.visible = showWife;
      fig2.root.visible = !showWife || Math.random() < 0.3 * (1 - k);
      wife.setGlitch((1 - k) * 0.8);
      if (Math.random() < dt * 8 * (1 - k)) audio.glitch(0.08);
    });
    audio.shatter();
    g.letterbox(true);
    g.camOrbit([0, 0, 0.2], { r0: 2.6, r1: 1.8, h0: 1.3, h1: 1.7, a0: 0.9, a1: 0.9 + Math.PI * 1.1, look: 1.5, dur: 6 }).catch(() => {});
    await g.until(() => k >= 1);
    tr();
    g.shake(0.25, 0.8);
    fig2.root.visible = false;
    wife.root.visible = true;
    wife.setGlitch(0);
    post.uDistort.value = 0;
    wife.setExpression('cry');
    audio.setIntensity(2); // the orchestra comes in
    await g.tween(3, (t) => { post.uSat.value = 0.25 + t * 0.65; post.uTint.value.set(1.0 + t * 0.04, 0.95 + t * 0.03, 1.0 - t * 0.06); });
    // close-ups over each shoulder, slowly pushing in
    g.camera.fov = 34; g.camera.updateProjectionMatrix();
    g.camSet([0.75, 1.64, 1.35], [0, 1.5, 0.0]);
    g.handheld = 0.35;
    g.pushIn(0.35, 4).catch(() => {});
    await g.wait(1.2);
    await g.ui.say('Она', STORY.wifeFinal, { noCam: true });
    g.camSet([-0.55, 1.7, -0.85], [0, 1.58, 0.42]);
    g.pushIn(0.3, 4).catch(() => {});
    h3.setExpression('sad');
    await g.ui.say('Ты', STORY.heroFinal, { noCam: true });
    h3.setExpression('closed'); wife.setExpression('closed');
    // the silent embrace: the camera slowly pulls back and rises
    g.handheld = 0;
    g.camera.fov = 45; g.camera.updateProjectionMatrix();
    await g.camOrbit([0, 0, 0.2], { r0: 1.6, r1: 4.2, h0: 1.5, h1: 3.0, a0: 2.2, a1: 3.4, look: 1.35, dur: 6 });

    /* -------------------- the nightmare falls apart -------------------- */
    audio.shatter();
    const vel = new Map();
    for (const p of A2.pieces) vel.set(p, { v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3), r: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2) });
    for (const p of A2.pieces) if (p.material) { p.material = p.material.clone(); p.material.onBeforeCompile = A2.pieces[0].material.onBeforeCompile; p.material.transparent = true; }
    let tb = 0;
    const breaker = g.onUpdate((dt) => {
      tb += dt;
      for (const p of A2.pieces) {
        const d = p.userData.d ?? Math.hypot(p.position.x, p.position.z);
        if (tb < d * 0.25) continue; // breaks from the centre outwards... but not under their feet
        if (d < 1.2 && tb < 6) continue;
        const v = vel.get(p);
        p.position.addScaledVector(v.v, dt);
        p.rotation.x += v.r.x * dt; p.rotation.y += v.r.y * dt;
        if (p.material) p.material.opacity = Math.max(0, p.material.opacity - dt * 0.25);
      }
    });
    g.camMode = 'script';
    await g.camMove([5, 6, 7], [0, 1, 0], 6);
    breaker();
    await g.tween(1.5, (t) => { post.uWhite.value = t; });
    g.setFade(1);
    post.uWhite.value = 0;

    /* -------------------- the road -------------------- */
    g.newScene({ bg: 0x6a6c72, fog: [0x6a6c72, 8, 80], hemi: [0xb8bcc8, 0x3a3a40, 1.0], sun: [0xd8dce8, 0.35, [-3, 8, 4]] });
    setWorldMood(g, { sat: 0.7, tint: [0.98, 0.99, 1.03], noise: 0.03 });
    B.plane(g, 8, 240, B.M({ map: T.asphaltTex([3, 80], true) }), 0, 0, -100);
    B.plane(g, 0.2, 240, B.M({ map: T.roadLineTex([1, 80]), unlit: true }), 0, 0.03, -100);
    B.plane(g, 80, 240, B.M({ map: T.grassTex([30, 80], '#3e4636') }), 0, -0.03, -100);
    for (let z = 6; z > -200; z -= 12) {
      B.lampPost(g, 5, z, { on: false, solid: false });
      B.bareTree(g, -8 - Math.random() * 8, z - 4, { solid: false, h: 4 + Math.random() * 4 });
      B.tree(g, 10 + Math.random() * 8, z - 7, { solid: false, autumn: false, color: '#3e4a36', h: 4 + Math.random() * 3 });
    }
    // wet reflections of the sky on the road
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(7, 240, 6, 160), B.M({ color: '#a8acb8', unlit: true, transparent: true, opacity: 0.08, depthWrite: false }));
    sheen.rotation.x = -Math.PI / 2; sheen.position.set(0, 0.015, -100); g.add(sheen);
    const roadRain = B.rain(g, { count: 1200, area: 36, speed: 11 });
    g.surface = 'wet';
    g.bounds = (p) => { p.x = Math.max(-3.5, Math.min(3.5, p.x)); };
    const hR = g.spawn(heroSpec('rain'), [-0.45, 0, 0], Math.PI);
    const wR = g.spawn(wifeSpec('rain'), [0.45, 0, 0], Math.PI);
    const kidsZ = -16;
    const k1 = g.spawn(CHILDREN[0], [-0.5, 0, kidsZ], 0);
    const k2 = g.spawn(CHILDREN[1], [0.5, 0, kidsZ], 0);
    k1.lookYaw = 0.15; k2.lookYaw = -0.15;
    g.setPlayer(hR, { control: false });
    g.followCamera({ dist: 3.6, height: 2.0, lookH: 1.3, side: 0.4 });
    g.snapCamera();
    audio.ambience('rain', true, 0.7);
    audio.setIntensity(2);
    await g.fade(0, 3);
    await g.wait(1.0);
    await think(g, 'Тихий дождь. Серое небо. Длинная дорога.');
    await think(g, 'Впереди нас ждали.');
    g.control(true);
    g.noRun = true;
    g.ui.objective('Идти к ним. Вместе.');
    g.debugGoal = V3(-0.4, 0, kidsZ + 2.0);
    // she walks beside him
    const beside = g.onUpdate((dt) => {
      const yaw = hR.root.rotation.y;
      // she keeps to his right along the road and matches his pace
      const want = hR.root.position.clone().add(new THREE.Vector3(0.8, 0, 0.1));
      const p = wR.root.position;
      const d = Math.hypot(want.x - p.x, want.z - p.z);
      if (d > 0.15) {
        const s = Math.min(d, dt * Math.min(2.4, d * 4));
        p.x += (want.x - p.x) / d * s; p.z += (want.z - p.z) / d * s;
        wR.root.rotation.y = lerpAngle(wR.root.rotation.y, Math.atan2(want.x - p.x, want.z - p.z), Math.min(1, dt * 5));
        wR.state = 'walk';
      } else { wR.state = 'idle'; wR.root.rotation.y = lerpAngle(wR.root.rotation.y, yaw, Math.min(1, dt * 3)); }
    });
    await g.until(() => hR.root.position.z < kidsZ + 7);
    g.control(false);
    g.debugGoal = null;
    beside();
    g.ui.objective(null);
    hR.state = 'idle'; wR.state = 'idle';
    for (const c of [hR, wR]) c.root.rotation.y = Math.PI;
    g.letterbox(true);
    g.lockCam = true;
    const eye = (c) => c.eyePos();
    // a close-up in front of a character's face, slightly off-axis, with a slow push-in
    const closeUp = (c, { dist = 0.9, side = 0.25, fov = 32, push = 0.25, dur = 3, up = 0 } = {}) => {
      const e = eye(c); const f = new THREE.Vector3(Math.sin(c.root.rotation.y + c.lookYaw), 0, Math.cos(c.root.rotation.y + c.lookYaw));
      const r = new THREE.Vector3(-f.z, 0, f.x);
      g.camera.fov = fov; g.camera.updateProjectionMatrix();
      g.camSet(e.clone().addScaledVector(f, dist).addScaledVector(r, side).add(new THREE.Vector3(0, up, 0)).toArray(), e.clone().add(new THREE.Vector3(0, -0.04, 0)).toArray());
      g.handheld = 0.35;
      return g.pushIn(push, dur);
    };

    // 1. wide: the children wait in the rain, the younger one holds his brother's hand
    k1.state = 'holdHands'; k2.state = 'holdHands';
    g.camera.fov = 40; g.camera.updateProjectionMatrix();
    g.camSet([0.6, 0.75, kidsZ - 2.4], [0, 1.2, kidsZ + 6]);
    g.handheld = 0.3;
    await g.wait(2.6);

    // 2. the younger son sees them
    k2.lookYaw = -0.1; k2.lookPitch = -0.15;
    await closeUp(k2, { dist: 0.75, side: -0.2, fov: 30, push: 0.2, dur: 2 });
    k2.setExpression('joy');
    audio.piano(81, audio.now, { vel: 0.3, dur: 4 });
    await g.wait(1.2);

    // 3. the older one: a little serious — then a shy smile
    k1.lookYaw = 0.1; k1.lookPitch = -0.12;
    const cu1 = closeUp(k1, { dist: 0.8, side: 0.22, fov: 30, push: 0.2, dur: 3 });
    await g.wait(1.2);
    k1.setExpression('smile');
    await cu1;

    // 4. her face: tears and a smile
    wR.setExpression('happycry');
    audio.setIntensity(2);
    await closeUp(wR, { dist: 0.95, side: 0.28, fov: 30, push: 0.3, dur: 3 });

    // 5. the younger one lets go and runs to mum; she kneels and opens her arms
    k2.state = 'idle';
    g.camera.fov = 46; g.camera.updateProjectionMatrix();
    wR.state = 'kneelOpen';
    const toMum = wR.root.position.clone().add(new THREE.Vector3(0, 0, -0.42));
    const m5 = k2.root.position.clone().lerp(toMum, 0.55);
    g.camSet([m5.x + 3.0, 1.0, m5.z + 0.6], [m5.x, 0.8, m5.z]);
    const track5 = g.onUpdate(() => { const p = k2.root.position; g.camLook.lerp(new THREE.Vector3(p.x, 0.8, p.z), 0.1); g.camera.lookAt(g.camLook); });
    await g.walkTo(k2, [toMum.x, 0, toMum.z], { speed: 3.0, run: true });
    track5();
    k2.root.rotation.y = 0; k2.state = 'hug'; wR.state = 'kneelHug';
    wR.setExpression('closed');
    audio.laugh();
    const mumMid = wR.root.position.clone().lerp(k2.root.position, 0.5);
    g.camOrbit(mumMid, { r0: 1.7, r1: 1.9, h0: 0.95, h1: 1.1, a0: 1.2, a1: 2.0, look: 0.9, dur: 5 }).catch(() => {});
    await g.wait(2.5);

    // 6. his face
    hR.setExpression('happycry');
    await closeUp(hR, { dist: 1.0, side: -0.28, fov: 30, push: 0.3, dur: 2.6 });

    // 7. the older son walks to his father; father kneels; they hold each other
    k1.state = 'idle';
    hR.state = 'kneelOpen';
    g.camera.fov = 44; g.camera.updateProjectionMatrix();
    const toDad = hR.root.position.clone().add(new THREE.Vector3(0, 0, -0.42));
    const m7 = k1.root.position.clone().lerp(toDad, 0.6);
    g.camSet([m7.x - 3.0, 1.0, m7.z + 0.6], [m7.x, 0.8, m7.z]);
    const track7 = g.onUpdate(() => { const p = k1.root.position; g.camLook.lerp(new THREE.Vector3(p.x, 0.8, p.z), 0.1); g.camera.lookAt(g.camLook); });
    await g.walkTo(k1, [toDad.x, 0, toDad.z], { speed: 1.7 });
    track7();
    k1.root.rotation.y = 0; k1.state = 'hug'; hR.state = 'kneelHug';
    hR.setExpression('closed'); k1.setExpression('closed');
    audio.setIntensity(3);
    await g.wait(1.8);

    // 8. over the children's shoulders, the two of them look at each other
    wR.lookYaw = 1.0; hR.lookYaw = -0.9;
    wR.setExpression('happycry'); hR.setExpression('happycry');
    g.camera.fov = 34; g.camera.updateProjectionMatrix();
    const we = eye(wR);
    g.camSet([we.x - 0.9, we.y + 0.05, we.z - 0.9], [we.x, we.y, we.z]);
    g.pushIn(0.25, 2.5).catch(() => {});
    await g.wait(2.6);
    const he = eye(hR);
    g.camSet([he.x + 0.9, he.y + 0.05, he.z - 0.9], [he.x, he.y, he.z]);
    g.pushIn(0.25, 2.5).catch(() => {});
    hR.setExpression('smile');
    await g.wait(2.4);

    // 9. the whole family: a slow pull back, rain, the orchestra at its peak
    const famMid = hR.root.position.clone().lerp(wR.root.position, 0.5).add(new THREE.Vector3(0, 0, -0.3));
    g.handheld = 0;
    g.camera.fov = 44; g.camera.updateProjectionMatrix();
    await g.camOrbit(famMid, { r0: 2.2, r1: 4.2, h0: 1.0, h1: 2.4, a0: Math.PI + 0.6, a1: Math.PI - 0.5, look: 0.9, dur: 6 });

    // 10. they get up and stand in a row, holding hands
    for (const c of [hR, wR, k1, k2]) { c.lookYaw = 0; c.lookPitch = 0; c.setExpression('smile'); c.state = 'idle'; }
    await g.fade(1, 0.8);
    const rowZ = kidsZ + 1.4;
    [[hR, -1.05], [k1, -0.38], [k2, 0.3], [wR, 1.0]].forEach(([c, x]) => { c.root.position.set(x, 0, rowZ); c.root.rotation.y = Math.PI; c.state = 'holdHands'; });
    wR.setExpression('happycry');
    g.camera.fov = 50; g.camera.updateProjectionMatrix();
    g.camSet([0.4, 1.3, rowZ + 3.6], [0, 0.9, rowZ - 2]);
    await g.fade(0, 0.8);
    g.lockCam = false;
    await g.wait(1.2);
    // one last action
    g.ui.prompt('W / ↑ — шаг вперёд');
    await g.until(() => input.pressed('up'));
    g.ui.prompt(null);
    audio.step('wet');
    hR.state = 'walk';
    await g.tween(0.7, (k) => { hR.root.position.z = rowZ - 0.6 * k; });
    // everyone walks together — final cutscene
    const walkers = [hR, wR, k1, k2];
    const walkOn = g.onUpdate((dt) => {
      for (const c of walkers) { c.root.position.z -= dt * 0.85; c.root.rotation.y = Math.PI; c.state = 'walk'; }
    });
    const c0 = new THREE.Vector3(0.4, 1.3, rowZ + 3.6);
    let tc = 0;
    const crane = g.onUpdate((dt) => {
      tc += dt;
      const k = Math.min(1, tc / 22);
      const e = k * k * (3 - 2 * k);
      const lead = hR.root.position.z;
      g.camera.position.set(c0.x * (1 - e), 1.5 + e * 11, lead + 5 + e * 7);
      g.camera.lookAt(0, 0.5 + (1 - e) * 0.5, lead - 3 - e * 14);
      roadRain.lines.material.opacity = 0.55 - e * 0.4;
      roadRain.follow.target = g.camera.position;
    });
    await g.wait(8);
    g.ui.caption(STORY.endCaption);
    await g.wait(9);
    g.ui.hideCaption();
    await g.wait(2);
    await g.fade(1, 4);
    walkOn(); crane();
    audio.stopMusic(9);
    audio.stopAllAmbience();
    g.ui.clearAll();
    await g.wait(9);
    g.noRun = false;
  },
};
