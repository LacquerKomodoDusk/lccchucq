// Chapter 6 — family: small apartment, no sleep, tiredness — and warm walks in the park.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import * as T from '../engine/textures.js';
import { apartment, playground } from '../world/places.js';
import { spawnHero, spawnWife, think, chapterStart, endMemory, waitInteract, waitReach, V3, setWorldMood, fourthWall, realClock } from './common.js';
import { dreamSegment } from './dream.js';

function babyCry() {
  const t = audio.now;
  for (let i = 0; i < 3; i++) audio.tone({ t: t + i * 0.55, f: 560, f2: 430, dur: 0.45, type: 'triangle', vel: 0.035, wet: 0.3 });
}

function stroller(g, x, z, rot = 0) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = rot; g.add(grp);
  const body = B.M({ map: T.fabricTex('#3a4a5a') });
  B.box(g, 0.5, 0.35, 0.8, body, 0, 0.45, 0, { parent: grp });
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), body);
  hood.position.set(0, 0.8, -0.2); hood.rotation.x = -0.5; grp.add(hood);
  B.box(g, 0.04, 0.6, 0.04, B.M({ color: '#222' }), 0.2, 0.5, 0.45, { parent: grp });
  B.box(g, 0.04, 0.6, 0.04, B.M({ color: '#222' }), -0.2, 0.5, 0.45, { parent: grp });
  B.box(g, 0.45, 0.04, 0.04, B.M({ color: '#222' }), 0, 1.08, 0.48, { parent: grp });
  for (const [wx, wz] of [[-0.22, -0.3], [0.22, -0.3], [-0.22, 0.3], [0.22, 0.3]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 8), B.M({ color: '#1a1a1a' }));
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.1, wz); grp.add(w);
  }
  return grp;
}

