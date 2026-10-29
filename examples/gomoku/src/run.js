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
 */
import { RELAY_URL } from "./config.js";
import { NOTICE_KEYS, pageLabels } from "./strings.js";

/** The page's activity words the tile records. */
const EVENTS = new Set(["created", "started", "won", "lost", "draw", "left"]);

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

  async function close() {
    if (!tf.page || !where) return;
    where = null;
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

  /** A message from the page. */
  async function hear(m) {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") return hello();
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
