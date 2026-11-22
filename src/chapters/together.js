// Chapter 4 — living together: chaotic first months, the walk by the pond.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import { apartment, pondPark } from '../world/places.js';
import { STORY } from '../config/story.js';
import { spawnHero, spawnWife, think, chapterStart, endMemory, V3, glitchBurst, embrace } from './common.js';
import { dreamSegment } from './dream.js';

export default {
  num: 'ГЛАВА 4',
  title: 'Вместе',
  async run(g) {
    await chapterStart(g, this);

    /* -------- nightmare interlude -------- */
    await dreamSegment(g, {
      layout: 'field', theme: 'field', seed: 21, reveal: 0.4, outfit: 'everyday', speed: 2.35,
      shards: [{ text: 'Коробки. Много коробок.' }, { text: 'Смех в пустой квартире.' }, { text: 'Вода. Пруд.' }, { text: '«Ты всё равно от меня не убежишь!»' }],
      doorLabel: 'Войти в воспоминание',
      async intro(g, ctx, fig, hero) {
        await think(g, 'У неё… красное на голове? Как шапка.');
      },
      events: [
        { shard: 2, run: async (g) => { await glitchBurst(g, 0.4, 0.4); g.ui.subtitle('Почему она так похожа на…', 3); } },
      ],
    });

    /* -------- moving in -------- */
    const A = apartment(g, { boxes: true });
    const hero = spawnHero(g, 'home', [-3, 0, 2.2], Math.PI);
    const her = spawnWife(g, 'home', [1.4, 0, 0.8], -Math.PI / 2);
    g.followCamera({ dist: 2.8, height: 1.9, lookH: 1.3 });
    g.snapCamera();
    audio.playMusic('warm', { fade: 3 });
    await g.fade(0, 2);
    g.ui.subtitle('Через несколько месяцев мы стали жить вместе.', 4);
    await g.wait(2);
    await g.ui.say('Она', 'Так. Коробки сами себя не разберут.');
    g.control(true);

    const spots = [
      { label: 'Разобрать коробку', line: ['Она', 'Почему ложки лежат вместе с ботинками?!'], reply: ['Ты', 'Это… система.'] },
      { label: 'Разобрать коробку', line: ['Ты', 'Кажется, у нас три одинаковых сковородки.'], reply: ['Она', 'Значит, будем готовить втроём.'] },
      { label: 'Разобрать коробку', line: ['Она', 'Ты слышишь? Тишина. Наша тишина.'], reply: ['Ты', 'Непривычно.'] },
    ];
    let done = 0;
    await new Promise((resolve) => {
      A.boxes.slice(0, 3).forEach((bx, i) => {
        g.interact({
          pos: V3(bx.position.x, 0, bx.position.z), radius: 1.1, label: spots[i].label, once: true,
          onInteract: async () => {
            await g.tween(0.4, (k) => { bx.scale.setScalar(1 - k * 0.99); });
            bx.visible = false;
            audio.thump();
            her.setExpression('smile');
            await g.ui.talk([spots[(done) % 3].line, spots[(done) % 3].reply]);
            her.setExpression('neutral');
            done++;
            g.ui.objective(`Коробки: ${done} / 3`);
            if (done >= 3) resolve();
          },
        });
      });
      g.ui.objective('Коробки: 0 / 3');
    });
    g.control(false);
    g.ui.objective(null);
    her.setExpression('joy');
    hero.setExpression('smile');
    audio.laugh();
    await think(g, 'Первые месяцы были весёлыми и хаотичными.');
    await g.fade(1, 1.5);

    /* -------- the pond: snowy November -------- */
    pondPark(g, { snow: true });
    const h = spawnHero(g, 'rain', [0, 0, 11], Math.PI);
    const w = spawnWife(g, 'busCoat', [1.5, 0, 9.6], Math.PI, { scarf: '#8a6a5a' });
    g.followCamera({ dist: 3.4, height: 2.0, lookH: 1.3 });
    g.snapCamera();
    audio.ambience('wind', true, 0.35);
    audio.playMusic('warm', { fade: 2 });
    await g.fade(0, 2);
    g.ui.subtitle('Ноябрь. Первый снег. Прогулка возле пруда.', 4);
    await g.wait(2);
    const walkAround = g.walkTo(w, [7.5, 0, 6.5], { speed: 1.1 });
    await g.ui.say('Она', 'Снег… Смотри, пруд ещё не замёрз.');
    await walkAround;
    w.state = 'idle';
    await g.faceTo(w, V3(0, 0, 0));
    g.control(true);
    g.ui.objective('Подкрасться к ней сзади');
    g.ui.subtitle('F — сделать страшное лицо', 5);
    g.debugGoal = () => w.root.position.clone().add(V3(0, 0, 2.5));
    await g.until(() => input.pressed('face') && h.root.position.distanceTo(w.root.position) < 4);
    g.control(false);
    h.state = 'scary';
    h.setExpression('scary');
    audio.tone({ f: 120, f2: 80, dur: 0.6, type: 'sawtooth', vel: 0.06 });
    await g.faceTo(w, h.root.position, 0.25);
    w.setExpression('fear');
    w.state = 'fear';
    audio.gasp();
    await g.ui.say('Ты', STORY.pondPhrase, { auto: 2 });

    /* -------- the chase around the pond -------- */
    w.state = 'run';
    h.state = 'idle';
    audio.playMusic('theme', { fade: 0.5, intensity: 1 });
    g.control(true);
    g.ui.objective('Догони её! (Shift — бежать)');
    g.debugGoal = () => w.root.position;
    const R = 8.7;
    const angOf = (p) => Math.atan2(p.z, p.x / 1.3);
    let ang = angOf(w.root.position);
    let dir = 1;               // direction around the pond
    let dodges = 0, burst = 0, weave = 0, laughT = 0, stamina = 1, reverseCd = 0;
    const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
    let caught = false;
    await g.until(() => {
      const dt = g.dt;
      const hp = h.root.position;
      const d = hp.distanceTo(w.root.position);
      // the player's breath
      const running = input.isDown('run') && g.controlEnabled && h.state === 'run';
      stamina = running ? Math.max(0, stamina - dt * 0.16) : Math.min(1, stamina + dt * 0.2);
      if (stamina <= 0) g.noRun = true;
      if (g.noRun && stamina > 0.35) g.noRun = false;
      g.ui.meter('ДЫХАНИЕ', stamina);
      // she dodges when he gets close (three times), then she's laughing too hard to run
      const tired = dodges >= 3;
      if (!tired && d < 1.8 && burst <= 0) {
        dodges++; burst = 0.9; weave = (dodges % 2 ? 1.4 : -1.2);
        audio.laugh();
        g.ui.subtitle(['Она взвизгнула и увернулась.', 'Она смеётся и снова ускользает.', 'Она уже еле бежит от смеха.'][dodges - 1], 2.5);
      }
      burst -= dt;
      // if he cuts her off from the front, she turns back
      reverseCd -= dt;
      const ahead = wrap(angOf(hp) - ang) * dir;
      if (!tired && reverseCd <= 0 && ahead > 0 && ahead < 0.8 && d < 6) { dir = -dir; reverseCd = 2.5; audio.gasp(); }
      let speed = tired ? 1.5 : burst > 0 ? 5.0 : d < 7 ? 3.0 : 1.7;
      ang += dir * (speed / R) * dt;
      weave += (0 - weave) * Math.min(1, dt * 1.5);
      const r = R + weave;
      const nx = Math.cos(ang) * r * 1.3, nz = Math.sin(ang) * r;
      w.root.rotation.y = Math.atan2(nx - w.root.position.x, nz - w.root.position.z);
      w.root.position.set(nx, 0, nz);
      w.state = 'run';
      laughT += dt;
      w.setExpression(laughT > 2.5 ? 'joy' : 'fear');
      if (tired && Math.random() < dt * 1.2) audio.laugh();
      if (h.state === 'run' || h.state === 'walk') h.setExpression(laughT > 4 ? 'joy' : 'scary');
      if (d < 1.1 && tired) caught = true;
      return caught;
    });
    g.noRun = false;
    g.ui.meter(null);
    g.control(false);
    g.debugGoal = null;
    g.ui.objective(null);
    w.state = 'idle'; h.state = 'idle';
    await g.faceTo(w, h.root.position, 0.3);
    await g.faceTo(h, w.root.position, 0.3);
    w.setExpression('joy'); h.setExpression('smile');
    audio.laugh();
    await g.ui.say('Она', 'Ты меня так напугал!');
    await embrace(g, h, w);
    g.letterbox(true);
    const midP = h.root.position.clone().lerp(w.root.position, 0.5);
    const aP = Math.atan2(-midP.x, -midP.z); // start on the pond side
    g.camOrbit(midP, { r0: 2.0, r1: 3.4, h0: 1.5, h1: 2.4, a0: aP, a1: aP + 1.3, look: 1.4, dur: 7 }).catch(() => {});
    await g.wait(2.5);
    await think(g, 'Тогда эта фраза была просто шуткой.');
    g.letterbox(false);
    await endMemory(g, 'Воспоминание: «Пруд»');
  },
};