export default {
  num: 'ГЛАВА 6',
  title: 'Семья',
  async run(g) {
    await chapterStart(g, this);

    /* -------- nightmare interlude -------- */
    await dreamSegment(g, {
      layout: 'maze', theme: 'hospital', size: 5, seed: 33, reveal: 0.6, outfit: 'everyday', speed: 2.4,
      shards: [{ text: 'Маленькая квартира.' }, { text: 'Плач в три часа ночи.' }, { text: 'Солнце в парке.' }, { text: 'Она держит его на руках.' }],
      doorLabel: 'Войти в воспоминание',
      async intro(g) { await think(g, 'Больничные коридоры. Я знаю это место.'); },
      events: [
        { at: 25, run: async (g) => fourthWall(g, `Сейчас ${realClock()}. Тебе тоже пора спать.`) },
        { shard: 3, run: async (g) => { g.ui.subtitle('В темноте блеснуло кольцо. Как у неё.', 3.5); } },
      ],
      pauseExtra: { label: 'Перестать бежать', action: () => fourthWall(g, 'Ещё рано. Ты пока не знаешь, от кого бежишь.') },
    });

    /* -------- night: no sleep -------- */
    apartment(g, { night: true, crib: true });
    setWorldMood(g, { sat: 0.55, noise: 0.06, tint: [0.92, 0.95, 1.08] });
    const hero = spawnHero(g, 'tired', [-1.0, 0, 0.6], Math.PI / 2);
    const her = spawnWife(g, 'home', [2.9, 0.55, 1.6], Math.PI / 2);
    her.state = 'lie'; her.setExpression('closed');
    hero.state = 'tired';
    g.followCamera({ dist: 2.6, height: 1.9, lookH: 1.2 });
    g.snapCamera();
    g.speedMul = 0.7;
    audio.ambience('room', true, 0.5);
    await g.fade(0, 2);
    g.ui.subtitle('03:12. Маленькая квартира. Мы почти не спим.', 4);
    await g.wait(1.5);
    babyCry();
    const cryT = g.onUpdate((dt, t) => { if (Math.floor(t * 0.5) !== Math.floor((t - dt) * 0.5)) babyCry(); });
    g.control(true);
    g.ui.objective('Подойти к кроватке');
    hero.state = 'tired';
    const keepTired = g.onUpdate(() => { if (hero.state === 'idle') hero.state = 'tired'; });
    await waitInteract(g, { pos: V3(1.0, 0, 1.8), radius: 1.3, label: 'Взять малыша на руки', facing: false });
    keepTired();
    g.control(false);
    g.ui.objective(null);
    hero.setBaby(true);
    hero.state = 'hold';
    hero.root.position.set(0.4, 0, 1.0); hero.root.rotation.y = 0.3;
    g.camSet([1.6, 1.5, -0.4], [0.4, 1.1, 1.0]);
    g.ui.subtitle('A и D по очереди, спокойно — укачивать', 6);
    let sleep = 0, last = 0, lastKey = null;
    g.ui.meter('МАЛЫШ ЗАСЫПАЕТ', 0);
    await g.until(() => {
      const t = g.time;
      let k = null;
      if (input.pressed('left')) k = 'L';
      if (input.pressed('right')) k = 'R';
      if (k) {
        const gap = t - last;
        if (k !== lastKey && gap > 0.45 && gap < 1.6) { sleep += 0.12; audio.tone({ f: k === 'L' ? 330 : 392, dur: 0.6, type: 'sine', vel: 0.03, wet: 0.5 }); }
        else if (gap < 0.3) { sleep = Math.max(0, sleep - 0.08); }
        last = t; lastKey = k;
        hero.root.rotation.y = 0.3 + (k === 'L' ? 0.15 : -0.15);
      }
      sleep = Math.max(0, sleep - g.dt * 0.01);
      g.ui.meter('МАЛЫШ ЗАСЫПАЕТ', sleep);
      return sleep >= 1;
    });
    cryT();
    g.ui.meter(null);
    audio.playMusic('sparse', { fade: 3 });
    await think(g, 'Уснул.');
    await think(g, 'Усталость была такой, что казалось — я сплю стоя. Но это был наш ребёнок.');
    await g.fade(1, 2);
    g.speedMul = 1;

    /* -------- a walk: the lonely playground -------- */
    playground(g, { warm: true });
    setWorldMood(g, { sat: 0.95, tint: [1.07, 1.0, 0.9], noise: 0.025 });
    const h2 = spawnHero(g, 'everyday', [0, 0, 12], Math.PI);
    const w2 = spawnWife(g, 'summer', [-1.0, 0, -5.4], 0);
    w2.setBaby(true); w2.state = 'hold';
    stroller(g, 0.2, -5.6, Math.PI / 2);
    g.followCamera({ dist: 3.2, height: 1.9, lookH: 1.3 });
    g.snapCamera();
    audio.ambience('birds', true, 0.35);
    audio.ambience('wind', true, 0.2);
    audio.playMusic('warm', { fade: 3 });
    await g.fade(0, 2);
    g.ui.subtitle('Но были и прогулки. Пустая площадка во дворе — только мы.', 4.5);
    g.control(true);
    g.ui.objective('Подойти к ним');
    await waitInteract(g, { pos: V3(-1.0, 0, -5.4), radius: 2.0, label: 'Посмотреть на них', facing: false });
    g.control(false);
    g.ui.objective(null);
    await g.faceTo(h2, w2.root.position, 0.4);
    await g.faceTo(w2, h2.root.position, 0.4);
    w2.setExpression('smile'); h2.setExpression('smile');
    g.camera.fov = 40; g.camera.updateProjectionMatrix();
    g.camSet([h2.root.position.x + 0.3, 1.6, h2.root.position.z + 0.8], [-1.0, 1.3, -5.4]);
    await g.wait(1.5);
    await think(g, 'Я был счастлив просто смотреть на них. На неё — с нашим ребёнком на руках.');
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    await g.camMove([7, 6, 9], [-1, 0.8, -4.5], 6);
    await endMemory(g, 'Воспоминание: «Площадка»');
  },
};
