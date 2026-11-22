// DOM overlay: dialogue, prompts, toasts, chapter cards, phone, captions.
import { input } from '../engine/input.js';
import { audio } from '../engine/audio.js';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      card: $('#chapter-card'), prompt: $('#prompt'), objective: $('#objective'), toast: $('#toast'),
      subtitle: $('#subtitle'), dialogue: $('#dialogue'), caption: $('#caption'), meter: $('#meter'),
      battle: $('#battle-hud'), phone: $('#phone'), fade: $('#fade'), crash: $('#fakecrash'),
    };
    this.dlg = null;
    this.toastTimer = 0;
    this.subTimer = 0;
  }

  /* ---------------------------------------------------------- dialogue */

  /** speaker: string|null. opts: {thought, auto (seconds), speed} */
  say(speaker, text, opts = {}) {
    const g = this.game;
    const d = this.el.dialogue;
    d.classList.remove('hidden');
    d.querySelector('.speaker').textContent = speaker || '';
    const tx = d.querySelector('.text');
    tx.classList.toggle('thought', !!opts.thought);
    tx.textContent = '';
    d.querySelector('.choices').innerHTML = '';
    d.querySelector('.next').style.visibility = 'hidden';
    const state = { shown: 0, full: text, done: false, t: 0, auto: opts.auto ?? null, speed: opts.speed ?? 40, closed: false };
    this.dlg = state;
    let lastBlip = 0;
    return g.until(() => {
      const dt = g.dt;
      if (!state.done) {
        state.t += dt;
        const n = Math.min(text.length, Math.floor(state.t * state.speed));
        if (n !== state.shown) {
          state.shown = n; tx.textContent = text.slice(0, n);
          if (g.time - lastBlip > 0.06 && text[n - 1] !== ' ') { lastBlip = g.time; if (!opts.silent) audio.tone({ f: speaker ? 520 : 300, dur: 0.025, vel: 0.015, type: 'square', wet: 0 }); }
        }
        if (n >= text.length) { state.done = true; state.t = 0; d.querySelector('.next').style.visibility = state.auto ? 'hidden' : 'visible'; }
        else if (input.pressed('act')) { state.shown = text.length; tx.textContent = text; state.done = true; state.t = 0; d.querySelector('.next').style.visibility = state.auto ? 'hidden' : 'visible'; return false; }
        return false;
      }
      state.t += dt;
      if ((state.auto && state.t > state.auto) || (!state.auto && input.pressed('act'))) {
        d.classList.add('hidden'); this.dlg = null; g.actConsumed = true; return true;
      }
      return false;
    }, () => { d.classList.add('hidden'); this.dlg = null; });
  }

  /** sequence of [speaker, text, opts?] */
  async talk(lines) {
    for (const l of lines) await this.say(l[0], l[1], l[2] || {});
  }

  choose(speaker, text, options) {
    const g = this.game;
    const d = this.el.dialogue;
    d.classList.remove('hidden');
    d.querySelector('.speaker').textContent = speaker || '';
    const tx = d.querySelector('.text');
    tx.classList.toggle('thought', !speaker);
    tx.textContent = text;
    d.querySelector('.next').style.visibility = 'hidden';
    const box = d.querySelector('.choices');
    box.innerHTML = '';
    let sel = 0;
    const items = options.map((o, i) => {
      const div = document.createElement('div'); div.textContent = o; box.appendChild(div);
      div.addEventListener('mouseenter', () => { sel = i; render(); });
      div.addEventListener('click', () => { clicked = true; });
      return div;
    });
    let clicked = false;
    const render = () => items.forEach((it, i) => it.classList.toggle('sel', i === sel));
    render();
    let armed = false;
    return g.until(() => {
      if (!armed) { armed = true; return false; }
      if (input.pressed('up')) { sel = (sel + items.length - 1) % items.length; render(); audio.blip(); }
      if (input.pressed('down')) { sel = (sel + 1) % items.length; render(); audio.blip(); }
      if (input.pressed('act') || clicked) { audio.confirm(); g.actConsumed = true; d.classList.add('hidden'); box.innerHTML = ''; return { value: sel }; }
      return false;
    }, () => { d.classList.add('hidden'); box.innerHTML = ''; }).then((r) => r.value);
  }

  /* ---------------------------------------------------------- misc overlays */

  prompt(text) {
    const p = this.el.prompt;
    if (!text) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    if (p.textContent !== text) p.textContent = text;
  }
  objective(text) {
    const o = this.el.objective;
    if (!text) { o.classList.add('hidden'); return; }
    o.classList.remove('hidden'); o.textContent = text;
  }
  toast(text, { glitch = false, dur = 4 } = {}) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.remove('hidden');
    t.classList.toggle('glitch', glitch);
    this.toastTimer = dur;
    if (glitch) audio.glitch(0.15); else audio.blip();
  }
  subtitle(text, dur = 4) {
    const s = this.el.subtitle;
    if (!text) { s.classList.add('hidden'); return; }
    s.textContent = text; s.classList.remove('hidden');
    this.subTimer = dur;
  }
  chapterCard(num, title) {
    const c = this.el.card;
    c.querySelector('.chap-num').textContent = num;
    c.querySelector('.chap-title').textContent = title;
    c.classList.remove('hidden');
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    return this.game.wait(4.5).then(() => c.classList.add('hidden'));
  }
  caption(text) {
    const c = this.el.caption;
    if (text == null) { c.style.opacity = 0; return; }
    c.textContent = text; c.classList.remove('hidden'); c.style.opacity = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.opacity = 1; }));
  }
  hideCaption() { const c = this.el.caption; c.style.opacity = 0; }
  meter(label, v) {
    const m = this.el.meter;
    if (label == null) { m.classList.add('hidden'); return; }
    m.classList.remove('hidden');
    m.querySelector('.label').textContent = label;
    m.querySelector('.fill').style.width = `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  }
  battle(show, l = 1, r = 1, names = null) {
    const b = this.el.battle;
    b.classList.toggle('hidden', !show);
    if (!show) return;
    b.querySelector('.left .fill').style.transform = `scaleX(${Math.max(0, l)})`;
    b.querySelector('.right .fill').style.transform = `scaleX(${Math.max(0, r)})`;
    if (names) { b.querySelector('.left .name').textContent = names[0]; b.querySelector('.right .name').textContent = names[1]; }
  }

  update(dt) {
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.classList.add('hidden'); }
    if (this.subTimer > 0) { this.subTimer -= dt; if (this.subTimer <= 0) this.el.subtitle.classList.add('hidden'); }
  }

  clearAll() {
    for (const k of ['card', 'prompt', 'objective', 'toast', 'subtitle', 'dialogue', 'meter', 'battle', 'phone', 'crash']) this.el[k].classList.add('hidden');
    this.el.caption.classList.add('hidden'); this.el.caption.style.opacity = 0;
    this.dlg = null;
  }

  /* ---------------------------------------------------------- phone */

  /**
   * Generic phone screen runner.
   * render(screenEl, state) draws content; handle(state) returns true when finished.
   */
  phone(render, handle, { clock = '22:14' } = {}) {
    const g = this.game;
    const ph = this.el.phone;
    ph.classList.remove('hidden');
    ph.querySelector('.clock').textContent = clock;
    const scr = ph.querySelector('.phone-screen');
    const st = { sel: 0, t: 0, view: 'home', dirty: true };
    return g.until(() => {
      st.t += g.dt;
      const r = handle(st, g.dt);
      if (st.dirty) { scr.innerHTML = ''; render(scr, st); st.dirty = false; }
      if (r) { ph.classList.add('hidden'); return { value: r }; }
      return false;
    }, () => ph.classList.add('hidden')).then((x) => x.value);
  }

  fakeCrash(show) { this.el.crash.classList.toggle('hidden', !show); }
}
