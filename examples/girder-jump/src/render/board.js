/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Girder Jump — drawing the board
 *
 * Draws the construction site as one SVG picture: the score bar and the
 * bonus that runs down, the girders (a truss pattern), the ladders, the
 * robot on the top girder (its arm swings when it throws), the beacon on
 * the ledge, the crates (they turn as they roll), the climber (in a hard
 * hat, facing the way it walks, arms up while climbing), and a banner when
 * the game is waiting, paused or over. The climber blinks while the field
 * is frozen after a hit.
 *
 * Pure: it reads the engine's state and returns a data URL.
 */
import { CRATE_R, crateMiddle, heroFeet } from "../engine/game.js";
import { H, W } from "../engine/field.js";
import { BEACON_X, FLOORS, LADDERS, LEDGE, ROBOT_X } from "../engine/level.js";
import { THEME, banner, frame, hud, svgUrl, text } from "./svg.js";

/** A girder: a band with a zigzag truss inside. */
function girder({ y, x0, x1 }) {
  let zig = "";
  for (let x = x0; x + 8 <= x1; x += 8)
    zig += `M${x} ${y + 6} L${x + 4} ${y + 1} L${x + 8} ${y + 6} `;
  return (
    `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="7" fill="#c2410c"/>` +
    `<path d="${zig}" stroke="#fdba74" stroke-width="1" fill="none"/>` +
    `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="1.2" fill="#fed7aa"/>`
  );
}

/** A ladder from girder `floor` up to the next one. */
function ladder({ floor, x }) {
  const top = FLOORS[floor + 1].y;
  const bottom = FLOORS[floor].y;
  let rungs = "";
  for (let y = top + 5; y < bottom; y += 5) rungs += `M${x - 4} ${y} L${x + 4} ${y} `;
  return (
    `<path d="M${x - 4} ${top} L${x - 4} ${bottom} M${x + 4} ${top} L${x + 4} ${bottom} ${rungs}" ` +
    `stroke="#67e8f9" stroke-width="1.2" fill="none"/>`
  );
}

/** The robot on the top girder; `throwing` swings its arm up. */
function robot(throwing) {
  const y = FLOORS[5].y;
  const x = ROBOT_X;
  const arm = throwing
    ? `M${x + 9} ${y - 13} L${x + 14} ${y - 20}`
    : `M${x + 9} ${y - 10} L${x + 14} ${y - 7}`;
  return (
    `<g><rect x="${x - 8}" y="${y - 16}" width="16" height="14" rx="2" fill="#94a3b8"/>` +
    `<rect x="${x - 6}" y="${y - 22}" width="12" height="7" rx="1.5" fill="#cbd5e1"/>` +
    `<rect x="${x - 4}" y="${y - 20}" width="2.5" height="2.5" fill="#ef4444"/>` +
    `<rect x="${x + 1.5}" y="${y - 20}" width="2.5" height="2.5" fill="#ef4444"/>` +
    `<path d="M${x} ${y - 22} L${x} ${y - 26}" stroke="#cbd5e1"/><circle cx="${x}" cy="${y - 27}" r="1.5" fill="#facc15"/>` +
    `<path d="${arm} M${x - 9} ${y - 10} L${x - 14} ${y - 7}" stroke="#94a3b8" stroke-width="2.5"/>` +
    `<rect x="${x - 6}" y="${y - 2}" width="4" height="2" fill="#475569"/><rect x="${x + 2}" y="${y - 2}" width="4" height="2" fill="#475569"/></g>`
  );
}

/** The beacon on the ledge: a lamp on a mast with a glow. */
function beacon() {
  const y = FLOORS[LEDGE].y;
  const x = BEACON_X;
  return (
    `<g><circle cx="${x}" cy="${y - 14}" r="7" fill="#facc15" fill-opacity="0.25"/>` +
    `<rect x="${x - 1}" y="${y - 10}" width="2" height="10" fill="#e5e7eb"/>` +
    `<circle cx="${x}" cy="${y - 14}" r="3.5" fill="#facc15"/></g>`
  );
}

