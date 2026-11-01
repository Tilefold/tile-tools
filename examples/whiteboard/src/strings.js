/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — the page's text
 *
 * Every message the page shows, by key. The tile translates them all and
 * sends them with `setup`; where a message has a `{ $n }` or `{ $total }`,
 * the page gets `{n}` (or `{total}`) there and fills it in itself.
 */

/** The page's message keys. */
export const PAGE_KEYS = [
  "page-lang",
  "page-dir",
  "page-title",
  "page-close",
  "step-back",
  "step-next",
  "step-count",
  "step-start",
  "zoom-fit",
  "zoom-actual",
  "empty-title",
  "empty-hint",
  "ask-placeholder",
  "ask-send",
  "ask-hint",
  "ask-sent",
  "ask-card",
  "ask-heard",
  "ask-line",
  "ask-shape",
  "ask-clear",
  "board-label",
  "scene-hint",
  "scene-move",
  "scene-fold",
  "scene-unfold",
  "scene-untitled",
  "scene-mark",
  "scene-marking",
  "ask-area",
];

/** What the page fills in itself, passed so the message keeps a mark for it. */
const MARKS = { n: "{n}", total: "{total}" };

/** The page's text in the user's language. */
export const pageLabels = (tf) =>
  Object.fromEntries(PAGE_KEYS.map((key) => [key, tf.t(key, MARKS)]));
