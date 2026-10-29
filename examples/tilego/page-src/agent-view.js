/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — the game as an AI agent reads it
 *
 * What the tile's "Read the board" command gives an agent, and how its
 * "Play a point" and "Mark dead stones" commands read the agent's input.
 * The board is plain data: the size, whose turn it is, the agent's color,
 * the moves as point names ("E5", "pass"), the board drawn as text rows
 * (X black, O white, . empty; x and o for stones marked dead; the top row
 * first, as the user sees it), the stones each side captured, the ko point,
 * and, while the dead stones are being marked, the score as marked and who
 * has accepted it. Then the result, the rules in a few lines, and what to
 * do next. An agent plays against the user (mode "agent") or for them in a
 * game with another person (mode "online").
 */
import { COLUMNS, PASS, cellName, moveName, positionOf } from "./game.js";
import { KOMI, scoreOf } from "./score.js";

/** The rules, as an agent needs them, for a board of `size`. */
export const rulesFor = (size) =>
  `Go on a ${size}x${size} board, area scoring (Chinese rules), komi ${KOMI} for white. ` +
  "Black moves first, then turns alternate; a turn is one stone on an empty point, or a pass. " +
  "A chain (stones of one color joined across or down) with no empty point next to it is " +
  "captured. No suicide; simple ko (a single stone that just took a single stone can't be " +
  "taken back at once). Two passes in a row end play: both sides then mark the dead stones " +
  "and accept the score: each side's stones plus the empty points only it surrounds. " +
  `Points are a column ${COLUMNS[0]}-${COLUMNS[size - 1]} (left to right, no I) and a row ` +
  `1-${size} (bottom to top), such as ${cellName(size, Math.floor(size / 2), Math.floor(size / 2))} for the center.`;

/**
 * The point an agent names on a board of `size` ("E5", "e5", " E 5 "),
 * as board coordinates [x, y] (y counted from the top), or null.
 */
export function parsePoint(size, text) {
  if (typeof text !== "string") return null;
  const m = text
    .replace(/\s+/g, "")
    .toUpperCase()
    .match(/^([A-HJ-T])(\d{1,2})$/);
  if (!m) return null;
  const x = COLUMNS.indexOf(m[1]);
  const row = Number(m[2]);
  if (x >= size || row < 1 || row > size) return null;
  return [x, size - row];
}

/**
 * The move an agent names: "pass", or a point (as text, or { cell }), as
 * a move in the game's list ("pass" or [x, y]); null when it's neither.
 */
export function parseMove(size, input) {
  const text =
    typeof input === "string" ? input : input && typeof input.cell === "string" ? input.cell : "";
  if (text.trim().toLowerCase() === PASS) return PASS;
  return parsePoint(size, text);
}

/** The points an agent names (["C3", "G7"]) as point numbers, or null when one isn't a point. */
export function parsePoints(size, list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const name of list) {
    const p = parsePoint(size, name);
    if (!p) return null;
    out.push(p[1] * size + p[0]);
  }
  return out;
}

/** The board as text rows, with row numbers and a line of column letters. */
export function boardRows(board, size, dead = []) {
  const gone = new Set(dead);
  const rows = [];
  for (let y = 0; y < size; y++) {
    let line = `${String(size - y).padStart(2)} `;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const stone = board[i];
      const mark = stone === "black" ? "X" : stone === "white" ? "O" : ".";
      line += ` ${gone.has(i) ? mark.toLowerCase() : mark}`;
    }
    rows.push(line);
  }
  rows.push(`   ${[...COLUMNS.slice(0, size)].map((c) => ` ${c}`).join("")}`);
  return rows;
}

/** Names of points (by number) on a board of `size`. */
const names = (size, points) => points.map((i) => cellName(size, i % size, Math.floor(i / size)));

/** What to do next, for the agent reading `b` (the board being built) in `view`. */
function nextStep(view, b, versus) {
  const opponent = versus ? "the user" : view.opponent?.name || "the other player";
  if (view.phase === "waiting") return "Waiting for the other player to join with the game's code.";
  if (b.result)
    return versus
      ? "The game is over. The user can press Play again for another, with colors swapped."
      : "The game is over.";
  if (view.phase === "scoring") {
    if (b.accepted.you)
      return `You accepted these dead stones. Waiting for ${opponent} to accept, or to change them (which takes your acceptance back).`;
    return (
      'Both players passed. Mark the dead stones with TileGo\'s "Mark dead stones" command: ' +
      '{ "dead": ["C3", "G7"] } names one stone of each dead chain (the whole chain is marked; ' +
      '[] for none). Then accept with { "accept": true }. "score" counts the stones marked now. ' +
      `${opponent} can mark stones too; any change takes both acceptances back. ` +
      "To play on instead, ask the user to press Undo."
    );
  }
  if (b.yourTurn)
    return (
      'Your move: run TileGo\'s "Play a point" command with { cell }, such as ' +
      `{ "cell": "${cellName(view.size, Math.floor(view.size / 2), Math.floor(view.size / 2))}" }, ` +
      'or { "cell": "pass" } to pass when no move gains anything.'
    );
  return `${versus ? "The user" : opponent}'s move. Read the board again with { "wait": true } to wait for it.`;
}

/**
 * What an agent reads for `view` (a match's or a game against the agent's;
 * null when no game is open).
 */
export function agentBoard(view) {
  if (!view || view.phase === "lobby" || view.phase === "connecting") {
    return {
      mode: "none",
      phase: "none",
      rules: rulesFor(9),
      next: 'No game is open. Run TileGo\'s "Play against an agent" command to start one with the user, or ask them to start or join a game.',
    };
  }
  const versus = view.mode === "agent";
  const { size } = view;
  const you = versus ? (view.color === "black" ? "white" : "black") : view.color;
  const pos = positionOf(view.moves, size);
  const scoring = view.phase === "scoring";
  const dead = scoring ? view.marks.dead : [];
  const moves = view.moves.map((move) => moveName(size, move));
  const b = {
    mode: versus ? "agent" : "online",
    phase: view.phase,
    size,
    you,
    turn: view.turn,
    yourTurn: versus ? !!view.agentTurn : !!view.myTurn,
    opponent: versus ? "the user" : view.opponent?.name || null,
    game: view.game,
    moves,
    last: moves.at(-1) ?? null,
    board: boardRows(pos.board, size, dead),
    captured: pos.captured,
    ko: pos.ko === null ? null : names(size, [pos.ko])[0],
    komi: KOMI,
    result: view.result
      ? {
          winner: view.result.winner,
          resigned: view.result.resigned ?? null,
          score: view.result.score ?? null,
          youWon: view.result.winner === you,
        }
      : null,
  };
  if (scoring) {
    b.dead = names(size, dead);
    b.score = scoreOf(pos.board, size, dead);
    b.accepted = versus
      ? { you: !!view.marks.theirs, opponent: !!view.marks.mine }
      : { you: !!view.marks.mine, opponent: !!view.marks.theirs };
  }
  b.rules = rulesFor(size);
  b.next = nextStep(view, { ...b, accepted: b.accepted ?? {} }, versus);
  return b;
}
