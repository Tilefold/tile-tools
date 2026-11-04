/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — choosing what the tree shows
 *
 * Holds the view (view.js) and the pinned folders (pins.js) for the
 * running tile: both are read back from the tile's storage once, before
 * the tree first shows; Pin, Follow the pane, Show only this folder, Up,
 * a click on a pin, Unpin and moving a pin change them, keep them, record
 * the change in the activity log (never a path) and show the new folder.
 * The session (session.js) asks it which folder to show and how to
 * describe the view, and hands it the rows, menu choices and window
 * messages that are about the view.
 *
 * Modified 2026-11-03 (pinned folders list): Pin adds the folder to a list
 *   of pinned folders the panel and window show; a pin is shown with a
 *   click, moved up or down, or unpinned; the list is kept as `pins`.
 */
import { addPin, MAX_PINS, movePin, PINS_KEY, removePin, restorePins } from "./pins.js";
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

/** The message for a pin that could not be added, by reason. */
const PIN_ERRORS = { already: "pins-already", full: "pins-full", unusable: "error-choose-folder" };

/**
 * The view control for `tf`. `ctx`: `places()` (every pane's folder),
 * `root()` (the folder the tree shows), `target(id)` (what a row stands
 * for), `chosen()` (the row the user last chose), `showing()` (the panel or
 * window is up), `restart(root)` (show `root` from scratch), `redraw()`.
 */
export function createViewControl(tf, ctx) {
  let view = followView();
  /** The pinned folders, in the user's order. */
  let pins = [];
  /** The focused pane's folder, as last heard. */
  let paneFolder = null;
  const ready = Promise.all([
    tf.store.get(VIEW_KEY).catch(() => null),
    tf.store.get(PINS_KEY).catch(() => null),
  ]).then(([savedView, savedPins]) => {
    view = restoreView(savedView);
    pins = restorePins(savedPins, savedView);
  });

  /** Every pane's folder and the focused one's: what the tile may reach. */
  const reach = () => [...ctx.places(), paneFolder];

  /** Shows the view as it is now, when the tree is up. */
  const reshow = async () => {
    if (!ctx.showing()) return undefined;
    return ctx.restart(rootFor(view, paneFolder ?? (await tf.pane.cwd())));
  };

  /** Changes the view to `next`, keeps it, records `action`, and shows it. */
  const change = async (next, action, details = {}) => {
    await ready;
    view = next;
    await tf.store.set(VIEW_KEY, { ...view });
    await tf.audit(action, details);
    return reshow();
  };

  /** Keeps the list after `action`; redraws (`draw`) or shows the view again. */
  const keepPins = async (next, action, show = false) => {
    pins = next;
    await tf.store.set(PINS_KEY, [...pins]);
    await tf.audit(action, { count: pins.length });
    return show ? reshow() : ctx.redraw();
  };

  /** Pins `folder` and shows it; says why when it can't be pinned. */
  const pinFolder = async (folder) => {
    await ready;
    if (!folder) return tf.toast(tf.t("error-no-folder"));
    const added = addPin(pins, folder);
    if (added.error === "already") return change(pinView(folder), "shown");
    if (added.error) return tf.toast(tf.t(PIN_ERRORS[added.error], { max: MAX_PINS }));
    pins = added.pins;
    await tf.store.set(PINS_KEY, [...pins]);
    return change(pinView(folder), "pinned", { count: pins.length });
  };

  /** Shows pinned folder `folder`, while a pane still reaches it. */
  const showPin = async (folder) => {
    if (!pins.includes(folder)) return undefined;
    if (reachable(folder, reach()) === false) return tf.toast(tf.t("view-gone"));
    return change(pinView(folder), "shown");
  };

  /** Unpins `folder`; when it was shown, the tree follows the pane again. */
  const unpin = async (folder) => {
    if (!pins.includes(folder)) return undefined;
    const wasShown = isPinned(view) && view.folder === folder;
    if (wasShown) {
      view = followView();
      await tf.store.set(VIEW_KEY, { ...view });
    }
    return keepPins(removePin(pins, folder), "unpinned", wasShown);
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
    /**
     * The view as the panel and window draw it: pinned or not, the folder
     * above while a pane reaches it, whether no pane reaches it any more,
     * and the pinned folders (each with whether it is shown, or gone).
     */
    info() {
      const all = reach();
      const shown = isPinned(view) ? view.folder : null;
      const list = pins.map((path) => ({
        path,
        shown: path === shown,
        gone: reachable(path, all) === false,
      }));
      if (!shown) return { pinned: false, pins: list };
      return {
        pinned: true,
        listed: pins.includes(shown),
        up: upFrom(shown, all),
        gone: reachable(shown, all) === false,
        pins: list,
      };
    },
    /** Pins the tree's folder (or `folder`) and keeps showing it, whatever the panes do. */
    pin: (folder = ctx.root()) => pinFolder(folder),
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
    /** Acts on a row about the view (`target`); null when it isn't one. */
    act(target) {
      if (target.kind === "view-follow") return control.follow();
      if (target.kind === "view-up") return control.up();
      if (target.kind === "pin") return showPin(target.path);
      return null;
    },
    /** A menu choice about the view on row `target` (null: the empty space); null when not one. */
    menu(item, target, id) {
      if (item === "show-only") return control.showOnly(id);
      if (item === "follow") return control.follow();
      if (item === "pin") return pinFolder(target?.kind === "dir" ? target.path : ctx.root());
      if (target?.kind !== "pin") return null;
      if (item === "pin-show") return showPin(target.path);
      if (item === "pin-up" || item === "pin-down") {
        const moved = movePin(pins, target.path, item === "pin-up" ? -1 : 1);
        return moved === pins ? undefined : keepPins(moved, "moved");
      }
      if (item === "unpin") return unpin(target.path);
      return null;
    },
    /** A window message about the view (`id`: its checked path); null when not one. */
    message(type, id) {
      if (type === "show-only" && id) return control.showOnly(id);
      if (type === "pin") return control.pin();
      if (type === "follow") return control.follow();
      if (type === "up") return control.up();
      if (type === "show-pin" && id) return showPin(id);
      if (type === "unpin" && id) return unpin(id);
      return null;
    },
  };
  return control;
}
