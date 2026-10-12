// Procedural boom-bap beat and sound effects on WebAudio (CLAUDE.md §5.10).
// Phaser's audio is disabled (noAudio). Browsers only allow sound after a user
// gesture, so installUnlock() listens on window for the first tap/click; on
// iPhones the hardware silent switch also mutes WebAudio, which is expected.

import { createRng, rng } from './rng.js';

const BPM = 92;
const STEP_SEC = 60 / BPM / 4; // 16th notes
const SWING = 0.14; // delay on off-beat 16ths, as a fraction of a step
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const MASTER_GAIN = 0.55;
const MUSIC_GAIN = 0.5;

// Two-bar loop, 16 steps per bar.
const KICK = 'x......x..x.....' + 'x......x..x..x..';
const SNARE = '....x.......x...' + '....x.......x..g'; // g = ghost note
const HAT = 'x.x.x.x.x.x.x.xo' + 'x.x.x.x.x.x.x.x.'; // o = open hat
// Bass: [step, frequency]
const BASS = [
  [0, 55.0], [7, 65.41], [10, 55.0],
  [16, 43.65], [23, 49.0], [26, 43.65], [29, 49.0],
];
// Dusty chord stabs: Am7, then Fmaj7.
const CHORDS = [
  [0, [220.0, 261.63, 329.63, 392.0]],
  [16, [174.61, 220.0, 261.63, 329.63]],
];

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.wantBeat = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
  }

  /** Call once at boot. Unlocks audio on the first user gesture. */
  installUnlock() {
    const unlock = () => {
      if (document.hidden) return;
      this.ensureContext();
      if (!this.ctx) return;
      if (this.ctx.state !== 'running') this.ctx.resume().then(() => this.maybeStartBeat());
      else this.maybeStartBeat();
    };
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, unlock, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = MUSIC_GAIN;
    this.music.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);

    // One second of white noise, reused by drums and effects.
    const len = ctx.sampleRate;
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    // Fixed seed: the noise sounds the same every session.
    const noiseRng = createRng(1234567);
    for (let i = 0; i < len; i++) data[i] = noiseRng.range(-1, 1);
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : MASTER_GAIN;
  }

  // ---- Beat ---------------------------------------------------------------

  startBeat() {
    this.wantBeat = true;
    this.maybeStartBeat();
  }

  stopBeat() {
    this.wantBeat = false;
    clearInterval(this.timer);
    this.timer = null;
  }

  maybeStartBeat() {
    if (!this.wantBeat || this.timer || !this.running) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  schedule() {
    if (!this.running) return;
    while (this.nextTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const swing = this.step % 2 === 1 ? SWING * STEP_SEC : 0;
      this.playStep(this.step, this.nextTime + swing);
      this.nextTime += STEP_SEC;
      this.step = (this.step + 1) % KICK.length;
    }
  }

  playStep(step, t) {
    const out = this.music;
    if (KICK[step] === 'x') this.kick(t, out);
    if (SNARE[step] === 'x') this.snare(t, out, 1);
    if (SNARE[step] === 'g') this.snare(t, out, 0.3);
    if (HAT[step] === 'x') this.hat(t, out, 0.05, step % 4 === 0 ? 0.22 : 0.14);
    if (HAT[step] === 'o') this.hat(t, out, 0.22, 0.16);
    for (const [s, freq] of BASS) if (s === step) this.bass(t, out, freq);
    for (const [s, notes] of CHORDS) if (s === step) this.chord(t, out, notes);
  }

  kick(t, out) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  snare(t, out, level) {
    this.noise({ at: t, dur: 0.18, gain: 0.5 * level, type: 'highpass', freq: 1400, out });
    this.tone({ at: t, type: 'triangle', freq: 190, freqEnd: 150, dur: 0.1, gain: 0.35 * level, out });
  }

  hat(t, out, dur, gain) {
    this.noise({ at: t, dur, gain, type: 'highpass', freq: 7500, out });
  }

  bass(t, out, freq) {
    this.tone({ at: t, type: 'sine', freq, dur: 0.42, gain: 0.55, attack: 0.01, out });
    this.tone({ at: t, type: 'triangle', freq: freq * 2, dur: 0.2, gain: 0.08, out });
  }

  chord(t, out, notes) {
    const { ctx } = this;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    filter.connect(out);
    for (const freq of notes) {
      this.tone({ at: t, type: 'triangle', freq, dur: 0.9, gain: 0.05, attack: 0.02, out: filter });
    }
  }

  // ---- Building blocks ----------------------------------------------------

  tone({ at, type = 'square', freq, freqEnd, dur, gain = 0.2, attack = 0.005, out }) {
    const { ctx } = this;
    const t = at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ at, dur, gain = 0.3, type = 'bandpass', freq = 1000, q = 0.8, out }) {
    const { ctx } = this;
    const t = at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(out ?? this.sfxBus);
    src.start(t, rng.fx.range(0, 0.5));
    src.stop(t + dur + 0.02);
  }

  arpeggio(freqs, { step = 0.07, type = 'square', dur = 0.12, gain = 0.12 } = {}) {
    const t0 = this.ctx.currentTime;
    freqs.forEach((freq, i) => this.tone({ at: t0 + i * step, type, freq, dur, gain }));
  }

  // ---- Sound effects ------------------------------------------------------

  /** Play a named effect. Silently does nothing before audio is unlocked. */
  sfx(name) {
    if (!this.running) return;
    const fx = SFX[name];
    if (fx) fx(this);
  }
}

