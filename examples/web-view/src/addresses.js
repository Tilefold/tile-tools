/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web View — the addresses to preview
 *
 * The address setting may hold several addresses, separated by commas,
 * spaces or new lines (`localhost:5173, localhost:3000`): one page each.
 * A port alone (`3000`, or `:3000`) means that port on this computer
 * (`localhost:3000`), so `5173, 3000` is enough. A range of ports
 * (`3000-3010` or `3000~3010`, also `api.test:8000-8003`) means every port
 * in it, lowest first.
 * The first opens on the tile's first page (`tf.browser`); every other one
 * on a page of its own (`tf.browser.page(name)`), named after its port
 * ("3000"), or after its host when it has none, so AI agents and the user
 * can tell them apart. Pure functions, so they can be tested alone.
 *
 * Modified 2026-10-18 (renamed): Web Preview is now Web View (example.web-view).
 *
 * Modified 2026-10-19 (port ranges): `3000-3010` / `3000~3010` opens a page
 * for every port in the range; at most 12 pages now (was 6).
 *
 * Last updated by: Tilefold
 */

/** Most pages opened at once (a range of 3000 to 3010 is 11). */
export const MAX_PAGES = 12;

/** Longest page name Tilefold accepts. */
const MAX_NAME = 32;

/** A port alone (1 to 65535, with or without a leading colon). */
const PORT_ONLY = /^:?(\d{1,5})$/;

/**
 * A range of ports, `-` or `~` between them, alone or after a host
 * (`3000-3010`, `:3000~3010`, `api.test:8000-8003`).
 */
const PORT_RANGE = /^(?:([^\s/:]+):|:)?(\d{1,5})[-~](\d{1,5})$/;

/** Spaces around a range's `-` or `~` (`3000 ~ 3010`), so it stays one part. */
const RANGE_SPACES = /(\d)\s*([-~])\s*(?=:?\d)/g;

/** Whether `n` is a port number. */
const isPort = (n) => Number.isInteger(n) && n >= 1 && n <= 65535;

/** `text` as an address: a port alone becomes that port on localhost. */
export function expandAddress(text) {
  const port = PORT_ONLY.exec(text)?.[1];
  if (port && isPort(Number(port))) return `localhost:${Number(port)}`;
  return text;
}

/**
 * The addresses one part of the setting stands for: every port of a range
 * (lowest first, either way round, at most `limit` of them), or the part
 * itself as one address. A range with a port out of bounds is kept as
 * typed, so Tilefold refuses it with a reason instead of it vanishing.
 */
export function expandPart(text, limit = MAX_PAGES) {
  const range = PORT_RANGE.exec(text);
  if (range) {
    const [, host = "localhost", a, b] = range;
    const from = Math.min(Number(a), Number(b));
    const to = Math.max(Number(a), Number(b));
    if (isPort(from) && isPort(to)) {
      const out = [];
      for (let port = from; port <= to && out.length < limit; port++) out.push(`${host}:${port}`);
      return out;
    }
  }
  const address = expandAddress(text);
  return address ? [address] : [];
}

/** The addresses in the setting, trimmed, once each, at most MAX_PAGES. */
export function readAddresses(value) {
  if (typeof value !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const part of value.replace(RANGE_SPACES, "$1$2").split(/[\s,]+/)) {
    for (const address of expandPart(part.trim(), MAX_PAGES - out.length)) {
      if (seen.has(address.toLowerCase())) continue;
      seen.add(address.toLowerCase());
      out.push(address);
    }
    if (out.length >= MAX_PAGES) break;
  }
  return out;
}

/** The port of `address`, or its host's first label, as a page name base. */
function baseName(address) {
  let url = null;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(address) ? address : `http://${address}`);
  } catch {
    // Not an address; named from its text below.
  }
  const raw = url ? url.port || url.hostname.split(".")[0] : address;
  const name = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME)
    .replace(/-+$/, "");
  return name || "page";
}

/** `base`, or `base-2`, `base-3`… when it is taken, kept within MAX_NAME. */
function unique(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const name = `${base.slice(0, MAX_NAME - suffix.length)}${suffix}`;
    if (!taken.has(name)) return name;
  }
}

/**
 * The pages to open: the first address on the tile's first page (`page:
 * null`), each other one on a page named after it.
 */
export function planPages(addresses) {
  const taken = new Set();
  return addresses.map((address, i) => {
    if (i === 0) return { address, page: null };
    const page = unique(baseName(address), taken);
    taken.add(page);
    return { address, page };
  });
}
