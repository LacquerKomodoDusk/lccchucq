// Chapter 7 — the second child. Joy and fear; old grievances; heart-to-heart
// talks after quarrels; temporary truces; talk of separating — and hope.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import * as B from '../world/build.js';
import { apartment, hospital } from '../world/places.js';
import { CHILDREN } from '../config/family.js';
import { spawnHero, spawnWife, think, chapterStart, endMemory, waitInteract, waitReach, V3, setWorldMood, glitchBurst, embrace, shout, breakDish } from './common.js';

const WALL_WORDS = ['опять', 'ты никогда', 'я устала', 'а я?', 'не начинай', 'как всегда', 'ты не слышишь'];

export default {
  num: 'ГЛАВА 7',
  title: 'Второй',
  async run(g) {
    await chapterStart(g, this);

    /* -------- the second son -------- */
    hospital(g);
    const hero = spawnHero(g, 'everyday', [0, 0, -4], 0);
    const her = spawnWife(g, 'home', [4.4, 0, 0.2], -Math.PI / 2);
    her.setBaby(true); her.state = 'hold';
    // the older son, still small here (he is around two years old in this memory)
    const son = g.spawn({ ...CHILDREN[0], height: 0.85, backpack: null, headScale: 1.4 }, [3.4, 0, 0.6], -Math.PI / 2);
    g.followCamera({ dist: 2.6, height: 1.9, lookH: 1.4 });
    g.snapCamera();
    audio.ambience('hum', true, 0.4);
    audio.playMusic('theme', { fade: 3 });
    await g.fade(0, 1.5);
    g.ui.subtitle('Примерно через два года.', 3.5);
    g.control(true);
    g.ui.objective('Палата');
    await waitInteract(g, { pos: V3(4.0, 0, 0.0), radius: 1.5, label: 'Подойти к ним', facing: false });
    g.control(false);
    g.ui.objective(null);
    await g.faceTo(hero, her.root.position);
    her.setExpression('smile');
    son.lookYaw = 0.6;
    g.camera.fov = 40; g.camera.updateProjectionMatrix();
    g.camSet([2.4, 1.6, 1.4], [4.0, 1.1, 0.3]);
    await think(g, 'Второй. Радость. Волнение. И снова страх — справимся ли.');
    hero.state = 'joy'; hero.setExpression('joy');
    await g.wait(1.5);
    hero.state = 'idle'; hero.setExpression('smile');
    g.camera.fov = 60; g.camera.updateProjectionMatrix();
    await g.fade(1, 1.5);

    /* -------- kitchen nights -------- */
    const A = apartment(g, { night: true, kidsToys: true, cold: true });
    void A;
    setWorldMood(g, { sat: 0.45, tint: [0.9, 0.95, 1.1] });
    const h2 = spawnHero(g, 'tired', [-1, 0, 1.5], 0);
    const w2 = spawnWife(g, 'home', [2.4, 0, -1.3], 0);
    w2.state = 'sit'; w2.setExpression('sad');
    g.followCamera({ dist: 2.8, height: 1.9, lookH: 1.3 });
    g.snapCamera();
    audio.playMusic('sparse', { fade: 2 });
    // words of old quarrels appear on the walls
    const words = [];
    const spawnWords = () => {
      for (let i = 0; i < WALL_WORDS.length; i++) {
        const side = i % 3;
        const pos = side === 0 ? [-3.5 + i * 0.9, 1.2 + (i % 2) * 0.7, -2.9] : side === 1 ? [-3.9, 1.0 + (i % 2) * 0.8, -1.5 + i * 0.5] : [-2.5 + i * 0.5, 1.6, 2.9];
        const rot = side === 0 ? 0 : side === 1 ? Math.PI / 2 : Math.PI;
        words.push(B.inscription(g, WALL_WORDS[i], pos[0], pos[1], pos[2], rot, { color: '#b8b0a0', w: 1.8, h: 0.45 }));
      }
    };
    const clearWords = async () => {
      await g.tween(1.5, (k) => words.forEach((w) => { w.material.opacity = 1 - k; }));
      words.forEach((w) => g.scene.remove(w)); words.length = 0;
    };
    await g.fade(0, 1.5);
    g.ui.subtitle('Вторая беременность прошла на фоне старых обид.', 4);
    spawnWords();
    audio.whisper(2.5, 0.12);
    await g.wait(2);

    for (let round = 0; round < 2; round++) {
      g.control(true);
      g.ui.objective('Сесть напротив неё');
      await waitReach(g, V3(2.4, 0, 0.3), 0.9);
      g.control(false);
      g.ui.objective(null);
      h2.root.position.set(2.4, 0, 0.12); h2.root.rotation.y = Math.PI; h2.state = 'sit';
      g.camSet([3.6, 1.6, -0.5], [2.4, 1.0, -0.6]);
      if (round === 0) {
        await g.ui.say('Она', 'Мне кажется, мы всё время воюем. Из-за мелочей.');
        let listened = false;
        while (!listened) {
          const c = await g.ui.choose(null, 'Она говорит. Долго, сбивчиво.', ['Перебить и объяснить, что она не права', 'Выслушать до конца']);
          if (c === 1) listened = true;
          else { await glitchBurst(g, 0.4, 0.3); await g.ui.say('Она', 'Вот. Опять. Ты даже не дослушал.'); }
        }
        await g.ui.talk([
          ['Ты', 'Я слышу. Мне тоже тяжело. Я не хочу так.'],
          ['Она', 'Я тоже не хочу.'],
        ]);
        w2.setExpression('smile');
        setWorldMood(g, { sat: 0.95, tint: [1.08, 1.0, 0.9] });
        audio.playMusic('warm', { fade: 2 });
        await clearWords();
        await think(g, 'Разговоры по душам. После них становилось легче.');
        await think(g, 'Но часто это было только перемирие.');
        await g.fade(1, 1.2);
        // time passes; things go cold again
        w2.setExpression('sad');
        h2.state = 'tired'; h2.root.position.set(-1, 0, 1.5); h2.root.rotation.y = 0;
        setWorldMood(g, { sat: 0.35, tint: [0.88, 0.94, 1.12] });
        audio.playMusic('sparse', { fade: 2 });
        spawnWords();
        g.followCamera({ dist: 2.8, height: 1.9, lookH: 1.3 });
        g.snapCamera();
        await g.fade(0, 1.2);
        g.ui.subtitle('Обиды возвращались.', 3);
        await g.wait(1.0);
        // the old quarrel, again — this time it is him who breaks
        g.control(false);
        h2.root.position.set(1.0, 0, 0.5); w2.state = 'idle'; w2.root.position.set(1.4, 0, -1.6);
        await Promise.all([g.faceTo(h2, w2.root.position, 0.2), g.faceTo(w2, h2.root.position, 0.2)]);
        g.letterbox(true); g.handheld = 1;
        g.camera.fov = 44; g.camera.updateProjectionMatrix();
        g.camSet([-0.6, 1.4, -0.4], [1.2, 1.45, -0.5]);
        audio.playMusic('anxiety', { fade: 1 });
        await shout(g, 'Она', w2, 'Мы же договаривались! Опять всё как всегда!', 'f', { anger: 0.8 });
        g.camSet([2.6, 1.55, -0.9], [1.0, 1.5, 0.5]);
        await shout(g, 'Ты', h2, 'Да что бы я ни делал — всё не так!', 'm', { anger: 0.9 });
        g.camSet([0.0, 1.6, 1.6], [1.4, 1.45, -1.6]);
        await shout(g, 'Она', w2, 'Потому что ты не слышишь!', 'f', { anger: 1 });
        h2.state = 'attack';
        g.camSet([0.2, 0.5, -0.5], [1.4, 0.2, 0.2]);
        await breakDish(g, V3(1.6, 0.85, 0.2), V3(1.5, 0, -0.1), { kind: 'cup', dur: 0.35 });
        audio.stopMusic(0.2);
        h2.state = 'idle'; h2.setExpression('sad'); w2.setExpression('cry');
        await g.wait(1.8);
        await think(g, 'Я не хотел. Я просто не знал, куда деть всё это.');
        g.handheld = 0; g.letterbox(false);
        g.camera.fov = 60; g.camera.updateProjectionMatrix();
        w2.root.position.set(2.4, 0, -1.3); w2.root.rotation.y = 0; w2.state = 'sit'; w2.setExpression('sad');
        h2.state = 'tired'; h2.root.position.set(-1, 0, 1.5);
        audio.playMusic('sparse', { fade: 2 });
        g.followCamera({ dist: 2.8, height: 1.9, lookH: 1.3 });
        g.snapCamera();
        await g.wait(0.5);
      } else {
        await g.ui.say('Она', 'Может… нам стоит пожить отдельно?');
        audio.heartbeat();
        await glitchBurst(g, 0.6, 0.4);
        await g.ui.choose(null, '…', ['Я не хочу расставаться.', 'Может быть. Я не знаю.']);
        await g.ui.talk([
          ['Она', 'Я тоже не знаю, как правильно.'],
          ['Ты', 'Давай попробуем ещё раз. Ради нас. Ради них.'],
        ]);
        await clearWords();
        setWorldMood(g, { sat: 0.7, tint: [1.0, 0.98, 0.96] });
        await think(g, 'Мы говорили о расставании. И продолжали жить вместе.');
        await think(g, 'Надежда всё-таки оставалась.');
      }
    }
    h2.state = 'idle';
    h2.root.position.set(0.9, 0, 0.7);
    w2.state = 'idle';
    w2.root.position.set(1.7, 0, 0.7);
    await embrace(g, h2, w2);
    g.camSet([0.2, 1.9, 2.4], [1.3, 1.2, 0.7]);
    await g.wait(2.5);
    await endMemory(g, 'Воспоминание: «Перемирие»');
  },
};
