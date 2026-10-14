/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board — view
 *
 * Turns the tile's state into the one overlay item Tilefold draws: which
 * picture to render, with which translated text, and where. Pure.
 */
import { BOARD_W, renderList, renderMessage } from "../render/board.js";
import { GROUPS, ageOf, groupOf } from "../gitlab/status.js";

/** The overlay item's id. */
export const BOARD_ID = "board";

/** How far the board keeps from the pane's edges. */
export const MARGIN = 12;

/** Title, hint and tone for each state without a list, spelled out so the keys can be found. */
const STATE_TEXT = {
  "no-network": ["state-no-network", "state-no-network-hint", "warn"],
  "signed-out": ["state-signed-out", "state-signed-out-hint", "info"],
  "no-project": ["state-no-project", "state-no-project-hint", "info"],
  loading: ["state-loading", "state-loading-hint", "info"],
  "not-found": ["state-not-found", "state-not-found-hint", "warn"],
  denied: ["state-denied", "state-denied-hint", "warn"],
  rate: ["state-rate", "state-rate-hint", "warn"],
  error: ["state-error", "state-error-hint", "error"],
};

/** Every state the tile can be in. */
export const STATES = Object.freeze([...Object.keys(STATE_TEXT), "ready"]);

/**
 * Where the board goes: a corner of the focused pane (above its Composer
 * when the corner is at the bottom), or of the window without panes.
 *
 * @param {any} layout What `tf.overlay.layout()` returned.
 * @param {string} corner
 * @param {number} w
 * @param {number} h
 * @returns {{ x: number, y: number }}
 */
export function placeBoard(layout, corner, w, h) {
  const panes = layout && Array.isArray(layout.panes) ? layout.panes : [];
  const pane = panes.find((p) => p && p.focused) || panes[0];
  const content = (layout && layout.content) || { w: 800, h: 600 };
  const area = pane
    ? {
        x: pane.x,
        y: pane.y,
        w: pane.w,
        h: pane.composer ? Math.max(0, pane.composer.y - pane.y) : pane.h,
      }
    : { x: 0, y: 0, w: content.w, h: content.h };
  const x = corner.endsWith("left") ? area.x + MARGIN : area.x + area.w - w - MARGIN;
  const y = corner.startsWith("top") ? area.y + MARGIN : area.y + area.h - h - MARGIN;
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
}

/**
 * The overlay item for the current state.
 *
 * @param {{ status: string, project: string, pipelines: any[], now: number,
 *           corner: string, layout: any,
 *           t: (key: string, args?: object) => string }} s
 */
export function boardItem(s) {
  let picture;
  let label;
  if (s.status === "ready") {
    const rows = s.pipelines.map((p) => {
      const group = groupOf(p.status);
      const age = ageOf(p.updatedAt, s.now);
      return {
        ref: p.ref,
        number: `#${p.iid}`,
        status: s.t(GROUPS[group].text),
        age: s.t(age.key, { n: age.n }),
        color: GROUPS[group].color,
        running: group === "running",
      };
    });
    picture = renderList({ project: s.project, rows, empty: s.t("board-empty") });
    label = rows.length
      ? s.t("board-label", { project: s.project, status: rows[0].status })
      : s.t("board-empty");
  } else {
    const [title, hint, tone] = STATE_TEXT[s.status] ?? STATE_TEXT.error;
    const titleText = s.t(title);
    picture = renderMessage({
      title: titleText,
      hint: s.t(hint, { project: s.project }),
      tone: /** @type {"info"|"warn"|"error"} */ (tone),
    });
    label = titleText;
  }
  const at = placeBoard(s.layout, s.corner, BOARD_W, picture.h);
  return {
    id: BOARD_ID,
    image: picture.image,
    x: at.x,
    y: at.y,
    w: picture.w,
    h: picture.h,
    label: label.slice(0, 80),
    hit: true,
    cursor: "pointer",
  };
}
