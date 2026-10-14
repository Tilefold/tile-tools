// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Example tiles — tests
 *
 * Every tile in examples/ ships a main.js that is exactly a fresh build of
 * its sources and has the shape Tilefold expects; its tile.json is valid; it
 * uses only messages its English strings define (and defines none it
 * doesn't use); any permission it asks for carries a reason. Each one is
 * also run against a small fake `tf`: its settings and commands register up
 * front with ids, and its commands do what the example promises.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bundleTile } from "../lib/bundle.mjs";
import { checkMain } from "../lib/rules.mjs";

const EXAMPLES = fileURLToPath(new URL("../examples/", import.meta.url));
const folders = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

/** The `key = text` lines of an FTL file, by key. */
function messages(folder) {
  const ftl = readFileSync(join(EXAMPLES, folder, "locales/en/tile.ftl"), "utf8");
  return new Map([...ftl.matchAll(/^([a-z][\w-]*) = (.*)$/gm)].map((m) => [m[1], m[2]]));
}

/**
 * A fake `tf` that records registrations, toasts and storage. `t` returns
 * the key with its arguments, so tests can see which message was used.
 */
function fakeTf(settings = {}) {
  const regs = [];
  const handlers = new Map();
  const toasts = [];
  const store = new Map();
  const tf = {
    setting: (key, def, description) => void regs.push({ kind: "setting", key, def, description }),
    command: (title, run, options = {}) => {
      regs.push({ kind: "command", title, id: options.id });
      handlers.set(`command:${options.id}`, run);
    },
    on: (event, run) => {
      regs.push({ kind: "hook", event });
      handlers.set(`event:${event}`, run);
    },
    t: (key, args) => (args ? `${key} ${JSON.stringify(args)}` : key),
    toast: async (text) => void toasts.push(text),
    settings: { get: (key) => settings[key] },
    store: {
      get: async (key) => store.get(key),
      set: async (key, value) => void store.set(key, value),
      delete: async (key) => void store.delete(key),
    },
  };
  return { tf, regs, handlers, toasts, store };
}

/** Loads an example's built main.js and runs its default export with `tf`. */
async function run(folder, tf) {
  const url = pathToFileURL(join(EXAMPLES, folder, "main.js")).href;
  const mod = await import(`${url}?t=${Date.now()}`);
  mod.default(tf);
}

afterEach(() => vi.useRealTimers());

