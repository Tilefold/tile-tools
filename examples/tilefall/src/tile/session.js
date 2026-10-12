/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — game session
 *
 * One game from start to finish, as a small state machine:
 *
 *     none ──newGame──▶ playing ◀──resume── paused
 *                          │  └────pause────▶  │
 *                          └──── top out ──▶ over ──newGame──▶ playing
 *
 * The session owns the engine game and the gravity loop. Player actions
 * only reach the engine while playing; every change is reported through
 * `onChange` (redraw) and noteworthy moments through `onEvent` (lines
 * cleared, level up, game over) so the tile can play sounds, save and
 * record them. It knows nothing about Tilefold, which keeps it testable.
 */
import { createLoop } from "./loop.js";

/** Player actions and the engine method each runs. */
export const MOVES = {
  left: "moveLeft",
  right: "moveRight",
  rotate: "rotateCW",
  rotateBack: "rotateCCW",
  softDrop: "softDrop",
  hardDrop: "hardDrop",
  hold: "hold",
};

/**
 * Creates a session.
 *
 * @param {{
 *   engine: { createGame: (opts: object) => any, gravityMs: (level: number) => number },
 *   onChange?: () => void,
 *   onEvent?: (e: { type: string, [k: string]: unknown }) => void,
 *   onError?: (err: unknown) => void,
 *   now?: () => number,
 *   timers?: { setTimer?: (fn: () => void, ms: number) => any, clearTimer?: (h: any) => void },
 * }} o
 */
export function createSession(o) {
  const onChange = o.onChange ?? (() => {});
  const onEvent = o.onEvent ?? (() => {});
  const now = o.now ?? (() => Date.now());

  /** @type {"none"|"playing"|"paused"|"over"} */
  let status = "none";
  let game = null;
  /** Play time banked before the current stretch, and when that stretch began. */
  let bankedMs = 0;
  let since = 0;
  /** What the last state looked like, to spot clears, level-ups and the top out. */
  let seen = { clears: 0, level: 1, over: false };

  const loop = createLoop({
    step: () => {
      if (status !== "playing" || !game) return;
      if (game.tick()) settle();
    },
    delay: () => (game ? o.engine.gravityMs(game.getState().level) : 1000),
    onError: o.onError,
    ...(o.timers ?? {}),
  });

  /** Remembers what the game looks like now. */
  const remember = () => {
    const s = game.getState();
    seen = { clears: s.clears, level: s.level, over: s.over };
    return s;
  };

  /** Banks the play time of the stretch that is ending. */
  const bank = () => {
    if (status === "playing") bankedMs += Math.max(0, now() - since);
  };

  /** After the engine changed: report what is new, then redraw. */
  const settle = () => {
    const s = game.getState();
    if (s.clears !== seen.clears) {
      onEvent({ type: "clear", lines: (s.lastClear && s.lastClear.lines) || 1 });
    }
    if (s.level > seen.level) onEvent({ type: "level", level: s.level });
    seen = { clears: s.clears, level: s.level, over: s.over };
    if (s.over && status === "playing") {
      bank();
      status = "over";
      loop.stop();
      onEvent({ type: "over", score: s.score, lines: s.lines, level: s.level, seconds: seconds() });
    }
    onChange();
  };

  /** Whole seconds played in this game. */
  const seconds = () =>
    Math.floor((bankedMs + (status === "playing" ? Math.max(0, now() - since) : 0)) / 1000);

  return {
    /** "none", "playing", "paused" or "over". */
    get status() {
      return status;
    },
    /** The engine's state, or null before the first game. */
    state() {
      return game ? game.getState() : null;
    },
    /** Seconds of play so far in this game. */
    seconds,

    /**
     * Starts a fresh game.
     *
     * @param {{ startLevel?: number, seed?: number }} [opts]
     */
    newGame(opts = {}) {
      loop.stop();
      game = o.engine.createGame({ startLevel: opts.startLevel ?? 1, seed: opts.seed });
      remember();
      bankedMs = 0;
      since = now();
      status = "playing";
      onEvent({ type: "start", level: game.getState().level });
      loop.start();
      onChange();
    },

    /**
     * Brings back a saved game, paused. False (and nothing changes) when
     * the snapshot cannot be restored.
     *
     * @param {{ game: object, seconds?: number }} snap
     * @returns {boolean}
     */
    restore(snap) {
      if (!snap || !snap.game || typeof snap.game !== "object") return false;
      try {
        const restored = o.engine.createGame({ snapshot: snap.game });
        if (!restored || restored.getState().over) return false;
        loop.stop();
        game = restored;
        remember();
        bankedMs = Math.max(0, Number(snap.seconds) || 0) * 1000;
        status = "paused";
        onChange();
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Runs a player action while playing.
     *
     * @param {string} action A key of {@link MOVES}.
     * @returns {boolean} Whether the game changed.
     */
    act(action) {
      const method = MOVES[action];
      if (!method || status !== "playing" || !game) return false;
      const changed = Boolean(game[method]());
      if (!changed) return false;
      // A new piece after a hard drop gets a full gravity step before it falls.
      if (action === "hardDrop") loop.restart();
      settle();
      return true;
    },

    /**
     * Pauses a running game.
     *
     * @returns {boolean} Whether it was running.
     */
    pause() {
      if (status !== "playing") return false;
      bank();
      status = "paused";
      loop.stop();
      onChange();
      return true;
    },

    /**
     * Resumes a paused game.
     *
     * @returns {boolean} Whether it was paused.
     */
    resume() {
      if (status !== "paused") return false;
      since = now();
      status = "playing";
      loop.start();
      onChange();
      return true;
    },

    /** Stops the clock and the loop for good (the tile is going away). */
    stop() {
      if (status === "playing") {
        bank();
        status = "paused";
      }
      loop.stop();
    },

    /** The game to save, or null when there is nothing worth resuming. */
    snapshot() {
      if (!game || status === "over" || status === "none") return null;
      if (typeof game.toJSON !== "function") return null;
      return { game: game.toJSON(), seconds: seconds() };
    },
  };
}
