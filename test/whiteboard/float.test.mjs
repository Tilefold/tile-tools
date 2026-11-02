// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — 3D scenes floating over the board
 *
 * A 3D scene floats over the board in a window the user moves by its bar.
 * The board keeps where they dropped it (inside the board, the scene's
 * size kept, whole units), marks it as theirs so the agent drawing it
 * again doesn't move it back, and ignores anything else a page might send.
 * The tile keeps a move and logs one word, never where, and drops a flood
 * of them. The window: a drag of its bar moves only it until it's dropped,
 * a click on the bar points at the scene, the arrow keys move it in steps
 * (and don't step the explanation), folding pauses its view, and a move
 * alone never makes the view again. The agent's title is only ever text.
 */
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describe as describeBoard,
  draw,
  emptyBoard,
  move,
  show,
} from "../../examples/whiteboard/src/board.js";
import { checkShape } from "../../examples/whiteboard/src/scene.js";
import { createGlLayer } from "../../examples/whiteboard/page-src/glLayer.js";
import { BIG_STEP, CLICK_WAIT_MS, KEY_STEP } from "../../examples/whiteboard/page-src/floatView.js";
import { MOVES_PER_WINDOW } from "../../examples/whiteboard/src/run.js";
import { startTile } from "../fake-host.mjs";

const CUBE = {
  kind: "scene3d",
  id: "cube",
  x: 600,
  y: 60,
  w: 300,
  h: 260,
  label: "A cube",
  objects: [{ kind: "box", at: [0, 0, 0], color: "blue", label: "box" }],
};

/** A board with content, the cube, and an arrow pointing at it. */
function cubeBoard() {
  const b = show(emptyBoard(), { text: "a\nb\nc" });
  return draw(b, {
    shapes: [CUBE, { kind: "arrow", id: "to", from: { line: 2 }, to: { shape: "cube" } }],
  }).board;
}
const cubeOf = (b) => b.shapes.find((s) => s.id === "cube");

describe("moving a 3D scene on the board", () => {
  it("keeps where the user put it, as theirs, and arrows follow", () => {
    const b = cubeBoard();
    const before = describeBoard(b).shapes.find((s) => s.id === "to").ends;
    const next = move(b, { id: "cube", x: 120.4, y: 300.6 });
    expect(cubeOf(next)).toMatchObject({ x: 120, y: 301, w: 300, h: 260, moved: true });
    expect(next.revision).toBe(b.revision + 1);
    expect(cubeOf(b)).toMatchObject({ x: 600, y: 60 });
    const after = describeBoard(next).shapes.find((s) => s.id === "to").ends;
    expect(after).not.toEqual(before);
  });

  it("keeps the whole scene inside the board", () => {
    const b = cubeBoard();
    expect(cubeOf(move(b, { id: "cube", x: 5000, y: -40 }))).toMatchObject({ x: 700, y: 0 });
    expect(cubeOf(move(b, { id: "cube", x: -9, y: 1e9 }))).toMatchObject({ x: 0, y: 6000 - 260 });
  });

  it("ignores what isn't a move of a 3D scene", () => {
    const b = draw(cubeBoard(), {
      shapes: [{ kind: "note", id: "n", x: 10, y: 10, text: "hi" }],
    }).board;
    for (const bad of [
      { id: "n", x: 1, y: 1 },
      { id: "nope", x: 1, y: 1 },
      { id: "cube", x: "1", y: 1 },
      { id: "cube", x: Number.NaN, y: 1 },
      { id: "cube", x: 1, y: Number.POSITIVE_INFINITY },
      { id: ["cube"], x: 1, y: 1 },
      { id: "cube", x: 600, y: 60 },
      null,
    ]) {
      expect(move(b, bad)).toBe(b);
    }
  });

  it("stays where the user put it when the agent draws it again", () => {
    const b = move(cubeBoard(), { id: "cube", x: 40, y: 400 });
    const again = draw(b, { shapes: [{ ...CUBE, x: 650, y: 10, label: "Now with a lid" }] }).board;
    expect(cubeOf(again)).toMatchObject({ x: 40, y: 400, moved: true, label: "Now with a lid" });
    // A scene the user never moved goes where the agent says.
    const fresh = draw(cubeBoard(), { shapes: [{ ...CUBE, x: 650, y: 10 }] }).board;
    expect(cubeOf(fresh)).toMatchObject({ x: 650, y: 10 });
    expect(cubeOf(fresh).moved).toBeUndefined();
  });

  it("never takes `moved` from the agent", () => {
    expect(checkShape({ ...CUBE, moved: true }).moved).toBeUndefined();
  });

  it("tells the agent the user can move scenes", () => {
    expect(describeBoard(cubeBoard()).how.join(" ")).toMatch(/moved: true/);
  });
});

