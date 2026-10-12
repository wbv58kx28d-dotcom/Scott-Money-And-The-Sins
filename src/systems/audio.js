// Procedural boom-bap beat and sound effects on WebAudio (CLAUDE.md §5.10),
// ported from the legacy prototype. Phaser's audio is disabled (noAudio).
//
// Browsers only allow sound after a user gesture, so installUnlock() listens
// on window for the first tap/click; the beat starts then and keeps looping.
// On iPhones the hardware silent switch also mutes WebAudio; that's expected.

import { createRng } from './rng.js';

const BPM = 92;
const STEP_SEC = 60 / BPM / 2; // 8th notes; 16 steps = 2 bars
const LOOKAHEAD_MS = 30;
const SCHEDULE_AHEAD_SEC = 0.12;
const MASTER_GAIN = 0.45;

// MIDI notes per step (0 = rest), and the chord stabs on each bar.
const BASS = [33, 0, 0, 33, 0, 36, 0, 31, 29, 0, 0, 29, 0, 31, 0, 28];
const CHORDS = { 0: [57, 60, 64], 8: [53, 57, 60, 64] }; // Am, then F

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.timer = null;
  }

  /** Call once at boot. Unlocks audio (and starts the beat) on the first gesture. */
  installUnlock() {
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, () => this.unlock(), { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  /** Create or resume the audio context. Only works inside a user gesture. */
  unlock() {
    if (document.hidden) return;
    this.ensureContext();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const { ctx } = this;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
    this.master.connect(ctx.destination);

    // Half a second of white noise, reused by drums and effects. Fixed seed:
    // it sounds the same every session and never touches the gameplay rng.
    const len = Math.floor(ctx.sampleRate * 0.5);
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    const noiseRng = createRng(1234567);
    for (let i = 0; i < len; i++) data[i] = noiseRng.range(-1, 1);

    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Flip mute. Returns the new muted state. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
    return this.muted;
  }

  /** Milliseconds per beat, for UI that pulses in time. */
  get beatMs() {
    return 60000 / BPM;
  }

  // ---- Beat ---------------------------------------------------------------

  schedule() {
    if (!this.running) return;
    // After a long suspend, skip ahead instead of firing a burst of notes.
    if (this.nextTime < this.ctx.currentTime - 0.25) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP_SEC;
      this.step = (this.step + 1) % 16;
    }
  }

  playStep(s, t) {
    const p = s % 8;
    if (p === 0 || p === 3 || (p === 5 && s >= 8)) this.kick(t);
    if (p === 2 || p === 6) this.snare(t);
    this.hat(t, p % 2 ? 0.04 : 0.08);
    if (BASS[s]) this.tone(t, mtof(BASS[s]), 0.28, 'triangle', 0.32);
    for (const n of CHORDS[s] ?? []) this.tone(t, mtof(n), 0.9, 'triangle', 0.035);
  }

  kick(t) {
    this.tone(t, 140, 0.22, 'sine', 0.9, 42);
  }

  snare(t) {
    this.noise(t, 0.16, 0.45, 'bandpass', 1900);
    this.tone(t, 190, 0.08, 'triangle', 0.2, 120);
  }

  hat(t, vol) {
    this.noise(t, 0.035, vol, 'highpass', 7500);
  }

  // ---- Building blocks ----------------------------------------------------

  tone(t, freq, dur, type, vol, toFreq) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(t, dur, vol, filterType, freq) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- Sound effects ------------------------------------------------------

  /** Play a named effect. Does nothing before audio is unlocked. */
  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    SFX[name]?.(this, t);
  }
}

const SFX = {
  blip: (a, t) => a.tone(t, 880, 0.05, 'square', 0.05),
  hit: (a, t) => {
    a.noise(t, 0.12, 0.5, 'lowpass', 1200);
    a.tone(t, 220, 0.15, 'square', 0.1, 80);
  },
  crit: (a, t) => {
    a.noise(t, 0.3, 0.6, 'lowpass', 2200);
    a.tone(t, 330, 0.35, 'sawtooth', 0.12, 55);
  },
  good: (a, t) => [0, 4, 7, 12].forEach((k, i) => a.tone(t + i * 0.05, 659 * Math.pow(2, k / 12), 0.12, 'square', 0.06)),
  ok: (a, t) => a.tone(t, 523, 0.1, 'square', 0.06),
  bad: (a, t) => a.tone(t, 196, 0.3, 'sawtooth', 0.08, 100),
  heal: (a, t) => [0, 5, 9].forEach((k, i) => a.tone(t + i * 0.07, 523 * Math.pow(2, k / 12), 0.15, 'triangle', 0.1)),
  buff: (a, t) => a.tone(t, 300, 0.45, 'square', 0.06, 1300),
  // A rhyme landing in a speech bubble.
  punch: (a, t) => {
    a.tone(t, 170, 0.14, 'sine', 0.55, 48);
    a.noise(t, 0.06, 0.3, 'lowpass', 900);
  },
};

export const Audio = new AudioEngine();
