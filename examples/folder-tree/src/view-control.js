/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — choosing what the tree shows
 *
 * Holds the view (view.js) for the running tile: it is read back from the
 * tile's storage once, before the tree first shows; Pin, Follow the pane,
 * Show only this folder and Up change it, keep it, record the change in
 * the activity log (never a path) and show the new folder. The session
 * (session.js) asks it which folder to show and how to describe the view.
 */
import {
  followView,
  isPinned,
  pinView,
  reachable,
  restoreView,
  rootFor,
  upFrom,
  VIEW_KEY,
} from "./view.js";

/**
 * The view control for `tf`. `ctx`: `places()` (every pane's folder),
 * `root()` (the folder the tree shows), `target(id)` (what a row stands
 * for), `chosen()` (the row the user last chose), `showing()` (the panel or
 * window is up), `restart(root)` (show `root` from scratch).
 */
export function createViewControl(tf, ctx) {
  let view = followView();
  /** The focused pane's folder, as last heard. */
  let paneFolder = null;
  const ready = tf.store
    .get(VIEW_KEY)
    .then((saved) => void (view = restoreView(saved)))
    .catch(() => undefined);

  /** Changes the view to `next`, keeps it, records `action`, and shows it. */
  const change = async (next, action) => {
    await ready;
    view = next;
    await tf.store.set(VIEW_KEY, { ...view });
    await tf.audit(action, {});
    if (!ctx.showing()) return undefined;
    return ctx.restart(rootFor(view, paneFolder ?? (await tf.pane.cwd())));
  };

  const control = {
    /** True while the tree is pinned. */
    pinned: () => isPinned(view),
    /** The folder to show now: the pinned one, or the focused pane's. */
    async root() {
      await ready;
      paneFolder = await tf.pane.cwd();
      return rootFor(view, paneFolder);
    },
    /** The focused pane moved to `path`; true when the tree should follow it. */
    paneMoved(path) {
      paneFolder = path;
      return !isPinned(view);
    },
    /** The view as the panel and window draw it. */
    info() {
      if (!isPinned(view)) return { pinned: false };
      const all = [...ctx.places(), paneFolder];
      return {
        pinned: true,
        up: upFrom(view.folder, all),
        gone: reachable(view.folder, all) === false,
      };
    },
    /** Keeps showing the tree's folder, whatever the panes do. */
    pin() {
      const root = ctx.root();
      return root ? change(pinView(root), "pinned") : tf.toast(tf.t("error-no-folder"));
    },
    /** Follows the focused pane's folder again. */
    follow: () => change(followView(), "followed"),
    /** Shows only folder `id` (the chosen row by default), pinned. */
    showOnly(id = ctx.chosen()) {
      const target = id ? ctx.target(id) : null;
      if (target?.kind !== "dir") return tf.toast(tf.t("error-choose-folder"));
      return change(pinView(target.path), "rerooted");
    },
    /** Shows the folder above the pinned one, while a pane still reaches it. */
    up() {
      const above = control.info().up;
      return above ? change(pinView(above), "rerooted") : undefined;
    },
  };
  return control;
}
