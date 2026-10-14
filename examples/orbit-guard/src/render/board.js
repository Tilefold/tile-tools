/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Orbit Guard — drawing the board
 *
 * Draws the whole field as one SVG picture: the score bar, the drones
 * (three original designs, each with two poses that alternate as they
 * march), the shields cell by cell, the cannon, the shot, bombs, the
 * courier ship, short-lived blasts, and a banner when the game is waiting,
 * paused or over. Each drone design is defined once as an SVG symbol and
 * placed with `<use>`, which keeps the picture small even with forty drones.
 *
 * Pure: it reads the engine's state and returns a data URL.
 */
import {
  CANNON_H,
  CANNON_W,
  CANNON_Y,
  CELL,
  COLS,
  DRONE_H,
  DRONE_W,
  H,
  ROWS,
  SHIELD_COLS,
  SHIELDS,
  SHIELD_Y,
  SHIP_Y,
  SPACE_X,
  SPACE_Y,
  W,
  shieldX,
} from "../engine/game.js";
import { THEME, banner, frame, hud, svgUrl, text } from "./svg.js";

/** Drone colours by row, top to bottom. */
export const ROW_COLORS = ["#f472b6", "#a78bfa", "#a78bfa", "#38bdf8", "#38bdf8"];

/** The design used by each row: a diamond, two rows of orbs, two of wings. */
const ROW_DESIGN = ["diamond", "orb", "orb", "wing", "wing"];

/** Two poses of each design, 16×12, drawn in currentColor. */
const DESIGNS = {
  diamond: [
    `<path d="M8 0 L15 6 L8 12 L1 6 Z" fill="currentColor"/><rect x="6" y="5" width="4" height="2" fill="#0b0d17"/>`,
    `<path d="M8 1 L16 6 L8 11 L0 6 Z" fill="currentColor"/><rect x="7" y="4" width="2" height="4" fill="#0b0d17"/>`,
  ],
  orb: [
    `<circle cx="8" cy="7" r="5" fill="currentColor"/><path d="M3 2 L5 4 M13 2 L11 4" stroke="currentColor"/><rect x="6" y="6" width="4" height="2" fill="#0b0d17"/>`,
    `<circle cx="8" cy="6" r="5" fill="currentColor"/><path d="M2 1 L5 3 M14 1 L11 3 M4 11 L6 10 M12 11 L10 10" stroke="currentColor"/><rect x="6" y="5" width="4" height="2" fill="#0b0d17"/>`,
  ],
  wing: [
    `<path d="M0 3 L8 7 L16 3 L13 10 L8 8 L3 10 Z" fill="currentColor"/><rect x="7" y="4" width="2" height="2" fill="#0b0d17"/>`,
    `<path d="M0 8 L8 4 L16 8 L13 11 L8 9 L3 11 Z" fill="currentColor"/><rect x="7" y="5" width="2" height="2" fill="#0b0d17"/>`,
  ],
};

/** The symbols every board picture defines once. */
const DEFS =
  "<defs>" +
  Object.entries(DESIGNS)
    .flatMap(([name, poses]) =>
      poses.map(
        (p, i) =>
          `<symbol id="${name}${i}" viewBox="0 0 16 12" width="16" height="12">${p}</symbol>`,
      ),
    )
    .join("") +
  "</defs>";

/** The cannon: a low base with a barrel. */
const cannon = (x) =>
  `<g fill="#4ade80"><rect x="${x - CANNON_W / 2}" y="${CANNON_Y + 3}" width="${CANNON_W}" height="${CANNON_H - 3}" rx="1"/>` +
  `<rect x="${x - CANNON_W / 2 + 3}" y="${CANNON_Y + 1}" width="${CANNON_W - 6}" height="3"/>` +
  `<rect x="${x - 1}" y="${CANNON_Y - 3}" width="2" height="5"/></g>`;

