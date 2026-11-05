/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree
 *
 * The folder the focused pane is in, as a tree in a panel docked beside
 * your panes, with what your coding agents are doing on it: the files
 * they are reading, editing, adding and deleting pulse in the action's
 * colour with the pane's name, busy folders say how many, and the recent
 * files sit pinned at the bottom of the panel. Click a file to read it in
 * Tilefold's document viewer, which opens right next to the tree. The
 * tree follows you when you switch panes or `cd` elsewhere, and opens in a
 * window of its own too.
 *
 * Agents report through small hooks (Claude Code, Codex) or a folder
 * watcher, in hooks/, which leave empty marker files whose names say what
 * happened; the tile only ever reads names, never what is in a file.
 *
 * It shows what a tile can do from Tilefold 0.1.11 on, each with a
 * permission and a reason:
 * - a docked panel Tilefold draws from rows, with sections, colours,
 *   pulses and a pinned footer (`tf.panel`, `window.panel`);
 * - `tf.pane.cwd()` and the `pane.cwd` event (`pane.cwd`);
 * - `tf.pane.list()` and the `pane.list` event (`pane.list`, Tilefold
 *   0.1.11): every pane's folder and the name the user gave it;
 * - `tf.fs.list` for one level of names, never file contents (`fs.list`);
 * - `tf.viewer.open` to show a file (`viewer.open`);
 * - a page in a window of its own (`tf.page`, `page`);
 * - from Tilefold 0.1.16, new files and folders, renames, moves and the
 *   Trash (`tf.fs.create`, `mkdir`, `rename`, `move`, `trash`; `fs.write`),
 *   with new files opened ready to edit (`tf.viewer.open(path, { edit })`).
 * On Tilefold 0.1.9 and 0.1.10 the panel shows the tree without the
 * colours and the pinned Recent list; the window has everything.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 *
 * Modified 2026-10-23 (changing files): New file, New folder, Rename and
 *   Move to Trash commands, and the panel's right-click menus (panel.menu);
 *   handlers that wait for the user aren't waited for. A double-click on a
 *   file renames it in place (panel.dblclick, and in the window). The
 *   panel belongs to the tabs it is opened on (panel.opened on coming back).
 * Modified 2026-11-02 (pinned folders): Pin this folder, Follow the pane,
 *   Show only the chosen folder and Up one folder.
 * Modified 2026-11-03 (folder field): the panel's folder field
 *   (panel.input) pins the folder the user typed or picked.
 * Modified 2026-11-04 (viewer's file): `viewer.opened` (Tilefold 0.1.26)
 *   shows the document viewer's file in the tree.
 *
 * Last updated by: Tilefold
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/paths.js
function normalize(path) {
  const text = String(path ?? "");
  const absolute = text.startsWith("/");
  const parts = [];
  for (const part of text.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") parts.pop();
      else if (!absolute) parts.push("..");
      continue;
    }
    parts.push(part);
  }
  const joined = parts.join("/");
  return absolute ? `/${joined}` : joined || ".";
}
var join = (dir, rel) => normalize(`${dir}/${rel}`);
function parent(path) {
  const p = normalize(path);
  const at = p.lastIndexOf("/");
  return at <= 0 ? "/" : p.slice(0, at);
}
function basename(path) {
  const p = normalize(path);
  return p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1);
}
function isInside(path, dir) {
  const p = normalize(path);
  const d = normalize(dir);
  if (d === "/") return p.startsWith("/");
  return p === d || p.startsWith(`${d}/`);
}
function relativeTo(path, dir) {
  if (!isInside(path, dir)) return null;
  const p = normalize(path);
  const d = normalize(dir);
  if (p === d) return "";
  return d === "/" ? p.slice(1) : p.slice(d.length + 1);
}
function shownPath(path, root) {
  const rel = root ? relativeTo(path, root) : null;
  return rel === null || rel === "" ? normalize(path) : rel;
}
function placedPath(path, root, places = []) {
  const rel = root ? relativeTo(path, root) : null;
  if (rel) return rel;
  const place = places.filter((p) => p && relativeTo(path, p)).sort((a, b) => b.length - a.length)[0];
  return place ? `${basename(place)}/${relativeTo(path, place)}` : normalize(path);
}
function ancestors(path, limit = 8) {
  const out = [];
  let p = normalize(path);
  while (p !== "/" && out.length < limit) {
    p = parent(p);
    out.push(p);
  }
  return out;
}

