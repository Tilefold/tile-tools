/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — view
 *
 * Turns the tile's state into the one overlay item Tilefold draws: which
 * card to render, with which translated text, and where. Pure: the state,
 * the settings, the window layout and a translate function come in; an
 * overlay item comes out.
 */
import { CARD_W, renderMessage, renderWeather } from "../render/card.js";
import { KIND_TEXT } from "../weather/codes.js";

/** The overlay item's id. */
export const CARD_ID = "card";

/** How far the card keeps from the pane's edges. */
export const MARGIN = 12;

/** Title, hint and tone for each state without weather, spelled out so the keys can be found. */
const STATE_TEXT = {
  "no-network": ["state-no-network", "state-no-network-hint", "warn"],
  "no-place": ["state-no-place", "state-no-place-hint", "info"],
  loading: ["state-loading", "state-loading-hint", "info"],
  "not-found": ["state-not-found", "state-not-found-hint", "warn"],
  denied: ["state-denied", "state-denied-hint", "warn"],
  error: ["state-error", "state-error-hint", "error"],
};

/** Every state the tile can be in. */
export const STATES = Object.freeze([...Object.keys(STATE_TEXT), "ready"]);

/**
 * Where the card goes: a corner of the focused pane (above its Composer
 * when the corner is at the bottom), or of the window without panes.
 *
 * @param {any} layout What `tf.overlay.layout()` returned.
 * @param {string} corner
 * @param {number} w
 * @param {number} h
 * @returns {{ x: number, y: number }}
 */
export function placeCard(layout, corner, w, h) {
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
  const left = corner.endsWith("left");
  const top = corner.startsWith("top");
  const x = left ? area.x + MARGIN : area.x + area.w - w - MARGIN;
  const y = top ? area.y + MARGIN : area.y + area.h - h - MARGIN;
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
}

/**
 * A temperature with its unit, such as "18°" (the unit's letter is left off
 * the big number; "°C"/"°F" follow from the units setting).
 *
 * @param {number|null} n
 * @returns {string}
 */
const degrees = (n) => (n === null || n === undefined ? "–" : `${n}°`);

/**
 * The overlay item for the current state.
 *
 * @param {{ status: string, place: { name: string } | null, forecast: any,
 *           summary: string, summaryNote: string, query: string,
 *           corner: string, layout: any,
 *           t: (key: string, args?: object) => string }} s
 * @returns {{ id: string, image: string, x: number, y: number, w: number, h: number,
 *             label: string, hit: boolean, cursor: string }}
 */
export function cardItem(s) {
  let picture;
  let label;
  if (s.status === "ready" && s.forecast && s.place) {
    const f = s.forecast;
    const condition = s.t(KIND_TEXT[f.now.kind] ?? KIND_TEXT.unknown);
    const summary = s.summary || (s.summaryNote ? s.t(s.summaryNote) : "");
    picture = renderWeather({
      temp: degrees(f.now.temp),
      place: s.place.name,
      condition,
      detail: s.t("card-feels", {
        temp: degrees(f.now.feels),
        wind: `${f.now.wind ?? "–"} ${f.units.wind}`,
      }),
      kind: f.now.kind,
      day: f.now.day,
      hours: f.hours.map((h) => ({
        hour: h.hour,
        kind: h.kind,
        temp: degrees(h.temp),
        rain: h.rain ? `${h.rain}%` : "",
      })),
      summary,
      summaryMuted: !s.summary,
    });
    label = s.t("card-label", { place: s.place.name, temp: degrees(f.now.temp), condition });
  } else {
    const [title, hint, tone] = STATE_TEXT[s.status] ?? STATE_TEXT.error;
    const titleText = s.t(title);
    picture = renderMessage({
      title: titleText,
      hint: s.t(hint, { place: s.query }),
      tone: /** @type {"info"|"warn"|"error"} */ (tone),
    });
    label = titleText;
  }
  const at = placeCard(s.layout, s.corner, CARD_W, picture.h);
  return {
    id: CARD_ID,
    image: picture.image,
    x: at.x,
    y: at.y,
    w: picture.w,
    h: picture.h,
    // Screen readers get a short name; Tilefold keeps at most 80 characters.
    label: label.slice(0, 80),
    hit: true,
    cursor: "pointer",
  };
}