/** A wooden crate, turned by how far it has rolled. */
function crate(c) {
  const m = crateMiddle(c);
  const turn = Math.round((c.x * 9) % 360);
  const r = CRATE_R;
  return (
    `<g transform="rotate(${turn} ${m.x.toFixed(1)} ${m.y.toFixed(1)})">` +
    `<rect x="${(m.x - r).toFixed(1)}" y="${(m.y - r).toFixed(1)}" width="${r * 2}" height="${r * 2}" rx="1" fill="#a16207"/>` +
    `<path d="M${(m.x - r).toFixed(1)} ${(m.y - r).toFixed(1)} L${(m.x + r).toFixed(1)} ${(m.y + r).toFixed(1)} M${(m.x + r).toFixed(1)} ${(m.y - r).toFixed(1)} L${(m.x - r).toFixed(1)} ${(m.y + r).toFixed(1)}" stroke="#fde68a" stroke-width="1"/>` +
    `</g>`
  );
}

/** The climber: hard hat, face, overalls; arms up on a ladder. */
function hero(h) {
  const { x, y } = heroFeet(h);
  const f = h.facing ?? 1;
  const arms = h.climb
    ? `M${x - 4} ${y - 7} L${x - 5} ${y - 12} M${x + 4} ${y - 7} L${x + 5} ${y - 12}`
    : `M${x - 3} ${y - 7} L${x - 3 - f * 2} ${y - 4} M${x + 3} ${y - 7} L${x + 3 + f * 2} ${y - 4}`;
  return (
    `<g><path d="${arms}" stroke="#fcd34d" stroke-width="1.6"/>` +
    `<rect x="${x - 3.5}" y="${y - 8}" width="7" height="5" fill="#2563eb"/>` +
    `<rect x="${x - 3.5}" y="${y - 3}" width="2.5" height="3" fill="#1e3a8a"/><rect x="${x + 1}" y="${y - 3}" width="2.5" height="3" fill="#1e3a8a"/>` +
    `<circle cx="${x}" cy="${y - 10.5}" r="2.6" fill="#fcd34d"/>` +
    `<path d="M${x - 3.5} ${y - 11.5} Q${x} ${y - 16} ${x + 3.5} ${y - 11.5} Z" fill="#facc15"/>` +
    `<rect x="${x + f * 2 - 0.5}" y="${y - 11.5}" width="1" height="1" fill="#0b0d17"/></g>`
  );
}

/** The banner for a status, or nothing while playing. */
function statusBanner(status, state, t, format) {
  if (status === "none") return banner(W, H, "GIRDER JUMP", t("banner-start"));
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
  let body = frame(W, H);
  body += hud(W, {
    score: format(state ? state.score : 0),
    best: format(Math.max(best, state ? state.score : 0)),
    level: format(state ? state.level : 1),
    lives: state ? Math.max(0, state.lives) : 3,
    labels: { score: t("hud-score"), best: t("hud-best"), level: t("hud-level") },
    lifeColor: "#facc15",
  });
  body += text(W - 6, 30, `${t("hud-bonus")} ${format(state ? state.bonus : 3000)}`, {
    size: 8,
    anchor: "end",
    fill: THEME.warn,
    fit: 90,
  });
  for (const l of LADDERS) body += ladder(l);
  for (const f of FLOORS) body += girder(f);
  body += beacon();
  body += robot(state ? state.throwing > 0 : false);
  if (state) {
    for (const c of state.crates) body += crate(c);
    if (state.freeze === 0 || Math.floor(state.freeze / 120) % 2 === 0) body += hero(state.hero);
  } else {
    body += hero({ floor: 0, x: 28, climb: null, jump: null, facing: 1 });
  }
  body += statusBanner(status, state, t, format);
  return svgUrl(W, H, body, w, h);
}
