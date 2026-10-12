/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — commands and their shortcuts
 *
 * Tiles never receive key presses, so the game is played through commands:
 * each move is a palette command with a default shortcut, and Tilefold runs
 * it when the user presses those keys. Every shortcut uses Ctrl+Alt (⌃⌥ on
 * macOS), which Tilefold's own defaults leave free and which plain typing
 * never produces; the arrows move and rotate, Enter drops. Users can change
 * any of them in Settings → Keyboard.
 *
 * macOS keeps ⌃⌥Space for switching input sources, which is why the hard
 * drop is on Enter rather than Space.
 */

/**
 * Every command: a stable id (shortcuts and the palette keep it across
 * languages), the message key of its title, the session action it runs,
 * and its default keys.
 *
 * @type {{ id: string, title: string, action: string, key: { mac: string, other: string } }[]}
 */
export const COMMANDS = [
  {
    id: "new-game",
    title: "cmd-new-game",
    action: "newGame",
    key: { mac: "Ctrl+Alt+N", other: "Ctrl+Alt+N" },
  },
  {
    id: "pause",
    title: "cmd-pause",
    action: "pause",
    key: { mac: "Ctrl+Alt+P", other: "Ctrl+Alt+P" },
  },
  {
    id: "toggle",
    title: "cmd-toggle",
    action: "toggle",
    key: { mac: "Ctrl+Alt+G", other: "Ctrl+Alt+G" },
  },
  {
    id: "left",
    title: "cmd-left",
    action: "left",
    key: { mac: "Ctrl+Alt+ArrowLeft", other: "Ctrl+Alt+ArrowLeft" },
  },
  {
    id: "right",
    title: "cmd-right",
    action: "right",
    key: { mac: "Ctrl+Alt+ArrowRight", other: "Ctrl+Alt+ArrowRight" },
  },
  {
    id: "rotate",
    title: "cmd-rotate",
    action: "rotate",
    key: { mac: "Ctrl+Alt+ArrowUp", other: "Ctrl+Alt+ArrowUp" },
  },
  {
    id: "rotate-back",
    title: "cmd-rotate-back",
    action: "rotateBack",
    key: { mac: "Ctrl+Alt+Z", other: "Ctrl+Alt+Z" },
  },
  {
    id: "soft-drop",
    title: "cmd-soft-drop",
    action: "softDrop",
    key: { mac: "Ctrl+Alt+ArrowDown", other: "Ctrl+Alt+ArrowDown" },
  },
  {
    id: "hard-drop",
    title: "cmd-hard-drop",
    action: "hardDrop",
    key: { mac: "Ctrl+Alt+Enter", other: "Ctrl+Alt+Enter" },
  },
  {
    id: "hold",
    title: "cmd-hold",
    action: "hold",
    key: { mac: "Ctrl+Alt+C", other: "Ctrl+Alt+C" },
  },
];

/**
 * Registers every command with Tilefold. `run(action)` is called when one
 * fires; it must return quickly (a command has ten seconds, but the game
 * wants every move to feel instant).
 *
 * @param {any} tf The tile API.
 * @param {(action: string) => unknown} run
 */
export function registerCommands(tf, run) {
  for (const c of COMMANDS) {
    tf.command(tf.t(c.title), () => run(c.action), { id: c.id, key: c.key });
  }
}
