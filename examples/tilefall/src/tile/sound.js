/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — sounds
 *
 * Short blips made in code and packed into WAV `data:` URLs, the form
 * `tf.sound.play` takes, so the tile carries no recordings. Three sounds:
 * a rising chirp when lines clear (higher for more lines), a quick
 * four-note run for four lines at once, and a falling tone when the game
 * ends. Each clip is built once and reused.
 */

/** Samples per second; plenty for short, simple tones. */
export const RATE = 22050;

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
  const ascii = (at, s) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // size of the format chunk
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return "data:audio/wav;base64," + btoa(bin);
}

/**
 * A tone that slides from one pitch to another, with a short fade in and a
 * fade out so it never clicks. A touch of the octave makes it brighter.
 *
 * @param {number} from Start frequency, Hz.
 * @param {number} to End frequency, Hz.
 * @param {number} ms Length.
 * @returns {number[]}
 */
export function sweep(from, to, ms) {
  const n = Math.max(1, Math.round((RATE * ms) / 1000));
  const out = new Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = from + (to - from) * t;
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.min(1, i / (RATE * 0.004)) * (1 - t) ** 1.5;
    out[i] = 0.35 * env * (Math.sin(phase) + 0.25 * Math.sin(2 * phase));
  }
  return out;
}

/**
 * The samples for a named sound.
 *
 * @param {"clear1"|"clear2"|"clear3"|"clear4"|"over"} name
 * @returns {number[]}
 */
export function samplesFor(name) {
  switch (name) {
    case "clear1":
      return sweep(520, 780, 110);
    case "clear2":
      return sweep(620, 930, 130);
    case "clear3":
      return sweep(740, 1110, 150);
    case "clear4":
      // A quick rising run of four notes (C, E, G, high C).
      return [523, 659, 784, 1047].flatMap((f) => sweep(f, f * 1.01, 70));
    case "over":
      return [...sweep(440, 330, 160), ...sweep(330, 196, 320)];
    default:
      return [];
  }
}

/** The sound for a number of cleared lines. */
export function clearSound(lines) {
  const n = Math.min(4, Math.max(1, Math.round(Number(lines)) || 1));
  return /** @type {"clear1"|"clear2"|"clear3"|"clear4"} */ (`clear${n}`);
}

/**
 * A player that builds each clip once and plays it through `tf.sound.play`
 * when sounds are on. Playing never throws and never waits on the app.
 *
 * @param {any} tf The tile API.
 * @param {() => boolean} enabled Whether the Sounds setting is on.
 * @returns {{ play: (name: string) => void }}
 */
export function createSounds(tf, enabled) {
  const clips = new Map();
  return {
    play(name) {
      if (!enabled()) return;
      if (!clips.has(name)) clips.set(name, wavUrl(samplesFor(/** @type {any} */ (name))));
      const src = clips.get(name);
      try {
        void Promise.resolve(tf.sound.play({ src, volume: 0.4 })).catch(() => {});
      } catch {
        // A host without sound support simply stays quiet.
      }
    },
  };
}
