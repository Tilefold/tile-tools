/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — where to pick the video up again
 *
 * Closing the video (the card's or dock's window button, the Close
 * command) closes its page, and with it YouTube's player. So that opening
 * it again carries on where it was, the tile keeps the video's id and the
 * second it had reached, from the page's last status, and asks the page to
 * start there. A video that had (nearly) ended starts again from the top.
 * The point is kept in `tf.store`, so it also survives a restart. Pure:
 * values in, values out.
 */

/** The longest start accepted, in seconds (a day, as for links). */
export const MAX_RESUME = 24 * 60 * 60;
/** Within this many seconds of the end, a video counts as watched to the end. */
export const END_SLACK = 3;

/** YouTube's video ids: eleven letters, digits, `-` or `_`. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** A start second: whole, 0..MAX_RESUME (0 for anything else). */
export function cleanStart(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_RESUME, Math.floor(n));
}

/**
 * The point to resume at from the page's last status (`{ id, time,
 * duration }`, already cleaned), or null when there is none.
 *
 * @param {{ id: string, time: number, duration: number } | null | undefined} status
 * @returns {{ id: string, at: number } | null}
 */
export function resumePoint(status) {
  if (!status || typeof status.id !== "string" || !VIDEO_ID.test(status.id)) return null;
  const at = cleanStart(status.time);
  const ended = status.duration > 0 && at >= status.duration - END_SLACK;
  return { id: status.id, at: ended ? 0 : at };
}

/**
 * A stored resume point checked, or null for anything missing or damaged.
 *
 * @param {unknown} value
 * @returns {{ id: string, at: number } | null}
 */
export function readResume(value) {
  if (!value || typeof value !== "object") return null;
  const { id, at } = /** @type {any} */ (value);
  if (typeof id !== "string" || !VIDEO_ID.test(id)) return null;
  return { id, at: cleanStart(at) };
}
