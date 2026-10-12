/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Session and view tests
 *
 * The game's state machine (start, pause, resume, top out, restore, play
 * time, gravity) against the stub engine, and the overlay view built from
 * it (items, banners, dimming, diffs, what a click means).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { svgOf } from "../../../examples/tilefall/src/render/svg.js";
import { createSession } from "../../../examples/tilefall/src/tile/session.js";
import {
  BOARD_ID,
  PANEL_ID,
  actionForClick,
  bannerFor,
  buttonId,
  diffItems,
  sceneItems,
} from "../../../examples/tilefall/src/tile/view.js";
import * as engine from "../support/engine-stub.js";
import { ONE_PANE, messagesOf } from "../support/fake-tf.js";

const en = messagesOf("en");
const t = (key, args = {}) => {
  const text = en.get(key);
  if (text === undefined) throw new Error(`no message ${key}`);
  return text.replace(/\{ \$(\w+) \}/g, (_, n) => String(args[n] ?? ""));
};

/** A session with recorders for its callbacks. */
function make() {
  const events = [];
  let changes = 0;
  const session = createSession({
    engine,
    onChange: () => changes++,
    onEvent: (e) => events.push(e),
  });
  return { session, events, changes: () => changes };
}

/** Fills the bottom two rows with five O pieces: drops at x = 0, 2, 4, 6, 8. */
function clearTwoRows(session) {
  for (const target of [0, 2, 4, 6, 8]) {
    const moves = target - 4;
    for (let i = 0; i < Math.abs(moves); i++) session.act(moves < 0 ? "left" : "right");
    session.act("hardDrop");
  }
}

