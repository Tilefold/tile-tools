/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the pinned folders
 *
 * The folders the user pinned, listed in the panel like Web View's pages:
 * at most MAX_PINS, in the user's own order (a new pin goes last), each an
 * absolute path the view may hold (view.js). The list is kept between
 * launches and checked when read back: anything unusable or repeated is
 * dropped. A Folder Tree 2.2.0 view pinned on a folder becomes the list's
 * first pin. Two pins with the same folder name are told apart by the
 * folder they are in ("src · api"). Plain data in and out, so it is tested
 * directly.
 */
import { basename, normalize, parent } from "./paths.js";
import { usable } from "./view.js";

/** Where the list is kept between launches. */
export const PINS_KEY = "pins";
/** Most folders the list holds. */
export const MAX_PINS = 12;

/**
 * The list kept between launches (`saved`), checked. With none kept yet,
 * a 2.2.0 view (`legacyView`) pinned on a folder becomes the first pin.
 */
export function restorePins(saved, legacyView = null) {
  if (!Array.isArray(saved)) {
    const folder = legacyView?.mode === "pinned" ? legacyView.folder : null;
    return usable(folder) ? [normalize(folder)] : [];
  }
  const pins = [];
  for (const folder of saved) {
    if (pins.length >= MAX_PINS) break;
    if (!usable(folder)) continue;
    const path = normalize(folder);
    if (!pins.includes(path)) pins.push(path);
  }
  return pins;
}

/**
 * `pins` with `folder` added last: { pins } when it was added, or
 * { error } with error "unusable", "already" or "full".
 */
export function addPin(pins, folder) {
  if (!usable(folder)) return { error: "unusable" };
  const path = normalize(folder);
  if (pins.includes(path)) return { error: "already" };
  if (pins.length >= MAX_PINS) return { error: "full" };
  return { pins: [...pins, path] };
}

/** `pins` without `folder`. */
export const removePin = (pins, folder) => pins.filter((p) => p !== folder);

/** `pins` with `folder` moved `delta` places, kept inside the list. */
export function movePin(pins, folder, delta) {
  const from = pins.indexOf(folder);
  if (from < 0) return pins;
  const to = Math.max(0, Math.min(pins.length - 1, from + delta));
  if (to === from) return pins;
  const next = pins.slice();
  next.splice(from, 1);
  next.splice(to, 0, folder);
  return next;
}

/** Each pin's name by path: its folder name, plus its parent's when two read the same. */
export function pinLabels(pins) {
  const count = new Map();
  for (const p of pins) count.set(basename(p), (count.get(basename(p)) ?? 0) + 1);
  return new Map(
    pins.map((p) => [
      p,
      count.get(basename(p)) > 1 ? `${basename(p)} · ${basename(parent(p))}` : basename(p),
    ]),
  );
}
