/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile parts tests
 *
 * The small Tilefold-side modules on their own: layout in every corner and
 * size, settings registration and clean-up, command ids and shortcuts (no
 * clash with Tilefold or Tilefall), finding the network, storage with
 * rotated tokens and a failing store, the activity trail's filtering, and
 * the poller's timing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUTTONS } from "../../../examples/tuneboard/src/render/buttons.js";
import {
  ACTIONS,
  DETAIL_KEYS,
  cleanDetails,
  createTrail,
} from "../../../examples/tuneboard/src/tile/audit.js";
import { COMMANDS, registerCommands } from "../../../examples/tuneboard/src/tile/commands.js";
import { MIN_WAIT_MS, createPoller } from "../../../examples/tuneboard/src/tile/poller.js";
import {
  CORNERS,
  GROUP_H,
  GROUP_W,
  MARGIN,
  areaOf,
  computeLayout,
  homePane,
} from "../../../examples/tuneboard/src/tile/scene.js";
import {
  SETTINGS,
  readSettings,
  registerSettings,
} from "../../../examples/tuneboard/src/tile/settings.js";
import { KEYS, createStore } from "../../../examples/tuneboard/src/tile/store.js";
import { findTransport, withOk } from "../../../examples/tuneboard/src/tile/transport.js";
import { ONE_PANE, createHost, drain } from "../support/fake-tf.js";

/** True when two rectangles overlap. */
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("scene layout", () => {
  it("finds the focused pane, else the first, else none", () => {
    const a = { id: "a" };
    const b = { id: "b", focused: true };
    expect(homePane({ panes: [a, b] })).toBe(b);
    expect(homePane({ panes: [a] })).toBe(a);
    expect(homePane({ panes: [] })).toBeNull();
    expect(homePane(null)).toBeNull();
  });

  it("uses the pane down to its Composer, or the whole window", () => {
    expect(areaOf(ONE_PANE)).toEqual({ x: 0, y: 40, w: 1200, h: 684 });
    expect(areaOf({ content: { w: 500, h: 400 }, panes: [] })).toEqual({
      x: 0,
      y: 0,
      w: 500,
      h: 400,
    });
    expect(areaOf(null)).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  for (const corner of CORNERS) {
    for (const size of ["medium", "small"]) {
      it(`places six non-overlapping items inside the pane (${corner}, ${size})`, () => {
        const rects = computeLayout(ONE_PANE, { corner, size });
        const all = Object.entries(rects);
        expect(all).toHaveLength(1 + BUTTONS.length);
        for (const [, r] of all) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(40);
          expect(r.x + r.w).toBeLessThanOrEqual(1200);
          expect(r.y + r.h).toBeLessThanOrEqual(724);
          expect(r.w).toBeLessThanOrEqual(256);
        }
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++)
            expect(overlaps(all[i][1], all[j][1])).toBe(false);
        }
      });
    }
  }

  it("keeps a margin from the corner", () => {
    const r = computeLayout(ONE_PANE, { corner: "bottom-right" });
    expect(r.card.x + GROUP_W).toBe(1200 - MARGIN);
    expect(r.card.y + GROUP_H).toBe(724 - MARGIN);
    const t = computeLayout(ONE_PANE, { corner: "top-left" });
    expect(t.card).toMatchObject({ x: MARGIN, y: 40 + MARGIN });
  });

  it("lines the outer buttons up with the card's edges", () => {
    const r = computeLayout(ONE_PANE, {});
    expect(r["btn-previous"].x).toBe(r.card.x);
    expect(r["btn-playlists"].x + r["btn-playlists"].w).toBe(r.card.x + r.card.w);
  });

  it("stays inside a pane too small for it", () => {
    const tiny = {
      content: { w: 100, h: 50 },
      panes: [{ x: 0, y: 0, w: 100, h: 50, focused: true }],
    };
    for (const r of Object.values(computeLayout(tiny, {}))) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("falls back to medium and bottom-right for unknown values", () => {
    expect(computeLayout(ONE_PANE, { size: "huge", corner: "middle" })).toEqual(
      computeLayout(ONE_PANE, {}),
    );
  });
});

describe("settings", () => {
  it("registers every setting with a translated description and choices", () => {
    const { host, tf } = createHost();
    registerSettings(tf);
    expect(host.regs.map((r) => r.key)).toEqual(SETTINGS.map((s) => s.key));
    expect(host.regs.map((r) => r.key)).toEqual(["size", "corner", "poll"]);
    expect(host.regs.find((r) => r.key === "corner").choices).toHaveLength(4);
    expect(host.regs.find((r) => r.key === "size").choices[1]).toEqual({
      value: "small",
      label: "Small",
    });
  });

  it("reads clean values, falling back for odd ones", () => {
    const values = {
      size: "giant",
      corner: "nowhere",
      poll: "yes",
    };
    expect(readSettings({ get: (k) => values[k] })).toEqual({
      size: "medium",
      corner: "bottom-right",
      poll: true,
    });
    expect(
      readSettings({ get: (k) => ({ size: "small", corner: "top-left", poll: false })[k] }),
    ).toMatchObject({
      size: "small",
      corner: "top-left",
      poll: false,
    });
  });

  it("survives a settings store that throws", () => {
    expect(
      readSettings({
        get: () => {
          throw new Error("x");
        },
      }),
    ).toEqual({ size: "medium", corner: "bottom-right", poll: true });
  });
});

describe("commands", () => {
  it("registers every command with its id, title and keys", () => {
    const { host, tf } = createHost();
    const run = vi.fn();
    registerCommands(tf, run);
    const regs = host.regs.filter((r) => r.kind === "command");
    expect(regs.map((r) => r.id)).toEqual(COMMANDS.map((c) => c.id));
    expect(regs[0].title).toBe("Tuneboard: Show or hide");
  });

  it("uses unique Ctrl+Alt letter shortcuts", () => {
    const keyed = COMMANDS.filter((c) => c.key);
    const keys = keyed.map((c) => c.key.other);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of keyed) {
      expect(c.key.mac).toMatch(/^Ctrl\+Alt\+[A-Z]$/);
      expect(c.key.other).toBe(c.key.mac);
    }
    // Playing in Tilefold, stopping it, the Library and putting the card back have no default keys.
    expect(COMMANDS.filter((c) => !c.key).map((c) => c.id)).toEqual([
      "play-here",
      "stop-here",
      "library",
      "playlists",
      "reset-position",
    ]);
  });

  it("stays clear of Tilefold's and Tilefall's shortcuts", () => {
    const taken = ["F", "H", "L", "O", "W", "N", "P", "G", "Z", "C"].map((k) => `Ctrl+Alt+${k}`);
    for (const c of COMMANDS) if (c.key) expect(taken).not.toContain(c.key.mac);
  });
});

