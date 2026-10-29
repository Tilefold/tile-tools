/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — a game against an AI agent
 *
 * One board, no relay: the user plays one color and an AI agent in one of
 * their panes plays the other, through the tile's commands (Read the board,
 * Play a point). The user plays black in odd games and white in even ones,
 * so Play again swaps colors; the agent always takes another game.
 *
 * Its view has the same shape as a match's (match.js), so the page draws
 * both the same way: `color` is the user's, `myTurn` the user's turn, and
 * `agentTurn` the agent's. `onSave` gets what to keep to come back to the
 * game (mode "agent"), or null once the user left; `onNotice` hears the
 * agent's moves, as a match hears the other player's.
 */
import { isValidGame, refusal, resultOf, turnOf } from "./game.js";
import { cleanName } from "./match.js";

/** The color the user plays in game number `game` (from 1). */
export const userColor = (game) => (game % 2 === 1 ? "black" : "white");

/** A game's result from its moves, or the resignation of `resigned`. */
const resultFor = (moves, resigned) =>
  resultOf(moves) ??
  (resigned ? { winner: resigned === "black" ? "white" : "black", line: null, resigned } : null);

/**
 * @param {{ agentName: string, onChange: (view: any) => void,
 *   onSave: (saved: any) => void, onNotice?: (notice: any) => void }} options
 */
export function createVersus({ agentName, onChange, onSave, onNotice = () => {} }) {
  let state = { phase: "lobby", name: "", game: 1, moves: [], result: null };

  /** What the page draws: shaped like a match's view. */
  function view() {
    const color = userColor(state.game);
    const turn = turnOf(state.moves);
    const playing = state.phase === "playing";
    return {
      mode: "agent",
      phase: state.phase,
      error: null,
      online: true,
      offline: false,
      room: null,
      creator: true,
      name: state.name,
      opponent: { player: "agent", name: agentName, here: true, gone: false },
      game: state.game,
      moves: state.moves,
      result: state.result,
      rematch: { mine: false, theirs: true },
      color,
      turn,
      myTurn: playing && turn === color,
      agentTurn: playing && turn !== color,
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
            moves: state.moves,
            resigned: state.result?.resigned ?? null,
          },
    );

  /** Adds (x, y) for whoever's turn it is; the reason it can't, or null. */
  function place(x, y) {
    if (state.phase !== "playing") return "not-playing";
    const why = refusal(state.moves, x, y);
    if (why) return why;
    const moves = [...state.moves, [x, y]];
    const result = resultOf(moves);
    update({ moves, result, phase: result ? "over" : "playing" });
    save();
    return null;
  }

  return {
    view,

    /** Starts a game against the agent, the user playing black. */
    start(name) {
      update({ phase: "playing", name: cleanName(name), game: 1, moves: [], result: null });
      save();
    },

    /** The user's move; true when it was played. */
    play(x, y) {
      return view().myTurn && place(x, y) === null;
    },

    /** The agent's move: null when played, else why not ("not-your-turn", "taken", …). */
    agentPlay(x, y) {
      if (state.phase === "playing" && !view().agentTurn) return "not-your-turn";
      const why = place(x, y);
      if (!why) onNotice({ kind: "agent-moved", name: agentName, x, y });
      return why;
    },

    /** The user gives the game up. */
    resign() {
      if (state.phase !== "playing") return;
      update({ result: resultFor(state.moves, userColor(state.game)), phase: "over" });
      save();
    },

    /** Another game, colors swapped; the agent always says yes. */
    rematch() {
      if (state.phase !== "over") return;
      update({ phase: "playing", game: state.game + 1, moves: [], result: null });
      save();
    },

    /** Back to the lobby; the game is forgotten. */
    leave() {
      update({ phase: "lobby", game: 1, moves: [], result: null });
      save();
    },

    dismiss() {},

    /** Picks up a kept game; false (nothing changes) when it couldn't have been played. */
    resume(saved) {
      if (!saved || saved.mode !== "agent" || !isValidGame(saved.moves)) return false;
      const game = Number.isInteger(saved.game) && saved.game > 0 ? saved.game : 1;
      const resigned =
        saved.resigned === "black" || saved.resigned === "white" ? saved.resigned : null;
      const result = resultFor(saved.moves, resigned);
      update({
        phase: result ? "over" : "playing",
        name: cleanName(saved.name),
        game,
        moves: saved.moves,
        result,
      });
      return true;
    },
  };
}
