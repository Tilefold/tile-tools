/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Orbit Guard — the game's moves and sounds
 *
 * What the arcade kit needs from this game besides its engine and drawing:
 * the moves (each a command with its own Ctrl+Alt keys, and a button under
 * the board) and the tones played for the game's moments.
 */

/** The game's moves: commands with their own Ctrl+Alt keys, and their buttons. */
export const MOVES = [
  {
    id: "left",
    title: "cmd-left",
    action: "left",
    key: { mac: "Ctrl+Alt+Comma", other: "Ctrl+Alt+Comma" },
    icon: "left",
    label: "button-left",
  },
  {
    id: "fire",
    title: "cmd-fire",
    action: "fire",
    key: { mac: "Ctrl+Alt+Slash", other: "Ctrl+Alt+Slash" },
    icon: "fire",
    label: "button-fire",
  },
  {
    id: "right",
    title: "cmd-right",
    action: "right",
    key: { mac: "Ctrl+Alt+Period", other: "Ctrl+Alt+Period" },
    icon: "right",
    label: "button-right",
  },
];

/** Retro tones for the game's moments (see tile/sound.js). */
export const SOUNDS = {
  hit: { from: 520, to: 180, ms: 90, wave: "noise", volume: 0.25 },
  ship: [
    { from: 660, ms: 70 },
    { from: 880, ms: 70 },
    { from: 1320, ms: 120 },
  ],
  die: { from: 300, to: 60, ms: 450, wave: "noise", volume: 0.4 },
  wave: [
    { from: 440, ms: 90, wave: "triangle" },
    { from: 660, ms: 90, wave: "triangle" },
    { from: 880, ms: 160, wave: "triangle" },
  ],
  over: { from: 440, to: 110, ms: 700, wave: "triangle" },
};

/** The sound for an engine event, if any (firing is too frequent to sound). */
export function soundFor(event) {
  return ["hit", "ship", "die", "wave", "over"].includes(event.type) ? event.type : undefined;
}
