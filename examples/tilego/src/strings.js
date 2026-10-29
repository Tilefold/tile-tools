/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — the page's text
 *
 * Every message the page shows, by key. The tile translates them all and
 * sends them with `setup`; where a message has a `{ $name }`, `{ $code }`,
 * `{ $cell }`, `{ $black }`, `{ $white }` or `{ $margin }`, the page gets
 * `{name}` (and so on) there and fills it in itself: the other player's
 * name, the game code, the point just played, the two scores and the
 * winning margin.
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
  "lobby-size",
  "size-nine",
  "size-thirteen",
  "size-nineteen",
  "lobby-new",
  "lobby-agent",
  "agent-name",
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
  "action-undo",
  "action-pass",
  "action-accept",
  "undo-waiting",
  "undo-offered",
  "undo-allow",
  "undo-decline",
  "undo-declined",
  "rematch-offered",
  "rematch-accept",
  "rematch-waiting",
  "scoring-hint",
  "scoring-hint-agent",
  "score-line",
  "accept-waiting",
  "accept-theirs",
  "lead-chances",
  "lead-black",
  "lead-white",
  "lead-hint",
  "status-connecting",
  "status-reconnecting",
  "status-your-turn",
  "status-their-turn",
  "status-agent-turn",
  "status-they-passed",
  "status-agent-passed",
  "status-scoring",
  "status-away",
  "status-gone",
  "status-won",
  "status-lost",
  "result-you-resigned",
  "result-they-resigned",
  "player-you",
  "stone-black",
  "stone-white",
  "board-label",
  "cell-empty",
  "cell-black",
  "cell-white",
  "cell-black-dead",
  "cell-white-dead",
  "cell-black-area",
  "cell-white-area",
  "error-no-name",
  "error-bad-code",
  "error-no-room",
  "error-room-full",
  "error-room-gone",
  "error-offline",
  "error-server",
];

/** What the page fills in itself, passed so the message keeps a mark for it. */
const MARKS = {
  name: "{name}",
  code: "{code}",
  cell: "{cell}",
  black: "{black}",
  white: "{white}",
  margin: "{margin}",
};

/** The page's text in the user's language. */
export const pageLabels = (tf) =>
  Object.fromEntries(PAGE_KEYS.map((key) => [key, tf.t(key, MARKS)]));

/** The notice for each thing the other player (or the agent) can do, by the page's `kind`. */
export const NOTICE_KEYS = {
  joined: "notice-joined",
  moved: "notice-moved",
  passed: "notice-passed",
  scoring: "notice-scoring",
  accepted: "notice-accepted",
  left: "notice-left",
  rematch: "notice-rematch",
  over: "notice-over",
  "agent-moved": "notice-agent-moved",
  "agent-passed": "notice-agent-passed",
  undo: "notice-undo",
};
