/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Brickfold — the game's moves and sounds
 *
 * What the arcade kit needs from this game besides its engine and drawing:
 * the moves (each a command with its own Ctrl+Alt keys, and a button under
 * the board) and the tones played for the game's moments. The keys sit
 * together on the keyboard: [ and ] move the paddle, \ launches the ball.
 */

/** The game's moves. */
export const MOVES = [
  {
    id: "left",
    title: "cmd-left",
    action: "left",
    key: { mac: "Ctrl+Alt+BracketLeft", other: "Ctrl+Alt+BracketLeft" },
    icon: "left",
    label: "button-left",
  },
  {
    id: "launch",
    title: "cmd-launch",
    action: "launch",
    key: { mac: "Ctrl+Alt+Backslash", other: "Ctrl+Alt+Backslash" },
    icon: "launch",
    label: "button-launch",
  },
  {
    id: "right",
    title: "cmd-right",
    action: "right",
    key: { mac: "Ctrl+Alt+BracketRight", other: "Ctrl+Alt+BracketRight" },
    icon: "right",
    label: "button-right",
  },
];

/** Retro tones for the game's moments (see tile/sound.js). */
export const SOUNDS = {
  brick: { from: 880, to: 990, ms: 60, wave: "square", volume: 0.2 },
  lose: { from: 330, to: 90, ms: 500, wave: "triangle" },
  level: [
    { from: 523, ms: 90, wave: "triangle" },
    { from: 659, ms: 90, wave: "triangle" },
    { from: 784, ms: 90, wave: "triangle" },
    { from: 1047, ms: 180, wave: "triangle" },
  ],
  over: { from: 392, to: 98, ms: 800, wave: "triangle" },
};

/**
 * The sound for an engine event, if any. Only broken bricks sound; the
 * paddle and cracking bounce too often to be worth a tone each.
 *
 * @param {{ type: string, broken?: boolean }} event
 * @returns {string | undefined}
 */
export function soundFor(event) {
  if (event.type === "brick") return event.broken ? "brick" : undefined;
  return ["lose", "level", "over"].includes(event.type) ? event.type : undefined;
}
