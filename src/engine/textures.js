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
  const scale = Math.max(1, Math.ceil(128 / Math.min(w, h)));
  const W = w * scale, H = h * scale;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, W, H);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const r = rng(seed);
  // periodic value-noise grid for mottling
  const cells = Math.max(2, Math.round(W / 16)), cellsY = Math.max(2, Math.round(H / 16));
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
  const noDetail = !detail || (key && /^(face|glow|sky|text|ear)/.test(key));
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
  return canvasTexture(64, 64, (g) => {
    const r = rng(7);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const v = wet ? 30 + r() * 16 : 52 + r() * 22;
      g.fillStyle = `rgb(${v},${v + 2},${v + 6})`; g.fillRect(x, y, 1, 1);
    }
    // aggregate stones
    for (let i = 0; i < 160; i++) { const v = (wet ? 60 : 85) + r() * 50; g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 1); }
    // a repaired patch with a darker rim, cracks
    g.fillStyle = wet ? 'rgba(8,8,12,0.4)' : 'rgba(16,16,20,0.32)'; g.fillRect(36, 8, 18, 13);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(36, 8, 18, 1); g.fillRect(36, 20, 18, 1);
    g.fillStyle = 'rgba(12,12,15,0.75)';
    for (let c = 0; c < 3; c++) { let x = Math.floor(r() * 64), y = Math.floor(r() * 64); for (let i = 0; i < 22; i++) { g.fillRect(x & 63, y & 63, 1, 1); if (r() < 0.25) g.fillRect((x + 1) & 63, y & 63, 1, 1); x += Math.floor(r() * 3) - 1; y += 1; } }
    if (wet) {
      // puddles reflecting the sky
      for (const [px0, py0, w, h] of [[6, 40, 18, 7], [40, 46, 14, 5]]) {
        for (let y = 0; y < h; y++) { const ww = Math.round(w * Math.sin(Math.PI * (y + 0.5) / h)); g.fillStyle = 'rgba(150,160,185,0.28)'; g.fillRect(px0 + (w - ww) / 2, py0 + y, ww, 1); }
        g.fillStyle = 'rgba(220,225,240,0.25)'; g.fillRect(px0 + 3, py0 + 1, w / 2, 1);
      }
    }
  }, { repeat, key: 'asphalt64' + wet });
}

export function roadLineTex(repeat = [1, 1]) {
  return canvasTexture(16, 32, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 16, 32);
    g.fillStyle = '#c8c29a'; g.fillRect(6, 0, 4, 18);
  }, { repeat, key: 'roadline' });
}

export function grassTex(repeat = [1, 1], color = '#4f5f38') {
  return canvasTexture(64, 64, (g) => {
    const r = rng(3);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { g.fillStyle = shade(color, 0.7 + r() * 0.2); g.fillRect(x, y, 1, 1); }
    // blades: short vertical strokes, lighter tips
    for (let i = 0; i < 520; i++) {
      const x = Math.floor(r() * 64), y = Math.floor(r() * 64), h = 2 + Math.floor(r() * 4);
      g.fillStyle = shade(color, 0.85 + r() * 0.4); g.fillRect(x, y, 1, h);
      g.fillStyle = shade(color, 1.25 + r() * 0.2); g.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 14; i++) { g.fillStyle = shade('#6a5a3a', 0.8 + r() * 0.3); g.fillRect(Math.floor(r() * 62), Math.floor(r() * 62), 2, 1); } // dry bits
  }, { repeat, key: 'grass64' + color });
}

export function tilesTex(a = '#8a8f8a', b = '#7c817c', repeat = [1, 1], grout = '#555') {
  return canvasTexture(64, 64, (g) => {
    const r = rng(11);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const base = (tx + ty) % 2 ? a : b;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        // glazed tile: soft diagonal sheen, slightly darker edges
        const edge = Math.min(x, y, 31 - x, 31 - y) < 2 ? 0.9 : 1;
        const sheen = 1 + Math.max(0, 1 - Math.abs((x - y) - 6) / 10) * 0.06;
        g.fillStyle = shade(base, edge * sheen * (0.96 + r() * 0.06)); g.fillRect(tx * 32 + x, ty * 32 + y, 1, 1);
      }
      if (r() < 0.4) { g.fillStyle = 'rgba(40,30,20,0.12)'; g.fillRect(tx * 32 + 4 + Math.floor(r() * 20), ty * 32 + 4 + Math.floor(r() * 20), 4, 3); }
      if (r() < 0.25) { g.fillStyle = 'rgba(20,20,20,0.35)'; let x = tx * 32 + Math.floor(r() * 32), y = ty * 32; for (let i = 0; i < 14; i++) { g.fillRect(x, y + i, 1, 1); x += Math.floor(r() * 3) - 1; } }
    }
    g.fillStyle = grout; g.fillRect(0, 0, 64, 2); g.fillRect(0, 32, 64, 2); g.fillRect(0, 0, 2, 64); g.fillRect(32, 0, 2, 64);
  }, { repeat, key: `tiles64-${a}-${b}-${grout}` });
}

