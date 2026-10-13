/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Brickfold — drawing the board
 *
 * Draws the field as one SVG picture: the score bar, the wall (a colour
 * per row, tough bricks with a bright rim that dims once they crack), the
 * paddle, the ball, a hint to launch while the ball waits on the paddle,
 * and a banner when the game is waiting, paused or over.
 *
 * Pure: it reads the engine's state and returns a data URL.
 */
import {
  BALL_R,
  BRICK_GAP,
  BRICK_H,
  BRICK_W,
  COLS,
  H,
  PADDLE_H,
  PADDLE_W,
  PADDLE_Y,
  W,
  WALL_X,
  WALL_Y,
  wallFor,
} from "../engine/game.js";
import { THEME, banner, frame, hud, svgUrl, text } from "./svg.js";

/** Brick colours by row, top to bottom. */
export const ROW_COLORS = ["#f43f5e", "#f97316", "#facc15", "#4ade80", "#22d3ee", "#818cf8"];

/** One brick: a block with a light top edge; a tough one has a rim. */
function brick(i, hits, tough) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = WALL_X + col * (BRICK_W + BRICK_GAP);
  const y = WALL_Y + row * (BRICK_H + BRICK_GAP);
  const color = ROW_COLORS[row % ROW_COLORS.length];
  let out =
    `<rect x="${x}" y="${y}" width="${BRICK_W}" height="${BRICK_H}" rx="1.5" fill="${color}"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="${BRICK_W - 2}" height="2" fill="#ffffff" fill-opacity="0.35"/>`;
  if (tough) {
    out += `<rect x="${x + 0.75}" y="${y + 0.75}" width="${BRICK_W - 1.5}" height="${BRICK_H - 1.5}" rx="1.5" fill="none" stroke="#ffffff" stroke-opacity="${hits > 1 ? 0.9 : 0.3}" stroke-width="1.5"/>`;
    if (hits === 1) {
      out += `<path d="M${x + 8} ${y + 2} l3 3 l-2 2 l3 2" stroke="#0b0d17" fill="none"/>`;
    }
  }
  return out;
}

/** The banner for a status, or nothing while playing. */
function statusBanner(status, state, t, format) {
  if (status === "none") return banner(W, H, "BRICKFOLD", t("banner-start"));
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
    lifeColor: "#e5e7eb",
  });
  const bricks = state ? state.bricks : wallFor(1);
  const tough = wallFor(state ? state.level : 1);
  bricks.forEach((hits, i) => {
    if (hits > 0) body += brick(i, hits, tough[i] === 2);
  });
  const px = state ? state.paddle.x : W / 2;
  body +=
    `<rect x="${Math.round(px - PADDLE_W / 2)}" y="${PADDLE_Y}" width="${PADDLE_W}" height="${PADDLE_H}" rx="3" fill="${THEME.accent}"/>` +
    `<rect x="${Math.round(px - PADDLE_W / 2) + 3}" y="${PADDLE_Y + 1}" width="${PADDLE_W - 6}" height="1.5" fill="#ffffff" fill-opacity="0.5"/>`;
  const ball = state ? state.ball : { x: W / 2, y: PADDLE_Y - BALL_R, stuck: true };
  body += `<circle cx="${Math.round(ball.x * 10) / 10}" cy="${Math.round(ball.y * 10) / 10}" r="${BALL_R}" fill="#f8fafc"/>`;
  if (state && ball.stuck && status === "playing") {
    body += text(W / 2, PADDLE_Y - 14, `↑ ${t("button-launch")}`, {
      size: 8,
      anchor: "middle",
      fill: THEME.muted,
      fit: W - 40,
    });
  }
  body += statusBanner(status, state, t, format);
  return svgUrl(W, H, body, w, h);
}