describe("transport", () => {
  it("finds tf.net.fetch when Tilefold offers it", async () => {
    const { host, tf } = createHost({ net: true });
    const fetchFn = findTransport(tf);
    expect(fetchFn).toBeTypeOf("function");
    await fetchFn("https://api.spotify.com/v1/me/player", { method: "GET" });
    expect(host.requests).toEqual([
      { url: "https://api.spotify.com/v1/me/player", init: { method: "GET" } },
    ]);
  });

  it("returns null without tf.net, even when a global fetch exists", () => {
    const { tf } = createHost();
    expect(typeof globalThis.fetch).toBe("function");
    expect(findTransport(tf)).toBeNull();
    expect(findTransport({ net: {} })).toBeNull();
    expect(findTransport(null)).toBeNull();
  });

  it("fills in ok from the status when the host leaves it out", async () => {
    expect(withOk({ status: 204 }).ok).toBe(true);
    expect(withOk({ status: 299 }).ok).toBe(true);
    expect(withOk({ status: 401 }).ok).toBe(false);
    expect(withOk({ status: "x" }).ok).toBe(false);
    const given = { status: 500, ok: true };
    expect(withOk(given)).toBe(given);
    expect(withOk(null)).toBeNull();
    const { tf } = createHost({
      net: true,
      fetch: async () => ({ status: 200, json: async () => ({ a: 1 }) }),
    });
    const res = await findTransport(tf)("https://api.spotify.com/v1/me/player");
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ a: 1 });
  });

  it("returns null when reading tf.net throws", () => {
    const tf = Object.defineProperty({}, "net", {
      get() {
        throw new Error("no");
      },
    });
    expect(findTransport(tf)).toBeNull();
  });
});

