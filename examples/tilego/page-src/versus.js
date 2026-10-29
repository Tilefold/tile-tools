/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — a game against an AI agent
 *
 * One board, no relay: the user plays one color and an AI agent in one of
 * their panes plays the other, through the tile's commands (Read the board,
 * Play a point, Mark dead stones). The user plays black in odd games and
 * white in even ones, so Play again swaps colors; the agent always takes
 * another game, on the same board size.
 *
 * After two passes both mark the dead stones: the user by clicking chains,
 * the agent by naming them. Any change takes back both acceptances; when
 * the user and the agent both accept the same stones, the board is scored.
 * Undo takes the user's last move back at once (the last pass, after both
 * passed, so play goes on).
 *
 * Its view has the same shape as a match's (match.js), so the page draws
 * both the same way: `color` is the user's, `myTurn` the user's turn, and
 * `agentTurn` the agent's. `onSave` gets what to keep to come back to the
 * game (mode "agent"), or null once the user left; `onNotice` hears what
 * the agent did, as a match hears the other player.
 */
import {
  PASS,
  isPass,
  isSize,
  isValidGame,
  moveName,
  playEnded,
  positionOf,
  refusal,
  turnOf,
} from "./game.js";
import { DEFAULT_SIZE, cleanName } from "./match.js";
import {
  NO_MARKS,
  cleanDead,
  resignedResult,
  sameList,
  scoredResult,
  toggleChain,
} from "./score.js";
import { undoTarget } from "./undo.js";

/** The color the user plays in game number `game` (from 1). */
export const userColor = (game) => (game % 2 === 1 ? "black" : "white");

/**
 * @param {{ agentName: string, onChange: (view: any) => void,
 *   onSave: (saved: any) => void, onNotice?: (notice: any) => void }} options
 */