export function woodTex(repeat = [1, 1], base = '#6b4a30') {
  return canvasTexture(64, 64, (g) => {
    const r = rng(5);
    const planks = 4, ph = 16;
    for (let p = 0; p < planks; p++) {
      const tone = 0.86 + r() * 0.22, off = r() * 40, freq = 0.12 + r() * 0.1;
      for (let y = p * ph; y < (p + 1) * ph; y++) for (let x = 0; x < 64; x++) {
        // flowing grain lines along the plank
        const gr = Math.sin((y - p * ph) * 0.9 + Math.sin((x + off) * freq) * 2.2);
        const k = tone * (0.92 + gr * 0.06 + (r() - 0.5) * 0.05);
        g.fillStyle = shade(base, k); g.fillRect(x, y, 1, 1);
      }
      // a knot
      if (r() < 0.7) { const kx = Math.floor(r() * 56) + 4, ky = p * ph + 5 + Math.floor(r() * 6); g.fillStyle = shade(base, 0.55); g.fillRect(kx, ky, 3, 2); g.fillStyle = shade(base, 0.7); g.fillRect(kx - 1, ky - 1, 5, 1); g.fillRect(kx - 1, ky + 2, 5, 1); }
      // seam + end joint
      g.fillStyle = shade(base, 0.42); g.fillRect(0, p * ph, 64, 1);
      g.fillStyle = shade(base, 1.12); g.fillRect(0, p * ph + 1, 64, 1);
      const jx = Math.floor((p * 23 + 11) % 64); g.fillStyle = shade(base, 0.45); g.fillRect(jx, p * ph, 1, ph);
    }
  }, { repeat, key: 'wood64' + base });
}

export function wallpaperTex(repeat = [1, 1], base = '#7d7360', pattern = '#6a604f') {
  return canvasTexture(64, 64, (g) => {
    const r = rng(9);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { g.fillStyle = shade(base, 0.95 + r() * 0.07); g.fillRect(x, y, 1, 1); }
    // thin vertical stripes + a damask-like motif between them
    g.fillStyle = shade(pattern, 0.95);
    for (const x of [0, 32]) { g.fillRect(x, 0, 1, 64); g.fillRect(x + 3, 0, 1, 64); }
    const motif = (cx, cy) => {
      g.fillStyle = pattern;
      for (let i = -6; i <= 6; i++) { const w = Math.round(4 * Math.cos(i / 6 * 1.4)); g.fillRect(cx - w, cy + i, w * 2 + 1, 1); }
      g.fillStyle = shade(base, 1.05); g.fillRect(cx - 1, cy - 3, 3, 6);
      g.fillStyle = pattern; g.fillRect(cx, cy - 9, 1, 3); g.fillRect(cx, cy + 7, 1, 3); g.fillRect(cx - 7, cy, 3, 1); g.fillRect(cx + 5, cy, 3, 1);
    };
    motif(17, 16); motif(49, 48); motif(17, 48 + 0); motif(49, 16);
    // age: a grimy band near the floor, a light cornice at the top, a few stains
    for (let y = 52; y < 64; y++) { g.fillStyle = `rgba(30,22,14,${(y - 51) * 0.02})`; g.fillRect(0, y, 64, 1); }
    g.fillStyle = 'rgba(255,255,240,0.08)'; g.fillRect(0, 0, 64, 2);
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(80,60,30,0.08)'; g.fillRect(Math.floor(r() * 54), Math.floor(r() * 40), 8 + Math.floor(r() * 6), 10 + Math.floor(r() * 8)); }
  }, { repeat, key: `wp64-${base}-${pattern}` });
}

export function concreteTex(repeat = [1, 1], base = '#6d6e6a') {
  return canvasTexture(64, 64, (g) => {
    const r = rng(13);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { g.fillStyle = shade(base, 0.86 + r() * 0.2); g.fillRect(x, y, 1, 1); }
    // aggregate pebbles
    for (let i = 0; i < 60; i++) { g.fillStyle = shade(base, r() < 0.5 ? 0.7 : 1.18); g.fillRect(Math.floor(r() * 63), Math.floor(r() * 63), 1 + Math.floor(r() * 2), 1); }
    // cracks
    g.fillStyle = 'rgba(20,20,20,0.45)';
    for (let i = 0; i < 3; i++) { let x = Math.floor(r() * 64), y = 0; while (y < 64) { g.fillRect(x & 63, y, 1, 1); y++; x += Math.floor(r() * 3) - 1; if (r() < 0.06) break; } }
    // water stains running down
    for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 60); for (let y = 0; y < 20 + r() * 40; y++) { g.fillStyle = 'rgba(40,32,20,0.07)'; g.fillRect(x, y, 3, 1); } }
    // formwork seams
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 32, 64, 1);
  }, { repeat, key: 'concrete64' + base });
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
  return canvasTexture(32, 32, (g) => {
    const r = rng(seed);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      // twill weave: diagonal ribs
      const rib = ((x + y) % 4 < 2) ? 1.04 : 0.93;
      g.fillStyle = shade(base, rib * (0.95 + r() * 0.07)); g.fillRect(x, y, 1, 1);
    }
    // soft folds: two darker diagonal bands
    for (let i = 0; i < 32; i++) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect((i * 2 + 5) % 32, i, 3, 1); g.fillRect((i + 20) % 32, i, 2, 1); }
  }, { repeat, key: `fab32-${base}-${seed}` });
}

