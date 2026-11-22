import * as THREE from 'three';
import { Game, Abort } from './engine/game.js';
import { input } from './engine/input.js';
import { audio } from './engine/audio.js';
import { CHAPTERS } from './chapters/index.js';
import * as B from './world/build.js';
import * as T from './engine/textures.js';
import { showViewer } from './viewer.js';
import { startAutoplay } from './debug/autoplay.js';

const canvas = document.getElementById('screen');
const game = new Game(canvas);
window.__game = game; // debug / automated tests
window.__input = input;

const $ = (s) => document.querySelector(s);
let menu = null; // { el, items, sel, onBack }
let running = false;

/* ------------------------------------------------------------------ menus */

function openMenu(el, items, onBack = null) {
  menu = { el, items, sel: items.findIndex((i) => !i.locked), onBack };
  if (menu.sel < 0) menu.sel = 0;
  el.classList.remove('hidden');
  renderMenu();
}
function closeMenu() { if (menu) menu.el.classList.add('hidden'); menu = null; }
function renderMenu() {
  const ul = menu.el.querySelector('.menu-list');
  if (!ul) return;
  ul.innerHTML = '';
  menu.items.forEach((it, i) => {
    const li = document.createElement('li');
    li.textContent = typeof it.label === 'function' ? it.label() : it.label;
    if (it.locked) li.classList.add('locked');
    if (i === menu.sel) li.classList.add('sel');
    li.addEventListener('mouseenter', () => { if (!it.locked) { menu.sel = i; renderMenu(); } });
    li.addEventListener('click', () => { if (!it.locked) { audio.confirm(); it.action(); } });
    ul.appendChild(li);
  });
}
function menuInput() {
  if (!menu) return;
  const n = menu.items.length;
  const move = (d) => {
    let s = menu.sel;
    for (let k = 0; k < n; k++) { s = (s + d + n) % n; if (!menu.items[s].locked) break; }
    menu.sel = s; audio.blip(); renderMenu();
  };
  if (input.rawPressed('up')) move(-1);
  if (input.rawPressed('down')) move(1);
  const it = menu.items[menu.sel];
  if (input.rawPressed('left') && it && it.left) { it.left(); renderMenu(); }
  if (input.rawPressed('right') && it && it.right) { it.right(); renderMenu(); }
  if (input.rawPressed('act') && it && !it.locked) { audio.confirm(); it.action(); }
  else if (input.rawPressed('back') && menu && menu.onBack) { audio.blip(); menu.onBack(); }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
}

function settingsItems() {
  const s = game.save.settings;
  const pct = (v) => `${Math.round(v * 10)}`.padStart(2, ' ');
  return [
    { label: () => `Эффект ЭЛТ: ${s.crt ? 'ВКЛ' : 'ВЫКЛ'}`, action() { s.crt = !s.crt; game.applySettings(); game.writeSave(); renderMenu(); } },
    { label: () => `Музыка: ◀ ${pct(s.music)} ▶`, action() {}, left() { s.music = Math.max(0, +(s.music - 0.1).toFixed(1)); game.applySettings(); game.writeSave(); }, right() { s.music = Math.min(1, +(s.music + 0.1).toFixed(1)); game.applySettings(); game.writeSave(); } },
    { label: () => `Звуки: ◀ ${pct(s.sfx)} ▶`, action() {}, left() { s.sfx = Math.max(0, +(s.sfx - 0.1).toFixed(1)); game.applySettings(); game.writeSave(); }, right() { s.sfx = Math.min(1, +(s.sfx + 0.1).toFixed(1)); game.applySettings(); game.writeSave(); } },
    { label: () => `Мышь: ◀ ${pct(s.mouse ?? 1)} ▶`, action() {}, left() { s.mouse = Math.max(0.2, +((s.mouse ?? 1) - 0.1).toFixed(1)); input.mouse.sens = s.mouse; game.writeSave(); }, right() { s.mouse = Math.min(3, +((s.mouse ?? 1) + 0.1).toFixed(1)); input.mouse.sens = s.mouse; game.writeSave(); } },
    { label: 'Полный экран', action: toggleFullscreen },
  ];
}

