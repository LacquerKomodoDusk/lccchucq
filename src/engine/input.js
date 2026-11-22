// Keyboard input with edge detection.
const down = new Set();
const pressedQ = new Set();
const releasedQ = new Set();
let anyCb = null;

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

window.addEventListener('keydown', (e) => {
  if (PREVENT.has(e.code)) e.preventDefault();
  if (!down.has(e.code)) pressedQ.add(e.code);
  down.add(e.code);
  if (anyCb) anyCb(e);
});
window.addEventListener('keyup', (e) => { down.delete(e.code); releasedQ.add(e.code); });
window.addEventListener('blur', () => down.clear());

const GROUPS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  act: ['KeyE', 'Space', 'Enter', 'NumpadEnter'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape', 'KeyP'],
  attack: ['KeyJ', 'Mouse0'],
  block: ['KeyK', 'Mouse2'],
  breathe: ['KeyQ'],
  face: ['KeyF'],
};

let frozen = false;

/* ---------------- mouse (camera) ---------------- */
const mouse = { dx: 0, dy: 0, accDx: 0, accDy: 0, dragging: false, locked: false, sens: 1 };
window.addEventListener('mousemove', (e) => {
  if (mouse.locked || mouse.dragging) { mouse.accDx += e.movementX || 0; mouse.accDy += e.movementY || 0; }
});
window.addEventListener('mousedown', (e) => {
  if (!mouse.locked && e.button === 0 && e.target && e.target.id === 'screen') mouse.dragging = true;
  // mouse buttons count as keys too (LMB = Mouse0, RMB = Mouse2) when playing on the game screen
  if (mouse.locked || (e.target && e.target.id === 'screen')) { const code = 'Mouse' + e.button; if (!down.has(code)) pressedQ.add(code); down.add(code); }
});
window.addEventListener('mouseup', (e) => { mouse.dragging = false; const code = 'Mouse' + e.button; if (down.has(code)) { down.delete(code); releasedQ.add(code); } });
window.addEventListener('contextmenu', (e) => { if (mouse.locked || (e.target && e.target.id === 'screen')) e.preventDefault(); });
document.addEventListener('pointerlockchange', () => {
  mouse.locked = !!document.pointerLockElement;
  if (mouse.onLockChange) mouse.onLockChange(mouse.locked);
});

export const input = {
  isDown(name) { if (frozen) return false; return (GROUPS[name] || [name]).some((c) => down.has(c)); },
  pressed(name) { if (frozen) return false; return (GROUPS[name] || [name]).some((c) => pressedQ.has(c)); },
  released(name) { return (GROUPS[name] || [name]).some((c) => releasedQ.has(c)); },
  /** raw pressed regardless of freeze (menus) */
  rawPressed(name) { return (GROUPS[name] || [name]).some((c) => pressedQ.has(c)); },
  endFrame() { pressedQ.clear(); releasedQ.clear(); },
  /** per-frame mouse delta (pixels * sensitivity); call beginFrame once per frame */
  beginFrame() { mouse.dx = frozen ? 0 : mouse.accDx * mouse.sens; mouse.dy = frozen ? 0 : mouse.accDy * mouse.sens; mouse.accDx = 0; mouse.accDy = 0; },
  get mouseDX() { return mouse.dx; },
  get mouseDY() { return mouse.dy; },
  mouse,
  requestLock(el) { try { const r = el.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* pointer lock unavailable: drag fallback */ } },
  releaseLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* noop */ } },
  onAny(cb) { anyCb = cb; },
  setFrozen(v) { frozen = v; },
  /** simulate a key (used by tests / touch) */
  simulate(code, isDown) { if (isDown) { if (!down.has(code)) pressedQ.add(code); down.add(code); } else { down.delete(code); releasedQ.add(code); } },
};
