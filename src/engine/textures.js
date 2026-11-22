// Procedural low-resolution pixel textures (no external image assets).
import * as THREE from 'three';

const cache = new Map();

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Painterly detail pass: upsample the pixel design (nearest) to at least 64 px,
 * then add seamless low-frequency mottling, fine grain and specks — the
 * hand-painted PS1 look of the artbook. Tiling stays seamless.
 */
function addDetail(src, w, h, seed) {
  const scale = Math.max(1, Math.ceil(64 / Math.min(w, h)));
  const W = w * scale, H = h * scale;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, W, H);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const r = rng(seed);
  // periodic value-noise grid for mottling
  const cells = Math.max(2, Math.round(W / 12)), cellsY = Math.max(2, Math.round(H / 12));
  const grid = new Float32Array(cells * cellsY);
  for (let i = 0; i < grid.length; i++) grid[i] = r() * 2 - 1;
  const at = (x, y) => grid[((y % cellsY) + cellsY) % cellsY * cells + ((x % cells) + cells) % cells];
  for (let y = 0; y < H; y++) {
    const gy = (y / H) * cellsY, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < W; x++) {
      const gx = (x / W) * cells, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
      const n = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      const i = (y * W + x) * 4;
      if (d[i + 3] === 0) continue;
      let k = 1 + n * 0.07 + (r() - 0.5) * 0.07;
      if (r() < 0.004) k *= 0.75; // tiny specks of dirt
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k * 0.995);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

let detailSeed = 1;
export function canvasTexture(w, h, draw, { repeat = [1, 1], key = null, detail = true } = {}) {
  if (key && cache.has(key)) {
    const t = cache.get(key).clone();
    t.repeat.set(repeat[0], repeat[1]);
    t.needsUpdate = true;
    return t;
  }
  let c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const noDetail = !detail || (key && /^(face|glow|sky|text)/.test(key));
  if (!noDetail) c = addDetail(c, w, h, detailSeed++ * 977);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(repeat[0], repeat[1]);
  if (key) cache.set(key, t);
  return t;
}

function hex(c) { return typeof c === 'string' ? c : '#' + c.toString(16).padStart(6, '0'); }
function shade(color, k) {
  const c = new THREE.Color(hex(color));
  c.multiplyScalar(k);
  return '#' + c.getHexString();
}

/** generic noisy surface */
export function noiseTex(base, { w = 32, h = 32, amount = 0.18, seed = 1, repeat = [1, 1], speck = 0 } = {}) {
  return canvasTexture(w, h, (g) => {
    const r = rng(seed);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = 1 - amount / 2 + r() * amount;
      g.fillStyle = shade(base, k);
      g.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < speck; i++) {
      g.fillStyle = shade(base, 0.6 + r() * 0.2);
      g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
    }
  }, { repeat, key: `noise-${base}-${w}-${h}-${amount}-${seed}-${speck}` });
}

export function asphaltTex(repeat = [1, 1], wet = false) {
  return canvasTexture(32, 32, (g) => {
    const r = rng(7);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const v = wet ? 30 + r() * 18 : 52 + r() * 26;
      g.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      g.fillRect(x, y, 1, 1);
    }
    // a darker repair patch and a few cracks
    g.fillStyle = wet ? 'rgba(10,10,14,0.35)' : 'rgba(20,20,24,0.3)'; g.fillRect(18, 4, 9, 7);
    g.fillStyle = 'rgba(15,15,18,0.7)';
    for (let c = 0; c < 2; c++) { let x = Math.floor(r() * 32), y = Math.floor(r() * 32); for (let i = 0; i < 12; i++) { g.fillRect(x & 31, y & 31, 1, 1); x += Math.floor(r() * 3) - 1; y += 1; } }
    for (let i = 0; i < 10; i++) { const v = 90 + r() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1, 1); }
    if (wet) {
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,130,150,0.25)'; g.fillRect(Math.floor(r() * 28), Math.floor(r() * 30), 4 + Math.floor(r() * 5), 1); }
      g.fillStyle = 'rgba(140,150,170,0.18)'; g.fillRect(4, 20, 10, 4); g.fillRect(6, 19, 6, 1);
    }
  }, { repeat, key: 'asphalt' + wet });
}

