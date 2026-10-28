/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold — tf.screensaver
 *
 * The screensaver part of the fake Tilefold in fake-host.mjs: `tf.screensaver.theme`
 * with Tilefold 0.1.12's checks (an id of lowercase letters, digits and
 * dashes, a name, a draw function, unique ids, at most 12 themes), and
 * `host.drawTheme(id, options)`, which plays the frames Tilefold would ask
 * for on a recording 2D context and returns it. See fake-host.mjs for how
 * tests use it.
 */

/** Tilefold's rule for a theme id, and the most themes one tile may add. */
const THEME_ID = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_THEMES = 12;

/** The colors a frame carries when a test gives none. */
export const DEFAULT_COLORS = { background: "#0b0b10", text: "#f4f4f8", accent: "#8b6cff" };

/**
 * A stand-in Canvas 2D context: every method call is recorded in `calls`
 * as `[name, ...args]`, every property set in `sets` as `[name, value]`,
 * and properties read back what was set. `measureText` answers a width of
 * 8 pixels a character.
 */
export function fakeContext() {
  const calls = [];
  const sets = [];
  const values = { globalAlpha: 1, fillStyle: "#000", font: "10px sans-serif" };
  return new Proxy(values, {
    get(target, name) {
      if (name === "calls") return calls;
      if (name === "sets") return sets;
      if (name === "measureText") return (text) => ({ width: String(text).length * 8 });
      if (name in target) return target[name];
      return (...args) => void calls.push([name, ...args]);
    },
    set(target, name, value) {
      target[name] = value;
      sets.push([name, value]);
      return true;
    },
  });
}

/** `tf.screensaver`, keeping each theme and playing its frames on demand. */
export function addScreensaver(tf, host, named) {
  host.themes = new Map();
  tf.screensaver = {
    theme(id, name, draw) {
      if (typeof draw !== "function")
        throw new TypeError("tf.screensaver.theme needs a draw function");
      const theme = {
        id: String(id),
        name: String(name ?? id)
          .trim()
          .slice(0, 60),
      };
      // Tilefold refuses the whole tile for these, when it checks it.
      if (!THEME_ID.test(theme.id)) throw named("TypeError", `bad theme id "${theme.id}"`);
      if (!theme.name) throw named("TypeError", `theme "${theme.id}" needs a name`);
      if (host.themes.has(theme.id))
        throw named("TypeError", `two themes share the id "${theme.id}"`);
      if (host.themes.size >= MAX_THEMES) throw named("TypeError", "at most 12 themes");
      host.regs.push({ kind: "theme", ...theme });
      host.themes.set(theme.id, { ...theme, draw });
    },
  };

  /**
   * Plays `frames` frames of theme `id` (one Tilefold start: the first frame
   * is 0 with dt 0), each `dt` ms after the last, and returns the context.
   * Pass `ctx` to go on drawing on the same canvas.
   */
  host.drawTheme = (id, options = {}) => {
    const theme = host.themes.get(id);
    if (!theme) throw new Error(`no theme ${id}`);
    const {
      width = 1200,
      height = 800,
      frames = 1,
      dt = 1000 / 30,
      colors = DEFAULT_COLORS,
    } = options;
    const ctx = options.ctx ?? fakeContext();
    const first = options.firstFrame ?? 0;
    for (let i = 0; i < frames; i += 1) {
      const frame = first + i;
      theme.draw({ ctx, width, height, time: frame * dt, dt: frame === 0 ? 0 : dt, frame, colors });
    }
    return ctx;
  };
}