describe("examples", () => {
  it("are there", () => {
    expect(folders).toEqual([
      "break-timer",
      "brickfold",
      "folder-tree",
      "girder-jump",
      "github-inbox",
      "hello",
      "orbit-guard",
      "pipeline-board",
      "service-status",
      "shell-tips",
      "tilefall",
      "tilefold-pet",
      "tuneboard",
      "weather-card",
      "with-npm-package",
    ]);
  });

  describe.each(folders)("%s", (folder) => {
    const dir = join(EXAMPLES, folder);

    it("ships main.js as a fresh build of its sources", async () => {
      const { code, warnings } = await bundleTile(dir);
      expect(warnings).toEqual([]);
      expect(readFileSync(join(dir, "main.js"), "utf8") === code).toBe(true);
      expect(checkMain(code)).toEqual([]);
    });

    it("has a valid tile.json named from its strings", () => {
      const manifest = JSON.parse(readFileSync(join(dir, "tile.json"), "utf8"));
      expect(manifest.id).toMatch(/^example\.[a-z][a-z0-9-]*$/);
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
      const keys = Object.keys(manifest).filter((k) => k !== "permissions" && k !== "auth");
      expect(keys.sort()).toEqual(["description", "id", "name", "version"]);
      // Permissions, when asked for, each come with the reason shown to the user:
      // window/sound/ai ones, `page`, or `net:` / `script:` with a public host.
      for (const p of manifest.permissions ?? []) {
        const [[name, reason]] = Object.entries(p);
        expect(name).toMatch(
          /^(?:[a-z]+\.[a-z]+|page|(?:net|script):(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+)$/,
        );
        expect(reason.length).toBeGreaterThan(10);
      }
      // Credentials, when declared, go only to hosts the tile asks for, and never carry a secret.
      for (const [name, entry] of Object.entries(manifest.auth ?? {})) {
        expect(name).toMatch(/^[a-z][a-z0-9-]{0,31}$/);
        expect(entry).not.toHaveProperty("clientSecret");
        // A credential given to the page needs the page permission.
        if (entry.page) expect((manifest.permissions ?? []).some((p) => "page" in p)).toBe(true);
        for (const host of entry.hosts) {
          expect(
            (manifest.permissions ?? []).some((p) => `net:${host}` in p),
            host,
          ).toBe(true);
        }
      }
      expect(messages(folder).has("tile-name")).toBe(true);
      expect(messages(folder).has("tile-description")).toBe(true);
    });

    it("uses exactly the messages it defines", () => {
      const code = readFileSync(join(dir, "main.js"), "utf8");
      const used = new Set([...code.matchAll(/"([a-z]+(?:-[a-z]+)+)"/g)].map((m) => m[1]));
      const defined = messages(folder);
      for (const key of defined.keys()) {
        if (key === "tile-name" || key === "tile-description") continue;
        expect(used.has(key), `${key} is never used`).toBe(true);
      }
      const { tf, regs } = fakeTf();
      return run(folder, tf).then(() => {
        for (const r of regs) {
          if (r.kind === "setting") expect(defined.has(r.description), r.description).toBe(true);
          if (r.kind === "command") expect(defined.has(r.title), r.title).toBe(true);
        }
      });
    });

    it("registers its settings and commands up front, every command with an id", async () => {
      const { tf, regs } = fakeTf();
      await run(folder, tf);
      expect(regs.length).toBeGreaterThan(0);
      for (const r of regs.filter((x) => x.kind === "command")) {
        expect(r.id, r.title).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    });
  });

  it("hello greets by name, or as 'there' without one", async () => {
    const named = fakeTf({ name: "  Ada " });
    await run("hello", named.tf);
    await named.handlers.get("command:say-hello")();
    expect(named.toasts[0]).toMatch(/^greeting-(morning|afternoon|evening) \{"name":"Ada"\}$/);
    const anonymous = fakeTf();
    await run("hello", anonymous.tf);
    await anonymous.handlers.get("command:say-hello")();
    expect(anonymous.toasts[0]).toMatch(/\{"name":"greeting-anonymous"\}$/);
  });

  it("break-timer rings after the set minutes, can be stopped, and resumes after a restart", async () => {
    vi.useFakeTimers();
    const first = fakeTf({ minutes: 2 });
    await run("break-timer", first.tf);
    await first.handlers.get("command:start")();
    expect(first.toasts).toEqual(['toast-started {"minutes":2}']);
    expect(first.store.get("ringsAt")).toBe(Date.now() + 120_000);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(first.toasts.at(-1)).toBe("toast-break");
    expect(first.store.has("ringsAt")).toBe(false);

    await first.handlers.get("command:start")();
    await first.handlers.get("command:stop")();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(first.toasts.at(-1)).toBe("toast-stopped");

    // A reminder left running is picked up when Tilefold starts again.
    const restarted = fakeTf({ minutes: 2 });
    restarted.store.set("ringsAt", Date.now() + 30_000);
    await run("break-timer", restarted.tf);
    await restarted.handlers.get("event:app.ready")();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(restarted.toasts).toEqual(["toast-break"]);
  });

  it("with-npm-package makes IDs of the set length with the bundled nanoid", async () => {
    const { tf, handlers, toasts } = fakeTf({ length: 8 });
    await run("with-npm-package", tf);
    await handlers.get("command:new-id")();
    await handlers.get("command:new-id")();
    const ids = toasts.map((t) => JSON.parse(t.replace(/^toast-id /, "")).id);
    expect(ids[0]).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(ids[1]).not.toBe(ids[0]);
  });
});
