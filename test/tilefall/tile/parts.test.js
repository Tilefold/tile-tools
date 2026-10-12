/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile part tests
 *
 * The pieces of the tile that need no running game: layout geometry,
 * settings, the command table, sounds, saved data, the activity trail and
 * the gravity loop.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOARD_H, BOARD_W } from "../../../examples/tilefall/src/render/board.js";
import { ACTIONS, cleanDetails, createTrail } from "../../../examples/tilefall/src/tile/audit.js";
import { COMMANDS, registerCommands } from "../../../examples/tilefall/src/tile/commands.js";
import { MIN_STEP_MS, createLoop } from "../../../examples/tilefall/src/tile/loop.js";
import {
  CORNERS,
  KEYPAD_GAP,
  MARGIN,
  areaOf,
  computeLayout,
  cornerOf,
  groupSize,
  homePane,
  scaleOf,
} from "../../../examples/tilefall/src/tile/scene.js";
import {
  SETTINGS,
  clampInt,
  readSettings,
  registerSettings,
} from "../../../examples/tilefall/src/tile/settings.js";
import {
  RATE,
  clearSound,
  createSounds,
  samplesFor,
  sweep,
  wavUrl,
} from "../../../examples/tilefall/src/tile/sound.js";
import {
  EMPTY_STATS,
  KEYS,
  SNAPSHOT_VERSION,
  createStore,
} from "../../../examples/tilefall/src/tile/store.js";
import { ONE_PANE, createHost, messagesOf } from "../support/fake-tf.js";

