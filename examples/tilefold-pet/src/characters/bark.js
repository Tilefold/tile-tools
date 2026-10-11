/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — a small dog's bark
 *
 * A short "arf", made from scratch: a buzzy voice (a stack of harmonics)
 * whose pitch jumps up and then falls, shaped by two resonances like an
 * open "ar" mouth, with a breathy burst at the start and a quick fade.
 * `barks(2)` gives "arf-arf", the second a little lower. A small dog
 * barks high, so the voice starts near 800 Hz unless asked otherwise.
 */
import { RATE, bandPass, noise, wavUrl } from "../audio.js";

/** Seconds of one bark, and of the pause between two. */
const LENGTH = 0.17;
const GAP = 0.09;

/**
 * One bark's samples.
 *
 * @param {number} pitch Starting pitch in Hz.
 * @param {number} seed Noise seed, so every build sounds the same.
 * @returns {Float32Array}
 */
function bark(pitch, seed) {
  const n = Math.round(LENGTH * RATE);
  const out = new Float32Array(n);
  const mouth = [bandPass(1100, 3.5), bandPass(2500, 5)];
  const breath = bandPass(2200, 1.2);
  const rand = noise(seed);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // Pitch: up a little in the first 20 ms, then down by about a third.
    const rise = Math.min(1, t / 0.02);
    const fall = Math.max(0, (t - 0.02) / (LENGTH - 0.02));
    const f = pitch * (0.92 + 0.12 * rise) * (1 - 0.38 * fall);
    phase += (2 * Math.PI * f) / RATE;
    let voice = 0;
    for (let k = 1; k <= 14; k++) voice += Math.sin(k * phase) / Math.pow(k, 1.1);
    const shaped = 0.25 * voice + 1.6 * mouth[0](voice) + 0.9 * mouth[1](voice);
    // Loudness: 6 ms attack, a fast fall, then a short tail.
    const attack = Math.min(1, t / 0.006);
    const decay = Math.exp(-t / 0.055) * 0.85 + 0.15 * Math.max(0, 1 - t / LENGTH);
    const burst = breath(rand()) * 2.2 * Math.exp(-t / 0.018);
    out[i] = (shaped * 0.22 + burst) * attack * decay;
  }
  return out;
}

/**
 * `count` barks in a row as a WAV data URL, peaking just under full scale.
 *
 * @param {number} count 1 or more.
 * @param {number} [pitch] Starting pitch in Hz; smaller dogs bark higher.
 * @returns {string}
 */
export function barks(count, pitch = 800) {
  const gap = Math.round(GAP * RATE);
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(bark(pitch * Math.pow(0.92, i), 7 + i));
  const total = parts.reduce((sum, p) => sum + p.length, 0) + gap * (count - 1);
  const all = new Float32Array(total);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length + gap;
  }
  let peak = 0;
  for (const v of all) peak = Math.max(peak, Math.abs(v));
  // A gentle limiter keeps the start crisp without clipping.
  const scale = peak ? 0.85 / Math.tanh(1.4) : 0;
  for (let i = 0; i < all.length; i++) all[i] = Math.tanh((1.4 * all[i]) / (peak || 1)) * scale;
  return wavUrl(all);
}
