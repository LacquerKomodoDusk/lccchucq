// Low-poly characters with pixel-art face textures and procedural animation.
import * as THREE from 'three';
import { ps1Material } from './ps1.js';
import { canvasTexture, fabricTex, hairTex, knitTex } from './textures.js';

/* ---------------------------------------------------------------- faces */

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

/**
 * Draw a 32x32 face.
 * spec: { skin, hair, brow, eye, lip, beard (color|null), noseRing, kid }
 */
function mix(c1, c2, k) {
  const a = new THREE.Color(c1), b = new THREE.Color(c2);
  return '#' + a.lerp(b, k).getHexString();
}

/**
 * 64x64 pixel-art face.
 * spec: { skin, skinDark, hair, brow, eye, lip, lash, beard, beardDark, noseRing, thickBrows, lashes, hairline, fringe }
 */
export function faceTexture(spec, expr = 'neutral') {
  return canvasTexture(64, 64, (g) => {
    const s = spec;
    const sk = s.skin, skD = s.skinDark, skL = mix(s.skin, '#ffffff', 0.12), skW = mix(s.skin, '#d0705a', 0.18);
    // base + soft shading: lighter forehead & nose bridge, warm cheeks, darker sides/jaw
    px(g, 0, 0, 64, 64, sk);
    px(g, 0, 0, 5, 64, skD); px(g, 59, 0, 5, 64, skD);
    px(g, 5, 0, 3, 64, mix(sk, skD, 0.5)); px(g, 56, 0, 3, 64, mix(sk, skD, 0.5));
    px(g, 16, 6, 32, 10, skL);
    px(g, 10, 36, 8, 6, skW); px(g, 46, 36, 8, 6, skW);
    px(g, 8, 56, 48, 8, mix(sk, skD, 0.45));
    // hairline / fringe
    if (s.hairline) px(g, 0, 0, 64, s.hairline * 2, s.hair);
    if (s.fringe) { px(g, 0, 0, 64, 12, s.hair); px(g, 0, 12, 12, 8, s.hair); px(g, 52, 12, 12, 8, s.hair); }
    const eyeY = 26;
    const closed = expr === 'closed';
    // brows
    const bw = s.thickBrows ? 3 : 2;
    const sad = expr === 'sad' || expr === 'cry' || expr === 'fear';
    const angry = expr === 'scary' || expr === 'angry';
    const browY = eyeY - (sad ? 8 : 6);
    for (let i = 0; i < 12; i++) {
      // left brow x 12..23, right brow x 40..51 (mirrored)
      let dy = 0;
      if (sad) dy = Math.round((11 - i) / 5);           // inner ends up
      else if (angry) dy = -Math.round((11 - i) / 4);   // inner ends down
      else dy = s.lashes ? (i > 3 && i < 9 ? -1 : 0) : 0; // soft arch
      px(g, 12 + i, browY + dy * (angry ? -1 : 1) + (angry ? 2 : 0), 1, bw, s.brow);
      px(g, 51 - i, browY + dy * (angry ? -1 : 1) + (angry ? 2 : 0), 1, bw, s.brow);
    }
    // eyes
    const lash = s.lash;
    const eye = (x) => {
      if (closed) { px(g, x, eyeY + 2, 10, 1, lash); px(g, x + 1, eyeY + 3, 8, 1, mix(sk, skD, 0.6)); return; }
      const h = expr === 'fear' || expr === 'scary' ? 6 : expr === 'joy' || expr === 'smile' ? 3 : 4;
      px(g, x, eyeY, 10, h, '#ece6dc');
      px(g, x + 3, eyeY, 4, h, s.eye);
      px(g, x + 4, eyeY + Math.max(0, h - 3), 2, Math.min(2, h), '#0c0a0a');
      px(g, x + 3, eyeY, 1, 1, '#ffffff');
      px(g, x - 1, eyeY - 1, 12, 1, lash); // upper lid
      px(g, x, eyeY + h, 10, 1, mix(sk, skD, 0.7)); // lower lid shadow
      if (s.lashes) { px(g, x - 2, eyeY - 2, 2, 1, lash); px(g, x + 10, eyeY - 2, 2, 1, lash); }
    };
    eye(14); eye(40);
    if (expr === 'cry') { px(g, 17, eyeY + 5, 1, 10, '#a8cce6'); px(g, 45, eyeY + 5, 1, 12, '#a8cce6'); px(g, 18, eyeY + 14, 1, 2, '#c8e0f0'); }
    // nose: bridge shadow, tip highlight, nostrils
    px(g, 29, eyeY + 1, 1, 12, mix(sk, skD, 0.6));
    px(g, 31, eyeY + 4, 2, 9, skL);
    px(g, 27, eyeY + 13, 10, 2, mix(sk, skD, 0.55));
    px(g, 28, eyeY + 14, 2, 1, '#5a3a30'); px(g, 34, eyeY + 14, 2, 1, '#5a3a30');
    if (s.noseRing) { px(g, 30, eyeY + 16, 4, 1, '#efe6c4'); px(g, 29, eyeY + 15, 1, 1, '#cfc6a4'); px(g, 34, eyeY + 15, 1, 1, '#cfc6a4'); }
    // beard & moustache (strand texture)
    if (s.beard) {
      const bd = s.beard, bdD = s.beardDark;
      px(g, 6, 40, 52, 24, bd);
      px(g, 3, 28, 6, 36, bd); px(g, 55, 28, 6, 36, bd);
      px(g, 9, 36, 6, 6, bd); px(g, 49, 36, 6, 6, bd);
      for (let i = 0; i < 90; i++) {
        const x = 4 + ((i * 37) % 56), y = 30 + ((i * 23) % 34);
        if (y < 40 && x > 12 && x < 52) continue;
        px(g, x, y, 1, 2 + (i % 3), bdD);
      }
      px(g, 20, 43, 24, 4, bdD); px(g, 18, 45, 4, 3, bdD); px(g, 42, 45, 4, 3, bdD); // moustache
    }
    // mouth
    const lip = s.lip, lipD = mix(s.lip, '#2a1010', 0.4), lipL = mix(s.lip, '#ffffff', 0.15);
    const my = 49;
    if (expr === 'smile' || expr === 'joy') {
      px(g, 24, my, 16, 2, lipD); px(g, 22, my - 1, 2, 1, lipD); px(g, 40, my - 1, 2, 1, lipD);
      px(g, 25, my + 2, 14, 2, lipL);
      if (expr === 'joy') px(g, 26, my, 12, 1, '#f0ece4');
    } else if (expr === 'angry') {
      px(g, 24, my - 2, 16, 5, '#2a1414'); px(g, 25, my - 2, 14, 1, '#e8e4dc'); px(g, 24, my - 3, 16, 1, lip);
    } else if (expr === 'fear' || expr === 'scary') {
      px(g, 26, my - 2, 12, 6, '#2a1414');
      if (expr === 'scary') { px(g, 26, my - 2, 2, 2, '#e0dcd4'); px(g, 36, my - 2, 2, 2, '#e0dcd4'); }
    } else if (sad) {
      px(g, 24, my, 16, 2, lipD); px(g, 22, my + 2, 2, 1, lipD); px(g, 40, my + 2, 2, 1, lipD); px(g, 26, my + 2, 12, 1, lipL);
    } else {
      px(g, 24, my, 16, 2, lipD); px(g, 25, my + 2, 14, 2, lip); px(g, 27, my + 4, 10, 1, lipL);
    }
    // chin shadow
    if (!s.beard) px(g, 24, 58, 16, 2, mix(sk, skD, 0.5));
  }, { key: `face64-${JSON.stringify(spec)}-${expr}` });
}

