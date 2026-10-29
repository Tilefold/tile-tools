/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — a match between two players over the relay
 *
 * Starting a game makes a room on the relay and shows its code; the other
 * player joins with that code. The player who starts it picks the board
 * size, and the other board takes it. From then on each move (a stone or a
 * pass) travels as a relay message to the other side, which checks it
 * against the rules before believing it. There is no game server: both
 * pages keep the same list of moves, and everything else follows from it
 * (game.js). After two passes the players mark the dead stones together
 * and both accept the score (marks.js).
 *
 * Messages between the two players (the relay's `data`), version 1:
 *
 *   { v: 1, t: "hi", player, name, creator, size }  who I am (and, from the
 *       room's maker, the board size); sent once per connection, by the
 *       newcomer on joining and by whoever was there when someone joins,
 *       and answered with a sync
 *   { v: 1, t: "sync", game, size, moves, resigned, rematch, undone, marks,
 *       scored }  my game, so a player who was away catches up on all of it
 *   { v: 1, t: "sync-ask" }                    send me your sync
 *   { v: 1, t: "move", game, n, move }         move number n: [x, y] or "pass"
 *   { v: 1, t: "resign", game }
 *   { v: 1, t: "rematch", game }               I want game + 1
 *   { v: 1, t: "bye" }                         I left for good
 *   { v: 1, t: "undo-ask" | "undo-yes" | "undo-no", game, n, to }  (undo.js)
 *   { v: 1, t: "mark" | "accept", game, n, … }  the dead stones (marks.js)
 *
 * `player` is a random id each player keeps (the relay's member ids change
 * on every reconnect). The player who made the room plays black in odd
 * games and white in even ones, so a rematch swaps colors. A player who
 * comes back joins the same room again and the two sides exchange syncs
 * (follow.js).
 *
 * The match only talks to its relay and calls `onChange` with a fresh view
 * of its state; `onSave` gets what to keep to resume later (or null once
 * the player left), and `onNotice` what's worth telling a player who isn't
 * looking (`joined`, `moved`, `passed`, `scoring`, `accepted`, `left`,
 * `rematch`, `over`, `undo`).
 */
import { parseCode } from "./code.js";
import { colorOr, followActions } from "./follow.js";
import { PASS, isSize, isValidGame, otherColor, playEnded, refusal, turnOf } from "./game.js";
import { markActions, marksData, marksFrom } from "./marks.js";
import { NO_MARKS, resignedResult, scoredResult } from "./score.js";
import { NO_UNDO, undoActions, undoPhase, undoTarget } from "./undo.js";

/** The app name rooms are made for, so codes from other tiles don't mix. */
export const APP = "tilego";

/** Version of the players' messages. */
const V = 1;

/** Longest name a player may have, in characters. */
export const NAME_MAX = 24;

/** The board size a new game has unless the player picks another. */
export const DEFAULT_SIZE = 9;

/** Tries to get back into a room that says it's full (the old connection may linger). */
const FULL_RETRIES = 5;

/** Wait between those tries, in milliseconds. */
const FULL_WAIT = 3000;

/** A player's name, trimmed and cut to NAME_MAX; "" for anything else. */
export const cleanName = (name) =>
  typeof name === "string" ? [...name.trim().replace(/\s+/g, " ")].slice(0, NAME_MAX).join("") : "";

/** The color the room's maker plays in game number `game` (from 1). */
const makerColor = (game) => (game % 2 === 1 ? "black" : "white");

/** The color this side plays. */
export const myColor = (creator, game) =>
  creator ? makerColor(game) : otherColor(makerColor(game));

/** A fresh game's part of the state. */
const freshGame = (game) => ({
  game,
  moves: [],
  result: null,
  rematch: { mine: false, theirs: false },
  undo: NO_UNDO,
  undone: 0,
  marks: NO_MARKS,
});

/**
 * @param {{ relay: any, player: string, timers?: any,
 *   onChange: (state: any) => void, onSave: (saved: any) => void,
 *   onNotice: (notice: any) => void }} options
 *   `relay` is what createRelay() makes, without its onEvent: the match
 *   gets events through the `relayEvent` it returns.
 */
export function createMatch({ relay, player, timers = globalThis, onChange, onSave, onNotice }) {
  /** Everything a view needs; replaced, never changed in place, on each update. */
  let state = {
    phase: "lobby", // lobby | connecting | waiting | playing | scoring | over
    error: null, // a relay or join error code, shown in the lobby
    online: false,
    offline: false, // several tries to reach the relay failed in a row
    room: null,
    creator: false,
    name: "",
    size: DEFAULT_SIZE,
    opponent: null, // { player, name, here, gone }
    ...freshGame(1), // game, moves, result, rematch, undo, undone, marks
  };
  /** What the next `open` should do: "create", "join", or null (rejoin the room, if any). */
  let pending = null;
  let fullTries = 0;
  let fullTimer = null;

  const update = (changes) => {
    state = { ...state, ...changes };
    onChange(view());
  };

  /** What the page draws: the state plus what follows from it. */
  function view() {
    const color = myColor(state.creator, state.game);
    const turn = turnOf(state.moves);
    const { undo, marks } = state;
    const here = !!state.opponent?.here;
    return {
      ...state,
      color,
      turn,
      myTurn: state.phase === "playing" && turn === color && here,
      marking: state.phase === "scoring" && here && state.online,
      marks: { dead: marks.dead, mine: marks.mine, theirs: marks.theirs },
      undo: {
        canAsk:
          undoPhase(state.phase) &&
          here &&
          undo.mine === null &&
          undo.theirs === null &&
          undoTarget(state.moves, color) !== null,
        asked: undo.mine !== null,
        offered: undo.theirs !== null,
        declined: undo.declined,
      },
    };
  }

  /** The game as data, as it's kept and as the other board gets it in a sync. */
  const gameData = () => ({
    game: state.game,
    size: state.size,
    moves: state.moves,
    resigned: state.result?.resigned ?? null,
    scored: !!state.result?.score,
    undone: state.undone,
    marks: marksData(state.marks),
  });

  /** Keeps what's needed to come back to this game. */
  const save = () => {
    if (!state.room) return onSave(null);
    const { opponent } = state;
    onSave({
      room: state.room,
      creator: state.creator,
      name: state.name,
      opponent: opponent ? { player: opponent.player, name: opponent.name } : null,
      ...gameData(),
    });
  };

  const tell = (data) => relay.send({ op: "send", data: { v: V, ...data } });
  const hi = () =>
    tell({ t: "hi", player, name: state.name, creator: state.creator, size: state.size });
  const sync = () => tell({ t: "sync", ...gameData(), rematch: state.rematch.mine });

  /** The phase the game is in, for `result` after `moves`. */
  const phaseFor = (result, moves = state.moves) =>
    result ? "over" : !state.opponent ? "waiting" : playEnded(moves) ? "scoring" : "playing";

  /** Both players accepted the same dead stones: the board is scored. */
  function finish(byThem) {
    const result = scoredResult(state.moves, state.size, state.marks.dead);
    update({ result, phase: "over" });
    if (byThem) onNotice({ kind: "over", name: state.opponent.name });
    save();
  }

  // Undo (undo.js) and the dead stones (marks.js), over this match's state.
  const undos = undoActions({
    state: () => state,
    update,
    tell,
    save,
    canAsk: () => view().undo.canAsk,
    mine: () => myColor(state.creator, state.game),
    phaseFor,
    onNotice,
  });
  const marks = markActions({
    state: () => state,
    update,
    tell,
    save,
    canMark: () => view().marking,
    finish,
    onNotice,
  });
  // The other board's moves and syncs (follow.js).
  const follow = followActions({
    state: () => state,
    update,
    tell,
    save,
    phaseFor,
    onNotice,
    mine: () => myColor(state.creator, state.game),
    freshGame,
    takeSize: (size) => takeSize(size),
    mergeMarks: (m) => marks.merge(m),
    heardRematch: () => heardRematch(),
  });

  /** Starts game `game` with no moves, on the same board size. */
  function newGame(game) {
    update(freshGame(game));
    update({ phase: phaseFor(null) });
    save();
  }

  /** Back to the lobby, forgetting the room; `error` says why, if anything went wrong. */
  function toLobby(error = null) {
    pending = null;
    relay.close();
    if (fullTimer !== null) timers.clearTimeout(fullTimer);
    fullTimer = null;
    update({
      phase: "lobby",
      error,
      online: false,
      offline: false,
      room: null,
      creator: false,
      opponent: null,
      ...freshGame(1),
    });
    save();
  }

  // ----------------------------------------------------------- the player's actions

  /** Makes a room, with a board of `size`, and waits for the other player. */
  function create(name, size = DEFAULT_SIZE) {
    const clean = cleanName(name);
    if (!clean) return update({ error: "no-name" });
    pending = "create";
    update({
      phase: "connecting",
      error: null,
      name: clean,
      creator: true,
      size: isSize(size) ? size : DEFAULT_SIZE,
    });
    relay.connect();
  }

  /** Joins the room another player made; its maker's board size comes with the first hello. */
  function join(code, name) {
    const clean = cleanName(name);
    if (!clean) return update({ error: "no-name" });
    const room = parseCode(code);
    if (!room) return update({ error: "bad-code" });
    pending = "join";
    update({ phase: "connecting", error: null, name: clean, room, creator: false });
    relay.connect();
  }

  /** Comes back to a game kept with onSave (after the page reopened). */
  function resume(saved) {
    if (!saved || !parseCode(saved.room) || !isValidGame(saved.moves, saved.size)) return;
    pending = null;
    const opponent = saved.opponent ? { ...saved.opponent, here: false, gone: false } : null;
    const kept = marksFrom(saved.marks, saved.moves, saved.size);
    const resigned = colorOr(saved.resigned);
    const result = resigned
      ? resignedResult(resigned)
      : saved.scored === true && playEnded(saved.moves)
        ? scoredResult(saved.moves, saved.size, kept.dead)
        : null;
    update({
      phase: "connecting",
      error: null,
      room: saved.room,
      creator: !!saved.creator,
      name: cleanName(saved.name),
      size: saved.size,
      opponent,
      game: Number.isInteger(saved.game) && saved.game > 0 ? saved.game : 1,
      moves: saved.moves,
      undone: Number.isInteger(saved.undone) && saved.undone > 0 ? saved.undone : 0,
      undo: NO_UNDO,
      marks: playEnded(saved.moves) ? kept : NO_MARKS,
      result,
    });
    relay.connect();
  }

  /** Plays `move` (a point [x, y] or "pass"), when it's this player's turn. */
  function playMove(move) {
    if (!view().myTurn || refusal(state.moves, state.size, move)) return false;
    // Playing on answers an undo the other player asked for with no, and drops one asked here.
    if (state.undo.theirs) tell({ t: "undo-no", game: state.game, n: state.undo.theirs.n });
    if (state.undo.mine !== null || state.undo.theirs || state.undo.declined)
      update({ undo: NO_UNDO });
    const n = state.moves.length;
    const moves = [...state.moves, move];
    update({ moves, phase: phaseFor(null, moves), marks: NO_MARKS });
    tell({ t: "move", game: state.game, n, move });
    save();
    return true;
  }

  /** Gives the game up, while playing or marking dead stones. */
  function resign() {
    if (state.phase !== "playing" && state.phase !== "scoring") return;
    const color = myColor(state.creator, state.game);
    update({ result: resignedResult(color), phase: "over" });
    tell({ t: "resign", game: state.game });
    save();
  }

  /** Asks for another game; it starts once both players asked. */
  function rematch() {
    if (state.phase !== "over" || state.rematch.mine || state.opponent?.gone) return;
    tell({ t: "rematch", game: state.game });
    if (state.rematch.theirs) return newGame(state.game + 1);
    update({ rematch: { ...state.rematch, mine: true } });
  }

  /** Leaves the room for good. */
  function leave() {
    if (state.room) {
      tell({ t: "bye" });
      relay.send({ op: "leave" });
    }
    toLobby();
  }

  /** Clears an error shown in the lobby. */
  const dismiss = () => update({ error: null });

  // ----------------------------------------------------------- from the relay

  function relayEvent(e) {
    if (e.type === "open") {
      update({ online: true, offline: false });
      if (pending === "create") relay.send({ op: "create", app: APP, size: 2, name: state.name });
      else if (state.room) relay.send({ op: "join", room: state.room, app: APP, name: state.name });
      return;
    }
    if (e.type === "close") {
      return update({
        online: false,
        opponent: state.opponent && { ...state.opponent, here: false },
      });
    }
    if (e.type === "offline") return update({ offline: true });
    if (e.type === "message") hear(e.message);
  }

  function hear(m) {
    switch (m.op) {
      case "created":
        pending = null;
        update({ room: m.room, phase: "waiting" });
        return save();
      case "joined":
        pending = null;
        fullTries = 0;
        if (state.phase === "connecting") update({ phase: state.result ? "over" : "waiting" });
        save();
        // Whoever is there learns who came; with nobody there, the room waits.
        if (Array.isArray(m.members) && m.members.length > 0) hi();
        return;
      case "member-joined":
        return hi();
      case "member-left":
        if (!state.opponent) return;
        return update({ opponent: { ...state.opponent, here: false } });
      case "message":
        return heardPlayer(m.data);
      case "error":
        return refused(m.code);
      default:
        return; // pong, or something newer than this tile.
    }
  }

  /** The relay refused something. */
  function refused(code) {
    if (code === "room-full" && pending === null && state.room && fullTries < FULL_RETRIES) {
      // Coming back: the relay may not have noticed the old connection is gone.
      fullTries += 1;
      fullTimer = timers.setTimeout(() => {
        fullTimer = null;
        relay.send({ op: "join", room: state.room, app: APP, name: state.name });
      }, FULL_WAIT);
      return;
    }
    if (code === "no-room" && pending === null) return toLobby("room-gone");
    if (code === "too-fast" || code === "too-large") return; // Dropped; a sync mends it.
    toLobby(typeof code === "string" ? code : "server");
  }

  /** A message from the other player. */
  function heardPlayer(d) {
    if (!d || typeof d !== "object" || d.v !== V) return;
    if (d.t === "hi") return heardHi(d);
    if (!state.opponent) return; // Not introduced yet.
    if (d.game !== undefined && d.t !== "sync" && d.game !== state.game) return;
    if (d.t === "sync") return follow.heardSync(d);
    if (d.t === "sync-ask") return sync();
    if (d.t === "move") return follow.heardMove(d);
    if (d.t === "resign" && (state.phase === "playing" || state.phase === "scoring")) {
      const color = otherColor(myColor(state.creator, state.game));
      update({ result: resignedResult(color), phase: "over" });
      onNotice({ kind: "over", name: state.opponent.name });
      return save();
    }
    if (d.t === "rematch") return heardRematch();
    if (d.t === "undo-ask" || d.t === "undo-yes" || d.t === "undo-no") return undos.heard(d);
    if (d.t === "mark" || d.t === "accept") return marks.heard(d);
    if (d.t === "bye") {
      update({ opponent: { ...state.opponent, here: false, gone: true } });
      return onNotice({ kind: "left", name: state.opponent.name });
    }
  }

  /** The other player asked for a rematch. */
  function heardRematch() {
    if (state.phase !== "over" || state.rematch.theirs) return;
    if (state.rematch.mine) {
      newGame(state.game + 1);
      return sync();
    }
    update({ rematch: { ...state.rematch, theirs: true } });
    onNotice({ kind: "rematch", name: state.opponent.name });
  }

  /**
   * The board size the room's maker sent, taken by the player who joined
   * (before the first move only: a game's size never changes).
   */
  function takeSize(size) {
    if (state.creator || !isSize(size) || size === state.size || state.moves.length > 0) return;
    update({ size });
  }

  function heardHi(d) {
    if (typeof d.player !== "string" || d.player === player || !!d.creator === state.creator)
      return;
    // A different person in a game already under way is ignored: the room is two players'.
    if (state.opponent && state.opponent.player !== d.player) return;
    if (d.creator) takeSize(d.size);
    const first = !state.opponent;
    const opponent = { player: d.player, name: cleanName(d.name) || "?", here: true, gone: false };
    update({ opponent });
    update({ phase: phaseFor(state.result) });
    if (first) onNotice({ kind: "joined", name: opponent.name });
    sync();
    save();
  }

  return {
    relayEvent,
    create,
    join,
    resume,
    play: (x, y) => playMove([x, y]),
    pass: () => playMove(PASS),
    resign,
    rematch,
    undo: undos.ask,
    allowUndo: undos.allow,
    declineUndo: undos.decline,
    mark: marks.toggle,
    setDead: marks.setDead,
    accept: marks.accept,
    leave,
    dismiss,
    /** The view as it is now. */
    view,
  };
}
