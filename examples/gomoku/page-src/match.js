/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — a match between two players over the relay
 *
 * Starting a game makes a room on the relay and shows its code; the other
 * player joins with that code. From then on each move travels as a relay
 * message to the other side, which checks it against the rules before
 * believing it. There is no game server: both pages keep the same list of
 * moves, and everything else follows from it (game.js).
 *
 * Messages between the two players (the relay's `data`), version 1:
 *
 *   { v: 1, t: "hi", player, name, creator }  who I am; sent once per
 *       connection, by the newcomer on joining and by whoever was there
 *       when someone joins, and answered with a sync
 *   { v: 1, t: "sync", game, moves, resigned, rematch }  my game, its
 *       moves, who resigned (a color or null) and whether I asked for
 *       a rematch, so a player who was away catches up on all of it
 *   { v: 1, t: "sync-ask" }                    send me your sync
 *   { v: 1, t: "move", game, n, x, y }         move number n of game `game`
 *   { v: 1, t: "resign", game }
 *   { v: 1, t: "rematch", game }               I want game + 1
 *   { v: 1, t: "bye" }                         I left for good
 *   { v: 1, t: "undo-ask", game, n, to }       may I take my last move back
 *       (from n moves to `to`, one or two moves off)?
 *   { v: 1, t: "undo-yes", game, n, to }       yes: both boards go back to `to`
 *   { v: 1, t: "undo-no", game, n }            no
 *
 * `player` is a random id each player keeps (the relay's member ids change
 * on every reconnect). The player who made the room plays black in odd
 * games and white in even ones, so a rematch swaps colors. A player who
 * comes back after a dropped connection (or after reopening the page) joins
 * the same room again and the two sides exchange syncs: the longer of two
 * agreeing move lists wins, and a newer game wins over an older one.
 *
 * The match only talks to its relay and calls `onChange` with a fresh view
 * of its state; `onSave` gets what to keep to resume later (or null once
 * the player left), and `onNotice` what's worth telling a player who isn't
 * looking (`joined`, `moved`, `left`, `rematch`, `over`, `undo`).
 *
 * Modified 2026-10-29 (undo): a player may ask to take their last move
 *   back (and the reply to it); it happens on both boards once the other
 *   player allows it. `sync` carries how many undos the game has had, so
 *   a player who missed one takes the shorter game instead of putting the
 *   moves back.
 *
 * Last updated by: Tilefold
 */
import { parseCode } from "./code.js";
import { colorOfMove, isValidGame, refusal, resultOf, turnOf } from "./game.js";
import { NO_UNDO, undoActions, undoTarget } from "./undo.js";

/** The app name rooms are made for, so codes from other tiles don't mix. */
export const APP = "gomoku";

/** Version of the players' messages. */
const V = 1;

/** Longest name a player may have, in characters. */
export const NAME_MAX = 24;

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
  creator ? makerColor(game) : makerColor(game) === "black" ? "white" : "black";

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
    phase: "lobby", // lobby | connecting | waiting | playing | over
    error: null, // a relay or join error code, shown in the lobby
    online: false,
    offline: false, // several tries to reach the relay failed in a row
    room: null,
    creator: false,
    name: "",
    opponent: null, // { player, name, here, gone }
    game: 1,
    moves: [],
    result: null, // { winner, line, resigned }
    rematch: { mine: false, theirs: false },
    undo: NO_UNDO, // { mine: to | null, theirs: { n, to } | null, declined }
    undone: 0, // undos this game has had
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
    const { undo } = state;
    return {
      ...state,
      color,
      turn,
      myTurn: state.phase === "playing" && turn === color && !!state.opponent?.here,
      undo: {
        canAsk:
          state.phase === "playing" &&
          !!state.opponent?.here &&
          undo.mine === null &&
          undo.theirs === null &&
          undoTarget(state.moves, color) !== null,
        asked: undo.mine !== null,
        offered: undo.theirs !== null,
        declined: undo.declined,
      },
    };
  }

  /** Keeps what's needed to come back to this game. */
  const save = () => {
    if (!state.room) return onSave(null);
    onSave({
      room: state.room,
      creator: state.creator,
      name: state.name,
      opponent: state.opponent
        ? { player: state.opponent.player, name: state.opponent.name }
        : null,
      game: state.game,
      moves: state.moves,
      resigned: state.result?.resigned ?? null,
      undone: state.undone,
    });
  };

  const tell = (data) => relay.send({ op: "send", data: { v: V, ...data } });
  const hi = () => tell({ t: "hi", player, name: state.name, creator: state.creator });
  const sync = () =>
    tell({
      t: "sync",
      game: state.game,
      moves: state.moves,
      resigned: state.result?.resigned ?? null,
      rematch: state.rematch.mine,
      undone: state.undone,
    });

  /** The result to show for `moves`, with a resignation that wasn't overtaken. */
  const resultFor = (moves, resigned) =>
    resultOf(moves) ??
    (resigned ? { winner: resigned === "black" ? "white" : "black", line: null, resigned } : null);

  /** Moves on to the phase the game is in. */
  const phaseFor = (result) => (result ? "over" : state.opponent ? "playing" : "waiting");

  // Undo: asking, allowing, turning down, and what the other player says (undo.js).
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

  /** Starts game `game` with no moves. */
  function newGame(game) {
    update({
      game,
      moves: [],
      result: null,
      rematch: { mine: false, theirs: false },
      undo: NO_UNDO,
      undone: 0,
    });
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
      game: 1,
      moves: [],
      result: null,
      rematch: { mine: false, theirs: false },
      undo: NO_UNDO,
      undone: 0,
    });
    save();
  }

  // ----------------------------------------------------------- the player's actions

  /** Makes a room and waits for the other player. */
  function create(name) {
    const clean = cleanName(name);
    if (!clean) return update({ error: "no-name" });
    pending = "create";
    update({ phase: "connecting", error: null, name: clean, creator: true });
    relay.connect();
  }

  /** Joins the room another player made. */
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
    if (!saved || !parseCode(saved.room) || !isValidGame(saved.moves)) return;
    pending = null;
    const opponent = saved.opponent ? { ...saved.opponent, here: false, gone: false } : null;
    const result = resultFor(saved.moves, saved.resigned);
    update({
      phase: "connecting",
      error: null,
      room: saved.room,
      creator: !!saved.creator,
      name: cleanName(saved.name),
      opponent,
      game: Number.isInteger(saved.game) && saved.game > 0 ? saved.game : 1,
      moves: saved.moves,
      undone: Number.isInteger(saved.undone) && saved.undone > 0 ? saved.undone : 0,
      undo: NO_UNDO,
      result,
    });
    relay.connect();
  }

  /** Places a stone, when it's this player's turn. */
  function play(x, y) {
    if (!view().myTurn || refusal(state.moves, x, y)) return false;
    // Playing on answers an undo the other player asked for with no, and drops one asked here.
    if (state.undo.theirs) tell({ t: "undo-no", game: state.game, n: state.undo.theirs.n });
    if (state.undo.mine !== null || state.undo.theirs || state.undo.declined)
      update({ undo: NO_UNDO });
    const n = state.moves.length;
    const moves = [...state.moves, [x, y]];
    const result = resultOf(moves);
    update({ moves, result, phase: phaseFor(result) });
    tell({ t: "move", game: state.game, n, x, y });
    save();
    return true;
  }

  /** Gives the game up. */
  function resign() {
    if (state.phase !== "playing") return;
    const color = myColor(state.creator, state.game);
    update({ result: resultFor(state.moves, color), phase: "over" });
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
    if (d.t === "sync") return heardSync(d);
    if (d.t === "sync-ask") return sync();
    if (d.t === "move") return heardMove(d);
    if (d.t === "resign" && d.game === state.game && state.phase === "playing") {
      const color = myColor(state.creator, state.game) === "black" ? "white" : "black";
      update({ result: resultFor(state.moves, color), phase: "over" });
      onNotice({ kind: "over", name: state.opponent.name });
      return save();
    }
    if (d.t === "rematch" && d.game === state.game) return heardRematch();
    if (typeof d.t === "string" && d.t.startsWith("undo-") && d.game === state.game) {
      return undos.heard(d);
    }
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

  function heardHi(d) {
    if (typeof d.player !== "string" || d.player === player || !!d.creator === state.creator)
      return;
    // A different person in a game already under way is ignored: the room is two players'.
    if (state.opponent && state.opponent.player !== d.player) return;
    const first = !state.opponent;
    const opponent = { player: d.player, name: cleanName(d.name) || "?", here: true, gone: false };
    update({ opponent, phase: state.result ? "over" : "playing" });
    if (first) onNotice({ kind: "joined", name: opponent.name });
    sync();
    save();
  }

  function heardSync(d) {
    if (!Number.isInteger(d.game) || d.game < state.game || !isValidGame(d.moves)) return;
    if (d.game > state.game) {
      // They started a rematch while this side was away.
      update({ game: d.game, rematch: { mine: false, theirs: false } });
      return adopt(d.moves, null);
    }
    // A game that had more undos is the newer one: take it, shorter or not.
    const undone = Number.isInteger(d.undone) && d.undone > 0 ? d.undone : 0;
    if (undone > state.undone) {
      update({ undone, undo: NO_UNDO });
      return adopt(d.moves, null);
    }
    if (undone < state.undone) return; // This side is newer; its own sync mends the other.
    const mine = state.moves;
    const agrees = mine.every(([x, y], i) => d.moves[i]?.[0] === x && d.moves[i]?.[1] === y);
    if (agrees && d.moves.length > mine.length) adopt(d.moves, state.result?.resigned ?? null);
    // A resignation this side missed, on the same moves.
    const resigned = d.resigned === "black" || d.resigned === "white" ? d.resigned : null;
    if (resigned && !state.result && d.moves.length === state.moves.length) {
      adopt(state.moves, resigned);
    }
    if (d.rematch === true) heardRematch();
  }

  /** Takes `moves` as the game's. */
  function adopt(moves, resigned) {
    const result = resultFor(moves, resigned);
    update({ moves, result, phase: phaseFor(result) });
    save();
  }

  function heardMove(d) {
    if (d.game !== state.game || state.phase !== "playing") return;
    const theirs = myColor(state.creator, state.game) === "black" ? "white" : "black";
    if (d.n !== state.moves.length || colorOfMove(d.n) !== theirs) {
      // Out of step (a move lost on the way): ask for the whole game.
      if (d.n > state.moves.length) tell({ t: "sync-ask" });
      return;
    }
    if (refusal(state.moves, d.x, d.y)) return;
    const moves = [...state.moves, [d.x, d.y]];
    const result = resultOf(moves);
    // Their move answers an undo asked here with no; the note stays until this side plays.
    const declined = state.undo.mine !== null || state.undo.declined;
    update({ moves, result, phase: phaseFor(result), undo: { ...NO_UNDO, declined } });
    onNotice(
      result
        ? { kind: "over", name: state.opponent.name }
        : { kind: "moved", name: state.opponent.name, x: d.x, y: d.y },
    );
    save();
  }

  return {
    relayEvent,
    create,
    join,
    resume,
    play,
    resign,
    rematch,
    undo: undos.ask,
    allowUndo: undos.allow,
    declineUndo: undos.decline,
    leave,
    dismiss,
    /** The view as it is now. */
    view,
  };
}