describe("scene layout", () => {
  it("picks the focused pane, else the first, else none", () => {
    const a = { id: "a" };
    const b = { id: "b", focused: true };
    expect(homePane({ panes: [a, b] })).toBe(b);
    expect(homePane({ panes: [a] })).toBe(a);
    expect(homePane({ panes: [] })).toBeNull();
    expect(homePane(null)).toBeNull();
  });

  it("stops the area at the Composer", () => {
    expect(areaOf(ONE_PANE)).toEqual({ x: 0, y: 40, w: 1200, h: 684 });
  });

  it("uses the window, or a default, without panes", () => {
    expect(areaOf({ content: { w: 900, h: 500 }, panes: [] })).toEqual({
      x: 0,
      y: 0,
      w: 900,
      h: 500,
    });
    expect(areaOf(null)).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it("falls back to medium and bottom-right for unknown values", () => {
    expect(scaleOf("huge")).toBe(1);
    expect(scaleOf("small")).toBe(0.75);
    expect(cornerOf("middle")).toBe("bottom-right");
    expect(cornerOf("top-left")).toBe("top-left");
  });

  it("makes the keypad end level with the board", () => {
    expect(KEYPAD_GAP).toBeGreaterThan(0);
  });

  it("places the group in the bottom-right corner above the Composer by default", () => {
    const r = computeLayout(ONE_PANE);
    const g = groupSize(1);
    expect(r.board.x + r.board.w).toBe(1200 - MARGIN);
    expect(r.board.y + r.board.h).toBe(724 - MARGIN);
    expect(r.panel.x).toBe(1200 - MARGIN - g.w);
    expect(r.board).toMatchObject({ w: BOARD_W, h: BOARD_H });
  });

  it("puts the board on the outer side in the left corners", () => {
    const r = computeLayout(ONE_PANE, { corner: "top-left" });
    expect(r.board.x).toBe(MARGIN);
    expect(r.board.y).toBe(40 + MARGIN);
    expect(r.panel.x).toBeGreaterThan(r.board.x + r.board.w);
  });

  it("gives every item a rectangle within 256 px and inside the window", () => {
    for (const corner of CORNERS) {
      for (const size of ["small", "medium"]) {
        const r = computeLayout(ONE_PANE, { corner, size });
        expect(Object.keys(r)).toHaveLength(8);
        for (const rect of Object.values(r)) {
          expect(rect.w).toBeLessThanOrEqual(256);
          expect(rect.h).toBeLessThanOrEqual(256);
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.w).toBeLessThanOrEqual(1200);
          expect(rect.y + rect.h).toBeLessThanOrEqual(800);
        }
      }
    }
  });

  it("keeps buttons from overlapping each other or the panel", () => {
    const r = computeLayout(ONE_PANE);
    const boxes = Object.entries(r).filter(([id]) => id !== "board");
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [, a] = boxes[i];
        const [, b] = boxes[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${boxes[i][0]} and ${boxes[j][0]}`).toBe(false);
      }
    }
  });

  it("scales down for the small size", () => {
    const r = computeLayout(ONE_PANE, { size: "small" });
    expect(r.board.w).toBe(Math.round(BOARD_W * 0.75));
    expect(r["btn-left"].w).toBe(Math.round(26 * 0.75));
  });

  it("never goes off-screen in a pane smaller than the game", () => {
    const tiny = {
      content: { w: 100, h: 100 },
      panes: [{ id: "p", x: 0, y: 0, w: 100, h: 100, focused: true }],
    };
    const r = computeLayout(tiny);
    for (const rect of Object.values(r)) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("settings", () => {
  it("registers every setting with a translated description and choices", () => {
    const { host, tf } = createHost();
    registerSettings(tf);
    const regs = host.regs.filter((r) => r.kind === "setting");
    expect(regs.map((r) => r.key)).toEqual(SETTINGS.map((s) => s.key));
    const size = regs.find((r) => r.key === "size");
    expect(size.choices).toEqual([
      { value: "medium", label: "Medium" },
      { value: "small", label: "Small" },
    ]);
    const corner = regs.find((r) => r.key === "corner");
    expect(corner.choices.map((c) => c.value)).toEqual(CORNERS);
    expect(regs.find((r) => r.key === "ghost").choices).toBeUndefined();
  });

  it("has every default among its choices", () => {
    for (const s of SETTINGS.filter((x) => x.choices)) {
      expect(s.choices.map((c) => c.value)).toContain(s.default);
    }
  });

  it("clamps whole numbers", () => {
    expect(clampInt("7", 1, 15, 1)).toBe(7);
    expect(clampInt(99, 1, 15, 1)).toBe(15);
    expect(clampInt(-3, 1, 15, 1)).toBe(1);
    expect(clampInt("abc", 1, 15, 4)).toBe(4);
    expect(clampInt(2.6, 1, 15, 1)).toBe(3);
  });

  it("reads clean values whatever is stored", () => {
    const values = {
      startLevel: "40",
      ghost: false,
      sounds: "yes",
      size: "giant",
      corner: "nowhere",
      pauseOnBlur: false,
    };
    expect(readSettings({ get: (k) => values[k] })).toEqual({
      startLevel: 15,
      ghost: false,
      sounds: true,
      size: "medium",
      corner: "bottom-right",
      pauseOnBlur: false,
    });
  });

  it("falls back to defaults when reading throws", () => {
    const s = readSettings({
      get: () => {
        throw new Error("boom");
      },
    });
    expect(s).toMatchObject({ startLevel: 1, ghost: true, size: "medium" });
  });
});

describe("commands", () => {
  it("have unique ids, titles that exist in English and Ctrl+Alt keys", () => {
    const en = messagesOf("en");
    expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(COMMANDS.length);
    for (const c of COMMANDS) {
      expect(en.has(c.title), c.title).toBe(true);
      for (const key of [c.key.mac, c.key.other]) {
        expect(key).toMatch(/^Ctrl\+Alt\+[A-Z0-9]|^Ctrl\+Alt\+(Arrow(Up|Down|Left|Right)|Enter)$/);
        expect(key.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it("never use the same keys twice", () => {
    const mac = COMMANDS.map((c) => c.key.mac);
    expect(new Set(mac).size).toBe(mac.length);
  });

  it("stay off macOS's input-source shortcut and Tilefold's overlay toggle", () => {
    const keys = COMMANDS.flatMap((c) => [c.key.mac, c.key.other]);
    expect(keys).not.toContain("Ctrl+Alt+Space");
    expect(keys).not.toContain("Ctrl+Alt+O");
  });

  it("register with ids and run their action", () => {
    const { host, tf } = createHost();
    const ran = [];
    registerCommands(tf, (a) => ran.push(a));
    const regs = host.regs.filter((r) => r.kind === "command");
    expect(regs.map((r) => r.id)).toEqual(COMMANDS.map((c) => c.id));
    expect(regs[0].title).toBe("Tilefall: New game");
    return host.command("hard-drop").then(() => expect(ran).toEqual(["hardDrop"]));
  });
});

describe("sounds", () => {
  it("packs samples into a valid WAV data URL", () => {
    const url = wavUrl([0, 0.5, -0.5, 2, -2]);
    expect(url.startsWith("data:audio/wav;base64,")).toBe(true);
    const bytes = Buffer.from(url.split(",")[1], "base64");
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(bytes.toString("ascii", 8, 12)).toBe("WAVE");
    expect(bytes.readUInt32LE(24)).toBe(RATE);
    expect(bytes.readUInt32LE(40)).toBe(10);
    // Clipped to the 16-bit range.
    expect(bytes.readInt16LE(44 + 3 * 2)).toBe(32767);
    expect(bytes.readInt16LE(44 + 4 * 2)).toBe(-32767);
  });

  it("makes tones of the right length that start and end quietly", () => {
    const s = sweep(440, 880, 100);
    expect(s).toHaveLength(Math.round(RATE * 0.1));
    expect(Math.abs(s[0])).toBeLessThan(0.01);
    expect(Math.abs(s[s.length - 1])).toBeLessThan(0.01);
    expect(Math.max(...s.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it("has every named sound, and silence for unknown names", () => {
    for (const name of ["clear1", "clear2", "clear3", "clear4", "over"]) {
      expect(samplesFor(name).length).toBeGreaterThan(1000);
    }
    expect(samplesFor("nope")).toEqual([]);
  });

  it("picks the clear sound by lines", () => {
    expect(clearSound(1)).toBe("clear1");
    expect(clearSound(4)).toBe("clear4");
    expect(clearSound(9)).toBe("clear4");
    expect(clearSound(0)).toBe("clear1");
    expect(clearSound("x")).toBe("clear1");
  });

  it("plays through tf only when enabled, building each clip once", async () => {
    const { host, tf } = createHost();
    let on = true;
    const sounds = createSounds(tf, () => on);
    sounds.play("clear1");
    sounds.play("clear1");
    await Promise.resolve();
    expect(host.sounds).toHaveLength(2);
    expect(host.sounds[0].src).toBe(host.sounds[1].src);
    on = false;
    sounds.play("over");
    expect(host.sounds).toHaveLength(2);
  });

  it("stays quiet when the host has no sound", () => {
    const sounds = createSounds({ sound: null }, () => true);
    expect(() => sounds.play("over")).not.toThrow();
  });
});

describe("saved data", () => {
  it("keeps the best score only when beaten", async () => {
    const { host, tf } = createHost();
    const store = createStore(tf);
    expect(await store.best()).toBe(0);
    expect(await store.offerBest(500)).toBe(true);
    expect(await store.offerBest(300)).toBe(false);
    expect(await store.offerBest(500)).toBe(false);
    expect(host.store.get(KEYS.best)).toBe(500);
  });

  it("reads damaged values as defaults", async () => {
    const { tf } = createHost({
      store: { best: "lots", stats: "nope", snapshot: { v: 99, game: {} }, visible: "yes" },
    });
    const store = createStore(tf);
    expect(await store.best()).toBe(0);
    expect(await store.stats()).toEqual(EMPTY_STATS);
    expect(await store.snapshot()).toBeNull();
    expect(await store.visible()).toBe(false);
  });

  it("adds finished games to the totals", async () => {
    const { tf } = createHost({ store: { stats: { games: 2, lines: 10, seconds: 60 } } });
    const store = createStore(tf);
    expect(await store.addGame(5, 30.7)).toEqual({ games: 3, lines: 15, seconds: 90 });
    expect(await store.stats()).toEqual({ games: 3, lines: 15, seconds: 90 });
  });

  it("saves, reads and forgets a snapshot without deleting the key", async () => {
    const { host, tf } = createHost();
    const store = createStore(tf);
    await store.saveSnapshot({ score: 7 }, 12);
    expect(await store.snapshot()).toEqual({
      v: SNAPSHOT_VERSION,
      game: { score: 7 },
      seconds: 12,
    });
    await store.clearSnapshot();
    expect(await store.snapshot()).toBeNull();
    expect(host.store.has(KEYS.snapshot)).toBe(true);
  });

  it("remembers visibility", async () => {
    const { tf } = createHost();
    const store = createStore(tf);
    await store.setVisible(true);
    expect(await store.visible()).toBe(true);
  });

  it("carries on when the store fails, logging why", async () => {
    const { host, tf } = createHost({ failStore: true });
    const store = createStore(tf);
    expect(await store.best()).toBe(0);
    expect(await store.offerBest(10)).toBe(true);
    expect(await store.setVisible(true)).toBe(false);
    expect(host.logs.some((l) => l.includes("store"))).toBe(true);
  });
});

describe("activity trail", () => {
  it("keeps only plain, short values", () => {
    expect(
      cleanDetails({ a: 1, b: true, c: "x".repeat(99), d: { nested: 1 }, e: NaN, f: null }),
    ).toEqual({ a: 1, b: true, c: "x".repeat(40) });
    expect(cleanDetails(undefined)).toEqual({});
  });

  it("records known actions to the audit log and the tile log", async () => {
    const { host, tf } = createHost();
    const trail = createTrail(tf);
    trail.record("game.start", { level: 3 });
    trail.record("made.up", {});
    await Promise.resolve();
    expect(host.audits).toEqual([{ action: "game.start", details: { level: 3 } }]);
    expect(host.logs[0]).toContain("game.start");
    expect(ACTIONS).toContain("game.over");
  });

  it("never throws, even when the app's calls do", () => {
    const boom = () => {
      throw new Error("down");
    };
    const trail = createTrail({ audit: boom, log: { info: boom, error: boom } });
    expect(() => trail.record("game.start")).not.toThrow();
    expect(() => trail.info("x")).not.toThrow();
    expect(() => trail.error(new Error("y"))).not.toThrow();
  });

  it("logs errors by message", async () => {
    const { host, tf } = createHost();
    createTrail(tf).error(new Error("bad thing"));
    await Promise.resolve();
    expect(host.errors).toEqual(["bad thing"]);
  });
});

describe("gravity loop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("steps at the delay it is given, re-reading it every step", () => {
    let delay = 100;
    const steps = [];
    const loop = createLoop({ step: () => steps.push(Date.now()), delay: () => delay });
    loop.start();
    vi.advanceTimersByTime(250);
    expect(steps).toHaveLength(2);
    delay = 50;
    vi.advanceTimersByTime(100);
    expect(steps).toHaveLength(4);
  });

  it("stops at once and starts only once", () => {
    let n = 0;
    const loop = createLoop({ step: () => n++, delay: () => 100 });
    loop.start();
    loop.start();
    vi.advanceTimersByTime(100);
    expect(n).toBe(1);
    loop.stop();
    expect(loop.running).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(n).toBe(1);
  });

  it("restarts the wait from now", () => {
    let n = 0;
    const loop = createLoop({ step: () => n++, delay: () => 100 });
    loop.start();
    vi.advanceTimersByTime(90);
    loop.restart();
    vi.advanceTimersByTime(90);
    expect(n).toBe(0);
    vi.advanceTimersByTime(10);
    expect(n).toBe(1);
    loop.stop();
    loop.restart();
    vi.advanceTimersByTime(500);
    expect(n).toBe(1);
  });

  it("keeps the delay sane", () => {
    let n = 0;
    const loop = createLoop({ step: () => n++, delay: () => 0 });
    loop.start();
    vi.advanceTimersByTime(MIN_STEP_MS * 3);
    expect(n).toBe(3);
    loop.stop();
    const odd = createLoop({ step: () => n++, delay: () => NaN });
    n = 0;
    odd.start();
    vi.advanceTimersByTime(999);
    expect(n).toBe(0);
    vi.advanceTimersByTime(1);
    expect(n).toBe(1);
  });

  it("reports a step that throws and keeps going", () => {
    let n = 0;
    const errors = [];
    const loop = createLoop({
      step: () => {
        n++;
        throw new Error("x");
      },
      delay: () => 100,
      onError: (err) => errors.push(err.message),
    });
    loop.start();
    vi.advanceTimersByTime(300);
    expect(n).toBe(3);
    expect(errors).toEqual(["x", "x", "x"]);
  });

  it("uses the timers it is given", () => {
    const pending = [];
    const loop = createLoop({
      step: () => {},
      delay: () => 100,
      setTimer: (fn, ms) => pending.push({ fn, ms }) - 1,
      clearTimer: () => {},
    });
    loop.start();
    expect(pending).toEqual([{ fn: expect.any(Function), ms: 100 }]);
  });
});
