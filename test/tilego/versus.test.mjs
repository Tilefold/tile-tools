// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — a game against an AI agent, and the board as the agent reads it
 *
 * The user plays black on the size they picked and the agent white; each
 * may move only on its turn, and a move against the rules comes back with
 * its reason. Two passes start the marking: the user clicks chains, the
 * agent names them, any change takes back both acceptances, and both
 * accepting scores the board. Undo takes the user's last move back at
 * once, and after both passed it goes back to playing. Play again swaps
 * colors on the same size; a kept game comes back as it was. The agent's
 * board: point names without I, the moves, the text rows (dead stones in
 * lower case), captures, the ko point, the score while marking, who
 * accepted, and what to do next; the points and passes it names are read
 * on each board size.
 */
import { describe, expect, it } from "vitest";
import {
  agentBoard,
  boardRows,
  parseMove,
  parsePoints,
  rulesFor,
} from "../../examples/tilego/page-src/agent-view.js";
import { PASS, emptyBoard } from "../../examples/tilego/page-src/game.js";
import { createVersus } from "../../examples/tilego/page-src/versus.js";

/** A game against the agent, recording what it saved and noticed. */
function game(size = 9) {
  const out = { saved: null, notices: [], view: null };
  out.versus = createVersus({
    agentName: "Agent",
    onChange: (v) => {
      out.view = v;
    },
    onSave: (s) => {
      out.saved = s;
    },
    onNotice: (n) => out.notices.push(n),
  });
  out.versus.start(" Ada ", size);
  return out;
}

const A1 = 8 * 9;

/** The user plays E5, the agent A1, and both pass: marking starts. */
function toScoring() {
  const g = game();
  g.versus.play(4, 4);
  g.versus.agentPlay([0, 8]);
  g.versus.pass();
  g.versus.agentPlay(PASS);
  return g;
}

describe("a game against the agent", () => {
  it("takes turns, and refuses moves out of turn or against the rules with the reason", () => {
    const g = game(13);
    expect(g.view).toMatchObject({ mode: "agent", size: 13, color: "black", myTurn: true });
    expect(g.versus.agentPlay([0, 0])).toBe("not-your-turn");
    expect(g.versus.play(6, 6)).toBe(true);
    expect(g.versus.play(5, 5)).toBe(false);
    expect(g.versus.agentPlay([6, 6])).toBe("taken");
    expect(g.versus.agentPlay([13, 0])).toBe("off-board");
    expect(g.versus.agentPlay([0, 0])).toBeNull();
    expect(g.notices).toEqual([{ kind: "agent-moved", name: "Agent", cell: "A13" }]);
    expect(g.versus.agentPlay(PASS)).toBe("not-your-turn");
    g.versus.play(1, 1);
    expect(g.versus.agentPlay(PASS)).toBeNull();
    expect(g.notices.at(-1)).toEqual({ kind: "agent-passed", name: "Agent" });
    expect(g.saved).toMatchObject({ mode: "agent", size: 13, name: "Ada" });
  });

  it("marks dead stones with the agent, takes back acceptances on a change, and scores", () => {
    const g = toScoring();
    expect(g.view).toMatchObject({ phase: "scoring", marking: true });
    expect(g.notices.at(-1)).toEqual({ kind: "scoring", name: "Agent" });
    expect(g.versus.agentDead([A1])).toBeNull();
    expect(g.view.marks.dead).toEqual([A1]);
    expect(g.versus.accept()).toBe(true);
    // The user brings A1 back to life: both acceptances go.
    expect(g.versus.mark(A1)).toBe(true);
    expect(g.view.marks).toEqual({ dead: [], mine: false, theirs: false });
    g.versus.mark(A1);
    g.versus.accept();
    expect(g.versus.agentAccept()).toBeNull();
    expect(g.notices.at(-1)).toEqual({ kind: "accepted", name: "Agent" });
    expect(g.view).toMatchObject({
      phase: "over",
      result: { winner: "black", score: { black: 81, white: 7.5, margin: 73.5 } },
    });
  });

  it("refuses marking before both passed", () => {
    const g = game();
    expect(g.versus.agentDead([A1])).toBe("not-scoring");
    expect(g.versus.agentAccept()).toBe("not-scoring");
    expect(g.versus.mark(A1)).toBe(false);
    expect(g.versus.accept()).toBe(false);
  });

  it("undoes the user's last move at once, and after both passed goes back to playing", () => {
    const g = game();
    expect(g.view.undo.canAsk).toBe(false);
    g.versus.play(4, 4);
    g.versus.agentPlay([0, 0]);
    expect(g.versus.undo()).toBe(true);
    expect(g.view.moves).toEqual([]);
    const s = toScoring();
    s.versus.agentDead([A1]);
    expect(s.versus.undo()).toBe(true);
    expect(s.view).toMatchObject({ phase: "playing", myTurn: true, marks: { dead: [] } });
    expect(s.view.moves.length).toBe(2);
  });

  it("plays again on the same size with colors swapped, and resigns", () => {
    const g = game(19);
    g.versus.resign();
    expect(g.view.result).toMatchObject({ winner: "white", resigned: "black" });
    g.versus.rematch();
    expect(g.view).toMatchObject({ phase: "playing", game: 2, size: 19, color: "white" });
    expect(g.view.agentTurn).toBe(true);
  });

  it("comes back to a kept game, marks and all, and ignores one that couldn't be played", () => {
    const g = toScoring();
    g.versus.agentDead([A1]);
    g.versus.accept();
    const again = game();
    expect(again.versus.resume(structuredClone(g.saved))).toBe(true);
    expect(again.view).toMatchObject({
      phase: "scoring",
      marks: { dead: [A1], mine: true, theirs: false },
    });
    expect(
      again.versus.resume({
        mode: "agent",
        size: 9,
        moves: [
          [1, 1],
          [1, 1],
        ],
      }),
    ).toBe(false);
    expect(again.versus.resume({ mode: "agent", size: 8, moves: [] })).toBe(false);
  });
});

