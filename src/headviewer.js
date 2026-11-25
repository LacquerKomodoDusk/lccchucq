// Character model viewer: loads the exported GLB files (real 3D models with
// UVs, atlas texture, skeleton and animations) for review.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const EXPR = [['neutral', 'Нейтр.'], ['surprise', 'Удивление'], ['anxiety', 'Тревога'], ['tired', 'Усталость'], ['sad', 'Грусть'], ['joy', 'Радость']];
const CHARS = [
  { id: 'hero', name: 'Герой', ready: true, faces: EXPR },
  { id: 'wife', name: 'Жена', ready: true, faces: [...EXPR, ['look_left', 'Взгляд влево'], ['look_right', 'Взгляд вправо']] },
  { id: 'son_older', name: 'Старший сын', ready: true, faces: EXPR },
  { id: 'son_younger', name: 'Младший сын', ready: true, faces: EXPR },
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
camera.position.set(0, 1.68, 1.1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.68, 0);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xb8b0c8, 0x201a18, 0.75));
const key = new THREE.DirectionalLight(0xffe0c0, 2.4); key.position.set(-1.6, 2.2, 2.6); scene.add(key);
const rim = new THREE.DirectionalLight(0x8090c0, 0.6); rim.position.set(-2, 2, -2); scene.add(rim);
const floor = null && new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshLambertMaterial({ color: 0x2c2632 }));



const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
let texWait = null;
let focus = new THREE.Vector3(0, 1.66, 0), viewDist = 1.05, lastView = 'front', hatOn = true;
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
  const base = `./heads/${c.id}/`;
  loader.load(base + 'head.glb', (gltf) => {
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
    // frame on the head mesh itself (long hair / collars would skew the box)
    let headMesh = null;
    current.traverse((o) => { if (o.isMesh && !/hat/.test(o.name) && (!headMesh || o.geometry.attributes.position.count > headMesh.geometry.attributes.position.count)) headMesh = o; });
    const bb = new THREE.Box3();
    headMesh.geometry.computeBoundingBox();
    const hb = headMesh.geometry.boundingBox;
    bb.copy(hb);
    const skinned = headMesh.isSkinnedMesh;
    focus = bb.getCenter(new THREE.Vector3());
    // the skeleton keeps the head at its real height: use the head bone if there is one
    let headBone = null; current.traverse((o) => { if (o.isBone && o.name === 'head') headBone = o; });
    if (headBone) { const wp = new THREE.Vector3(); headBone.getWorldPosition(wp); focus.set(0, wp.y + 0.11 * (bb.max.x - bb.min.x) / 0.26, 0); }
    viewDist = 0.95 * Math.max(0.6, (bb.max.x - bb.min.x) / 0.3);
    void skinned;
    setView(lastView);
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
    $('#atlas').src = base + 'face_atlas.png';
    $('#uv').src = base + 'face_uv.png';
    window.__viewerReady = true;
  });
  window.__setFace = (id) => { $('#face').value = id; $('#face').onchange({ target: { value: id } }); };
  $('#face').onchange = (e) => {
    const id = e.target.value;
    const file = id === 'neutral' ? 'face_atlas.png' : `face_atlas_${id}.png`;
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
window.__toggleHat = (on) => { hatOn = on ?? !hatOn; current?.traverse((o) => { if (o.isMesh && /hat/.test(o.name)) o.visible = hatOn; }); const b = document.querySelector('#hat'); if (b) b.classList.toggle('on', hatOn); };
document.querySelector('#hat')?.addEventListener('click', () => window.__toggleHat());
$('#spin').addEventListener('click', (e) => { spin = !spin; e.target.classList.toggle('on', spin); });
$('#showuv').addEventListener('change', (e) => { $('#uv').style.display = e.target.checked ? '' : 'none'; });
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
function setView(v) {
  lastView = v;
  const d = viewDist, y = focus.y + 0.03;
  const pos = { front: [0, y, d], side: [d, y, 0], back: [0, y, -d], three_quarter: [d * 0.72, y + 0.02, d * 0.72] }[v];
  camera.position.set(pos[0] + focus.x, pos[1], pos[2] + focus.z); controls.target.copy(focus); controls.update();
}

function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  if (mixer && playing) mixer.update(dt);
  if (spin && current) current.rotation.y += dt * 0.6;
  if (texWait) texWait();
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
