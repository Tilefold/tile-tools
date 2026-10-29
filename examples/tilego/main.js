/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — the game of Go against another developer, or an AI agent
 *
 * A Go board (9 × 9, 13 × 13 or 19 × 19) docked beside your panes. Start a
 * game and send the other player its code; they join with it in their own
 * Tilefold, and each move reaches the other board as it's played. Or play
 * an AI agent in one of your panes, which reads the board and plays through
 * the tile's commands. Close the board and open it again (even after
 * quitting Tilefold) and you're back in the same game.
 *
 * Like the Gomoku example, its page keeps a WebSocket open to a room
 * relay, a small server that passes messages between the people in a room
 * and knows nothing about the game. The relay's address is in config.js
 * and its protocol in page-src/relay.js.
 *
 * Needs Tilefold 0.1.7 for the page, 0.1.20 to dock it beside the panes.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/config.js
var RELAY_URL = "wss://play.tilefold.com/rooms";

// src/strings.js
var PAGE_KEYS = [
  "page-lang",
  "page-dir",
  "page-title",
  "page-close",
  "lobby-intro",
  "lobby-name",
  "lobby-name-hint",
  "lobby-size",
  "size-nine",
  "size-thirteen",
  "size-nineteen",
  "lobby-new",
  "lobby-agent",
  "agent-name",
  "lobby-code",
  "lobby-code-hint",
  "lobby-join",
  "waiting-title",
  "waiting-hint",
  "waiting-copy",
  "waiting-copied",
  "action-cancel",
  "action-resign",
  "action-rematch",
  "action-leave",
  "action-undo",
  "action-pass",
  "action-accept",
  "undo-waiting",
  "undo-offered",
  "undo-allow",
  "undo-decline",
  "undo-declined",
  "rematch-offered",
  "rematch-accept",
  "rematch-waiting",
  "scoring-hint",
  "scoring-hint-agent",
  "score-line",
  "accept-waiting",
  "accept-theirs",
  "status-connecting",
  "status-reconnecting",
  "status-your-turn",
  "status-their-turn",
  "status-agent-turn",
  "status-they-passed",
  "status-agent-passed",
  "status-scoring",
  "status-away",
  "status-gone",
  "status-won",
  "status-lost",
  "result-you-resigned",
  "result-they-resigned",
  "player-you",
  "stone-black",
  "stone-white",
  "board-label",
  "cell-empty",
  "cell-black",
  "cell-white",
  "cell-black-dead",
  "cell-white-dead",
  "cell-black-area",
  "cell-white-area",
  "error-no-name",
  "error-bad-code",
  "error-no-room",
  "error-room-full",
  "error-room-gone",
  "error-offline",
  "error-server"
];
var MARKS = {
  name: "{name}",
  code: "{code}",
  cell: "{cell}",
  black: "{black}",
  white: "{white}",
  margin: "{margin}"
};
var pageLabels = (tf) => Object.fromEntries(PAGE_KEYS.map((key) => [key, tf.t(key, MARKS)]));
var NOTICE_KEYS = {
  joined: "notice-joined",
  moved: "notice-moved",
  passed: "notice-passed",
  scoring: "notice-scoring",
  accepted: "notice-accepted",
  left: "notice-left",
  rematch: "notice-rematch",
  over: "notice-over",
  "agent-moved": "notice-agent-moved",
  "agent-passed": "notice-agent-passed",
  undo: "notice-undo"
};

