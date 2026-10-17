/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web Preview — the list of recent pages
 *
 * Pure functions, so they are tested on their own: remembering a page the
 * browser went to (newest first, one entry per address and browser page,
 * at most MAX_RECENT per browser page, blank pages skipped), reading a
 * stored list back safely, turning it into the rows of the docked panel,
 * and naming the message for an error.
 *
 * Each entry keeps the browser page it was seen in (`page`: a page name,
 * or "" for the tile's first page), and its panel row says so, so Tilefold
 * lists each tab's own pages in that tab's panel. Entries stored before
 * this have no page and count as the first page's.
 *
 * Modified 2026-10-17 (each tab's panel lists its own pages): entries and
 * rows keep their browser page.
 *
 * Last updated by: Tilefold
 */

/** Most addresses remembered per browser page, and in all. */
export const MAX_RECENT = 12;
export const MAX_RECENT_ALL = 48;

/** A browser page's name, as Tilefold allows them; "" is the first page. */
const PAGE_NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?)?$/;

/** `page` when it is a page name or "", else "" (the first page). */
export function pageOf(page) {
  return typeof page === "string" && PAGE_NAME.test(page) ? page : "";
}

/** Longest title kept, in characters. */
const MAX_TITLE = 120;

/** Prefix of a panel row id that opens a recent page. */
export const ROW_PREFIX = "page:";

/** True for an address worth remembering (a web page, not a blank one). */
export function isPage(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) && url.length <= 4096;
}

/** Keeps at most MAX_RECENT entries per browser page, MAX_RECENT_ALL in all. */
function cap(list) {
  const seen = new Map();
  return list
    .filter((e) => {
      const n = (seen.get(e.page) ?? 0) + 1;
      seen.set(e.page, n);
      return n <= MAX_RECENT;
    })
    .slice(0, MAX_RECENT_ALL);
}

/** A stored list read back, keeping only well-formed entries. */
export function readRecent(value) {
  if (!Array.isArray(value)) return [];
  return cap(
    value
      .filter((e) => e && isPage(e.url) && typeof e.title === "string")
      .map((e) => ({ url: e.url, title: e.title.slice(0, MAX_TITLE), page: pageOf(e.page) })),
  );
}

/**
 * The list with `seen` first (`{ url, title, page }`): an address already
 * there for the same browser page moves up (keeping a title it had when
 * the new one is empty), and that page's oldest falls off.
 */
export function remember(list, seen) {
  if (!isPage(seen?.url)) return list;
  const page = pageOf(seen.page);
  const same = (e) => e.url === seen.url && e.page === page;
  const old = list.find(same);
  const title = (seen.title || old?.title || "").slice(0, MAX_TITLE);
  return cap([{ url: seen.url, title, page }, ...list.filter((e) => !same(e))]);
}

/** The address without its scheme, for a short label. */
export function shortAddress(url) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** A panel row's id: the browser page and the address. */
export function rowId(entry) {
  return `${ROW_PREFIX}${entry.page}|${entry.url}`;
}

/** The browser page and address of a row id, or null for another row. */
export function readRowId(id) {
  if (typeof id !== "string" || !id.startsWith(ROW_PREFIX)) return null;
  const rest = id.slice(ROW_PREFIX.length);
  const bar = rest.indexOf("|");
  // An id from before pages were kept: the first page.
  if (bar < 0 || !PAGE_NAME.test(rest.slice(0, bar))) return { page: "", url: rest };
  return { page: rest.slice(0, bar), url: rest.slice(bar + 1) };
}

/**
 * The docked panel's rows: one per recent address, its title or address,
 * tied to the browser page it was seen in (each tab lists its own).
 */
export function panelRows(list) {
  return list
    .filter((e) => rowId(e).length <= 1024)
    .map((e) => ({
      id: rowId(e),
      label: (e.title || shortAddress(e.url)).slice(0, 256) || e.url.slice(0, 256),
      icon: "link",
      hint: e.url.slice(0, 512),
      page: e.page,
    }));
}

/** The message for an error from tf.browser, told apart by its name. */
export function errorKey(err) {
  return err?.name === "BrowserError" ? "error-refused" : "error-failed";
}
