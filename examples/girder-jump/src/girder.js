/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Girder Jump — the game's moves and sounds
 *
 * What the arcade kit needs from this game besides its engine and drawing:
 * the moves (each a command with its own keys, and a button under the
 * board) and the tones played for the game's moments. The moves use
 * Ctrl+Alt+Shift with the arrow keys and Enter (⌃⌥⇧ on macOS), so they
 * never clash with Tilefall's Ctrl+Alt arrows when both tiles are on.
 */

/** The game's moves, in the order their buttons appear. */
export const MOVES = [
  {
    id: "left",
    title: "cmd-left",
    action: "left",
    key: { mac: "Ctrl+Alt+Shift+ArrowLeft", other: "Ctrl+Alt+Shift+ArrowLeft" },
    icon: "left",
    label: "button-left",
  },
  {
    id: "up",
    title: "cmd-up",
    action: "up",
    key: { mac: "Ctrl+Alt+Shift+ArrowUp", other: "Ctrl+Alt+Shift+ArrowUp" },
    icon: "up",
    label: "button-up",
  },
  {
    id: "jump",
    title: "cmd-jump",
    action: "jump",
    key: { mac: "Ctrl+Alt+Shift+Enter", other: "Ctrl+Alt+Shift+Enter" },
    icon: "jump",
    label: "button-jump",
  },
  {
    id: "down",
    title: "cmd-down",
    action: "down",
    key: { mac: "Ctrl+Alt+Shift+ArrowDown", other: "Ctrl+Alt+Shift+ArrowDown" },
    icon: "down",
    label: "button-down",
  },
  {
    id: "right",
    title: "cmd-right",
    action: "right",
    key: { mac: "Ctrl+Alt+Shift+ArrowRight", other: "Ctrl+Alt+Shift+ArrowRight" },
    icon: "right",
    label: "button-right",
  },
];

/** Retro tones for the game's moments (see tile/sound.js). */
export const SOUNDS = {
  jump: { from: 330, to: 660, ms: 120, wave: "square", volume: 0.2 },
  leap: [
    { from: 988, ms: 60 },
    { from: 1319, ms: 100 },
  ],
  die: { from: 400, to: 80, ms: 600, wave: "noise", volume: 0.35 },
  clear: [
    { from: 523, ms: 100, wave: "triangle" },
    { from: 659, ms: 100, wave: "triangle" },
    { from: 784, ms: 100, wave: "triangle" },
    { from: 1047, ms: 100, wave: "triangle" },
    { from: 1319, ms: 220, wave: "triangle" },
  ],
  over: { from: 330, to: 82, ms: 900, wave: "triangle" },
};

/**
 * The sound for an engine event, if any (the robot's throws stay silent).
 *
 * @param {{ type: string }} event
 * @returns {string | undefined}
 */
export function soundFor(event) {
  return ["jump", "leap", "die", "clear", "over"].includes(event.type) ? event.type : undefined;
}
