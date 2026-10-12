/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile behaviour tests
 *
 * The whole tile against a fake Tilefold, the way a user meets it:
 * registration up front, showing and hiding, playing by command and by
 * click, gravity, pausing when the user looks away, sounds, the best
 * score, saving and resuming after a restart, settings that redraw at
 * once, and the activity trail. Uses the stub engine so every move is
 * predictable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { svgOf } from "../../../examples/tilefall/src/render/svg.js";
import { COMMANDS } from "../../../examples/tilefall/src/tile/commands.js";
import { registerSettings } from "../../../examples/tilefall/src/tile/settings.js";
import { runTilefall } from "../../../examples/tilefall/src/tile/run.js";
import { BOARD_ID, PANEL_ID, buttonId } from "../../../examples/tilefall/src/tile/view.js";
import * as engine from "../support/engine-stub.js";
import { ONE_PANE, createHost, drain } from "../support/fake-tf.js";

/** Starts the tile the way main.js does, with the stub engine. */
async function start(opts) {
  const { host, tf } = createHost(opts);
  registerSettings(tf);
  const handles = runTilefall(tf, engine);
  await drain();
  return { host, ...handles };
}

/** The decoded SVG of an item in the current scene. */
const svg = (host, id) => svgOf(host.item(id).image);

/** Drops five O pieces side by side, clearing the two bottom rows. */
async function clearTwoRows(host) {
  for (const target of [0, 2, 4, 6, 8]) {
    const moves = target - 4;
    for (let i = 0; i < Math.abs(moves); i++) await host.command(moves < 0 ? "left" : "right");
    await host.command("hard-drop");
  }
}

/** Stacks pieces in the middle until the game ends. */
async function topOut(host) {
  for (let i = 0; i < 10; i++) await host.command("hard-drop");
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("registration", () => {
  it("registers settings, commands and listeners before any await", () => {
    const { host, tf } = createHost();
    registerSettings(tf);
    runTilefall(tf, engine);
    // Synchronously, with nothing awaited yet:
    const kinds = host.regs.map((r) => r.kind);
    expect(kinds.filter((k) => k === "setting")).toHaveLength(6);
    expect(host.regs.filter((r) => r.kind === "command").map((r) => r.id)).toEqual(
      COMMANDS.map((c) => c.id),
    );
    expect(
      host.regs
        .filter((r) => r.kind === "hook")
        .map((r) => r.event)
        .sort(),
    ).toEqual(
      [
        "app.ready",
        "overlay.hidden",
        "overlay.layout",
        "overlay.pointer",
        "setting.changed",
        "user.idle",
        "window.blurred",
      ].sort(),
    );
  });

  it("gives every command its default shortcut", () => {
    const { host, tf } = createHost();
    runTilefall(tf, engine);
    const left = host.regs.find((r) => r.id === "left");
    expect(left.key).toEqual({ mac: "Ctrl+Alt+ArrowLeft", other: "Ctrl+Alt+ArrowLeft" });
    expect(left.title).toBe("Tilefall: Move left");
  });
});

describe("showing and hiding", () => {
  it("stays off screen until asked", async () => {
    const { host } = await start();
    await host.emit("app.ready");
    expect(host.overlay).toBeNull();
  });

  it("comes back on start when it was left on screen", async () => {
    const { host } = await start({ store: { visible: true } });
    await host.emit("app.ready");
    expect(host.overlay.items).toHaveLength(8);
    expect(svg(host, BOARD_ID)).toContain("Click to play");
  });

  it("shows and hides with the toggle command, remembering the choice", async () => {
    const { host } = await start();
    await host.command("toggle");
    expect(host.overlay.items).toHaveLength(8);
    expect(host.store.get("visible")).toBe(true);
    await host.command("toggle");
    expect(host.overlay).toBeNull();
    expect(host.store.get("visible")).toBe(false);
    expect(host.actions()).toEqual(["view.show", "view.hide"]);
  });

  it("pauses and saves the game when hidden, and shows it paused again", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.command("toggle");
    expect(session.status).toBe("paused");
    expect(host.store.get("snapshot").game).toBeTruthy();
    await host.command("toggle");
    expect(svg(host, BOARD_ID)).toContain("Paused");
    expect(session.status).toBe("paused");
  });

  it("places the game in the focused pane's corner and follows layout changes", async () => {
    const { host } = await start();
    await host.command("toggle");
    const before = host.item(BOARD_ID).x;
    await host.emit("overlay.layout", { ...ONE_PANE, panes: [{ ...ONE_PANE.panes[0], w: 800 }] });
    expect(host.item(BOARD_ID).x).toBe(before - 400);
  });
});

