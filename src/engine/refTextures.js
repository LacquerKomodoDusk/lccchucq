// Textures taken directly from the author's character sheet (src/assets):
// faces for each expression and fabric swatches from the texture atlases.
import * as THREE from 'three';

const FACES = import.meta.glob('../assets/faces/*.png', { eager: true, query: '?url', import: 'default' });
const FABRICS = import.meta.glob('../assets/fabric/*.png', { eager: true, query: '?url', import: 'default' });

function urlOf(name) {
  const all = { ...FACES, ...FABRICS };
  const key = Object.keys(all).find((k) => k.endsWith(`/${name}.png`));
  return key ? all[key] : null;
}

const cache = new Map();
const pending = new Map(); // base texture -> clones waiting for the image (kept outside userData, which clone() deep-copies)

/**
 * Load a sheet texture. opts: repeat, tears (draw tear streaks), pale (nightmare look)
 * Returns immediately with a placeholder; the image appears once loaded.
 */
export function refTexture(name, { repeat = [1, 1], tears = false, pale = false } = {}) {
  const key = `${name}|${tears}|${pale}`;
  let base = cache.get(key);
  if (!base) {
    const url = urlOf(name);
    const ph = document.createElement('canvas'); ph.width = ph.height = 2;
    const pg = ph.getContext('2d'); pg.fillStyle = '#b88a70'; pg.fillRect(0, 0, 2, 2);
    base = new THREE.Texture(ph);
    base.magFilter = THREE.NearestFilter; base.minFilter = THREE.NearestFilter; base.generateMipmaps = false;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.colorSpace = THREE.SRGBColorSpace;
    base.needsUpdate = true;
    pending.set(base, []);
    if (url) {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0);
        if (pale) {
          const d = g.getImageData(0, 0, c.width, c.height);
          for (let i = 0; i < d.data.length; i += 4) {
            const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
            const v = Math.min(255, l * 0.85 + 60);
            d.data[i] = v * 0.95; d.data[i + 1] = v * 0.93; d.data[i + 2] = v;
          }
          g.putImageData(d, 0, 0);
        }
        if (tears) {
          // tear streaks under both eyes (eyes sit at ~36% of the crop height)
          const w = c.width, h = c.height;
          g.fillStyle = 'rgba(175,210,235,0.85)';
          for (const ex of [0.33, 0.64]) { g.fillRect(Math.round(w * ex), Math.round(h * 0.42), 2, Math.round(h * 0.2)); }
          g.fillStyle = 'rgba(230,245,255,0.9)';
          for (const ex of [0.33, 0.64]) g.fillRect(Math.round(w * ex), Math.round(h * 0.6), 2, 2);
        }
        // the GPU copy was allocated for the 2x2 placeholder: drop it so it is re-created at full size
        base.dispose(); base.image = c; base.needsUpdate = true;
        for (const t of pending.get(base) || []) { t.dispose(); t.image = c; t.needsUpdate = true; }
        pending.delete(base);
      };
      img.src = url;
    }
    cache.set(key, base);
  }
  const t = base.clone();
  t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  if (pending.has(base)) pending.get(base).push(t);
  return t;
}

/** expression → [image name, tears?] for each character */
const SETS = {
  hero: { neutral: 'hero_neutral', smile: 'hero_neutral', joy: 'hero_neutral', happycry: ['hero_neutral', true], fear: 'hero_anxious', anxious: 'hero_anxious', sad: 'hero_pain', cry: ['hero_pain', true], pain: 'hero_pain', angry: 'hero_resolve', scary: 'hero_resolve', tired: 'hero_tired', closed: 'hero_tired' },
  wife: { neutral: 'wife_neutral', smile: 'wife_smile', joy: 'wife_joy', happycry: ['wife_smile', true], sad: 'wife_sad', cry: 'wife_cry', fear: 'wife_cry', angry: 'wife_sad', scary: 'wife_sad', tired: 'wife_sad', closed: 'wife_sad' },
  kid1: { neutral: 'kid1', cry: ['kid1', true], happycry: ['kid1', true] },
  kid2: { neutral: 'kid2', cry: ['kid2', true], happycry: ['kid2', true] },
};
SETS.heroYoung = Object.fromEntries(Object.entries(SETS.hero).map(([k, v]) => [k, Array.isArray(v) ? [v[0].replace('hero_', 'hero_young_'), v[1]] : v.replace('hero_', 'hero_young_')]));

export function hasFaceSet(set) { return !!SETS[set]; }
export function faceSetTexture(set, expr) {
  const s = SETS[set];
  const e = s[expr] ?? s.neutral;
  const [name, tears] = Array.isArray(e) ? e : [e, false];
  return refTexture(name, { tears });
}
