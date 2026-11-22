// Chapter 2 — she finds him on social media, likes photos, writes first.
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import * as B from '../world/build.js';
import * as T from '../engine/textures.js';
import { STORY } from '../config/story.js';
import { spawnHero, think, chapterStart, endMemory, waitInteract, fourthWall, V3 } from './common.js';
import { dreamSegment } from './dream.js';

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

export default {
  num: 'ГЛАВА 2',
  title: 'Сообщение',
  async run(g) {
    await chapterStart(g, this);

    /* -------- nightmare interlude -------- */
    await dreamSegment(g, {
      layout: 'maze', theme: 'apartment', size: 4, seed: 11, reveal: 0.2, outfit: 'everyday',
      shards: [{ text: 'Красная шапка.' }, { text: 'Взгляд — и сразу в сторону.' }, { text: 'Тихий звук уведомления.' }],
      doorLabel: 'Войти в воспоминание',
      chaseFromStart: false,
      async intro(g) { await think(g, 'Снова этот сон. Коридоры, которых нет в моей квартире.'); },
      events: [
        { at: 35, run: async (g) => fourthWall(g, 'Автосохранение… ошибка: файл «она.sav» занят другим процессом') },
      ],
    });

    /* -------- memory: evening at home, the phone -------- */
    g.newScene({ bg: 0x0d0e12, fog: [0x0d0e12, 4, 14], hemi: [0x5a6080, 0x1a1510, 0.55], sun: [0x8090c0, 0.15, [3, 5, 2]] });
    B.room(g, { w: 5, d: 4.4, h: 2.6, floor: B.M({ map: T.woodTex([4, 4], '#5a4030') }), wall: B.M({ map: T.wallpaperTex([3, 1], '#6a6a5e', '#5a5a4e') }), ceil: B.M({ color: '#9a978c' }) });
    B.table(g, 1.4, -1.7, 1.3, 0.7, 0.75, { color: '#4a3a2a' });
    B.chair(g, 1.4, -1.05, Math.PI);
    B.box(g, 0.5, 0.32, 0.04, B.M({ color: '#9ab0d0', unlit: true }), 1.4, 0.82, -1.85);
    B.lamp(g, 0.9, 1.1, -1.8, 0xffc070, 1.2, 5);
    B.bed(g, -1.3, -0.9, 0, { color: '#4a5260' });
    B.shelf(g, -2.25, 1.2, Math.PI / 2, { w: 1.0, h: 1.6 });
    B.windowPane(g, 0, 1.5, -2.12, 1.2, 1.0, 0, { color: '#1a2238', emissive: 0x0a1020 });
    const phoneM = B.M({ color: '#111', emissive: 0x000000 });
    const phoneMesh = B.box(g, 0.08, 0.015, 0.15, phoneM, 1.0, 0.76, -1.6);
    const hero = spawnHero(g, 'everyday', [-0.2, 0, 1.2], Math.PI);
    g.followCamera({ dist: 2.3, height: 1.7, lookH: 1.3 });
    g.snapCamera();
    audio.ambience('room', true, 0.5);
    audio.playMusic('sparse', { fade: 3 });
    await g.fade(0, 2);
    g.control(true);
    await think(g, 'Прошло несколько дней. Я всё ещё вспоминал тот автобус.');
    g.interact({ pos: V3(0, 0, -1.9), radius: 1.2, label: 'Окно', onInteract: () => think(g, 'Где-то в этом городе она сейчас тоже смотрит в окно. Наверное.') });
    await g.wait(2.5);
    // buzz
    phoneM.emissive.set(0x2a3a5a);
    audio.buzz();
    g.ui.objective('Телефон завибрировал');
    const buzzT = g.onUpdate((dt, t) => { phoneMesh.position.y = 0.76 + (Math.sin(t * 60) > 0.6 ? 0.004 : 0); });
    await waitInteract(g, { pos: V3(1.1, 0, -1.3), radius: 1.2, label: 'Взять телефон' });
    buzzT();
    g.control(false);
    g.ui.objective(null);
    hero.state = 'phone';

    /* -------- phone UI -------- */
    const photos = ['Осень у реки', 'Кофе утром', 'Старый двор', 'Закат', 'Дорога'];
    const likes = new Set();
    let stage = 'notif'; // notif → profile → chat
    const chat = [];
    let replied = false;
    let newLikeT = 0;
    await g.ui.phone((scr, st) => {
      if (stage === 'notif') {
        scr.appendChild(el('div', 'ph-app', `${STORY.socialApp} · Уведомления`));
        const items = [...likes].map((i) => `♥ отметила вашу фотографию «${photos[i]}»`);
        if (!items.length) scr.appendChild(el('div', 'ph-typing', 'Новых уведомлений нет'));
        items.reverse().forEach((t, i) => {
          const it = el('div', 'ph-item' + (i === 0 && likes.size >= 3 ? ' sel' : ''));
          const av = el('span', 'ph-avatar'); it.appendChild(av);
          it.appendChild(document.createTextNode(t.replace('♥', '')));
          const sub = el('div', 'sub', 'профиль без имени · красная шапка на аватарке'); it.appendChild(sub);
          scr.appendChild(it);
        });
        if (likes.size >= 3) scr.appendChild(el('div', 'ph-typing', 'E — открыть профиль'));
      } else if (stage === 'profile') {
        scr.appendChild(el('div', 'ph-app', '← Профиль'));
        const head = el('div', 'ph-item'); head.appendChild(el('span', 'ph-avatar')); head.appendChild(document.createTextNode(' Профиль скрыт')); scr.appendChild(head);
        const ph = el('div', 'ph-photo', 'Фото: красная вязаная шапка, туман'); scr.appendChild(ph);
        scr.appendChild(el('div', 'ph-typing', chat.length ? 'Новое сообщение! E — открыть' : '…'));
      } else {
        scr.appendChild(el('div', 'ph-app', '← Сообщения'));
        for (const m of chat) scr.appendChild(el('div', 'ph-msg ' + m.dir, m.text));
        if (!replied && chat.length) {
          STORY.replies.forEach((r, i) => scr.appendChild(el('div', 'ph-item' + (i === st.sel ? ' sel' : ''), r)));
        }
        if (st.typing) scr.appendChild(el('div', 'ph-typing', 'печатает…'));
      }
    }, (st, dt) => {
      if (stage === 'notif') {
        newLikeT += dt;
        if (likes.size < 3 && newLikeT > (likes.size === 0 ? 0.6 : 1.6)) {
          newLikeT = 0; likes.add(likes.size); audio.ping(); st.dirty = true;
          if (likes.size === 3) g.ui.subtitle('Это… она?', 3);
        }
        if (likes.size >= 3 && input.pressed('act')) { stage = 'profile'; st.dirty = true; audio.blip(); st.t = 0; }
        return false;
      }
      if (stage === 'profile') {
        if (!chat.length && st.t > 2.0) { chat.push({ dir: 'in', text: STORY.firstMessage }); audio.ping(); st.dirty = true; g.ui.subtitle('Она написала первой.', 3); }
        if (chat.length && input.pressed('act')) { stage = 'chat'; st.dirty = true; st.sel = 0; audio.blip(); }
        if (input.pressed('back')) { stage = 'notif'; st.dirty = true; }
        return false;
      }
      // chat
      if (!replied) {
        if (input.pressed('up')) { st.sel = (st.sel + STORY.replies.length - 1) % STORY.replies.length; st.dirty = true; audio.blip(); }
        if (input.pressed('down')) { st.sel = (st.sel + 1) % STORY.replies.length; st.dirty = true; audio.blip(); }
        if (input.pressed('act')) { chat.push({ dir: 'out', text: STORY.replies[st.sel] }); replied = true; st.dirty = true; st.t = 0; audio.confirm(); }
        return false;
      }
      if (!st.typing && st.t > 0.8 && chat.length === 2) { st.typing = true; st.dirty = true; }
      if (st.typing && st.t > 3.2) { st.typing = false; chat.push({ dir: 'in', text: STORY.secondMessage }); audio.ping(); st.dirty = true; }
      if (chat.length >= 3 && st.t > 5.5) return 'done';
      return false;
    }, { clock: '22:14' });

    hero.state = 'idle';
    hero.setExpression('smile');
    g.camSet([0.2, 1.6, -0.2], [-0.2, 1.4, 1.2]);
    await think(g, 'Так всё и началось — с короткого сообщения от неё.');
    await endMemory(g, 'Воспоминание: «Сообщение»');
  },
};
