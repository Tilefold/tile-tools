/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — what agents are doing
 *
 * Turns the markers found (marker.js) into events and answers what the
 * views ask: which files an agent is on right now (active: within the
 * "active" window), the latest action on each file, the folders holding
 * active files (hot), and the recent files, newest first, each once.
 * Times are passed in, so it is tested directly.
 */
import { ancestors, isInside, join, placedPath } from "./paths.js";

/** Each action's theme tone in the panel. */
export const TONES = Object.freeze({ r: "info", e: "warning", a: "success", d: "error" });
/** Most events kept in memory. */
export const MAX_EVENTS = 500;

/**
 * Events from markers found under project folders: `found` is a list of
 * { root, marker } (root: the folder holding .foldertree). Newest first,
 * at most MAX_EVENTS; the same marker found twice counts once.
 */
export function toEvents(found) {
  const seen = new Set();
  const events = [];
  for (const { root, marker } of found) {
    if (!marker?.path) continue;
    const abs = join(root, marker.path);
    const key = `${marker.ts}.${marker.nonce}.${abs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      ts: marker.ts,
      action: marker.action,
      pane: marker.pane,
      session: marker.session ?? null,
      abs,
      key,
    });
  }
  events.sort((a, b) => b.ts - a.ts || (a.key < b.key ? 1 : -1));
  return events.slice(0, MAX_EVENTS);
}

/**
 * `events` with each pane called by the name the user gave it in Tilefold,
 * found from the event's session in `panes` (tf.pane.list()); events from
 * a pane without a name, or one no longer open, keep the agent's name.
 */
export function namedByPane(events, panes = []) {
  const names = new Map();
  for (const p of panes) if (p?.session && p.name) names.set(p.session, p.name);
  if (!names.size) return events;
  return events.map((e) =>
    e.session && names.has(e.session) ? { ...e, pane: names.get(e.session) } : e,
  );
}

/** `events` with the path each is shown by (`shown`; see placedPath). */
export const withShownPaths = (events, root, places = []) =>
  events.map((e) => ({ ...e, shown: placedPath(e.abs, root, places) }));

/** The latest event per file, newest first. */
export function latestPerFile(events) {
  const out = new Map();
  for (const e of events) if (!out.has(e.abs)) out.set(e.abs, e);
  return [...out.values()];
}

/** Files acted on within `activeMs` of `now`, newest first. */
export const activeFiles = (events, now, activeMs) =>
  latestPerFile(events).filter((e) => now - e.ts <= activeMs);

/**
 * Folders under `root` holding active files, with how many: a closed
 * folder in the tree shows it is busy. The root itself is left out.
 */
export function hotFolders(active, root) {
  const out = new Map();
  if (!root) return out;
  for (const e of active) {
    for (const dir of ancestors(e.abs, 64)) {
      if (!isInside(dir, root) || dir === root) break;
      out.set(dir, (out.get(dir) ?? 0) + 1);
    }
  }
  return out;
}

/** Recent files (deleted ones too), newest first, each once, at most `limit`. */
export const recentFiles = (events, limit) => latestPerFile(events).slice(0, limit);

/** How many different panes the events came from. */
export const paneCount = (events) => new Set(events.map((e) => e.pane)).size;

/** `ms` as a short age: { unit: "s" | "m" | "h" | "d", n }. */
export function age(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return { unit: "s", n: s };
  if (s < 3600) return { unit: "m", n: Math.floor(s / 60) };
  if (s < 86400) return { unit: "h", n: Math.floor(s / 3600) };
  return { unit: "d", n: Math.floor(s / 86400) };
}
