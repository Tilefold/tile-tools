/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — the model (no DOM)
 *
 * The rules behind both views, so tests can check them without a page:
 *
 *   merge       pages from tf.timeline.events joined into one list, newest
 *               first (ties in time by id, as Tilefold orders them); a newer
 *               copy of an event (its status changed) replaces the old one
 *   shown       the loaded events with the kinds the user keeps and a search
 *   paneName    what the user calls a pane ("2 · api"), from the open panes
 *   headline    who did what to whom, in the user's language
 *   statusOf    a status as words, with a tone for its chip
 *   waiting     what waits on the user: panes asking, questions not read
 *   byHour      the timeline's hour groups, in the user's time zone
 *   lanes       one lane per participant: you, managers, the panes they
 *               opened, other panes, then Tilefold and schedules
 *   place       where a time falls in the lanes' window, from 0 to 1
 *
 * `L(key, vars)` is the page's label function: a label from the tile with
 * `{marks}` filled in.
 */

/** Most events the page keeps loaded. */
export const MAX_LOADED = 2000;

/** Newest first; ties in time by id. */
export function sortNewest(list) {
  return [...list].sort((a, b) =>
    a.at === b.at ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.at < b.at ? 1 : -1,
  );
}

/** True for an event as Tilefold gives it (the fields the page reads). */
export function isEvent(e) {
  return (
    !!e &&
    typeof e === "object" &&
    typeof e.id === "string" &&
    typeof e.at === "string" &&
    typeof e.kind === "string" &&
    typeof e.pane === "string" &&
    typeof e.summary === "string"
  );
}

/** `incoming` joined into `list`, newest first, at most MAX_LOADED. */
export function merge(list, incoming) {
  const byId = new Map(list.map((e) => [e.id, e]));
  for (const e of incoming) if (isEvent(e)) byId.set(e.id, e);
  return sortNewest([...byId.values()]).slice(0, MAX_LOADED);
}

/** The events with one of `kinds` and, when there is one, the search in their text or names. */
export function shown(list, kinds, query, nameOf) {
  const q = query.trim().toLowerCase();
  return list.filter(
    (e) =>
      kinds.includes(e.kind) &&
      (!q ||
        e.summary.toLowerCase().includes(q) ||
        nameOf(e.pane).toLowerCase().includes(q) ||
        (e.to != null && nameOf(e.to).toLowerCase().includes(q))),
  );
}

/** The last four letters of a pane's session, to tell closed panes apart. */
const shortId = (pane) => pane.replace(/^tilefold:/, "").slice(-4);

/** What the user calls `pane`, given the open panes. */
export function paneName(pane, panes, L) {
  if (!pane) return "";
  const open = panes.find((p) => p.pane === pane);
  if (open && open.name) return open.name;
  if (pane.startsWith("schedule:")) return L("who-schedules");
  return L("pane-closed", { id: shortId(pane) });
}

/** Who did what to whom: { text, tone }. */
export function headline(e, panes, L) {
  const name = (p) => paneName(p, panes, L);
  const d = e.detail && typeof e.detail === "object" ? e.detail : {};
  const pane = name(e.pane);
  switch (e.kind) {
    case "turn":
      if (e.who === "you") return { text: L("h-you", { pane }), tone: "you" };
      if (e.who === "tilefold") return { text: L("h-typed", { pane }), tone: "tilefold" };
      return { text: L("h-agent", { pane }), tone: "agent" };
    case "message": {
      const key =
        { question: "h-question", answer: "h-answer", report: "h-report" }[d.kind] || "h-message";
      const from = e.who === "schedule" ? L("who-schedules") : pane;
      return {
        text: L(key, { from, to: name(e.to) }),
        tone: d.kind === "question" ? "question" : "agent",
      };
    }
    case "ask": {
      const tone = e.status === "new" ? "question" : "ask";
      if (d.tool === "heartbeat-create") {
        const target = typeof d.pane === "string" ? name(`tilefold:${d.pane}`) : "";
        return { text: L("h-ask-heartbeat", { pane, target }), tone };
      }
      if (d.tool === "schedule-create") return { text: L("h-ask-schedule", { pane }), tone };
      return { text: L("h-ask-open", { pane }), tone };
    }
    case "nudge":
      return { text: L("h-nudge", { pane }), tone: "tilefold" };
    case "heartbeat":
      return { text: L("h-heartbeat", { pane }), tone: "tilefold" };
    case "run": {
      const runName = typeof d.name === "string" ? d.name : "";
      return {
        text: L("h-run", { name: runName }),
        tone: e.status === "started" ? "schedule" : "warn",
      };
    }
    default:
      return { text: pane, tone: "agent" };
  }
}

