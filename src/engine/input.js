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
  attack: ['KeyJ'],
  block: ['KeyK'],
  breathe: ['KeyQ'],
  face: ['KeyF'],
};

let frozen = false;

export const input = {
  isDown(name) { if (frozen) return false; return (GROUPS[name] || [name]).some((c) => down.has(c)); },
  pressed(name) { if (frozen) return false; return (GROUPS[name] || [name]).some((c) => pressedQ.has(c)); },
  released(name) { return (GROUPS[name] || [name]).some((c) => releasedQ.has(c)); },
  /** raw pressed regardless of freeze (menus) */
  rawPressed(name) { return (GROUPS[name] || [name]).some((c) => pressedQ.has(c)); },
  endFrame() { pressedQ.clear(); releasedQ.clear(); },
  onAny(cb) { anyCb = cb; },
  setFrozen(v) { frozen = v; },
  /** simulate a key (used by tests / touch) */
  simulate(code, isDown) { if (isDown) { if (!down.has(code)) pressedQ.add(code); down.add(code); } else { down.delete(code); releasedQ.add(code); } },
};
