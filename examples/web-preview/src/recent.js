/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web Preview — the list of recent pages
 *
 * Pure functions, so they are tested on their own: remembering a page the
 * browser went to (newest first, one entry per address, at most MAX_RECENT,
 * blank pages skipped), reading a stored list back safely, turning it into
 * the rows of the docked panel, and naming the message for an error.
 */

/** Most pages remembered. */
export const MAX_RECENT = 12;

/** Longest title kept, in characters. */
const MAX_TITLE = 120;

/** Prefix of a panel row id that opens a recent page. */
export const ROW_PREFIX = "page:";

/** True for an address worth remembering (a web page, not a blank one). */
export function isPage(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) && url.length <= 4096;
}

/** A stored list read back, keeping only well-formed entries. */
export function readRecent(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e) => e && isPage(e.url) && typeof e.title === "string")
    .slice(0, MAX_RECENT)
    .map((e) => ({ url: e.url, title: e.title.slice(0, MAX_TITLE) }));
}

/**
 * The list with `page` first: an address already there moves up (keeping
 * a title it had when the new one is empty), and the oldest falls off.
 */
export function remember(list, page) {
  if (!isPage(page?.url)) return list;
  const old = list.find((e) => e.url === page.url);
  const title = (page.title || old?.title || "").slice(0, MAX_TITLE);
  return [{ url: page.url, title }, ...list.filter((e) => e.url !== page.url)].slice(0, MAX_RECENT);
}

/** The address without its scheme, for a short label. */
export function shortAddress(url) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** The docked panel's rows: one per recent page, its title or address. */
export function panelRows(list) {
  return list.map((e) => ({
    id: `${ROW_PREFIX}${e.url}`.slice(0, 1024),
    label: (e.title || shortAddress(e.url)).slice(0, 256) || e.url.slice(0, 256),
    icon: "link",
    hint: e.url.slice(0, 512),
  }));
}

/** The message for an error from tf.browser, told apart by its name. */
export function errorKey(err) {
  return err?.name === "BrowserError" ? "error-refused" : "error-failed";
}