describe("playing", () => {
  it("starts a new game from the command, on screen", async () => {
    const { host, session } = await start({ settings: { startLevel: 3 } });
    await host.command("new-game");
    expect(session.status).toBe("playing");
    expect(session.state().level).toBe(3);
    expect(host.overlay.items).toHaveLength(8);
    expect(host.audits.find((a) => a.action === "game.start").details).toEqual({ level: 3 });
    expect(svg(host, BOARD_ID)).not.toContain("Click to play");
  });

  it("moves by command, sending only the board", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    host.updates.length = 0;
    await host.command("left");
    expect(session.state().active.cells[0][0]).toBe(3);
    expect(host.updates).toHaveLength(1);
    expect(host.updates[0].items.map((i) => i.id)).toEqual([BOARD_ID]);
  });

  it("moves by clicking the buttons, and holds by clicking the panel", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.click(buttonId("right"));
    expect(session.state().active.cells[0][0]).toBe(5);
    await host.click(buttonId("down"));
    expect(session.state().active.cells[0][1]).toBe(1);
    await host.click(PANEL_ID);
    expect(session.state().hold).toBe("O");
    await host.click(buttonId("drop"));
    expect(session.state().board[19][4]).toBe(2);
  });

  it("ignores clicks other than plain clicks, and unknown items", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.emit("overlay.pointer", { type: "dblclick", item: buttonId("left") });
    await host.emit("overlay.pointer", { type: "click", item: "stranger" });
    expect(session.state().active.cells[0][0]).toBe(4);
  });

  it("lets gravity pull the piece down", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.advance(3000);
    expect(session.state().active.cells[0][1]).toBe(3);
    expect(svg(host, BOARD_ID)).toContain(`y="${4 + 3 * 12}"`);
  });

  it("ignores moves while hidden or paused", async () => {
    const { host, session } = await start();
    await host.command("left");
    expect(session.status).toBe("none");
    await host.command("new-game");
    await host.command("pause");
    await host.command("left");
    expect(session.state().active.cells[0][0]).toBe(4);
  });

  it("plays a sound and saves when lines clear", async () => {
    const { host } = await start();
    await host.command("new-game");
    await clearTwoRows(host);
    expect(host.sounds).toHaveLength(1);
    expect(host.store.get("snapshot").game.lines).toBe(2);
    expect(svg(host, PANEL_ID)).toContain("Lines 2");
  });

  it("stays quiet with sounds off", async () => {
    const { host } = await start({ settings: { sounds: false } });
    await host.command("new-game");
    await clearTwoRows(host);
    await topOut(host);
    expect(host.sounds).toHaveLength(0);
  });
});

describe("pausing", () => {
  it("pauses and resumes by clicking the board, recording why", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.click(BOARD_ID);
    expect(session.status).toBe("paused");
    expect(svg(host, BOARD_ID)).toContain("Paused");
    expect(host.item(BOARD_ID).label).toBe("Tilefall board, paused. Click to resume.");
    expect(host.store.get("snapshot")).toBeTruthy();
    await host.click(BOARD_ID);
    expect(session.status).toBe("playing");
    const pause = host.audits.find((a) => a.action === "game.pause");
    expect(pause.details).toMatchObject({ reason: "user", score: 0, lines: 0, level: 1 });
    expect(host.actions()).toContain("game.resume");
  });

  it("pauses with the pause button, which then shows play", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.click(buttonId("pause"));
    expect(session.status).toBe("paused");
    expect(host.item(buttonId("pause")).label).toBe("Play");
  });

  it("starts a game from the pause command when there is none", async () => {
    const { host, session } = await start();
    await host.command("toggle");
    await host.command("pause");
    expect(session.status).toBe("playing");
  });

  it("shows the game from the pause command when it is hidden", async () => {
    const { host, session } = await start();
    await host.command("pause");
    expect(host.overlay).not.toBeNull();
    expect(session.status).toBe("none");
  });

  it("pauses when you switch apps, unless turned off", async () => {
    const a = await start();
    await a.host.command("new-game");
    await a.host.emit("window.blurred");
    expect(a.session.status).toBe("paused");
    expect(a.host.audits.find((x) => x.action === "game.pause").details.reason).toBe("blur");

    const b = await start({ settings: { pauseOnBlur: false } });
    await b.host.command("new-game");
    await b.host.emit("window.blurred");
    expect(b.session.status).toBe("playing");
  });

  it("pauses when you go idle and never resumes by itself", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.emit("user.idle", { minutes: 5 });
    expect(session.status).toBe("paused");
    await host.emit("user.active");
    await host.emit("window.focused");
    expect(session.status).toBe("paused");
  });

  it("pauses when overlays are hidden and redraws whole when they return", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.emit("overlay.hidden");
    expect(session.status).toBe("paused");
    const shows = host.shows;
    await host.command("pause");
    expect(host.shows).toBe(shows + 1);
    expect(session.status).toBe("playing");
  });

  it("keeps the game paused while the user has overlays off", async () => {
    const { host, session } = await start({ overlaysOff: true });
    await host.command("new-game");
    expect(session.status).toBe("paused");
    expect(host.overlay).toBeNull();
    host.overlaysOff = false;
    await host.command("pause");
    expect(host.overlay.items).toHaveLength(8);
    expect(session.status).toBe("playing");
  });
});

