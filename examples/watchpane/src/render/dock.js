/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the control dock under the video
 *
 * While the video plays docked in Tilefold's window, the controls sit in
 * one bar right under it, exactly as wide as the video:
 *
 *     ┌────────────────────────────────────────────┐
 *     │                    ━━━                     │  ← grip: drag to move
 *     │ Video title that is long…    1:23 / 4:56   │
 *     │ ━━━━━━━━━━━━━━━━━━━──────────────────────  │
 *     │    (↺)  (▶)  (↻)  (🔊)  (☰)  (⧉)           │
 *     └────────────────────────────────────────────┘
 *
 * The bar is wider than the largest item Tilefold draws over the panes,
 * so `renderDock` returns it as two halves (`left`, `right`) that the
 * card lays side by side. The buttons are part of the picture, not items
 * of their own (Tilefold allows a tile eight items, and the list needs
 * one), so `dockHit` says which button a click landed on; a click
 * anywhere else on the bar shows the box to paste a link. Pure: already
 * translated text in, data URLs out.
 */
import { BUTTON, BUTTONS, buttonBody } from "./buttons.js";
import { clampProgress, wrapLines } from "./card.js";
import { THEME, round2, svgSlice, textEl, textWidth } from "./svg.js";

/** The dock's logical size: as wide as the docked video. */
export const DOCK_W = 356;
export const DOCK_H = 86;
/** Each half's width (both within Tilefold's largest item). */
export const DOCK_HALF = DOCK_W / 2;

/** Side padding, the title row's baseline and the progress bar's top. */
const PAD = 14;
const TITLE_Y = 26;
const BAR_Y = 34;
/** The buttons' row: their top, and the space between two of them. */
const BUTTONS_Y = 46;
const BUTTON_GAP = 18;
const ROW_W = BUTTONS.length * BUTTON + (BUTTONS.length - 1) * BUTTON_GAP;
const ROW_X = (DOCK_W - ROW_W) / 2;
/** How far around a button a click still counts as on it. */
const HIT_SLOP = 3;
/** The time text never takes more than this much of the title row. */
const TIME_MAX_W = 170;

/** Where button `i` (left to right) sits in the dock. */
export const buttonX = (i) => ROW_X + i * (BUTTON + BUTTON_GAP);

/** The dock's frame and its grip, the sign that it can be dragged. */
const frame = () =>
  `<rect x="0.5" y="0.5" width="${DOCK_W - 1}" height="${DOCK_H - 1}" rx="12" ` +
  `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>` +
  `<rect x="${DOCK_W / 2 - 16}" y="6" width="32" height="3" rx="1.5" fill="${THEME.track}"/>`;

/** The title (shortened to fit) and, at the right, where the video is. */
function titleRow(title, time) {
  const timeW = time ? Math.min(TIME_MAX_W, textWidth(time, 10)) : 0;
  const titleW = DOCK_W - 2 * PAD - (timeW ? timeW + 12 : 0);
  return (
    textEl({ x: PAD, y: TITLE_Y, text: title, size: 12, weight: 600, maxWidth: titleW }) +
    (time
      ? textEl({
          x: DOCK_W - PAD,
          y: TITLE_Y,
          text: time,
          size: 10,
          fill: THEME.muted,
          anchor: "end",
          maxWidth: TIME_MAX_W,
        })
      : "")
  );
}

/** The progress bar under the title. */
function progressBar(progress) {
  const w = DOCK_W - 2 * PAD;
  return (
    `<rect x="${PAD}" y="${BAR_Y}" width="${w}" height="3" rx="1.5" fill="${THEME.track}"/>` +
    `<rect x="${PAD}" y="${BAR_Y}" width="${round2(w * clampProgress(progress))}" height="3" rx="1.5" fill="${THEME.accent}"/>`
  );
}

/**
 * Draws the dock, as its two halves.
 *
 * @param {{ mode: "video", title: string, detail: string, progress: number }
 *       | { mode: "message", title: string, hint: string }} view What the
 *   card shows (cardView), in the user's language.
 * @param {{ playing?: boolean, muted?: boolean, listOpen?: boolean }} state The buttons' state.
 * @returns {{ left: string, right: string }} `data:image/svg+xml` URLs.
 */
export function renderDock(view, state = {}) {
  let body = frame();
  if (view.mode === "video") {
    body += titleRow(view.title, view.detail) + progressBar(view.progress);
  } else {
    // Nothing on yet: the hint takes the progress bar's place.
    const hint = wrapLines(view.hint, 9, DOCK_W - 2 * PAD, 1)[0] ?? "";
    body +=
      titleRow(view.title, "") +
      textEl({ x: PAD, y: BAR_Y + 5, text: hint, size: 9, fill: THEME.muted });
  }
  BUTTONS.forEach((b, i) => {
    body += `<g transform="translate(${round2(buttonX(i))} ${BUTTONS_Y})">${buttonBody(b.id, state)}</g>`;
  });
  return {
    left: svgSlice(DOCK_W, DOCK_H, body, 0, DOCK_HALF),
    right: svgSlice(DOCK_W, DOCK_H, body, DOCK_HALF, DOCK_HALF),
  };
}

/**
 * What a click at `x`,`y` (window pixels) on the dock does: a button's
 * action (BUTTONS' `action`), "paste" for anywhere else on the bar, or
 * null when the click is outside it.
 *
 * @param {{ x: number, y: number, w: number, h: number } | undefined} rect The whole dock on screen.
 * @param {number} x
 * @param {number} y
 * @returns {string | null}
 */
export function dockHit(rect, x, y) {
  if (!rect || rect.w <= 0 || rect.h <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const lx = ((x - rect.x) * DOCK_W) / rect.w;
  const ly = ((y - rect.y) * DOCK_H) / rect.h;
  if (lx < 0 || lx > DOCK_W || ly < 0 || ly > DOCK_H) return null;
  const r = BUTTON / 2 + HIT_SLOP;
  const cy = BUTTONS_Y + BUTTON / 2;
  const i = BUTTONS.findIndex((_, n) => Math.hypot(lx - (buttonX(n) + BUTTON / 2), ly - cy) <= r);
  return i >= 0 ? BUTTONS[i].action : "paste";
}
