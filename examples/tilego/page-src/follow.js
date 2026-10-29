/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — following the other player's board
 *
 * The part of a match (match.js) that takes in what the other board says
 * about the game: each move as it's played (checked against the rules
 * before it's believed), and the syncs that let a player who was away
 * catch up. Between two syncs the newer game wins: a later game (a rematch
 * started meanwhile), then one that had more undos, then the longer of two
 * move lists that agree. A resignation missed while away is taken on the
 * same moves, and so are the dead stones being marked (marks.js).
 */
import {
  PASS,
  colorOfMove,
  isPass,
  isValidGame,
  moveName,
  otherColor,
  playEnded,
  refusal,
} from "./game.js";
import { NO_MARKS, resignedResult } from "./score.js";
import { NO_UNDO } from "./undo.js";

/** A color, or null for anything else. */
export const colorOr = (c) => (c === "black" || c === "white" ? c : null);

/** Whether two moves are the same: both passes, or the same point. */
export const sameMove = (a, b) =>
  isPass(a) ? isPass(b) : Array.isArray(b) && a[0] === b[0] && a[1] === b[1];

/**
 * A match's following of the other board. `ctx`: state(), update(changes),
 * tell(data), save(), phaseFor(result, moves), onNotice(notice), mine()
 * (this side's color), freshGame(game), takeSize(size), mergeMarks(marks)
 * and heardRematch().
 */
export function followActions(ctx) {
  const { update, tell, save, onNotice } = ctx;

  /** Takes `moves` as the game's; the marks start again when the moves changed. */
  function adopt(moves, resigned) {
    const s = ctx.state();
    const result = resigned ? resignedResult(resigned) : null;
    const changed = moves !== s.moves;
    update({
      moves,
      result,
      phase: ctx.phaseFor(result, moves),
      ...(changed ? { marks: NO_MARKS } : {}),
    });
    save();
  }

  return {
    /** The other board's whole game: catch up when it's newer. */
    heardSync(d) {
      // A sync always comes from the other side: for the player who joined, the maker.
      ctx.takeSize(d.size);
      const s = ctx.state();
      if (d.size !== s.size) return;
      if (!Number.isInteger(d.game) || d.game < s.game || !isValidGame(d.moves, s.size)) return;
      if (d.game > s.game) {
        // They started a rematch while this side was away.
        update(ctx.freshGame(d.game));
        return adopt(d.moves, null);
      }
      // A game that had more undos is the newer one: take it, shorter or not.
      const undone = Number.isInteger(d.undone) && d.undone > 0 ? d.undone : 0;
      if (undone > s.undone) {
        update({ undone, undo: NO_UNDO });
        return adopt(d.moves, null);
      }
      if (undone < s.undone) return; // This side is newer; its own sync mends the other.
      const agrees = s.moves.every((move, i) => sameMove(move, d.moves[i]));
      if (agrees && d.moves.length > s.moves.length) adopt(d.moves, s.result?.resigned ?? null);
      // A resignation this side missed, on the same moves.
      const now = ctx.state();
      const resigned = colorOr(d.resigned);
      if (resigned && !now.result && d.moves.length === now.moves.length) {
        adopt(now.moves, resigned);
      }
      // The dead stones, when both are marking them on the same moves.
      if (d.moves.length === ctx.state().moves.length) ctx.mergeMarks(d.marks);
      if (d.rematch === true) ctx.heardRematch();
    },

    /** The other player's move, number `d.n`: a point or a pass. */
    heardMove(d) {
      const s = ctx.state();
      if (s.phase !== "playing") return;
      if (d.n !== s.moves.length || colorOfMove(d.n) !== otherColor(ctx.mine())) {
        // Out of step (a move lost on the way): ask for the whole game.
        if (d.n > s.moves.length) tell({ t: "sync-ask" });
        return;
      }
      const move = isPass(d.move) ? PASS : d.move;
      if (refusal(s.moves, s.size, move)) return;
      const moves = [...s.moves, isPass(move) ? PASS : [move[0], move[1]]];
      // Their move answers an undo asked here with no; the note stays until this side plays.
      const declined = s.undo.mine !== null || s.undo.declined;
      update({
        moves,
        phase: ctx.phaseFor(null, moves),
        undo: { ...NO_UNDO, declined },
        marks: NO_MARKS,
      });
      const name = s.opponent.name;
      onNotice(
        playEnded(moves)
          ? { kind: "scoring", name }
          : isPass(move)
            ? { kind: "passed", name }
            : { kind: "moved", name, cell: moveName(s.size, move) },
      );
      save();
    },
  };
}
