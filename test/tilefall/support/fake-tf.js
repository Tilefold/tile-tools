/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold host (tests only)
 *
 * A `tf` object that plays Tilefold's part closely enough for behaviour
 * tests: settings fall back to their registered defaults and can be
 * changed (firing `setting.changed`), messages come from the tile's own
 * locales/<lang>/tile.ftl with `{ $var }` placeholders filled in (a
 * missing message throws, so a typo fails the test), overlay updates merge
 * into the scene item by item, and audits, sounds, store writes, log lines
 * and registrations are all recorded for assertions.
 *
 * Use with Vitest fake timers: `advance(ms)` moves time on and lets the
 * tile's background work finish.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";

/** The tile's root folder. */
export const ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "examples",
  "tilefall",
);

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

/**
 * The `key = text` messages of one locale.
 *
 * @param {string} locale
 * @returns {Map<string, string>}
 */
export function messagesOf(locale = "en") {
  const ftl = readFileSync(join(ROOT, "locales", locale, "tile.ftl"), "utf8");
  return new Map([...ftl.matchAll(/^([a-z][\w-]*) = (.*)$/gm)].map((m) => [m[1], m[2]]));
}

/** Lets pending promise jobs run, several rounds deep. */
export async function drain(rounds = 50) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

/**
 * Builds a fake host.
 *
 * @param {{ locale?: string, settings?: Record<string, unknown>, store?: Record<string, unknown>,
 *           layout?: object, overlaysOff?: boolean, failStore?: boolean }} [opts]
 */
export function createHost(opts = {}) {
  const messages = messagesOf(opts.locale ?? "en");
  const handlers = new Map();
  const commands = new Map();
  const defaults = new Map();
  const values = new Map(Object.entries(opts.settings ?? {}));

  const host = {
    regs: [],
    audits: [],
    sounds: [],
    logs: [],
    errors: [],
    store: new Map(Object.entries(opts.store ?? {})),
    /** The scene as drawn, or null when hidden. */
    overlay: null,
    shows: 0,
    updates: [],
    layout: opts.layout ?? ONE_PANE,
    overlaysOff: Boolean(opts.overlaysOff),
    /** The item with this id in the current scene. */
    item: (id) => host.overlay?.items.find((i) => i.id === id),
    /** Fires an event the way Tilefold does. */
    async emit(event, payload = {}) {
      for (const run of handlers.get(event) ?? []) await run(payload);
      await drain();
    },
    /** Runs a command by id. */
    async command(id) {
      const run = commands.get(id);
      if (!run) throw new Error(`no command ${id}`);
      await run();
      await drain();
    },
    /** Clicks an overlay item. */
    async click(item) {
      await host.emit("overlay.pointer", { type: "click", item, x: 0, y: 0 });
    },
    async setSetting(key, value) {
      values.set(key, value);
      await host.emit("setting.changed", { key });
    },
    async advance(ms) {
      await vi.advanceTimersByTimeAsync(ms);
      await drain();
    },
    actions: () => host.audits.map((a) => a.action),
  };

  const t = (key, args = {}) => {
    const text = messages.get(key);
    if (text === undefined) throw new Error(`no message ${key}`);
    return text.replace(/\{ \$(\w+) \}/g, (_, name) => String(args[name] ?? ""));
  };

  const failing = async () => {
    throw new Error("store unavailable");
  };

  const tf = {
    t,
    setting(key, def, description, options) {
      defaults.set(key, def);
      host.regs.push({ kind: "setting", key, default: def, description, ...(options ?? {}) });
    },
    command(title, run, options = {}) {
      host.regs.push({ kind: "command", title, id: options.id, key: options.key });
      commands.set(options.id, run);
    },
    on(event, run) {
      host.regs.push({ kind: "hook", event });
      handlers.set(event, [...(handlers.get(event) ?? []), run]);
    },
    settings: { get: (key) => (values.has(key) ? values.get(key) : defaults.get(key)) },
    store: opts.failStore
      ? { get: failing, set: failing, delete: failing }
      : {
          get: async (key) => (host.store.has(key) ? structuredClone(host.store.get(key)) : null),
          set: async (key, value) => void host.store.set(key, structuredClone(value)),
          delete: async (key) => host.store.delete(key),
        },
    audit: async (action, details) => void host.audits.push({ action, details }),
    log: {
      info: async (text) => void host.logs.push(String(text)),
      warn: async (text) => void host.logs.push(String(text)),
      error: async (text) => void host.errors.push(String(text)),
    },
    toast: async () => {},
    sound: {
      async play(clip) {
        if (!/^data:audio\/wav;base64,/.test(clip.src)) throw new Error("not an audio data URL");
        host.sounds.push(clip);
        return true;
      },
    },
    overlay: {
      async layout() {
        return structuredClone(host.layout);
      },
      async show(scene) {
        if (host.overlaysOff) return false;
        host.shows += 1;
        host.overlay = { items: (scene.items ?? []).map((i) => ({ ...i })) };
        return true;
      },
      async update(patch) {
        if (!host.overlay) throw new Error("show the overlay before updating it");
        for (const change of patch.items ?? []) {
          const current = host.item(change.id);
          if (current) Object.assign(current, change);
          else host.overlay.items.push({ ...change });
        }
        host.updates.push(patch);
        return true;
      },
      async hide() {
        host.overlay = null;
        return null;
      },
    },
  };

  return { host, tf };
}
