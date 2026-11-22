// Chapter 3 — first date (a walk), work keeps him late, missing her, first kiss.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import { cityStreet, office } from '../world/places.js';
import { STORY } from '../config/story.js';
import { spawnHero, spawnWife, think, chapterStart, endMemory, waitInteract, waitReach, V3 } from './common.js';

export default {
  num: 'ГЛАВА 3',
  title: 'Первое свидание',
  async run(g) {
    await chapterStart(g, this);

    /* ---------------- the walk ---------------- */
    cityStreet(g, { length: 70 });
    const hero = spawnHero(g, 'trench', [0.4, 0, 2], Math.PI, { extra: { backpack: null } });
    const her = spawnWife(g, 'date', [-0.6, 0, 1.5], Math.PI);
    g.followCamera({ dist: 3.2, height: 1.9, lookH: 1.4 });
    g.snapCamera();
    audio.ambience('city', true, 0.6);
    audio.playMusic('theme', { fade: 4 });
    await g.fade(0, 2);
    g.ui.subtitle('Первое свидание. Просто прогулка.', 3.5);
    await g.wait(1.5);
    await g.ui.say('Она', 'Ну что… пойдём?');
    g.control(true);
    g.ui.objective('Иди рядом с ней');

    // she walks ahead along the street; staying close fills the meter
    const path = [[-0.4, -10], [0.3, -20], [-0.6, -32], [0.2, -44], [-0.3, -56]];
    let wp = 0, together = 0;
    const lines = [
      ['Она', 'Ты всегда так поздно заканчиваешь?'],
      ['Ты', 'Почти всегда. Работа.'],
      ['Она', 'Хм. Тогда это свидание — редкость.'],
      ['Ты', 'Значит, надо его не испортить.'],
      ['Она', '…Пока у тебя неплохо получается.'],
    ];
    let lineIdx = 0, lineTimer = 0;
    g.ui.meter('РЯДОМ', 0);
    g.debugGoal = () => her.root.position.clone().add(V3(0.9, 0, 0.6));
    await g.until(() => {
      const dt = g.dt;
      const p = her.root.position;
      const t = path[wp];
      const d = Math.hypot(t[0] - p.x, t[1] - p.z);
      const dist = hero.root.position.distanceTo(p);
      const close = dist < 2.0;
      // she waits a little if he lags behind
      const spd = dist > 4 ? 0 : 1.15;
      if (d < 0.3) wp = Math.min(path.length - 1, wp + 1);
      else if (spd > 0) {
        p.x += (t[0] - p.x) / d * spd * dt; p.z += (t[1] - p.z) / d * spd * dt;
        her.root.rotation.y = Math.atan2(t[0] - p.x, t[1] - p.z);
        her.state = 'walk';
      } else {
        her.state = 'idle';
        her.lookYaw = THREE.MathUtils.lerp(her.lookYaw, Math.PI * 0.6, dt * 2);
      }
      if (spd > 0) her.lookYaw = THREE.MathUtils.lerp(her.lookYaw, close ? 0.5 : 0, dt * 2);
      if (close) together = Math.min(1, together + dt / 40);
      g.ui.meter('РЯДОМ', together);
      lineTimer += dt;
      if (close && lineTimer > 6 && lineIdx < lines.length && !g.ui.dlg) {
        lineTimer = 0;
        const [who, txt] = lines[lineIdx++];
        g.ui.say(who, txt, { auto: 3.2 }).catch(() => {});
        if (who === 'Она') { her.setExpression('smile'); g.wait(2).then(() => her.setExpression('neutral')).catch(() => {}); }
      }
      return together >= 1 && lineIdx >= lines.length && !g.ui.dlg;
    });
    g.ui.meter(null);
    g.debugGoal = null;
    g.control(false);
    await g.faceTo(her, hero.root.position);
    await g.ui.talk([
      ['Она', 'Давай завтра тоже увидимся?'],
      ['Ты', 'Я постараюсь. Правда.'],
    ]);
    await g.fade(1, 1.5);

    /* ---------------- the office, late ---------------- */
    const O = office(g);
    const h2 = spawnHero(g, 'work', [0, 0, 2.3], Math.PI, { control: false });
    h2.state = 'sit';
    g.setFixedCamera([1.8, 1.7, 3.9], [0, 0.9, 1.4]);
    audio.ambience('hum', true, 0.6);
    audio.playMusic('sparse', { fade: 2 });
    await g.fade(0, 1.5);
    g.ui.subtitle(`${STORY.lateWorkTime}. Офис почти пуст.`, 3.5);
    let clock = 21 * 60 + 47;
    const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const msgs = ['Ты ещё на работе?', 'Сегодня опять не получится?', 'Ладно. Понятно.'];
    for (let i = 0; i < 3; i++) {
      g.ui.objective(`Закончить работу (${i}/3) · E — печатать`);
      // type: press E several times
      let presses = 0;
      await g.until(() => {
        if (input.pressed('act')) { presses++; audio.tone({ f: 1800 + Math.random() * 400, dur: 0.03, vel: 0.03, type: 'square' }); clock += 3; }
        return presses >= 8;
      });
      g.ui.objective(null);
      audio.buzz();
      const pick = await g.ui.choose(`Она · ${fmt(clock)}`, msgs[i], i < 2 ? ['Прости, ещё немного.', 'Да… работа.'] : ['…']);
      void pick;
      if (i === 2) h2.setExpression('sad');
    }
    O.screens[4].material.color.set('#111');
    h2.state = 'tired';
    await think(g, 'Я сидел в пустом офисе и вдруг понял, что скучаю по ней.');
    await think(g, 'Не по свиданию. По ней.');
    await g.fade(1, 1.5);
    audio.stopAllAmbience();

    /* ---------------- under the lamp: the first kiss ---------------- */
    cityStreet(g, { length: 40 });
    const h3 = spawnHero(g, 'trench', [0.3, 0, -4], Math.PI, { extra: { backpack: null } });
    const her3 = spawnWife(g, 'date', [1.1, 0, -14.5], 0);
    g.followCamera({ dist: 3.0, height: 1.8, lookH: 1.4 });
    g.snapCamera();
    audio.ambience('city', true, 0.4);
    audio.playMusic('theme', { fade: 3 });
    await g.fade(0, 1.5);
    g.control(true);
    g.ui.objective('Она ждёт под фонарём');
    await waitReach(g, her3.root.position, 1.6);
    g.control(false);
    g.ui.objective(null);
    await g.faceTo(h3, her3.root.position, 0.4);
    await g.faceTo(her3, h3.root.position, 0.4);
    await g.ui.talk([['Она', 'Ты всё-таки пришёл.'], ['Ты', 'Я скучал.']]);
    her3.setExpression('smile');
    // move closer
    const dirTo = new THREE.Vector3().subVectors(her3.root.position, h3.root.position).setY(0).normalize();
    const stand = her3.root.position.clone().addScaledVector(dirTo, -0.55);
    await g.walkTo(h3, [stand.x, 0, stand.z], { speed: 0.6 });
    const mid = h3.root.position.clone().lerp(her3.root.position, 0.5);
    await g.faceTo(h3, her3.root.position, 0.2);
    const side = new THREE.Vector3().subVectors(her3.root.position, h3.root.position).normalize();
    const camPos = mid.clone().add(new THREE.Vector3(-side.z, 0, side.x).multiplyScalar(2.3)).setY(1.55);
    g.camSet(camPos.toArray(), [mid.x, 1.45, mid.z]);
    g.camera.fov = 45; g.camera.updateProjectionMatrix();
    g.ui.prompt('E — поцеловать');
    await g.until(() => input.pressed('act'));
    g.ui.prompt(null);
    // awkward: noses bump
    h3.state = 'kiss'; her3.state = 'kiss';
    await g.wait(0.45);
    audio.thump();
    h3.state = 'idle'; her3.state = 'idle';
    h3.setExpression('smile'); her3.setExpression('joy');
    audio.laugh();
    g.ui.subtitle('…неловко.', 2);
    await g.wait(1.4);
    h3.state = 'kiss'; her3.state = 'kiss';
    h3.setExpression('closed'); her3.setExpression('closed');
    audio.setIntensity(1);
    await g.wait(3.5);
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    await g.camMove([mid.x + 3, 4, mid.z + 4], [mid.x, 1.4, mid.z], 5);
    await endMemory(g, 'Воспоминание: «Первый поцелуй»');
    audio.setIntensity(0);
  },
};
