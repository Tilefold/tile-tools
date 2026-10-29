// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — a match between two players
 *
 * Two pages' matches play each other through the fake relay: the maker
 * picks the board size and the joiner's board takes it (never the other
 * way round); stones and passes go both ways, captures and ko are the same
 * on both boards, and moves out of turn or against the rules are refused;
 * two passes start the marking of dead stones, where a click on either
 * board marks the chain on both (two clicks at once still agree), a change
 * takes back an acceptance, and once both accept the same stones both
 * boards show the same score. Undo after the passes goes back to playing;
 * resigning ends the game while playing or marking; a rematch keeps the
 * size and swaps colors. A player who reopens the page comes back to the
 * marking (or the score) where it was.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMatch } from "../../examples/tilego/page-src/match.js";
import { createRelay } from "../../examples/tilego/page-src/relay.js";
import { createFakeRelay } from "../fake-relay.mjs";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lets queued frames arrive. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** A page's match on `server`, recording what it saved and noticed. */
function side(server, player) {
  const out = { saved: null, notices: [], view: null };
  let match;
  const relay = createRelay({
    url: "wss://relay.example.com/rooms",
    WebSocket: server.WebSocket,
    onEvent: (e) => match.relayEvent(e),
  });
  match = createMatch({
    relay,
    player,
    onChange: (v) => {
      out.view = v;
    },
    onSave: (s) => {
      out.saved = s;
    },
    onNotice: (n) => out.notices.push(n),
  });
  out.match = match;
  out.relay = relay;
  return out;
}

/** Ada makes a room with a board of `size` and Bo joins it; both are playing. */
async function started(size = 9, server = createFakeRelay()) {
  const ada = side(server, "p-ada");
  const bo = side(server, "p-bo");
  ada.match.create("Ada", size);
  await flush();
  bo.match.join(ada.view.room, "Bo");
  await flush();
  return { server, ada, bo };
}

/** Plays (x, y), or a pass with no point, for whoever's turn it is; then lets it arrive. */
async function move(ada, bo, x, y) {
  const who = ada.view.myTurn ? ada : bo;
  expect(x === undefined ? who.match.pass() : who.match.play(x, y)).toBe(true);
  await flush();
}

/** Both players pass, one after the other. */
async function bothPass(ada, bo) {
  await move(ada, bo);
  await move(ada, bo);
}

describe("starting a game", () => {
  it("plays on the maker's board size, which the joiner's board takes", async () => {
    const { ada, bo } = await started(13);
    expect(ada.view).toMatchObject({ phase: "playing", size: 13, color: "black", myTurn: true });
    expect(bo.view).toMatchObject({ phase: "playing", size: 13, color: "white", myTurn: false });
    expect(ada.saved).toMatchObject({ room: "K7P4QX", size: 13, moves: [] });
    expect(bo.notices).toEqual([{ kind: "joined", name: "Ada" }]);
  });

  it("starts on 9 × 9 for a size that isn't one", async () => {
    const { ada, bo } = await started(15);
    expect(ada.view.size).toBe(9);
    expect(bo.view.size).toBe(9);
  });

  it("asks for a name and a code that can be one, before connecting", () => {
    const server = createFakeRelay();
    const p = side(server, "p");
    p.match.create("  ", 9);
    expect(p.view).toMatchObject({ phase: "lobby", error: "no-name" });
    p.match.join("nope", "Ada");
    expect(p.view).toMatchObject({ phase: "lobby", error: "bad-code" });
    expect(server.log).toEqual([]);
  });
});

describe("playing", () => {
  it("passes stones both ways, and takes captured ones off both boards", async () => {
    const { ada, bo } = await started();
    // White E5 surrounded: black E6, D5, F5, E4 (white answers on the first row).
    await move(ada, bo, 4, 3);
    await move(ada, bo, 4, 4);
    await move(ada, bo, 3, 4);
    await move(ada, bo, 0, 8);
    await move(ada, bo, 5, 4);
    await move(ada, bo, 1, 8);
    await move(ada, bo, 4, 5);
    expect(bo.view.moves).toEqual(ada.view.moves);
    expect(bo.notices.at(-1)).toEqual({ kind: "moved", name: "Ada", cell: "E4" });
    expect(bo.view.myTurn).toBe(true);
    // E5 is empty again: white may play there only if it isn't suicide (it is).
    expect(bo.match.play(4, 4)).toBe(false);
    expect(bo.match.play(4, 3)).toBe(false); // taken
    expect(ada.match.play(8, 8)).toBe(false); // not Ada's turn
  });

  it("tells the other player about a pass, and ends play after two", async () => {
    const { ada, bo } = await started();
    await move(ada, bo, 4, 4);
    await move(ada, bo);
    expect(ada.notices.at(-1)).toEqual({ kind: "passed", name: "Bo" });
    expect(ada.view.phase).toBe("playing");
    await move(ada, bo);
    expect(bo.notices.at(-1)).toEqual({ kind: "scoring", name: "Ada" });
    expect(ada.view).toMatchObject({ phase: "scoring", marking: true, myTurn: false });
    expect(bo.view).toMatchObject({ phase: "scoring", marking: true });
    expect(ada.match.play(0, 0)).toBe(false);
  });
});

