/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web Preview — the addresses to preview
 *
 * The address setting may hold several addresses, separated by commas,
 * spaces or new lines (`localhost:5173, localhost:3000`): one page each.
 * A port alone (`3000`, or `:3000`) means that port on this computer
 * (`localhost:3000`), so `5173, 3000` is enough.
 * The first opens on the tile's first page (`tf.browser`); every other one
 * on a page of its own (`tf.browser.page(name)`), named after its port
 * ("3000"), or after its host when it has none, so AI agents and the user
 * can tell them apart. Pure functions, so they can be tested alone.
 */

/** Most pages opened at once. */
export const MAX_PAGES = 6;

/** Longest page name Tilefold accepts. */
const MAX_NAME = 32;

/** A port alone (1 to 65535, with or without a leading colon). */
const PORT_ONLY = /^:?(\d{1,5})$/;

/** `text` as an address: a port alone becomes that port on localhost. */
export function expandAddress(text) {
  const port = PORT_ONLY.exec(text)?.[1];
  if (port && Number(port) >= 1 && Number(port) <= 65535) return `localhost:${Number(port)}`;
  return text;
}

/** The addresses in the setting, trimmed, once each, at most MAX_PAGES. */
export function readAddresses(value) {
  if (typeof value !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const part of value.split(/[\s,]+/)) {
    const address = expandAddress(part.trim());
    if (!address || seen.has(address.toLowerCase())) continue;
    seen.add(address.toLowerCase());
    out.push(address);
    if (out.length === MAX_PAGES) break;
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
