/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the tile
 *
 * Shows the folder the focused pane is in as a tree, in a panel Tilefold
 * docks beside the panes (`tf.panel`) and in a window of its own (the
 * tile's page), and keeps both current: it follows the pane (`pane.cwd`),
 * lists a folder the first time it is opened (`tf.fs.list`), opens a
 * clicked file in the document viewer (`tf.viewer.open`), and every two
 * seconds, while either is showing, reads the names of the markers the
 * agent hooks leave (scan.js) to show what agents are doing. Tilefold
 * lets it reach only folders the user's panes are in.
 *
 * Clicks arrive from the panel as `panel.click` ({ row, action }) and from
 * the window as `page.message` ({ type: "toggle" | "open", id }); both use
 * the same row ids. Errors listing a folder show inside the tree; errors
 * opening a file are a notice, in the user's language; anything
 * unexpected also goes to the tile's log. Showing, hiding, the window and
 * opened files are recorded in the activity log (never a path).
 */
import { toEvents } from "./activity.js";
import {
  closed,
  emptyTree,
  isLoaded,
  opened,
  startLoading,
  withError,
  withListing,
} from "./model.js";
import { pageStrings, pageView } from "./page-view.js";
import { panelView } from "./panel-view.js";
import { createScanner } from "./scan.js";
import { parseSkip } from "./tree.js";

/** How often markers are read while the tree is showing. */
export const POLL_MS = 2000;
/** Ages in the panel are redrawn at least this often while anything is recent. */
export const AGE_REDRAW_MS = 10_000;
/** The command that sets up the agent hooks, run in the tile's folder. */
export const HOOK_COMMAND = "node hooks/install.mjs";
/** Where the Recent section's open/all choice is kept. */
const UI_KEY = "ui";

/** The message for an error from Tilefold, by its name. */
const ERROR_KEYS = {
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  UnreadableError: "error-unreadable",
  RateLimitError: "error-busy",
};

/** Starts the Folder Tree for `tf`; returns its handlers (for main.js and tests). */
export function createFolderTree(tf) {
  const scanner = createScanner(tf);
  let tree = emptyTree(null);
  /** Whether the panel is shown (the user may close it any time). */
  let shown = false;
  /** Whether the window is open. */
  let pageOpen = false;
  /** Row id → what it stands for, from the last drawing of either view. */
  let targets = new Map();
  /** Agent activity, newest first, and a fingerprint to see it change. */
  let events = [];
  let seen = "";
  let lastDraw = 0;
  let timer = null;
  const ui = { recentOpen: true, recentAll: false };

  /** A short message for an error, in the user's language. */
  const explain = (err) => {
    const key = ERROR_KEYS[err?.name];
    if (!key) void tf.log.warn(`Folder Tree: ${err?.name ?? "Error"}: ${err?.message ?? err}`);
    return tf.t(key ?? "error-other");
  };

  /** The settings, as the views take them. */
  const options = () => ({
    activeMs: Math.max(5, Number(tf.settings.get("activeSeconds")) || 20) * 1000,
    recentMs: Math.max(1, Number(tf.settings.get("recentMinutes")) || 30) * 60_000,
    showActivity: tf.settings.get("showActivity") !== false,
    filters: {
      showHidden: tf.settings.get("showHidden") === true,
      skip: parseSkip(tf.settings.get("skipFolders")),
    },
    ...ui,
  });

  /** Draws the panel and the window (whichever is showing). */
  const draw = async () => {
    const now = Date.now();
    lastDraw = now;
    const next = new Map();
    const args = { tree, events, now, t: (k, a) => tf.t(k, a), opts: options() };
    if (shown) {
      const view = panelView(args);
      for (const [id, target] of view.targets) next.set(id, target);
      await tf.panel.show(view.content);
    }
    if (pageOpen) {
      const view = pageView(args);
      for (const [id, target] of view.targets) next.set(id, target);
      await tf.page.post(view.state).catch(() => (pageOpen = false));
    }
    targets = next;
  };

  /** Reads the markers; draws again when they changed, or ages are due. */
  const poll = async () => {
    if ((!shown && !pageOpen) || !tree.root) return;
    if (options().showActivity) {
      events = toEvents(await scanner.scan(tree.root));
      const print = `${events.length}:${events[0]?.key ?? ""}`;
      if (print !== seen) {
        seen = print;
        return draw();
      }
    }
    if (events.length && Date.now() - lastDraw >= AGE_REDRAW_MS) return draw();
    return undefined;
  };

  /** Starts or stops reading markers, as the views come and go. */
  const pace = () => {
    const wanted = shown || pageOpen;
    if (wanted && !timer) {
      timer = setInterval(() => void poll().catch((err) => explain(err)), POLL_MS);
    } else if (!wanted && timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  /** Lists `path` (showing it open and loading meanwhile). */
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

  /** Starts again from `root`, with its activity. */
  const start = async (root) => {
    tree = emptyTree(root);
    events = root && options().showActivity ? toEvents(await scanner.scan(root)) : [];
    seen = `${events.length}:${events[0]?.key ?? ""}`;
    if (root) await load(root);
    else await draw();
  };

  /** Opens or closes a folder, listing it the first time. */
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

  /** A file, or a link that may lead to a folder. */
  const openFile = async (path, isLink, from) => {
    try {
      await tf.viewer.open(path);
      await tf.audit("file-opened", { from });
    } catch (err) {
      if (isLink && err?.name === "NotAFileError") return load(path);
      await tf.toast(explain(err));
    }
    return undefined;
  };

  /** Keeps the Recent section's choice, and draws it. */
  const setUi = async (change) => {
    Object.assign(ui, change);
    await tf.store.set(UI_KEY, { ...ui });
    return draw();
  };

  /** Acts on a row from either view. */
  const act = async (id, action, from) => {
    const target = targets.get(id);
    if (!target) return undefined;
    if (target.kind === "dir") {
      const open = action === "expand" || (action === "activate" && !tree.open.includes(id));
      return toggle(target.path, open);
    }
    if (target.kind === "file" || target.kind === "link") {
      return openFile(target.path, target.kind === "link", from);
    }
    if (target.kind === "recent")
      return setUi({
        recentOpen: action === "expand" || (action === "activate" && !ui.recentOpen),
      });
    if (target.kind === "recent-more") return setUi({ recentAll: !ui.recentAll });
    return undefined;
  };

  /** The tree's folder (`root`, the pane's), listed when it is new. */
  const ensureRoot = async (root) => {
    if (root !== tree.root || !isLoaded(tree, root ?? "")) await start(root);
    else await draw();
  };

  // The Recent section opens as the user left it.
  void tf.store.get(UI_KEY).then((saved) => {
    if (saved && typeof saved === "object") {
      ui.recentOpen = saved.recentOpen !== false;
      ui.recentAll = saved.recentAll === true;
    }
  });

  return {
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
      const root = await tf.pane.cwd();
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
      await tf.page.post(pageStrings((k, a) => tf.t(k, a), HOOK_COMMAND));
      if (setup) await tf.page.post({ type: "setup" });
      return ensureRoot(await tf.pane.cwd());
    },
    /** Lists everything again from the top. */
    refresh: () => (shown || pageOpen ? start(tree.root) : undefined),
    /** A click (or key) on a row of the panel. */
    clicked: ({ row, action } = {}) => act(row, action, "panel"),
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
      return undefined;
    },
    /** The focused pane's folder changed. */
    async paneChanged(path) {
      if (path === tree.root) return undefined;
      if (shown || pageOpen) return start(path);
      tree = emptyTree(path);
      return undefined;
    },
    /** A setting changed: draw again with it. */
    settingChanged: () => draw(),
    /** The user closed the panel (or another tile's took its place). */
    closed() {
      shown = false;
      pace();
    },
    /** The window was closed. */
    pageClosed() {
      pageOpen = false;
      pace();
    },
    /** Reads the markers now (tests; the timer does it every two seconds). */
    poll,
  };
}
