/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the page's text
 *
 * Every message the page shows, by key. The tile translates them all and
 * sends them with `setup`; where a message has a `{ $name }`, `{ $code }`
 * or `{ $cell }`, the page gets `{name}`, `{code}` or `{cell}` there and
 * fills it in itself (the name of the other player, the game code, the
 * point just played).
 */

/** The page's message keys. */
export const PAGE_KEYS = [
  "page-lang",
  "page-dir",
  "page-title",
  "page-close",
  "lobby-intro",
  "lobby-name",
  "lobby-name-hint",
  "lobby-new",
  "lobby-code",
  "lobby-code-hint",
  "lobby-join",
  "waiting-title",
  "waiting-hint",
  "waiting-copy",
  "waiting-copied",
  "action-cancel",
  "action-resign",
  "action-rematch",
  "action-leave",
  "rematch-offered",
  "rematch-accept",
  "rematch-waiting",
  "status-connecting",
  "status-reconnecting",
  "status-your-turn",
  "status-their-turn",
  "status-away",
  "status-gone",
  "status-won",
  "status-lost",
  "status-draw",
  "result-you-resigned",
  "result-they-resigned",
  "player-you",
  "stone-black",
  "stone-white",
  "board-label",
  "cell-empty",
  "cell-black",
  "cell-white",
  "error-no-name",
  "error-bad-code",
  "error-no-room",
  "error-room-full",
  "error-room-gone",
  "error-offline",
  "error-server",
];

/** What the page fills in itself, passed so the message keeps a mark for it. */
const MARKS = { name: "{name}", code: "{code}", cell: "{cell}" };

/** The page's text in the user's language. */
export const pageLabels = (tf) =>
  Object.fromEntries(PAGE_KEYS.map((key) => [key, tf.t(key, MARKS)]));

/** The notice for each thing the other player can do, by the page's `kind`. */
export const NOTICE_KEYS = {
  joined: "notice-joined",
  moved: "notice-moved",
  left: "notice-left",
  rematch: "notice-rematch",
  over: "notice-over",
};