export function roadLineTex(repeat = [1, 1]) {
  return canvasTexture(16, 32, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 16, 32);
    g.fillStyle = '#c8c29a'; g.fillRect(6, 0, 4, 18);
  }, { repeat, key: 'roadline' });
}

export function grassTex(repeat = [1, 1], color = '#4f5f38') {
  return noiseTex(color, { amount: 0.4, seed: 3, repeat, speck: 60 });
}

export function tilesTex(a = '#8a8f8a', b = '#7c817c', repeat = [1, 1], grout = '#555') {
  return canvasTexture(32, 32, (g) => {
    const r = rng(11);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      g.fillStyle = (tx + ty) % 2 ? a : b; g.fillRect(tx * 16, ty * 16, 16, 16);
      for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(tx * 16 + Math.floor(r() * 16), ty * 16 + Math.floor(r() * 16), 1, 1); }
    }
    g.fillStyle = grout; g.fillRect(0, 0, 32, 1); g.fillRect(0, 16, 32, 1); g.fillRect(0, 0, 1, 32); g.fillRect(16, 0, 1, 32);
  }, { repeat, key: `tiles-${a}-${b}-${grout}` });
}

export function woodTex(repeat = [1, 1], base = '#6b4a30') {
  return canvasTexture(32, 32, (g) => {
    const r = rng(5);
    for (let y = 0; y < 32; y++) {
      const plank = Math.floor(y / 8);
      for (let x = 0; x < 32; x++) {
        const k = 0.85 + Math.sin((x + plank * 13) * 0.6 + r() * 0.8) * 0.08 + r() * 0.06;
        g.fillStyle = shade(base, k); g.fillRect(x, y, 1, 1);
      }
      if (y % 8 === 0) { g.fillStyle = shade(base, 0.5); g.fillRect(0, y, 32, 1); }
    }
  }, { repeat, key: 'wood' + base });
}

export function wallpaperTex(repeat = [1, 1], base = '#7d7360', pattern = '#6a604f') {
  return canvasTexture(32, 32, (g) => {
    const r = rng(9);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { g.fillStyle = shade(base, 0.93 + r() * 0.1); g.fillRect(x, y, 1, 1); }
    g.fillStyle = pattern;
    for (let y = 2; y < 32; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 32; x += 8) { g.fillRect(x + 2, y, 2, 2); g.fillRect(x + 1, y + 1, 4, 1); g.fillRect(x + 3, y - 1, 0.5, 3); }
    g.fillRect(0, 0, 1, 32); g.fillRect(16, 0, 1, 32);
    for (let y = 26; y < 32; y++) { g.fillStyle = `rgba(30,22,14,${(y - 25) * 0.035})`; g.fillRect(0, y, 32, 1); }
    g.fillStyle = 'rgba(255,255,240,0.08)'; g.fillRect(0, 0, 32, 1);
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(40,30,20,0.12)'; g.fillRect(Math.floor(r() * 30), 20 + Math.floor(r() * 10), 1 + Math.floor(r() * 2), 1); }
  }, { repeat, key: `wp-${base}-${pattern}` });
}

export function concreteTex(repeat = [1, 1], base = '#6d6e6a') {
  return canvasTexture(32, 32, (g) => {
    const r = rng(13);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { g.fillStyle = shade(base, 0.85 + r() * 0.25); g.fillRect(x, y, 1, 1); }
    g.fillStyle = 'rgba(20,20,20,0.35)';
    for (let i = 0; i < 4; i++) { let x = Math.floor(r() * 32), y = 0; while (y < 32) { g.fillRect(x, y, 1, 1); y++; x += Math.floor(r() * 3) - 1; if (r() < 0.2) break; } }
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(40,30,20,0.18)'; g.fillRect(Math.floor(r() * 26), Math.floor(r() * 26), 6, 8); }
  }, { repeat, key: 'concrete' + base });
}

