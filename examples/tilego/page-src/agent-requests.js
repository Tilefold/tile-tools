/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo page — answering an AI agent's requests
 *
 * The tile passes each command an agent runs as an `agent` message
 * ({ id, ask, input }); the page answers it with the board as the agent
 * reads it (agent-view.js), plus `ok` or an `error` the agent can act on.
 *
 *   ask "versus"  start a game against the agent
 *   ask "board"   the board; with { wait: true }, held up to WAIT_MS until
 *                 it's the agent's turn, or play has stopped for marking
 *   ask "play"    { cell: "E5" } or { cell: "pass" }
 *   ask "score"   { dead: ["C3", …] } and/or { accept: true }, while the
 *                 dead stones are marked
 *
 * The page gives it the game to read and the actions to take; what they do
 * depends on whether the agent plays against the user or for them.
 */
import { agentBoard, parseMove, parsePoints } from "./agent-view.js";

/** Longest an agent's "wait for my turn" is held, in milliseconds (the tile's command has ten seconds). */
export const WAIT_MS = 7000;

/** Why an agent's request was refused, in words it can act on. */
export const AGENT_REFUSALS = {
  "no-game": 'No game is open. Run TileGo\'s "Play against an agent" command first.',
  "not-your-turn": 'It isn\'t your turn. Read the board with { "wait": true } to wait for it.',
  "not-playing":
    "The game isn't being played right now (it's over, marking, or waiting for a player).",
  "not-scoring":
    'Dead stones are marked only after both players pass. Play on, or pass with { "cell": "pass" }.',
  taken: "That point already has a stone. Pick an empty one.",
  "off-board": "That point isn't on the board.",
  ko: "That's a ko: the stone just taken can't be taken back at once. Play elsewhere first.",
  suicide: "That stone would have no liberty and capture nothing (suicide). Pick another point.",
  ended: "Both players passed; play has ended. Mark the dead stones instead.",
  over: "The game is over.",
  busy: "A game with another person is open; it must end first.",
  "bad-cell": 'Name a point such as E5 (a column letter without I, and a row number), or "pass".',
  "bad-dead": 'Name the dead stones as points, such as { "dead": ["C3", "G7"] }, or [] for none.',
  "no-score":
    'Say what to do: { "dead": [...] } to mark the dead stones, { "accept": true } to accept.',
};

/**
 * @param {{ send: (m: any) => void, view: () => any, start: () => boolean,
 *   play: (move: any) => string | null, mark: (points: number[]) => string | null,
 *   accept: () => string | null }} page
 *   `view` is the game the agent reads (null when none is open); `start`
 *   opens a game against the agent; `play`, `mark` and `accept` return the
 *   reason they were refused, or null.
 */
export function createAgentRequests(page) {
  /** Requests waiting for the agent's turn: { check(), timer }. */
  const waiting = new Set();

  const reply = (m, extra = {}) =>
    page.send({ type: "agent", id: m.id, reply: { ...extra, board: agentBoard(page.view()) } });
  const refuse = (m, why) => reply(m, { error: AGENT_REFUSALS[why] ?? why });

  /** The agent's marks and acceptance, in that order. */
  function score(m) {
    const input = m.input && typeof m.input === "object" ? m.input : {};
    const v = page.view();
    if (!v) return refuse(m, "no-game");
    if (!("dead" in input) && input.accept !== true) return refuse(m, "no-score");
    if ("dead" in input) {
      const points = parsePoints(v.size, input.dead);
      if (!points) return refuse(m, "bad-dead");
      const why = page.mark(points);
      if (why) return refuse(m, why);
    }
    if (input.accept === true) {
      const why = page.accept();
      if (why) return refuse(m, why);
    }
    return reply(m, { ok: true });
  }

  /** Waits for the agent's turn (or the end of play) before answering, when asked to. */
  function board(m) {
    const ready = () => {
      const b = agentBoard(page.view());
      return !(m.input && m.input.wait === true) || b.yourTurn || b.phase !== "playing";
    };
    if (ready()) return reply(m);
    const w = {
      check() {
        if (!ready()) return;
        clearTimeout(w.timer);
        waiting.delete(w);
        reply(m);
      },
    };
    w.timer = setTimeout(() => {
      waiting.delete(w);
      reply(m, { waited: true });
    }, WAIT_MS);
    waiting.add(w);
  }

  return {
    /** Answers one request from the tile. */
    answer(m) {
      if (m.ask === "versus") return page.start() ? reply(m, { ok: true }) : refuse(m, "busy");
      if (m.ask === "play") {
        const v = page.view();
        if (!v) return refuse(m, "no-game");
        const move = parseMove(v.size, m.input);
        if (!move) return refuse(m, "bad-cell");
        const why = page.play(move);
        if (why) return refuse(m, why);
        return reply(m, { ok: true, played: typeof m.input === "string" ? m.input : m.input.cell });
      }
      if (m.ask === "score") return score(m);
      return board(m);
    },

    /** The game changed: answer the requests that were waiting for it. */
    changed() {
      for (const w of [...waiting]) w.check();
    },
  };
}
