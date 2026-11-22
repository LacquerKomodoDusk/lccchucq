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

    /* -------- the pond -------- */
    pondPark(g);
    const h = spawnHero(g, 'everyday', [0, 0, 10], Math.PI);
    const w = spawnWife(g, 'summer', [1.5, 0, 8.6], Math.PI);
    g.followCamera({ dist: 3.4, height: 2.0, lookH: 1.3 });
    g.snapCamera();
    audio.ambience('birds', true, 0.6);
    audio.playMusic('warm', { fade: 2 });
    await g.fade(0, 2);
    g.ui.subtitle('Прогулка возле пруда.', 3);
    await g.wait(2);
    // she walks along the path ahead
    const walkAround = g.walkTo(w, [7.5, 0, 6.5], { speed: 1.1 });
    await g.ui.say('Она', 'Смотри, утки. Сколько их тут…');
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
    // she runs around the pond, he chases (player controlled)
    w.state = 'run';
    w.setExpression('fear');
    h.state = 'idle';
    g.control(true);
    g.ui.objective('Догони её!');
    g.debugGoal = () => w.root.position;
    let ang = Math.atan2(w.root.position.z, w.root.position.x / 1.3);
    let caught = false;
    let laughT = 0;
    const R = 8.7;
    await g.until(() => {
      const dt = g.dt;
      const d = h.root.position.distanceTo(w.root.position);
      // she runs away along the path ring; slows down as she starts laughing
      const flee = d < 6 ? 2.6 : 1.4;
      ang += (flee / R) * dt;
      const nx = Math.cos(ang) * R * 1.3, nz = Math.sin(ang) * R;
      w.root.rotation.y = Math.atan2(nx - w.root.position.x, nz - w.root.position.z);
      w.root.position.set(nx, 0, nz);
      w.state = 'run';
      laughT += dt;
      if (laughT > 3) { w.setExpression('joy'); }
      if (laughT > 3 && Math.random() < dt * 0.9) audio.laugh();
      if (h.state === 'run' || h.state === 'walk') h.setExpression(laughT > 4 ? 'joy' : 'scary');
      if (d < 1.1) caught = true;
      return caught;
    });
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
    await think(g, 'Тогда эта фраза была просто шуткой.');
    await endMemory(g, 'Воспоминание: «Пруд»');
  },
};
