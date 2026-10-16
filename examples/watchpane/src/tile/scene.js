/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — where the card goes
 *
 * Two shapes, both placed as one group: in a corner of the focused pane
 * (above its Composer when the corner is at the bottom), or, once the user
 * has dragged it, at the spot they chose in the window (`position`).
 *
 * The card, while no video plays docked: the card with its row of
 * buttons under it and, while it is open, the recent list on the side
 * facing into the window (above or below).
 *
 *     ┌──────────────────────────────┐
 *     │             card             │
 *     └──────────────────────────────┘
 *      [↺]  [▶]  [↻]  [🔊]  [☰]  [⧉]
 *
 * The player (`video`), while the video plays docked in Tilefold's
 * window: the video, and right under it the control dock, as wide as the
 * video (drawn as two halves, `dock-l` and `dock-r`; `dock` is the whole
 * bar). The recent list opens beside them, on the left, or on the right
 * where the left has no room, and is as tall as the overlay allows.
 *
 *     ┌────────┐ ┌──────────────────────┐
 *     │ recent │ │        video         │
 *     │  list  │ │                      │
 *     │        │ └──────────────────────┘
 *     │        │ ┌──────────────────────┐
 *     │        │ │     control dock     │
 *     └────────┘ └──────────────────────┘
 *
 * Pure geometry: the window layout Tilefold reports, the corner setting
 * and the saved position in, rectangles out, by overlay item id, plus
 * `group` (the group's own rectangle, which a drag moves).
 */
import { BUTTON, BUTTONS } from "../render/buttons.js";
import { CARD_H, CARD_W } from "../render/card.js";
import { DOCK_H, DOCK_HALF, DOCK_W } from "../render/dock.js";
import { LIST_ROWS, LIST_W, listHeight } from "../render/list.js";
import { contentOf, placeAt } from "./position.js";

/** The corners the card can sit in. */
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
/** Space between the card, its buttons and the list. */
export const GAP = 6;
/** Space between the video and the control dock under it. */
export const DOCK_GAP = 4;
/** How far the card keeps from the pane's edges. */
export const MARGIN = 12;
/** The docked video's size: 16:9, at YouTube's smallest player height. */
export const VIDEO_W = DOCK_W;
export const VIDEO_H = 200;
/** Rows of the recent list beside the video (as tall as an overlay item may be). */
export const SIDE_LIST_ROWS = 9;

/** The card group's size: the card and its buttons. */
export const CARD_GROUP = { w: CARD_W, h: CARD_H + GAP + BUTTON };
/** The player group's size: the video and the dock under it. */
export const PLAYER_GROUP = { w: VIDEO_W, h: VIDEO_H + DOCK_GAP + DOCK_H };

/** The group's size, for the player (`video`) or the card. */
export const groupSize = (video) => (video ? PLAYER_GROUP : CARD_GROUP);

/** How many rows the recent list has, beside the player or under the card. */
export const listRows = (video) => (video ? SIDE_LIST_ROWS : LIST_ROWS);

/** The corner for a setting value (bottom-right for anything unknown). */
export const cornerOf = (corner) => (CORNERS.includes(corner) ? corner : "bottom-right");

/** The area the card may use: the focused pane down to its Composer, or the window. */
export function areaOf(layout) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  const pane = panes.find((p) => p?.focused) ?? panes[0];
  if (pane) {
    const bottom = pane.composer ? pane.composer.y : pane.y + pane.h;
    return { x: pane.x, y: pane.y, w: pane.w, h: Math.max(0, bottom - pane.y) };
  }
  const content = layout?.content ?? { w: 800, h: 600 };
  return { x: 0, y: 0, w: content.w, h: content.h };
}

/**
 * The group's top-left: at the saved position in the window, or in the
 * pane's corner.
 */
function originOf(layout, at, size, position) {
  if (position) return placeAt(contentOf(layout), size.w, size.h, position);
  const area = areaOf(layout);
  const x = at.endsWith("right") ? area.x + area.w - size.w - MARGIN : area.x + MARGIN;
  const y = at.startsWith("bottom") ? area.y + area.h - size.h - MARGIN : area.y + MARGIN;
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
}

/** The card, its buttons, and the list above or below them. */
function cardScene(rects, g, list, below) {
  rects.card = { x: g.x, y: g.y, w: CARD_W, h: CARD_H };
  // The buttons spread evenly under the card, the outer ones flush with its edges.
  const step = (CARD_W - BUTTON) / (BUTTONS.length - 1);
  BUTTONS.forEach((b, i) => {
    rects[`btn-${b.id}`] = {
      x: Math.round(g.x + i * step),
      y: g.y + CARD_H + GAP,
      w: BUTTON,
      h: BUTTON,
    };
  });
  if (list) {
    const h = listHeight(LIST_ROWS);
    const y = below ? g.y + g.h + GAP : g.y - GAP - h;
    rects.list = { x: g.x, y: Math.max(0, y), w: LIST_W, h };
  }
}

/** The video, the dock under it, and the list beside them. */
function playerScene(rects, g, list, content) {
  rects.video = { x: g.x, y: g.y, w: VIDEO_W, h: VIDEO_H };
  const dockY = g.y + VIDEO_H + DOCK_GAP;
  rects.dock = { x: g.x, y: dockY, w: DOCK_W, h: DOCK_H };
  rects["dock-l"] = { x: g.x, y: dockY, w: DOCK_HALF, h: DOCK_H };
  rects["dock-r"] = { x: g.x + DOCK_HALF, y: dockY, w: DOCK_HALF, h: DOCK_H };
  if (list) {
    const h = listHeight(SIDE_LIST_ROWS);
    const left = g.x - GAP - LIST_W;
    const right = g.x + g.w + GAP;
    // The left side first; the right where the left has no room and the right has.
    const x = left >= 0 || right + LIST_W > content.w ? left : right;
    rects.list = {
      x: Math.max(0, x),
      y: Math.max(0, g.y + Math.round((g.h - h) / 2)),
      w: LIST_W,
      h,
    };
  }
}

/**
 * Every item's rectangle, plus `group`: with `video`, the player (`video`,
 * `dock`, `dock-l`, `dock-r`); without, the card (`card`, `btn-<id>` for
 * each button); with `list`, `list`. `position` is where the user dragged
 * the group (null: the pane's corner). Whole CSS pixels, kept inside the
 * window's top and left edges.
 *
 * @param {any} layout Tilefold's window layout.
 * @param {string} corner The corner setting.
 * @param {{ list?: boolean, video?: boolean, position?: { fx: number, fy: number } | null }} [opts]
 */
export function computeLayout(
  layout,
  corner,
  { list = false, video = false, position = null } = {},
) {
  const at = cornerOf(corner);
  const size = groupSize(video);
  const content = contentOf(layout);
  const o = originOf(layout, at, size, position);
  const g = { x: o.x, y: o.y, w: size.w, h: size.h };
  const rects = { group: g };
  if (video) playerScene(rects, g, list, content);
  else {
    // The list opens toward the middle of the window: below a group in its
    // top half, above one in its bottom half (in a corner: by the corner).
    const below = position ? g.y + g.h / 2 < content.h / 2 : at.startsWith("top");
    cardScene(rects, g, list, below);
  }
  return rects;
}
