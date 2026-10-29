/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the game as an AI agent reads it
 *
 * What the tile's "Read the board" command gives an agent, and how its
 * "Play a point" command reads the agent's move. The board is plain data:
 * whose turn it is, the agent's color, the moves as point names ("H8"),
 * the board drawn as text rows (X black, O white, . empty, the top row
 * first, as the user sees it), the result, the rules in one line, and what
 * to do next. An agent plays against the user (mode "agent") or for them in
 * a game with another person (mode "online").
 */
import { SIZE, boardOf, cellName } from "./game.js";

/** Column letters, left to right. */
const COLUMNS = "ABCDEFGHIJKLMNO";

/** The rules, as an agent needs them. */
export const RULES =
  "15x15 board. Black moves first, then turns alternate. Five or more stones in an unbroken " +
  "line (across, down or diagonal) wins; a full board is a draw. Points are named by column " +
  "A-O (left to right) and row 1-15 (bottom to top), such as H8 for the center.";

/**
 * The point an agent names ("H8", "h8", " H 8 ", or { cell: "H8" }), as
 * board coordinates [x, y] (y counted from the top), or null.
 */
export function parseCell(input) {
  const text =
    typeof input === "string" ? input : input && typeof input.cell === "string" ? input.cell : "";
  const m = text
    .replace(/\s+/g, "")
    .toUpperCase()
    .match(/^([A-O])(\d{1,2})$/);
  if (!m) return null;
  const row = Number(m[2]);
  if (row < 1 || row > SIZE) return null;
  return [COLUMNS.indexOf(m[1]), SIZE - row];
}

/** The board as text rows, with row numbers and a line of column letters. */
export function boardRows(moves) {
  const board = boardOf(moves);
  const rows = [];
  for (let y = 0; y < SIZE; y++) {
    let line = `${String(SIZE - y).padStart(2)} `;
    for (let x = 0; x < SIZE; x++) {
      const stone = board[y * SIZE + x];
      line += ` ${stone === "black" ? "X" : stone === "white" ? "O" : "."}`;
    }
    rows.push(line);
  }
  rows.push(`   ${[...COLUMNS].map((c) => ` ${c}`).join("")}`);
  return rows;
}

/**
 * What an agent reads for `view` (a match's or a game against the agent's;
 * null when no game is open). `agentColor` and `canPlay` say which side
 * the agent plays and whether it may move now.
 */
export function agentBoard(view) {
  if (!view || view.phase === "lobby" || view.phase === "connecting") {
    return {
      mode: "none",
      phase: "none",
      rules: RULES,
      next: 'No game is open. Run Gomoku\'s "Play against an agent" command to start one with the user, or ask them to start or join a game.',
    };
  }
  const versus = view.mode === "agent";
  const you = versus ? (view.color === "black" ? "white" : "black") : view.color;
  const yourTurn = versus ? !!view.agentTurn : !!view.myTurn;
  const moves = view.moves.map(([x, y]) => cellName(x, y));
  const result = view.result
    ? {
        winner: view.result.winner,
        line: view.result.line ? view.result.line.map(([x, y]) => cellName(x, y)) : null,
        resigned: view.result.resigned ?? null,
        youWon: view.result.winner === you,
      }
    : null;
  let next;
  if (view.phase === "waiting") next = "Waiting for the other player to join with the game's code.";
  else if (result)
    next = versus
      ? "The game is over. The user can press Play again for another, with colors swapped."
      : "The game is over.";
  else if (yourTurn)
    next =
      'Your move: run Gomoku\'s "Play a point" command with { cell }, such as { "cell": "H8" }.';
  else
    next = versus
      ? 'The user\'s move. Read the board again with { "wait": true } to wait for it.'
      : `${view.opponent?.name || "The other player"}'s move. Read the board again with { "wait": true } to wait for it.`;
  return {
    mode: versus ? "agent" : "online",
    phase: view.phase,
    you,
    turn: view.turn,
    yourTurn,
    opponent: versus ? "the user" : view.opponent?.name || null,
    game: view.game,
    moves,
    last: moves.at(-1) ?? null,
    board: boardRows(view.moves),
    result,
    rules: RULES,
    next,
  };
}
