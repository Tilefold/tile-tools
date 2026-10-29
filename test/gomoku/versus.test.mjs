// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — playing an AI agent
 *
 * A game against an agent on one board: the user plays black first, each
 * side only on its own turn, five in a row ends it, resigning gives it to
 * the agent, Play again swaps colors, leaving forgets it, and a kept game
 * comes back. The agent reads points as "H8" in any case or { cell }, the
 * board as text rows with the top row first, and the game as data that
 * says its color, whose turn it is, the result and what to do next, both
 * against the user and when playing for them in a game with someone else.
 */
import { describe, expect, it } from "vitest";
import {
  RULES,
  agentBoard,
  boardRows,
  parseCell,
} from "../../examples/gomoku/page-src/agent-view.js";
import { createVersus, userColor } from "../../examples/gomoku/page-src/versus.js";

/** A game against the agent, recording what it saved and noticed. */
function game() {
  const out = { view: null, saved: undefined, notices: [] };
  out.v = createVersus({
    agentName: "Agent",
    onChange: (v) => (out.view = v),
    onSave: (s) => (out.saved = s),
    onNotice: (n) => out.notices.push(n),
  });
  return out;
}

describe("a game against an agent", () => {
  it("lets the user play black first, then the agent, each only on its turn", () => {
    const g = game();
    g.v.start("  Ada ");
    expect(g.view).toMatchObject({ mode: "agent", phase: "playing", color: "black", myTurn: true });
    expect(g.v.agentPlay(7, 7)).toBe("not-your-turn");
    expect(g.v.play(7, 7)).toBe(true);
    expect(g.view).toMatchObject({ myTurn: false, agentTurn: true });
    expect(g.v.play(8, 8)).toBe(false);
    expect(g.v.agentPlay(7, 7)).toBe("taken");
    expect(g.v.agentPlay(8, 8)).toBeNull();
    expect(g.notices).toEqual([{ kind: "agent-moved", name: "Agent", x: 8, y: 8 }]);
    expect(g.saved).toEqual({
      mode: "agent",
      name: "Ada",
      game: 1,
      moves: [
        [7, 7],
        [8, 8],
      ],
      resigned: null,
    });
  });

  it("ends with five in a row, and Play again swaps colors", () => {
    const g = game();
    g.v.start("Ada");
    for (let i = 0; i < 4; i++) {
      g.v.play(i, 0);
      g.v.agentPlay(i, 5);
    }
    g.v.play(4, 0);
    expect(g.view.phase).toBe("over");
    expect(g.view.result.winner).toBe("black");
    expect(g.v.agentPlay(9, 9)).toBe("not-playing");
    g.v.rematch();
    expect(g.view).toMatchObject({ phase: "playing", game: 2, color: "white", agentTurn: true });
    expect(userColor(2)).toBe("white");
  });

  it("gives the game to the agent when the user resigns, and forgets it on leaving", () => {
    const g = game();
    g.v.start("Ada");
    g.v.resign();
    expect(g.view.result).toMatchObject({ winner: "white", resigned: "black" });
    g.v.leave();
    expect(g.view.phase).toBe("lobby");
    expect(g.saved).toBeNull();
  });

  it("comes back from what was kept, and refuses a kept game that couldn't be", () => {
    const g = game();
    expect(
      g.v.resume({ mode: "agent", name: "Ada", game: 2, moves: [[7, 7]], resigned: null }),
    ).toBe(true);
    expect(g.view).toMatchObject({ phase: "playing", color: "white", myTurn: true });
    const h = game();
    expect(
      h.v.resume({
        mode: "agent",
        moves: [
          [1, 1],
          [1, 1],
        ],
      }),
    ).toBe(false);
    expect(h.v.resume({ room: "K7P4QX", moves: [] })).toBe(false);
    expect(h.view).toBeNull();
  });
});

describe("what the agent reads", () => {
  it("reads points as column and row from the bottom, in any case", () => {
    expect(parseCell("H8")).toEqual([7, 7]);
    expect(parseCell(" a 15 ")).toEqual([0, 0]);
    expect(parseCell({ cell: "o1" })).toEqual([14, 14]);
    for (const bad of ["P1", "A0", "A16", "H", "", null, 42, { cell: 3 }]) {
      expect(parseCell(bad)).toBeNull();
    }
  });

  it("draws the board as text rows, the top row first", () => {
    const rows = boardRows([
      [0, 0],
      [14, 14],
    ]);
    expect(rows).toHaveLength(16);
    expect(rows[0]).toBe(`15  X${" .".repeat(14)}`);
    expect(rows[14]).toBe(` 1 ${" .".repeat(14)} O`);
    expect(rows[15]).toBe("    A B C D E F G H I J K L M N O");
  });

  it("says there is no game, and how to start one", () => {
    expect(agentBoard(null)).toMatchObject({ mode: "none", phase: "none", rules: RULES });
    expect(agentBoard({ phase: "lobby" }).next).toMatch(/Play against an agent/);
  });

  it("gives the game against the user, from the agent's side", () => {
    const g = game();
    g.v.start("Ada");
    g.v.play(7, 7);
    const b = agentBoard(g.view);
    expect(b).toMatchObject({
      mode: "agent",
      phase: "playing",
      you: "white",
      turn: "white",
      yourTurn: true,
      opponent: "the user",
      moves: ["H8"],
      last: "H8",
      result: null,
    });
    expect(b.next).toMatch(/Play a point/);
    g.v.agentPlay(8, 7);
    expect(agentBoard(g.view).next).toMatch(/wait/);
  });

  it("gives a result with its line, and whether the agent won", () => {
    const g = game();
    g.v.start("Ada");
    for (let i = 0; i < 4; i++) {
      g.v.play(i, 14);
      g.v.agentPlay(i, 0);
    }
    g.v.play(4, 14);
    expect(agentBoard(g.view).result).toEqual({
      winner: "black",
      line: ["A1", "B1", "C1", "D1", "E1"],
      resigned: null,
      youWon: false,
    });
  });

  it("plays for the user in a game with another person", () => {
    const view = {
      phase: "playing",
      color: "black",
      turn: "black",
      myTurn: true,
      opponent: { name: "Bo", here: true },
      game: 1,
      moves: [],
      result: null,
    };
    expect(agentBoard(view)).toMatchObject({
      mode: "online",
      you: "black",
      yourTurn: true,
      opponent: "Bo",
    });
    expect(agentBoard({ ...view, myTurn: false, turn: "white" }).next).toMatch(/Bo's move/);
    expect(agentBoard({ ...view, phase: "waiting" }).next).toMatch(/Waiting/);
  });
});