const SFX = {
  blip: (a) => a.tone({ type: 'square', freq: 660, freqEnd: 880, dur: 0.06, gain: 0.08 }),
  back: (a) => a.tone({ type: 'square', freq: 520, freqEnd: 330, dur: 0.07, gain: 0.07 }),
  tap: (a) => a.tone({ type: 'square', freq: 1200, dur: 0.03, gain: 0.06 }),
  PERFECT: (a) => a.arpeggio([1046.5, 1318.5, 1568, 2093], { step: 0.05 }),
  FIRE: (a) => a.arpeggio([784, 1046.5, 1318.5], { step: 0.05 }),
  MID: (a) => a.arpeggio([659.3, 784], { step: 0.06, type: 'triangle', gain: 0.14 }),
  WACK: (a) => a.tone({ type: 'sawtooth', freq: 320, freqEnd: 110, dur: 0.35, gain: 0.1 }),
  hit: (a) => {
    a.noise({ dur: 0.14, gain: 0.45, type: 'lowpass', freq: 2400 });
    a.tone({ type: 'sine', freq: 140, freqEnd: 55, dur: 0.18, gain: 0.5 });
  },
  crit: (a) => {
    SFX.hit(a);
    a.arpeggio([523.3, 784, 1046.5, 1568], { step: 0.04, type: 'sawtooth', gain: 0.08 });
  },
  hurt: (a) => {
    a.noise({ dur: 0.18, gain: 0.4, type: 'lowpass', freq: 1200 });
    a.tone({ type: 'square', freq: 220, freqEnd: 90, dur: 0.22, gain: 0.12 });
  },
  heal: (a) => a.arpeggio([523.3, 659.3, 784, 1046.5], { type: 'triangle', gain: 0.14 }),
  buff: (a) => a.arpeggio([392, 523.3, 784, 1046.5, 1568], { step: 0.05, type: 'triangle', gain: 0.12 }),
  debuff: (a) => a.arpeggio([784, 659.3, 523.3, 392], { step: 0.06, type: 'sawtooth', gain: 0.07 }),
  crowd: (a) => a.noise({ dur: 0.9, gain: 0.25, type: 'bandpass', freq: 1800, q: 0.4 }),
  mic: (a) => {
    a.tone({ type: 'sine', freq: 90, freqEnd: 28, dur: 1.1, gain: 0.8 });
    a.noise({ dur: 1.2, gain: 0.35, type: 'lowpass', freq: 900 });
  },
  victory: (a) => a.arpeggio([523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5], { step: 0.11, dur: 0.18 }),
  defeat: (a) => a.arpeggio([392, 349.2, 311.1, 261.6, 196], { step: 0.16, type: 'triangle', dur: 0.3, gain: 0.16 }),
};

export const Audio = new AudioEngine();
