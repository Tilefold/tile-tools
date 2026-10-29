/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — agreeing on the dead stones over the relay
 *
 * Once both players have passed, either of them may click a stone to mark
 * its chain dead (or alive again); each click travels to the other board as
 * a `mark` of that point, and both boards toggle the same chain. Toggling
 * the same chains in any order gives the same list, so two clicks made at
 * once on both boards still agree. Each change counts up the marks'
 * version `v` and takes back any acceptance, so nobody accepts a list that
 * changed under them.
 *
 * Accepting sends the list as this side sees it; the other side takes it
 * as accepted only when its own list is the same. When both have accepted
 * the same list, both boards score it and the game is over. A side that was
 * away catches up from the other's sync: the higher version wins.
 *
 * Messages (the relay's `data`, as in match.js):
 *   { v: 1, t: "mark", game, n, at }      toggle the chain through point `at`
 *   { v: 1, t: "accept", game, n, dead }  I accept these dead stones
 * `n` is the number of moves, so a mark meant for an earlier game (before
 * an undo) is ignored.
 */
import { positionOf } from "./game.js";
import { NO_MARKS, cleanDead, sameList, toggleChain } from "./score.js";

/**
 * A match's marking, over its state. `ctx`: state() (with `marks`, `moves`,
 * `size`, `game`, `phase` and `opponent`), update(changes), tell(data),
 * save(), canMark(), finish(byThem) (both accepted: score it) and
 * onNotice(notice).
 */
export function markActions(ctx) {
  const { update, tell, save, onNotice } = ctx;

  /** The board the marks are made on. */
  const boardNow = () => {
    const s = ctx.state();
    return positionOf(s.moves, s.size).board;
  };

  /** Toggles the chain through `i` here, a new version with nobody's acceptance. */
  function apply(i) {
    const s = ctx.state();
    const dead = toggleChain(boardNow(), s.size, s.marks.dead, i);
    if (dead === s.marks.dead) return false;
    update({ marks: { dead, v: s.marks.v + 1, mine: false, theirs: false } });
    return true;
  }

  /** Toggles the chain through point `i` on both boards; false when it can't. */
  function toggle(i) {
    if (!ctx.canMark() || !Number.isInteger(i)) return false;
    const s = ctx.state();
    if (!apply(i)) return false;
    tell({ t: "mark", game: s.game, n: s.moves.length, at: i });
    save();
    return true;
  }

  return {
    toggle,

    /**
     * Makes the dead stones exactly the chains through `points`, toggling
     * each chain that differs (as an agent asks for a whole list at once).
     */
    setDead(points) {
      if (!ctx.canMark()) return false;
      const s = ctx.state();
      const want = new Set(cleanDead(boardNow(), s.size, points));
      for (const p of [...new Set([...s.marks.dead, ...want])]) {
        const now = ctx.state().marks.dead.includes(p);
        if (now !== want.has(p)) toggle(p);
      }
      return true;
    },

    /** Accepts the dead stones as marked; the game ends once both have. */
    accept() {
      const s = ctx.state();
      if (!ctx.canMark() || s.marks.mine) return false;
      update({ marks: { ...s.marks, mine: true } });
      tell({ t: "accept", game: s.game, n: s.moves.length, dead: s.marks.dead });
      if (s.marks.theirs) ctx.finish(false);
      else save();
      return true;
    },

    /** What the other player said about the marks (`mark`, `accept`). */
    heard(d) {
      const s = ctx.state();
      if (s.phase !== "scoring" || d.n !== s.moves.length) return;
      if (d.t === "mark" && Number.isInteger(d.at)) {
        if (apply(d.at)) save();
      } else if (d.t === "accept" && sameList(d.dead, s.marks.dead) && !s.marks.theirs) {
        update({ marks: { ...s.marks, theirs: true } });
        onNotice({ kind: "accepted", name: s.opponent.name });
        if (s.marks.mine) ctx.finish(true);
        else save();
      }
    },

    /**
     * The marks from the other side's sync (same game, same moves): a
     * higher version is newer and replaces these; the same version and list
     * tells whether they accepted it.
     */
    merge(m) {
      const s = ctx.state();
      if (s.phase !== "scoring" || !m || typeof m !== "object" || !Number.isInteger(m.v)) return;
      const dead = cleanDead(boardNow(), s.size, m.dead);
      const accepted = m.accepted === true;
      if (m.v > s.marks.v) {
        update({ marks: { dead, v: m.v, mine: false, theirs: accepted } });
        return save();
      }
      if (m.v === s.marks.v && sameList(dead, s.marks.dead) && accepted && !s.marks.theirs) {
        update({ marks: { ...s.marks, theirs: true } });
        if (s.marks.mine) return ctx.finish(true);
        save();
      }
    },
  };
}

/** Marks kept or sent as data: `{ dead, v, accepted }`. */
export const marksData = (marks) => ({ dead: marks.dead, v: marks.v, accepted: marks.mine });

/** Marks read back from kept data (on the board of `moves`), else none. */
export function marksFrom(data, moves, size) {
  if (!data || typeof data !== "object" || !Number.isInteger(data.v) || data.v < 0) return NO_MARKS;
  const dead = cleanDead(positionOf(moves, size).board, size, data.dead);
  return { dead, v: data.v, mine: data.accepted === true, theirs: false };
}
