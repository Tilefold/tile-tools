/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — saved data
 *
 * What Tilefall keeps between sessions in `tf.store` (the tile's own
 * storage, which nothing else can read):
 *
 *   best      the highest score (a number)
 *   stats     lifetime totals: games finished, lines cleared, play time
 *   snapshot  the game in progress, so a restart or reload resumes it
 *             (paused) instead of losing it; removed when the game ends
 *   visible   whether the game was on screen, so it comes back the same
 *
 * Everything read back is checked, so a damaged or hand-edited value falls
 * back to a sensible default instead of breaking the tile. A failed write
 * is logged and otherwise ignored: losing a save never stops the game.
 */

/** Storage keys. */
export const KEYS = { best: "best", stats: "stats", snapshot: "snapshot", visible: "visible" };

/** The snapshot format this version writes and understands. */
export const SNAPSHOT_VERSION = 1;

/** Lifetime totals as they start. */
export const EMPTY_STATS = Object.freeze({ games: 0, lines: 0, seconds: 0 });

/**
 * A non-negative whole number, or 0.
 *
 * @param {unknown} v
 * @returns {number}
 */
function count(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Wraps `tf.store` with checked reads and forgiving writes.
 *
 * @param {any} tf The tile API.
 */
export function createStore(tf) {
  /** Reads a key; null when missing or when the store fails. */
  const read = async (key) => {
    try {
      return await tf.store.get(key);
    } catch (err) {
      void tf.log
        .warn(`store read ${key} failed: ${String((err && err.message) || err)}`)
        .catch(() => {});
      return null;
    }
  };
  /** Writes a key; logs and carries on when the store fails. */
  const write = async (key, value) => {
    try {
      await tf.store.set(key, value);
      return true;
    } catch (err) {
      void tf.log
        .warn(`store write ${key} failed: ${String((err && err.message) || err)}`)
        .catch(() => {});
      return false;
    }
  };

  return {
    /** The best score so far. */
    async best() {
      return count(await read(KEYS.best));
    },
    /** Records `score` as the best if it beats it; true when it did. */
    async offerBest(score) {
      const best = count(await read(KEYS.best));
      if (count(score) <= best) return false;
      await write(KEYS.best, count(score));
      return true;
    },
    /** Lifetime totals. */
    async stats() {
      const s = await read(KEYS.stats);
      if (!s || typeof s !== "object") return { ...EMPTY_STATS };
      return { games: count(s.games), lines: count(s.lines), seconds: count(s.seconds) };
    },
    /** Adds one finished game to the totals. */
    async addGame(lines, seconds) {
      const s = await this.stats();
      const next = {
        games: s.games + 1,
        lines: s.lines + count(lines),
        seconds: s.seconds + count(seconds),
      };
      await write(KEYS.stats, next);
      return next;
    },
    /** The saved game in progress, or null. */
    async snapshot() {
      const s = await read(KEYS.snapshot);
      if (
        !s ||
        typeof s !== "object" ||
        s.v !== SNAPSHOT_VERSION ||
        !s.game ||
        typeof s.game !== "object"
      ) {
        return null;
      }
      return { v: SNAPSHOT_VERSION, game: s.game, seconds: count(s.seconds) };
    },
    /** Saves the game in progress (`game` is the engine's toJSON()). */
    async saveSnapshot(game, seconds) {
      return write(KEYS.snapshot, { v: SNAPSHOT_VERSION, game, seconds: count(seconds) });
    },
    /** Forgets the game in progress (overwritten with null; the store keeps the key). */
    async clearSnapshot() {
      return write(KEYS.snapshot, null);
    },
    /** Whether the game was last left on screen (default: hidden). */
    async visible() {
      return (await read(KEYS.visible)) === true;
    },
    /** Remembers whether the game is on screen. */
    async setVisible(on) {
      return write(KEYS.visible, Boolean(on));
    },
  };
}
