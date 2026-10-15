/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold host (tests only)
 *
 * Runs an example tile's built main.js against a fake `tf` that plays the
 * app's part closely enough for behaviour tests of overlay tiles: settings
 * fall back to their registered defaults and can be changed (firing
 * `setting.changed`), messages come from the tile's own locales/<lang>/
 * tile.ftl with `{ $var }` placeholders filled in, overlay updates merge
 * into the scene item by item, and notices, sounds, audit records, store
 * writes and logged errors are all recorded for assertions. Commands and events are
 * run by id and name, the way Tilefold invokes them.
 *
 * For tiles that use the network, credentials or AI: `net` answers
 * `tf.net.fetch` (every request is recorded with the credential it names;
 * a request naming a credential that is not in `credentials` fails with
 * `CredentialMissingError`, as in Tilefold); `credentials` lists the ones
 * the user has set up, for `tf.auth.has`; `ai` answers `tf.ai.ask` (every
 * question is recorded; without it, asking fails with `AiNotSetUpError`).
 *
 * For tiles that use folders: `folders: { cwd, roots, files, links }` adds
 * `tf.pane`, `tf.fs` and `tf.viewer` with Tilefold's rules (only paths
 * inside a `roots` folder; `files` are absolute file paths and their
 * folders exist implicitly; `links` maps a link's path to its target,
 * listed as kind "link" and followed when listed or opened; opened files
 * are kept in `host.opened`;
 * `host.cwd` is the focused pane's folder). `page: true` adds `tf.page`
 * (opens, closes and posted messages are kept in `host.page`). `panel: true`
 * adds `tf.panel` (`host.panel.content` is what is docked, or null; rows
 * and the footer's rows are checked the way Tilefold 0.1.11 checks them:
 * unique ids, labels, depth, a known icon and tone, badge and trail
 * lengths).
 *
 * Use with Vitest fake timers; `advance()` moves time on and drains the
 * promise jobs the tile's background handlers leave behind.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { vi } from "vitest";

/** A window with one focused pane whose Composer is at the bottom. */
export const ONE_PANE = {
  content: { w: 1200, h: 800 },
  panes: [
    {
      id: "p1",
      x: 0,
      y: 40,
      w: 1200,
      h: 730,
      focused: true,
      composer: { x: 0, y: 724, w: 1200, h: 46 },
    },
  ],
};

/** The `key = text` messages of one locale of a tile. */
function messagesOf(dir, locale) {
  const ftl = readFileSync(join(dir, "locales", locale, "tile.ftl"), "utf8");
  return new Map([...ftl.matchAll(/^([a-z][\w-]*) = (.*)$/gm)].map((m) => [m[1], m[2]]));
}

/** Gives every start its own module instance. */
let starts = 0;

/** Lets pending promise jobs run, several rounds deep. */
export async function drain(rounds = 50) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

/**
 * Starts the built tile in `dir` and fires nothing yet.
 *
 * @param {string} dir  the example's folder
 * @param {{ locale?: string, settings?: Record<string, unknown>,
 *           store?: Record<string, unknown>, layout?: object,
 *           net?: (url: string, init: object) => any, credentials?: string[],
 *           ai?: (input: unknown) => string | Promise<string> }} [opts]
 */
