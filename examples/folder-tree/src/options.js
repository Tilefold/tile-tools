/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — settings and messages
 *
 * The tile's settings as the views take them, a short message for an error
 * from Tilefold in the user's language (anything unexpected also goes to
 * the tile's log), and the check every string a window message carries
 * goes through.
 *
 * Modified 2026-11-04 (viewer's file): where the Recent and Folders
 *   sections' open/closed choices are kept (loadUi, saveUi) moved here.
 *
 * Last updated by: Tilefold
 */
import { canEdit } from "./edits.js";
import { parseSkip } from "./tree.js";

/** Where the Recent and Folders sections' open/closed choices are kept. */
const UI_KEY = "ui";

/** Fills `ui` with the choices the user left the sections in (once read). */
export function loadUi(tf, ui) {
  return tf.store.get(UI_KEY).then((saved) => {
    if (saved && typeof saved === "object") {
      ui.recentOpen = saved.recentOpen !== false;
      ui.recentAll = saved.recentAll === true;
      ui.foldersOpen = saved.foldersOpen !== false;
    }
  });
}

/** Keeps the sections' choices for next time. */
export const saveUi = (tf, ui) => tf.store.set(UI_KEY, { ...ui });

/** Longest id or name a window message may carry. */
export const MAX_ARG = 4096;

/** `value` when it is a usable string argument, else null. */
export const arg = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= MAX_ARG ? value : null;

/** The message for an error from Tilefold, by its name. */
const ERROR_KEYS = {
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  UnreadableError: "error-unreadable",
  RateLimitError: "error-busy",
};

/** A short message for `err`, in the user's language. */
export function explainError(tf, err) {
  const key = ERROR_KEYS[err?.name];
  if (!key) void tf.log.warn(`Folder Tree: ${err?.name ?? "Error"}: ${err?.message ?? err}`);
  return tf.t(key ?? "error-other");
}

/** The settings, as the views take them, with the panel's own choices `ui`. */
export function readOptions(tf, ui) {
  return {
    activeMs: Math.max(5, Number(tf.settings.get("activeSeconds")) || 20) * 1000,
    recentMs: Math.max(1, Number(tf.settings.get("recentMinutes")) || 30) * 60_000,
    showActivity: tf.settings.get("showActivity") !== false,
    filters: {
      showHidden: tf.settings.get("showHidden") === true,
      skip: parseSkip(tf.settings.get("skipFolders")),
    },
    canEdit: canEdit(tf),
    ...ui,
  };
}
