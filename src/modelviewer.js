// Character model viewer: loads the exported GLB files (real 3D models with
// UVs, atlas texture, skeleton and animations) for review.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const CHARS = [
  {
    id: 'hero', name: 'Герой', ready: true,
    faces: [['neutral', 'Нейтр.'], ['anxious', 'Тревога'], ['pain', 'Боль'], ['tired', 'Усталость'], ['resolve', 'Решимость'],
      ['young_neutral', 'Молодой: нейтр.'], ['young_anxious', 'Молодой: тревога'], ['young_pain', 'Молодой: боль'], ['young_tired', 'Молодой: усталость'], ['young_resolve', 'Молодой: решимость']],
  },
  { id: 'wife', name: 'Жена', ready: false },
  { id: 'wife_nightmare', name: 'Жена (кошмар)', ready: false },
  { id: 'son_older', name: 'Старший сын', ready: false },
  { id: 'son_younger', name: 'Младший сын', ready: false },
];

const $ = (s) => document.querySelector(s);
const view = $('#view');
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1922);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
camera.position.set(0, 1.25, 4.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xd8d0e0, 0x2a2420, 1.1));
const key = new THREE.DirectionalLight(0xfff0dc, 1.6); key.position.set(1.5, 3, 2.5); scene.add(key);
const rim = new THREE.DirectionalLight(0x8090c0, 0.6); rim.position.set(-2, 2, -2); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshLambertMaterial({ color: 0x2c2632 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const grid = new THREE.GridHelper(2.4, 12, 0x4a4250, 0x342e3a); grid.position.y = 0.002; scene.add(grid);

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
let current = null, mixer = null, actions = {}, active = null, playing = true, wire = false, helper = null, spin = false;
const clock = new THREE.Clock();

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  // a low internal resolution keeps the PS1 pixel look
  const scale = Math.min(1, 540 / h);
  renderer.setSize(Math.round(w * scale), Math.round(h * scale), false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function buildCharButtons() {
  const row = $('#chars');
  for (const c of CHARS) {
    const b = document.createElement('button');
    b.textContent = c.name;
    b.disabled = !c.ready;
    b.title = c.ready ? '' : 'Будет после утверждения героя';
    b.addEventListener('click', () => load(c));
    b.dataset.id = c.id;
    row.appendChild(b);
  }
}

function load(c) {
  document.querySelectorAll('#chars button').forEach((b) => b.classList.toggle('on', b.dataset.id === c.id));
  const base = `./models/${c.id}/`;
  loader.load(base + `${c.id}.glb`, (gltf) => {
    if (current) scene.remove(current);
    if (helper) { scene.remove(helper); helper = null; }
    current = gltf.scene;
    let tris = 0, mats = new Set();
    current.traverse((o) => {
      if (o.isMesh) {
        tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        const m = o.material;
        m.flatShading = true; m.needsUpdate = true;
        if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; m.map.needsUpdate = true; }
        mats.add(m);
        o.userData.baseMat = m;
      }
    });
    scene.add(current);
    let bones = 0; current.traverse((o) => { if (o.isBone) bones++; });
    $('#stats').innerHTML = `${c.name}<br>треугольников: ${Math.round(tris)}<br>костей: ${bones}<br>анимаций: ${gltf.animations.length}`;
    mixer = new THREE.AnimationMixer(current);
    actions = {};
    const sel = $('#anim'); sel.innerHTML = '';
    for (const clip of gltf.animations) {
      actions[clip.name] = mixer.clipAction(clip);
      const o = document.createElement('option'); o.value = clip.name; o.textContent = clip.name; sel.appendChild(o);
    }
    const first = actions.idle ? 'idle' : gltf.animations[0]?.name;
    if (first) { sel.value = first; playClip(first); }
    // faces
    const fs = $('#face'); fs.innerHTML = '';
    for (const [id, label] of c.faces || [['neutral', 'Нейтр.']]) { const o = document.createElement('option'); o.value = id; o.textContent = label; fs.appendChild(o); }
    $('#atlas').src = base + `${c.id}_atlas.png`;
    $('#uv').src = base + `${c.id}_uv.png`;
    window.__viewerReady = true;
  });
  $('#face').onchange = (e) => {
    const id = e.target.value;
    const file = id === 'neutral' ? `${c.id}_atlas.png` : `${c.id}_atlas_${id}.png`;
    texLoader.load(base + file, (t) => {
      t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      current.traverse((o) => { if (o.isMesh && o.material.map) { o.material.map = t; o.material.needsUpdate = true; } });
      $('#atlas').src = base + file;
    });
  };
}

function playClip(name) {
  if (active) active.fadeOut(0.2);
  active = actions[name];
  active.reset().fadeIn(0.2).play();
}

$('#anim').addEventListener('change', (e) => playClip(e.target.value));
$('#play').addEventListener('click', (e) => { playing = !playing; e.target.textContent = playing ? 'Пауза' : 'Играть'; });
$('#wire').addEventListener('click', (e) => {
  wire = !wire; e.target.classList.toggle('on', wire);
  current?.traverse((o) => { if (o.isMesh) o.material.wireframe = wire; });
});
$('#bones').addEventListener('click', (e) => {
  if (helper) { scene.remove(helper); helper = null; e.target.classList.remove('on'); return; }
  helper = new THREE.SkeletonHelper(current); scene.add(helper); e.target.classList.add('on');
});
$('#spin').addEventListener('click', (e) => { spin = !spin; e.target.classList.toggle('on', spin); });
$('#showuv').addEventListener('change', (e) => { $('#uv').style.display = e.target.checked ? '' : 'none'; });
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
function setView(v) {
  const d = 4.2;
  const pos = { front: [0, 1.15, d], side: [d, 1.15, 0], back: [0, 1.15, -d] }[v];
  camera.position.set(...pos); controls.target.set(0, 0.95, 0); controls.update();
}

function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  if (mixer && playing) mixer.update(dt);
  if (spin && current) current.rotation.y += dt * 0.6;
  controls.update();
  renderer.render(scene, camera);
}

buildCharButtons();
resize();
const params = new URLSearchParams(location.search);
load(CHARS.find((c) => c.id === (params.get('char') || 'hero')) || CHARS[0]);
if (params.get('view')) setView(params.get('view'));
if (params.get('anim')) {
  const want = params.get('anim');
  const wait = setInterval(() => { if (actions[want]) { clearInterval(wait); $('#anim').value = want; playClip(want); } }, 100);
}
window.__viewer = { setView, playClip, get actions() { return actions; }, get mixer() { return mixer; }, set playing(v) { playing = v; } };
frame();