describe("marking dead stones and the score", () => {
  /** A 9 × 9 game: black's stone at E5, a white stone at A1 inside black's area; both pass. */
  async function toScoring() {
    const game = await started();
    const { ada, bo } = game;
    await move(ada, bo, 4, 4);
    await move(ada, bo, 0, 8);
    await bothPass(ada, bo);
    return game;
  }
  const A1 = 8 * 9;

  it("marks a chain on both boards, and both accepting it ends the game with one score", async () => {
    const { ada, bo } = await toScoring();
    expect(bo.match.mark(A1)).toBe(true);
    await flush();
    expect(ada.view.marks.dead).toEqual([A1]);
    expect(ada.match.accept()).toBe(true);
    await flush();
    expect(bo.view.marks).toMatchObject({ mine: false, theirs: true });
    expect(bo.notices.at(-1)).toEqual({ kind: "accepted", name: "Ada" });
    bo.match.accept();
    await flush();
    // Black's one stone owns the whole board: 81 against white's 7.5 komi.
    const result = { winner: "black", resigned: null, score: { black: 81, white: 7.5 } };
    expect(ada.view).toMatchObject({ phase: "over", result });
    expect(bo.view).toMatchObject({ phase: "over", result });
    expect(ada.notices.at(-1)).toEqual({ kind: "over", name: "Bo" });
    expect(ada.saved).toMatchObject({ scored: true, marks: { dead: [A1], accepted: true } });
  });

  it("takes back an acceptance when the marks change, and ignores one for other marks", async () => {
    const { ada, bo } = await toScoring();
    ada.match.accept();
    await flush();
    expect(bo.view.marks.theirs).toBe(true);
    bo.match.mark(A1);
    await flush();
    expect(ada.view.marks).toEqual({ dead: [A1], mine: false, theirs: false });
    expect(bo.view.marks).toEqual({ dead: [A1], mine: false, theirs: false });
    // Two clicks at once on the same chain cancel out on both boards.
    ada.match.mark(A1);
    bo.match.mark(A1);
    await flush();
    expect(ada.view.marks.dead).toEqual([A1]);
    expect(bo.view.marks.dead).toEqual([A1]);
    // An empty point marks nothing.
    expect(ada.match.mark(0)).toBe(false);
  });

  it("goes back to playing with Undo, forgetting the marks", async () => {
    const { ada, bo } = await toScoring();
    bo.match.mark(A1);
    await flush();
    // White (Bo) passed last: Bo's undo takes that pass back.
    expect(bo.view.undo.canAsk).toBe(true);
    expect(bo.match.undo()).toBe(true);
    await flush();
    ada.match.allowUndo();
    await flush();
    for (const p of [ada, bo]) {
      expect(p.view).toMatchObject({ phase: "playing", marks: { dead: [] } });
      expect(p.view.moves.length).toBe(3);
    }
    expect(bo.view.myTurn).toBe(true);
  });

  it("lets either player resign while marking", async () => {
    const { ada, bo } = await toScoring();
    bo.match.resign();
    await flush();
    expect(ada.view).toMatchObject({
      phase: "over",
      result: { winner: "black", resigned: "white" },
    });
  });

  it("plays again on the same size with the colors swapped", async () => {
    const { ada, bo } = await started(13);
    ada.match.resign();
    await flush();
    ada.match.rematch();
    bo.match.rematch();
    await flush();
    expect(ada.view).toMatchObject({ phase: "playing", game: 2, size: 13, color: "white" });
    expect(bo.view).toMatchObject({ phase: "playing", game: 2, size: 13, color: "black" });
  });

  it("comes back to the marking where it was after the page reopens", async () => {
    const { server, ada, bo } = await toScoring();
    ada.match.mark(A1);
    await flush();
    bo.match.accept();
    await flush();
    const kept = structuredClone(ada.saved);
    ada.relay.close();
    await flush();
    const again = side(server, "p-ada");
    again.match.resume(kept);
    await flush();
    expect(again.view).toMatchObject({
      phase: "scoring",
      marking: true,
      marks: { dead: [A1], mine: false, theirs: true },
    });
    again.match.accept();
    await flush();
    expect(again.view.phase).toBe("over");
    expect(bo.view.result.score).toEqual({ black: 81, white: 7.5, margin: 73.5 });
  });

  it("comes back to a scored game as over, with its score", async () => {
    const { server, ada, bo } = await toScoring();
    bo.match.mark(A1);
    await flush();
    ada.match.accept();
    bo.match.accept();
    await flush();
    const again = side(server, "p-bo");
    again.match.resume(structuredClone(bo.saved));
    expect(again.view).toMatchObject({ phase: "connecting", result: { winner: "black" } });
    expect(again.view.result.score).toEqual({ black: 81, white: 7.5, margin: 73.5 });
  });

  it("ignores a saved game on a board size that isn't one, or that couldn't have been played", () => {
    const p = side(createFakeRelay(), "p");
    p.match.resume({ room: "K7P4QX", size: 15, moves: [] });
    p.match.resume({
      room: "K7P4QX",
      size: 9,
      moves: [
        [1, 1],
        [1, 1],
      ],
    });
    expect(p.view).toBeNull();
  });
});