describe("store", () => {
  it("remembers visibility, hidden by default", async () => {
    const { host, tf } = createHost();
    const store = createStore(tf);
    expect(await store.visible()).toBe(false);
    await store.setVisible(true);
    expect(host.store.get(KEYS.visible)).toBe(true);
    expect(await store.visible()).toBe(true);
  });

  it("clears a token an earlier version saved, by overwriting it with null", async () => {
    const { host, tf } = createHost({ store: { auth: { v: 1, seed: "abcd", token: "old" } } });
    const store = createStore(tf);
    expect(await store.clearLegacyAuth()).toBe(true);
    expect(host.store.has(KEYS.auth)).toBe(true);
    expect(host.store.get(KEYS.auth)).toBeNull();
    expect(await store.clearLegacyAuth()).toBe(false);
    const fresh = createHost();
    expect(await createStore(fresh.tf).clearLegacyAuth()).toBe(false);
    expect(fresh.host.store.has(KEYS.auth)).toBe(false);
  });

  it("keeps working, and logs, when the store fails", async () => {
    const { host, tf } = createHost({ failStore: true });
    const store = createStore(tf);
    expect(await store.visible()).toBe(false);
    expect(await store.setVisible(true)).toBe(false);
    expect(await store.clearLegacyAuth()).toBe(false);
    expect(host.logs.some((l) => l.includes("store write visible failed"))).toBe(true);
  });
});

describe("activity trail", () => {
  it("keeps only allowed keys with plain values", () => {
    expect(
      cleanDetails({
        from: "playing",
        to: "x".repeat(50),
        volume: 40,
        ok: true,
        token: "secret",
        title: "My song",
        code: Number.NaN,
      }),
    ).toEqual({ from: "playing", to: "x".repeat(24), volume: 40, ok: true });
    expect(DETAIL_KEYS).not.toContain("token");
  });

  it("records known actions to the audit and the log, and drops unknown ones", async () => {
    const { host, tf } = createHost();
    const trail = createTrail(tf);
    trail.record("control.next", { ok: true, refreshToken: "secret" });
    trail.record("made.up", {});
    await drain();
    expect(host.audits).toEqual([{ action: "control.next", details: { ok: true } }]);
    expect(host.logs.join("\n")).not.toContain("secret");
    expect(ACTIONS).toEqual(expect.arrayContaining(["auth.connected", "auth.legacy-cleared"]));
    expect(ACTIONS).not.toContain("auth.rotated");
  });

  it("logs errors with their code", async () => {
    const { host, tf } = createHost();
    createTrail(tf).error(Object.assign(new Error("nope"), { code: "server" }));
    createTrail(tf).error("plain");
    await drain();
    expect(host.errors).toEqual(["server: nope", "plain"]);
  });

  it("never throws, even when the host does", () => {
    const tf = {
      audit: () => {
        throw new Error("x");
      },
      log: { info: () => Promise.reject(new Error("y")), error: () => {} },
    };
    expect(() => createTrail(tf).record("view.show", {})).not.toThrow();
  });
});

describe("poller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks at once, then after each delay", async () => {
    const tick = vi.fn(async () => {});
    const p = createPoller({ tick, delay: () => 1000 });
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(tick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000);
    expect(tick).toHaveBeenCalledTimes(5);
    p.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(5);
  });

  it("stops scheduling when the delay is null, and soon() starts it again", async () => {
    let delay = null;
    const tick = vi.fn(async () => {});
    const p = createPoller({ tick, delay: () => delay });
    p.start();
    await vi.advanceTimersByTimeAsync(10000);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(p.waiting).toBe(false);
    expect(p.running).toBe(true);
    delay = 2000;
    p.soon(0);
    await vi.advanceTimersByTimeAsync(MIN_WAIT_MS);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(p.waiting).toBe(true);
  });

  it("moves the next ask earlier with soon()", async () => {
    const tick = vi.fn(async () => {});
    const p = createPoller({ tick, delay: () => 5000 });
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    p.soon(800);
    await vi.advanceTimersByTimeAsync(800);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("never runs two asks at once", async () => {
    let release;
    const tick = vi.fn(() => new Promise((r) => (release = r)));
    const p = createPoller({ tick, delay: () => 1000 });
    p.start();
    p.soon(0);
    await vi.advanceTimersByTimeAsync(MIN_WAIT_MS * 4);
    expect(tick).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("reports a failing ask and carries on", async () => {
    const onError = vi.fn();
    const tick = vi.fn(async () => {
      throw new Error("boom");
    });
    const p = createPoller({ tick, delay: () => 1000, onError });
    p.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(p.running).toBe(true);
  });

  it("ignores soon() while stopped", async () => {
    const tick = vi.fn(async () => {});
    const p = createPoller({ tick, delay: () => 1000 });
    p.soon(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(tick).not.toHaveBeenCalled();
  });
});
