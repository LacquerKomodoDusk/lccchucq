// Chapter 5 — "Поздравляю, папаша". Joy, fear, quarrels, reconciliation, the maternity ward.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import * as B from '../world/build.js';
import { apartment, hospital } from '../world/places.js';
import { STORY } from '../config/story.js';
import { spawnHero, spawnWife, think, chapterStart, endMemory, waitInteract, waitReach, V3, setWorldMood, embrace } from './common.js';

export default {
  num: 'ГЛАВА 5',
  title: 'Папаша',
  async run(g) {
    await chapterStart(g, this);

    /* -------- the news -------- */
    apartment(g, {});
    // a bathroom door in the west wall
    B.door(g, -3.93, -1.5, Math.PI / 2, { color: '#8a8070' });
    const hero = spawnHero(g, 'home', [0.5, 0, 1.2], -Math.PI / 2);
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
    await g.ui.say('Она', STORY.papasha);
    // his reaction: shock → fear → joy
    g.camSet([-3.0, 1.55, -1.1], [hero.root.position.x, 1.6, hero.root.position.z]);
    hero.state = 'fear'; hero.setExpression('fear');
    audio.heartbeat();
    await g.wait(1.6);
    hero.state = 'idle'; hero.setExpression('neutral');
    await think(g, 'Радость. Страх. Шок. Всё сразу.');
    hero.state = 'joy'; hero.setExpression('joy');
    audio.playMusic('warm', { fade: 1 });
    await g.wait(1.6);
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    her.setExpression('smile');
    await embrace(g, hero, her);
    g.camSet([-1.2, 1.8, 0.6], [-2.6, 1.3, -1.5]);
    await g.wait(3);
    await g.fade(1, 1.5);

    /* -------- quarrel & reconciliation -------- */
    apartment(g, { night: true });
    setWorldMood(g, { sat: 0.6 });
    const h2 = spawnHero(g, 'everyday', [2.2, 0, 1.0], Math.PI);
    const w2 = spawnWife(g, 'home', [-2.2, 0, -2.3], 0);
    w2.state = 'sit';
    w2.setExpression('sad');
    g.followCamera({ dist: 2.8, height: 1.9, lookH: 1.3 });
    g.snapCamera();
    audio.playMusic('sparse', { fade: 2 });
    await g.fade(0, 1.5);
    g.ui.subtitle('Беременность — это и радость, и быт, и ссоры.', 4);
    await g.ui.talk([
      ['Она', 'Я опять всё сама. Посуда, врачи, сумки…', {}],
      ['Ты', 'Я же работаю допоздна. Я не могу разорваться.', {}],
      ['Она', 'Ты вообще слышишь, что я говорю?', {}],
    ]);
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
    const h3 = spawnHero(g, 'everyday', [0, 0, 1.2], Math.PI);
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
    g.camSet([bp.x - 1.0, bp.y + 0.6, bp.z + 0.5], [bp.x, bp.y, bp.z]);
    await g.wait(1.5);
    await think(g, 'Мой ребёнок.');
    h3.state = 'joy'; h3.setExpression('joy');
    await think(g, 'Счастье. Страх. Нежность. И что-то новое — ответственность.');
    h3.state = 'idle'; h3.setExpression('smile');
    audio.setIntensity(1);
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    await g.camMove([2.4, 2.2, 0.9], [4.4, 1.1, 0.2], 4);
    await endMemory(g, 'Воспоминание: «Первый»');
    audio.setIntensity(0);
  },
};