/** Status keys and tones, by kind and status. */
const STATUS = {
  ask: {
    new: ["st-ask-new", "warning"],
    running: ["st-ask-running", "info"],
    done: ["st-ask-done", "success"],
    failed: ["st-failed", "error"],
    denied: ["st-ask-denied", "error"],
    expired: ["st-ask-expired", "muted"],
  },
  message: {
    new: ["st-msg-sending", "muted"],
    sent: ["st-msg-sending", "muted"],
    held: ["st-msg-held", "warning"],
    delivered: ["st-msg-delivered", "info"],
    read: ["st-msg-read", "muted"],
    refused: ["st-msg-refused", "error"],
  },
  heartbeat: {
    done: ["st-hb-done", "success"],
    stopped: ["st-hb-stopped", "muted"],
    expired: ["st-hb-expired", "muted"],
  },
  run: {
    starting: ["st-run-started", "success"],
    started: ["st-run-started", "success"],
    missed: ["st-run-missed", "warning"],
    skipped: ["st-run-skipped", "warning"],
    failed: ["st-failed", "error"],
  },
};

/** A status as words with a tone, or null. */
export function statusOf(e, L) {
  const s = e.status && STATUS[e.kind] && STATUS[e.kind][e.status];
  return s ? { text: L(s[0]), tone: s[1] } : null;
}

/** What waits on the user: panes asking, then questions not read yet (newest first). */
export function waiting(panes, list, L) {
  const out = [];
  for (const p of panes) {
    if (p.state === "asking")
      out.push({
        pane: p.pane,
        text: L("waiting-asking", { pane: p.name || paneName(p.pane, panes, L) }),
      });
  }
  for (const e of list) {
    if (out.length >= 6) break;
    if (
      e.kind === "message" &&
      e.detail &&
      e.detail.kind === "question" &&
      e.status === "delivered"
    ) {
      const from = paneName(e.pane, panes, L);
      out.push({
        pane: e.pane,
        id: e.id,
        text: L("waiting-question", { from, to: paneName(e.to, panes, L) }),
        summary: e.summary,
      });
    }
  }
  return out;
}

/** Hour groups of a newest-first list, keeping its order; `hourOf(at)` names an hour. */
export function byHour(list, hourOf) {
  const groups = [];
  for (const e of list) {
    const label = hourOf(e.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}

/** The lane an event sits on: the one who acted. */
export function laneOf(e) {
  if (e.kind === "turn" && e.who === "you") return "you";
  if (e.who === "tilefold" || e.kind === "nudge" || e.kind === "heartbeat") return "tilefold";
  if (e.who === "schedule" || e.kind === "run") return "schedule";
  return e.pane;
}

/** The lanes for `list`: [{ id, pane }] in order. */
export function lanes(list, panes) {
  const ids = new Set();
  for (const e of list) {
    ids.add(laneOf(e));
    if (e.kind === "message" && e.to) ids.add(e.to);
  }
  const roleOf = (id) => (panes.find((p) => p.pane === id) || {}).role;
  const rank = (id) =>
    id === "you"
      ? 0
      : id === "tilefold"
        ? 8
        : id === "schedule"
          ? 9
          : { manager: 1, opened: 2 }[roleOf(id)] || 3;
  return [...ids]
    .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => ({ id, pane: panes.find((p) => p.pane === id) || null }));
}

/** Where `at` falls between `from` and `to`, from 0 to 1. */
export function place(at, from, to) {
  const t = Date.parse(at);
  const a = Date.parse(from);
  const b = Date.parse(to);
  return b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 0;
}
