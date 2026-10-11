/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — sound helpers
 *
 * Sounds are made in code, not loaded: samples are computed here and
 * packed into a WAV `data:` URL, the form `tf.sound.play` takes. That keeps
 * the tile one file with no recordings (and no licences) to carry.
 */

/** Samples per second; plenty for short, small sounds. */
export const RATE = 22050;

/**
 * A repeatable pseudo-random source (the same noise every build).
 *
 * @param {number} seed
 * @returns {() => number} Numbers from -1 to 1.
 */
export function noise(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return (x / 0xffffffff) * 2 - 1;
  };
}

/**
 * A band-pass filter (a standard two-pole biquad) for shaping a voice.
 *
 * @param {number} freq Centre frequency in Hz.
 * @param {number} q Sharpness.
 * @returns {(x: number) => number} Feed it one sample at a time.
 */
export function bandPass(freq, q) {
  const w = (2 * Math.PI * freq) / RATE;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/**
 * Samples (numbers from -1 to 1) as a 16-bit mono WAV `data:` URL.
 *
 * @param {ArrayLike<number>} samples
 * @returns {string}
 */
export function wavUrl(samples) {
  const n = samples.length;
  const bytes = new Uint8Array(44 + n * 2);
  const view = new DataView(bytes.buffer);
  const text = (at, s) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // format chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample frame
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return "data:audio/wav;base64," + btoa(bin);
}
