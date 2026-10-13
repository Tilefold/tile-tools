/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Arcade kit — sounds
 *
 * Short retro tones made in code and packed into WAV `data:` URLs, the form
 * `tf.sound.play` takes, so the tile ships no recordings. A tone glides
 * from one pitch to another with a square, triangle or noise wave and fades
 * out. Each named sound is built once and reused.
 *
 * Tilefold lets a tile start two sounds a second and thirty a minute, so
 * this player keeps well inside that on its own: it skips a sound that
 * comes too soon after the last one, and quietly ignores a refused play.
 *
 * This file is the same in every arcade example.
 */

/** Samples per second; plenty for simple tones. */
export const RATE = 11025;

/** The least time between two sounds, in ms, and the most sounds a minute. */
export const MIN_GAP_MS = 550;
export const MAX_PER_MINUTE = 24;

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
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/**
 * The samples of one tone, or of several played one after another.
 *
 * @param {{ from: number, to?: number, ms: number, wave?: "square" | "triangle" | "noise",
 *           volume?: number } | Array<{ from: number, to?: number, ms: number,
 *           wave?: "square" | "triangle" | "noise", volume?: number }>} spec
 * @returns {Float32Array}
 */
export function toneSamples(spec) {
  const parts = Array.isArray(spec) ? spec : [spec];
  const total = parts.reduce((n, p) => n + Math.round((RATE * p.ms) / 1000), 0);
  const out = new Float32Array(total);
  let at = 0;
  // A fixed noise sequence, so the same sound always comes out the same.
  let noise = 0x2545f491;
  for (const p of parts) {
    const n = Math.round((RATE * p.ms) / 1000);
    const to = p.to ?? p.from;
    const volume = p.volume ?? 0.35;
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const progress = i / n;
      phase += (p.from + (to - p.from) * progress) / RATE;
      const cycle = phase % 1;
      let v;
      if (p.wave === "noise") {
        noise ^= noise << 13;
        noise ^= noise >>> 17;
        noise ^= noise << 5;
        v = ((noise >>> 0) / 4294967296) * 2 - 1;
      } else if (p.wave === "triangle") {
        v = 1 - 4 * Math.abs(cycle - 0.5);
      } else {
        v = cycle < 0.5 ? 1 : -1;
      }
      // A quick fade in and a fade out, so tones don't click.
      const fade = Math.min(1, i / 40, (n - i) / (n * 0.35 + 1));
      out[at + i] = v * volume * fade;
    }
    at += n;
  }
  return out;
}

/**
 * The tile's sound player.
 *
 * @param {any} tf The tile API.
 * @param {() => boolean} enabled Whether the user wants sounds now.
 * @param {Record<string, Parameters<typeof toneSamples>[0]>} specs The named sounds.
 * @param {() => number} [now] The clock (tests pass a fake).
 * @returns {{ play: (name: string) => void, url: (name: string) => string | null }}
 */
export function createSounds(tf, enabled, specs, now = Date.now) {
  const cache = new Map();
  const played = [];
  const url = (name) => {
    if (!Object.hasOwn(specs, name)) return null;
    if (!cache.has(name)) cache.set(name, wavUrl(toneSamples(specs[name])));
    return cache.get(name);
  };
  return {
    url,
    play(name) {
      if (!enabled() || !tf.sound) return;
      const src = url(name);
      if (!src) return;
      const t = now();
      while (played.length && t - played[0] > 60_000) played.shift();
      const last = played[played.length - 1];
      if (last !== undefined && t - last < MIN_GAP_MS) return;
      if (played.length >= MAX_PER_MINUTE) return;
      played.push(t);
      // A refused or failed play (muted, too many) never matters to the game.
      void Promise.resolve()
        .then(() => tf.sound.play({ src, volume: 0.6 }))
        .catch(() => {});
    },
  };
}
