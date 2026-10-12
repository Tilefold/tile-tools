/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — overlay view
 *
 * Turns the game into the overlay scene Tilefold draws: eight items (the
 * board, the panel and six buttons), each with its picture, rectangle,
 * spoken label and click settings. `sceneItems` builds the full scene;
 * `diffItems` keeps only what changed since the last frame, so a gravity
 * step resends just the board and leaves the buttons alone.
 *
 * Pure: everything it needs — state, status, settings, layout, labels and
 * number formatting — is passed in.
 */
import { renderBoard } from "../render/board.js";
import { BUTTONS, iconFor, renderButton } from "../render/buttons.js";
import { panelLabel, renderPanel } from "../render/panel.js";
import { computeLayout } from "./scene.js";

/** Item ids. */
export const BOARD_ID = "board";
export const PANEL_ID = "panel";
/** Accessible board label for each game status, spelled out so the keys can be found. */
const BOARD_LABELS = {
  none: "board-label-none",
  playing: "board-label-playing",
  paused: "board-label-paused",
  over: "board-label-over",
};

export const buttonId = (id) => `btn-${id}`;

/** The fields compared between frames (id is the key, never compared). */
const FIELDS = ["image", "x", "y", "w", "h", "label", "hit", "cursor", "opacity"];

/**
 * The shaded message on the board for a status.
 *
 * @param {string} status
 * @param {(key: string, args?: object) => string} t
 * @param {string} score Formatted final score.
 * @returns {{ title: string, hint?: string, extra?: string } | null}
 */
export function bannerFor(status, t, score) {
  if (status === "none") return { title: t("tile-name"), hint: t("banner-start-hint") };
  if (status === "paused") return { title: t("banner-paused"), hint: t("banner-paused-hint") };
  if (status === "over") {
    return {
      title: t("banner-over"),
      extra: t("banner-over-score", { score }),
      hint: t("banner-over-hint"),
    };
  }
  return null;
}

/**
 * The full scene.
 *
 * @param {{
 *   status: "none"|"playing"|"paused"|"over",
 *   state: any,
 *   best: number,
 *   settings: { ghost: boolean, size: string, corner: string },
 *   layout: any,
 *   t: (key: string, args?: object) => string,
 *   format?: (n: number) => string,
 * }} input
 * @returns {object[]} Overlay items.
 */
export function sceneItems(input) {
  const { status, state, settings, t } = input;
  const format = input.format ?? ((n) => String(n));
  const rects = computeLayout(input.layout, settings);
  const running = status === "playing";

  const score = state ? Number(state.score) || 0 : 0;
  const view = {
    next: state && Array.isArray(state.next) ? state.next : [],
    hold: state ? state.hold : null,
    canHold: state ? state.canHold !== false : true,
    score: format(score),
    best: format(Math.max(input.best || 0, score)),
    level: format(state ? Number(state.level) || 1 : 1),
    lines: format(state ? Number(state.lines) || 0 : 0),
  };
  const labels = {
    next: t("panel-next"),
    hold: t("panel-hold"),
    score: t("panel-score"),
    best: t("panel-best"),
    level: t("panel-level"),
    lines: t("panel-lines"),
  };

  const board = rects.board;
  const panel = rects.panel;
  const items = [
    {
      id: BOARD_ID,
      image: renderBoard(state, {
        ghost: settings.ghost,
        banner: bannerFor(status, t, view.score),
        displayW: board.w,
        displayH: board.h,
      }),
      ...board,
      hit: true,
      cursor: "pointer",
      label: t(BOARD_LABELS[status] ?? BOARD_LABELS.none).slice(0, 80),
    },
    {
      id: PANEL_ID,
      image: renderPanel(view, labels, { displayW: panel.w, displayH: panel.h }),
      ...panel,
      hit: true,
      cursor: "pointer",
      label: panelLabel(view, labels),
    },
  ];
  for (const b of BUTTONS) {
    const r = rects[buttonId(b.id)];
    // Movement buttons dim while the game is not running; pause/play never does.
    const dim = b.id !== "pause" && !running;
    const label = b.id === "pause" && !running ? t("button-play") : t(b.label);
    items.push({
      id: buttonId(b.id),
      image: renderButton(iconFor(b.id, running), { displaySize: r.w, dim }),
      ...r,
      hit: true,
      cursor: "pointer",
      label: label.slice(0, 80),
    });
  }
  return items;
}

/**
 * What changed between two scenes: for each item that differs, its id and
 * only the fields that differ. Items missing from `prev` are sent whole.
 *
 * @param {object[]|null} prev
 * @param {object[]} next
 * @returns {object[]}
 */
export function diffItems(prev, next) {
  const before = new Map((prev ?? []).map((i) => [i.id, i]));
  const out = [];
  for (const item of next) {
    const old = before.get(item.id);
    if (!old) {
      out.push(item);
      continue;
    }
    const change = { id: item.id };
    let any = false;
    for (const f of FIELDS) {
      if (item[f] !== old[f]) {
        change[f] = item[f];
        any = true;
      }
    }
    if (any) out.push(change);
  }
  return out;
}

/**
 * The action a click on an item asks for, given the game's status.
 *
 * Board: start a game when there is none or it is over, else pause/resume.
 * Panel: hold. Buttons: their own action ("pause" toggles).
 *
 * @param {string} itemId
 * @param {string} status
 * @returns {string|null}
 */
export function actionForClick(itemId, status) {
  if (itemId === BOARD_ID) return status === "none" || status === "over" ? "newGame" : "pause";
  if (itemId === PANEL_ID) return "hold";
  const b = BUTTONS.find((x) => buttonId(x.id) === itemId);
  return b ? b.action : null;
}