describe("session", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts with no game", () => {
    const { session } = make();
    expect(session.status).toBe("none");
    expect(session.state()).toBeNull();
    expect(session.snapshot()).toBeNull();
    expect(session.act("left")).toBe(false);
    expect(session.pause()).toBe(false);
    expect(session.resume()).toBe(false);
  });

  it("starts a game at the chosen level and reports it", () => {
    const { session, events, changes } = make();
    session.newGame({ startLevel: 4 });
    expect(session.status).toBe("playing");
    expect(session.state().level).toBe(4);
    expect(events).toEqual([{ type: "start", level: 4 }]);
    expect(changes()).toBe(1);
  });

  it("runs moves only while playing", () => {
    const { session } = make();
    session.newGame();
    expect(session.act("left")).toBe(true);
    expect(session.act("rotate")).toBe(false); // the stub never rotates
    expect(session.act("nonsense")).toBe(false);
    session.pause();
    expect(session.act("left")).toBe(false);
  });

  it("pulls the piece down with gravity, faster at higher levels", () => {
    const { session } = make();
    session.newGame({ startLevel: 1 });
    vi.advanceTimersByTime(1000);
    expect(session.state().active.cells[0][1]).toBe(1);
    session.newGame({ startLevel: 9 });
    vi.advanceTimersByTime(600);
    expect(session.state().active.cells[0][1]).toBe(3);
  });

  it("stops gravity while paused and picks it up on resume", () => {
    const { session } = make();
    session.newGame();
    session.pause();
    expect(session.status).toBe("paused");
    vi.advanceTimersByTime(5000);
    expect(session.state().active.cells[0][1]).toBe(0);
    session.resume();
    vi.advanceTimersByTime(1000);
    expect(session.state().active.cells[0][1]).toBe(1);
  });

  it("reports cleared lines", () => {
    const { session, events } = make();
    session.newGame();
    clearTwoRows(session);
    expect(events.find((e) => e.type === "clear")).toEqual({ type: "clear", lines: 2 });
    expect(session.state().lines).toBe(2);
  });

  it("reports a level up", () => {
    const { session, events } = make();
    session.newGame();
    for (let i = 0; i < 5; i++) clearTwoRows(session);
    expect(events.find((e) => e.type === "level")).toEqual({ type: "level", level: 2 });
  });

  it("ends the game on a top out, stopping gravity and reporting the figures", () => {
    const { session, events } = make();
    session.newGame();
    vi.advanceTimersByTime(3000);
    for (let i = 0; i < 10; i++) session.act("hardDrop");
    expect(session.status).toBe("over");
    const over = events.find((e) => e.type === "over");
    expect(over).toMatchObject({ type: "over", lines: 0, level: 1, seconds: 3 });
    expect(over.score).toBeGreaterThan(0);
    expect(session.act("left")).toBe(false);
    expect(session.snapshot()).toBeNull();
    const before = session.state();
    vi.advanceTimersByTime(5000);
    expect(session.state()).toEqual(before);
  });

  it("counts play time only while playing", () => {
    const { session } = make();
    session.newGame();
    vi.advanceTimersByTime(4000);
    session.pause();
    vi.advanceTimersByTime(60000);
    expect(session.seconds()).toBe(4);
    session.resume();
    vi.advanceTimersByTime(2000);
    expect(session.seconds()).toBe(6);
  });

  it("snapshots a game and restores it paused, with its play time", () => {
    const { session } = make();
    session.newGame();
    session.act("left");
    vi.advanceTimersByTime(3000);
    const snap = session.snapshot();
    expect(snap.seconds).toBe(3);

    const other = make();
    expect(other.session.restore(snap)).toBe(true);
    expect(other.session.status).toBe("paused");
    expect(other.session.state()).toEqual(session.state());
    expect(other.session.seconds()).toBe(3);
  });

  it("refuses a broken or finished snapshot", () => {
    const { session } = make();
    expect(session.restore({ game: null })).toBe(false);
    expect(session.restore({ game: { board: "x" } })).toBe(false);
    const done = engine.createGame();
    for (let i = 0; i < 10; i++) done.hardDrop();
    expect(session.restore({ game: done.toJSON() })).toBe(false);
    expect(session.status).toBe("none");
  });

  it("gives a hard-dropped piece's successor a full gravity step", () => {
    const { session } = make();
    session.newGame();
    vi.advanceTimersByTime(900);
    session.act("hardDrop");
    vi.advanceTimersByTime(900);
    expect(session.state().active.cells[0][1]).toBe(0);
    vi.advanceTimersByTime(100);
    expect(session.state().active.cells[0][1]).toBe(1);
  });

  it("stops for good", () => {
    const { session } = make();
    session.newGame();
    session.stop();
    expect(session.status).toBe("paused");
    vi.advanceTimersByTime(5000);
    expect(session.state().active.cells[0][1]).toBe(0);
  });

  it("reports a gravity step that fails instead of throwing", () => {
    const errors = [];
    const broken = {
      ...engine,
      createGame: (o) => ({
        ...engine.createGame(o),
        tick: () => {
          throw new Error("tick failed");
        },
      }),
    };
    const session = createSession({ engine: broken, onError: (e) => errors.push(e.message) });
    session.newGame();
    vi.advanceTimersByTime(1000);
    expect(errors).toEqual(["tick failed"]);
  });

  it("has nothing to snapshot when the engine cannot save", () => {
    const plain = {
      ...engine,
      createGame: (o) => ({ ...engine.createGame(o), toJSON: undefined }),
    };
    const session = createSession({ engine: plain });
    session.newGame();
    expect(session.snapshot()).toBeNull();
  });
});

