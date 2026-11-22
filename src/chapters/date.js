// Chapter 3 — first date (a walk), work keeps him late, missing her, first kiss.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import { cityStreet, toyWarehouse, pondPark } from '../world/places.js';
import * as T from '../engine/textures.js';
import { STORY } from '../config/story.js';
import { lerpAngle } from '../engine/game.js';
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
    let together = 0;
    g.bounds = (p) => { p.z = Math.max(-62, Math.min(6, p.z)); };
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
      // she walks at his side and matches his pace (he leads the walk)
      const p = her.root.position;
      const hp = hero.root.position;
      const want = V3(Math.max(-1.6, Math.min(1.6, hp.x - 0.85)), 0, Math.max(-60, Math.min(3, hp.z - 0.25)));
      const dx = want.x - p.x, dz = want.z - p.z, d = Math.hypot(dx, dz);
      const dist = hp.distanceTo(p);
      const close = dist < 2.2;
      if (d > 0.15) {
        const sp = Math.min(2.4, d * 4);
        p.x += dx / d * sp * dt; p.z += dz / d * sp * dt;
        her.root.rotation.y = lerpAngle(her.root.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8));
        her.state = sp > 2.2 ? 'run' : 'walk';
      } else {
        her.state = 'idle';
        her.root.rotation.y = lerpAngle(her.root.rotation.y, hero.root.rotation.y, Math.min(1, dt * 3));
      }
      her.lookYaw = THREE.MathUtils.lerp(her.lookYaw, close ? 0.45 : 0, dt * 2);
      if (close) together = Math.min(1, together + dt / 32);
      g.ui.meter('РЯДОМ', together);
      lineTimer += dt;
      if (close && lineTimer > 5 && lineIdx < lines.length) {
        lineTimer = 0;
        const [who, txt] = lines[lineIdx++];
        g.ui.say(who, txt, { auto: 3.6, passive: true }).catch(() => {});
        if (who === 'Она') { her.setExpression('smile'); g.wait(2).then(() => her.setExpression('neutral')).catch(() => {}); }
      }
      return together >= 1 && lineIdx >= lines.length && lineTimer > 3.8;
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

    /* ---------------- the toy warehouse, late ---------------- */
    const WH = toyWarehouse(g);
    const h2 = spawnHero(g, 'work', [6.0, 0, 4.4], -Math.PI / 2);
    g.followCamera({ dist: 3.0, height: 2.0, lookH: 1.3 });
    g.snapCamera();
    audio.ambience('hum', true, 0.6);
    audio.playMusic('sparse', { fade: 2 });
    await g.fade(0, 1.5);
    g.ui.subtitle(`${STORY.lateWorkTime}. Склад игрушек почти пуст.`, 3.5);
    let clock = 21 * 60 + 47;
    const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    WH.setClock(fmt(clock));
    const msgs = ['Ты ещё на работе?', 'Сегодня опять не получится?', 'Ладно. Понятно.'];
    const cardM = B.M({ map: T.toyBoxTex('#e0b030', 0) });
    for (let i = 0; i < 3; i++) {
      g.control(true);
      g.ui.objective(`Разложить коробки (${i}/3) · взять коробку с поддона`);
      await waitInteract(g, { pos: WH.piles[i], radius: 1.4, label: 'Взять коробку', facing: false });
      audio.thump();
      const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.4), cardM);
      h2.carry(boxMesh);
      const slot = WH.slots[i];
      const marker = B.memoryShard(g, slot.x, slot.y + 0.3, slot.z + 0.55, 0xffd080);
      g.ui.objective(`Разложить коробки (${i}/3) · отнести на средний стеллаж`);
      await waitInteract(g, { pos: V3(slot.x, 0, slot.z + 0.95), radius: 1.3, label: 'Поставить на полку', facing: false });
      marker.remove();
      h2.carry(null);
      B.box(g, 0.6, 0.4, 0.7, B.M({ map: T.toyBoxTex(['#c84a3a', '#3a7ac8', '#4aa860'][i], i + 1) }), slot.x, slot.y, slot.z);
      audio.thump();
      g.control(false);
      clock += [44, 41, 38][i];
      WH.setClock(fmt(clock));
      g.ui.objective(null);
      audio.buzz();
      h2.state = 'phone';
      await g.ui.choose(`Она · ${fmt(clock)}`, msgs[i], i < 2 ? ['Прости, ещё немного.', 'Да… работа.'] : ['…']);
      h2.state = 'idle';
      if (i === 2) h2.setExpression('sad');
    }
    h2.state = 'tired';
    g.letterbox(true);
    const hp2 = h2.root.position;
    await g.camOrbit([hp2.x, 0, hp2.z], { r0: 2.0, r1: 3.6, h0: 1.5, h1: 3.2, a0: h2.root.rotation.y + 0.6, a1: h2.root.rotation.y + 1.4, look: 1.3, dur: 4 });
    await think(g, 'Я стоял один среди стеллажей с игрушками и вдруг понял, что скучаю по ней.');
    await think(g, 'Не по свиданию. По ней.');
    g.letterbox(false);
    await g.fade(1, 1.5);
    audio.stopAllAmbience();

    /* ---------------- the pond, evening: the first kiss on the bench ---------------- */
    pondPark(g, { evening: true });
    // the bench nearest to the path entrance (see pondPark: benches at radius 10.4, angle 0.4 + i·π/2)
    const ba = 0.4 + Math.PI / 2;
    const bx = Math.cos(ba) * 10.4 * 1.3, bz = Math.sin(ba) * 10.4;
    const brot = -ba - Math.PI / 2;
    const seatAt = (dx) => V3(bx + Math.cos(brot) * dx + Math.sin(brot) * 0.05, 0, bz - Math.sin(brot) * dx + Math.cos(brot) * 0.05);
    const bl = B.lamp(g, bx, 3.2, bz + 0.6, 0xffd8a0, 1.4, 6, { bulb: false });
    void bl;
    const h3 = spawnHero(g, 'trench', [bx + 1.5, 0, bz + 6], Math.PI, { extra: { backpack: null } });
    const herSeat = seatAt(0.25);
    const her3 = spawnWife(g, 'date', [herSeat.x, 0.02, herSeat.z], brot);
    her3.state = 'sit';
    g.followCamera({ dist: 3.0, height: 1.8, lookH: 1.4 });
    g.snapCamera();
    audio.ambience('wind', true, 0.25);
    audio.playMusic('theme', { fade: 3 });
    await g.fade(0, 1.5);
    g.ui.subtitle('Вечер. Пруд. Она ждёт на лавке.', 3.5);
    g.control(true);
    g.ui.objective('Подойти к лавке');
    const heroSeat = seatAt(-0.25);
    await waitInteract(g, { pos: V3(bx, 0, bz).add(V3(Math.sin(brot) * 0.9, 0, Math.cos(brot) * 0.9)), radius: 1.6, label: 'Сесть рядом', facing: false });
    g.control(false);
    g.ui.objective(null);
    her3.lookYaw = -0.6;
    await g.fade(1, 0.5);
    h3.root.position.set(heroSeat.x, 0.02, heroSeat.z); h3.root.rotation.y = brot; h3.state = 'sit';
    // a two-shot from the front of the bench
    const front = V3(bx + Math.sin(brot) * 2.6, 0, bz + Math.cos(brot) * 2.6);
    g.letterbox(true);
    g.camera.fov = 42; g.camera.updateProjectionMatrix();
    g.camSet([front.x, 1.25, front.z], [bx, 1.0, bz]);
    await g.fade(0, 0.6);
    await g.ui.talk([['Она', 'Ты всё-таки пришёл.'], ['Ты', 'Я скучал.']]);
    her3.setExpression('smile');
    // they turn toward each other
    await Promise.all([
      g.tween(0.8, (k) => { h3.root.rotation.y = brot + 0.85 * k; her3.root.rotation.y = brot - 0.85 * k; }),
    ]);
    h3.lookYaw = 0; her3.lookYaw = 0;
    const mid = h3.root.position.clone().lerp(her3.root.position, 0.5);
    g.camera.fov = 36; g.camera.updateProjectionMatrix();
    // profile two-shot: straight in front of the bench, both faces in profile
    g.camSet([mid.x + Math.sin(brot) * 1.6, 1.22, mid.z + Math.cos(brot) * 1.6], [mid.x, 1.18, mid.z]);
    g.ui.prompt('E — поцеловать');
    await g.until(() => input.pressed('act'));
    g.ui.prompt(null);
    // awkward: noses bump
    h3.kissSide = 1; her3.kissSide = -1;
    h3.state = 'sitKiss'; her3.state = 'sitKiss';
    await g.wait(0.45);
    audio.thump();
    h3.state = 'sit'; her3.state = 'sit';
    h3.setExpression('smile'); her3.setExpression('joy');
    audio.laugh();
    g.ui.subtitle('…неловко.', 2);
    await g.wait(1.4);
    h3.state = 'sitKiss'; her3.state = 'sitKiss';
    h3.setExpression('closed'); her3.setExpression('closed');
    audio.setIntensity(1);
    // the camera slowly circles the bench, then rises over the pond
    const a0 = Math.atan2(front.x - mid.x, front.z - mid.z);
    await g.camOrbit(mid, { r0: 1.8, r1: 2.6, h0: 1.25, h1: 1.7, a0: a0 - 0.6, a1: a0 + 0.7, look: 1.15, dur: 6 });
    g.fovTo(55, 5).catch(() => {});
    await g.camMove([mid.x * 0.4, 6, mid.z * 0.4], [mid.x, 1.0, mid.z], 6);
    g.letterbox(false);
    await endMemory(g, 'Воспоминание: «Первый поцелуй»');
    audio.setIntensity(0);
  },
};
