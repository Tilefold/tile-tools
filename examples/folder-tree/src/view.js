/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — what the tree shows
 *
 * The tree shows one folder, chosen apart from where agents work: it either
 * follows the pane (the folder the focused pane is in, changing with `cd`
 * and pane switches) or stays pinned on a folder the user chose: the one
 * it showed when they pinned it, or a folder they asked to see on its own.
 * Agent activity is read from every pane whatever the tree shows; what
 * happened outside the shown folder is listed apart, as "elsewhere".
 *
 * Tilefold lets the tile reach only folders a pane is in (or inside one),
 * so a pinned folder may become unreachable when the panes move away; Up
 * goes no higher than a pane's folder. A view kept between launches is
 * checked before it is used. Plain data in and out, so it is tested
 * directly.
 */
import { isInside, normalize, parent } from "./paths.js";

/** Where the view is kept between launches. */
export const VIEW_KEY = "view";
/** Longest folder path a kept view may hold. */
const MAX_PATH = 4096;

/** Following the focused pane's folder. */
export const followView = () => ({ mode: "follow", folder: null });

/** Pinned on `folder` (an absolute path), else following. */
export function pinView(folder) {
  return usable(folder) ? { mode: "pinned", folder: normalize(folder) } : followView();
}

/** Whether `folder` is an absolute path the view may hold. */
export function usable(folder) {
  return (
    typeof folder === "string" &&
    folder.startsWith("/") &&
    folder.length <= MAX_PATH &&
    // No control characters (and no bidirectional overrides) in a path to show.
    !/[\u0000-\u001f\u007f‪-‮⁦-⁩]/.test(folder)
  );
}

/** A view kept between launches, checked; anything unusable follows the pane. */
export function restoreView(saved) {
  if (!saved || typeof saved !== "object" || saved.mode !== "pinned") return followView();
  return pinView(saved.folder);
}

/** True when `view` is pinned. */
export const isPinned = (view) => view.mode === "pinned" && typeof view.folder === "string";

/** The folder the tree shows under `view`, when the focused pane is in `paneFolder`. */
export const rootFor = (view, paneFolder) => (isPinned(view) ? view.folder : paneFolder);

/**
 * Whether the tile may reach `folder`: it is a pane's folder or inside one
 * of `places` (every pane's folder). Unknown (null) when no pane is known,
 * as on a Tilefold without `pane.list`.
 */
export function reachable(folder, places) {
  const known = places.filter(Boolean);
  if (!folder || !known.length) return null;
  return known.some((p) => isInside(folder, p));
}

/** The folder above `folder`, when the tile may still reach it; else null. */
export function upFrom(folder, places) {
  if (!folder || folder === "/") return null;
  const up = parent(folder);
  return reachable(up, places) ? up : null;
}

/**
 * `events` (newest first) split by the shown folder `root`: `here` holds
 * what happened inside it, `elsewhere` the rest, each newest first. With
 * no folder shown, everything is here.
 */
export function splitByRoot(events, root) {
  if (!root) return { here: events, elsewhere: [] };
  const here = [];
  const elsewhere = [];
  for (const e of events) (isInside(e.abs, root) ? here : elsewhere).push(e);
  return { here, elsewhere };
}