describe("the board as the agent reads it", () => {
  it("reads points and passes on each size, without I", () => {
    expect(parseMove(9, "e5")).toEqual([4, 4]);
    expect(parseMove(9, { cell: " J 1 " })).toEqual([8, 8]);
    expect(parseMove(9, "I5")).toBeNull();
    expect(parseMove(9, "K5")).toBeNull();
    expect(parseMove(9, "A10")).toBeNull();
    expect(parseMove(19, "T19")).toEqual([18, 0]);
    expect(parseMove(9, "Pass")).toBe(PASS);
    expect(parseMove(9, { cell: "pass" })).toBe(PASS);
    expect(parseMove(9, 5)).toBeNull();
    expect(parsePoints(9, ["A1", "e5"])).toEqual([A1, 40]);
    expect(parsePoints(9, ["A1", "Z9"])).toBeNull();
    expect(parsePoints(9, "A1")).toBeNull();
  });

  it("draws the board as text, with dead stones in lower case", () => {
    const board = emptyBoard(9);
    board[40] = "black";
    board[A1] = "white";
    const rows = boardRows(board, 9, [A1]);
    expect(rows[0]).toBe(" 9  . . . . . . . . .");
    expect(rows[4]).toBe(" 5  . . . . X . . . .");
    expect(rows[8]).toBe(" 1  o . . . . . . . .");
    expect(rows[9]).toBe("    A B C D E F G H J");
    expect(rulesFor(19)).toContain("A-T");
    expect(rulesFor(9)).toContain("E5 for the center");
  });

  it("tells the agent its color, its turn and what to do next", () => {
    const g = game();
    expect(agentBoard(null)).toMatchObject({ mode: "none" });
    let b = agentBoard(g.view);
    expect(b).toMatchObject({ mode: "agent", you: "white", yourTurn: false, size: 9, komi: 7.5 });
    expect(b.next).toContain("wait");
    g.versus.play(4, 4);
    b = agentBoard(g.view);
    expect(b).toMatchObject({ yourTurn: true, moves: ["E5"], last: "E5", ko: null });
    expect(b.next).toContain('"pass"');
    expect(b.dead).toBeUndefined();
  });

  it("shows the score as marked and who accepted it while marking", () => {
    const g = toScoring();
    g.versus.agentDead([A1]);
    g.versus.agentAccept();
    const b = agentBoard(g.view);
    expect(b).toMatchObject({
      phase: "scoring",
      moves: ["E5", "A1", "pass", "pass"],
      dead: ["A1"],
      score: { black: 81, white: 7.5, winner: "black" },
      accepted: { you: true, opponent: false },
    });
    expect(b.next).toContain("Waiting for the user");
    g.versus.accept();
    expect(agentBoard(g.view).result).toMatchObject({ winner: "black", youWon: false });
  });
});