describe("the tile keeps moves", () => {
  const DIR = fileURLToPath(new URL("../../examples/whiteboard/", import.meta.url));
  const hosts = [];
  afterEach(() => {
    for (const h of hosts.splice(0)) {
      // Where a scene went never reaches the activity log.
      expect(JSON.stringify(h.audits)).not.toMatch(/\d{2,}/);
    }
  });
  const start = async () => {
    const host = await startTile(DIR, { page: "side", theme: { mode: "dark", colors: {} } });
    hosts.push(host);
    await host.command("show", { text: "a\nb" });
    await host.command("draw", { shapes: [CUBE] });
    return host;
  };
  const say = (host, message) => host.emit("page.message", { message });
  const kept = (host) => cubeOf(host.store.get("board"));

  it("keeps a move from the page, sends the board back and logs one word", async () => {
    const host = await start();
    await say(host, { type: "move", id: "cube", x: 30, y: 200 });
    expect(kept(host)).toMatchObject({ x: 30, y: 200, moved: true });
    const sent = host.page.posted.filter((m) => m.board).at(-1).board;
    expect(cubeOf(sent)).toMatchObject({ x: 30, y: 200 });
    expect(host.audits.at(-1)).toEqual({ action: "moved", details: undefined });
    // A move to where it already is changes and logs nothing.
    const n = host.audits.length;
    await say(host, { type: "move", id: "cube", x: 30, y: 200 });
    expect(host.audits.length).toBe(n);
    const read = await host.command("read", {});
    expect(read.shapes.find((s) => s.id === "cube")).toMatchObject({ x: 30, moved: true });
  });

  it("drops a flood of moves", async () => {
    const host = await start();
    for (let i = 0; i < MOVES_PER_WINDOW + 15; i++) {
      await say(host, { type: "move", id: "cube", x: i, y: 100 });
    }
    expect(host.audits.filter((a) => a.action === "moved").length).toBe(MOVES_PER_WINDOW);
    expect(kept(host).x).toBe(MOVES_PER_WINDOW - 1);
  });
});

