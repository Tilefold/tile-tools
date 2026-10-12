/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — commands and their shortcuts
 *
 * Tiles never receive key presses, so every control is a palette command
 * with a default shortcut that Tilefold runs when the user presses it. All
 * of them use Ctrl+Alt (⌃⌥ on macOS) with a letter, chosen to stay clear of
 * Tilefold's own Ctrl+Alt shortcuts (F, H, L, O, W) and of the Tilefall
 * tile's (N, P, G, Z, C, the arrows and Enter), so both tiles can be
 * installed together. Users can change any of them in Settings → Keyboard.
 */

/**
 * Every command: a stable id (shortcuts and the palette keep it across
 * languages), the message key of its title, the action it runs, and its
 * default keys.
 *
 * @type {{ id: string, title: string, action: string, key: { mac: string, other: string } }[]}
 */
export const COMMANDS = [
  {
    id: "toggle",
    title: "cmd-toggle",
    action: "toggle",
    key: { mac: "Ctrl+Alt+M", other: "Ctrl+Alt+M" },
  },
  {
    id: "play-pause",
    title: "cmd-play-pause",
    action: "playPause",
    key: { mac: "Ctrl+Alt+K", other: "Ctrl+Alt+K" },
  },
  {
    id: "previous",
    title: "cmd-previous",
    action: "previous",
    key: { mac: "Ctrl+Alt+B", other: "Ctrl+Alt+B" },
  },
  {
    id: "next",
    title: "cmd-next",
    action: "next",
    key: { mac: "Ctrl+Alt+X", other: "Ctrl+Alt+X" },
  },
  {
    id: "volume-up",
    title: "cmd-volume-up",
    action: "volumeUp",
    key: { mac: "Ctrl+Alt+U", other: "Ctrl+Alt+U" },
  },
  {
    id: "volume-down",
    title: "cmd-volume-down",
    action: "volumeDown",
    key: { mac: "Ctrl+Alt+D", other: "Ctrl+Alt+D" },
  },
  {
    id: "refresh",
    title: "cmd-refresh",
    action: "refresh",
    key: { mac: "Ctrl+Alt+R", other: "Ctrl+Alt+R" },
  },
];

/**
 * Registers every command with Tilefold. `run(action)` is called when one
 * fires; a command has ten seconds, which covers a Spotify round trip.
 *
 * @param {any} tf The tile API.
 * @param {(action: string) => unknown} run
 */
export function registerCommands(tf, run) {
  for (const c of COMMANDS) {
    tf.command(tf.t(c.title), () => run(c.action), { id: c.id, key: c.key });
  }
}