export async function startTile(dir, opts = {}) {
  const messages = messagesOf(dir, opts.locale ?? "en");
  const handlers = new Map();
  const commands = new Map();
  const defaults = new Map();
  const values = new Map(Object.entries(opts.settings ?? {}));

  const host = {
    regs: [],
    audits: [],
    /** Notices shown with tf.toast, as text. */
    toasts: [],
    sounds: [],
    /** Requests made through tf.net.fetch: { url, init }. */
    requests: [],
    /** Questions asked through tf.ai.ask. */
    questions: [],
    /** Credentials the user has set up (names), for tf.auth.has. */
    credentials: new Set(opts.credentials ?? []),
    /** Warnings logged with tf.log.warn. */
    warnings: [],
    errors: [],
    store: new Map(Object.entries(opts.store ?? {})),
    /** The scene as Tilefold would draw it, or null when hidden. */
    overlay: null,
    overlayUpdates: 0,
    layout: opts.layout ?? ONE_PANE,
    /** The item with this id in the current scene. */
    item: (id) => host.overlay?.items.find((i) => i.id === id),
    async emit(event, payload = {}) {
      for (const run of handlers.get(event) ?? []) await run(payload);
      await drain();
    },
    async command(id) {
      const run = commands.get(id);
      if (!run) throw new Error(`no command ${id}`);
      await run();
      await drain();
    },
    async setSetting(key, value) {
      values.set(key, value);
      await host.emit("setting.changed", { key });
    },
    async advance(ms) {
      await vi.advanceTimersByTimeAsync(ms);
      await drain();
    },
  };

  const t = (key, args = {}) => {
    const text = messages.get(key);
    if (text === undefined) throw new Error(`no message ${key}`);
    return text.replace(/\{ \$(\w+) \}/g, (_, name) => String(args[name] ?? ""));
  };

  const tf = {
    t,
    setting(key, def, description, options = {}) {
      defaults.set(key, def);
      host.regs.push({ kind: "setting", key, default: def, description, ...options });
    },
    command(title, run, options = {}) {
      host.regs.push({ kind: "command", title, id: options.id });
      commands.set(options.id, run);
    },
    on(event, run) {
      host.regs.push({ kind: "hook", event });
      handlers.set(event, [...(handlers.get(event) ?? []), run]);
    },
    settings: { get: (key) => (values.has(key) ? values.get(key) : defaults.get(key)) },
    store: {
      get: async (key) => (host.store.has(key) ? host.store.get(key) : null),
      set: async (key, value) => void host.store.set(key, structuredClone(value)),
      delete: async (key) => host.store.delete(key),
    },
    audit: async (action, details) => void host.audits.push({ action, details }),
    log: {
      info: async () => {},
      warn: async (text) => void host.warnings.push(String(text)),
      error: async (text) => void host.errors.push(String(text)),
    },
    toast: async (text) => void host.toasts.push(String(text)),
    sound: {
      async play(clip) {
        if (!/^data:audio\/(wav|x-wav|mpeg|ogg|webm);base64,/.test(clip.src)) {
          throw new Error("not an audio data URL");
        }
        host.sounds.push(clip);
        return true;
      },
    },
    overlay: {
      async layout() {
        return structuredClone(host.layout);
      },
      async show(scene) {
        host.overlay = { items: (scene.items ?? []).map((i) => ({ bubble: null, ...i })) };
        return true;
      },
      async update(patch) {
        if (!host.overlay) throw new Error("show the overlay before updating it");
        for (const change of patch.items ?? []) {
          const current = host.item(change.id);
          if (current) Object.assign(current, change);
          else host.overlay.items.push({ bubble: null, ...change });
        }
        host.overlayUpdates += 1;
        return true;
      },
      async hide() {
        host.overlay = null;
        return null;
      },
    },
  };

  /** An error the tile sees with this `name`, as Tilefold's errors are. */
  const named = (name, message) => Object.assign(new Error(message), { name });

  if (opts.net) {
    tf.net = {
      async fetch(url, init = {}) {
        host.requests.push({ url, init: structuredClone(init) });
        if (init.auth !== undefined && !host.credentials.has(init.auth)) {
          throw named("CredentialMissingError", "the credential is not set up");
        }
        const r = await opts.net(url, init);
        const status = r?.status ?? 200;
        const body = r?.body ?? "";
        return {
          status,
          statusText: "",
          ok: status >= 200 && status < 300,
          url,
          headers: r?.headers ?? {},
          text: async () => body,
          json: async () => JSON.parse(body),
          bytes: async () => new TextEncoder().encode(body),
        };
      },
    };
  }
  tf.auth = { has: async (name) => host.credentials.has(name) };
  tf.ai = {
    async ask(input) {
      host.questions.push(structuredClone(input));
      if (!opts.ai) throw named("AiNotSetUpError", "AI is not set up");
      // An answer may be a promise, to stand for the user still looking at the dialog.
      const text = String(await opts.ai(input));
      return {
        text,
        model: "claude-opus-5-5",
        stopReason: "end_turn",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
  };

  if (opts.folders) addFolders(tf, host, opts.folders, named);
  if (opts.page) addPage(tf, host);
  if (opts.panel) addPanel(tf, host, named);

  const url = pathToFileURL(join(dir, "main.js")).href;
  starts += 1;
  const mod = await import(`${url}?start=${starts}`);
  mod.default(tf);
  await drain();
  return host;
}

/** The parent folder of an absolute path ("/" stays "/"). */
const parentOf = (path) => {
  const cut = path.replace(/\/+$/, "").lastIndexOf("/");
  return cut <= 0 ? "/" : path.slice(0, cut);
};

/** `tf.pane`, `tf.fs` and `tf.viewer` over a list of files, with Tilefold's rules. */
function addFolders(tf, host, { cwd = null, roots = [], files = [], links = {} }, named) {
  host.cwd = cwd;
  host.roots = roots;
  // Copies, so a test that changes the files never changes the next test's.
  host.files = [...files];
  host.links = { ...links };
  host.opened = [];
  /** A path with a link at its start followed, as Tilefold resolves it. */
  const resolve = (path) => {
    for (const [link, target] of Object.entries(host.links)) {
      if (path === link || path.startsWith(`${link}/`)) return target + path.slice(link.length);
    }
    return path;
  };
  const dirs = () => {
    const out = new Set();
    for (const f of host.files) {
      for (let d = parentOf(f); ; d = parentOf(d)) {
        out.add(d);
        if (d === "/") break;
      }
    }
    return out;
  };
  const check = (raw) => {
    const path = resolve(raw);
    const inside = host.roots.some((r) => path === r || path.startsWith(`${r}/`));
    if (!inside) throw named("PathNotAllowedError", "not inside a pane's folder");
    if (!dirs().has(path) && !host.files.includes(path)) throw named("NotFoundError", "missing");
    return path;
  };
  tf.pane = { cwd: async () => host.cwd };
  tf.fs = {
    async list(raw) {
      const path = check(raw);
      if (!dirs().has(path)) throw named("NotADirectoryError", "not a folder");
      const names = new Map();
      for (const d of dirs()) if (d !== path && parentOf(d) === path) names.set(d, "dir");
      for (const f of host.files) if (parentOf(f) === path) names.set(f, "file");
      for (const l of Object.keys(host.links)) if (parentOf(l) === path) names.set(l, "link");
      const entries = [...names]
        .map(([p, kind]) => ({ name: p.slice(p.lastIndexOf("/") + 1), kind }))
        .sort((a, b) =>
          a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1,
        );
      return { path, entries, truncated: false };
    },
  };
  tf.viewer = {
    async open(raw) {
      const path = check(raw);
      if (!host.files.includes(path)) throw named("NotAFileError", "not a file");
      host.opened.push(path);
      return null;
    },
  };
}

/** `tf.page`, recording what the tile does with its page. */
function addPage(tf, host) {
  host.page = { open: false, opens: [], closes: 0, posted: [] };
  tf.page = {
    async open(options = {}) {
      host.page.open = true;
      host.page.opens.push(options);
      return null;
    },
    async close() {
      host.page.open = false;
      host.page.closes += 1;
      return null;
    },
    async post(message) {
      if (!host.page.open)
        throw Object.assign(new Error("the page is not open"), { name: "PageError" });
      host.page.posted.push(structuredClone(message));
      return null;
    },
  };
}

/** Icons Tilefold draws in panel rows. */
const PANEL_ICONS = ["folder", "file", "link", "loading", "error", "info", "none"];
/** Theme tones a panel row may take (Tilefold 0.1.11). */
const PANEL_TONES = ["accent", "info", "success", "warning", "error"];

/** Whether `v` is left out or a string of 1..max characters. */
const optionalText = (v, max) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim().length > 0 && v.length <= max);
/** Whether `v` is left out or true/false. */
const optionalFlag = (v) => v === undefined || typeof v === "boolean";

/** Whether one panel row is as Tilefold accepts it (ids checked by the caller). */
const panelRowOk = (r) =>
  typeof r?.id === "string" &&
  r.id.length > 0 &&
  r.id.length <= 1024 &&
  typeof r.label === "string" &&
  r.label.length > 0 &&
  r.label.length <= 256 &&
  (r.depth === undefined || (Number.isInteger(r.depth) && r.depth >= 0)) &&
  (r.icon === undefined || PANEL_ICONS.includes(r.icon)) &&
  ["expandable", "expanded", "muted", "section", "pulse"].every((f) => optionalFlag(r[f])) &&
  (r.tone === undefined || r.tone === null || PANEL_TONES.includes(r.tone)) &&
  optionalText(r.hint, 512) &&
  optionalText(r.badge, 32) &&
  optionalText(r.trail, 32);

/**
 * `tf.panel`, keeping the docked content and checking rows as Tilefold
 * 0.1.11 does: ids unique across the rows and the footer, at most 5,000
 * rows in all.
 */
function addPanel(tf, host, named) {
  host.panel = { content: null, shows: 0 };
  tf.panel = {
    async show(content) {
      const ids = new Set();
      if (typeof content?.title !== "string" || !content.title.trim()) {
        throw named("TypeError", "title");
      }
      const footer = content.footer?.rows ?? [];
      const lists = [
        ["rows", content.rows ?? []],
        ["footer.rows", footer],
      ];
      if (content.rows.length + footer.length > 5000) throw named("TypeError", "at most 5000 rows");
      for (const [where, list] of lists) {
        for (const [i, r] of list.entries()) {
          if (!panelRowOk(r) || ids.has(r.id)) throw named("TypeError", `${where}[${i}]`);
          ids.add(r.id);
        }
      }
      host.panel.content = structuredClone(content);
      host.panel.shows += 1;
      return true;
    },
    async hide() {
      host.panel.content = null;
      return null;
    },
  };
}