export function knitTex(base = '#b3382c', repeat = [1, 1]) {
  return canvasTexture(32, 32, (g) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) g.fillStyle = shade(base, 0.72), g.fillRect(x, y, 1, 1);
    // rows of V-shaped stitches
    for (let y = 0; y < 32; y += 4) for (let x = 0; x < 32; x += 4) {
      g.fillStyle = shade(base, 1.08); g.fillRect(x, y, 1, 2); g.fillRect(x + 1, y + 1, 1, 2); g.fillRect(x + 2, y + 1, 1, 2); g.fillRect(x + 3, y, 1, 2);
      g.fillStyle = shade(base, 1.22); g.fillRect(x, y, 1, 1); g.fillRect(x + 3, y, 1, 1);
      g.fillStyle = shade(base, 0.6); g.fillRect(x + 1, y + 3, 2, 1);
    }
  }, { repeat, key: 'knit32' + base });
}

export function hairTex(base, repeat = [1, 1], seed = 4) {
  return canvasTexture(32, 32, (g) => {
    const r = rng(seed);
    for (let x = 0; x < 32; x++) {
      const k = 0.78 + r() * 0.3;
      for (let y = 0; y < 32; y++) { g.fillStyle = shade(base, k * (0.93 + r() * 0.12)); g.fillRect(x, y, 1, 1); }
    }
    // strands: darker gaps and a soft highlight band
    for (let i = 0; i < 10; i++) { const x = Math.floor(r() * 32); g.fillStyle = shade(base, 0.6); g.fillRect(x, 0, 1, 32); }
    for (let x = 0; x < 32; x++) { const y = 7 + Math.round(Math.sin(x * 0.4) * 2); g.fillStyle = shade(base, 1.35); g.fillRect(x, y, 1, 2); }
  }, { repeat, key: `hair32-${base}-${seed}` });
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
  return canvasTexture(64, 64, (g) => {
    const r = rng(31);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { g.fillStyle = shade(base, 0.75 + r() * 0.3); g.fillRect(x, y, 1, 1); }
    for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(150,150,180,0.16)'; g.fillRect(Math.floor(r() * 54), Math.floor(r() * 62), 6 + Math.floor(r() * 8), 1); }
    const cols = ['#a0521e', '#c07a28', '#7a3a1a', '#b89030', '#8a4a20', '#6a2a18'];
    for (let i = 0; i < density * 4; i++) {
      // a small leaf: body, darker vein, stem
      const x = Math.floor(r() * 60), y = Math.floor(r() * 60), c = cols[Math.floor(r() * cols.length)];
      const flip = r() < 0.5;
      g.fillStyle = c; g.fillRect(x, y + 1, 4, 2); g.fillRect(x + 1, y, 2, 4);
      g.fillStyle = shade(c, 0.65); g.fillRect(flip ? x + 1 : x + 2, y + 1, 1, 2);
      g.fillStyle = shade(c, 1.25); g.fillRect(x + 1, y + 1, 1, 1);
      g.fillStyle = '#3a2a18'; g.fillRect(flip ? x + 4 : x - 1, y + 3, 1, 1);
    }
  }, { repeat, key: `leaves64-${base}-${density}` });
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
  return canvasTexture(64, 64, (g) => {
    const r = rng(91);
    for (let x = 0; x < 64; x++) {
      const ph = (x % 8) / 8;
      const k = 0.72 + 0.4 * Math.sin(ph * Math.PI * 2 + 1.2) * 0.5 + 0.2;
      for (let y = 0; y < 64; y++) { g.fillStyle = shade(base, k * (0.95 + r() * 0.08)); g.fillRect(x, y, 1, 1); }
    }
    // rivets, rust streaks, a horizontal joint
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 31, 64, 1);
    g.fillStyle = shade(base, 1.3); for (let x = 3; x < 64; x += 8) { g.fillRect(x, 29, 1, 1); g.fillRect(x, 33, 1, 1); }
    for (let i = 0; i < 5; i++) { const x = Math.floor(r() * 60); const len = 8 + r() * 30; for (let y = 32; y < 32 + len && y < 64; y++) { g.fillStyle = `rgba(110,60,25,${0.25 * (1 - (y - 32) / len)})`; g.fillRect(x, y, 2, 1); } }
  }, { repeat, key: `corr64-${base}` });
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
