/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the window
 *
 * What the tile posts to its page (the Folder Tree window): the strings,
 * once, in the user's language, and then the state each time something
 * changes: the folder, what agents are on now, the tree (with each file's
 * latest action and busy folders), and the recent files. Row ids are the
 * same as the panel's, so a click from either place is handled the same
 * way. Times stay as timestamps; the page shows their age itself and
 * keeps it ticking. Plain data in and out, so it is tested directly.
 */
import { activeFiles, hotFolders, paneCount, recentFiles } from "./activity.js";
import { treeRows } from "./model.js";
import { basename, parent, shownPath } from "./paths.js";
import { folderName } from "./tree.js";

/** Most recent files the window lists. */
export const PAGE_RECENT = 100;
/** Most files under "Now" in the window. */
export const PAGE_NOW = 8;

/** An event as the page shows it: file name, its folder, and who did what when. */
function pageEvent(e, root, prefix) {
  const path = shownPath(e.abs, root);
  const dir = path.includes("/") ? `${parent(path)}/` : "";
  return {
    id: `${prefix}${e.abs}`,
    file: basename(e.abs),
    dir: dir === "./" ? "" : dir,
    pane: e.pane,
    action: e.action,
    ts: e.ts,
  };
}

/** The state for the page, and the targets of its clickable rows. */
export function pageView({ tree, events, now, t, opts }) {
  const root = tree.root;
  const activity = opts.showActivity ? events : [];
  const active = activeFiles(activity, now, opts.activeMs).filter((e) => e.action !== "d");
  const latest = new Map();
  for (const e of activity) if (!latest.has(e.abs)) latest.set(e.abs, e);
  const hot = hotFolders(active, root);
  const built = treeRows(tree, {
    strings: {
      loading: t("row-loading"),
      empty: t("row-empty"),
      truncated: t("row-truncated"),
      noFolder: t("row-no-folder"),
    },
    filters: opts.filters,
  });
  const targets = new Map(built.targets);
  const rows = built.rows.map((r) => {
    const target = built.targets.get(r.id);
    const e = target && target.kind !== "dir" ? latest.get(r.id) : null;
    const mark = e && now - e.ts <= opts.recentMs ? e : null;
    return {
      id: r.id,
      name: r.label,
      depth: r.depth ?? 0,
      kind: target ? target.kind : "note",
      ...(r.expandable ? { expandable: true, expanded: !!r.expanded } : {}),
      ...(r.muted ? { muted: true } : {}),
      ...(mark ? { mark: { action: mark.action, pane: mark.pane, ts: mark.ts } } : {}),
      ...(target?.kind === "dir" && !r.expanded && hot.has(r.id) ? { hot: hot.get(r.id) } : {}),
    };
  });
  const nowList = active.slice(0, PAGE_NOW).map((e) => pageEvent(e, root, "now:"));
  const recent = recentFiles(activity, PAGE_RECENT);
  for (const e of active.slice(0, PAGE_NOW))
    targets.set(`now:${e.abs}`, { kind: "file", path: e.abs });
  for (const e of recent) targets.set(`recent:${e.abs}`, { kind: "file", path: e.abs });
  return {
    state: {
      type: "state",
      title: root ? folderName(root) : t("title-no-folder"),
      root: root ?? "",
      live: nowList.length > 0,
      now: nowList,
      tree: rows,
      recent: recent.map((e) => pageEvent(e, root, "recent:")),
      panes: paneCount(recent),
      activity: opts.showActivity,
    },
    targets,
  };
}

/** The page's strings, in the user's language ("§" marks where a value goes). */
export function pageStrings(t, hookCommand) {
  const n = "§";
  return {
    type: "strings",
    lang: t("page-lang"),
    dir: t("page-dir") === "rtl" ? "rtl" : "ltr",
    now: t("section-now"),
    files: t("section-files"),
    recent: t("section-recent"),
    live: t("page-live"),
    idle: t("page-idle"),
    emptyNow: t("page-empty-now"),
    emptyRecent: t("page-empty-recent"),
    showAll: t("recent-all", { count: n }),
    showFewer: t("recent-fewer"),
    panes: t("page-panes", { count: n }),
    busy: t("hint-busy", { count: n }),
    doing: {
      r: t("page-doing-r"),
      e: t("page-doing-e"),
      a: t("page-doing-a"),
      d: t("page-doing-d"),
    },
    ago: { s: t("ago-s", { n }), m: t("ago-m", { n }), h: t("ago-h", { n }), d: t("ago-d", { n }) },
    setup: {
      title: t("setup-title"),
      intro: t("setup-intro"),
      claude: t("setup-claude"),
      codex: t("setup-codex"),
      other: t("setup-other"),
      copy: t("setup-copy"),
      copied: t("setup-copied"),
      close: t("setup-close"),
      open: t("setup-open"),
      command: hookCommand,
    },
  };
}