// src/run.js
var EVENTS = /* @__PURE__ */ new Set([
  "created",
  "started",
  "scoring",
  "won",
  "lost",
  "left",
  "agent-game",
  "agent-moved",
  "undid",
  "undo-asked"
]);
var AGENT_REPLY_MS = 9e3;
var READY_MS = 4e3;
var PLAYER = "player";
var NAME = "name";
var GAME = "game";
function runTileGo(tf) {
  const warn = (err) => void Promise.resolve().then(() => tf.log.warn(String(err && err.message ? err.message : err))).catch(() => {
  });
  const audit = (action, details) => void Promise.resolve().then(() => tf.audit(action, details)).catch(warn);
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch(warn);
  let where = null;
  let ready = false;
  let readyWaiters = [];
  const pending = /* @__PURE__ */ new Map();
  let nextId = 0;
  const canSide = () => !!tf.page && typeof tf.theme === "function";
  async function open() {
    if (!tf.page) return tf.toast(tf.t("toast-needs-tilefold"));
    const side = canSide();
    await tf.page.open(side ? { side: true } : {});
    if (!where) audit("opened", { as: side ? "side" : "window" });
    where = side ? "side" : "window";
  }
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
  async function leave() {
    if (where) {
      try {
        return await tf.page.post({ do: "leave" });
      } catch {
      }
    }
    if (await tf.store.get(GAME)) {
      await tf.store.set(GAME, null);
      audit("left");
    }
  }
  async function hello() {
    const [player, name, saved] = await Promise.all([
      tf.store.get(PLAYER),
      tf.store.get(NAME),
      tf.store.get(GAME)
    ]);
    await tf.page.post({
      do: "setup",
      relay: RELAY_URL,
      labels: pageLabels(tf),
      player: typeof player === "string" ? player : null,
      name: typeof name === "string" ? name : "",
      saved: saved && typeof saved === "object" ? saved : null
    });
  }
  async function keep(m) {
    if (typeof m.player === "string" && /^[0-9a-f]{8,64}$/.test(m.player)) {
      await tf.store.set(PLAYER, m.player);
    }
    if (typeof m.name === "string") await tf.store.set(NAME, m.name.slice(0, 64));
    if ("saved" in m)
      await tf.store.set(GAME, m.saved && typeof m.saved === "object" ? m.saved : null);
  }
  function notify(m) {
    const key = NOTICE_KEYS[m.kind];
    if (!key) return;
    const name = typeof m.name === "string" ? m.name.slice(0, 64) : "";
    const cell = typeof m.cell === "string" ? m.cell.slice(0, 4) : "";
    return tf.toast(tf.t(key, { name, cell }));
  }
  async function pageReady() {
    if (!tf.page)
      throw new Error("This Tilefold can't show TileGo's board (it needs 0.1.7 or later).");
    if (!where) await open();
    if (ready) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The board didn't open in time; try again.")),
        READY_MS
      );
      readyWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
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
  function answered(m) {
    const p = typeof m.id === "string" ? pending.get(m.id) : void 0;
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    p.resolve(m.reply && typeof m.reply === "object" ? m.reply : {});
  }
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
    ["close", "cmd-close"]
  ]) {
    tf.command(tf.t(title), () => runs[id]().catch(warn), { id });
  }
  const forAgent = async (ask, input) => {
    const reply = await askPage(ask, input);
    if (reply.error) throw new Error(`${reply.error}`);
    return reply;
  };
  tf.command(tf.t("cmd-versus"), () => forAgent("versus"), { id: "versus" });
  tf.command(tf.t("cmd-board"), (input) => forAgent("board", input), {
    id: "board",
    input: "{ wait?: true }: the game as data; with wait, holds up to 7 s until it's your turn"
  });
  tf.command(tf.t("cmd-move"), (input) => input == null ? open() : forAgent("play", input), {
    id: "move",
    input: '{ cell }: the point to play, such as "E5" (a column letter without I, a row number from the bottom), or "pass"'
  });
  tf.command(tf.t("cmd-score"), (input) => input == null ? open() : forAgent("score", input), {
    id: "score",
    input: '{ dead?: ["C3", ...], accept?: true }: after both passed, one stone of each dead chain ([] for none), then accept the score'
  });
  tf.on(
    "page.message",
    background((e) => hear(e && e.message))
  );
  tf.on(
    "page.closed",
    background(() => {
      if (!where) return;
      where = null;
      gone();
      audit("closed");
    })
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock on the dock's bar: the board moves to a window of its own.
    background(async () => {
      if (where !== "side") return;
      await tf.page.open();
      where = "window";
    })
  );
}

// src/main.js
var main_default = (tf) => {
  runTileGo(tf);
};
export default main_default;