export function windowsTex(repeat = [1, 1], lit = 0.4, base = '#3a3d44', seed = 21) {
  return canvasTexture(32, 32, (g) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (r() < 0.25) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, y, 1, 1); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 32, 1); // panel seams
    for (let x = 0; x < 32; x += 16) g.fillRect(x, 0, 1, 32);
    for (let y = 2; y < 32; y += 8) for (let x = 2; x < 32; x += 8) {
      const on = r() < lit;
      g.fillStyle = '#8a8a84'; g.fillRect(x - 1, y - 1, 6, 7); // frame
      g.fillStyle = on ? (r() < 0.5 ? '#d9b45a' : '#c9a06a') : '#1c1e24';
      g.fillRect(x, y, 4, 5);
      g.fillStyle = on ? 'rgba(90,60,20,0.5)' : 'rgba(255,255,255,0.06)'; g.fillRect(x + 2, y, 1, 5); // mullion
      if (on && r() < 0.5) { g.fillStyle = 'rgba(120,40,30,0.45)'; g.fillRect(x, y, 1, 5); } // a curtain
      g.fillStyle = '#b0aca4'; g.fillRect(x - 1, y + 5, 6, 1); // sill
    }
  }, { repeat, key: `win-${lit}-${base}-${seed}` });
}

export function fabricTex(base, repeat = [1, 1], seed = 2) {
  return canvasTexture(16, 16, (g) => {
    const r = rng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = ((x + y) % 2 ? 0.94 : 1.02) + r() * 0.06;
      g.fillStyle = shade(base, k); g.fillRect(x, y, 1, 1);
    }
  }, { repeat, key: `fab-${base}-${seed}` });
}

export function knitTex(base = '#b3382c', repeat = [1, 1]) {
  return canvasTexture(16, 16, (g) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = ((x % 4 < 2) !== (y % 2 === 0)) ? 1.05 : 0.8;
      g.fillStyle = shade(base, v); g.fillRect(x, y, 1, 1);
    }
  }, { repeat, key: 'knit' + base });
}

export function hairTex(base, repeat = [1, 1], seed = 4) {
  return canvasTexture(16, 16, (g) => {
    const r = rng(seed);
    for (let x = 0; x < 16; x++) {
      const k = 0.8 + r() * 0.35;
      for (let y = 0; y < 16; y++) { g.fillStyle = shade(base, k * (0.95 + r() * 0.1)); g.fillRect(x, y, 1, 1); }
    }
  }, { repeat, key: `hair-${base}-${seed}` });
}

export function waterTex(repeat = [1, 1]) {
  return canvasTexture(32, 32, (g) => {
    const r = rng(17);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const v = 0.8 + Math.sin(x * 0.5 + Math.sin(y * 0.4) * 2) * 0.1 + r() * 0.08;
      g.fillStyle = shade('#3d5560', v); g.fillRect(x, y, 1, 1);
    }
  }, { repeat, key: 'water' });
}

export function skyTex(top, bottom) {
  return canvasTexture(4, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  }, { key: `sky-${top}-${bottom}` });
}

