/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the docked panel
 *
 * Builds what `tf.panel.show` takes from the tree and the agents'
 * activity:
 * - "Now": the files agents are on right now, each pulsing in its
 *   action's colour, with the pane's name and how long ago;
 * - the tree, where a file an agent is on (or used lately) takes its
 *   action's colour, and a closed folder holding busy files pulses with
 *   how many;
 * - "Recent", pinned to the bottom of the panel (the panel's footer): the
 *   newest five, or all of them, which Tilefold lets grow upward to half
 *   the panel and scroll inside.
 * A Tilefold older than 0.1.11 ignores the colours, pulses and footer and
 * shows the tree. Text comes from `t`, times are passed in, so it is
 * tested directly; `targets` maps each clickable row to what it opens.
 */
import { activeFiles, age, hotFolders, recentFiles, TONES } from "./activity.js";
import { treeRows } from "./model.js";
import { basename, shownPath } from "./paths.js";
import { folderName } from "./tree.js";

/** Recent files shown in the panel before "Show all". */
export const PANEL_RECENT = 5;
/** Most recent files shown with "Show all". */
export const RECENT_LIMIT = 100;
/** Most files under "Now". */
export const NOW_MAX = 5;

/** `text` cut to `max` characters (Tilefold's limits), with "…" when cut. */
export function clamp(text, max) {
  const chars = [...String(text)];
  return chars.length <= max ? String(text) : `${chars.slice(0, max - 1).join("")}…`;
}

/** Message keys, written out so each can be found in the code. */
const AGO_KEYS = { s: "ago-s", m: "ago-m", h: "ago-h", d: "ago-d" };
const HINT_KEYS = { r: "hint-r", e: "hint-e", a: "hint-a", d: "hint-d" };
const NOW_KEYS = { r: "now-r", e: "now-e", a: "now-a", d: "now-d" };

/** A short age, such as "12s" or "5m". */
export const agoText = (t, ms) => {
  const { unit, n } = age(ms);
  return t(AGO_KEYS[unit], { n });
};

/** The tooltip for an action: who did what, how long ago, and the path. */
const activityHint = (t, e, now, path) =>
  clamp(
    `${t(HINT_KEYS[e.action] ?? HINT_KEYS.e, { pane: e.pane, ago: agoText(t, now - e.ts) })}\n${path}`,
    512,
  );

/** What an event adds to a file's row. */
const marked = (t, e, now, { pulse, path }) => ({
  tone: TONES[e.action] ?? "warning",
  ...(pulse ? { pulse: true, badge: e.pane } : {}),
  trail: agoText(t, now - e.ts),
  hint: activityHint(t, e, now, path),
});

/** The subtitle: what the newest agent is doing, or the folder's path. */
function headline(t, active, root) {
  if (!active.length) return root ? clamp(root, 512) : undefined;
  const top = active[0];
  const line = t(NOW_KEYS[top.action] ?? NOW_KEYS.e, {
    pane: top.pane,
    path: top.shown ?? shownPath(top.abs, root),
  });
  const text = active.length > 1 ? t("now-more", { line, count: active.length - 1 }) : line;
  return clamp(text, 512);
}

/** The "Recent" footer rows, and their targets. */
function recentFooter(t, events, root, now, { open, all }) {
  const rows = [];
  const targets = new Map();
  const recent = recentFiles(events, RECENT_LIMIT);
  if (!recent.length) return { rows, targets };
  rows.push({
    id: "recent",
    label: t("section-recent"),
    section: true,
    expandable: true,
    expanded: open,
    badge: String(recent.length),
  });
  targets.set("recent", { kind: "recent" });
  if (!open) return { rows, targets };
  for (const e of all ? recent : recent.slice(0, PANEL_RECENT)) {
    const id = `recent:${e.abs}`;
    rows.push({
      id,
      label: basename(e.abs),
      icon: "file",
      depth: 1,
      ...marked(t, e, now, { pulse: false, path: e.shown ?? shownPath(e.abs, root) }),
      badge: e.pane,
    });
    targets.set(id, { kind: "file", path: e.abs });
  }
  if (recent.length > PANEL_RECENT) {
    const label = all ? t("recent-fewer") : t("recent-all", { count: recent.length });
    rows.push({ id: "recent-more", label, icon: "none", depth: 1, tone: "accent" });
    targets.set("recent-more", { kind: "recent-more" });
  }
  return { rows, targets };
}

/**
 * The panel for `tree` and `events` at `now`. `opts`: activeMs, recentMs,
 * showActivity, filters ({ showHidden, skip }), recentOpen, recentAll.
 * Returns { content, targets, live } (live: something is happening now).
 */
export function panelView({ tree, events, now, t, opts }) {
  const root = tree.root;
  const activity = opts.showActivity ? events : [];
  const active = activeFiles(activity, now, opts.activeMs).filter((e) => e.action !== "d");
  const latest = new Map();
  for (const e of activity) if (!latest.has(e.abs)) latest.set(e.abs, e);
  const hot = hotFolders(active, root);

  const decorate = (row, { kind, path, open }) => {
    if (kind === "dir") {
      const count = hot.get(path);
      if (!count || open) return {};
      return {
        tone: "accent",
        pulse: true,
        badge: String(count),
        hint: clamp(`${t("hint-busy", { count })}\n${path}`, 512),
      };
    }
    const e = latest.get(path);
    if (!e || now - e.ts > opts.recentMs) return {};
    return marked(t, e, now, { pulse: now - e.ts <= opts.activeMs, path });
  };
  const built = treeRows(tree, {
    strings: {
      loading: t("row-loading"),
      empty: t("row-empty"),
      truncated: t("row-truncated"),
      noFolder: t("row-no-folder"),
    },
    filters: opts.filters,
    decorate,
  });

  const rows = [];
  const targets = new Map(built.targets);
  if (active.length) {
    rows.push({ id: "now", label: t("section-now"), section: true, badge: String(active.length) });
    for (const e of active.slice(0, NOW_MAX)) {
      const id = `now:${e.abs}`;
      const path = e.shown ?? shownPath(e.abs, root);
      const label = clamp(path, 256);
      rows.push({ id, label, icon: "file", ...marked(t, e, now, { pulse: true, path }) });
      targets.set(id, { kind: "file", path: e.abs });
    }
    rows.push({ id: "files", label: t("section-files"), section: true });
  }
  rows.push(...built.rows);

  const footer = recentFooter(t, activity, root, now, {
    open: opts.recentOpen,
    all: opts.recentAll,
  });
  for (const [id, target] of footer.targets) targets.set(id, target);
  const subtitle = headline(t, active, root);
  return {
    content: {
      title: root ? folderName(root) : t("title-no-folder"),
      ...(subtitle ? { subtitle } : {}),
      rows,
      ...(footer.rows.length ? { footer: { rows: footer.rows } } : {}),
    },
    targets,
    live: active.length > 0,
  };
}
