/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the panel's "Now" section
 *
 * The files agents are on right now, each pulsing in its action's colour
 * with the pane's name and how long ago. The section always takes at least
 * NOW_MIN rows, so the tree below stays put as agents start and stop, and
 * the rows no busy file needs say something worth reading instead of
 * standing empty:
 * - while nobody is busy, the last thing an agent did (in its action's
 *   colour; click to open the file);
 * - which agents worked here in the last hour, by their panes' names, or
 *   how long it has been quiet;
 * - a tally of the last hour (edited, added, read), or of all that is
 *   known when the last hour was quiet.
 * Before any agent activity at all, a quiet note and a row that opens the
 * hooks' setup. Text comes from `t` and times are passed in, so it is
 * tested directly; `targets` maps each clickable row to what it opens.
 */
import { latestPerFile } from "./activity.js";
import { shownPath } from "./paths.js";
import { clamp, agoText, marked } from "./row-marks.js";

/** Most files under "Now". */
export const NOW_MAX = 5;
/** Fewest rows the section takes after its header. */
export const NOW_MIN = 3;
/** What "lately" means for the agents and the tally, in ms. */
export const LATELY_MS = 60 * 60 * 1000;

/** Message keys, written out so each can be found in the code. */
const LAST_KEYS = { r: "now-last-r", e: "now-last-e", a: "now-last-a", d: "now-last-d" };

/** How many reads, edits, adds and deletes `events` hold, each file once per action. */
export function tally(events) {
  const seen = new Set();
  const out = { r: 0, e: 0, a: 0, d: 0 };
  for (const e of events) {
    const key = `${e.action}|${e.abs}`;
    if (seen.has(key) || !(e.action in out)) continue;
    seen.add(key);
    out[e.action] += 1;
  }
  return out;
}

/** The panes in `events`, newest first, each once. */
export const panesOf = (events) => [...new Set(events.map((e) => e.pane).filter(Boolean))];

/**
 * The section for `active` (files in use now, newest first) and `events`
 * (all known, newest first) at `now`. Returns { rows, targets }.
 */
export function nowRows(t, { active, events, now, root }) {
  const rows = [];
  const targets = new Map();
  const count = active.length ? { badge: String(active.length) } : {};
  rows.push({ id: "now", label: t("section-now"), section: true, ...count });

  const shown = active.slice(0, NOW_MAX);
  for (const e of shown) {
    const id = `now:${e.abs}`;
    const path = e.shown ?? shownPath(e.abs, root);
    rows.push({
      id,
      label: clamp(path, 256),
      icon: "file",
      ...marked(t, e, now, { pulse: true, path }),
    });
    targets.set(id, { kind: "file", path: e.abs });
  }

  // Nothing known yet: say so, and offer the setup that makes it work.
  if (!events.length) {
    rows.push({ id: "now-idle", label: t("page-empty-now"), icon: "none", muted: true });
    rows.push({ id: "now-setup", label: t("now-setup"), icon: "info", tone: "accent" });
    targets.set("now-setup", { kind: "setup" });
    padTo(rows, shown.length + 2);
    return { rows, targets };
  }

  const extra = [];
  if (!shown.length) extra.push(lastRow(t, events[0], now, root, targets));
  const lately = events.filter((e) => now - e.ts <= LATELY_MS);
  extra.push(agentsRow(t, lately, events[0], now));
  extra.push(tallyRow(t, lately.length ? lately : events, lately.length > 0));
  rows.push(...extra.slice(0, Math.max(0, NOW_MIN - shown.length)));
  return { rows, targets };
}

/** Blank rows up to `n` after the header (Tilefold accepts a blank label). */
function padTo(rows, n) {
  for (let i = n; i < NOW_MIN; i++) {
    rows.push({ id: `now-pad-${i}`, label: " ", icon: "none", muted: true });
  }
}

/** The last thing an agent did, in its action's colour; it opens the file. */
function lastRow(t, e, now, root, targets) {
  const path = e.shown ?? shownPath(e.abs, root);
  const id = `now-last:${e.abs}`;
  targets.set(id, { kind: "file", path: e.abs });
  return {
    id,
    label: clamp(t(LAST_KEYS[e.action] ?? LAST_KEYS.e, { pane: e.pane, path }), 256),
    icon: "file",
    ...marked(t, e, now, { pulse: false, path }),
  };
}

/** Who worked here lately, or how long it has been quiet. */
function agentsRow(t, lately, newest, now) {
  const panes = panesOf(lately);
  if (!panes.length) {
    return {
      id: "now-agents",
      label: t("now-quiet", { ago: agoText(t, now - newest.ts) }),
      icon: "none",
      muted: true,
    };
  }
  return {
    id: "now-agents",
    label: clamp(t("now-agents", { names: panes.join(", ") }), 256),
    icon: "info",
    tone: "accent",
    badge: String(panes.length),
    hint: clamp(panes.join("\n"), 512),
  };
}

/** The tally of `events`: of the last hour (`lately`), else of all known. */
function tallyRow(t, events, lately) {
  const n = tally(events);
  return {
    id: "now-tally",
    label: clamp(t(lately ? "now-tally-hour" : "now-tally-all", n), 256),
    icon: "none",
    tone: "info",
  };
}
