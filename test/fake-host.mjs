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

  const url = pathToFileURL(join(dir, "main.js")).href;
  starts += 1;
  const mod = await import(`${url}?start=${starts}`);
  mod.default(tf);
  await drain();
  return host;
}
