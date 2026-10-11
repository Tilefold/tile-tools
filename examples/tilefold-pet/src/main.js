/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet (example tile)
 *
 * A pet lives on top of your panes: Tessa, a small creature made of four
 * rounded tiles, Coco, a white poodle, or Biscuit, a scruffy terrier
 * (Settings → Tiles → Tilefold Pet → Character). It roams around your panes (or keeps to the bottom), naps
 * when you step away, barks if it's a dog, loves a pat, plays on a double-click, and can be
 * dragged to another pane. Commands: "Tilefold Pet: Show or hide", "Tilefold Pet:
 * Come here" and "Tilefold Pet: Nap or wake up".
 *
 * Built on overlays (permission window.overlay): the tile describes a
 * scene and Tilefold draws it, so nothing of the tile runs in the window
 * and the pet can never take your typing or see your terminal.
 *
 * This tile is written as several files under src/ (this entry, the
 * behaviour, and one file per character) and bundled into main.js with
 * `npx @tilefold/tile-tools build`.
 */
import { CHARACTERS, DEFAULT_CHARACTER } from "./characters/index.js";
import { runPet } from "./pet.js";

export default (tf) => {
  tf.setting("character", DEFAULT_CHARACTER, tf.t("setting-character"), {
    choices: CHARACTERS.map((c) => ({ value: c.id, label: tf.t(c.label) })),
  });
  tf.setting("roam", "pane", tf.t("setting-roam"), {
    choices: [
      { value: "pane", label: tf.t("setting-roam-pane") },
      { value: "floor", label: tf.t("setting-roam-floor") },
    ],
  });
  tf.setting("name", "", tf.t("setting-name"));
  tf.setting("size", 48, tf.t("setting-size"));
  tf.setting("speech", true, tf.t("setting-speech"));
  tf.setting("bark", true, tf.t("setting-bark"));
  tf.setting("sleepAfterIdle", 5, tf.t("setting-sleep-after"));
  runPet(tf);
};