describe("the floating window", () => {
  const windows = [];
  afterEach(() => {
    vi.useRealTimers();
    for (const w of windows.splice(0)) w.close();
  });

  /** A layer in a jsdom page, with fake views that record what's done to them. */
  function layer() {
    const dom = new JSDOM(
      '<div class="scroller"><svg id="board" viewBox="0 0 1000 800"></svg></div>',
      { pretendToBeVisual: true },
    );
    const w = dom.window;
    windows.push(w);
    const doc = w.document;
    const made = [];
    const picks = [];
    const moves = [];
    const gl = createGlLayer({
      doc,
      svg: doc.getElementById("board"),
      labels: () => ({
        hint: "Drag to turn",
        move: "Drag to move",
        fold: "Fold away",
        unfold: "Show again",
        untitled: "3D view",
      }),
      cameras: new Map(),
      onPick: (id, part) => picks.push([id, part]),
      onMove: (id, x, y) => moves.push([id, x, y]),
      makeView: (_doc, body, shape) => {
        const v = { shape, body, paused: [], disposed: false, sizes: [] };
        made.push(v);
        return {
          resize: (a, b) => v.sizes.push([a, b]),
          highlight: (part) => (v.part = part),
          pause: (on) => v.paused.push(on),
          setMarking: () => {},
          clearMark: () => {},
          dispose: () => (v.disposed = true),
        };
      },
    });
    const host = () => doc.querySelector(".gl-host");
    const grip = () => doc.querySelector(".float-grip");
    // jsdom has no PointerEvent: pointer events are mouse events here.
    const fire = (node, type, x = 0, y = 0) =>
      node.dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    return { w, doc, gl, made, picks, moves, host, grip, fire };
  }

  it("floats the scene at its place, titled with the agent's words as text", () => {
    const l = layer();
    l.gl.sync([{ ...CUBE, label: "<img src=x onerror=alert(1)>" }]);
    expect(l.made).toHaveLength(1);
    expect(l.host().style.transform).toBe("translate(600px, 60px)");
    expect(l.doc.querySelector(".float-title").textContent).toBe("<img src=x onerror=alert(1)>");
    expect(l.doc.querySelector("img")).toBeNull();
    l.gl.sync([{ ...CUBE, label: undefined }]);
    expect(l.doc.querySelector(".float-title").textContent).toBe("3D view");
  });

  it("moves only the window while dragged, and tells where it was dropped", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    l.fire(l.grip(), "pointerdown", 10, 10);
    l.fire(l.grip(), "pointermove", 60, 110);
    expect(l.host().style.transform).toBe("translate(650px, 160px)");
    expect(l.host().classList.contains("moving")).toBe(true);
    expect(l.moves).toEqual([]);
    l.fire(l.grip(), "pointermove", 1000, 2000);
    l.fire(l.grip(), "pointerup", 1000, 2000);
    l.fire(l.grip(), "click", 1000, 2000);
    // Kept on the board: right and bottom edges inside it.
    expect(l.moves).toEqual([["cube", 700, 540]]);
    expect(l.picks).toEqual([]);
    // Until the board comes back with the move, the window stays where it was dropped.
    l.gl.sync([CUBE]);
    expect(l.host().style.transform).toBe("translate(700px, 540px)");
    l.gl.sync([{ ...CUBE, x: 700, y: 540, moved: true }]);
    l.gl.sync([{ ...CUBE, x: 20, y: 20, moved: true }]);
    expect(l.host().style.transform).toBe("translate(20px, 20px)");
    // A move alone never makes the view again.
    expect(l.made).toHaveLength(1);
  });

  it("points at the whole scene with a click on the bar, once it isn't a double-click", () => {
    vi.useFakeTimers();
    const l = layer();
    l.gl.sync([CUBE]);
    l.fire(l.grip(), "pointerdown", 10, 10);
    l.fire(l.grip(), "pointerup", 11, 10);
    l.fire(l.grip(), "click", 11, 10);
    expect(l.picks).toEqual([]);
    vi.advanceTimersByTime(CLICK_WAIT_MS);
    expect(l.picks).toEqual([["cube", null]]);
  });

  it("moves with the arrow keys, telling the tile once they stop", () => {
    vi.useFakeTimers();
    const l = layer();
    l.gl.sync([CUBE]);
    const steps = [];
    l.doc.addEventListener("keydown", (e) => steps.push(e.key));
    const key = (k, shiftKey = false) =>
      l.grip().dispatchEvent(new l.w.KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true }));
    key("ArrowLeft");
    key("ArrowDown", true);
    expect(l.host().style.transform).toBe(`translate(${600 - KEY_STEP}px, ${60 + BIG_STEP}px)`);
    // The explanation's steps don't move with them.
    expect(steps).toEqual([]);
    expect(l.moves).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(l.moves).toEqual([["cube", 600 - KEY_STEP, 60 + BIG_STEP]]);
  });

  it("folds down to its bar and pauses its view, and shows again", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    const fold = l.doc.querySelector(".float-fold");
    expect(fold.getAttribute("aria-label")).toBe("Fold away");
    fold.click();
    expect(l.host().classList.contains("folded")).toBe(true);
    expect(l.doc.querySelector(".float-body").hidden).toBe(true);
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    expect(l.made[0].paused).toEqual([true]);
    // Made again (a new look), it stays folded.
    l.gl.sync([{ ...CUBE, objects: [{ kind: "sphere", at: [0, 0, 0] }] }]);
    expect(l.made).toHaveLength(2);
    expect(l.made[0].disposed).toBe(true);
    expect(l.made[1].paused).toEqual([true]);
    expect(l.doc.querySelector(".float-fold").getAttribute("aria-label")).toBe("Show again");
    l.doc.querySelector(".float-fold").click();
    expect(l.made[1].paused).toEqual([true, false]);
    expect(l.doc.querySelector(".float-fold").getAttribute("aria-label")).toBe("Fold away");
  });

  it("brings the window touched to the front, and takes away scenes that went", () => {
    const l = layer();
    l.gl.sync([CUBE, { ...CUBE, id: "two" }]);
    const [a, b] = l.doc.querySelectorAll(".gl-host");
    l.fire(a, "pointerdown");
    l.fire(b, "pointerdown");
    expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
    l.gl.sync([CUBE]);
    expect(l.doc.querySelectorAll(".gl-host")).toHaveLength(1);
    expect(l.made[1].disposed).toBe(true);
  });
});