export function createVersus({ agentName, onChange, onSave, onNotice = () => {} }) {
  let state = {
    phase: "lobby", // lobby | playing | scoring | over
    name: "",
    game: 1,
    size: DEFAULT_SIZE,
    moves: [],
    result: null,
    marks: NO_MARKS, // dead, mine (the user accepted), theirs (the agent did)
  };

  /** What the page draws: shaped like a match's view. */
  function view() {
    const color = userColor(state.game);
    const turn = turnOf(state.moves);
    const playing = state.phase === "playing";
    const { marks } = state;
    return {
      mode: "agent",
      phase: state.phase,
      error: null,
      online: true,
      offline: false,
      room: null,
      creator: true,
      name: state.name,
      size: state.size,
      opponent: { player: "agent", name: agentName, here: true, gone: false },
      game: state.game,
      moves: state.moves,
      result: state.result,
      rematch: { mine: false, theirs: true },
      color,
      turn,
      myTurn: playing && turn === color,
      agentTurn: playing && turn !== color,
      marking: state.phase === "scoring",
      marks: { dead: marks.dead, mine: marks.mine, theirs: marks.theirs },
      undo: {
        canAsk: (playing || state.phase === "scoring") && undoTarget(state.moves, color) !== null,
        asked: false,
        offered: false,
        declined: false,
      },
    };
  }

  const update = (changes) => {
    state = { ...state, ...changes };
    onChange(view());
  };

  const save = () =>
    onSave(
      state.phase === "lobby"
        ? null
        : {
            mode: "agent",
            name: state.name,
            game: state.game,
            size: state.size,
            moves: state.moves,
            resigned: state.result?.resigned ?? null,
            scored: !!state.result?.score,
            marks: { dead: state.marks.dead, mine: state.marks.mine, theirs: state.marks.theirs },
          },
    );

  /** The phase the game is in after `moves`, with no result. */
  const phaseAfter = (moves) => (playEnded(moves) ? "scoring" : "playing");

  /** Plays `move` for whoever's turn it is; the reason it can't, or null. */
  function place(move) {
    if (state.phase !== "playing") return "not-playing";
    const why = refusal(state.moves, state.size, move);
    if (why) return why;
    const moves = [...state.moves, move];
    update({ moves, phase: phaseAfter(moves), marks: NO_MARKS });
    save();
    return null;
  }

  /** New dead stones: both acceptances are taken back. */
  const setMarks = (dead) => update({ marks: { dead, v: 0, mine: false, theirs: false } });

  /** One side accepted the marks; with both, the board is scored. */
  function accepted(side) {
    const marks = { ...state.marks, [side]: true };
    if (marks.mine && marks.theirs) {
      update({ marks, result: scoredResult(state.moves, state.size, marks.dead), phase: "over" });
    } else update({ marks });
    save();
  }

  return {
    view,

    /** Starts a game against the agent on a board of `size`, the user playing black. */
    start(name, size = DEFAULT_SIZE) {
      update({
        phase: "playing",
        name: cleanName(name),
        game: 1,
        size: isSize(size) ? size : DEFAULT_SIZE,
        moves: [],
        result: null,
        marks: NO_MARKS,
      });
      save();
    },

    /** The user's stone; true when it was played. */
    play(x, y) {
      return view().myTurn && place([x, y]) === null;
    },

    /** The user passes; true when it counted. */
    pass() {
      return view().myTurn && place(PASS) === null;
    },

    /**
     * The agent's move, a point [x, y] or "pass": null when played, else
     * why not ("not-your-turn", "not-playing", "taken", "ko", "suicide", …).
     */
    agentPlay(move) {
      if (state.phase === "scoring") return "ended";
      if (state.phase === "playing" && !view().agentTurn) return "not-your-turn";
      const why = place(move);
      if (why) return why;
      if (playEnded(state.moves)) onNotice({ kind: "scoring", name: agentName });
      else if (isPass(move)) onNotice({ kind: "agent-passed", name: agentName });
      else onNotice({ kind: "agent-moved", name: agentName, cell: moveName(state.size, move) });
      return null;
    },

    /** The user marks the chain through point `i` dead, or alive again. */
    mark(i) {
      if (state.phase !== "scoring") return false;
      const dead = toggleChain(
        positionOf(state.moves, state.size).board,
        state.size,
        state.marks.dead,
        i,
      );
      if (dead === state.marks.dead) return false;
      setMarks(dead);
      save();
      return true;
    },

    /** The agent names the dead stones (any point of each dead chain); why not, or null. */
    agentDead(points) {
      if (state.phase !== "scoring") return "not-scoring";
      const dead = cleanDead(positionOf(state.moves, state.size).board, state.size, points);
      if (!sameList(dead, state.marks.dead)) {
        setMarks(dead);
        save();
      }
      return null;
    },

    /** The user accepts the dead stones as marked. */
    accept() {
      if (state.phase !== "scoring" || state.marks.mine) return false;
      accepted("mine");
      return true;
    },

    /** The agent accepts the dead stones as marked; why not, or null. */
    agentAccept() {
      if (state.phase !== "scoring") return "not-scoring";
      if (!state.marks.theirs) {
        onNotice({ kind: "accepted", name: agentName });
        accepted("theirs");
      }
      return null;
    },

    /** Takes the user's last move back (and the agent's reply); true when it did. */
    undo() {
      if (!view().undo.canAsk) return false;
      const moves = state.moves.slice(0, undoTarget(state.moves, userColor(state.game)));
      update({ moves, phase: phaseAfter(moves), marks: NO_MARKS });
      save();
      return true;
    },

    /** The user gives the game up. */
    resign() {
      if (state.phase !== "playing" && state.phase !== "scoring") return;
      update({ result: resignedResult(userColor(state.game)), phase: "over" });
      save();
    },

    /** Another game on the same size, colors swapped; the agent always says yes. */
    rematch() {
      if (state.phase !== "over") return;
      update({
        phase: "playing",
        game: state.game + 1,
        moves: [],
        result: null,
        marks: NO_MARKS,
      });
      save();
    },

    /** Back to the lobby; the game is forgotten. */
    leave() {
      update({ phase: "lobby", game: 1, moves: [], result: null, marks: NO_MARKS });
      save();
    },

    dismiss() {},

    /** Picks up a kept game; false (nothing changes) when it couldn't have been played. */
    resume(saved) {
      if (!saved || saved.mode !== "agent" || !isValidGame(saved.moves, saved.size)) return false;
      const { size, moves } = saved;
      const game = Number.isInteger(saved.game) && saved.game > 0 ? saved.game : 1;
      const m = saved.marks && typeof saved.marks === "object" ? saved.marks : {};
      const ended = playEnded(moves);
      const marks = ended
        ? {
            dead: cleanDead(positionOf(moves, size).board, size, m.dead),
            v: 0,
            mine: m.mine === true,
            theirs: m.theirs === true,
          }
        : NO_MARKS;
      const resigned =
        saved.resigned === "black" || saved.resigned === "white" ? saved.resigned : null;
      const result = resigned
        ? resignedResult(resigned)
        : ended && saved.scored === true
          ? scoredResult(moves, size, marks.dead)
          : null;
      update({
        phase: result ? "over" : phaseAfter(moves),
        name: cleanName(saved.name),
        game,
        size,
        moves,
        result,
        marks,
      });
      return true;
    },
  };
}