describe("game over and the best score", () => {
  it("ends the game, records it, and keeps the best score", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await host.advance(2000);
    await topOut(host);
    expect(session.status).toBe("over");
    expect(svg(host, BOARD_ID)).toContain("Game over");
    const score = session.state().score;
    expect(host.store.get("best")).toBe(score);
    expect(host.store.get("stats")).toEqual({ games: 1, lines: 0, seconds: 2 });
    expect(host.store.get("snapshot")).toBeNull();
    expect(host.sounds).toHaveLength(1);
    const over = host.audits.find((a) => a.action === "game.over");
    expect(over.details).toEqual({ score, lines: 0, level: 1, seconds: 2, best: true });
    expect(host.actions()).toContain("best.new");
  });

  it("does not claim a new best when it is not one", async () => {
    const { host } = await start({ store: { best: 999999 } });
    await host.command("new-game");
    await topOut(host);
    expect(host.store.get("best")).toBe(999999);
    expect(host.audits.find((a) => a.action === "game.over").details.best).toBe(false);
    expect(host.actions()).not.toContain("best.new");
    expect(svg(host, PANEL_ID)).toContain("999,999");
  });

  it("starts again when the finished board is clicked", async () => {
    const { host, session } = await start();
    await host.command("new-game");
    await topOut(host);
    await host.click(BOARD_ID);
    expect(session.status).toBe("playing");
    expect(session.state().score).toBe(0);
  });
});

describe("saving and resuming", () => {
  it("resumes a saved game, paused, after a restart", async () => {
    const first = await start();
    await first.host.command("new-game");
    await first.host.command("left");
    await first.host.command("pause");
    const saved = Object.fromEntries(first.host.store);

    const again = await start({ store: saved });
    await again.host.emit("app.ready");
    expect(again.session.status).toBe("paused");
    expect(again.session.state().active.cells[0][0]).toBe(3);
    expect(again.host.overlay.items).toHaveLength(8);
    expect(again.host.actions()).toContain("game.restore");
  });

  it("revives on the first command when no app.ready comes", async () => {
    const first = await start();
    await first.host.command("new-game");
    await first.host.command("pause");
    const again = await start({ store: Object.fromEntries(first.host.store) });
    await again.host.command("pause");
    expect(again.session.status).toBe("paused");
    expect(again.host.overlay).not.toBeNull();
    await again.host.command("pause");
    expect(again.session.status).toBe("playing");
  });

  it("ignores a damaged save", async () => {
    const { host, session } = await start({
      store: { snapshot: { v: 1, game: { board: 5 } }, visible: true },
    });
    await host.emit("app.ready");
    expect(session.status).toBe("none");
    expect(host.overlay.items).toHaveLength(8);
  });

  it("plays on when the store is broken", async () => {
    const { host, session } = await start({ failStore: true });
    await host.command("new-game");
    await host.command("left");
    await topOut(host);
    expect(session.status).toBe("over");
    expect(host.errors).toEqual([]);
  });
});

describe("settings", () => {
  it("moves the game when the corner changes", async () => {
    const { host } = await start();
    await host.command("toggle");
    const x = host.item(BOARD_ID).x;
    await host.setSetting("corner", "top-left");
    expect(host.item(BOARD_ID).x).toBeLessThan(x);
    expect(host.item(BOARD_ID).y).toBe(40 + 12);
  });

  it("shrinks the game for the small size", async () => {
    const { host } = await start();
    await host.command("toggle");
    await host.setSetting("size", "small");
    expect(host.item(BOARD_ID).w).toBe(96);
  });

  it("hides the ghost at once when turned off", async () => {
    const { host } = await start();
    await host.command("new-game");
    expect(svg(host, BOARD_ID)).toContain('stroke-opacity="0.55"');
    await host.setSetting("ghost", false);
    expect(svg(host, BOARD_ID)).not.toContain('stroke-opacity="0.55"');
  });

  it("does nothing on a setting change while hidden", async () => {
    const { host } = await start();
    await host.setSetting("corner", "top-left");
    expect(host.overlay).toBeNull();
  });
});

describe("robustness", () => {
  it("logs a failing draw and shows the scene whole next time", async () => {
    const { host } = await start();
    await host.command("new-game");
    host.overlay = null; // the window lost the scene
    await host.command("left");
    expect(host.errors.some((e) => e.includes("show the overlay"))).toBe(true);
    const shows = host.shows;
    await host.command("left");
    expect(host.shows).toBe(shows + 1);
  });

  it("keeps working when the layout cannot be read", async () => {
    const { host, tf } = createHost();
    tf.overlay.layout = async () => {
      throw new Error("no layout");
    };
    registerSettings(tf);
    runTilefall(tf, engine);
    await host.command("toggle");
    expect(host.overlay.items).toHaveLength(8);
  });
});