/** clothing front: coat with lapels & buttons, jacket with zip, sweater, t-shirt */
export function clothFrontTex(base, kind = 'coat', accent = '#2a2a2a') {
  return canvasTexture(32, 32, (g) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const k = ((x + y) % 2 ? 0.95 : 1.02) * (0.94 + ((x * 7 + y * 13) % 11) / 100);
      px(g, x, y, 1, 1, mix(base, '#000000', 1 - k));
    }
    const dark = mix(base, '#000000', 0.35), light = mix(base, '#ffffff', 0.12);
    if (kind === 'coat') {
      // lapels (V), double row of buttons, pockets, seam
      for (let i = 0; i < 12; i++) { px(g, 9 + i * 0.5, i, 2, 1, dark); px(g, 21 - i * 0.5, i, 2, 1, dark); px(g, 11 + i * 0.5, i, 1, 1, light); }
      for (const y of [14, 20, 26]) { px(g, 12, y, 2, 2, accent); px(g, 18, y, 2, 2, accent); }
      px(g, 16, 12, 1, 20, dark);
      px(g, 3, 22, 7, 1, dark); px(g, 22, 22, 7, 1, dark);
    } else if (kind === 'jacket') {
      px(g, 15, 0, 2, 32, '#8a8a80'); px(g, 15, 4, 2, 1, '#c8c8c0');
      px(g, 3, 20, 7, 1, dark); px(g, 22, 20, 7, 1, dark);
      px(g, 0, 29, 32, 3, dark);
    } else if (kind === 'sweater') {
      px(g, 10, 0, 12, 3, dark); // neckline
      for (let y = 26; y < 32; y += 2) px(g, 0, y, 32, 1, dark); // ribbed hem
    } else if (kind === 'tshirt') {
      px(g, 11, 0, 10, 2, dark);
    }
  }, { key: `cloth-${base}-${kind}-${accent}` });
}

/** jeans / trousers with seams */
export function trousersTex(base) {
  return canvasTexture(16, 32, (g) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) {
      const k = 0.9 + ((x * 5 + y * 3) % 7) / 50 + (y > 10 && y < 16 ? 0.05 : 0);
      px(g, x, y, 1, 1, mix(base, '#000000', 1 - k));
    }
    px(g, 0, 0, 1, 32, mix(base, '#000000', 0.35));
    px(g, 15, 0, 1, 32, mix(base, '#ffffff', 0.1));
    for (let y = 1; y < 32; y += 3) px(g, 1, y, 1, 1, mix(base, '#d8b070', 0.35)); // stitching
  }, { key: `trousers-${base}` });
}

/** shoe: leather with a light sole */
export function shoeTex(base) {
  return canvasTexture(8, 8, (g) => {
    px(g, 0, 0, 8, 8, base);
    px(g, 0, 0, 8, 2, mix(base, '#ffffff', 0.12));
    px(g, 0, 6, 8, 2, mix(base, '#c8b8a0', 0.55));
    px(g, 3, 2, 2, 2, mix(base, '#000000', 0.3));
  }, { key: `shoe-${base}` });
}

/** hands: skin with finger separation */
export function handTex(skin, skinDark) {
  return canvasTexture(8, 8, (g) => {
    px(g, 0, 0, 8, 8, skin);
    for (const x of [2, 4, 6]) px(g, x, 4, 1, 4, skinDark);
    px(g, 0, 0, 8, 1, mix(skin, skinDark, 0.5));
  }, { key: `hand-${skin}` });
}

let _blobMat = null;
function blobMaterial() {
  if (_blobMat) return _blobMat;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  _blobMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return _blobMat;
}

/* ---------------------------------------------------------------- geometry helpers */

