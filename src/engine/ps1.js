// PS1-style rendering: vertex snapping, low internal resolution, 15-bit color + dithering,
// CRT / VHS post-processing.
import * as THREE from 'three';

export const globalUniforms = {
  uTime: { value: 0 },
  uSnapRes: { value: new THREE.Vector2(320, 240) },
  uWarp: { value: 0 }, // world distortion (anxiety, nightmare)
};

const VERT_HEAD = /* glsl */ `
uniform float uTime;
uniform vec2 uSnapRes;
uniform float uWarp;
uniform float uGlitch;
uniform float uLocalWarp;
float tlmHash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
`;

const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
{
  float w = uWarp * uLocalWarp;
  if (w > 0.0) {
    vec4 wp = modelMatrix * vec4(transformed, 1.0);
    transformed.x += sin(wp.y * 1.7 + uTime * 1.1 + wp.z * 0.3) * w * 0.12;
    transformed.y += sin(wp.x * 1.3 + uTime * 0.8) * w * 0.06;
    transformed.z += cos(wp.y * 1.5 + uTime * 0.9 + wp.x * 0.2) * w * 0.12;
  }
  if (uGlitch > 0.0) {
    float step_t = floor(uTime * 14.0);
    vec3 cell = floor(position * 7.0);
    float h = tlmHash(cell + step_t);
    float h2 = tlmHash(cell * 1.7 + step_t * 0.37);
    float amt = uGlitch * uGlitch;
    transformed += normalize(position + vec3(0.0001)) * (h - 0.35) * amt * 0.9;
    transformed.y += (h2 - 0.5) * amt * 0.5;
    if (h2 > 1.0 - amt * 0.35) transformed.x += (h - 0.5) * 2.0 * amt;
  }
}
`;

const VERT_PROJECT = /* glsl */ `
#include <project_vertex>
{
  vec2 sr = uSnapRes * 0.5;
  vec4 p = gl_Position;
  p.xy = floor(p.xy / p.w * sr + 0.5) / sr * p.w;
  gl_Position = p;
}
`;

/**
 * Create a PS1-style material.
 * opts: color, map, emissive, emissiveIntensity, unlit, transparent, opacity, side, glitch, warp(0..1 local factor), vertexColors, depthWrite
 */
export function ps1Material(opts = {}) {
  const params = {
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: !!opts.vertexColors,
    fog: opts.fog ?? true,
  };
  if (opts.depthWrite !== undefined) params.depthWrite = opts.depthWrite;
  if (opts.alphaTest !== undefined) params.alphaTest = opts.alphaTest;
  let mat;
  if (opts.unlit) {
    mat = new THREE.MeshBasicMaterial(params);
  } else {
    mat = new THREE.MeshLambertMaterial({ ...params, flatShading: opts.flat ?? false });
    if (opts.emissive !== undefined) {
      mat.emissive = new THREE.Color(opts.emissive);
      mat.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
  }
  const uGlitch = { value: 0 };
  const uLocalWarp = { value: opts.warp ?? 1 };
  mat.userData.uGlitch = uGlitch;
  mat.userData.uLocalWarp = uLocalWarp;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.uniforms.uSnapRes = globalUniforms.uSnapRes;
    shader.uniforms.uWarp = globalUniforms.uWarp;
    shader.uniforms.uGlitch = uGlitch;
    shader.uniforms.uLocalWarp = uLocalWarp;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', VERT_BEGIN)
      .replace('#include <project_vertex>', VERT_PROJECT);
  };
  return mat;
}

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform vec2 uScreen;
uniform float uTime;
uniform float uCRT;
uniform float uDistort;
uniform float uFade;
uniform float uWhite;
uniform float uSat;
uniform vec3 uTint;
uniform float uNoise;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float bayer(vec2 p){
  int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  float v = 0.0;
  for (int k = 0; k < 16; k++) { if (k == i) v = m[k]; }
  return v / 16.0 - 0.5;
}
vec2 curve(vec2 uv){
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(7.0, 5.5);
  uv = uv + uv * off * off * uCRT;
  return uv * 0.5 + 0.5;
}
void main(){
  vec2 uv = curve(vUv);
  // VHS line jitter
  float line = floor(uv.y * uRes.y);
  float jit = (hash(vec2(line, floor(uTime * 24.0))) - 0.5) * 0.004 * (uCRT * 0.6 + uDistort * 6.0);
  float band = step(0.985 - uDistort * 0.08, hash(vec2(floor(uTime * 7.0), floor(uv.y * 18.0))));
  jit += band * (hash(vec2(line, uTime)) - 0.5) * 0.04 * (0.2 + uDistort);
  uv.x += jit;
  float ca = (0.0012 * uCRT + uDistort * 0.008);
  vec3 col;
  col.r = texture2D(tDiffuse, uv + vec2(ca, 0.0)).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - vec2(ca, 0.0)).b;

  // linear -> sRGB (render target holds linear values)
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

  // saturation & tint
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat) * uTint;

  // 15-bit color with ordered dithering (in low-res pixel space)
  vec2 px = floor(uv * uRes);
  col += bayer(px) * (1.0 / 24.0);
  col = floor(col * 31.0 + 0.5) / 31.0;

  // noise
  col += (hash(px + fract(uTime) * 100.0) - 0.5) * uNoise;

  // scanlines + vignette
  float scan = 0.88 + 0.12 * sin(vUv.y * uScreen.y * 3.14159 * 0.5);
  col *= mix(1.0, scan, uCRT);
  vec2 vv = vUv * (1.0 - vUv.yx);
  float vig = pow(vv.x * vv.y * 16.0, 0.22);
  col *= mix(1.0, vig, 0.45 * uCRT + 0.2);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);

  col = mix(col, vec3(1.0), uWhite);
  col = mix(col, vec3(0.0), uFade);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class PS1Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.lowH = 480;
    this.target = new THREE.WebGLRenderTarget(320, 240, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.post = {
      tDiffuse: { value: this.target.texture },
      uRes: { value: new THREE.Vector2(320, 240) },
      uScreen: { value: new THREE.Vector2(1, 1) },
      uTime: globalUniforms.uTime,
      uCRT: { value: 1 },
      uDistort: { value: 0 },
      uFade: { value: 0 },
      uWhite: { value: 0 },
      uSat: { value: 0.85 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uNoise: { value: 0.03 },
    };
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: this.post, vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false })
    );
    this.postScene.add(quad);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  setCRT(on) { this.post.uCRT.value = on ? 1 : 0; }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h, false);
    const lh = this.lowH;
    const lw = Math.round(lh * (w / h));
    this.target.setSize(lw, lh);
    this.post.uRes.value.set(lw, lh);
    this.post.uScreen.value.set(w, h);
    globalUniforms.uSnapRes.value.set(lw * 0.5, lh * 0.5);
    this.aspect = w / h;
    if (this.onResize) this.onResize(this.aspect);
  }
  render(scene, camera) {
    this.gl.setRenderTarget(this.target);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCam);
  }
}
