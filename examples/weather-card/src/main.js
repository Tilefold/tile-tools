/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card
 *
 * Today's weather in a corner of the focused pane: the sky and temperature
 * now and the next four hours, for a place the user types, from Open-Meteo
 * (free, no key). Optionally, Claude adds one line about what the coming
 * hours mean for the user's day.
 *
 * It shows three things a tile can do from Tilefold 0.1.6 on:
 * - `tf.net.fetch` against two public hosts, each asked for with a
 *   `net:` permission and a reason;
 * - `tf.ai.ask` with the fast model, a small token limit and the user's
 *   language, where "Don't send" is a choice and not a failure;
 * - an overlay card that follows the focused pane, kept fresh only while
 *   it is shown.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
import { runWeatherCard } from "./tile/run.js";
import { registerSettings } from "./tile/settings.js";

export default (tf) => {
  registerSettings(tf);
  runWeatherCard(tf);
};
