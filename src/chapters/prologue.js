import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import * as B from '../world/build.js';
import * as T from '../engine/textures.js';
import { spawnHero, think, chapterStart, waitInteract, glitchBurst, V3 } from './common.js';
import { dreamSegment, figureGlimpse } from './dream.js';

export default {
  num: 'ПРОЛОГ',
  title: 'Сон',
  async run(g) {
    await chapterStart(g, this);

    /* ---------------- bedroom, evening ---------------- */
    g.newScene({ bg: 0x0c0d10, fog: [0x0c0d10, 4, 14], hemi: [0x55607a, 0x1a1510, 0.5], sun: [0x8090c0, 0.15, [3, 5, 2]] });
    B.room(g, { w: 5, d: 4.4, h: 2.6, floor: B.M({ map: T.woodTex([4, 4], '#5a4030') }), wall: B.M({ map: T.wallpaperTex([3, 1], '#6b6555', '#5b5545') }), ceil: B.M({ color: '#9a978c' }) });
    const bed = B.bed(g, -1.2, -1.0, 0);
    B.table(g, 0.2, -1.85, 0.45, 0.4, 0.55, { color: '#4a3a2a' });
    B.lamp(g, 0.2, 0.75, -1.85, 0xffc070, 1.4, 5);
    B.box(g, 0.2, 0.2, 0.2, B.M({ color: '#d8b070', unlit: true }), 0.2, 0.55, -1.85);
    B.shelf(g, 2.25, 0.4, -Math.PI / 2, { w: 1.2, h: 1.6 });
    B.windowPane(g, 2.42, 1.5, -1.2, 1.1, 1.0, -Math.PI / 2, { color: '#1f2a40', emissive: 0x0a1020 });
    B.box(g, 1.0, 0.75, 0.6, B.M({ map: T.woodTex([1, 1], '#4f3a2a') }), -1.5, 0, 1.75, { solid: true });
    B.door(g, 0.9, 2.18, Math.PI);
    const phone = B.box(g, 0.08, 0.015, 0.15, B.M({ color: '#111', emissive: 0x112233 }), 0.1, 0.55, -1.8);
    void phone;

    const hero = spawnHero(g, 'home', [0.6, 0, 1.0], Math.PI);
    g.followCamera({ dist: 2.2, height: 1.65, lookH: 1.3 });
    g.snapCamera();
    audio.ambience('room', true, 0.6);
    audio.ambience('rain', true, 0.25);
    audio.playMusic('sparse', { fade: 4 });
    await g.fade(0, 2);
    g.control(true);
    g.ui.objective('Обычный вечер. Пора спать.');

    g.interact({ pos: V3(2.2, 0, -1.2), radius: 1.3, label: 'Окно', onInteract: () => think(g, 'За окном — мокрый асфальт и фонари. Обычный вечер.') });
    g.interact({ pos: V3(2.0, 0, 0.4), radius: 1.2, label: 'Полка', onInteract: () => think(g, 'Фотографии. Странно — не могу вспомнить, когда мы их сделали.') });
    g.interact({ pos: V3(0.2, 0, -1.6), radius: 1.0, label: 'Телефон', onInteract: () => think(g, 'Будильник на утро. Новых сообщений нет.') });

    await waitInteract(g, { pos: V3(-0.3, 0, -0.6), radius: 1.2, label: 'Лечь спать', facing: false });
    g.control(false);
    g.ui.objective(null);
    await g.fade(1, 1.2);
    hero.root.position.set(-1.2, 0.55, -0.4);
    hero.root.rotation.y = Math.PI;
    hero.state = 'lie';
    hero.setExpression('closed');
    g.camSet([0.6, 1.9, 1.2], [-1.2, 0.6, -0.8]);
    await g.fade(0, 1.5);
    await think(g, 'Ещё один день.', { auto: 2.5 });
    audio.stopMusic(4);
    await g.camMove([-0.6, 1.4, -0.2], [-1.2, 0.7, -0.9], 4);
    for (let i = 0; i < 3; i++) { audio.heartbeat(audio.now, audio.sfx, 0.5); await g.wait(1.1); }
    await g.fade(1, 2);
    audio.stopAllAmbience();
    await g.wait(1.5);

    /* ---------------- the dream ---------------- */
    await dreamSegment(g, {
      layout: 'field', theme: 'field', seed: 3, reveal: 0, outfit: 'home',
      shards: [
        { text: 'Осень. Запах мокрых листьев.' },
        { text: 'Шипение дверей автобуса.' },
        { text: 'Что-то красное в тумане.' },
      ],
      doorLabel: 'Войти в воспоминание',
      async intro(g, ctx, fig, hero) {
        hero.state = 'idle';
        await think(g, 'Где я?..');
        g.ui.objective('Осколки воспоминаний: 0 / 3');
        await figureGlimpse(g, ctx, fig, hero, { dist: 16, text: 'Там кто-то стоит. Женщина?' });
        await think(g, 'Исчезла. Нужно найти выход.');
      },
      events: [
        { shard: 1, run: async (g) => { await g.wait(1.5); g.ui.subtitle('Она идёт за мной.', 3); } },
      ],
    });
    void bed;
  },
};