function showHelp(back) {
  closeMenu();
  const el = $('#help-screen');
  el.classList.remove('hidden');
  menu = { el, items: [{ label: '', action: () => { el.classList.add('hidden'); menu = null; back(); } }], sel: 0, onBack: () => { el.classList.add('hidden'); menu = null; back(); } };
}

/* ------------------------------------------------------------------ title */

function titleScene() {
  game.abortAll();
  game.newScene({ bg: 0x1a1c20, fog: [0x1a1c20, 3, 30], hemi: [0x7a8090, 0x202020, 0.8], sun: [0xbfc8d8, 0.3, [2, 6, -3]] });
  B.plane(game, 8, 200, B.M({ map: T.asphaltTex([4, 100], true) }), 0, 0, -60);
  B.plane(game, 0.25, 200, B.M({ map: T.roadLineTex([1, 60]), unlit: true }), 0, 0.01, -60);
  B.plane(game, 60, 200, B.M({ map: T.grassTex([20, 60], '#3a4232') }), 0, -0.02, -60);
  for (let i = 0; i < 14; i++) { B.lampPost(game, 4.6, -i * 12, { on: i % 3 !== 2, solid: false }); B.bareTree(game, -6 - Math.random() * 6, -i * 9 - 3, { solid: false, h: 4 + Math.random() * 3 }); }
  B.rain(game, { center: new THREE.Vector3(0, 0, -6) }).follow.target = new THREE.Vector3(0, 0, -6);
  game.camSet([0.8, 1.5, 6], [0, 1.4, -20]);
  let t = 0;
  game.onUpdate((dt) => { t += dt; game.camera.position.set(0.8 + Math.sin(t * 0.1) * 0.3, 1.5 + Math.sin(t * 0.17) * 0.05, 6 - t * 0.25); game.camera.lookAt(0, 1.4, game.camera.position.z - 26); });
  audio.stopAllAmbience();
  audio.ambience('rain', true, 0.6);
  audio.playMusic('theme', { fade: 3 });
  document.title = 'ВОПРЕКИ';
  game.fade(0, 2).catch(() => {});
}

function showTitle() {
  running = false;
  input.releaseLock();
  game.paused = false;
  game.ui.clearAll();
  titleScene();
  const sv = game.save;
  const items = [];
  if (sv.current > 0 || sv.unlocked > 0) items.push({ label: 'Продолжить', action: () => start(sv.current) });
  items.push({ label: 'Новая игра', action: () => start(0) });
  items.push({ label: 'Главы', action: chapterSelect });
  items.push({ label: 'Настройки', action: () => { closeMenu(); openMenu($('#pause-screen'), [...settingsItems(), { label: 'Назад', action: showTitleMenuOnly }], showTitleMenuOnly); $('#pause-screen .menu-head').textContent = 'НАСТРОЙКИ'; } });
  items.push({ label: 'Управление', action: () => showHelp(showTitleMenuOnly) });
  showTitleMenuOnly.items = items;
  showTitleMenuOnly();
}
function showTitleMenuOnly() {
  closeMenu();
  $('#pause-screen').classList.add('hidden');
  openMenu($('#title-screen'), showTitleMenuOnly.items);
}

function chapterSelect() {
  closeMenu();
  const items = CHAPTERS.map((c, i) => ({
    label: i <= game.save.unlocked ? `${c.num} — ${c.title}` : `${c.num} — ???`,
    locked: i > game.save.unlocked,
    action: () => start(i),
  }));
  items.push({ label: 'Назад', action: showTitleMenuOnly });
  openMenu($('#title-screen'), items, showTitleMenuOnly);
}

/* ------------------------------------------------------------------ pause */

