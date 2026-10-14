/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the videos watched lately
 *
 * A short list, newest first, kept in `tf.store` so it survives a restart.
 * Each entry is a video id (checked with the same reader the page uses)
 * and its title, cut to a sensible length. Watching a video again moves it
 * to the top; the list never grows past MAX_RECENT, so the oldest video
 * drops off the end.
 */
import { isVideoId } from "../../page-src/links.js";

/** How many videos the list keeps. */
export const MAX_RECENT = 12;

/** Longest title kept, in characters. */
export const MAX_TITLE = 200;

/** A title as stored: a trimmed string, at most MAX_TITLE characters. */
const cleanTitle = (title) => (typeof title === "string" ? title.trim().slice(0, MAX_TITLE) : "");

/**
 * The list as read from storage, with anything malformed left out.
 *
 * @param {unknown} stored
 * @returns {{ id: string, title: string }[]}
 */
export function readRecent(stored) {
  if (!Array.isArray(stored)) return [];
  const seen = new Set();
  const out = [];
  for (const v of stored) {
    if (!v || !isVideoId(v.id) || seen.has(v.id)) continue;
    seen.add(v.id);
    out.push({ id: v.id, title: cleanTitle(v.title) });
    if (out.length === MAX_RECENT) break;
  }
  return out;
}

/**
 * The list with `video` at the top. A malformed video leaves it as it is.
 *
 * @param {{ id: string, title: string }[]} list
 * @param {{ id: unknown, title?: unknown }} video
 * @returns {{ id: string, title: string }[]}
 */
export function addRecent(list, video) {
  if (!video || !isVideoId(video.id)) return list;
  const entry = { id: video.id, title: cleanTitle(video.title) };
  return [entry, ...list.filter((v) => v.id !== entry.id)].slice(0, MAX_RECENT);
}
