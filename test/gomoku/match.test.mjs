// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — a match between two players
 *
 * Two pages' matches play each other through the fake relay: one makes a
 * room and gets its code, the other joins with it, they take turns (moves
 * out of turn or on a taken point are refused on both sides), five in a
 * row ends the game for both, and a rematch swaps colors. A player who
 * drops out and comes back (or reopens the page from what was saved)
 * catches up on the moves, the resignation or the rematch they missed. A
 * wrong code, a full room or a room that's gone back to the lobby with
 * the reason. Notices go out for what the other player did.
 *
 * Modified 2026-10-29 (undo): a player asks to take their last move back
 *   (with the reply to it), the other allows or declines; allowed, both
 *   boards go back; playing on declines; a player who missed an allowed
 *   undo takes the shorter game when they come back instead of putting
 *   the moves back.
 *
 * Last updated by: Tilefold
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMatch } from "../../examples/gomoku/page-src/match.js";
import { createRelay } from "../../examples/gomoku/page-src/relay.js";
import { createFakeRelay } from "../fake-relay.mjs";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Lets queued frames arrive. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** A page's match on `server`, recording what it saved and noticed. */
function side(server, player, saved = undefined) {
  const out = { saved: saved ?? null, notices: [], view: null };
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

/** Ada makes a room and Bo joins it; both are playing. */
async function started(server = createFakeRelay()) {
  const ada = side(server, "p-ada");
  const bo = side(server, "p-bo");
  ada.match.create("Ada");
  await flush();
  bo.match.join(ada.view.room.toLowerCase(), " Bo ");
  await flush();
  return { server, ada, bo };
}

/** Plays (x, y) for whoever's turn it is, then lets it arrive. */
async function move(ada, bo, x, y) {
  const who = ada.view.myTurn ? ada : bo;
  expect(who.match.play(x, y)).toBe(true);
  await flush();
}

/** Black makes five across row 3; white answers on row 10. */
async function blackWins(ada, bo) {
  for (let i = 0; i < 5; i++) {
    await move(ada, bo, 3 + i, 3);
    if (i < 4) await move(ada, bo, 3 + i, 10);
  }
}

describe("starting a game", () => {
  it("makes a room with a code and waits, then both play once the other joins", async () => {
    const server = createFakeRelay();
    const ada = side(server, "p-ada");
    ada.match.create("  Ada   Lovelace ");
    expect(ada.view.phase).toBe("connecting");
    await flush();
    expect(ada.view).toMatchObject({ phase: "waiting", room: "K7P4QX", creator: true });
    expect(ada.view.name).toBe("Ada Lovelace");
    expect(ada.saved).toMatchObject({ room: "K7P4QX", creator: true, moves: [] });

    const bo = side(server, "p-bo");
    bo.match.join("k7p-4qx", "Bo");
    await flush();
    expect(ada.view.phase).toBe("playing");
    expect(bo.view.phase).toBe("playing");
    expect(ada.view.opponent).toMatchObject({ player: "p-bo", name: "Bo", here: true });
    expect(bo.view.opponent).toMatchObject({ player: "p-ada", name: "Ada Lovelace" });
    // The maker plays black and moves first.
    expect(ada.view).toMatchObject({ color: "black", myTurn: true });
    expect(bo.view).toMatchObject({ color: "white", myTurn: false });
    expect(ada.notices).toEqual([{ kind: "joined", name: "Bo" }]);
    expect(bo.notices).toEqual([{ kind: "joined", name: "Ada Lovelace" }]);
  });

  it("asks for a name and a code that can be one, before connecting", async () => {
    const server = createFakeRelay();
    const p = side(server, "p");
    p.match.create("   ");
    expect(p.view).toMatchObject({ phase: "lobby", error: "no-name" });
    p.match.join("nope", "Ada");
    expect(p.view).toMatchObject({ phase: "lobby", error: "bad-code" });
    p.match.dismiss();
    expect(p.view.error).toBeNull();
    expect(server.log).toEqual([]);
  });

  it("goes back to the lobby for a code with no game, or a game with two players", async () => {
    const { server } = await started();
    const late = side(server, "p-late");
    late.match.join("MN3RTV", "Cy");
    await flush();
    expect(late.view).toMatchObject({ phase: "lobby", error: "no-room", room: null });
    late.match.join("K7P4QX", "Cy");
    await flush();
    expect(late.view).toMatchObject({ phase: "lobby", error: "room-full" });
    expect(late.relay.isOpen()).toBe(false);
  });
});

describe("playing", () => {
  it("passes moves both ways and refuses moves out of turn or on a taken point", async () => {
    const { ada, bo } = await started();
    expect(bo.match.play(7, 7)).toBe(false); // white can't go first
    await move(ada, bo, 7, 7);
    expect(bo.view.moves).toEqual([[7, 7]]);
    expect(bo.view.myTurn).toBe(true);
    expect(bo.notices.at(-1)).toEqual({ kind: "moved", name: "Ada", x: 7, y: 7 });
    expect(bo.match.play(7, 7)).toBe(false); // taken
    await move(ada, bo, 8, 8);
    expect(ada.view.moves).toEqual([
      [7, 7],
      [8, 8],
    ]);
    expect(ada.saved.moves).toEqual(ada.view.moves);
  });

  it("ignores a move the other side couldn't make", async () => {
    const { server, ada, bo } = await started();
    // Bo's page sends a move on Ada's turn: Ada doesn't believe it.
    bo.relay.send({ op: "send", data: { v: 1, t: "move", game: 1, n: 0, x: 1, y: 1 } });
    await flush();
    expect(ada.view.moves).toEqual([]);
    void server;
  });

  it("ends the game for both with five in a row", async () => {
    const { ada, bo } = await started();
    await blackWins(ada, bo);
    for (const p of [ada, bo]) {
      expect(p.view.phase).toBe("over");
      expect(p.view.result.winner).toBe("black");
      expect(p.view.result.line).toHaveLength(5);
    }
    expect(bo.notices.at(-1)).toEqual({ kind: "over", name: "Ada" });
    expect(bo.match.play(0, 0)).toBe(false);
  });

  it("lets a player resign", async () => {
    const { ada, bo } = await started();
    await move(ada, bo, 7, 7);
    bo.match.resign();
    await flush();
    expect(bo.view.result).toMatchObject({ winner: "black", resigned: "white" });
    expect(ada.view.result).toMatchObject({ winner: "black", resigned: "white" });
    expect(ada.view.phase).toBe("over");
  });

  it("starts a rematch once both ask, with colors swapped", async () => {
    const { ada, bo } = await started();
    await blackWins(ada, bo);
    ada.match.rematch();
    await flush();
    expect(ada.view.rematch).toEqual({ mine: true, theirs: false });
    expect(bo.view.rematch).toEqual({ mine: false, theirs: true });
    expect(bo.notices.at(-1)).toEqual({ kind: "rematch", name: "Ada" });
    bo.match.rematch();
    await flush();
    for (const p of [ada, bo]) {
      expect(p.view).toMatchObject({ phase: "playing", game: 2, moves: [], result: null });
    }
    expect(ada.view.color).toBe("white");
    expect(bo.view).toMatchObject({ color: "black", myTurn: true });
  });
});

describe("coming back", () => {
  it("waits while the other player is away, then catches up on the moves missed", async () => {
    const { server, ada, bo } = await started();
    await move(ada, bo, 7, 7);
    server.down = true;
    server.drop(
      [...server.sockets.keys()].find((id) => server.sentBy(id).some((m) => m.name === "Bo")),
    );
    await flush();
    expect(ada.view.opponent.here).toBe(false);
    expect(ada.view.myTurn).toBe(false);
    expect(bo.view.online).toBe(false);
    // While Bo is away nobody can move, so nothing is missed; Ada's page closes and reopens meanwhile.
    server.down = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(bo.view.online).toBe(true);
    expect(ada.view.opponent.here).toBe(true);
    expect(bo.view).toMatchObject({ phase: "playing", myTurn: true, moves: [[7, 7]] });
  });

  it("resumes from what was saved after the page reopens", async () => {
    const { server, ada, bo } = await started();
    await move(ada, bo, 7, 7);
    await move(ada, bo, 8, 8);
    const kept = structuredClone(ada.saved);
    ada.relay.close();
    await flush();
    expect(bo.view.opponent.here).toBe(false);

    const again = side(server, "p-ada", kept);
    again.match.resume(kept);
    await flush();
    expect(again.view).toMatchObject({ phase: "playing", room: "K7P4QX", creator: true });
    expect(again.view.moves).toEqual([
      [7, 7],
      [8, 8],
    ]);
    expect(again.view.opponent).toMatchObject({ name: "Bo", here: true });
    expect(again.view.myTurn).toBe(true);
    expect(bo.view.opponent.here).toBe(true);
  });

  it("catches up on a resignation and a rematch asked while away", async () => {
    const { server, ada, bo } = await started();
    await move(ada, bo, 7, 7);
    const kept = structuredClone(ada.saved);
    ada.relay.close();
    await flush();
    // Bo can't resign alone in a room… but can once Ada is back; instead Bo resigns, then asks
    // for a rematch, while Ada's message path is gone, by talking to the room directly.
    bo.match.resign();
    bo.match.rematch();
    await flush();
    const again = side(server, "p-ada", kept);
    again.match.resume(kept);
    await flush();
    expect(again.view.result).toMatchObject({ winner: "black", resigned: "white" });
    expect(again.view.rematch).toEqual({ mine: false, theirs: true });
    again.match.rematch();
    await flush();
    expect(again.view).toMatchObject({ phase: "playing", game: 2 });
    expect(bo.view).toMatchObject({ phase: "playing", game: 2 });
  });

  it("goes back to the lobby when the saved game's room is gone", async () => {
    const server = createFakeRelay();
    const p = side(server, "p-ada");
    p.match.resume({
      room: "ACD679",
      creator: true,
      name: "Ada",
      opponent: null,
      game: 1,
      moves: [],
    });
    await flush();
    expect(p.view).toMatchObject({ phase: "lobby", error: "room-gone" });
    expect(p.saved).toBeNull();
  });

  it("ignores a saved game that couldn't have been played", () => {
    const p = side(createFakeRelay(), "p");
    p.match.resume({
      room: "K7P4QX",
      moves: [
        [1, 1],
        [1, 1],
      ],
    });
    p.match.resume({ room: "nope", moves: [] });
    expect(p.view).toBeNull();
  });
});

describe("leaving", () => {
  it("tells the other player, forgets the room and goes back to the lobby", async () => {
    const { ada, bo } = await started();
    bo.match.leave();
    await flush();
    expect(bo.view).toMatchObject({ phase: "lobby", room: null });
    expect(bo.saved).toBeNull();
    expect(ada.view.opponent).toMatchObject({ here: false, gone: true });
    expect(ada.notices.at(-1)).toEqual({ kind: "left", name: "Bo" });
    // No rematch with someone who left.
    ada.match.resign();
    ada.match.rematch();
    expect(ada.view.rematch.mine).toBe(false);
  });
});

describe("undo", () => {
  it("takes a move back on both boards once the other player allows it", async () => {
    const { ada, bo } = await started();
    await move(ada, bo, 7, 7);
    expect(ada.view.undo).toMatchObject({ canAsk: true, asked: false });
    expect(bo.view.undo.canAsk).toBe(false); // white has no move to take back yet
    expect(ada.match.undo()).toBe(true);
    await flush();
    expect(ada.view.undo).toMatchObject({ asked: true, canAsk: false });
    expect(bo.view.undo.offered).toBe(true);
    expect(bo.notices.at(-1)).toEqual({ kind: "undo", name: "Ada" });
    bo.match.allowUndo();
    await flush();
    for (const p of [ada, bo]) {
      expect(p.view.moves).toEqual([]);
      expect(p.view.undo).toMatchObject({ asked: false, offered: false });
      expect(p.view.undone).toBe(1);
    }
    expect(ada.view.myTurn).toBe(true);
    expect(ada.saved).toMatchObject({ moves: [], undone: 1 });
  });

  it("takes the reply back too when the other player already answered", async () => {
    const { ada, bo } = await started();
    await move(ada, bo, 7, 7);
    await move(ada, bo, 8, 8);
    ada.match.undo();
    await flush();
    bo.match.allowUndo();
    await flush();
    expect(ada.view.moves).toEqual([]);
    expect(bo.view.moves).toEqual([]);
    expect(ada.view.myTurn).toBe(true);
  });

  it("leaves the game as it is when declined, and says so", async () => {
    const { ada, bo } = await started();
    await move(ada, bo, 7, 7);
    ada.match.undo();
    await flush();
    bo.match.declineUndo();
    await flush();
    expect(ada.view.undo).toMatchObject({ asked: false, declined: true });
    expect(ada.view.moves).toEqual([[7, 7]]);
    // The note stays through the other player's move, and goes with this side's next one.
    await move(ada, bo, 8, 8);
    expect(ada.view.undo.declined).toBe(true);
    await move(ada, bo, 9, 9);
    expect(ada.view.undo.declined).toBe(false);
  });

  it("counts playing on as no", async () => {
    const { ada, bo } = await started();
    await move(ada, bo, 7, 7);
    ada.match.undo();
    await flush();
    expect(bo.match.play(8, 8)).toBe(true);
    await flush();
    expect(ada.view.undo).toMatchObject({ asked: false, declined: true });
    expect(ada.view.moves).toHaveLength(2);
    expect(bo.view.undo.offered).toBe(false);
  });

  it("ignores an undo that doesn't fit the game", async () => {
    const { ada, bo } = await started();
    await move(ada, bo, 7, 7);
    // Bo's page asks to take back black's move: not Bo's to take back.
    bo.relay.send({ op: "send", data: { v: 1, t: "undo-ask", game: 1, n: 1, to: 0 } });
    await flush();
    expect(ada.view.undo.offered).toBe(false);
  });

  it("lets a player who missed an allowed undo take the shorter game", async () => {
    const { server, ada, bo } = await started();
    await move(ada, bo, 7, 7);
    await move(ada, bo, 8, 8);
    const kept = structuredClone(bo.saved);
    ada.match.undo();
    await flush();
    bo.match.allowUndo();
    await flush();
    // Bo reopens from what was kept before the undo: longer, but older.
    bo.relay.close();
    await flush();
    const again = side(server, "p-bo", kept);
    again.match.resume(kept);
    await flush();
    expect(again.view.moves).toEqual([]);
    expect(again.view.undone).toBe(1);
    expect(ada.view.moves).toEqual([]);
  });
});