/** text sign texture (for walls, posters, "fourth wall" inscriptions) */
export function textTex(text, { w = 128, h = 32, color = '#ddd', bg = 'rgba(0,0,0,0)', font = 12 } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.font = `bold ${font}px monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (font + 2)));
  }, { detail: false });
}

export function glowSpriteTex(color = '#ffe8a0') {
  return canvasTexture(16, 16, (g) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5) / 8;
      const a = Math.max(0, 1 - d);
      g.fillStyle = color; g.globalAlpha = Math.round(a * a * 4) / 4; g.fillRect(x, y, 1, 1);
    }
  }, { key: 'glow' + color });
}

/** wet asphalt with fallen autumn leaves */
export function leavesTex(repeat = [1, 1], base = '#3a3a44', density = 22) {
  return canvasTexture(32, 32, (g) => {
    const r = rng(31);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const v = 0.75 + r() * 0.3;
      g.fillStyle = shade(base, v); g.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(150,150,180,0.18)'; g.fillRect(Math.floor(r() * 26), Math.floor(r() * 30), 5 + Math.floor(r() * 4), 1); }
    const cols = ['#a0521e', '#c07a28', '#7a3a1a', '#b89030', '#8a4a20'];
    for (let i = 0; i < density; i++) {
      const x = Math.floor(r() * 31), y = Math.floor(r() * 31);
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(x, y, 2, 1); g.fillRect(x + (r() < 0.5 ? 0 : 1), y + 1, 1, 1);
    }
  }, { repeat, key: `leaves-${base}-${density}` });
}

/** patterned bus seat fabric (blue with small purple/orange specks) */
export function seatTex(repeat = [1, 1]) {
  return canvasTexture(16, 16, (g) => {
    const r = rng(41);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = shade('#2c3a66', 0.85 + r() * 0.25); g.fillRect(x, y, 1, 1); }
    for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) {
      g.fillStyle = '#6a4a7a'; g.fillRect(x, y, 2, 1);
      g.fillStyle = '#b8783a'; g.fillRect(x + 1, y + 1, 1, 1);
    }
  }, { repeat, key: 'seat' });
}

/** printed toy box: bright cardboard, a white band and a simple pictogram */
export function toyBoxTex(base = '#c84a3a', icon = 0) {
  return canvasTexture(16, 16, (g) => {
    const r = rng(81 + icon);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = shade(base, 0.9 + r() * 0.15); g.fillRect(x, y, 1, 1); }
    g.fillStyle = '#f0ece0'; g.fillRect(0, 11, 16, 3);
    g.fillStyle = '#2a2a2a'; g.fillRect(2, 12, 8, 1);
    g.fillStyle = '#ffffff';
    if (icon % 4 === 0) { g.fillRect(5, 3, 6, 5); g.fillRect(4, 2, 2, 2); g.fillRect(10, 2, 2, 2); g.fillStyle = '#2a2a2a'; g.fillRect(6, 5, 1, 1); g.fillRect(9, 5, 1, 1); } // bear
    else if (icon % 4 === 1) { g.fillRect(3, 4, 10, 3); g.fillRect(5, 2, 5, 2); g.fillStyle = '#2a2a2a'; g.fillRect(4, 7, 2, 2); g.fillRect(10, 7, 2, 2); } // car
    else if (icon % 4 === 2) { g.fillRect(5, 2, 6, 6); g.fillRect(4, 3, 8, 4); g.fillStyle = base; g.fillRect(7, 2, 2, 6); } // ball
    else { g.fillRect(4, 2, 8, 2); g.fillRect(4, 5, 8, 2); g.fillRect(4, 8, 8, 1); } // blocks
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
  }, { key: `toybox-${base}-${icon}` });
}

/** corrugated metal wall */
export function corrugatedTex(repeat = [1, 1], base = '#5a6066') {
  return canvasTexture(16, 16, (g) => {
    const r = rng(91);
    for (let x = 0; x < 16; x++) {
      const k = x % 4 === 0 ? 0.7 : x % 4 === 1 ? 1.1 : 0.95;
      for (let y = 0; y < 16; y++) { g.fillStyle = shade(base, k * (0.94 + r() * 0.1)); g.fillRect(x, y, 1, 1); }
    }
    g.fillStyle = 'rgba(90,60,30,0.25)'; g.fillRect(Math.floor(r() * 12), 12, 3, 4);
  }, { repeat, key: `corr-${base}` });
}

/** warehouse floor: concrete with a yellow safety line along one edge */
export function warehouseFloorTex(repeat = [1, 1]) {
  return canvasTexture(32, 32, (g) => {
    const r = rng(95);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { g.fillStyle = shade('#5a5a56', 0.86 + r() * 0.2); g.fillRect(x, y, 1, 1); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(30,25,20,0.2)'; g.fillRect(Math.floor(r() * 26), Math.floor(r() * 26), 6, 3); }
  }, { repeat, key: 'whfloor' });
}
