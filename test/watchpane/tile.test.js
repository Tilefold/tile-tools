// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the tile (tests)
 *
 * Runs the tile's sources against a small fake Tilefold with tile pages:
 * the commands open, toggle and close the page; the page's hello gets the
 * text, settings and recent list; started videos join the recent list and
 * are remembered; audits never name a video; an older Tilefold without
 * pages gets a plain message.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addRecent, MAX_RECENT, readRecent } from "../../examples/watchpane/src/tile/recent.js";
import { readOptions } from "../../examples/watchpane/src/tile/settings.js";
import tile from "../../examples/watchpane/src/main.js";

const ID = "dQw4w9WgXcQ";
const OTHER = "9bZkp7q19f0";

/** English messages, `{ $var }` filled in; a missing one throws. */
const MESSAGES = new Map(
  [
    ...readFileSync(
      new URL("../../examples/watchpane/locales/en/tile.ftl", import.meta.url),
      "utf8",
    ).matchAll(/^([a-z][\w-]*) = (.*)$/gm),
  ].map((m) => [m[1], m[2]]),
);

/** Lets the tile's background work finish. */
async function drain() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

/** A fake host; `pages: false` plays a Tilefold without tile pages. */
function createHost({ pages = true, store = {}, settings = {} } = {}) {
  const handlers = new Map();
  const commands = new Map();
  const defaults = new Map();
  const values = new Map(Object.entries(settings));
  const host = {
    regs: [],
    audits: [],
    toasts: [],
    logs: [],
    store: new Map(Object.entries(store)),
    page: { open: false, calls: [], posts: [] },
    async emit(event, payload = {}) {
      for (const run of handlers.get(event) ?? []) await run(payload);
      await drain();
    },
    async command(id) {
      await commands.get(id)();
      await drain();
    },
    fromPage: (message) => host.emit("page.message", { message }),
    async setSetting(key, value) {
      values.set(key, value);
      await host.emit("setting.changed", { key });
    },
    lastPost: () => host.page.posts.at(-1),
  };
  const tf = {
    t(key, args = {}) {
      const text = MESSAGES.get(key);
      if (text === undefined) throw new Error(`no message ${key}`);
      return text.replace(/\{ \$(\w+) \}/g, (_, name) => String(args[name] ?? ""));
    },
    setting(key, def, description) {
      defaults.set(key, def);
      host.regs.push({ kind: "setting", key, def, description });
    },
    command(title, run, options = {}) {
      host.regs.push({ kind: "command", title, ...options });
      commands.set(options.id, run);
    },
    on(event, run) {
      handlers.set(event, [...(handlers.get(event) ?? []), run]);
    },
    settings: { get: (key) => (values.has(key) ? values.get(key) : defaults.get(key)) },
    store: {
      get: async (key) => (host.store.has(key) ? structuredClone(host.store.get(key)) : null),
      set: async (key, value) => void host.store.set(key, structuredClone(value)),
    },
    audit: async (action, details) => void host.audits.push({ action, details }),
    log: { warn: async (text) => void host.logs.push(String(text)) },
    toast: async (text) => void host.toasts.push(String(text)),
  };
  if (pages) {
    tf.page = {
      async open(options = {}) {
        host.page.open = true;
        host.page.calls.push(["open", options]);
        return null;
      },
      async close() {
        host.page.open = false;
        host.page.calls.push(["close"]);
        await host.emit("page.closed", {});
        return null;
      },
      async post(message) {
        if (!host.page.open) throw new Error("the page is not open");
        host.page.posts.push(structuredClone(message));
        return null;
      },
    };
  }
  tile(tf);
  return host;
}

