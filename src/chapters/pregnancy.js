// Chapter 5 — "Поздравляю, папаша". Joy, fear, quarrels, reconciliation, the maternity ward.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import * as B from '../world/build.js';
import { apartment, hospital } from '../world/places.js';
import { STORY } from '../config/story.js';
import { YOUNG } from '../config/family.js';
import { spawnHero, spawnWife, think, chapterStart, endMemory, waitInteract, waitReach, V3, setWorldMood, embrace, shout, breakDish } from './common.js';

export default {
  num: 'ГЛАВА 5',
  title: 'Папаша',
  async run(g) {
    await chapterStart(g, this);

    /* -------- the news -------- */
    apartment(g, {});
    // a bathroom door in the west wall
    B.door(g, -3.93, -1.5, Math.PI / 2, { color: '#8a8070' });
    const hero = spawnHero(g, 'home', [0.5, 0, 1.2], -Math.PI / 2, { extra: YOUNG });
    g.followCamera({ dist: 2.8, height: 1.85, lookH: 1.35 });
    g.snapCamera();
    audio.ambience('room', true, 0.4);
    await g.fade(0, 2);
    g.control(true);
    g.ui.objective('Она слишком долго в ванной…');
    await waitReach(g, V3(-3.2, 0, -1.5), 1.6);
    g.control(false);
    g.ui.objective(null);
    audio.door();
    const her = spawnWife(g, 'home', [-3.5, 0, -1.5], Math.PI / 2);
    await g.faceTo(hero, her.root.position, 0.3);
    her.setExpression('cry');
    her.state = 'anxious';
    g.camera.fov = 38; g.camera.updateProjectionMatrix();
    g.camSet([hero.root.position.x + 0.2, 1.62, hero.root.position.z + 0.6], [-3.5, 1.45, -1.5]);
    await g.wait(1.2);
    g.letterbox(true);
    await g.pushIn(0.5, 1.2);
    await g.ui.say('Она', STORY.papasha, { noCam: true });
    // his reaction: shock — a dolly-zoom, the room stretches around him
    hero.state = 'fear'; hero.setExpression('fear');
    audio.heartbeat();
    audio.tone({ f: 60, dur: 2, type: 'sine', vel: 0.12, wet: 0.6 });
    const hp = hero.root.position;
    const toHer = new THREE.Vector3(-3.5 - hp.x, 0, -1.5 - hp.z).normalize();
    await g.dollyZoom([hp.x, 1.6, hp.z], { dist0: 0.9, dist1: 3.0, fov0: 55, height: 1.62, dir: [toHer.x, 0, toHer.z], dur: 1.8 });
    audio.heartbeat();
    await g.wait(0.8);
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    g.camSet([-3.0, 1.55, -1.1], [hp.x, 1.6, hp.z]);
    hero.state = 'idle'; hero.setExpression('neutral');
    await think(g, 'Радость. Страх. Шок. Всё сразу.');
    hero.state = 'joy'; hero.setExpression('joy');
    audio.playMusic('warm', { fade: 1 });
    await g.wait(1.6);
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    her.setExpression('smile');
    await embrace(g, hero, her);
    const mid1 = hero.root.position.clone().lerp(her.root.position, 0.5);
    await g.camOrbit(mid1, { r0: 1.7, r1: 2.4, h0: 1.5, h1: 1.9, a0: 0.9, a1: 2.2, look: 1.45, dur: 5 });
    g.letterbox(false);
    await g.fade(1, 1.5);

    /* -------- quarrel & reconciliation -------- */
    apartment(g, { night: true });
    setWorldMood(g, { sat: 0.6 });
    // the kitchen, late evening. They argue standing face to face.
    const h2 = spawnHero(g, 'everyday', [1.6, 0, -1.0], Math.PI / 2, { extra: YOUNG });
    const w2 = spawnWife(g, 'home', [3.2, 0, -1.9], -Math.PI / 2);
    w2.setExpression('sad');
    g.camSet([0.2, 1.5, 0.8], [2.4, 1.2, -1.5]);
    g.letterbox(true);
    g.handheld = 1;
    audio.playMusic('anxiety', { fade: 2 });
    await g.fade(0, 1.5);
    g.ui.subtitle('Беременность — это и радость, и быт, и ссоры.', 3.5);
    await g.wait(2.5);
    await g.faceTo(w2, h2.root.position, 0.3);
    await g.faceTo(h2, w2.root.position, 0.3);
    // over-the-shoulder shots, cutting between them as the voices rise
    const ots = (from, to, side = 0.35) => {
      const f = from.root.position, t = to.root.position;
      const dir = new THREE.Vector3(t.x - f.x, 0, t.z - f.z).normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      g.camSet([f.x - dir.x * 0.75 + right.x * side, 1.68, f.z - dir.z * 0.75 + right.z * side], [t.x, 1.5, t.z]);
    };
    g.camera.fov = 42; g.camera.updateProjectionMatrix();
    ots(h2, w2);
    await shout(g, 'Она', w2, 'Я опять всё сама! Посуда, врачи, сумки!', 'f', { anger: 0.6 });
    ots(w2, h2);
    await shout(g, 'Ты', h2, 'Я работаю допоздна! Я не могу разорваться!', 'm', { anger: 0.7 });
    ots(h2, w2, -0.35);
    await shout(g, 'Она', w2, 'Ты вообще слышишь, что я говорю?!', 'f', { anger: 0.9 });
    ots(w2, h2, -0.35);
    await shout(g, 'Ты', h2, 'А ты меня?!', 'm', { anger: 1 });
    // she slams a plate down — it slips and smashes on the floor
    g.camera.fov = 50; g.camera.updateProjectionMatrix();
    g.camSet([2.0, 0.55, 0.2], [2.9, 0.3, -1.6]); // low angle on the floor
    w2.state = 'attack';
    await g.wait(0.25);
    await breakDish(g, V3(3.0, 1.1, -2.3), V3(2.6, 0, -1.3), { kind: 'plate', dur: 0.45 });
    audio.stopMusic(0.2);
    w2.state = 'idle'; h2.state = 'idle';
    w2.setExpression('cry'); h2.setExpression('sad');
    await g.wait(1.6);
    g.handheld = 0;
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    g.letterbox(false);
    // the silence after
    audio.playMusic('sparse', { fade: 2 });
    await g.fade(1, 0.8);
    w2.root.position.set(-2.2, 0, -2.3); w2.root.rotation.y = 0; w2.state = 'sit';
    w2.setExpression('sad');
    h2.root.position.set(2.2, 0, 1.0); h2.root.rotation.y = Math.PI; h2.setExpression('neutral');
    g.followCamera({ dist: 2.8, height: 1.9, lookH: 1.3 });
    g.snapCamera();
    await g.fade(0, 1);
    await think(g, 'Осколки на полу. Она сидит на диване, отвернувшись.');
    let cold = 0;
    for (;;) {
      const c = await g.ui.choose(null, 'Что сделать?', ['Ответить резко', 'Промолчать и уйти в другую комнату', 'Подойти и сесть рядом']);
      if (c === 2) break;
      cold++;
      setWorldMood(g, { sat: Math.max(0.15, 0.6 - cold * 0.2), tint: [0.9, 0.95, 1.1] });
      audio.tone({ f: 90, dur: 1.2, type: 'sine', vel: 0.1 });
      if (c === 0) { await g.ui.say('Ты', 'А ты думаешь, мне легко?!'); w2.state = 'tired'; await g.ui.say('Она', '…'); }
      else { await think(g, 'Тишина стала ещё тяжелее.'); }
      await think(g, 'Так становится только хуже.');
    }
    g.control(true);
    g.ui.objective('Подойди к ней');
    await waitReach(g, V3(-2.2, 0, -1.6), 1.2);
    g.control(false);
    g.ui.objective(null);
    h2.root.position.set(-1.6, 0, -2.3); h2.root.rotation.y = 0; h2.state = 'sit';
    g.camSet([-1.9, 1.5, 0.2], [-1.9, 0.9, -2.3]);
    await g.ui.talk([
      ['Ты', 'Прости. Я правда не замечаю, как тебе тяжело.'],
      ['Она', 'Я просто хочу, чтобы мы были вместе. Во всём.'],
    ]);
    w2.setExpression('smile'); h2.setExpression('smile');
    setWorldMood(g, { sat: 0.9, tint: [1.06, 1.0, 0.92] });
    audio.playMusic('warm', { fade: 2 });
    await think(g, 'Мы мирились. Каждый раз — немного по-новому.');
    await g.fade(1, 1.5);

    /* -------- maternity ward -------- */
    hospital(g);
    const h3 = spawnHero(g, 'everyday', [0, 0, 1.2], Math.PI, { extra: YOUNG });
    const w3 = spawnWife(g, 'home', [4.4, 0, 0.2], -Math.PI / 2);
    w3.setBaby(true); w3.state = 'hold';
    g.followCamera({ dist: 2.6, height: 1.9, lookH: 1.4 });
    g.snapCamera();
    audio.ambience('hum', true, 0.5);
    audio.stopMusic(2);
    await g.fade(0, 1.5);
    g.ui.subtitle('Роддом.', 3);
    g.ui.objective('Палата в конце коридора, направо');
    let beat = 0;
    const hb = g.onUpdate((dt) => { beat -= dt; if (beat <= 0) { audio.heartbeat(audio.now, audio.sfx, 0.35); beat = 0.75; } });
    await waitReach(g, V3(1.6, 0, -1), 1.0);
    hb();
    g.ui.objective(null);
    audio.playMusic('theme', { fade: 2 });
    await waitInteract(g, { pos: V3(4.0, 0, 0.0), radius: 1.4, label: 'Посмотреть на ребёнка', facing: false });
    g.control(false);
    await g.faceTo(h3, w3.root.position, 0.4);
    w3.setExpression('smile');
    g.camera.fov = 34; g.camera.updateProjectionMatrix();
    const bp = new THREE.Vector3(); w3.baby.getWorldPosition(bp);
    g.letterbox(true);
    g.camSet([bp.x - 1.3, bp.y + 0.7, bp.z + 0.7], [bp.x, bp.y, bp.z]);
    g.handheld = 0.4;
    await g.pushIn(0.75, 3.5);
    await think(g, 'Мой ребёнок.');
    h3.state = 'joy'; h3.setExpression('joy');
    await think(g, 'Счастье. Страх. Нежность. И что-то новое — ответственность.');
    h3.state = 'idle'; h3.setExpression('smile');
    audio.setIntensity(1);
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    g.handheld = 0;
    await g.camOrbit([4.2, 0, 0.1], { r0: 1.6, r1: 2.2, h0: 1.5, h1: 2.3, a0: -2.6, a1: -1.4, look: 1.1, dur: 5 });
    g.letterbox(false);
    await endMemory(g, 'Воспоминание: «Первый»');
    audio.setIntensity(0);
  },
};