function boxMesh(w, h, d, mat, { y = -h / 2, x = 0, z = 0 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return new THREE.Mesh(geo, mat);
}

function taperBox(wTop, wBot, h, dTop, dBot, mat, yOff = 0) {
  const geo = new THREE.BoxGeometry(1, h, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const top = y > 0;
    pos.setX(i, pos.getX(i) * (top ? wTop : wBot));
    pos.setZ(i, pos.getZ(i) * (top ? dTop : dBot));
    pos.setY(i, y + yOff);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

const lerp = THREE.MathUtils.lerp;

/* ---------------------------------------------------------------- poses */

const ZERO = {
  bob: 0, hipsY: 0, lean: 0, torsoX: 0, torsoZ: 0, headX: 0, headY: 0, headZ: 0,
  uArmLX: 0, uArmLZ: 0.08, fArmLX: 0, uArmRX: 0, uArmRZ: -0.08, fArmRX: 0,
  uArmLY: 0, uArmRY: 0,
  thighLX: 0, shinLX: 0, thighRX: 0, shinRX: 0, sitDrop: 0,
};

function poseFor(state, t, ch) {
  const p = { ...ZERO };
  const br = Math.sin(t * 1.6) * 0.02;
  switch (state) {
    case 'idle':
      p.torsoX = br; p.headX = -br; p.uArmLZ = 0.1 + br; p.uArmRZ = -0.1 - br; p.fArmLX = -0.12; p.fArmRX = -0.12;
      // slow weight shift from foot to foot
      p.hipsY = Math.sin(t * 0.37) * 0.035; p.torsoZ = Math.sin(t * 0.37 + 0.6) * 0.018;
      p.thighLX = Math.max(0, Math.sin(t * 0.37)) * 0.05; p.shinLX = p.thighLX * 1.4;
      p.headY = Math.sin(t * 0.23) * 0.08;
      break;
    case 'walk':
    case 'run': {
      const run = state === 'run';
      const ph = ch.phase;
      // stride amplitude follows the real speed, so slow steps look slow
      const sp = Math.min(1.25, (ch.speedNow ?? (run ? 3.7 : 1.75)) / (run ? 3.7 : 1.75));
      const a = (run ? 0.8 : 0.48) * (0.45 + 0.55 * sp);
      const s1 = Math.sin(ph), c1 = Math.cos(ph);
      p.thighLX = s1 * a; p.thighRX = -s1 * a;
      // knee bends during the swing phase, a little at heel strike
      p.shinLX = (Math.max(0, -c1) * 1.25 + 0.08) * a * (run ? 1.6 : 1.2);
      p.shinRX = (Math.max(0, c1) * 1.25 + 0.08) * a * (run ? 1.6 : 1.2);
      // arms swing opposite to the legs, elbows bend more on the forward swing
      p.uArmLX = -s1 * a * 0.85; p.uArmRX = s1 * a * 0.85;
      p.uArmLZ = 0.1; p.uArmRZ = -0.1;
      p.fArmLX = run ? -1.25 : -0.22 - Math.max(0, s1) * 0.35; p.fArmRX = run ? -1.25 : -0.22 - Math.max(0, -s1) * 0.35;
      // body: double-frequency bob, hip roll, shoulders counter-rotate, head stays level
      p.bob = (Math.abs(s1) - 0.5) * (run ? 0.07 : 0.03);
      p.torsoX = (run ? 0.2 : 0.04) * (0.6 + 0.4 * sp);
      p.headX = run ? -0.1 : -0.01;
      p.hipsY = s1 * (run ? 0.09 : 0.07);
      p.torsoZ = c1 * (run ? 0.02 : 0.015);
      break;
    }
    case 'fear':
      p.lean = -0.18; p.torsoX = -0.15; p.headX = -0.2;
      p.uArmLX = -1.6; p.uArmRX = -1.6; p.uArmLZ = 0.35; p.uArmRZ = -0.35; p.fArmLX = -1.6; p.fArmRX = -1.6;
      p.thighLX = -0.15; p.shinLX = 0.3; p.thighRX = 0.25;
      p.torsoZ = Math.sin(t * 40) * 0.015;
      break;
    case 'tired':
      p.torsoX = 0.32 + br * 2; p.headX = 0.45; p.uArmLZ = 0.04; p.uArmRZ = -0.04; p.uArmLX = 0.15; p.uArmRX = 0.15;
      p.bob = -0.04; p.torsoZ = Math.sin(t * 0.7) * 0.04;
      break;
    case 'anxious':
      p.torsoX = 0.12; p.headX = 0.15 + Math.sin(t * 3) * 0.05; p.headY = Math.sin(t * 1.7) * 0.5 * (Math.sin(t * 0.6) > 0 ? 1 : 0.2);
      p.uArmLX = -0.7; p.uArmRX = -0.7; p.uArmLZ = -0.35; p.uArmRZ = 0.35; p.fArmLX = -1.1 + Math.sin(t * 9) * 0.08; p.fArmRX = -1.1 - Math.sin(t * 9) * 0.08;
      p.torsoZ = Math.sin(t * 23) * 0.01;
      break;
    case 'joy':
      p.bob = Math.abs(Math.sin(t * 6)) * 0.06; p.headX = -0.2; p.torsoX = -0.05;
      p.uArmLX = -0.3; p.uArmRX = -0.3; p.uArmLZ = 1.1 + Math.sin(t * 6) * 0.1; p.uArmRZ = -1.1 - Math.sin(t * 6) * 0.1; p.fArmLX = -0.3; p.fArmRX = -0.3;
      break;
    case 'hug':
      p.torsoX = 0.08; p.headX = 0.12; p.headZ = 0.12;
      p.uArmLX = -1.25; p.uArmRX = -1.25; p.uArmLZ = -0.45; p.uArmRZ = 0.45; p.fArmLX = -0.9; p.fArmRX = -0.9;
      p.uArmLY = 0.4; p.uArmRY = -0.4;
      break;
    case 'sit':
      p.sitDrop = 0.45; p.thighLX = 1.5; p.thighRX = 1.5; p.shinLX = 1.5; p.shinRX = 1.5;
      p.uArmLX = -0.5; p.uArmRX = -0.5; p.fArmLX = -0.6; p.fArmRX = -0.6; p.torsoX = br;
      break;
    case 'scary':
      p.torsoX = 0.3 + Math.sin(t * 8) * 0.03; p.headX = -0.25;
      p.uArmLX = -1.5; p.uArmRX = -1.5; p.uArmLZ = 0.5; p.uArmRZ = -0.5; p.fArmLX = -0.6; p.fArmRX = -0.6;
      p.thighLX = Math.sin(ch.phase) * 0.5; p.thighRX = -Math.sin(ch.phase) * 0.5;
      p.shinLX = Math.max(0, -Math.cos(ch.phase)) * 0.6; p.shinRX = Math.max(0, Math.cos(ch.phase)) * 0.6;
      break;
    case 'hold':
      p.torsoX = 0.05 + br; p.headX = 0.35;
      p.uArmLX = -0.7; p.uArmRX = -0.7; p.uArmLZ = -0.25; p.uArmRZ = 0.25; p.fArmLX = -1.0; p.fArmRX = -1.0;
      p.torsoZ = Math.sin(t * 1.2) * 0.04;
      break;
    case 'phone':
      p.headX = 0.45; p.uArmRX = -0.9; p.uArmRZ = 0.3; p.fArmRX = -1.4; p.uArmLZ = 0.1; p.fArmLX = -0.2; p.torsoX = 0.06 + br;
      break;
    case 'kiss':
      p.torsoX = 0.18; p.headX = 0.2; p.headZ = 0.22; p.uArmLX = -0.6; p.uArmRX = -0.6; p.uArmLZ = -0.3; p.uArmRZ = 0.3; p.fArmLX = -0.6; p.fArmRX = -0.6;
      break;
    case 'sitKiss':
      p.sitDrop = 0.45; p.thighLX = 1.5; p.thighRX = 1.5; p.shinLX = 1.5; p.shinRX = 1.5;
      p.torsoX = 0.34; p.headX = 0.1; p.headZ = 0.2 * (ch.kissSide ?? 1);
      p.uArmLX = -0.7; p.uArmRX = -0.5; p.uArmLZ = -0.2; p.uArmRZ = 0.2; p.fArmLX = -0.7; p.fArmRX = -0.6;
      break;
    case 'argue': {
      // raised voice: leaning in, sharp hand gestures
      const gst = Math.sin(t * 5.5);
      p.torsoX = 0.14 + gst * 0.03; p.headX = -0.08 + Math.sin(t * 7) * 0.05; p.headY = Math.sin(t * 2.1) * 0.12;
      p.uArmRX = -0.9 - Math.max(0, gst) * 0.5; p.uArmRZ = 0.15; p.fArmRX = -1.1 + gst * 0.3;
      p.uArmLX = -0.35 + Math.max(0, -gst) * 0.3; p.uArmLZ = 0.25; p.fArmLX = -0.7;
      p.hipsY = Math.sin(t * 1.3) * 0.05;
      break;
    }
    case 'attack':
      p.torsoX = 0.2; p.uArmRX = -1.6; p.fArmRX = -0.1; p.uArmLX = 0.3; p.thighLX = -0.4; p.shinLX = 0.4; p.thighRX = 0.3;
      break;
    case 'block':
      p.torsoX = 0.15; p.uArmLX = -1.3; p.uArmRX = -1.3; p.uArmLZ = -0.5; p.uArmRZ = 0.5; p.fArmLX = -1.4; p.fArmRX = -1.4; p.headX = 0.2;
      break;
    case 'hurt':
      p.lean = -0.25; p.torsoX = -0.3; p.headX = -0.4; p.uArmLZ = 0.7; p.uArmRZ = -0.7;
      break;
    case 'kneel':
      p.sitDrop = 0.42; p.thighLX = 1.4; p.shinLX = 1.4; p.thighRX = -0.1; p.shinRX = 1.6; p.torsoX = 0.4; p.headX = 0.4;
      p.uArmLX = 0.2; p.uArmRX = 0.2;
      break;
    case 'lie':
      p.lean = -1.5; p.sitDrop = 0.75; p.headX = 0; p.uArmLZ = 0.15; p.uArmRZ = -0.15;
      break;
    case 'float':
      p.bob = 0.05 + Math.sin(t * 1.3) * 0.05; p.uArmLZ = 0.25 + Math.sin(t) * 0.05; p.uArmRZ = -0.25 - Math.sin(t) * 0.05; p.headX = 0.3;
      p.thighLX = 0.08; p.thighRX = -0.02; p.shinLX = 0.2; p.shinRX = 0.25;
      break;
  }
  return p;
}

/* ---------------------------------------------------------------- character */

export class Character {
  /**
   * spec: see family config
   */
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.root.name = spec.name || 'character';
    this.materials = [];
    this.state = 'idle';
    this.phase = 0;
    this.t = Math.random() * 10;
    this.pose = { ...ZERO };
    this.lookYaw = 0; // extra head yaw (radians), set by scripts
    this.lookPitch = 0;
    this.expr = 'neutral';
    this.speedForPhase = 0;
    this.blendRate = 8;
    this.build();
  }

  mat(opts) { const m = ps1Material(opts); this.materials.push(m); return m; }

  build() {
    const s = this.spec;
    const H = s.height ?? 1.78;
    const k = H / 1.78;
    this.k = k;
    const legLen = 0.9 * k;
    const skin = this.mat({ color: s.skin });
    const top = this.mat({ map: fabricTex(s.top, [2, 2], 3) });
    const pants = this.mat({ map: trousersTex(s.pants) });
    const shoes = this.mat({ map: shoeTex(s.shoes) });
    const handM = this.mat({ map: handTex(s.skin, s.skinDark) });
    const coatM = s.coat ? this.mat({ map: fabricTex(s.coat, [2, 3], 6) }) : null;
    const hairM = this.mat({ map: hairTex(s.hair, [1, 1], s.hairSeed ?? 4) });

    this.hips = new THREE.Group(); this.hips.position.y = legLen; this.root.add(this.hips);
    // pelvis
    this.hips.add(boxMesh(0.32 * k, 0.16 * k, 0.2 * k, coatM && s.longCoat ? coatM : pants, { y: 0 }));

    // torso
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    const torsoMat = coatM || top;
    const tw = (s.shoulders ?? 0.4) * k;
    const frontKind = coatM ? (s.longCoat ? 'coat' : 'jacket') : (s.topKind || 'sweater');
    const frontM = this.mat({ map: clothFrontTex(coatM ? s.coat : s.top, frontKind, s.buttons || '#2a2622') });
    const torsoMesh = taperBox(tw, 0.32 * k, 0.56 * k, 0.22 * k, 0.2 * k, [torsoMat, torsoMat, torsoMat, torsoMat, frontM, torsoMat], 0.28 * k + 0.04 * k);
    this.torso.add(torsoMesh);
    if (coatM) {
      // collar / inner top visible in front
      const inner = boxMesh(0.07 * k, 0.12 * k, 0.02, top, { y: 0.52 * k, z: 0.113 * k });
      this.torso.add(inner);
    }
    if (s.backpack) {
      const bp = this.mat({ map: fabricTex(s.backpack, [1, 1], 8) });
      const pack = boxMesh(0.3 * k, 0.38 * k, 0.14 * k, bp, { y: 0.36 * k, z: -0.18 * k });
      this.torso.add(pack);
      const strapM = this.mat({ color: 0x3a3a3a });
      this.torso.add(boxMesh(0.04, 0.4 * k, 0.24 * k, strapM, { x: -0.1 * k, y: 0.4 * k, z: -0.02 }));
      this.torso.add(boxMesh(0.04, 0.4 * k, 0.24 * k, strapM, { x: 0.1 * k, y: 0.4 * k, z: -0.02 }));
    }
    if (s.baby) this.addBaby();

    // neck + head
    this.neck = new THREE.Group(); this.neck.position.y = 0.6 * k; this.torso.add(this.neck);
    this.neck.add(boxMesh(0.09 * k, 0.08 * k, 0.09 * k, skin, { y: 0.04 * k }));
    if (s.scarf) {
      const sc = this.mat({ map: knitTex(s.scarf) });
      this.neck.add(boxMesh(0.2 * k, 0.07 * k, 0.18 * k, sc, { y: 0.02 * k }));
    }
    this.head = new THREE.Group(); this.head.position.y = 0.08 * k; this.neck.add(this.head);
    this.head.scale.setScalar(s.headScale ?? 1);
    this.faceSpec = {
      skin: s.skin, skinDark: s.skinDark, hair: s.hair, brow: s.brow, eye: s.eye, lip: s.lip, lash: s.lash ?? '#2a1d18',
      beard: s.beard || null, beardDark: s.beardDark || null, noseRing: !!s.noseRing, thickBrows: !!s.thickBrows,
      lashes: !!s.lashes, hairline: s.hairline ?? 3, fringe: !!s.fringe,
    };
    this.faceMat = this.mat({ map: faceTexture(this.faceSpec, 'neutral') });
    const hw = 0.21 * k, hh = 0.25 * k, hd = 0.23 * k;
    const headGeo = new THREE.BoxGeometry(hw, hh, hd);
    headGeo.translate(0, hh / 2, 0);
    // slightly narrow the chin
    const hp = headGeo.attributes.position;
    for (let i = 0; i < hp.count; i++) if (hp.getY(i) < 0.01) { hp.setX(i, hp.getX(i) * 0.78); hp.setZ(i, hp.getZ(i) * 0.86); }
    headGeo.computeVertexNormals();
    const headSkin = this.mat({ color: s.skin });
    this.headMesh = new THREE.Mesh(headGeo, [headSkin, headSkin, hairM, headSkin, this.faceMat, hairM]);
    this.head.add(this.headMesh);
    // nose
    const nose = taperBox(0.025 * k, 0.04 * k, 0.07 * k, 0.01, 0.045 * k, skin);
    nose.position.set(0, hh * 0.47, hd / 2 + 0.012);
    this.head.add(nose);
    if (s.noseRing) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008 * k, 0.0022, 3, 6), this.mat({ color: 0xe6dcb5, emissive: 0x332a10 }));
      const septum = s.noseRing === 'septum';
      ring.position.set(septum ? 0 : 0.016 * k, hh * (septum ? 0.36 : 0.36), hd / 2 + (septum ? 0.035 : 0.03));
      ring.rotation.y = septum ? 0 : Math.PI / 2;
      this.head.add(ring);
      this.noseRing = ring;
    }
    this.buildHair(hairM, hw, hh, hd, k);
    if (s.beard) {
      const bm = this.mat({ map: hairTex(s.beard, [1, 1], 9) });
      const beard = taperBox(hw * 0.95, hw * 0.55, 0.12 * k, hd * 0.5, hd * 0.35, bm, 0);
      beard.position.set(0, 0.0, hd * 0.22);
      this.head.add(beard);
      const cheeks = boxMesh(hw * 1.04, 0.1 * k, hd * 0.7, bm, { y: hh * 0.26, z: 0.01 });
      this.head.add(cheeks);
      // moustache
      this.head.add(boxMesh(hw * 0.5, 0.025 * k, 0.03, bm, { y: hh * 0.3, z: hd / 2 + 0.006 }));
    }
    if (s.hat) {
      // slouchy knitted beanie
      const km = this.mat({ map: knitTex(s.hatColor ?? '#b3382c', [4, 2]) });
      const geo = new THREE.SphereGeometry(0.168 * k, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62);
      geo.scale(1.04, 1.0, 1.1);
      const hat = new THREE.Mesh(geo, km);
      hat.position.set(0, hh * 0.68, -0.012 * k);
      hat.rotation.x = -0.28;
      this.head.add(hat);
      const slouch = new THREE.Mesh(new THREE.SphereGeometry(0.1 * k, 7, 5), km);
      slouch.scale.set(1.1, 0.8, 1);
      slouch.position.set(0, hh * 0.86, -0.13 * k);
      this.head.add(slouch);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.122 * k, 0.124 * k, 0.045 * k, 10, 1, true), this.mat({ map: knitTex(s.hatColor ?? '#b3382c', [6, 1]), side: THREE.DoubleSide }));
      brim.position.set(0, hh * 0.78, -0.005);
      brim.rotation.x = -0.14;
      this.head.add(brim);
      this.hat = hat;
    }

    // arms
    const armMat = coatM || top;
    const ua = 0.3 * k, fa = 0.28 * k;
    const mkArm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * (tw / 2 + 0.03 * k), 0.54 * k, 0); this.torso.add(sh);
      sh.add(boxMesh(0.09 * k, ua, 0.1 * k, armMat, { y: -ua / 2 }));
      const el = new THREE.Group(); el.position.y = -ua; sh.add(el);
      el.add(boxMesh(0.08 * k, fa, 0.09 * k, armMat, { y: -fa / 2 }));
      const hand = boxMesh(0.07 * k, 0.09 * k, 0.05 * k, handM, { y: -fa - 0.04 * k });
      el.add(hand);
      return { sh, el, hand };
    };
    this.armL = mkArm(1); this.armR = mkArm(-1);

    // legs
    const th = 0.46 * k, sl = 0.44 * k;
    const mkLeg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.09 * k, -0.02, 0); this.hips.add(hip);
      hip.add(boxMesh(0.13 * k, th, 0.14 * k, pants, { y: -th / 2 }));
      const knee = new THREE.Group(); knee.position.y = -th; hip.add(knee);
      knee.add(boxMesh(0.11 * k, sl, 0.12 * k, pants, { y: -sl / 2 }));
      knee.add(boxMesh(0.11 * k, 0.07 * k, 0.22 * k, shoes, { y: -sl + 0.035 * k, z: 0.04 * k }));
      return { hip, knee };
    };
    this.legL = mkLeg(1); this.legR = mkLeg(-1);

    if (coatM && s.longCoat) {
      // coat skirt hanging from hips
      this.skirt = new THREE.Group(); this.hips.add(this.skirt);
      const sk = taperBox(0.36 * k, 0.46 * k, (s.coatLength ?? 0.55) * k, 0.24 * k, 0.32 * k, coatM, -(s.coatLength ?? 0.55) * k / 2 + 0.04);
      this.skirt.add(sk);
      if (s.belt) this.torso.add(boxMesh(0.34 * k, 0.04 * k, 0.23 * k, this.mat({ color: s.belt }), { y: 0.04 * k }));
    }

    // soft blob shadow on the ground (classic PS1 grounding)
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.32 * k, 12), blobMaterial());
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = -1;
    this.root.add(blob);
    this.blob = blob;
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.userData.character = this; } });
  }

  buildHair(hairM, hw, hh, hd, k) {
    const s = this.spec;
    const style = s.hairStyle;
    if (style === 'volume') {
      // voluminous, slightly messy hair (low-poly blob + fringe tufts)
      const geo = new THREE.IcosahedronGeometry(0.135 * k, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const j = Math.sin(pos.getX(i) * 91 + pos.getY(i) * 47 + pos.getZ(i) * 13) * 0.5 + 0.5;
        pos.setXYZ(i, pos.getX(i) * (1 + j * 0.12), pos.getY(i) * (1 + j * 0.18), pos.getZ(i) * (1 + j * 0.1));
      }
      geo.scale(1.02, 0.78, 1.12);
      geo.computeVertexNormals();
      const blob = new THREE.Mesh(geo, hairM);
      blob.position.set(0, hh * 0.9, -0.03 * k);
      this.head.add(blob);
      for (const [x, rz] of [[-0.06, 0.4], [0.0, -0.1], [0.065, -0.45]]) {
        const tuft = taperBox(0.07 * k, 0.03 * k, 0.07 * k, 0.05 * k, 0.03 * k, hairM);
        tuft.position.set(x * k, hh * 0.9, hd / 2 - 0.005);
        tuft.rotation.set(0.5, 0, rz);
        this.head.add(tuft);
      }
      this.head.add(boxMesh(0.03, hh * 0.4, hd * 0.6, hairM, { x: hw / 2 + 0.008, y: hh * 0.78, z: -0.03 }));
      this.head.add(boxMesh(0.03, hh * 0.4, hd * 0.6, hairM, { x: -hw / 2 - 0.008, y: hh * 0.78, z: -0.03 }));
      this.head.add(boxMesh(hw * 1.05, hh * 0.55, 0.05, hairM, { y: hh * 0.72, z: -hd / 2 - 0.01 }));
    } else if (style === 'long') {
      // long dark hair
      if (!s.hat) {
        const cap = taperBox(hw * 1.12, hw * 1.1, 0.05 * k, hd * 1.12, hd * 1.08, hairM);
        cap.position.set(0, hh + 0.012, -0.005);
        this.head.add(cap);
      }
      const len = (s.hairLength ?? 0.55) * k;
      this.head.add(boxMesh(hw * 1.2, len, 0.06 * k, hairM, { y: hh - len / 2 + 0.03, z: -hd / 2 - 0.02 }));
      const sideTop = s.hat ? hh * 0.74 : hh;
      this.head.add(boxMesh(0.04, len * 0.8, hd * 0.55, hairM, { x: hw / 2 + 0.015, y: sideTop - len * 0.4 + 0.02, z: -0.04 }));
      this.head.add(boxMesh(0.04, len * 0.8, hd * 0.55, hairM, { x: -hw / 2 - 0.015, y: sideTop - len * 0.4 + 0.02, z: -0.04 }));
      // strands in front of shoulders
      this.head.add(boxMesh(0.05, len * 0.6, 0.05, hairM, { x: hw / 2 + 0.005, y: hh * 0.5 - len * 0.25, z: hd * 0.25 }));
      this.head.add(boxMesh(0.05, len * 0.6, 0.05, hairM, { x: -hw / 2 - 0.005, y: hh * 0.5 - len * 0.25, z: hd * 0.25 }));
    } else if (style === 'short') {
      const cap = taperBox(hw * 1.1, hw * 1.08, 0.06 * k, hd * 1.1, hd * 1.08, hairM);
      cap.position.set(0, hh + 0.01, 0);
      this.head.add(cap);
      this.head.add(boxMesh(hw * 1.1, hh * 0.5, 0.04, hairM, { y: hh * 0.8, z: -hd / 2 - 0.01 }));
    }
  }

  addBaby() {
    const k = this.k ?? 1;
    const wrap = this.mat({ map: fabricTex(this.spec.babyColor || '#d8d2c0', [1, 1], 12) });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 2, 6), wrap);
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const face = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), this.mat({ color: this.spec.babySkin || '#d7b39a' }));
    face.position.set(0.15, 0.02, 0.02);
    g.add(face);
    g.position.set(0, 0.3 * k, 0.2 * k);
    this.torso.add(g);
    this.baby = g;
  }

  /** hold an object (mesh) in front of the chest; null to drop it */
  carry(mesh) {
    if (this.carryMesh) { this.torso.remove(this.carryMesh); this.carryMesh = null; }
    if (mesh) { mesh.position.set(0, 0.32 * this.k, 0.34 * this.k); this.torso.add(mesh); this.carryMesh = mesh; }
  }

  setBaby(on) {
    if (on && !this.baby) this.addBaby();
    if (this.baby) this.baby.visible = on;
  }

  setExpression(expr) {
    if (expr === this.expr) return;
    this.expr = expr;
    this._shownClosed = false;
    this.faceMat.map = faceTexture(this.faceSpec, expr);
    this.faceMat.needsUpdate = true;
  }

  setGlitch(v) { for (const m of this.materials) m.userData.uGlitch.value = v; }
  setOpacity(v) {
    for (const m of this.materials) { m.transparent = v < 1; m.opacity = v; m.depthWrite = v >= 1; }
  }

  /** movement speed in m/s, used to drive step phase */
  update(dt, speed = 0) {
    this.t += dt;
    this.speedNow = speed;
    // turning rate → lean into turns
    const rotY = this.root.rotation.y;
    if (this._prevRot === undefined) this._prevRot = rotY;
    let dRot = rotY - this._prevRot; dRot = Math.atan2(Math.sin(dRot), Math.cos(dRot));
    this._prevRot = rotY;
    const turnRate = dt > 0 ? dRot / dt : 0;
    this.turnLean = lerp(this.turnLean ?? 0, Math.max(-0.12, Math.min(0.12, -turnRate * 0.035 * Math.min(1, speed / 1.5))), Math.min(1, dt * 6));
    // blinking
    this.blinkT = (this.blinkT ?? 1 + Math.random() * 3) - dt;
    if (this.blinkT <= 0) { this.blinkT = 2.2 + Math.random() * 4; this.blink = 0.13; }
    const wasBlink = this.blink > 0;
    if (this.blink > 0) this.blink -= dt;
    const showClosed = this.blink > 0 && this.expr !== 'closed';
    if (showClosed !== this._shownClosed) {
      this._shownClosed = showClosed;
      this.faceMat.map = faceTexture(this.faceSpec, showClosed ? 'closed' : this.expr);
      this.faceMat.needsUpdate = true;
    }
    void wasBlink;
    const stride = this.state === 'run' ? 1.1 : 0.72;
    this.phase += dt * (speed / stride) * Math.PI;
    if (this.state === 'scary') this.phase += dt * 6;
    const sc = Math.floor(this.phase / Math.PI);
    if (sc !== this.stepCount) { this.stepCount = sc; this.stepped = true; }
    const target = poseFor(this.state, this.t, this);
    const a = 1 - Math.exp(-dt * this.blendRate);
    for (const key in target) this.pose[key] = lerp(this.pose[key], target[key], a);
    const p = this.pose;
    const k = this.k;
    this.hips.position.y = 0.9 * k + p.bob - p.sitDrop;
    if (this.blob) this.blob.visible = this.root.position.y < 0.1 && this.state !== 'lie';
    this.hips.rotation.y = p.hipsY;
    this.hips.rotation.x = p.lean;
    this.torso.rotation.set(p.torsoX, -p.hipsY * 1.4, p.torsoZ + this.turnLean);
    this.head.rotation.set(p.headX + this.lookPitch, p.headY + this.lookYaw, p.headZ);
    this.armL.sh.rotation.set(p.uArmLX, p.uArmLY, p.uArmLZ);
    this.armR.sh.rotation.set(p.uArmRX, p.uArmRY, p.uArmRZ);
    this.armL.el.rotation.x = p.fArmLX; this.armR.el.rotation.x = p.fArmRX;
    this.legL.hip.rotation.x = -p.thighLX; this.legR.hip.rotation.x = -p.thighRX;
    this.legL.knee.rotation.x = p.shinLX; this.legR.knee.rotation.x = p.shinRX;
    if (this.carryMesh) {
      // carrying something in both arms: arms forward regardless of walking
      this.armL.sh.rotation.set(-0.85, 0, -0.28); this.armR.sh.rotation.set(-0.85, 0, 0.28);
      this.armL.el.rotation.x = -0.75; this.armR.el.rotation.x = -0.75;
    }
    if (this.skirt) {
      // the coat follows the legs and flutters with speed
      const avg = Math.min(-p.thighLX, -p.thighRX);
      const flap = Math.min(0.35, speed * 0.07) + Math.sin(this.t * 7) * Math.min(0.04, speed * 0.012);
      this.skirt.rotation.x = lerp(this.skirt.rotation.x, Math.min(0, avg) * 0.6 - flap * (this.state === 'sit' ? 0 : 1), Math.min(1, dt * 10));
      this.skirt.rotation.z = -this.turnLean * 0.8;
    }
  }

  /** world position of the eyes (for camera framing / gaze checks) */
  eyePos(out = new THREE.Vector3()) {
    this.head.updateWorldMatrix(true, false);
    return out.set(0, 0.15 * this.k, 0.1).applyMatrix4(this.head.matrixWorld);
  }

  /** world forward direction of the head */
  headDir(out = new THREE.Vector3()) {
    this.head.updateWorldMatrix(true, false);
    const q = new THREE.Quaternion();
    this.head.getWorldQuaternion(q);
    return out.set(0, 0, 1).applyQuaternion(q).setY(0).normalize();
  }
}

