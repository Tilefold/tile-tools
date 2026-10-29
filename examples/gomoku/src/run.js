/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the tile
 *
 * Opens the board's page docked beside the panes (Tilefold 0.1.20; a
 * window of its own before that, or after the user undocks it), sends it
 * its text and what was kept, and keeps what it asks to: the player's
 * random id and name, and the game in progress, so closing the page (or
 * Tilefold) and opening it again goes back to the same game. The page does
 * the playing: it holds the connection to the relay, which a tile page may
 * keep open and the tile itself can't.
 *
 * While the page doesn't have the focus it asks the tile to tell the user
 * what the other player did, as a notice. What happens is recorded in the
 * tile's log as one-word actions (tile.<id>.<action>): `opened`, `closed`,
 * `created`, `started`, `won`, `lost`, `draw`, `left`. Nothing the players
 * typed (their names, the codes) is recorded.
 *
 * Event handlers get half a second, so each one starts its work in the
 * background and returns at once.
 *
 * Modified 2026-10-29 (playing an AI agent): three commands an AI agent in
 *   one of the user's panes can run through Tilefold's tile_run: "Play
 *   against an agent" (a game on this board alone, the agent taking the
 *   other color), "Read the board" (the game as data; { wait: true } waits
 *   up to seven seconds for the agent's turn) and "Play a point" ({ cell }).
 *   Each opens the board if it's closed and passes the request to the page,
 *   which holds the game, and gives back its answer. In a game with another
 *   person the agent may read the board and play for the user on their
 *   turn. The user runs the same commands from the palette (they open the
 *   board). Agent moves are recorded as `agent-moved`, new games against
 *   an agent as `agent-game`.
 * Modified 2026-10-29 (undo): a move taken back is recorded as `undid` (asked for: `undo-asked`), and
 *   the other player's request to undo becomes a notice while the user is
 *   away from the board.
 *
 * Last updated by: Tilefold
 */
import { RELAY_URL } from "./config.js";
import { NOTICE_KEYS, pageLabels } from "./strings.js";

/** The page's activity words the tile records. */
const EVENTS = new Set([
  "created",
  "started",
  "won",
  "lost",
  "draw",
  "left",
  "agent-game",
  "agent-moved",
  "undid",
  "undo-asked",
]);

/** How long a request to the page may take, in ms (a command has ten seconds in all). */
export const AGENT_REPLY_MS = 9000;

/** How long the tile waits for a page it just opened to be ready, in ms. */
const READY_MS = 4000;

/** Store keys. */
const PLAYER = "player";
const NAME = "name";
const GAME = "game";

/** @param {any} tf */
export function runGomoku(tf) {
  /** Logs what went wrong in the tile's log; logging never throws. */
  const warn = (err) =>
    void Promise.resolve()
      .then(() => tf.log.warn(String(err && err.message ? err.message : err)))
      .catch(() => {});
  const audit = (action, details) =>
    void Promise.resolve()
      .then(() => tf.audit(action, details))
      .catch(warn);
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch(warn);

  /** Where the page shows: "side", "window", or null when it's closed. */
  let where = null;
  /** Whether the page has its setup and can answer agents. */
  let ready = false;
  /** Calls waiting for the page to be ready. */
  let readyWaiters = [];
  /** Agents' requests waiting for the page's answer, by id. */
  const pending = new Map();
  let nextId = 0;

  // Docking beside the panes came with Tilefold's theme for tiles (0.1.20).
  const canSide = () => !!tf.page && typeof tf.theme === "function";

  /** Opens the page (beside the panes where Tilefold can), or brings it back. */
  async function open() {
    if (!tf.page) return tf.toast(tf.t("toast-needs-tilefold"));
    const side = canSide();
    await tf.page.open(side ? { side: true } : {});
    if (!where) audit("opened", { as: side ? "side" : "window" });
    where = side ? "side" : "window";
  }

  /** The page went away: nothing it was asked can be answered now. */
  function gone() {
    ready = false;
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new Error("The board was closed."));
      pending.delete(id);
    }
  }

  async function close() {
    if (!tf.page || !where) return;
    where = null;
    gone();
    await tf.page.close();
    audit("closed");
  }

  /** Leaves the game in progress: through the page when it's open, else by forgetting it. */
  async function leave() {
    if (where) {
      try {
        return await tf.page.post({ do: "leave" });
      } catch {
        // The page closed in the meantime: forget the game here.
      }
    }
    if (await tf.store.get(GAME)) {
      await tf.store.set(GAME, null);
      audit("left");
    }
  }

  /** The page loaded: send it everything it needs. */
  async function hello() {
    const [player, name, saved] = await Promise.all([
      tf.store.get(PLAYER),
      tf.store.get(NAME),
      tf.store.get(GAME),
    ]);
    await tf.page.post({
      do: "setup",
      relay: RELAY_URL,
      labels: pageLabels(tf),
      player: typeof player === "string" ? player : null,
      name: typeof name === "string" ? name : "",
      saved: saved && typeof saved === "object" ? saved : null,
    });
  }

  /** The page asks to keep its player's id and name, and the game when it says so. */
  async function keep(m) {
    if (typeof m.player === "string" && /^[0-9a-f]{8,64}$/.test(m.player)) {
      await tf.store.set(PLAYER, m.player);
    }
    if (typeof m.name === "string") await tf.store.set(NAME, m.name.slice(0, 64));
    if ("saved" in m)
      await tf.store.set(GAME, m.saved && typeof m.saved === "object" ? m.saved : null);
  }

  /** Something the other player did, while the user wasn't looking at the board. */
  function notify(m) {
    const key = NOTICE_KEYS[m.kind];
    if (!key) return;
    const name = typeof m.name === "string" ? m.name.slice(0, 64) : "";
    const cell = typeof m.cell === "string" ? m.cell.slice(0, 4) : "";
    return tf.toast(tf.t(key, { name, cell }));
  }

  /** Resolves once the page is ready, opening it first when it's closed. */
  async function pageReady() {
    if (!tf.page)
      throw new Error("This Tilefold can't show Gomoku's board (it needs 0.1.7 or later).");
    if (!where) await open();
    if (ready) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The board didn't open in time; try again.")),
        READY_MS,
      );
      readyWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** Asks the page for something on an agent's behalf, and waits for its answer. */
  async function askPage(ask, input) {
    await pageReady();
    const id = `a${++nextId}`;
    const answer = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("The board didn't answer in time; try again."));
      }, AGENT_REPLY_MS);
      pending.set(id, { resolve, reject, timer });
    });
    await tf.page.post({ do: "agent", id, ask, input: input ?? null });
    return answer;
  }

  /** The page's answer to an agent's request. */
  function answered(m) {
    const p = typeof m.id === "string" ? pending.get(m.id) : undefined;
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    p.resolve(m.reply && typeof m.reply === "object" ? m.reply : {});
  }

  /** A message from the page. */
  async function hear(m) {
    if (!m || typeof m !== "object") return;
    if (m.type === "ready") {
      ready = true;
      const waiters = readyWaiters;
      readyWaiters = [];
      for (const w of waiters) w();
      return;
    }
    if (m.type === "agent") return answered(m);
    if (m.type === "hello") {
      // A page that (re)loads is ready again only after its setup.
      ready = false;
      return hello();
    }
    if (m.type === "keep") return keep(m);
    if (m.type === "notice") return notify(m);
    if (m.type === "event" && EVENTS.has(m.action)) return audit(m.action);
    if (m.type === "close") return close();
  }

  const runs = { open, close, leave };
  for (const [id, title] of [
    ["open", "cmd-open"],
    ["leave", "cmd-leave"],
    ["close", "cmd-close"],
  ]) {
    tf.command(tf.t(title), () => runs[id]().catch(warn), { id });
  }

  // For AI agents (and the palette): the game as data, a move, a game against the agent.
  // An answer with `error` is thrown, so the agent gets it as the reason.
  const forAgent = async (ask, input) => {
    const reply = await askPage(ask, input);
    if (reply.error) throw new Error(`${reply.error}`);
    return reply;
  };
  tf.command(tf.t("cmd-versus"), () => forAgent("versus"), { id: "versus" });
  tf.command(tf.t("cmd-board"), (input) => forAgent("board", input), {
    id: "board",
    input: "{ wait?: true }: the game as data; with wait, holds up to 7 s until it's your turn",
  });
  tf.command(tf.t("cmd-move"), (input) => (input == null ? open() : forAgent("play", input)), {
    id: "move",
    input: '{ cell }: the point to play, such as "H8" (column A-O, row 1-15 from the bottom)',
  });
  tf.on(
    "page.message",
    background((e) => hear(e && e.message)),
  );
  tf.on(
    "page.closed",
    background(() => {
      // Closed from elsewhere (the window's or the dock's close button, the tile turned off).
      if (!where) return;
      where = null;
      gone();
      audit("closed");
    }),
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock on the dock's bar: the board moves to a window of its own.
    background(async () => {
      if (where !== "side") return;
      await tf.page.open();
      where = "window";
    }),
  );
}