/** The courier ship: a saucer with lights. */
const ship = (x) =>
  `<g><ellipse cx="${x + 10}" cy="${SHIP_Y + 5}" rx="10" ry="3.5" fill="${THEME.warn}"/>` +
  `<ellipse cx="${x + 10}" cy="${SHIP_Y + 2.5}" rx="5" ry="3" fill="#fde68a"/>` +
  `<rect x="${x + 4}" y="${SHIP_Y + 4}" width="2" height="2" fill="#0b0d17"/>` +
  `<rect x="${x + 9}" y="${SHIP_Y + 4}" width="2" height="2" fill="#0b0d17"/>` +
  `<rect x="${x + 14}" y="${SHIP_Y + 4}" width="2" height="2" fill="#0b0d17"/></g>`;

/** A blast: a small starburst, or the points a courier was worth. */
const blast = (b) =>
  b.points
    ? text(b.x + 10, b.y + 7, b.points, { size: 8, anchor: "middle", fill: THEME.warn })
    : `<path d="M${b.x + 8} ${b.y} L${b.x + 10} ${b.y + 5} L${b.x + 16} ${b.y + 6} L${b.x + 10} ${b.y + 8} ` +
      `L${b.x + 8} ${b.y + 12} L${b.x + 6} ${b.y + 8} L${b.x} ${b.y + 6} L${b.x + 6} ${b.y + 5} Z" fill="#fde68a"/>`;

/** The banner for a status, or nothing while playing. */
function statusBanner(status, state, t, format) {
  if (status === "none") return banner(W, H, "ORBIT GUARD", t("banner-start"));
  if (status === "paused") return banner(W, H, t("banner-paused"), t("banner-paused-hint"));
  if (status === "over") {
    return banner(
      W,
      H,
      t("banner-over"),
      t("banner-over-hint", { score: format(state ? state.score : 0) }),
    );
  }
  return "";
}

/**
 * The board picture.
 *
 * @param {{ state: any, status: string, best: number, t: (key: string, args?: object) => string,
 *           format: (n: number) => string, w: number, h: number }} o
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderBoard({ state, status, best, t, format, w, h }) {
  let body = DEFS + frame(W, H);
  body += hud(W, {
    score: format(state ? state.score : 0),
    best: format(Math.max(best, state ? state.score : 0)),
    level: format(state ? state.level : 1),
    lives: state ? Math.max(0, state.lives) : 3,
    labels: { score: t("hud-score"), best: t("hud-best"), level: t("hud-level") },
    lifeColor: "#4ade80",
  });
  if (state) {
    // Drones.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!state.drones[r * COLS + c]) continue;
        const x = state.ox + c * SPACE_X;
        const y = state.oy + r * SPACE_Y;
        body += `<use href="#${ROW_DESIGN[r]}${state.frame}" x="${x}" y="${y}" width="${DRONE_W}" height="${DRONE_H}" color="${ROW_COLORS[r]}"/>`;
      }
    }
    // Shields.
    for (let i = 0; i < SHIELDS; i++) {
      const sx = shieldX(i);
      state.shields[i].forEach((on, cell) => {
        if (!on) return;
        const x = sx + (cell % SHIELD_COLS) * CELL;
        const y = SHIELD_Y + Math.floor(cell / SHIELD_COLS) * CELL;
        body += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#22c55e" fill-opacity="0.8"/>`;
      });
    }
    if (state.ship) body += ship(Math.round(state.ship.x));
    if (state.shot) {
      body += `<rect x="${Math.round(state.shot.x) - 1}" y="${Math.round(state.shot.y)}" width="2" height="6" fill="${THEME.accent}"/>`;
    }
    for (const b of state.bombs) {
      body += `<path d="M${Math.round(b.x)} ${Math.round(b.y)} l2 2 l-2 2 l2 2" stroke="#fb7185" fill="none" stroke-width="1.5"/>`;
    }
    for (const b of state.blasts) body += blast(b);
    // The cannon blinks while it comes back.
    const down = state.cannon.down;
    if (down === 0 || Math.floor(down / 150) % 2 === 0) body += cannon(Math.round(state.cannon.x));
  } else {
    body += cannon(W / 2);
  }
  body += `<line x1="4" y1="${H - 6}" x2="${W - 4}" y2="${H - 6}" stroke="${THEME.border}"/>`;
  body += statusBanner(status, state, t, format);
  return svgUrl(W, H, body, w, h);
}