/* ---------------------------------------------------------------- nightmare figure */

/**
 * The pursuing figure. `reveal` (0..1) gradually shows familiar traits:
 * 0.2 long dark hair, 0.4 red knitted hat fragment, 0.6 nose ring glint, 0.8 face.
 */
export class NightmareFigure {
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.materials = [];
    this.t = 0;
    this.reveal = 0;
    this.state = 'idle';
    const mat = (o) => { const m = ps1Material(o); this.materials.push(m); return m; };
    const black = mat({ color: 0x07070a, flat: true });
    this.body = new THREE.Group();
    this.root.add(this.body);
    // jagged long cloth body
    const geo = new THREE.CylinderGeometry(0.16, 0.55, 2.0, 7, 5, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const j = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      pos.setX(i, pos.getX(i) * (1 + j * 0.25));
      pos.setZ(i, pos.getZ(i) * (1 + j * 0.25));
      if (y < -0.9) pos.setY(i, y - Math.abs(j) * 0.25);
    }
    geo.computeVertexNormals();
    geo.translate(0, 1.0, 0);
    this.cloth = new THREE.Mesh(geo, mat({ color: 0x09090c, side: THREE.DoubleSide, flat: true }));
    this.body.add(this.cloth);
    // shoulders / torso
    const tor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.6, 6), black);
    tor.position.y = 1.85; this.body.add(tor);
    // long thin arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * 0.24, 2.1, 0); this.body.add(sh);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06).translate(0, -0.52, 0), black);
      sh.add(arm);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.03).translate(0, -1.15, 0), mat({ color: 0x1a1a1f }));
      sh.add(hand);
      sh.rotation.z = side * 0.12;
      this.arms.push(sh);
    }
    // head
    this.head = new THREE.Group(); this.head.position.y = 2.2; this.body.add(this.head);
    const headM = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.27, 0.23).translate(0, 0.13, 0), black);
    this.head.add(headM);
    // face (hidden at first)
    this.faceSpec = {
      skin: '#8f8a86', skinDark: '#5f5a57', hair: spec.hair, brow: spec.brow, eye: '#111', lip: '#5b4040', lash: '#111',
      noseRing: true, lashes: true, hairline: 3,
    };
    this.faceMat = mat({ map: faceTexture(this.faceSpec, 'neutral'), transparent: true, opacity: 0 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), this.faceMat);
    face.position.set(0, 0.13, 0.117);
    this.head.add(face);
    // hair veil (long dark hair, covers face at low reveal)
    const hairM = mat({ map: hairTex('#0d0a0a', [1, 1], 2), side: THREE.DoubleSide });
    this.veil = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.04).translate(0, -0.25, 0), hairM);
    this.veil.position.set(0, 0.28, 0.13);
    this.head.add(this.veil);
    this.backHair = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.06).translate(0, -0.4, 0), hairM);
    this.backHair.position.set(0, 0.28, -0.13);
    this.head.add(this.backHair);
    // red hat fragment
    const hatGeo = new THREE.IcosahedronGeometry(0.16, 1); hatGeo.scale(1, 0.8, 1.15);
    this.hat = new THREE.Mesh(hatGeo, mat({ map: knitTex('#7a2018', [3, 2]) }));
    this.hat.position.set(0, 0.25, -0.04); this.hat.rotation.x = -0.35;
    this.head.add(this.hat);
    // nose ring glint
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 3, 6), mat({ color: 0xffeebb, unlit: true }));
    this.ring.position.set(0.018, 0.085, 0.14); this.ring.rotation.y = Math.PI / 2;
    this.head.add(this.ring);
    // hood (nightmare silhouette from the concept sheet)
    const hoodGeo = new THREE.CylinderGeometry(0.16, 0.26, 0.62, 7, 1, true, Math.PI * 0.22, Math.PI * 2 - Math.PI * 0.44);
    this.hood = new THREE.Mesh(hoodGeo, mat({ color: 0x0b0a0d, side: THREE.DoubleSide, flat: true }));
    this.hood.position.set(0, 0.05, -0.01);
    this.head.add(this.hood);
    // red glitch outline
    const outM = mat({ color: 0x9a1020, unlit: true, side: THREE.BackSide, transparent: true, opacity: 0.85 });
    this.outline = new THREE.Group();
    const o1 = new THREE.Mesh(geo, outM); o1.scale.set(1.07, 1.02, 1.07); this.outline.add(o1);
    const o2 = new THREE.Mesh(hoodGeo, outM); o2.position.set(0, 2.25, -0.01); o2.scale.setScalar(1.1); this.outline.add(o2);
    this.body.add(this.outline);
    // eyes glow (only when far)
    this.eyes = new THREE.Group();
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.012), mat({ color: 0xcfd6ff, unlit: true }));
      e.position.set(side * 0.05, 0.15, 0.155);
      this.eyes.add(e);
    }
    this.head.add(this.eyes);
    this.setReveal(0);
  }

  setReveal(r) {
    this.reveal = r;
    this.veil.visible = r < 0.85;
    this.veil.scale.y = r > 0.7 ? 0.55 : 1;
    this.veil.position.x = r > 0.7 ? 0.08 : 0;
    this.backHair.visible = r >= 0.2;
    this.hat.visible = r >= 0.4;
    this.hat.scale.setScalar(r >= 0.4 ? Math.min(1, 0.4 + (r - 0.4) * 1.5) : 0.01);
    this.ring.visible = r >= 0.6;
    this.faceMat.opacity = r >= 0.8 ? Math.min(1, (r - 0.8) * 5) : 0;
    this.eyes.visible = r < 0.8;
    this.hood.visible = r < 0.8;
    this.outlineAmt = 1 - r * 0.6;
  }

  setGlitch(v) { for (const m of this.materials) m.userData.uGlitch.value = v; }
  setOpacity(v) { for (const m of this.materials) { m.transparent = true; m.opacity = m === this.faceMat ? Math.min(m.opacity, v) : v; } }

  update(dt, speed = 0) {
    this.t += dt;
    const t = this.t;
    this.body.position.y = Math.sin(t * 1.3) * 0.05;
    this.body.rotation.z = Math.sin(t * 0.7) * 0.03;
    const sway = this.state === 'attack' ? -1.4 : this.state === 'block' ? -1.2 : Math.sin(t * 0.9) * 0.06;
    this.arms[0].rotation.x = lerp(this.arms[0].rotation.x, sway, 0.2);
    this.arms[1].rotation.x = lerp(this.arms[1].rotation.x, this.state === 'block' ? -1.2 : -sway * (this.state === 'attack' ? 0 : 1), 0.2);
    this.head.rotation.z = Math.sin(t * 0.5) * 0.12 + (Math.random() < 0.01 ? (Math.random() - 0.5) * 0.6 : 0);
    this.head.rotation.x = 0.15;
    this.cloth.rotation.y = Math.sin(t * 0.8) * 0.1 + speed * 0.02;
    this.outline.visible = Math.random() < 0.45 * (this.outlineAmt ?? 1);
    this.outline.rotation.y = this.cloth.rotation.y;
    this.outline.position.x = (Math.random() - 0.5) * 0.06;
  }
}