// src/activity.js
var TONES = Object.freeze({ r: "info", e: "warning", a: "success", d: "error" });
var MAX_EVENTS = 500;
function toEvents(found) {
  const seen = /* @__PURE__ */ new Set();
  const events = [];
  for (const { root, marker } of found) {
    if (!marker?.path) continue;
    const abs = join(root, marker.path);
    const key = `${marker.ts}.${marker.nonce}.${abs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      ts: marker.ts,
      action: marker.action,
      pane: marker.pane,
      session: marker.session ?? null,
      abs,
      key
    });
  }
  events.sort((a, b) => b.ts - a.ts || (a.key < b.key ? 1 : -1));
  return events.slice(0, MAX_EVENTS);
}
function namedByPane(events, panes = []) {
  const names = /* @__PURE__ */ new Map();
  for (const p of panes) if (p?.session && p.name) names.set(p.session, p.name);
  if (!names.size) return events;
  return events.map(
    (e) => e.session && names.has(e.session) ? { ...e, pane: names.get(e.session) } : e
  );
}
var withShownPaths = (events, root, places = []) => events.map((e) => ({ ...e, shown: placedPath(e.abs, root, places) }));
function latestPerFile(events) {
  const out = /* @__PURE__ */ new Map();
  for (const e of events) if (!out.has(e.abs)) out.set(e.abs, e);
  return [...out.values()];
}
var activeFiles = (events, now, activeMs) => latestPerFile(events).filter((e) => now - e.ts <= activeMs);
function hotFolders(active, root) {
  const out = /* @__PURE__ */ new Map();
  if (!root) return out;
  for (const e of active) {
    for (const dir of ancestors(e.abs, 64)) {
      if (!isInside(dir, root) || dir === root) break;
      out.set(dir, (out.get(dir) ?? 0) + 1);
    }
  }
  return out;
}
var recentFiles = (events, limit) => latestPerFile(events).slice(0, limit);
var paneCount = (events) => new Set(events.map((e) => e.pane)).size;
function age(ms) {
  const s = Math.max(0, Math.round(ms / 1e3));
  if (s < 60) return { unit: "s", n: s };
  if (s < 3600) return { unit: "m", n: Math.floor(s / 60) };
  if (s < 86400) return { unit: "h", n: Math.floor(s / 3600) };
  return { unit: "d", n: Math.floor(s / 86400) };
}

// src/tree.js
var MAX_SKIP = 50;
function parseSkip(text) {
  const names = String(text ?? "").split(/[\s,]+/).map((n) => n.trim()).filter((n) => n && !n.includes("/") && !n.includes("\\"));
  return new Set(names.slice(0, MAX_SKIP));
}
function visibleEntries(entries, { showHidden = false, skip = /* @__PURE__ */ new Set() } = {}) {
  return entries.filter((e) => {
    if (!showHidden && e.name.startsWith(".")) return false;
    return !(e.kind === "dir" && skip.has(e.name));
  });
}
function folderName(path) {
  const parts = String(path ?? "").split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "/";
}

// src/model.js
function emptyTree(root) {
  return { root, folders: {}, open: [], loading: [] };
}
function childPath(dir, name) {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}
var without = (list, item) => list.filter((x) => x !== item);
var adding = (list, item) => list.includes(item) ? list : [...list, item];
function startLoading(tree, path) {
  return { ...tree, open: adding(tree.open, path), loading: adding(tree.loading, path) };
}
function withListing(tree, path, listing) {
  const level = {
    path: listing.path ?? path,
    entries: listing.entries,
    truncated: !!listing.truncated
  };
  return {
    ...tree,
    folders: { ...tree.folders, [path]: level },
    loading: without(tree.loading, path)
  };
}
function withError(tree, path, message) {
  return {
    ...tree,
    folders: { ...tree.folders, [path]: { error: message } },
    loading: without(tree.loading, path)
  };
}
var opened = (tree, path) => ({ ...tree, open: adding(tree.open, path) });
var closed = (tree, path) => ({ ...tree, open: without(tree.open, path) });
var isLoaded = (tree, path) => path in tree.folders;
function parentKey(tree, path) {
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? "";
  for (const [key, level] of Object.entries(tree.folders)) {
    if (level.path && childPath(level.path, name) === path) return key;
  }
  return null;
}
function treeRows(tree, { strings, filters, decorate = null }) {
  const rows = [];
  const targets = /* @__PURE__ */ new Map();
  const note = (key, depth, icon, label) => rows.push({ id: `note:${key}`, label, icon, depth, muted: true });
  const walk = (path, depth) => {
    const level = tree.folders[path];
    if (!level) {
      if (tree.loading.includes(path)) note(`${path}:loading`, depth, "loading", strings.loading);
      return;
    }
    if (level.error !== void 0) return note(`${path}:error`, depth, "error", level.error);
    const entries = visibleEntries(level.entries, filters);
    if (entries.length === 0) note(`${path}:empty`, depth, "info", strings.empty);
    for (const entry of entries) {
      const child = childPath(level.path, entry.name);
      const isOpen = tree.open.includes(child);
      const folderLike = entry.kind === "dir" || entry.kind === "link" && isLoaded(tree, child);
      const row = {
        id: child,
        label: entry.name,
        icon: entry.kind === "dir" ? "folder" : entry.kind === "link" ? "link" : "file",
        depth,
        expandable: folderLike,
        expanded: folderLike && isOpen,
        hint: child
      };
      const kind = folderLike ? "dir" : entry.kind;
      rows.push(decorate ? { ...row, ...decorate(row, { kind, path: child, open: isOpen }) } : row);
      targets.set(child, { kind, path: child });
      if (folderLike && isOpen) walk(child, depth + 1);
    }
    if (level.truncated) note(`${path}:truncated`, depth, "info", strings.truncated);
    return void 0;
  };
  if (tree.root) walk(tree.root, 0);
  else note("no-folder", 0, "info", strings.noFolder);
  return { rows, targets };
}

// src/edits.js
var EDIT_ERROR_KEYS = {
  AlreadyExistsError: "error-exists",
  InvalidNameError: "error-bad-name",
  ProtectedPathError: "error-protected",
  PermissionDeniedError: "error-no-write",
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  RateLimitError: "error-busy"
};
async function renameRow(tf, { id, target, inPanel, rename, openWindow }) {
  if (inPanel && target && target.path === id && typeof tf.panel.edit === "function") {
    const name = id.split(/[\\/]/).filter(Boolean).pop() ?? "";
    const dot = target.kind === "dir" ? -1 : name.lastIndexOf(".");
    let typed;
    try {
      typed = await tf.panel.edit(id, { value: name, selectTo: dot > 0 ? dot : name.length });
    } catch {
      typed = void 0;
    }
    if (typed === null) return void 0;
    if (typeof typed === "string") return rename(id, typed.trim());
  }
  await openWindow();
  return tf.page.post({ type: "rename", id });
}
var MAX_TRIES = 200;
function freeName(taken, name) {
  const lower = new Set([...taken].map((n) => n.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let i = 2; i < MAX_TRIES; i++) {
    const next = `${stem} ${i}${ext}`;
    if (!lower.has(next.toLowerCase())) return next;
  }
  return null;
}
var canEdit = (tf) => typeof tf.fs?.create === "function";
function createEdits(tf, host) {
  const folderOf = (id) => {
    const tree = host.tree();
    const target = id ? host.target(id) : null;
    if (target?.kind === "dir") return target.path;
    if (target) return parentKey(tree, target.path) ?? tree.root;
    return tree.root;
  };
  const fail = (err) => {
    const key = EDIT_ERROR_KEYS[err?.name];
    return tf.toast(key ? tf.t(key) : host.explain(err));
  };
  const guarded = async (change) => {
    if (!canEdit(tf)) return tf.toast(tf.t("needs-tilefold-edit"));
    try {
      return await change();
    } catch (err) {
      return fail(err);
    }
  };
  const create = (id, kind) => guarded(async () => {
    const key = folderOf(id);
    if (!key) return tf.toast(tf.t("error-no-folder"));
    const dir = host.tree().folders[key]?.path ?? key;
    const listing = await tf.fs.list(dir);
    const name = freeName(
      listing.entries.map((e) => e.name),
      tf.t(kind === "dir" ? "new-folder-name" : "new-file-name")
    );
    if (!name) return tf.toast(tf.t("error-exists"));
    const path = kind === "dir" ? await tf.fs.mkdir(dir, name) : await tf.fs.create(dir, name);
    await host.relist(key);
    await tf.audit(kind === "dir" ? "folder-created" : "file-created", {});
    if (kind !== "dir") await tf.viewer.open(path, { edit: true });
    return path;
  });
  return {
    /** A new file in the folder for row `id`, opened ready to edit. */
    newFile: (id) => create(id, "file"),
    /** A new folder in the folder for row `id`. */
    newFolder: (id) => create(id, "dir"),
    /** Renames row `id` to `name` (in the same folder). */
    rename: (id, name) => guarded(async () => {
      const target = host.target(id);
      if (!target || typeof name !== "string" || !name.trim()) return void 0;
      if (name === basename(target.path)) return target.path;
      const path = await tf.fs.rename(target.path, name);
      await host.relist(parentKey(host.tree(), target.path) ?? host.tree().root);
      await tf.audit("renamed", {});
      return path;
    }),
    /** Moves row `id` into the folder row `to` (or the tree's own folder). */
    move: (id, to) => guarded(async () => {
      const target = host.target(id);
      const into = folderOf(to);
      if (!target || !into) return void 0;
      const from = parentKey(host.tree(), target.path);
      if (from === into || into === target.path) return void 0;
      const dir = host.tree().folders[into]?.path ?? into;
      const path = await tf.fs.move(target.path, dir);
      if (from) await host.relist(from);
      await host.relist(into);
      await tf.audit("moved", {});
      return path;
    }),
    /** Moves row `id` to the Trash, once the user agrees (Tilefold asks). */
    trash: (id) => guarded(async () => {
      const target = host.target(id);
      if (!target) return void 0;
      const from = parentKey(host.tree(), target.path);
      const gone = await tf.fs.trash(target.path);
      if (!gone) return false;
      if (from) await host.relist(from);
      await tf.audit("trashed", { kind: target.kind === "dir" ? "dir" : "file" });
      return true;
    }),
    /** Opens file row `id` in the viewer ready to edit. */
    edit: (id) => guarded(async () => {
      const target = host.target(id);
      if (!target || target.kind === "dir") return void 0;
      await tf.viewer.open(target.path, { edit: true });
      await tf.audit("file-opened", { from: "edit" });
      return target.path;
    })
  };
}

// src/options.js
var UI_KEY = "ui";
function loadUi(tf, ui) {
  return tf.store.get(UI_KEY).then((saved) => {
    if (saved && typeof saved === "object") {
      ui.recentOpen = saved.recentOpen !== false;
      ui.recentAll = saved.recentAll === true;
      ui.foldersOpen = saved.foldersOpen !== false;
    }
  });
}
var saveUi = (tf, ui) => tf.store.set(UI_KEY, { ...ui });
var MAX_ARG = 4096;
var arg = (value) => typeof value === "string" && value.length > 0 && value.length <= MAX_ARG ? value : null;
var ERROR_KEYS = {
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  UnreadableError: "error-unreadable",
  RateLimitError: "error-busy"
};
function explainError(tf, err) {
  const key = ERROR_KEYS[err?.name];
  if (!key) void tf.log.warn(`Folder Tree: ${err?.name ?? "Error"}: ${err?.message ?? err}`);
  return tf.t(key ?? "error-other");
}
function readOptions(tf, ui) {
  return {
    activeMs: Math.max(5, Number(tf.settings.get("activeSeconds")) || 20) * 1e3,
    recentMs: Math.max(1, Number(tf.settings.get("recentMinutes")) || 30) * 6e4,
    showActivity: tf.settings.get("showActivity") !== false,
    filters: {
      showHidden: tf.settings.get("showHidden") === true,
      skip: parseSkip(tf.settings.get("skipFolders"))
    },
    canEdit: canEdit(tf),
    ...ui
  };
}

// src/view.js
var VIEW_KEY = "view";
var MAX_PATH = 4096;
var followView = () => ({ mode: "follow", folder: null });
function pinView(folder) {
  return usable(folder) ? { mode: "pinned", folder: normalize(folder) } : followView();
}
function usable(folder) {
  return typeof folder === "string" && folder.startsWith("/") && folder.length <= MAX_PATH && // No control characters (and no bidirectional overrides) in a path to show.
  !/[\u0000-\u001f\u007f‪-‮⁦-⁩]/.test(folder);
}
function restoreView(saved) {
  if (!saved || typeof saved !== "object" || saved.mode !== "pinned") return followView();
  return pinView(saved.folder);
}
var isPinned = (view) => view.mode === "pinned" && typeof view.folder === "string";
var rootFor = (view, paneFolder) => isPinned(view) ? view.folder : paneFolder;
function reachable(folder, places) {
  const known = places.filter(Boolean);
  if (!folder || !known.length) return null;
  return known.some((p) => isInside(folder, p));
}
function upFrom(folder, places) {
  if (!folder || folder === "/") return null;
  const up = parent(folder);
  return reachable(up, places) ? up : null;
}
function splitByRoot(events, root) {
  if (!root) return { here: events, elsewhere: [] };
  const here = [];
  const elsewhere = [];
  for (const e of events) (isInside(e.abs, root) ? here : elsewhere).push(e);
  return { here, elsewhere };
}

// src/pins.js
var PINS_KEY = "pins";
var MAX_PINS = 12;
function restorePins(saved, legacyView = null) {
  if (!Array.isArray(saved)) {
    const folder = legacyView?.mode === "pinned" ? legacyView.folder : null;
    return usable(folder) ? [normalize(folder)] : [];
  }
  const pins = [];
  for (const folder of saved) {
    if (pins.length >= MAX_PINS) break;
    if (!usable(folder)) continue;
    const path = normalize(folder);
    if (!pins.includes(path)) pins.push(path);
  }
  return pins;
}
function addPin(pins, folder) {
  if (!usable(folder)) return { error: "unusable" };
  const path = normalize(folder);
  if (pins.includes(path)) return { error: "already" };
  if (pins.length >= MAX_PINS) return { error: "full" };
  return { pins: [...pins, path] };
}
var removePin = (pins, folder) => pins.filter((p) => p !== folder);
function movePin(pins, folder, delta) {
  const from = pins.indexOf(folder);
  if (from < 0) return pins;
  const to = Math.max(0, Math.min(pins.length - 1, from + delta));
  if (to === from) return pins;
  const next = pins.slice();
  next.splice(from, 1);
  next.splice(to, 0, folder);
  return next;
}
function pinLabels(pins) {
  const count = /* @__PURE__ */ new Map();
  for (const p of pins) count.set(basename(p), (count.get(basename(p)) ?? 0) + 1);
  return new Map(
    pins.map((p) => [
      p,
      count.get(basename(p)) > 1 ? `${basename(p)} \xB7 ${basename(parent(p))}` : basename(p)
    ])
  );
}

// src/page-view.js
var PAGE_RECENT = 100;
var PAGE_NOW = 8;
function pageEvent(e, root, prefix) {
  const path = e.shown ?? shownPath(e.abs, root);
  const dir = path.includes("/") ? `${parent(path)}/` : "";
  return {
    id: `${prefix}${e.abs}`,
    file: basename(e.abs),
    dir: dir === "./" ? "" : dir,
    pane: e.pane,
    action: e.action,
    ts: e.ts
  };
}
function pageView({ tree, events, now, t, opts, selected = null, view = null }) {
  const root = tree.root;
  const activity = opts.showActivity ? events : [];
  const active = activeFiles(activity, now, opts.activeMs).filter((e) => e.action !== "d");
  const latest = /* @__PURE__ */ new Map();
  for (const e of activity) if (!latest.has(e.abs)) latest.set(e.abs, e);
  const hot = hotFolders(active, root);
  const built = treeRows(tree, {
    strings: {
      loading: t("row-loading"),
      empty: t("row-empty"),
      truncated: t("row-truncated"),
      noFolder: t("row-no-folder")
    },
    filters: opts.filters
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
      ...r.expandable ? { expandable: true, expanded: !!r.expanded } : {},
      ...r.muted ? { muted: true } : {},
      ...mark ? { mark: { action: mark.action, pane: mark.pane, ts: mark.ts } } : {},
      ...target?.kind === "dir" && !r.expanded && hot.has(r.id) ? { hot: hot.get(r.id) } : {}
    };
  });
  const nowList = active.slice(0, PAGE_NOW).map((e) => pageEvent(e, root, "now:"));
  const split = splitByRoot(recentFiles(activity, PAGE_RECENT), root);
  const recent = [...split.here, ...split.elsewhere];
  const away = new Set(split.elsewhere);
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
      recent: recent.map((e) => ({
        ...pageEvent(e, root, "recent:"),
        ...away.has(e) ? { elsewhere: true } : {}
      })),
      panes: paneCount(recent),
      activity: opts.showActivity,
      selected: selected && targets.has(selected) ? selected : null,
      selectedDir: Boolean(selected && targets.get(selected)?.kind === "dir"),
      view: pageViewState(view),
      canEdit: opts.canEdit === true
    },
    targets
  };
}
function pageViewState(view) {
  const pins = view?.pins ?? [];
  const labels = pinLabels(pins.map((p) => p.path));
  const list = pins.map((p) => ({
    id: p.path,
    label: labels.get(p.path),
    ...p.shown ? { shown: true } : {},
    ...p.gone ? { gone: true } : {}
  }));
  if (!view?.pinned) return { pinned: false, pins: list };
  return {
    pinned: true,
    listed: view.listed === true,
    gone: view.gone === true,
    up: view.up ? folderName(view.up) : null,
    pins: list
  };
}
function pageStrings(t, hookCommand) {
  const n = "\xA7";
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
      d: t("page-doing-d")
    },
    ago: { s: t("ago-s", { n }), m: t("ago-m", { n }), h: t("ago-h", { n }), d: t("ago-d", { n }) },
    edit: {
      newFile: t("page-new-file"),
      newFolder: t("page-new-folder"),
      rename: t("page-rename"),
      edit: t("page-edit"),
      trash: t("page-trash"),
      nameLabel: t("page-name-label"),
      tools: t("page-tools")
    },
    view: {
      label: t("page-view-label"),
      following: t("page-view-following"),
      pinned: t("page-view-pinned"),
      gone: t("view-gone"),
      up: t("view-up", { folder: n }),
      follow: t("view-follow"),
      pin: t("menu-pin"),
      showOnly: t("menu-show-only"),
      elsewhere: t("section-elsewhere"),
      pins: t("page-pins-label"),
      showing: t("view-showing", { folder: n }),
      unpin: t("menu-unpin")
    },
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
      command: hookCommand
    }
  };
}

// src/row-marks.js
function clamp(text, max) {
  const chars = [...String(text)];
  return chars.length <= max ? String(text) : `${chars.slice(0, max - 1).join("")}\u2026`;
}
var AGO_KEYS = { s: "ago-s", m: "ago-m", h: "ago-h", d: "ago-d" };
var HINT_KEYS = { r: "hint-r", e: "hint-e", a: "hint-a", d: "hint-d" };
var NOW_KEYS = { r: "now-r", e: "now-e", a: "now-a", d: "now-d" };
var agoText = (t, ms) => {
  const { unit, n } = age(ms);
  return t(AGO_KEYS[unit], { n });
};
var activityHint = (t, e, now, path) => clamp(
  `${t(HINT_KEYS[e.action] ?? HINT_KEYS.e, { pane: e.pane, ago: agoText(t, now - e.ts) })}
${path}`,
  512
);
var marked = (t, e, now, { pulse, path }) => ({
  tone: TONES[e.action] ?? "warning",
  ...pulse ? { pulse: true, badge: e.pane } : {},
  trail: agoText(t, now - e.ts),
  hint: activityHint(t, e, now, path)
});

// src/now-view.js
var NOW_MAX = 5;
var NOW_MIN = 3;
var LATELY_MS = 60 * 60 * 1e3;
var LAST_KEYS = { r: "now-last-r", e: "now-last-e", a: "now-last-a", d: "now-last-d" };
function tally(events) {
  const seen = /* @__PURE__ */ new Set();
  const out = { r: 0, e: 0, a: 0, d: 0 };
  for (const e of events) {
    const key = `${e.action}|${e.abs}`;
    if (seen.has(key) || !(e.action in out)) continue;
    seen.add(key);
    out[e.action] += 1;
  }
  return out;
}
var panesOf = (events) => [...new Set(events.map((e) => e.pane).filter(Boolean))];
function nowRows(t, { active, events, now, root }) {
  const rows = [];
  const targets = /* @__PURE__ */ new Map();
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
      ...marked(t, e, now, { pulse: true, path })
    });
    targets.set(id, { kind: "file", path: e.abs });
  }
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
function padTo(rows, n) {
  for (let i = n; i < NOW_MIN; i++) {
    rows.push({ id: `now-pad-${i}`, label: " ", icon: "none", muted: true });
  }
}
function lastRow(t, e, now, root, targets) {
  const path = e.shown ?? shownPath(e.abs, root);
  const id = `now-last:${e.abs}`;
  targets.set(id, { kind: "file", path: e.abs });
  return {
    id,
    label: clamp(t(LAST_KEYS[e.action] ?? LAST_KEYS.e, { pane: e.pane, path }), 256),
    icon: "file",
    ...marked(t, e, now, { pulse: false, path })
  };
}
function agentsRow(t, lately, newest, now) {
  const panes = panesOf(lately);
  if (!panes.length) {
    return {
      id: "now-agents",
      label: t("now-quiet", { ago: agoText(t, now - newest.ts) }),
      icon: "none",
      muted: true
    };
  }
  return {
    id: "now-agents",
    label: clamp(t("now-agents", { names: panes.join(", ") }), 256),
    icon: "info",
    tone: "accent",
    badge: String(panes.length),
    hint: clamp(panes.join("\n"), 512)
  };
}
function tallyRow(t, events, lately) {
  const n = tally(events);
  return {
    id: "now-tally",
    label: clamp(t(lately ? "now-tally-hour" : "now-tally-all", n), 256),
    icon: "none",
    tone: "info"
  };
}

// src/panel-actions.js
var ROW_MENU = { dir: "dir", file: "file", link: "file" };
function panelMenus(t, canEdit2, pinned = false) {
  if (!canEdit2) return null;
  const item = (id, key, extra = {}) => ({ id, label: t(key), ...extra });
  const trash = item("trash", "page-trash", { tone: "error" });
  return {
    dir: [
      item("show-only", "menu-show-only"),
      item("pin", "menu-pin"),
      { separator: true },
      item("new-file", "page-new-file"),
      item("new-folder", "page-new-folder"),
      { separator: true },
      item("rename", "menu-rename"),
      trash
    ],
    file: [
      item("open", "menu-open"),
      item("edit", "page-edit"),
      { separator: true },
      item("rename", "menu-rename"),
      trash
    ],
    space: [
      item("new-file", "page-new-file"),
      item("new-folder", "page-new-folder"),
      { separator: true },
      pinned ? item("follow", "view-follow") : item("pin", "menu-pin")
    ],
    pin: [
      item("pin-show", "menu-pin-show"),
      { separator: true },
      item("pin-up", "menu-move-up"),
      item("pin-down", "menu-move-down"),
      { separator: true },
      item("unpin", "menu-unpin")
    ],
    shown: [item("pin", "menu-pin"), item("follow", "view-follow")]
  };
}

// src/folder-field.js
var FIELD_ROW = "pins-add";
var GRANTED_KEY = "granted";
var MAX_GRANTED = 12;
function restoreGranted(saved) {
  if (!Array.isArray(saved)) return [];
  const out = [];
  for (const p of saved) if (usable(p) && !out.includes(p)) out.push(p);
  return out.slice(-MAX_GRANTED);
}
function fieldRow(t) {
  return {
    id: FIELD_ROW,
    label: t("pins-add-label"),
    depth: 1,
    input: { kind: "folder", placeholder: t("pins-add-placeholder"), browse: true }
  };
}

// src/folders-view.js
var TRAIL_MAX = 32;
var trailOf = (text) => text.length > TRAIL_MAX ? `\u2026${text.slice(-(TRAIL_MAX - 1))}` : text;
function foldersRows(t, { root, view, active, open, menus }) {
  const rows = [];
  const targets = /* @__PURE__ */ new Map();
  const pins = view?.pins ?? [];
  rows.push({
    id: "folders",
    label: t("section-folders"),
    section: true,
    expandable: true,
    expanded: open,
    ...pins.length ? { badge: String(pins.length) } : {}
  });
  targets.set("folders", { kind: "folders" });
  if (!open) return { rows, targets };
  if (view?.ask) rows.push(fieldRow(t));
  const following = !view?.pinned;
  rows.push({
    id: "view-follow",
    label: t("view-follow"),
    icon: "link",
    depth: 1,
    ...following ? { tone: "accent", trail: t("pin-shown") } : {}
  });
  targets.set("view-follow", { kind: "view-follow" });
  const labels = pinLabels(pins.map((p) => p.path));
  for (const pin of pins) {
    const id = `pin:${pin.path}`;
    const busy = pin.gone ? 0 : active.filter((e) => isInside(e.abs, pin.path)).length;
    const hint = pin.gone ? `${pin.path}
${t("view-gone")}` : busy ? `${pin.path}
${t("hint-busy", { count: busy })}` : pin.path;
    let tone = null;
    if (pin.gone) tone = "warning";
    else if (pin.shown) tone = "accent";
    else if (busy) tone = "info";
    rows.push({
      id,
      label: clamp(labels.get(pin.path), 256),
      icon: pin.gone ? "error" : "folder",
      depth: 1,
      hint: clamp(hint, 512),
      trail: pin.shown ? t("pin-shown") : trailOf(parent(pin.path)),
      ...tone ? { tone } : {},
      ...pin.gone ? { muted: true } : {},
      ...busy ? { pulse: true, badge: String(busy) } : {},
      ...menus ? { menu: "pin" } : {}
    });
    targets.set(id, { kind: "pin", path: pin.path });
  }
  if (view?.pinned && !view.listed) {
    rows.push({
      id: "view-pinned",
      label: clamp(t("view-showing", { folder: root ? folderName(root) : "" }), 256),
      icon: "folder",
      tone: "accent",
      depth: 1,
      ...root ? { hint: clamp(root, 512) } : {},
      ...menus ? { menu: "shown" } : {}
    });
    targets.set("view-pinned", { kind: "view-shown", path: root });
    if (view.gone) {
      rows.push({
        id: "view-gone",
        label: t("view-gone"),
        icon: "error",
        tone: "warning",
        depth: 1
      });
    }
  }
  if (view?.pinned && view.up) {
    rows.push({
      id: "view-up",
      label: clamp(t("view-up", { folder: folderName(view.up) }), 256),
      icon: "folder",
      depth: 1
    });
    targets.set("view-up", { kind: "view-up" });
  }
  if (!pins.length) {
    rows.push({ id: "pins-empty", label: t("pins-empty"), icon: "none", depth: 1, muted: true });
  }
  return { rows, targets };
}

// src/panel-view.js
var PANEL_RECENT = 5;
var RECENT_LIMIT = 100;
function headline(t, active, root) {
  if (!active.length) return root ? clamp(root, 512) : void 0;
  const top = active[0];
  const line = t(NOW_KEYS[top.action] ?? NOW_KEYS.e, {
    pane: top.pane,
    path: top.shown ?? shownPath(top.abs, root)
  });
  const text = active.length > 1 ? t("now-more", { line, count: active.length - 1 }) : line;
  return clamp(text, 512);
}
function recentFooter(t, events, root, now, { open, all }) {
  const rows = [];
  const targets = /* @__PURE__ */ new Map();
  const recent = recentFiles(events, RECENT_LIMIT);
  rows.push({
    id: "recent",
    label: t("section-recent"),
    section: true,
    expandable: true,
    expanded: open,
    ...recent.length ? { badge: String(recent.length) } : {}
  });
  targets.set("recent", { kind: "recent" });
  if (!open) return { rows, targets };
  if (!recent.length) {
    rows.push({
      id: "recent-none",
      label: t("page-empty-recent"),
      icon: "none",
      depth: 1,
      muted: true
    });
    return { rows, targets };
  }
  const { here, elsewhere } = splitByRoot(recent, root);
  const listed = all ? [...here, ...elsewhere] : [...here, ...elsewhere].slice(0, PANEL_RECENT);
  for (const e of listed) {
    if (e === elsewhere[0]) {
      rows.push({
        id: "recent-elsewhere",
        label: t("section-elsewhere"),
        icon: "none",
        depth: 1,
        muted: true
      });
    }
    const id = `recent:${e.abs}`;
    rows.push({
      id,
      label: basename(e.abs),
      icon: "file",
      depth: 1,
      ...marked(t, e, now, { pulse: false, path: e.shown ?? shownPath(e.abs, root) }),
      badge: e.pane
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
function panelView({ tree, events, now, t, opts, selected = null, view = null }) {
  const root = tree.root;
  const activity = opts.showActivity ? events : [];
  const active = activeFiles(activity, now, opts.activeMs).filter((e) => e.action !== "d");
  const latest = /* @__PURE__ */ new Map();
  for (const e of activity) if (!latest.has(e.abs)) latest.set(e.abs, e);
  const hot = hotFolders(active, root);
  const menus = panelMenus(t, opts.canEdit === true, view?.pinned === true);
  const decorate = (row, where) => {
    const marks = activityMarks(row, where);
    const menu = menus && ROW_MENU[where.kind] ? { menu: ROW_MENU[where.kind] } : {};
    return where.path === selected && !marks.tone ? { ...marks, ...menu, tone: "accent" } : { ...marks, ...menu };
  };
  const activityMarks = (row, { kind, path, open }) => {
    if (kind === "dir") {
      const count = hot.get(path);
      if (!count || open) return {};
      return {
        tone: "accent",
        pulse: true,
        badge: String(count),
        hint: clamp(`${t("hint-busy", { count })}
${path}`, 512)
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
      noFolder: t("row-no-folder")
    },
    filters: opts.filters,
    decorate
  });
  const folders = foldersRows(t, {
    root,
    view,
    active,
    open: opts.foldersOpen !== false,
    menus: Boolean(menus)
  });
  const rows = [...folders.rows];
  const targets = new Map([...built.targets, ...folders.targets]);
  if (opts.showActivity) {
    const section = nowRows(t, { active, events: activity, now, root });
    rows.push(...section.rows);
    for (const [id, target] of section.targets) targets.set(id, target);
    rows.push({ id: "files", label: t("section-files"), section: true });
  }
  rows.push(...built.rows);
  const footer = opts.showActivity ? recentFooter(t, activity, root, now, { open: opts.recentOpen, all: opts.recentAll }) : { rows: [], targets: /* @__PURE__ */ new Map() };
  for (const [id, target] of footer.targets) targets.set(id, target);
  const subtitle = headline(t, active, root);
  return {
    content: {
      title: root ? folderName(root) : t("title-no-folder"),
      ...subtitle ? { subtitle } : {},
      rows,
      ...footer.rows.length ? { footer: { rows: footer.rows } } : {},
      ...menus && root ? { menus, menu: "space" } : {},
      perTab: true
    },
    targets,
    live: active.length > 0
  };
}

// src/reveal.js
function foldersTo(root, file) {
  if (!root || typeof file !== "string") return null;
  const base = root.endsWith("/") ? root : `${root}/`;
  if (!file.startsWith(base)) return null;
  const parts = file.slice(base.length).split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  const out = [root];
  let at = root;
  for (const name of parts.slice(0, -1)) {
    at = `${at.endsWith("/") ? at : `${at}/`}${name}`;
    out.push(at);
  }
  return out;
}
async function revealFile(ctx, file) {
  if (!ctx.showing()) return false;
  const folders = foldersTo(ctx.tree().root, file);
  if (!folders) return false;
  for (const folder of folders) {
    if (isLoaded(ctx.tree(), folder)) ctx.setTree(opened(ctx.tree(), folder));
    else await ctx.load(folder);
  }
  ctx.select(file);
  await ctx.draw();
  return true;
}

// src/marker.js
var MARKER_DIR = ".foldertree";
var ACTIONS = Object.freeze({ r: "read", e: "edit", a: "add", d: "delete" });
var MAX_CHUNKS = 23;
var PANE_CHARS = 32;
var DEFAULT_PANE = "agent";
var MAX_FUTURE_MS = 6e4;
var MARKER_RE = /^ft1\.([0-9a-z]{9})\.([0-9a-z]{4})\.([a-z])\.([A-Za-z0-9_-]{1,88})\.(~\d{2}|[A-Za-z0-9_-]+)$/;
var CHUNK_RE = /^(\d{2})\.([A-Za-z0-9_-]{1,240})$/;
function fromB64url(code) {
  if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) throw new Error("not base64url");
  const padded = code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function cleanPane(name) {
  const flat = String(name ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  return [...flat].slice(0, PANE_CHARS).join("").trim() || DEFAULT_PANE;
}
function cleanRelPath(path) {
  const text = String(path ?? "").replace(/\\/g, "/");
  if (!text || text.includes("\0") || text.startsWith("/") || /^[A-Za-z]:\//.test(text)) {
    return null;
  }
  const parts = [];
  for (const part of text.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}
var SESSION_PART = /^(.*) ~([A-Za-z0-9_-]{4,40})$/;
function splitPane(text) {
  const m = SESSION_PART.exec(String(text ?? ""));
  return m ? { pane: cleanPane(m[1]), session: m[2] } : { pane: cleanPane(text), session: null };
}
function decodeMarker(name, now = Date.now()) {
  const m = MARKER_RE.exec(String(name ?? ""));
  if (!m) return null;
  const [, tsCode, nonce, letter, paneCode, target] = m;
  const ts = parseInt(tsCode, 36);
  if (!Number.isFinite(ts) || ts > now + MAX_FUTURE_MS) return null;
  const action = letter in ACTIONS ? letter : "e";
  let pane;
  let session;
  try {
    ({ pane, session } = splitPane(fromB64url(paneCode)));
  } catch {
    return null;
  }
  if (target.startsWith("~")) {
    const chunks = Number(target.slice(1));
    if (chunks < 1 || chunks > MAX_CHUNKS) return null;
    return { ts, nonce, action, pane, session, path: null, chunks };
  }
  let path;
  try {
    path = cleanRelPath(fromB64url(target));
  } catch {
    return null;
  }
  return path === null ? null : { ts, nonce, action, pane, session, path, chunks: 0 };
}
function joinChunks(names, expected) {
  const parts = [];
  for (const name of names) {
    const m = CHUNK_RE.exec(name);
    if (m) parts[Number(m[1])] = m[2];
  }
  if (parts.length !== expected) return null;
  for (let i = 0; i < expected; i++) if (parts[i] === void 0) return null;
  try {
    return cleanRelPath(fromB64url(parts.join("")));
  } catch {
    return null;
  }
}

// src/scan.js
var SEARCH_UP = 6;
var SCAN_BUDGET = 5;
var WINDOW_BUDGET = 25;
var WINDOW_MS = 1e4;
var BACKOFF_MS = 5e3;
var READ_MAX = 4;
var DISCOVER_MIN = 1;
var PROBE_MAX = 12;
var PROBE_MS = 3e4;
var MISSING_MS = 3e4;
var NOT_PROJECTS = /* @__PURE__ */ new Set(["node_modules", "target", "dist", "build", "vendor", "Pods"]);
var CHUNK_CACHE = 1e3;
var QUIET = /* @__PURE__ */ new Set(["NotFoundError", "PathNotAllowedError", "NotADirectoryError"]);
var subfoldersOf = (dir, entries) => entries.filter((e) => e.kind === "dir" && !e.name.startsWith(".") && !NOT_PROJECTS.has(e.name)).slice(0, PROBE_MAX).map((e) => join(dir, e.name));
function createScanner(tf) {
  const chunks = /* @__PURE__ */ new Map();
  const marked2 = /* @__PURE__ */ new Set();
  const missing = /* @__PURE__ */ new Map();
  const lastAsked = /* @__PURE__ */ new Map();
  const probes = /* @__PURE__ */ new Map();
  const listedAt = [];
  let pausedUntil = -Infinity;
  const take = (now) => {
    while (listedAt.length && now - listedAt[0] >= WINDOW_MS) listedAt.shift();
    if (now < pausedUntil || listedAt.length >= WINDOW_BUDGET) return false;
    listedAt.push(now);
    return true;
  };
  const list = async (path, now) => {
    try {
      return await tf.fs.list(path);
    } catch (err) {
      if (err?.name === "RateLimitError") pausedUntil = now + BACKOFF_MS;
      throw err;
    }
  };
  const markersIn = async (projectRoot, now) => {
    const dir = join(projectRoot, MARKER_DIR);
    lastAsked.set(projectRoot, now);
    let listing;
    try {
      listing = await list(dir, now);
    } catch (err) {
      if (err?.name === "RateLimitError") return [];
      if (QUIET.has(err?.name)) missing.set(projectRoot, now + MISSING_MS);
      else void tf.log.warn(`Folder Tree: ${err?.name}: ${err?.message}`);
      marked2.delete(projectRoot);
      return [];
    }
    missing.delete(projectRoot);
    marked2.add(projectRoot);
    const out = [];
    for (const entry of listing.entries) {
      const marker = decodeMarker(entry.name, now);
      if (!marker) continue;
      if (marker.chunks && entry.kind === "dir") {
        marker.path = await longPath(dir, entry.name, marker.chunks, now);
      }
      if (marker.path) out.push({ root: projectRoot, marker });
    }
    return out;
  };
  const longPath = async (dir, name, expected, now) => {
    const key = `${dir}/${name}`;
    if (chunks.has(key)) return chunks.get(key);
    if (!take(now)) return null;
    let path = null;
    try {
      const parts = await list(join(dir, name), now);
      path = joinChunks(
        parts.entries.map((e) => e.name),
        expected
      );
    } catch {
      return null;
    }
    if (path === null) return null;
    if (chunks.size >= CHUNK_CACHE) chunks.delete(chunks.keys().next().value);
    chunks.set(key, path);
    return path;
  };
  const askable = (dir, now) => !(missing.get(dir) > now);
  const byTurn = (a, b) => (lastAsked.get(a) ?? -Infinity) - (lastAsked.get(b) ?? -Infinity);
  const dueSubfolders = async (dir, now, folders, spent, budget) => {
    const last = probes.get(dir);
    if (last && now - last.at < PROBE_MS) return null;
    let entries = folders[dir]?.entries;
    if (!Array.isArray(entries)) {
      if (spent.n >= budget || !take(now)) return null;
      spent.n += 1;
      try {
        entries = (await list(dir, now)).entries;
      } catch {
        probes.set(dir, { at: now, subfolders: [] });
        return null;
      }
    }
    const subfolders = subfoldersOf(dir, entries);
    probes.set(dir, { at: now, subfolders });
    return subfolders;
  };
  return {
    /**
     * Every marker found now around `root` (the tree's folder) and
     * `others` (the other panes' folders). `folders` is the tree's
     * listings (path → { entries }).
     */
    async scan(root, now = Date.now(), folders = {}, others = []) {
      const places = [...new Set([root, ...others].filter(Boolean))];
      if (!places.length) return [];
      const found = [];
      for (const [path, level] of Object.entries(folders)) {
        if (Array.isArray(level?.entries) && level.entries.some((e) => e.name === MARKER_DIR)) {
          marked2.add(path);
        }
      }
      const near = (dir) => places.some((p) => isInside(dir, p) || isInside(p, dir));
      const reads = [...marked2].filter(near).sort(byTurn).slice(0, READ_MAX);
      for (const dir of reads) {
        if (!take(now)) return found;
        found.push(...await markersIn(dir, now));
      }
      const budget = Math.max(DISCOVER_MIN, SCAN_BUDGET - reads.length);
      const spent = { n: 0 };
      const candidates = new Set(places);
      for (const place of places) {
        const subfolders = await dueSubfolders(place, now, folders, spent, budget) ?? [];
        for (const dir of subfolders) candidates.add(dir);
        for (const dir of probes.get(place)?.subfolders ?? []) candidates.add(dir);
      }
      for (const place of places) {
        for (const dir of ancestors(place, SEARCH_UP)) candidates.add(dir);
      }
      const due = [...candidates].filter((d) => !marked2.has(d) && askable(d, now)).sort(byTurn);
      for (const dir of due) {
        if (spent.n >= budget || !take(now)) break;
        spent.n += 1;
        found.push(...await markersIn(dir, now));
      }
      return found;
    }
  };
}

// src/view-control.js
var PIN_ERRORS = { already: "pins-already", full: "pins-full", unusable: "error-choose-folder" };
function createViewControl(tf, ctx) {
  let view = followView();
  let pins = [];
  let paneFolder = null;
  let granted = [];
  const ready = Promise.all([
    tf.store.get(VIEW_KEY).catch(() => null),
    tf.store.get(PINS_KEY).catch(() => null),
    tf.store.get(GRANTED_KEY).catch(() => null)
  ]).then(([savedView, savedPins, savedGranted]) => {
    view = restoreView(savedView);
    pins = restorePins(savedPins, savedView);
    granted = restoreGranted(savedGranted);
  });
  const reach = () => [...ctx.places(), paneFolder, ...granted];
  const reshow = async () => {
    if (!ctx.showing()) return void 0;
    return ctx.restart(rootFor(view, paneFolder ?? await tf.pane.cwd()));
  };
  const change = async (next, action, details = {}) => {
    await ready;
    view = next;
    await tf.store.set(VIEW_KEY, { ...view });
    await tf.audit(action, details);
    return reshow();
  };
  const keepPins = async (next, action, show = false) => {
    pins = next;
    await tf.store.set(PINS_KEY, [...pins]);
    await tf.audit(action, { count: pins.length });
    return show ? reshow() : ctx.redraw();
  };
  const pinFolder = async (folder, from = "menu") => {
    await ready;
    if (!folder) return tf.toast(tf.t("error-no-folder"));
    const added = addPin(pins, folder);
    if (added.error === "already") return change(pinView(folder), "shown");
    if (added.error) return tf.toast(tf.t(PIN_ERRORS[added.error], { max: MAX_PINS }));
    pins = added.pins;
    await tf.store.set(PINS_KEY, [...pins]);
    return change(pinView(folder), "pinned", { count: pins.length, from });
  };
  const showPin = async (folder) => {
    if (!pins.includes(folder)) return void 0;
    if (reachable(folder, reach()) === false) return tf.toast(tf.t("view-gone"));
    return change(pinView(folder), "shown");
  };
  const unpin = async (folder) => {
    if (!pins.includes(folder)) return void 0;
    const wasShown = isPinned(view) && view.folder === folder;
    if (wasShown) {
      view = followView();
      await tf.store.set(VIEW_KEY, { ...view });
    }
    return keepPins(removePin(pins, folder), "unpinned", wasShown);
  };
  const control = {
    /** True while the tree is pinned. */
    pinned: () => isPinned(view),
    /** The folder to show now: the pinned one, or the focused pane's. */
    async root() {
      await ready;
      paneFolder = await tf.pane.cwd();
      return rootFor(view, paneFolder);
    },
    /** The focused pane moved to `path`; true when the tree should follow it. */
    paneMoved(path) {
      paneFolder = path;
      return !isPinned(view);
    },
    /**
     * The view as the panel and window draw it: pinned or not, the folder
     * above while a pane reaches it, whether no pane reaches it any more,
     * and the pinned folders (each with whether it is shown, or gone).
     */
    info() {
      const all = reach();
      const shown = isPinned(view) ? view.folder : null;
      const list = pins.map((path) => ({
        path,
        shown: path === shown,
        gone: reachable(path, all) === false
      }));
      const ask = typeof tf.fs?.chooseFolder === "function";
      if (!shown) return { pinned: false, pins: list, ask };
      return {
        ask,
        pinned: true,
        listed: pins.includes(shown),
        up: upFrom(shown, all),
        gone: reachable(shown, all) === false,
        pins: list
      };
    },
    /** Pins the tree's folder (or `folder`) and keeps showing it, whatever the panes do. */
    pin: (folder = ctx.root()) => pinFolder(folder),
    /** Follows the focused pane's folder again. */
    follow: () => change(followView(), "followed"),
    /** Shows only folder `id` (the chosen row by default), pinned. */
    showOnly(id = ctx.chosen()) {
      const target = id ? ctx.target(id) : null;
      if (target?.kind !== "dir") return tf.toast(tf.t("error-choose-folder"));
      return change(pinView(target.path), "rerooted");
    },
    /** Shows the folder above the pinned one, while a pane still reaches it. */
    up() {
      const above = control.info().up;
      return above ? change(pinView(above), "rerooted") : void 0;
    },
    /** Acts on a row about the view (`target`); null when it isn't one. */
    act(target) {
      if (target.kind === "view-follow") return control.follow();
      if (target.kind === "view-up") return control.up();
      if (target.kind === "pin") return showPin(target.path);
      return null;
    },
    /** A menu choice about the view on row `target` (null: the empty space); null when not one. */
    menu(item, target, id) {
      if (item === "show-only") return control.showOnly(id);
      if (item === "follow") return control.follow();
      if (item === "pin") return pinFolder(target?.kind === "dir" ? target.path : ctx.root());
      if (target?.kind !== "pin") return null;
      if (item === "pin-show") return showPin(target.path);
      if (item === "pin-up" || item === "pin-down") {
        const moved = movePin(pins, target.path, item === "pin-up" ? -1 : 1);
        return moved === pins ? void 0 : keepPins(moved, "moved");
      }
      if (item === "unpin") return unpin(target.path);
      return null;
    },
    /**
     * What the user submitted in the panel's folder field (`panel.input`):
     * a folder Tilefold gave the tile is kept and pinned; a refusal is only
     * recorded (Tilefold shows why under the field). Never a path in the log.
     */
    async field({ row, path, error, via } = {}) {
      if (row !== FIELD_ROW) return void 0;
      await ready;
      const from = via === "dialog" ? "dialog" : "typed";
      if (typeof path !== "string" || !path.startsWith("/")) {
        return tf.audit("pin-refused", {
          from,
          reason: typeof error === "string" ? error : "none"
        });
      }
      if (!granted.includes(path)) {
        granted = restoreGranted([...granted, path]);
        await tf.store.set(GRANTED_KEY, [...granted]);
      }
      return pinFolder(path, from);
    },
    /** A window message about the view (`id`: its checked path); null when not one. */
    message(type, id) {
      if (type === "show-only" && id) return control.showOnly(id);
      if (type === "pin") return control.pin();
      if (type === "follow") return control.follow();
      if (type === "up") return control.up();
      if (type === "show-pin" && id) return showPin(id);
      if (type === "unpin" && id) return unpin(id);
      return null;
    }
  };
  return control;
}

// src/session.js
var POLL_MS = 2e3;
var AGE_REDRAW_MS = 1e4;
var HOOK_COMMAND = "node hooks/install.mjs";
function createFolderTree(tf) {
  const scanner = createScanner(tf);
  let tree = emptyTree(null);
  let panes = [];
  let shown = false;
  let pageOpen = false;
  let targets = /* @__PURE__ */ new Map();
  let events = [];
  let seen = "";
  let lastDraw = 0;
  let timer = null;
  let selected = null;
  const ui = { recentOpen: true, recentAll: false, foldersOpen: true };
  const explain = (err) => explainError(tf, err);
  const options = () => readOptions(tf, ui);
  const draw = async () => {
    const now = Date.now();
    lastDraw = now;
    const next = /* @__PURE__ */ new Map();
    const args = { tree, events, now, t: (k, a) => tf.t(k, a), opts: options(), selected };
    args.view = views.info();
    if (shown) {
      const view = panelView(args);
      for (const [id, target] of view.targets) next.set(id, target);
      await tf.panel.show(view.content);
    }
    if (pageOpen) {
      const view = pageView(args);
      for (const [id, target] of view.targets) next.set(id, target);
      await tf.page.post(view.state).catch(() => pageOpen = false);
    }
    targets = next;
  };
  const places = () => [...new Set(panes.map((p) => p.folder).filter(Boolean))];
  let found = [];
  let reading = false;
  const asEvents = (root) => withShownPaths(namedByPane(toEvents(found), panes), root, places());
  const readActivity = async (root) => {
    if (reading) return asEvents(root);
    reading = true;
    try {
      found = await scanner.scan(root, Date.now(), tree.folders, places());
    } finally {
      reading = false;
    }
    return asEvents(root);
  };
  const loadPanes = async () => {
    if (typeof tf.pane.list !== "function") return;
    try {
      panes = await tf.pane.list() ?? [];
    } catch {
      panes = [];
    }
  };
  const poll = async () => {
    if (!shown && !pageOpen) return;
    if (!tree.root && !places().length) return;
    if (options().showActivity) {
      events = await readActivity(tree.root);
      const print = `${events.length}:${events[0]?.key ?? ""}`;
      if (print !== seen) {
        seen = print;
        return draw();
      }
    }
    if (events.length && Date.now() - lastDraw >= AGE_REDRAW_MS) return draw();
    return void 0;
  };
  const pace = () => {
    const wanted = shown || pageOpen;
    if (wanted && !timer) {
      timer = setInterval(() => void poll().catch((err) => explain(err)), POLL_MS);
    } else if (!wanted && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  const load = async (path) => {
    tree = startLoading(tree, path);
    await draw();
    try {
      tree = withListing(tree, path, await tf.fs.list(path));
    } catch (err) {
      tree = withError(tree, path, explain(err));
    }
    await draw();
  };
  const relist = async (key) => {
    if (!key || !isLoaded(tree, key)) return draw();
    try {
      tree = withListing(tree, key, await tf.fs.list(key));
    } catch (err) {
      tree = withError(tree, key, explain(err));
    }
    return draw();
  };
  const edits = createEdits(tf, {
    tree: () => tree,
    target: (id) => targets.get(id),
    relist,
    explain
  });
  const start = async (root) => {
    tree = emptyTree(root);
    found = [];
    events = [];
    seen = "0:";
    if (!root) {
      if (options().showActivity && places().length) events = await readActivity(root);
      return draw();
    }
    await load(root);
    if (options().showActivity) {
      events = await readActivity(root);
      const print = `${events.length}:${events[0]?.key ?? ""}`;
      if (print !== seen) {
        seen = print;
        await draw();
      }
    }
    return void 0;
  };
  const toggle = async (path, open) => {
    if (!open) {
      tree = closed(tree, path);
      return draw();
    }
    if (isLoaded(tree, path)) {
      tree = opened(tree, path);
      return draw();
    }
    return load(path);
  };
  const openFile = async (path, isLink, from) => {
    try {
      await tf.viewer.open(path);
      await tf.audit("file-opened", { from });
    } catch (err) {
      if (isLink && err?.name === "NotAFileError") return load(path);
      await tf.toast(explain(err));
    }
    return void 0;
  };
  const setUi = async (change) => {
    Object.assign(ui, change);
    await saveUi(tf, ui);
    return draw();
  };
  const act = async (id, action, from) => {
    const target = targets.get(id);
    if (!target) return void 0;
    if (target.kind === "dir") {
      selected = id;
      const open = action === "expand" || action === "activate" && !tree.open.includes(id);
      return toggle(target.path, open);
    }
    if (target.kind === "file" || target.kind === "link") {
      selected = targets.has(target.path) ? target.path : selected;
      await openFile(target.path, target.kind === "link", from);
      return draw();
    }
    if (target.kind === "recent")
      return setUi({
        recentOpen: action === "expand" || action === "activate" && !ui.recentOpen
      });
    if (target.kind === "recent-more") return setUi({ recentAll: !ui.recentAll });
    if (target.kind === "setup") return api.openWindow(true);
    if (target.kind === "folders")
      return setUi({
        foldersOpen: action === "expand" || action === "activate" && !ui.foldersOpen
      });
    return views.act(target) ?? void 0;
  };
  const renameChosen = () => selected ? renameRow(tf, {
    id: selected,
    target: targets.get(selected),
    inPanel: shown,
    rename: edits.rename,
    openWindow: () => api.openWindow()
  }) : tf.toast(tf.t("error-nothing-chosen"));
  const doubled = (id) => {
    const target = targets.get(id);
    const file = target && (target.kind === "file" || target.kind === "link");
    if (!file || target.path !== id) return void 0;
    selected = id;
    return renameChosen();
  };
  const fromMenu = async (id, item) => {
    const target = id ? targets.get(id) : null;
    if (id && !target) return void 0;
    if (id) selected = id;
    if (item === "new-file") return edits.newFile(id);
    if (item === "new-folder") return edits.newFolder(id);
    if (item === "open") return act(id, "activate", "menu");
    if (item === "edit") return edits.edit(id);
    if (item === "rename") return renameChosen();
    if (item === "trash") return edits.trash(id);
    return views.menu(item, target, id) ?? void 0;
  };
  const views = createViewControl(tf, {
    places,
    root: () => tree.root,
    target: (id) => targets.get(id),
    chosen: () => selected,
    showing: () => shown || pageOpen,
    restart: (root) => (selected = null, start(root)),
    redraw: () => draw()
  });
  const ensureRoot = async (root) => {
    if (root !== tree.root || !isLoaded(tree, root ?? "")) await start(root);
    else await draw();
  };
  void loadUi(tf, ui);
  const api = {
    /** Shows the panel, or hides it when it is shown. */
    async toggleShown() {
      if (shown) {
        shown = false;
        pace();
        await tf.audit("hidden", {});
        return tf.panel.hide();
      }
      shown = true;
      pace();
      await loadPanes();
      const root = await views.root();
      await tf.audit("shown", { hasFolder: root !== null, window: pageOpen });
      return ensureRoot(root);
    },
    /** Opens the window (it shows the setup help when `setup` is true). */
    async openWindow(setup = false) {
      if (!tf.page) return tf.toast(tf.t("needs-newer-tilefold"));
      await tf.page.open({ visible: true });
      pageOpen = true;
      pace();
      await tf.audit("window-opened", { setup });
      await loadPanes();
      await tf.page.post(pageStrings((k, a) => tf.t(k, a), HOOK_COMMAND));
      if (setup) await tf.page.post({ type: "setup" });
      return ensureRoot(await views.root());
    },
    /** Lists everything again from the top. */
    refresh: () => shown || pageOpen ? start(tree.root) : void 0,
    /** A click (or key) on a row of the panel. */
    clicked: ({ row, action } = {}) => act(row, action, "panel"),
    /** A double-click on a row of the panel. */
    doubled: ({ row } = {}) => typeof row === "string" ? doubled(row) : void 0,
    fieldInput: (e) => views.field(e),
    /** A choice from a panel row's right-click menu. */
    menuChosen: ({ row, item } = {}) => typeof item === "string" ? fromMenu(typeof row === "string" ? row : null, item) : void 0,
    /** A message from the window. */
    async message({ message } = {}) {
      const m = message ?? {};
      if (m.type === "ready") {
        pageOpen = true;
        pace();
        await tf.page.post(pageStrings((k, a) => tf.t(k, a), HOOK_COMMAND));
        return draw();
      }
      if (m.type === "toggle" && typeof m.id === "string") {
        return act(m.id, m.open ? "expand" : "collapse", "window");
      }
      if (m.type === "open" && typeof m.id === "string") return act(m.id, "activate", "window");
      const id = arg(m.id);
      if (m.type === "select" && id && targets.has(id)) {
        selected = id;
        return draw();
      }
      if (m.type === "new-file") return edits.newFile(id ?? selected);
      if (m.type === "new-folder") return edits.newFolder(id ?? selected);
      if (m.type === "rename" && id && arg(m.name)) return edits.rename(id, m.name);
      if (m.type === "move" && id) return edits.move(id, arg(m.to));
      if (m.type === "trash" && id) return edits.trash(id);
      if (m.type === "edit" && id) return edits.edit(id);
      return views.message(m.type, id) ?? void 0;
    },
    /** Palette commands: a new file or folder where the user last chose. */
    newFile: () => edits.newFile(selected),
    newFolder: () => edits.newFolder(selected),
    /** Palette command: the last chosen row goes to the Trash (Tilefold asks). */
    trashSelected: () => selected ? edits.trash(selected) : tf.toast(tf.t("error-nothing-chosen")),
    /** Palette command: renaming happens in the window, where there is a text field. */
    renameSelected: () => renameChosen(),
    /** The document viewer shows a file: open the folders down to it and choose it. */
    viewerOpened: (path) => revealFile(
      {
        tree: () => tree,
        setTree: (next) => tree = next,
        load,
        select: (p) => selected = p,
        draw,
        showing: () => shown || pageOpen
      },
      path
    ),
    /** Palette commands: pin, follow the pane, show only the chosen folder, up. */
    pin: () => views.pin(),
    follow: () => views.follow(),
    showOnly: () => views.showOnly(),
    up: () => views.up(),
    /** Whether this Tilefold lets the tile change files. */
    canEdit: () => canEdit(tf),
    /** The focused pane's folder changed. */
    async paneChanged(path) {
      if (!views.paneMoved(path)) return shown || pageOpen ? draw() : void 0;
      if (path === tree.root) return void 0;
      if (shown || pageOpen) return start(path);
      tree = emptyTree(path);
      return void 0;
    },
    /** The panes changed (opened, closed, renamed, moved, focused). */
    async panesChanged(list) {
      panes = Array.isArray(list) ? list : [];
      if (!shown && !pageOpen) return void 0;
      events = asEvents(tree.root);
      return draw();
    },
    /** A setting changed: draw again with it. */
    settingChanged: () => draw(),
    /** The user closed the panel, left its tab, or another tile's took its place. */
    closed() {
      shown = false;
      pace();
    },
    /** The user came back to a tab the panel is open on: show it for that tab. */
    async reopened() {
      if (shown) return void 0;
      shown = true;
      pace();
      await loadPanes();
      return ensureRoot(await views.root());
    },
    /** The window was closed. */
    pageClosed() {
      pageOpen = false;
      pace();
    },
    /** Reads the markers now (tests; the timer does it every two seconds). */
    poll
  };
  return api;
}

// src/main.js
var main_default = (tf) => {
  tf.setting("showActivity", true, tf.t("setting-show-activity"));
  tf.setting("activeSeconds", 20, tf.t("setting-active-seconds"));
  tf.setting("recentMinutes", 30, tf.t("setting-recent-minutes"));
  tf.setting("showHidden", false, tf.t("setting-show-hidden"));
  tf.setting("skipFolders", "node_modules", tf.t("setting-skip-folders"));
  const supported = Boolean(tf.panel && tf.pane && tf.fs && tf.viewer);
  const tree = supported ? createFolderTree(tf) : null;
  const unsupported = () => tf.toast(tf.t("needs-newer-tilefold"));
  tf.command(tf.t("cmd-toggle"), () => tree ? tree.toggleShown() : unsupported(), {
    id: "toggle",
    key: { mac: "Ctrl+Alt+T", other: "Ctrl+Alt+Shift+Y" }
  });
  tf.command(tf.t("cmd-window"), () => tree ? tree.openWindow() : unsupported(), {
    id: "window"
  });
  tf.command(tf.t("cmd-setup"), () => tree ? tree.openWindow(true) : unsupported(), {
    id: "setup"
  });
  tf.command(tf.t("cmd-refresh"), () => tree ? tree.refresh() : unsupported(), {
    id: "refresh"
  });
  tf.command(tf.t("cmd-new-file"), () => tree ? tree.newFile() : unsupported(), {
    id: "new-file"
  });
  tf.command(tf.t("cmd-new-folder"), () => tree ? tree.newFolder() : unsupported(), {
    id: "new-folder"
  });
  tf.command(tf.t("cmd-rename"), () => void (tree ? tree.renameSelected() : unsupported()), {
    id: "rename"
  });
  tf.command(tf.t("cmd-trash"), () => void (tree ? tree.trashSelected() : unsupported()), {
    id: "trash"
  });
  tf.command(tf.t("cmd-pin"), () => tree ? tree.pin() : unsupported(), { id: "pin" });
  tf.command(tf.t("cmd-follow"), () => tree ? tree.follow() : unsupported(), { id: "follow" });
  tf.command(tf.t("cmd-show-only"), () => tree ? tree.showOnly() : unsupported(), {
    id: "show-only"
  });
  tf.command(tf.t("cmd-up"), () => tree ? tree.up() : unsupported(), { id: "up" });
  tf.on("pane.cwd", (e) => tree?.paneChanged(e.path ?? null));
  tf.on("pane.list", (e) => tree?.panesChanged(e.panes));
  tf.on("panel.click", (e) => tree?.clicked(e));
  tf.on("panel.closed", () => tree?.closed());
  tf.on("panel.opened", () => void tree?.reopened());
  tf.on("panel.menu", (e) => void tree?.menuChosen(e));
  tf.on("panel.dblclick", (e) => void tree?.doubled(e));
  tf.on("panel.input", (e) => void tree?.fieldInput(e));
  tf.on("page.message", (e) => void tree?.message(e));
  tf.on("page.closed", () => tree?.pageClosed());
  tf.on("setting.changed", () => tree?.settingChanged());
  tf.on("viewer.opened", (e) => void tree?.viewerOpened(e?.path));
};
export default main_default;