describe("view", () => {
  const settings = { ghost: true, size: "medium", corner: "bottom-right" };
  const input = (over = {}) => ({
    status: "none",
    state: null,
    best: 0,
    settings,
    layout: ONE_PANE,
    t,
    ...over,
  });

  it("builds eight clickable, labelled items within the limits", () => {
    const items = sceneItems(input());
    expect(items).toHaveLength(8);
    expect(new Set(items.map((i) => i.id)).size).toBe(8);
    for (const item of items) {
      expect(item.image.startsWith("data:image/svg+xml")).toBe(true);
      expect(item.hit).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.label.length).toBeLessThanOrEqual(80);
      expect(item.w).toBeLessThanOrEqual(256);
      expect(item.h).toBeLessThanOrEqual(256);
    }
    const total = items.reduce((n, i) => n + i.image.length, 0);
    expect(total).toBeLessThan(1_000_000);
  });

  it("shows the right banner for each status", () => {
    expect(bannerFor("none", t, "0")).toEqual({ title: "Tilefall", hint: "Click to play" });
    expect(bannerFor("paused", t, "0").title).toBe("Paused");
    expect(bannerFor("over", t, "1,234")).toEqual({
      title: "Game over",
      extra: "Score 1,234",
      hint: "Click for a new game",
    });
    expect(bannerFor("playing", t, "0")).toBeNull();
  });

  it("labels the board by status and dims moves unless playing", () => {
    const game = engine.createGame();
    const playing = sceneItems(input({ status: "playing", state: game.getState() }));
    expect(playing.find((i) => i.id === BOARD_ID).label).toBe("Tilefall board. Click to pause.");
    expect(svgOf(playing.find((i) => i.id === buttonId("left")).image)).toContain('opacity="1"');
    expect(playing.find((i) => i.id === buttonId("pause")).label).toBe("Pause");

    const paused = sceneItems(input({ status: "paused", state: game.getState() }));
    expect(svgOf(paused.find((i) => i.id === buttonId("left")).image)).toContain('opacity="0.35"');
    expect(svgOf(paused.find((i) => i.id === buttonId("pause")).image)).toContain('opacity="1"');
    expect(paused.find((i) => i.id === buttonId("pause")).label).toBe("Play");
  });

  it("shows the best score, or the current one when it is higher", () => {
    const state = { ...engine.createGame().getState(), score: 900 };
    const low = sceneItems(input({ status: "playing", state, best: 500, format: (n) => `#${n}` }));
    expect(svgOf(low.find((i) => i.id === PANEL_ID).image)).toContain("#900</text>");
    const high = sceneItems(
      input({ status: "playing", state, best: 5000, format: (n) => `#${n}` }),
    );
    expect(svgOf(high.find((i) => i.id === PANEL_ID).image)).toContain("#5000");
  });

  it("sends only what changed", () => {
    const game = engine.createGame();
    const a = sceneItems(input({ status: "playing", state: game.getState() }));
    expect(diffItems(a, a)).toEqual([]);
    game.moveLeft();
    const b = sceneItems(input({ status: "playing", state: game.getState() }));
    const d = diffItems(a, b);
    expect(d.map((i) => i.id)).toEqual([BOARD_ID]);
    expect(Object.keys(d[0]).sort()).toEqual(["id", "image"]);
  });

  it("sends new items whole", () => {
    const a = sceneItems(input());
    expect(diffItems(null, a)).toEqual(a);
    expect(diffItems(a.slice(1), a)[0]).toBe(a[0]);
  });

  it("moves everything when the corner changes", () => {
    const a = sceneItems(input());
    const b = sceneItems(input({ settings: { ...settings, corner: "top-left" } }));
    expect(diffItems(a, b)).toHaveLength(8);
  });

  it("knows what a click means", () => {
    expect(actionForClick(BOARD_ID, "none")).toBe("newGame");
    expect(actionForClick(BOARD_ID, "over")).toBe("newGame");
    expect(actionForClick(BOARD_ID, "playing")).toBe("pause");
    expect(actionForClick(BOARD_ID, "paused")).toBe("pause");
    expect(actionForClick(PANEL_ID, "playing")).toBe("hold");
    expect(actionForClick(buttonId("left"), "playing")).toBe("left");
    expect(actionForClick(buttonId("drop"), "playing")).toBe("hardDrop");
    expect(actionForClick(buttonId("down"), "playing")).toBe("softDrop");
    expect(actionForClick("stranger", "playing")).toBeNull();
  });
});
