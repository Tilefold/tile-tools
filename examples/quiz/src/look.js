/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — how the card looks
 *
 * From Tilefold 0.1.20 the card is drawn in Tilefold's own theme: the
 * page gets its colors as CSS variables (`--tf-pane`, `--tf-text`…), and the
 * tile gets them from `tf.theme()` and "theme.changed", for the grip. Then
 * the theme decides light or dark, and the card's own switch steps aside.
 *
 * On an older Tilefold the card has its own light and dark: the Appearance
 * setting (`auto` follows the system, as the page reports it), and the
 * "Switch light or dark" command and button, which flip it and remember it
 * until the setting changes.
 */
import { appearanceOf, effectiveTheme, flipped, schemeOf } from "./appearance.js";
import { appearanceSetting } from "./settings.js";

/** A theme from Tilefold checked: `{ mode, colors }`, or null. */
export function readTilefoldTheme(value) {
  const t = /** @type {any} */ (value);
  if (!t || typeof t !== "object" || !t.colors || typeof t.colors !== "object") return null;
  const colors = {};
  for (const [key, color] of Object.entries(t.colors)) {
    if (typeof color === "string" && /^[A-Za-z0-9 #(),.%/+-]{1,64}$/.test(color)) {
      colors[key] = color;
    }
  }
  return { mode: t.mode === "light" ? "light" : "dark", colors };
}

/**
 * @param {any} tf
 * @param {ReturnType<import("./store.js").createStore>} store
 */
export function createLook(tf, store) {
  /** Light or dark as the user switched it (kept), and the system's as the page saw it. */
  let switched = null;
  let system = null;
  /** Tilefold's theme, when this Tilefold tells it. */
  let tilefold = null;
  let appearance = appearanceOf(appearanceSetting(tf.settings));

  return {
    /** Reads what was kept, and Tilefold's theme where there is one. */
    async load() {
      switched = await store.appearance();
      if (typeof tf.theme === "function") {
        tilefold = readTilefoldTheme(await tf.theme().catch(() => null));
      }
    },

    /** Whether the card follows Tilefold's theme (Tilefold 0.1.20). */
    follows: () => tilefold !== null,

    /** Light or dark, now. */
    mode: () =>
      tilefold ? tilefold.mode : effectiveTheme(appearanceSetting(tf.settings), switched, system),

    /** Tilefold's colors, or null on an older Tilefold. */
    colors: () => (tilefold ? tilefold.colors : null),

    /** Tilefold's theme changed. */
    tilefoldChanged(value) {
      tilefold = readTilefoldTheme(value) ?? tilefold;
    },

    /** The page saw the system's light or dark (it may have changed). */
    systemIs(value) {
      system = schemeOf(value) ?? system;
    },

    /** Flips light and dark and remembers it; returns what it is now. */
    async switchMode() {
      switched = flipped(this.mode());
      await store.saveAppearance(switched);
      return switched;
    },

    /** The settings changed: a new Appearance wins over the last switch. Returns whether it did. */
    async settingChanged() {
      const now = appearanceOf(appearanceSetting(tf.settings));
      if (now === appearance) return false;
      appearance = now;
      switched = null;
      await store.saveAppearance(null);
      return true;
    },
  };
}
