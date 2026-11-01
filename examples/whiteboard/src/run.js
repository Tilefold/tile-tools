/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — the tile
 *
 * Holds the board (board.js) and keeps it in the store, so closing the
 * page, undocking it or quitting Tilefold loses nothing. The page only
 * draws: the tile sends it the board after every change, and the page
 * sends back what the user does (a step back or on, a line or a drawing
 * pointed at, a question).
 *
 * Five commands for the AI agent in one of the user's panes, through
 * Tilefold's tile_run: "Show content" (the code or text to explain),
 * "Draw" (shapes, as a new step of the explanation when it says
 * something), "Erase", "Read the board" (everything on it as data, with
 * the user's last question; { wait: true } holds up to seven seconds for
 * the user to ask something new) and "Point on screen" (marks on the
 * user's own panes and the document viewer, see point.js). Each board
 * command opens the board when it's closed. Run from the palette, they
 * just open it. Clearing the board also takes the marks away.
 *
 * What happens is recorded in the tile's log as one-word actions
 * (tile.<id>.<action>): `opened`, `closed`, `shown`, `drew`, `erased`,
 * `cleared`, `asked`, `pointed` and `unpointed`. Never the content, the
 * drawings, the marks or what the user typed.
 *
 * Event handlers get half a second, so each one starts its work in the
 * background and returns at once.
 */
import { askAgent } from "./askAgent.js";
import { ask, describe, draw, emptyBoard, erase, goTo, isBoard, show } from "./board.js";
import { pointing } from "./point.js";
import { pageLabels } from "./strings.js";

/** The store key the board is kept under. */
const BOARD = "board";

/** How long Read the board with { wait: true } holds for the user, in ms (a command has 10 s). */
export const WAIT_MS = 7000;

/** @param {any} tf */
export function runWhiteboard(tf) {
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

  /** The board, once it's loaded from the store. */
  let board = null;
  /** Where the page shows: "side", "window", or null when it's closed. */
  let where = null;
  /** The number of the last ask an agent has read, so `wait` holds for a new one. */
  let seen = 0;
  /** Reads waiting for the user to ask something. */
  let waiters = [];

  // Docking beside the panes came with Tilefold's theme for tiles (0.1.20).
  const canSide = () => !!tf.page && typeof tf.theme === "function";

  /** The board, loaded from the store the first time. */
  async function current() {
    if (board) return board;
    const kept = await tf.store.get(BOARD);
    board = isBoard(kept) ? kept : emptyBoard();
    seen = board.asked?.n ?? 0;
    return board;
  }

  /**
   * `b` as plain JSON data: an optional field the agent left out is
   * `undefined` in the checked board, and Tilefold's store and page
   * messages take only what JSON can carry.
   */
  const plain = (b) => JSON.parse(JSON.stringify(b));

  /** Makes `next` the board: keeps it, and sends it to the page when it's open. */
  async function set(next) {
    if (next === board) return;
    const kept = plain(next);
    await tf.store.set(BOARD, kept);
    board = kept;
    if (where) await tf.page.post({ do: "board", board }).catch(() => {});
  }

  /** Opens the page (beside the panes where Tilefold can), or brings it back. */
  async function open() {
    if (!tf.page) {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return false;
    }
    if (where) return true;
    const side = canSide();
    await tf.page.open(side ? { side: true } : {});
    where = side ? "side" : "window";
    audit("opened");
    return true;
  }

  async function close() {
    if (!tf.page || !where) return;
    where = null;
    await tf.page.close();
    audit("closed");
  }

  /** The page loaded: send it its text and the board. */
  async function hello() {
    await tf.page.post({ do: "setup", labels: pageLabels(tf), board: await current() });
  }

  /**
   * The user asked about something on the page. A waiting agent hears at
   * once; otherwise the question goes to Tilefold's ask card, for the user
   * to send. The page is told which, so it can say so.
   */
  async function asked(m) {
    const before = (await current()).asked?.n ?? 0;
    await set(ask(board, m));
    if ((board.asked?.n ?? 0) === before) return;
    const ws = waiters;
    waiters = [];
    for (const w of ws) w();
    const via = ws.length ? "agent" : await askAgent(tf, board);
    audit("asked", { via });
    if (where) await tf.page.post({ do: "asked", via }).catch(() => {});
  }

  /** A message from the page. */
  async function hear(m) {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") return hello();
    if (m.type === "step") return set(goTo(await current(), m.n));
    if (m.type === "ask") return asked(m);
    if (m.type === "close") return close();
  }

  /** Runs an agent's change: opens the board, applies it, and records one word. */
  async function change(action, apply) {
    if (!(await open()))
      throw new Error("This Tilefold can't show the Whiteboard (it needs 0.1.7 or later).");
    const result = apply(await current());
    await set(result.board ?? result);
    audit(action);
    return result;
  }

  /** Resolves when the user asks something new, or after `ms`. */
  function newAsk(ms) {
    if ((board.asked?.n ?? 0) > seen) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        waiters = waiters.filter((w) => w !== done);
        resolve();
      }
      waiters.push(done);
    });
  }

  // Marks on the user's panes; what the agent says with them goes on the board.
  const pointer = pointing(tf, {
    say: async (text) => void (await change("drew", (b) => draw(b, { shapes: [], say: text }))),
    audit,
  });

  /** What the agent should do next, from what's on the board. */
  function nextFor(b, fresh) {
    const pane = pointer.can()
      ? " To point at something on the user's own panes or in the viewer, use Point on screen."
      : "";
    if (!b.content) return `Show what to explain first: run Show content with { text }.${pane}`;
    if (fresh && b.asked) {
      const about = [
        b.asked.line !== undefined ? `line ${b.asked.line}` : null,
        b.asked.shape
          ? `the shape "${b.asked.shape}"${b.asked.part ? `, its part "${b.asked.part}"` : ""}`
          : null,
      ].filter(Boolean);
      const q = b.asked.question ? `"${b.asked.question}"` : "what it is";
      return `The user asks ${q}${about.length ? ` about ${about.join(" and ")}` : ""}: answer with Draw and a say.`;
    }
    return `Explain with Draw, a step at a time (each say is a step); read with { wait: true } to hear the user's next question.${pane}`;
  }

  /** Read the board: what's on it, and the user's question if there's a new one. */
  async function read(input) {
    if (input == null) return void (await open());
    await current();
    if (input && input.wait === true) await newAsk(WAIT_MS);
    const n = board.asked?.n ?? 0;
    const fresh = n > seen;
    seen = n;
    const out = describe(board, { lines: input && input.lines === true });
    const marks = await pointer.marks().catch(() => null);
    return {
      ...out,
      ...(marks ? { marks } : {}),
      open: !!where,
      newAsk: fresh,
      next: nextFor(board, fresh),
    };
  }

  const runs = {
    open: () => open(),
    close,
    clear: async () => {
      await set({ ...emptyBoard(), nextId: (await current()).nextId, asked: board.asked });
      await pointer.clearAll().catch(warn);
      audit("cleared");
    },
    next: async () => set(goTo(await current(), (await current()).step + 1)),
    back: async () => set(goTo(await current(), (await current()).step - 1)),
  };
  for (const [id, title] of [
    ["open", "cmd-open"],
    ["close", "cmd-close"],
    ["clear", "cmd-clear"],
    ["next", "cmd-next"],
    ["back", "cmd-back"],
  ]) {
    tf.command(tf.t(title), () => void runs[id]().catch(warn), { id });
  }

  // For AI agents. A refused input throws, and the agent gets the reason.
  tf.command(
    tf.t("cmd-show"),
    async (input) => {
      if (input == null) return void (await open());
      const b = await change("shown", (b) => show(b, input));
      const d = describe(b);
      return {
        content: d.content,
        canvas: d.canvas,
        next: "Now explain it with Draw, a step at a time.",
      };
    },
    {
      id: "show",
      input:
        "{ text, kind?: code|text, language?, from?: first line's number, title?, say?, append? }: what to explain",
    },
  );
  tf.command(
    tf.t("cmd-draw"),
    async (input) => {
      if (input == null) return void (await open());
      const { board: b, ids } = await change("drew", (b) => draw(b, input));
      return { ids, step: b.step, steps: b.steps.length };
    },
    {
      id: "draw",
      input:
        "{ shapes: [{ kind, id?, color?, ... }], say?, clear? }: say starts a new step. Read the board's `how` for kinds and points",
    },
  );
  tf.command(
    tf.t("cmd-erase"),
    async (input) => {
      if (input == null) return void (await open());
      const b = await change("erased", (b) => erase(b, input));
      return { shapes: b.shapes.length, steps: b.steps.length };
    },
    { id: "erase", input: "{ ids: [...] } or { step } or { all: true }: what to erase" },
  );
  tf.command(tf.t("cmd-read"), (input) => read(input), {
    id: "read",
    input:
      "{ wait?: true, lines?: true }: the board as data; with wait, holds up to 7 s for the user's question",
  });

  tf.command(
    tf.t("cmd-point"),
    async (input) => {
      if (input == null) return void (await open());
      return pointer.point(input);
    },
    {
      id: "point",
      input:
        '{ marks: [{ kind: highlight|box|underline|arrow|note, at, text?, color?, id? }], say?, clear? }. at: { pane, text } or { pane, row } on a pane\'s screen, or { file, line } in the viewer; pane: your $TILEFOLD_SESSION_ID, its name, "focused" or 1 = first',
    },
  );

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
    // The user pressed Undock: the board moves to a window of its own, and loads again.
    background(async () => {
      if (where !== "side") return;
      await tf.page.open();
      where = "window";
    }),
  );
}
