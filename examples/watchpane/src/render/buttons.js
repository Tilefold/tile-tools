/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the card's buttons
 *
 * A row of round buttons under the card, each its own overlay item:
 *
 *    [↺10]  [▶/❚❚]  [10↻]  [🔊/🔇]  [☰]  [⧉]
 *
 * back ten seconds, play or pause, forward ten seconds, mute or unmute,
 * the recent videos, and the video's window. The play button shows pause
 * while a video plays; mute shows the crossed speaker while muted; the
 * list button is lit while the list is open. Pure: data URLs out.
 */
import { THEME, svgUrl } from "./svg.js";

/** A button's logical side. */
export const BUTTON = 28;

/** The buttons, left to right: id, what a click does, and its label's message key. */
export const BUTTONS = [
  { id: "back", action: "back", label: "button-back" },
  { id: "play", action: "toggle", label: "button-play" },
  { id: "forward", action: "forward", label: "button-forward" },
  { id: "mute", action: "mute", label: "button-mute" },
  { id: "list", action: "list", label: "button-list" },
  { id: "window", action: "window", label: "button-window" },
];

const C = BUTTON / 2;
const stroke = (d, color) =>
  `<path d="${d}" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const small = (x, y, text, color) =>
  `<text x="${x}" y="${y}" font-size="7" font-weight="700" font-family="system-ui,sans-serif" ` +
  `fill="${color}" text-anchor="middle">${text}</text>`;

/** Each button's artwork in a 28×28 box, by id and state. */
const ART = {
  back: (_s, c) =>
    stroke("M9 9 A7 7 0 1 1 8 17", c) + stroke("M9 5 V9 H13", c) + small(C + 1, 17, "10", c),
  forward: (_s, c) =>
    stroke("M19 9 A7 7 0 1 0 20 17", c) + stroke("M19 5 V9 H15", c) + small(C - 1, 17, "10", c),
  play: (s, c) =>
    s.playing
      ? `<rect x="9.5" y="8" width="3" height="12" rx="1" fill="${c}"/><rect x="15.5" y="8" width="3" height="12" rx="1" fill="${c}"/>`
      : `<path d="M10.5 8 L20 14 L10.5 20 Z" fill="${c}"/>`,
  mute: (s, c) =>
    `<path d="M7 11.5 H10 L14 8 V20 L10 16.5 H7 Z" fill="${c}"/>` +
    (s.muted
      ? stroke("M17 11 L22 17 M22 11 L17 17", c)
      : stroke("M17 11 Q19.5 14 17 17 M19.5 9 Q23.5 14 19.5 19", c)),
  list: (_s, c) => [9.5, 14, 18.5].map((y) => stroke(`M8 ${y} H20`, c)).join(""),
  window: (_s, c) =>
    `<rect x="7" y="8" width="14" height="11" rx="2" stroke="${c}" stroke-width="1.8" fill="none"/>` +
    `<path d="M12 11.5 L16.5 13.5 L12 15.5 Z" fill="${c}"/>`,
};

/**
 * Draws one button.
 *
 * @param {string} id One of BUTTONS' ids.
 * @param {{ playing?: boolean, muted?: boolean, listOpen?: boolean, enabled?: boolean }} state
 * @param {number} [display] Its side on screen.
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderButton(id, state = {}, display = BUTTON) {
  const lit = (id === "list" && state.listOpen) || (id === "play" && state.playing);
  const color = state.enabled === false ? THEME.muted : lit ? "#fff" : THEME.text;
  const fill = lit ? THEME.accent : THEME.panel;
  const body =
    `<circle cx="${C}" cy="${C}" r="${C - 0.5}" fill="${fill}" fill-opacity="${lit ? 1 : THEME.panelOpacity}" stroke="${THEME.border}"/>` +
    (ART[id] ? ART[id](state, color) : "");
  return svgUrl(BUTTON, BUTTON, body, display, display);
}

/** What a click on the item `itemId` does, or null. */
export function actionForClick(itemId) {
  const b = BUTTONS.find((x) => `btn-${x.id}` === itemId);
  return b ? b.action : null;
}
