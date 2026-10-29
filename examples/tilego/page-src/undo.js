/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — taking a move back
 *
 * Undo takes back a player's last move (a stone or a pass), and the other
 * player's reply to it when there is one, so it is that player's turn
 * again: one move or two come off the end of the game, never more. After
 * both players passed, Undo is also how play goes on: it takes the last
 * pass back, and the stones marked dead are forgotten. Against an agent
 * the user's Undo happens at once; with another person it is asked for,
 * and happens on both boards only when they allow it: `undoActions` does
 * that part of a match (asking, allowing, turning down, and what the other
 * player says).
 */
import { colorOfMove } from "./game.js";
import { NO_MARKS } from "./score.js";

/**
 * How many moves the game keeps when `color` takes its last move back
 * (the index of that move), or null when `color` has no move to take back.
 * At most two moves come off: `color`'s own, and the reply after it.
 */
export function undoTarget(moves, color) {
  for (let i = moves.length - 1; i >= 0 && i >= moves.length - 2; i--) {
    if (colorOfMove(i) === color) return i;
  }
  return null;
}

/**
 * Whether going back from `n` moves to `to` is an undo `color` may ask
 * for while the game has `moves`: the game hasn't moved on since it was
 * asked, one or two moves come off, and it's then `color`'s turn.
 */
export function undoFits(moves, n, to, color) {
  return (
    Number.isInteger(n) &&
    Number.isInteger(to) &&
    n === moves.length &&
    to >= 0 &&
    to < n &&
    n - to <= 2 &&
    colorOfMove(to) === color
  );
}

/** No undo asked for, either way. */
export const NO_UNDO = Object.freeze({ mine: null, theirs: null, declined: false });

/** The phases in which a move may be taken back: while playing, and while marking dead stones. */
export const undoPhase = (phase) => phase === "playing" || phase === "scoring";

/**
 * A match's undo, over its state. `ctx`: state() (the match's state, with
 * `undo`, `undone` and `marks`), update(changes), tell(data) (to the other
 * player), save(), canAsk(), mine() (this side's color), phaseFor(result,
 * moves) and onNotice(notice).
 */
export function undoActions(ctx) {
  const { update, tell, save, onNotice } = ctx;
  const theirColor = () => (ctx.mine() === "black" ? "white" : "black");

  /** Goes back to `to` moves: an undo both sides agreed on. */
  function goBack(to) {
    const s = ctx.state();
    const moves = s.moves.slice(0, to);
    update({
      moves,
      result: null,
      phase: ctx.phaseFor(null, moves),
      undo: NO_UNDO,
      undone: s.undone + 1,
      marks: NO_MARKS,
    });
    save();
  }

  return {
    /** Asks the other player to let this side take its last move back. */
    ask() {
      if (!ctx.canAsk()) return false;
      const s = ctx.state();
      const to = undoTarget(s.moves, ctx.mine());
      tell({ t: "undo-ask", game: s.game, n: s.moves.length, to });
      update({ undo: { ...NO_UNDO, mine: to } });
      return true;
    },

    /** Allows the undo the other player asked for. */
    allow() {
      const s = ctx.state();
      const asked = s.undo.theirs;
      if (!asked || !undoPhase(s.phase)) return;
      tell({ t: "undo-yes", game: s.game, n: asked.n, to: asked.to });
      goBack(asked.to);
    },

    /** Turns down the undo the other player asked for. */
    decline() {
      const s = ctx.state();
      if (!s.undo.theirs) return;
      tell({ t: "undo-no", game: s.game, n: s.undo.theirs.n });
      update({ undo: NO_UNDO });
    },

    /** What the other player said about an undo (`undo-ask`, `undo-yes`, `undo-no`). */
    heard(d) {
      const s = ctx.state();
      if (d.t === "undo-ask") {
        if (!undoPhase(s.phase) || !undoFits(s.moves, d.n, d.to, theirColor())) return;
        update({ undo: { ...NO_UNDO, theirs: { n: d.n, to: d.to } } });
        onNotice({ kind: "undo", name: s.opponent.name });
      } else if (d.t === "undo-yes") {
        if (s.undo.mine === null || d.to !== s.undo.mine || d.n !== s.moves.length) return;
        goBack(d.to);
      } else if (d.t === "undo-no" && s.undo.mine !== null) {
        update({ undo: { ...NO_UNDO, declined: true } });
      }
    },
  };
}