describe("Watchpane", () => {
  it("registers its settings and commands, Open with a shortcut", () => {
    const host = createHost();
    expect(host.regs.filter((r) => r.kind === "setting").map((r) => [r.key, r.def])).toEqual([
      ["autoplay", true],
      ["captions", false],
      ["private", true],
      ["showCard", true],
      ["corner", "bottom-right"],
    ]);
    const cmds = host.regs.filter((r) => r.kind === "command");
    expect(cmds.map((c) => [c.id, c.title])).toEqual([
      ["open", "Watchpane: Open"],
      ["toggle", "Watchpane: Play or pause"],
      ["back", "Watchpane: Back 10 seconds"],
      ["forward", "Watchpane: Forward 10 seconds"],
      ["mute", "Watchpane: Mute or unmute"],
      ["card", "Watchpane: Show or hide the card"],
      ["reset", "Watchpane: Put the player back in the pane"],
      ["close", "Watchpane: Close"],
    ]);
    expect(cmds[0].key).toEqual({ mac: "Ctrl+Alt+Y", other: "Ctrl+Alt+Y" });
  });

  it("opens the page and answers its hello with text, settings and the recent list", async () => {
    const host = createHost({
      store: { recent: [{ id: OTHER, title: "Earlier" }, { id: "nope" }] },
      settings: { captions: true, private: "maybe" },
    });
    await host.command("open");
    expect(host.page.calls).toEqual([["open", { origin: "https" }]]);
    expect(host.audits).toEqual([{ action: "opened", details: { docked: false } }]);

    await host.fromPage({ type: "hello" });
    const setup = host.lastPost();
    expect(setup).toMatchObject({ do: "setup", lang: "en", dir: "ltr" });
    expect(setup.options).toEqual({ autoplay: true, captions: true, private: true });
    expect(setup.recent).toEqual([{ id: OTHER, title: "Earlier" }]);
    expect(setup.strings.play).toBe("Play");
    // The page fills in YouTube's code itself.
    expect(setup.strings.errConfig).toBe("YouTube refused to play in this window (error {code}).");
  });

  it("adds a started video to the top of the recent list and remembers it", async () => {
    const host = createHost({ store: { recent: [{ id: OTHER, title: "Earlier" }] } });
    await host.command("open");
    await host.fromPage({ type: "watching", id: ID, title: "New one", from: "link" });
    const expected = [
      { id: ID, title: "New one" },
      { id: OTHER, title: "Earlier" },
    ];
    expect(host.store.get("recent")).toEqual(expected);
    expect(host.lastPost()).toEqual({ do: "recent", recent: expected });
    // The audit says where it was picked from, never which video.
    expect(host.audits.at(-1)).toEqual({ action: "video.start", details: { from: "link" } });
    expect(JSON.stringify(host.audits)).not.toContain(ID);
  });

  it("ignores a started video with a malformed id", async () => {
    const host = createHost();
    await host.command("open");
    await host.fromPage({ type: "watching", id: "<img src=x>", title: "bad" });
    expect(host.store.has("recent")).toBe(false);
    expect(host.page.posts).toEqual([]);
  });

  it("records the player's errors by code", async () => {
    const host = createHost();
    await host.command("open");
    await host.fromPage({ type: "error", code: 153 });
    await host.fromPage({ type: "error", code: "api" });
    await host.fromPage({ type: "error", code: "<b>" });
    expect(host.audits.slice(1)).toEqual([
      { action: "video.error", details: { code: 153 } },
      { action: "video.error", details: { code: "api" } },
      { action: "video.error", details: { code: 0 } },
    ]);
    expect(host.logs).toEqual(["player error 153", "player error api", "player error 0"]);
  });

  it("Play or pause opens a closed page, and toggles an open one", async () => {
    const host = createHost();
    await host.command("toggle");
    expect(host.page.calls).toEqual([["open", { origin: "https" }]]);
    await host.command("toggle");
    expect(host.lastPost()).toEqual({ do: "toggle" });
  });

  it("Close closes the page and records it once", async () => {
    const host = createHost();
    await host.command("close");
    expect(host.page.calls).toEqual([]);
    await host.command("open");
    await host.command("close");
    expect(host.page.calls.at(-1)).toEqual(["close"]);
    expect(host.audits.map((a) => a.action)).toEqual(["opened", "closed"]);
  });

  it("sends changed settings to an open page", async () => {
    const host = createHost();
    await host.setSetting("autoplay", false);
    expect(host.page.posts).toEqual([]);
    await host.command("open");
    await host.setSetting("autoplay", false);
    expect(host.lastPost().options.autoplay).toBe(false);
  });

  it("tells a Tilefold without tile pages what it needs", async () => {
    const host = createHost({ pages: false });
    await host.command("open");
    await host.command("toggle");
    expect(host.toasts).toEqual([
      "Watchpane needs Tilefold 0.1.10 or later.",
      "Watchpane needs Tilefold 0.1.10 or later.",
    ]);
  });
});

describe("the recent list", () => {
  it("drops malformed and repeated entries when read", () => {
    expect(
      readRecent([{ id: ID, title: " A " }, { id: ID, title: "again" }, { id: "x" }, 3, null]),
    ).toEqual([{ id: ID, title: "A" }]);
    expect(readRecent("nope")).toEqual([]);
  });

  it(`keeps the newest ${MAX_RECENT}, moving a rewatched video to the top`, () => {
    let list = [];
    for (let i = 0; i < MAX_RECENT + 3; i++) {
      list = addRecent(list, { id: `video${String(i).padStart(6, "0")}`, title: `#${i}` });
    }
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].title).toBe(`#${MAX_RECENT + 2}`);
    const again = addRecent(list, { id: list[5].id, title: "back" });
    expect(again[0]).toEqual({ id: list[5].id, title: "back" });
    expect(again).toHaveLength(MAX_RECENT);
    expect(addRecent(list, { id: "bad" })).toBe(list);
  });
});

describe("readOptions", () => {
  it("falls back to the defaults for anything that isn't true or false", () => {
    const get = (values) => ({ get: (k) => values[k] });
    expect(readOptions(get({}))).toEqual({ autoplay: true, captions: false, private: true });
    expect(readOptions(get({ autoplay: false, captions: 1, private: false }))).toEqual({
      autoplay: false,
      captions: false,
      private: false,
    });
    const broken = {
      get: () => {
        throw new Error("gone");
      },
    };
    expect(readOptions(broken)).toEqual({ autoplay: true, captions: false, private: true });
  });
});
