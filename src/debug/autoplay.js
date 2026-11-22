// Debug autopilot (open with ?autoplay). Plays through the game so every
// chapter can be verified end-to-end in a headless browser. Not used in normal play.
import * as THREE from 'three';
import { input } from '../engine/input.js';

export function startAutoplay(g) {
  window.__autoplay = true;
  g.timeScale = 2;
  let t = 0, held = null, rock = 0;
  const tap = (code) => { input.simulate(code, true); setTimeout(() => input.simulate(code, false), 40); };
  const $ = (s) => document.querySelector(s);
  const visible = (s) => { const e = $(s); return e && !e.classList.contains('hidden'); };
  window.__autolog = [];
  setInterval(() => {
    t += 0.15;
    if (g.paused) return;
    const meter = visible('#meter') ? $('#meter .label').textContent : '';
    // breathing: hold Q
    if (/ВДОХ|ОТПУСТИ|ВЫДОХ/.test(meter)) {
      if (meter === 'ВДОХ' && held !== 'KeyQ') { input.simulate('KeyQ', true); held = 'KeyQ'; }
      if (meter !== 'ВДОХ' && held === 'KeyQ') { input.simulate('KeyQ', false); held = null; }
      return;
    }
    if (/МАЛЫШ/.test(meter)) { rock += 0.15; if (rock > 0.7) { rock = 0; tap(Math.random() < 2 && (t * 10 | 0) % 2 ? 'ArrowLeft' : 'ArrowRight'); } return; }
    // choices: wrap to the last option
    if (visible('#dialogue') && $('#dialogue .choices').children.length) { tap('ArrowUp'); setTimeout(() => tap('Space'), 80); return; }
    if (visible('#dialogue')) { tap('Space'); return; }
    if (visible('#phone')) { tap('KeyE'); return; }
    const prompt = visible('#prompt') ? $('#prompt').textContent : '';
    if (/^W/.test(prompt)) { tap('ArrowUp'); return; }
    const obj = visible('#objective') ? $('#objective').textContent : '';
    if (/печатать/.test(obj)) { tap('KeyE'); return; }
    if (/Подкрасться/.test(obj)) tap('KeyF');
    const p = g.player;
    if (!p || !g.controlEnabled || g.busy) { if (prompt.startsWith('E')) tap('KeyE'); return; }
    let goal = typeof g.debugGoal === 'function' ? g.debugGoal() : g.debugGoal;
    let target = null;
    if (!goal) {
      let best = null, bd = 1e9;
      const live = g.interactables.filter((it) => it.enabled);
      const pool = live.some((it) => it.once) ? live.filter((it) => it.once) : live;
      for (const it of pool) {
        const pos = typeof it.pos === 'function' ? it.pos() : it.pos;
        const d = p.root.position.distanceTo(new THREE.Vector3(pos.x, 0, pos.z));
        if (d < bd) { bd = d; best = pos; }
      }
      if (best) { target = best; goal = best; }
    }
    if (goal) {
      const pos = p.root.position;
      const dir = new THREE.Vector3(goal.x - pos.x, 0, goal.z - pos.z);
      const d = dir.length();
      if (d > 0.6) { const step = Math.min(d - 0.5, 0.9); pos.addScaledVector(dir.normalize(), step); }
      if (target) p.root.rotation.y = Math.atan2(target.x - pos.x, target.z - pos.z);
      if (g.bounds) g.bounds(pos);
      if (target && d < 1.2) tap('KeyE');
    }
  }, 150);
  window.addEventListener('error', (e) => window.__autolog.push('ERR ' + e.message));
}
