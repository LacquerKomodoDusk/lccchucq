// Chapter 8 — inner struggle. Depression and panic attacks shown through space,
// sound and time — never as a monster or a villain. Breathing helps; she tries
// to understand.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import * as T from '../engine/textures.js';
import { apartment } from '../world/places.js';
import { globalUniforms } from '../engine/ps1.js';
import { spawnHero, spawnWife, think, chapterStart, endMemory, waitInteract, V3, setWorldMood, glitchBurst, fourthWall } from './common.js';
import { dreamSegment } from './dream.js';

const LOOP = 20;

export default {
  num: 'ГЛАВА 8',
  title: 'Внутри',
  async run(g) {
    await chapterStart(g, this);

    /* -------- the corridor that never ends -------- */
    g.newScene({ bg: 0x0e0f0c, fog: [0x0e0f0c, 2, 15], hemi: [0x8a8a70, 0x1a1a14, 0.55], sun: null });
    const wallM = B.M({ map: T.wallpaperTex([12, 1], '#5a5a48', '#4a4a3a') });
    const floorM = B.M({ map: T.tilesTex('#5a544a', '#524c42', [2, 20], '#3a362e') });
    const W = 2.4, z0 = 4, z1 = -36;
    B.plane(g, W, z0 - z1, floorM, 0, 0, (z0 + z1) / 2);
    B.plane(g, W, z0 - z1, B.M({ color: '#3a3a34' }), 0, 2.6, (z0 + z1) / 2, Math.PI / 2);
    B.box(g, 0.2, 2.6, z0 - z1, wallM, -W / 2 - 0.1, 0, (z0 + z1) / 2, { solid: true });
    B.box(g, 0.2, 2.6, z0 - z1, wallM, W / 2 + 0.1, 0, (z0 + z1) / 2, { solid: true });
    B.box(g, W, 2.6, 0.2, wallM, 0, 0, z0, { solid: true });
    const lamps = [];
    for (let z = 2; z > z1; z -= 4) {
      B.door(g, -W / 2 + 0.02, z, Math.PI / 2, { color: '#4a3a30' });
      B.door(g, W / 2 - 0.02, z - 2, -Math.PI / 2, { color: '#4a3a30' });
      lamps.push(B.lamp(g, 0, 2.45, z, 0xe8d8a0, 0.9, 5));
    }
    // wall clock, repeated each loop segment
    const clocks = [];
    for (let z = -6; z > z1; z -= LOOP) {
      const c = B.inscription(g, '23:58', -W / 2 + 0.05, 1.9, z, Math.PI / 2, { w: 0.9, h: 0.25, color: '#d8c890' });
      clocks.push(c);
    }
    const setClock = (txt) => clocks.forEach((c) => {
      c.material.map = T.textTex(txt, { w: 256, h: 64, color: '#d8c890', font: 13 }); c.material.needsUpdate = true;
    });
    const hero = spawnHero(g, 'tired', [0, 0, 2], Math.PI);
    g.followCamera({ dist: 2.6, height: 1.8, lookH: 1.4 });
    g.snapCamera();
    g.noRun = true;
    audio.playMusic('anxiety', { fade: 3 });
    setWorldMood(g, { sat: 0.5, noise: 0.06 });
    await g.fade(0, 2);
    g.ui.subtitle('Это было не во сне. Это было внутри.', 4);
    await g.wait(1.5);
    await think(g, 'Мне просто нужно дойти до своей двери. Почему коридор не кончается?');
    g.control(true);
    g.ui.objective('Найти свою дверь');
    g.debugGoal = () => V3(0, 0, hero.root.position.z - 1.5);

    let loops = 0;
    const clockTexts = ['23:58', '23:58', '03:61', '??:??', '—'];
    const messages = [];
    let breathePhase = false;
    let flicker = 0;
    g.onUpdate((dt, t) => {
      const p = hero.root.position;
      if (p.z < -2 - LOOP) {
        p.z += LOOP;
        g.camera.position.z += LOOP;
        if (g.camLook) g.camLook.z += LOOP;
        loops++;
        setClock(clockTexts[Math.min(loops, clockTexts.length - 1)]);
        audio.glitch(0.08);
        globalUniforms.uWarp.value = Math.min(1.2, 0.2 + loops * 0.25);
        audio.setIntensity(loops);
        if (loops === 1) g.ui.subtitle('Тот же коридор.', 2.5);
        if (loops === 2) messages.push('phone');
        if (loops === 3) g.ui.subtitle('Время сломалось.', 2.5);
        if (loops >= 3 && !breathePhase) messages.push('breathe');
      }
      // lights flicker more with every loop
      flicker -= dt;
      if (flicker <= 0) {
        flicker = 0.05 + Math.random() * (1.5 - Math.min(1.2, loops * 0.3));
        for (const l of lamps) l.intensity = Math.random() < 0.15 * loops ? 0.1 : 0.9;
      }
      g.r.post.uDistort.value = Math.min(0.35, loops * 0.06) * (breathePhase ? 0.5 : 1);
    });

    // events driven by the loop count
    let phoneDone = false;
    await g.until(() => messages.includes('phone'));
    g.control(false);
    audio.buzz();
    await g.wait(0.6);
    hero.state = 'phone';
    const c = await g.ui.choose('Она', 'Ты где? Всё хорошо?', ['«Всё нормально».', '«Мне плохо. Я не понимаю, что со мной».']);
    if (c === 0) await g.ui.say('Она', 'Я же вижу, что нет. Я рядом. Ладно?');
    else await g.ui.say('Она', 'Я не всегда понимаю, что с тобой. Но я рядом.');
    hero.state = 'tired';
    phoneDone = true;
    void phoneDone;
    g.control(true);
    await g.until(() => messages.includes('breathe'));
    breathePhase = true;
    g.debugGoal = null;
    g.control(false);
    hero.state = 'anxious'; hero.setExpression('fear');
    audio.heartbeat();
    await think(g, 'Сердце колотится. Воздуха не хватает. Я знаю это состояние.');
    await think(g, 'Не убегать. Остановиться. Дышать.');
    g.ui.objective('Удерживай Q — вдох, отпусти — выдох');
    let cycles = 0, inhale = 0, state = 'in';
    g.ui.meter('ВДОХ', 0);
    await g.until(() => {
      const dt = g.dt;
      if (state === 'in') {
        if (input.isDown('breathe')) { if (inhale === 0) audio.breathe(true); inhale = Math.min(1, inhale + dt / 3); }
        else if (inhale >= 1) { state = 'out'; audio.breathe(false); }
        else inhale = Math.max(0, inhale - dt * 0.6);
        g.ui.meter(inhale >= 1 ? 'ТЕПЕРЬ ОТПУСТИ' : 'ВДОХ', inhale);
      } else {
        inhale = Math.max(0, inhale - dt / 3.5);
        g.ui.meter('ВЫДОХ', inhale);
        if (inhale <= 0) {
          state = 'in'; cycles++;
          globalUniforms.uWarp.value = Math.max(0, globalUniforms.uWarp.value - 0.35);
          audio.setIntensity(Math.max(0, 3 - cycles));
          for (const l of lamps) l.intensity = 0.9;
          if (cycles === 1) g.ui.subtitle('Раз.', 2);
          if (cycles === 2) g.ui.subtitle('Два.', 2);
        }
      }
      return cycles >= 3;
    });
    g.ui.meter(null);
    g.ui.objective(null);
    hero.state = 'idle'; hero.setExpression('neutral');
    setClock('07:30');
    globalUniforms.uWarp.value = 0;
    breathePhase = true;
    await think(g, 'Три. Пространство перестало плыть.');
    // the right door appears just ahead
    const p = hero.root.position;
    const doorZ = p.z - 3;
    const homeDoor = B.door(g, W / 2 - 0.03, doorZ, -Math.PI / 2, { color: '#7a5a3a', glow: true });
    void homeDoor;
    const dl = B.lamp(g, W / 2 - 0.4, 1.6, doorZ, 0xffd8a0, 1.4, 4, { bulb: false });
    void dl;
    audio.stopMusic(3);
    g.control(true);
    g.ui.objective('Домой');
    await waitInteract(g, { pos: V3(W / 2 - 0.5, 0, doorZ), radius: 1.3, label: 'Открыть свою дверь', facing: false });
    g.control(false);
    g.noRun = false;
    audio.door();
    await g.fade(1, 1.5);

    /* -------- morning kitchen -------- */
    apartment(g, {});
    setWorldMood(g, { sat: 0.7 });
    const h2 = spawnHero(g, 'tired', [0.5, 0, 1.0], -Math.PI / 2);
    B.box(g, 0.06, 0.12, 0.06, B.M({ color: '#d8d8e0' }), 2.2, 0.75, -0.5);
    B.box(g, 0.1, 0.02, 0.06, B.M({ color: '#e8e8e8' }), 2.45, 0.75, -0.6);
    g.followCamera({ dist: 2.6, height: 1.8, lookH: 1.3 });
    g.snapCamera();
    audio.ambience('room', true, 0.4);
    audio.playMusic('sparse', { fade: 3 });
    await g.fade(0, 2);
    g.control(true);
    await waitInteract(g, { pos: V3(2.4, 0, 0.1), radius: 1.2, label: 'Утро', facing: false });
    g.control(false);
    h2.root.position.set(2.4, 0, 0.12); h2.root.rotation.y = Math.PI; h2.state = 'sit';
    g.camSet([3.6, 1.6, 1.2], [2.4, 1.0, -0.4]);
    await think(g, 'Таблетка. Стакан воды. Ещё один день.');
    await think(g, 'Я старался справляться сам. Как умел.');
    const w2 = spawnWife(g, 'home', [-2.5, 0, 2.2], 0);
    await g.walkTo(w2, [2.4, 0, -1.3], { speed: 1.1 });
    w2.root.rotation.y = 0; w2.state = 'sit';
    await g.ui.talk([
      ['Она', 'Я не всегда понимаю, что с тобой происходит.'],
      ['Она', 'Но я пытаюсь. Правда.'],
      ['Ты', 'Я знаю.'],
    ]);
    await think(g, 'Это было не её виной. И не моей. Просто так было.');
    await endMemory(g, 'Воспоминание: «Утро»');

    /* -------- the last pursuit -------- */
    document.title = 'Ты не убежишь';
    await dreamSegment(g, {
      layout: 'maze', theme: 'concrete', size: 5, seed: 47, reveal: 0.8, outfit: 'tired', speed: 2.55, warp: 0.3,
      shards: [{ text: 'Автобус.' }, { text: 'Пруд.' }, { text: 'Роддом.' }, { text: 'Кухня ночью.' }, { text: 'Её лицо. Я знаю это лицо.' }],
      doorLabel: 'Встретиться с ней',
      caughtLine: '«Ты всё равно от меня не убежишь»',
      async intro(g) {
        await think(g, 'Она снова здесь. Но теперь я хочу понять, кто она.');
      },
      events: [
        { at: 15, run: async (g) => fourthWall(g, `Ты играешь уже ${g.playMinutes()} мин. Она ждала дольше.`) },
        {
          shard: 3, run: async (g) => {
            g.control(false);
            g.ui.fakeCrash(true);
            audio.glitch(0.4);
            const prev = g.r.post.uDistort.value; g.r.post.uDistort.value = 0.8;
            await g.wait(3.2);
            g.ui.fakeCrash(false);
            g.r.post.uDistort.value = prev;
            fourthWall(g, 'Восстановлено. Не всё можно потерять.');
            g.control(true);
          },
        },
      ],
      pauseExtra: { label: 'Перестать бежать', action: () => fourthWall(g, 'Почти. Найди её. Тогда сможешь.') },
    });
    document.title = 'THE LAST MEMORY';
  },
};
