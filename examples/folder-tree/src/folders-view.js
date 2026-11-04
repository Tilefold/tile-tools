/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the panel's Folders section
 *
 * The section at the top of the panel that says what the tree shows and
 * lists the pinned folders, like Web View's list of pages:
 * - Follow the pane, marked while the tree follows it;
 * - each pinned folder, by name (with the folder it is in when two share a
 *   name), the folder it is in at the row's end, and its full path as the
 *   tooltip; the one shown is marked, one an agent is busy in pulses with
 *   how many files, even while another folder is shown, and one no pane
 *   reaches any more is greyed with a warning;
 * - a folder shown without being pinned (Show only this folder, Up), with
 *   Up while a pane still reaches the folder above;
 * - a note on how to pin, while nothing is pinned;
 * - on a Tilefold that lets tiles ask for folders, a field first: type or
 *   paste a folder's path, or Browse… for one (folder-field.js).
 * The section opens and closes like Recent. Rows about a pin carry the
 * pin's menu (Show, Move up, Move down, Unpin) where Tilefold draws menus.
 * Text comes from `t`, so it is tested directly.
 */
import { fieldRow } from "./folder-field.js";
import { pinLabels } from "./pins.js";
import { isInside, parent } from "./paths.js";
import { clamp } from "./row-marks.js";
import { folderName } from "./tree.js";

/** Longest text at a row's end, as Tilefold allows it. */
const TRAIL_MAX = 32;

/** `text` cut from the left to fit at a row's end ("…/Dev/api"). */
const trailOf = (text) => (text.length > TRAIL_MAX ? `…${text.slice(-(TRAIL_MAX - 1))}` : text);

/**
 * The Folders rows and their targets. `view`: the view control's info();
 * `active`: the files agents are on now; `open`: the section is open;
 * `menus`: Tilefold draws right-click menus.
 */
export function foldersRows(t, { root, view, active, open, menus }) {
  const rows = [];
  const targets = new Map();
  const pins = view?.pins ?? [];
  rows.push({
    id: "folders",
    label: t("section-folders"),
    section: true,
    expandable: true,
    expanded: open,
    ...(pins.length ? { badge: String(pins.length) } : {}),
  });
  targets.set("folders", { kind: "folders" });
  if (!open) return { rows, targets };
  if (view?.ask) rows.push(fieldRow(t));

  const following = !view?.pinned;
  rows.push({
    id: "view-follow",
    label: t("view-follow"),
    icon: "link",
    depth: 1,
    ...(following ? { tone: "accent", trail: t("pin-shown") } : {}),
  });
  targets.set("view-follow", { kind: "view-follow" });

  const labels = pinLabels(pins.map((p) => p.path));
  for (const pin of pins) {
    const id = `pin:${pin.path}`;
    const busy = pin.gone ? 0 : active.filter((e) => isInside(e.abs, pin.path)).length;
    const hint = pin.gone
      ? `${pin.path}\n${t("view-gone")}`
      : busy
        ? `${pin.path}\n${t("hint-busy", { count: busy })}`
        : pin.path;
    let tone = null;
    if (pin.gone) tone = "warning";
    else if (pin.shown) tone = "accent";
    else if (busy) tone = "info";
    rows.push({
      id,
      label: clamp(labels.get(pin.path), 256),
      icon: pin.gone ? "error" : "folder",
      depth: 1,
      hint: clamp(hint, 512),
      trail: pin.shown ? t("pin-shown") : trailOf(parent(pin.path)),
      ...(tone ? { tone } : {}),
      ...(pin.gone ? { muted: true } : {}),
      ...(busy ? { pulse: true, badge: String(busy) } : {}),
      ...(menus ? { menu: "pin" } : {}),
    });
    targets.set(id, { kind: "pin", path: pin.path });
  }

  // A folder shown on its own (Show only, Up) that isn't in the list.
  if (view?.pinned && !view.listed) {
    rows.push({
      id: "view-pinned",
      label: clamp(t("view-showing", { folder: root ? folderName(root) : "" }), 256),
      icon: "folder",
      tone: "accent",
      depth: 1,
      ...(root ? { hint: clamp(root, 512) } : {}),
      ...(menus ? { menu: "shown" } : {}),
    });
    targets.set("view-pinned", { kind: "view-shown", path: root });
    if (view.gone) {
      rows.push({
        id: "view-gone",
        label: t("view-gone"),
        icon: "error",
        tone: "warning",
        depth: 1,
      });
    }
  }
  if (view?.pinned && view.up) {
    rows.push({
      id: "view-up",
      label: clamp(t("view-up", { folder: folderName(view.up) }), 256),
      icon: "folder",
      depth: 1,
    });
    targets.set("view-up", { kind: "view-up" });
  }
  if (!pins.length) {
    rows.push({ id: "pins-empty", label: t("pins-empty"), icon: "none", depth: 1, muted: true });
  }
  return { rows, targets };
}