function pause() {
  if (!running || menu) return;
  input.releaseLock();
  game.paused = true;
  input.setFrozen(true);
  $('#pause-screen .menu-head').textContent = 'ПАУЗА';
  const items = [{ label: 'Продолжить', action: resume }];
  if (game.pauseExtra) items.push({ label: game.pauseExtra.label, action: () => { resume(); game.pauseExtra.action(); } });
  items.push(...settingsItems());
  items.push({ label: 'Управление', action: () => showHelp(pauseMenuBack) });
  items.push({ label: 'Выйти в главное меню', action: () => { resume(); game.abortAll(); audio.stopMusic(1); audio.stopAllAmbience(); showTitle(); } });
  pauseMenuBack.items = items;
  openMenu($('#pause-screen'), items, resume);
}
function pauseMenuBack() { openMenu($('#pause-screen'), pauseMenuBack.items, resume); }
function resume() { closeMenu(); game.paused = false; input.setFrozen(false); input.requestLock(canvas); }

/* ------------------------------------------------------------------ run */

async function start(index) {
  input.requestLock(canvas); // must happen inside the click / key gesture
  closeMenu();
  $('#title-screen').classList.add('hidden');
  running = true;
  input.setFrozen(false);
  await game.fade(1, 1.2).catch(() => {});
  game.abortAll();
  audio.stopMusic(1);
  audio.stopAllAmbience();
  game.ui.clearAll();
  const session = game.session;
  if (!input.mouse.locked) game.ui.toast('Кликните по экрану — камера управляется мышью', { dur: 6 });
  try {
    for (let i = index; i < CHAPTERS.length; i++) {
      game.save.current = i;
      game.save.unlocked = Math.max(game.save.unlocked, i);
      game.writeSave();
      game.chapterIndex = i;
      await CHAPTERS[i].run(game);
      game.ui.clearAll();
      if (game.session !== session) return;
    }
    game.save.finished = true;
    game.save.current = 0;
    game.writeSave();
    await credits();
    showTitle();
  } catch (e) {
    if (e instanceof Abort) return;
    console.error(e);
    game.ui.toast('Ошибка: ' + e.message, { dur: 8 });
  }
}

async function credits() {
  game.newScene({ bg: 0x000000, fog: null, sun: null });
  game.camSet([0, 0, 5], [0, 0, 0]);
  game.setFade(1);
  const lines = [
    'ВОПРЕКИ',
    'Посвящается моей жене\nи нашим сыновьям.',
    'История — реальная.\nМир — из снов и воспоминаний.',
    'Мы не обязаны побеждать друг друга.',
    'Иногда нужно просто перестать бороться\nи продолжить идти вместе.',
  ];
  for (const l of lines) {
    game.ui.caption(l);
    await game.wait(4.5);
    game.ui.hideCaption();
    await game.wait(1.6);
  }
  game.ui.clearAll();
}

/* ------------------------------------------------------------------ boot */

game.onFrame = () => {
  if (menu) menuInput();
  else if (running && input.rawPressed('pause') && !game.noPause) pause();
};

// mouse camera: click the game to capture the cursor, Esc releases it (and pauses)
canvas.addEventListener('click', () => { if (running && !menu && !game.paused) input.requestLock(canvas); });
input.mouse.onLockChange = (locked) => { if (!locked && running && !menu && !game.paused) pause(); };
input.mouse.sens = game.save.settings.mouse ?? 1;

const gate = $('#start-gate');
function openGate() {
  if (!gate || gate.classList.contains('hidden')) return;
  audio.unlock();
  game.applySettings();
  gate.classList.add('hidden');
  input.endFrame();
  const params = new URLSearchParams(location.search);
  if (params.has('viewer')) { showViewer(game); return; }
  if (params.has('autoplay')) startAutoplay(game);
  if (params.has('chapter')) {
    const i = Math.max(0, Math.min(CHAPTERS.length - 1, parseInt(params.get('chapter'), 10) || 0));
    game.save.unlocked = Math.max(game.save.unlocked, i);
    start(i);
  } else showTitle();
}
input.onAny(() => { if (!gate.classList.contains('hidden')) setTimeout(openGate, 0); });
gate.addEventListener('click', openGate);
window.__start = start;
