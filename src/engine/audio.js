// Procedural audio: original music (piano theme + orchestra), ambience and SFX,
// all synthesized with the Web Audio API — no audio files.

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function midi(n) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
  return 12 * (parseInt(m[2]) + 1) + NOTE[m[1]];
}
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ----------------------------------------------------------------------------
 * THE THEME — «Последнее воспоминание» (original melody)
 * B minor / D major, 72 bpm. Progression: Bm – G – D – A
 * -------------------------------------------------------------------------- */
const THEME = [
  // [note, beats]   (null = rest)
  ['F#5', 2], ['E5', 1], ['D5', 1],
  ['D5', 1.5], ['B4', 0.5], ['B4', 2],
  ['A4', 1], ['D5', 1], ['F#5', 1], ['A5', 1],
  ['G5', 2], ['F#5', 1], ['E5', 1],
  ['F#5', 2], ['E5', 1], ['D5', 1],
  ['B4', 1.5], ['D5', 0.5], ['E5', 2],
  ['D5', 1], ['C#5', 1], ['B4', 1], ['A4', 1],
  ['C#5', 3], [null, 1],
];
const CHORDS = [
  ['B2', 'F#3', 'B3', 'D4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['A2', 'E3', 'A3', 'C#4'],
  ['B2', 'F#3', 'B3', 'D4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['A2', 'E3', 'A3', 'C#4'],
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.8;
    this.sfxVol = 0.9;
    this.track = null;
    this.loops = new Map();
    this.intensity = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.8; this.amb.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.4, 2.6);
    this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.seqTimer = setInterval(() => this.tick(), 30);
  }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.music.gain.value = music; this.sfx.gain.value = sfx; this.amb.gain.value = 0.8 * sfx;
  }

  impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }
  makeNoise(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  out(node, dest, wet = 0.3) {
    node.connect(dest);
    if (wet > 0) { const g = this.ctx.createGain(); g.gain.value = wet; node.connect(g).connect(this.reverb); }
  }

  /* ------------------------------------------------------------ instruments */

  piano(m, t, { vel = 0.5, dur = 3, dest = this.music, detune = 0, wet = 0.45 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const f = freq(m) * Math.pow(2, detune / 1200);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + dur);
    const decay = dur * (m < 60 ? 1.3 : 1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.22, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vel * 0.08, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const partials = [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine'], [4.02, 0.05, 'sine']];
    for (const [mul, amp, type] of partials) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(t); o.stop(t + decay + 0.1);
    }
    lp.connect(g);
    this.out(g, dest, wet);
  }

  strings(notes, t, dur, { vel = 0.4, attack = 1.2, dest = this.music, bright = 1400 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.06, t + attack);
    g.gain.setValueAtTime(vel * 0.06, t + Math.max(attack, dur - 0.8));
    g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const lfoG = ctx.createGain(); lfoG.gain.value = 4;
    lfo.connect(lfoG); lfo.start(t); lfo.stop(t + dur + 0.8);
    for (const n of notes) {
      for (const dt of [-8, 0, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = freq(typeof n === 'string' ? midi(n) : n); o.detune.value = dt;
        lfoG.connect(o.detune);
        o.connect(lp); o.start(t); o.stop(t + dur + 0.8);
      }
    }
    lp.connect(g);
    this.out(g, dest, 0.5);
  }

  brass(notes, t, dur, { vel = 0.4, dest = this.music } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.07, t + 0.25);
    g.gain.linearRampToValueAtTime(vel * 0.05, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(350, t);
    lp.frequency.linearRampToValueAtTime(2200, t + 0.35);
    lp.frequency.linearRampToValueAtTime(900, t + dur);
    for (const n of notes) {
      for (const dt of [-5, 5]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = freq(typeof n === 'string' ? midi(n) : n); o.detune.value = dt;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
      }
    }
    lp.connect(g);
    this.out(g, dest, 0.45);
  }

  choir(notes, t, dur, { vel = 0.35, dest = this.music } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.05, t + 1.5);
    g.gain.linearRampToValueAtTime(0, t + dur + 1);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 750; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 5;
    for (const n of notes) {
      for (const dt of [-12, 0, 11]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = freq(typeof n === 'string' ? midi(n) : n); o.detune.value = dt;
        o.connect(f1); o.connect(f2); o.start(t); o.stop(t + dur + 1.2);
      }
    }
    f1.connect(g); f2.connect(g);
    this.out(g, dest, 0.7);
  }

  timpani(m, t, { vel = 0.6, dest = this.music } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq(m) * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(freq(m), t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(g); o.start(t); o.stop(t + 1.7);
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 300;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(vel * 0.25, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    n.connect(nf).connect(ng); n.start(t); n.stop(t + 0.35);
    this.out(g, dest, 0.4); this.out(ng, dest, 0.3);
  }

  bass(m, t, dur, { vel = 0.5, dest = this.music } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.18, t + 0.08);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    this.out(g, dest, 0.15);
  }

  drone(notes, { vel = 0.4, dest = this.music, cutoff = 400 } = {}) {
    const ctx = this.ctx; if (!ctx) return { stop() {} };
    const t = this.now;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.08, t + 3);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 3;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = cutoff * 0.6;
    lfo.connect(lg).connect(lp.frequency); lfo.start();
    const oscs = [lfo];
    for (const n of notes) for (const dt of [-9, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq(midi(n)); o.detune.value = dt;
      o.connect(lp); o.start(); oscs.push(o);
    }
    lp.connect(g); this.out(g, dest, 0.6);
    return {
      stop: (fade = 2) => {
        const n = this.now; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + fade);
        oscs.forEach((o) => o.stop(n + fade + 0.1));
      },
    };
  }

  /* ------------------------------------------------------------ music tracks */

  playMusic(name, { fade = 2, intensity = 0 } = {}) {
    if (!this.ctx) return;
    if (this.track && this.track.name === name) return;
    this.stopMusic(fade);
    this.intensity = intensity;
    const bus = this.ctx.createGain(); bus.connect(this.music);
    bus.gain.setValueAtTime(0.0001, this.now); bus.gain.exponentialRampToValueAtTime(1, this.now + Math.max(0.05, fade));
    const tr = { name, bus, next: this.now + 0.15, step: 0, bar: 0, extras: [] };
    this.track = tr;
    const builder = this['_' + name];
    if (builder) builder.call(this, tr);
  }

  stopMusic(fade = 2) {
    const tr = this.track; if (!tr) return;
    this.track = null;
    const n = this.now;
    tr.bus.gain.cancelScheduledValues(n);
    tr.bus.gain.setValueAtTime(Math.max(0.0001, tr.bus.gain.value), n);
    tr.bus.gain.exponentialRampToValueAtTime(0.0001, n + Math.max(0.05, fade));
    tr.extras.forEach((e) => e.stop(fade));
    setTimeout(() => tr.bus.disconnect(), (fade + 4) * 1000);
  }

  setIntensity(v) { this.intensity = v; }

  tick() {
    const tr = this.track; if (!tr || !tr.schedule) return;
    const horizon = this.now + 0.25;
    let guard = 0;
    while (tr.next < horizon && guard++ < 64) tr.schedule(tr);
  }

  // gentle piano theme (bus memory / main motif)
  _theme(tr, { bpm = 70, warm = false } = {}) {
    const beat = 60 / bpm;
    let mel = 0, melT = 0;
    tr.schedule = (tr) => {
      // one bar per call
      const t0 = tr.next;
      const bar = tr.bar % 8;
      const chord = CHORDS[bar].map(midi);
      const lvl = this.intensity;
      // left hand arpeggio (eighths)
      const arp = [chord[0], chord[1], chord[2], chord[3], chord[2], chord[1], chord[2], chord[3]];
      arp.forEach((m, i) => this.piano(m, t0 + i * beat * 0.5, { vel: (i === 0 ? 0.42 : 0.26) * (warm ? 1.05 : 1), dur: 2.2, dest: tr.bus }));
      // melody
      let acc = 0;
      while (acc < 4) {
        const [n, b] = THEME[mel % THEME.length];
        if (n) this.piano(midi(n), t0 + acc * beat, { vel: 0.5, dur: Math.max(1.6, b * beat * 1.6), dest: tr.bus });
        if (n && lvl >= 2) this.strings([midi(n) - 12, midi(n)], t0 + acc * beat, b * beat, { vel: 0.5, attack: 0.15, dest: tr.bus, bright: 2600 });
        acc += b; mel++;
      }
      // orchestral layers by intensity (finale)
      if (lvl >= 1) this.strings([chord[0] + 12, chord[1] + 12, chord[3] + 12], t0, beat * 4, { vel: lvl >= 2 ? 0.9 : 0.55, attack: lvl >= 2 ? 0.4 : 1.6, dest: tr.bus });
      if (lvl >= 1) this.bass(chord[0] - 12, t0, beat * 4, { vel: 0.6, dest: tr.bus });
      if (lvl >= 2) {
        this.brass([chord[1], chord[2], chord[3]], t0, beat * 3.6, { vel: lvl >= 3 ? 0.9 : 0.6, dest: tr.bus });
        this.timpani(chord[0] - 12, t0, { vel: 0.5, dest: tr.bus });
        if (bar % 2 === 1) this.timpani(chord[0] - 12, t0 + beat * 3.5, { vel: 0.3, dest: tr.bus });
      }
      if (lvl >= 3) {
        this.choir([chord[1] + 12, chord[2] + 12, chord[3] + 12], t0, beat * 4, { vel: 0.7, dest: tr.bus });
        this.timpani(chord[0] - 12, t0 + beat * 2, { vel: 0.4, dest: tr.bus });
      }
      tr.bar++;
      tr.next = t0 + beat * 4;
    };
  }
  _warm(tr) { this._theme(tr, { bpm: 76, warm: true }); }
  _finale(tr) { this._theme(tr, { bpm: 66 }); }

  // nightmare: low drone + fragments of the theme, detuned and far away
  _nightmare(tr) {
    tr.extras.push(this.drone(['D1', 'G#1', 'D2'], { vel: 0.7, dest: tr.bus, cutoff: 320 }));
    const beat = 60 / 50;
    let i = 0;
    tr.schedule = (tr) => {
      const t0 = tr.next;
      if (Math.random() < 0.55) {
        const [n] = THEME[(i * 3) % THEME.length];
        if (n) this.piano(midi(n) - 12, t0, { vel: 0.32, dur: 5, dest: tr.bus, detune: -35 + Math.random() * 20, wet: 0.9 });
      }
      if (Math.random() < 0.18) this.piano(midi('C2') + Math.floor(Math.random() * 3), t0 + beat * 0.5, { vel: 0.5, dur: 6, dest: tr.bus, wet: 0.9 });
      if (Math.random() < 0.15) this.scrape(t0 + Math.random() * beat * 2, tr.bus);
      i++;
      tr.next = t0 + beat * 2;
    };
  }

  // anxiety: heartbeat, irregular clock, thin tinnitus
  _anxiety(tr) {
    tr.extras.push(this.drone(['A1', 'A#1'], { vel: 0.5, dest: tr.bus, cutoff: 260 }));
    const tone = this.ctx.createOscillator(); tone.frequency.value = 6100; tone.type = 'sine';
    const tg = this.ctx.createGain(); tg.gain.value = 0.004; tone.connect(tg).connect(tr.bus); tone.start();
    tr.extras.push({ stop: (f) => tone.stop(this.now + f) });
    let k = 0;
    tr.schedule = (tr) => {
      const t0 = tr.next;
      const rate = 0.85 - Math.min(0.35, this.intensity * 0.12);
      this.heartbeat(t0, tr.bus, 0.6);
      for (let j = 0; j < 2; j++) if (Math.random() < 0.8) this.tickSound(t0 + j * rate * 0.5 + Math.random() * 0.05, tr.bus);
      if (k % 6 === 5) { const [n] = THEME[(k * 5) % THEME.length]; if (n) this.piano(midi(n) - 12, t0, { vel: 0.25, dur: 4, dest: tr.bus, detune: -50, wet: 0.95 }); }
      k++;
      tr.next = t0 + rate;
    };
  }

  // battle: ostinato strings in B minor, drums, stabs
  _battle(tr) {
    const beat = 60 / 112;
    const roots = ['B1', 'B1', 'G1', 'A1'];
    tr.schedule = (tr) => {
      const t0 = tr.next;
      const r = midi(roots[tr.bar % 4]);
      for (let i = 0; i < 8; i++) this.strings([r + 12, r + 19], t0 + i * beat * 0.5, beat * 0.42, { vel: 0.9, attack: 0.02, dest: tr.bus, bright: 900 });
      this.timpani(r, t0, { vel: 0.7, dest: tr.bus });
      this.timpani(r, t0 + beat * 1.5, { vel: 0.4, dest: tr.bus });
      this.timpani(r, t0 + beat * 2, { vel: 0.6, dest: tr.bus });
      if (tr.bar % 2 === 1) this.brass([r + 24, r + 27, r + 31], t0 + beat * 3, beat * 0.9, { vel: 0.8, dest: tr.bus });
      // mirror piano: theme fragment, reversed order, bitter
      const [n] = THEME[(THEME.length - 1 - (tr.bar % THEME.length))];
      if (n) this.piano(midi(n) - 12, t0 + beat * 2, { vel: 0.35, dur: 3, dest: tr.bus, detune: -20 });
      tr.bar++;
      tr.next = t0 + beat * 4;
    };
  }

  // quiet sad piano chords only (inner struggle / tension in family chapters)
  _sparse(tr) {
    const beat = 60 / 58;
    const prog = [['B2', 'F#3', 'D4'], ['G2', 'D3', 'B3'], ['E2', 'B2', 'G3'], ['F#2', 'C#3', 'A#3']];
    tr.schedule = (tr) => {
      const t0 = tr.next;
      const c = prog[tr.bar % 4].map(midi);
      c.forEach((m, i) => this.piano(m, t0 + i * 0.04, { vel: 0.32, dur: 5, dest: tr.bus }));
      if (tr.bar % 2 === 0) { const [n] = THEME[(tr.bar * 2) % THEME.length]; if (n) this.piano(midi(n), t0 + beat * 2, { vel: 0.3, dur: 4, dest: tr.bus }); }
      tr.bar++;
      tr.next = t0 + beat * 4;
    };
  }

  /* ------------------------------------------------------------ sfx */

  noise({ t = this.now, dur = 0.2, type = 'bandpass', f = 1000, q = 1, vel = 0.3, dest = this.sfx, attack = 0.005, wet = 0.1, sweep = null } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    n.connect(fl).connect(g); n.start(t, Math.random()); n.stop(t + dur + 0.05);
    this.out(g, dest, wet);
  }
  tone({ t = this.now, f = 440, f2 = null, dur = 0.15, type = 'square', vel = 0.1, dest = this.sfx, wet = 0.1 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.02);
    this.out(g, dest, wet);
  }

  // soft, natural footsteps: a low heel thud + a quiet surface texture
  step(surface = 'hard', run = false) {
    if (!this.ctx) return;
    const t = this.now;
    const v = (run ? 1.3 : 1) * (0.85 + Math.random() * 0.3);
    const r = () => 0.88 + Math.random() * 0.24;
    const heel = (f, vel, dur = 0.08) => this.noise({ t, dur, type: 'lowpass', f: f * r(), q: 0.7, vel: vel * v, attack: 0.004, wet: 0.04 });
    switch (surface) {
      case 'grass':
        heel(200, 0.09);
        this.noise({ t: t + 0.01, dur: 0.16, type: 'bandpass', f: 2800 * r(), q: 0.8, vel: 0.022 * v, attack: 0.03, wet: 0.02 });
        break;
      case 'snow':
        heel(260, 0.07, 0.07);
        for (let i = 0; i < 5; i++) this.noise({ t: t + 0.01 + i * (0.012 + Math.random() * 0.012), dur: 0.03, type: 'bandpass', f: 2400 + Math.random() * 2400, q: 2.5, vel: 0.035 * v, attack: 0.002, wet: 0.02 });
        break;
      case 'wet':
        heel(230, 0.09);
        this.noise({ t: t + 0.015, dur: 0.16, type: 'bandpass', f: 1600 * r(), q: 1.1, vel: 0.028 * v, attack: 0.01, sweep: 900, wet: 0.05 });
        break;
      case 'metal':
        heel(150, 0.11, 0.1);
        this.noise({ t, dur: 0.1, type: 'bandpass', f: 750 * r(), q: 5, vel: 0.016 * v, attack: 0.003, wet: 0.08 });
        break;
      default:
        heel(170, 0.12, 0.07);
        this.noise({ t: t + 0.045, dur: 0.05, type: 'lowpass', f: 420 * r(), q: 0.7, vel: 0.045 * v, attack: 0.003, wet: 0.04 });
        this.noise({ t: t + 0.01, dur: 0.05, type: 'bandpass', f: 2200 * r(), q: 0.8, vel: 0.01 * v, attack: 0.004, wet: 0.03 });
    }
  }
  blip() { this.tone({ f: 880, dur: 0.05, vel: 0.05 }); }
  confirm() { this.tone({ f: 660, f2: 990, dur: 0.12, vel: 0.06, type: 'triangle' }); }
  glitch(vel = 0.25) {
    const t = this.now;
    for (let i = 0; i < 6; i++) this.tone({ t: t + i * 0.03, f: 80 + Math.random() * 1600, dur: 0.04, vel: vel * 0.3, type: 'square' });
    this.noise({ t, dur: 0.25, f: 3000, q: 0.3, vel: vel * 0.6, type: 'highpass' });
  }
  whisper(dur = 1.6, vel = 0.25) {
    const t = this.now;
    for (let i = 0; i < 5; i++) this.noise({ t: t + i * dur / 5, dur: dur / 4, f: 1800 + Math.random() * 2500, q: 8, vel, attack: 0.08, wet: 0.8 });
  }
  heartbeat(t = this.now, dest = this.sfx, vel = 0.5) {
    for (const [d, v] of [[0, 1], [0.18, 0.7]]) {
      const ctx = this.ctx; if (!ctx) return;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t + d); o.frequency.exponentialRampToValueAtTime(38, t + d + 0.15);
      const g = ctx.createGain(); g.gain.setValueAtTime(vel * v * 0.6, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.22);
      o.connect(g); o.start(t + d); o.stop(t + d + 0.25); g.connect(dest);
    }
  }
  tickSound(t = this.now, dest = this.sfx) { this.noise({ t, dur: 0.03, f: 4200, q: 6, vel: 0.12, dest, wet: 0.3 }); }
  scrape(t = this.now, dest = this.sfx) { this.noise({ t, dur: 2.4, f: 300, q: 14, vel: 0.12, dest, attack: 0.8, sweep: 1400, wet: 0.9 }); }
  impact() { this.noise({ dur: 0.3, f: 200, q: 0.8, vel: 0.5, type: 'lowpass' }); this.tone({ f: 120, f2: 40, dur: 0.3, type: 'sine', vel: 0.4 }); }
  clang() { this.tone({ f: 620, dur: 0.5, type: 'triangle', vel: 0.12, wet: 0.5 }); this.tone({ f: 931, dur: 0.4, type: 'triangle', vel: 0.08, wet: 0.5 }); this.noise({ dur: 0.1, f: 3000, vel: 0.2 }); }
  door() { this.noise({ dur: 0.9, f: 400, q: 6, vel: 0.12, attack: 0.2, sweep: 260, wet: 0.4 }); this.noise({ t: this.now + 0.85, dur: 0.2, f: 150, q: 1, vel: 0.3, type: 'lowpass' }); }
  buzz() { const t = this.now; for (let i = 0; i < 2; i++) this.tone({ t: t + i * 0.32, f: 140, dur: 0.22, type: 'sawtooth', vel: 0.05, wet: 0 }); }
  ping() { this.tone({ f: 1320, dur: 0.12, type: 'sine', vel: 0.08 }); this.tone({ t: this.now + 0.09, f: 1760, dur: 0.2, type: 'sine', vel: 0.07 }); }
  breathe(inhale = true) { this.noise({ dur: 1.6, f: inhale ? 900 : 600, q: 0.7, vel: 0.07, attack: 0.9, wet: 0.3, sweep: inhale ? 1400 : 400 }); }
  laugh() { const t = this.now; for (let i = 0; i < 5; i++) this.tone({ t: t + i * 0.13, f: 520 - i * 18, f2: 430 - i * 18, dur: 0.1, type: 'triangle', vel: 0.035, wet: 0.3 }); }
  gasp() { this.noise({ dur: 0.35, f: 1600, q: 1.5, vel: 0.2, attack: 0.03, sweep: 2200 }); }
  shatter() {
    const t = this.now;
    for (let i = 0; i < 18; i++) this.tone({ t: t + Math.random() * 1.2, f: 1500 + Math.random() * 3000, dur: 0.2, type: 'triangle', vel: 0.03, wet: 0.7 });
    this.noise({ t, dur: 2, f: 5000, q: 0.5, vel: 0.15, type: 'highpass', wet: 0.6 });
  }
  /** breaking ceramic: a crack, then many small pieces */
  plateBreak() {
    if (!this.ctx) return;
    const t = this.now;
    this.noise({ t, dur: 0.12, type: 'bandpass', f: 2600, q: 0.7, vel: 0.5, attack: 0.001, wet: 0.25 });
    this.noise({ t, dur: 0.25, type: 'lowpass', f: 500, q: 0.8, vel: 0.25, attack: 0.001, wet: 0.2 });
    for (let i = 0; i < 14; i++) {
      const dt = 0.03 + Math.random() * 0.45;
      this.tone({ t: t + dt, f: 2500 + Math.random() * 4500, dur: 0.05 + Math.random() * 0.08, type: 'triangle', vel: 0.05 * (1 - dt), wet: 0.3 });
      this.noise({ t: t + dt, dur: 0.04, type: 'highpass', f: 4000, q: 0.7, vel: 0.06 * (1 - dt), attack: 0.001, wet: 0.2 });
    }
  }

  /**
   * An unintelligible raised voice (the words are on screen, the sound only
   * carries the tone). gender: 'm' | 'f', anger 0..1
   */
  voice(gender = 'm', dur = 1.4, anger = 0.8) {
    const ctx = this.ctx; if (!ctx) return;
    const t = this.now;
    const f0 = (gender === 'f' ? 230 : 125) * (1 + anger * 0.35);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const syl = Math.max(3, Math.round(dur * 5.5));
    o.frequency.setValueAtTime(f0, t);
    for (let i = 1; i <= syl; i++) o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.45 + (i === syl ? -0.2 : 0)), t + (dur * i) / syl);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6;
    for (let i = 0; i <= syl; i++) {
      const tt = t + (dur * i) / syl;
      f1.frequency.setValueAtTime(450 + Math.random() * 450, tt);
      f2.frequency.setValueAtTime(1100 + Math.random() * 900, tt);
    }
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (let i = 0; i < syl; i++) {
      const a = t + (dur * i) / syl;
      const v = (0.05 + anger * 0.06) * (0.7 + Math.random() * 0.5);
      g.gain.linearRampToValueAtTime(v, a + 0.03);
      g.gain.linearRampToValueAtTime(v * 0.25, a + (dur / syl) * 0.85);
    }
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; // muffled, as if through a wall of memory
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(lp);
    o.start(t); o.stop(t + dur + 0.1);
    this.out(lp, this.sfx, 0.35);
  }

  thump() { this.noise({ dur: 0.25, f: 120, q: 1, vel: 0.35, type: 'lowpass' }); }

  /* ------------------------------------------------------------ ambience loops */

  ambience(name, on = true, vel = 1) {
    if (!this.ctx) return;
    const cur = this.loops.get(name);
    if (!on) { if (cur) { cur.stop(); this.loops.delete(name); } return; }
    if (cur) return;
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, this.now); g.gain.linearRampToValueAtTime(vel, this.now + 2);
    g.connect(this.amb);
    const nodes = [];
    const src = (type, f, q, v) => {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const ng = ctx.createGain(); ng.gain.value = v;
      n.connect(fl).connect(ng).connect(g); n.start(0, Math.random() * 2); nodes.push(n);
      return { fl, ng };
    };
    let timer = null;
    if (name === 'rain') { src('highpass', 2500, 0.5, 0.09); src('bandpass', 800, 0.6, 0.06); }
    if (name === 'wind') { const w = src('bandpass', 400, 2, 0.08); const l = ctx.createOscillator(); l.frequency.value = 0.12; const lg = ctx.createGain(); lg.gain.value = 250; l.connect(lg).connect(w.fl.frequency); l.start(); nodes.push(l); }
    if (name === 'bus') { src('lowpass', 140, 3, 0.25); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 42; const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 120; const og = ctx.createGain(); og.gain.value = 0.05; o.connect(lf).connect(og).connect(g); o.start(); nodes.push(o); this.busOsc = o; }
    if (name === 'room') { src('lowpass', 200, 0.7, 0.05); }
    if (name === 'hum') { const o = ctx.createOscillator(); o.frequency.value = 100; o.type = 'sine'; const og = ctx.createGain(); og.gain.value = 0.02; o.connect(og).connect(g); o.start(); nodes.push(o); src('bandpass', 7000, 3, 0.01); }
    if (name === 'birds' || name === 'park') {
      src('lowpass', 500, 0.5, 0.03);
      timer = setInterval(() => { if (Math.random() < 0.5) { const t = this.now; const f = 2500 + Math.random() * 1800; for (let i = 0; i < 3; i++) this.tone({ t: t + i * 0.09, f, f2: f * 1.3, dur: 0.07, type: 'sine', vel: 0.015, dest: g, wet: 0.3 }); } }, 900);
    }
    if (name === 'city') { src('lowpass', 300, 0.5, 0.08); timer = setInterval(() => { if (Math.random() < 0.15) this.noise({ dur: 3, f: 200, q: 0.8, vel: 0.05, type: 'lowpass', dest: g, attack: 1.4 }); }, 1500); }
    if (name === 'void') { src('bandpass', 90, 4, 0.2); src('bandpass', 3500, 12, 0.012); }
    this.loops.set(name, {
      gain: g,
      stop: () => {
        const n = this.now; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + 1.5);
        nodes.forEach((x) => x.stop(n + 1.6)); if (timer) clearInterval(timer);
      },
    });
  }
  stopAllAmbience() { for (const k of [...this.loops.keys()]) this.ambience(k, false); }
}

export const audio = new AudioEngine();
