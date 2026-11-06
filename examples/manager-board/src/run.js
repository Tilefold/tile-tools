/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — the tile
 *
 * Opens the board's page docked beside the panes (a window of its own once
 * the user undocks it), sends it its text and the choices kept from last
 * time (the view, the scope, the kinds shown and the lanes' time window),
 * and keeps the ones it asks to. The page draws the board; the tile reads
 * the timeline for it: the page asks for one of tf.timeline's calls
 * (events, fullText, filters, now, export) and the tile answers with what
 * Tilefold gave, or a short reason (not-allowed, slow, failed). Only those
 * five calls pass, and Tilefold checks each one again.
 *
 * An export is Tilefold's: it asks the user where to save the file and the
 * tile learns its name, which it says in a notice. What happens is recorded
 * in the tile's log as one-word actions (tile.<id>.<action>): `opened`,
 * `closed`, `view` (with the view's name), `exported` (with the format).
 * Nothing from the timeline is ever recorded or kept by the tile.
 *
 * Event handlers get half a second, so each one starts its work in the
 * background and returns at once.
 */
import { pageLabels } from "./strings.js";

/** The timeline calls the page may ask for. */
export const CALLS = ["events", "fullText", "filters", "now", "export"];
/** The views, the filter kinds, the event kinds and the lanes' time windows (minutes). */
export const VIEWS = ["timeline", "lanes"];
export const FILTER_KINDS = ["all", "team", "project", "fold"];
export const EVENT_KINDS = ["turn", "message", "ask", "nudge", "heartbeat", "run"];
export const WINDOWS = [60, 120, 240];

/** Store key for the kept choices. */
const KEPT = "kept";

/** The kept choices, each checked; anything wrong falls back to the default. */
export function checkKept(raw) {
  const k = raw && typeof raw === "object" ? raw : {};
  const f = k.filter && typeof k.filter === "object" ? k.filter : {};
  const filter =
    FILTER_KINDS.includes(f.kind) &&
    f.kind !== "all" &&
    typeof f.value === "string" &&
    f.value.length > 0 &&
    f.value.length <= 1024
      ? { kind: f.kind, value: f.value }
      : { kind: "all" };
  const kinds = Array.isArray(k.kinds) ? EVENT_KINDS.filter((x) => k.kinds.includes(x)) : [];
  return {
    view: VIEWS.includes(k.view) ? k.view : "timeline",
    filter,
    kinds: kinds.length ? kinds : [...EVENT_KINDS],
    windowMin: WINDOWS.includes(k.windowMin) ? k.windowMin : 120,
  };
}

/** The short reason the page shows for a failed call. */
export function reasonOf(err) {
  const name = err && err.name;
  if (name === "PermissionDeniedError") return "not-allowed";
  if (name === "RateLimitError") return "slow";
  return "failed";
}

/** @param {any} tf */
export function runBoard(tf) {
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
  /** The view last kept, so a change of view is recorded once. */
  let view = null;

  // Docking beside the panes came with Tilefold's theme for tiles (0.1.20).
  const canSide = () => !!tf.page && typeof tf.theme === "function";
  const canRun = () => !!tf.page && !!tf.timeline;

  /** Opens the page (beside the panes where Tilefold can), or brings it back. */
  async function open() {
    if (!canRun()) return tf.toast(tf.t("toast-needs-tilefold"));
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

  /** The page loaded: send it everything it needs. */
  async function hello() {
    const kept = checkKept(await tf.store.get(KEPT));
    view = kept.view;
    await tf.page.post({ do: "setup", labels: pageLabels(tf), kept });
  }

  /** The page asks to keep its choices. */
  async function keep(m) {
    const kept = checkKept(m.kept);
    await tf.store.set(KEPT, kept);
    if (kept.view !== view) {
      view = kept.view;
      audit("view", { view });
    }
  }

  /** Runs one timeline call for the page, and sends its answer. */
  async function call(m) {
    if (typeof m.id !== "string" || !/^[a-z0-9-]{1,32}$/.test(m.id)) return;
    if (!CALLS.includes(m.call)) {
      return tf.page.post({ do: "reply", id: m.id, error: "failed" });
    }
    const args = m.args && typeof m.args === "object" && !Array.isArray(m.args) ? m.args : {};
    let value;
    try {
      if (m.call === "fullText") value = await tf.timeline.fullText(String(args.id ?? ""));
      else if (m.call === "events") value = await tf.timeline.events(args);
      else if (m.call === "export") value = await exportView(args);
      else value = await tf.timeline[m.call]();
    } catch (err) {
      return tf.page.post({ do: "reply", id: m.id, error: reasonOf(err) });
    }
    await tf.page.post({ do: "reply", id: m.id, value: value ?? null });
  }

  /** Exports the page's view; says in a notice where it went. */
  async function exportView(args) {
    const format = args.format === "json" ? "json" : "markdown";
    const reply = await tf.timeline.export({ filter: args.filter, format });
    if (reply && typeof reply.saved === "string") {
      const name = reply.saved.slice(0, 200);
      const count = Number(reply.events) || 0;
      const key = reply.truncated ? "toast-exported-truncated" : "toast-exported";
      await tf.toast(tf.t(key, { name, count }));
      audit("exported", { format, truncated: !!reply.truncated });
    }
    return reply;
  }

  /** A message from the page. */
  async function hear(m) {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") return hello();
    if (m.type === "call") return call(m);
    if (m.type === "keep") return keep(m);
    if (m.type === "close") return close();
  }

  tf.command(tf.t("cmd-open"), () => open().catch(warn), { id: "open" });
  tf.command(tf.t("cmd-close"), () => close().catch(warn), { id: "close" });
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
