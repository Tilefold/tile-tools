// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — a 3D window's size, zoom, see-through, labels, clearing
 * and closing, and drawing freehand on the model
 *
 * The board keeps the size the user gave a scene by its corner (within
 * limits, inside the board), marks it as theirs so the agent drawing it
 * again keeps it, and takes nothing else; the tile logs one word. The
 * window: its corner resizes only it until dropped (or with the keys,
 * told once they stop), and a resize never makes the view again; its
 * buttons zoom the view, set how see-through the background is (a slider)
 * and hide the labels, kept for the scene while the page is open, clear
 * what's drawn and picked, and close it. A closed scene stays on the
 * board, not shown, until the user shows it again or the agent redraws it. On the model, a
 * stroke that ends where it began is a loop that marks an area, any other
 * is a line; the page says which, and the tile keeps only what it knows.
 */
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { areaWords, checkArea } from "../../examples/whiteboard/src/area.js";
import {
  ask,
  closeScene,
  draw,
  emptyBoard,
  move,
  reopenScenes,
  show,
} from "../../examples/whiteboard/src/board.js";
import { SCENE_MAX_H, SCENE_MIN_H, SCENE_MIN_W } from "../../examples/whiteboard/src/layout.js";
import { checkShape } from "../../examples/whiteboard/src/scene.js";
import { createGlLayer } from "../../examples/whiteboard/page-src/glLayer.js";
import {
  BIG_STEP,
  KEY_STEP,
  OPACITY,
  SCRUB_PX,
  ZOOM_STEP,
} from "../../examples/whiteboard/page-src/floatView.js";
import { CLOSE_PX, along, isLoop, summarize } from "../../examples/whiteboard/page-src/markArea.js";
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
const cubeBoard = () => draw(show(emptyBoard(), { text: "a\nb" }), { shapes: [CUBE] }).board;
const cubeOf = (b) => b.shapes.find((s) => s.id === "cube");

describe("resizing a 3D scene on the board", () => {
  it("keeps the size the user gave it, as theirs", () => {
    const b = cubeBoard();
    const next = move(b, { id: "cube", x: 600, y: 60, w: 380.6, h: 300.2 });
    expect(cubeOf(next)).toMatchObject({ x: 600, y: 60, w: 381, h: 300, sized: true });
    // Only resized: it wasn't moved.
    expect(cubeOf(next).moved).toBeUndefined();
  });

  it("keeps the size within limits and the scene inside the board", () => {
    const b = cubeBoard();
    expect(cubeOf(move(b, { id: "cube", x: 600, y: 60, w: 5, h: 5 }))).toMatchObject({
      w: SCENE_MIN_W,
      h: SCENE_MIN_H,
    });
    // Wider than the room right of it: it moves left to stay on the board.
    expect(cubeOf(move(b, { id: "cube", x: 600, y: 60, w: 9000, h: 1e9 }))).toMatchObject({
      x: 0,
      w: 1000,
      h: SCENE_MAX_H,
      moved: true,
      sized: true,
    });
  });

  it("ignores a size without both sides, or sides that aren't numbers", () => {
    const b = cubeBoard();
    for (const bad of [
      { id: "cube", x: 600, y: 60, w: 400 },
      { id: "cube", x: 600, y: 60, h: 400 },
      { id: "cube", x: 600, y: 60, w: "400", h: 300 },
      { id: "cube", x: 600, y: 60, w: 400, h: Number.NaN },
      { id: "cube", x: 600, y: 60, w: 300, h: 260 },
    ]) {
      expect(move(b, bad)).toBe(b);
    }
  });

  it("keeps the user's size when the agent draws it again, and never takes `sized` from the agent", () => {
    const b = move(cubeBoard(), { id: "cube", x: 600, y: 60, w: 280, h: 400 });
    const again = draw(b, { shapes: [{ ...CUBE, w: 500, h: 500, label: "Bigger" }] }).board;
    expect(cubeOf(again)).toMatchObject({ w: 280, h: 400, sized: true, label: "Bigger" });
    expect(checkShape({ ...CUBE, sized: true }).sized).toBeUndefined();
  });

  it("logs a resize as one word, apart from a move", async () => {
    const DIR = fileURLToPath(new URL("../../examples/whiteboard/", import.meta.url));
    const host = await startTile(DIR, { page: "side", theme: { mode: "dark", colors: {} } });
    await host.command("show", { text: "a" });
    await host.command("draw", { shapes: [CUBE] });
    const say = (message) => host.emit("page.message", { message });
    await say({ type: "move", id: "cube", x: 600, y: 60, w: 420, h: 330 });
    await say({ type: "move", id: "cube", x: 100, y: 60, w: 420, h: 330 });
    expect(cubeOf(host.store.get("board"))).toMatchObject({ x: 100, w: 420, h: 330 });
    expect(host.audits.slice(-2).map((a) => a.action)).toEqual(["resized", "moved"]);
    expect(JSON.stringify(host.audits)).not.toMatch(/\d{2,}/);
  });
});

describe("closing a 3D scene", () => {
  it("keeps it on the board as closed, and shows it again", () => {
    const b = cubeBoard();
    const shut = closeScene(b, { id: "cube" });
    expect(cubeOf(shut)).toMatchObject({ closed: true, x: 600, objects: CUBE.objects });
    expect(shut.shapes).toHaveLength(b.shapes.length);
    expect(closeScene(shut, { id: "cube" })).toBe(shut);
    const back = reopenScenes(shut);
    expect(cubeOf(back).closed).toBeUndefined();
    expect(reopenScenes(back)).toBe(back);
  });

  it("ignores what isn't a 3D scene on the board", () => {
    const b = draw(cubeBoard(), {
      shapes: [{ kind: "note", id: "n", x: 1, y: 1, text: "hi" }],
    }).board;
    for (const bad of [{ id: "n" }, { id: "nope" }, { id: ["cube"] }, null]) {
      expect(closeScene(b, bad)).toBe(b);
    }
  });

  it("shows it again when the agent draws it again, and never takes `closed` from the agent", () => {
    const shut = closeScene(cubeBoard(), { id: "cube" });
    expect(cubeOf(draw(shut, { shapes: [CUBE] }).board).closed).toBeUndefined();
    expect(checkShape({ ...CUBE, closed: true }).closed).toBeUndefined();
  });

  it("logs closing and showing again as one word each", async () => {
    const DIR = fileURLToPath(new URL("../../examples/whiteboard/", import.meta.url));
    const host = await startTile(DIR, { page: "side", theme: { mode: "dark", colors: {} } });
    await host.command("show", { text: "a" });
    await host.command("draw", { shapes: [CUBE] });
    const say = (message) => host.emit("page.message", { message });
    await say({ type: "hide", id: "cube" });
    expect(cubeOf(host.store.get("board")).closed).toBe(true);
    const read = await host.command("read", {});
    expect(read.shapes.find((s) => s.id === "cube").closed).toBe(true);
    await say({ type: "reopen" });
    expect(cubeOf(host.store.get("board")).closed).toBeUndefined();
    expect(host.audits.slice(-2).map((a) => a.action)).toEqual(["hid", "reopened"]);
  });
});

describe("drawing freehand on the model", () => {
  /** A circle of `n` points, `r` pixels round, ending `gap` short of where it began. */
  const circle = (r, n = 40, gap = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((2 * Math.PI - gap / r) * i) / (n - 1);
      return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
    });

  it("calls a stroke that ends where it began a loop, and any other a line", () => {
    expect(isLoop(circle(40))).toBe(true);
    expect(isLoop(circle(40, 40, CLOSE_PX / 2))).toBe(true);
    expect(isLoop(circle(40, 40, 60))).toBe(false);
    // Too small to hold an area, or too few points.
    expect(isLoop(circle(5))).toBe(false);
    expect(isLoop(circle(40).slice(0, 5))).toBe(false);
    expect(isLoop(Array.from({ length: 20 }, (_, i) => [i * 10, 0]))).toBe(false);
  });

  it("samples a stroke evenly along it, from end to end, but not too often", () => {
    const pts = along([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts.at(-1)).toEqual([10, 10]);
    expect(pts).toHaveLength(11);
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      expect(d).toBeLessThanOrEqual(2.0001);
    }
    // A long stroke gets wider gaps instead of more rays.
    expect(
      along(
        [
          [0, 0],
          [10000, 0],
        ],
        2,
        50,
      ).length,
    ).toBeLessThanOrEqual(50);
    expect(along([[3, 4]])).toEqual([[3, 4]]);
  });

  it("says whether the drawing is lines, an area or both, and the tile keeps only that", () => {
    const hits = [{ at: [1, 2, 3], part: "box" }];
    const view = { yaw: 10, pitch: 5 };
    expect(summarize(hits, view).drawn).toBeUndefined();
    expect(summarize(hits, view, "lines").drawn).toBe("lines");
    expect(summarize(hits, view, "both").drawn).toBe("both");
    const scene = { kind: "scene3d", objects: [{ label: "box" }] };
    expect(checkArea(scene, summarize(hits, view, "lines")).drawn).toBe("lines");
    for (const drawn of ["area", "<b>", 1, null]) {
      expect(checkArea(scene, { ...summarize(hits, view), drawn }).drawn).toBeUndefined();
    }
  });

  it("puts lines into words for the agent", () => {
    const scene = { kind: "scene3d", objects: [{ label: "box" }] };
    const raw = { parts: ["box"], points: [[1, 2, 3]] };
    expect(areaWords(checkArea(scene, raw))).toMatch(/^an area on "box"/);
    expect(areaWords(checkArea(scene, { ...raw, drawn: "lines" }))).toMatch(
      /^lines drawn on "box"/,
    );
    expect(areaWords(checkArea(scene, { ...raw, drawn: "both" }))).toMatch(
      /^lines and an area drawn on/,
    );
    // And the board keeps what was drawn with the question.
    const b = ask(cubeBoard(), {
      shape: "cube",
      area: { ...raw, drawn: "lines" },
      question: "what's this line?",
    });
    expect(b.asked.area).toMatchObject({ parts: ["box"], drawn: "lines" });
  });
});

describe("the window's corner and buttons", () => {
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
    const moves = [];
    const resets = [];
    const picks = [];
    const closes = [];
    const gl = createGlLayer({
      doc,
      svg: doc.getElementById("board"),
      labels: () => ({
        hint: "Drag to turn",
        move: "Drag to move",
        fold: "Fold away",
        unfold: "Show again",
        untitled: "3D view",
        mark: "Draw on the model",
        marking: "Draw",
        size: "Drag to resize",
        zoomIn: "Zoom in",
        zoomOut: "Zoom out",
        clear: "Background transparency",
        opacity: "Background opacity",
        tags: "Show or hide the labels",
        reset: "Clear drawing and selection",
        close: "Close this 3D view",
      }),
      cameras: new Map(),
      onPick: (...p) => picks.push(p),
      onMove: (...m) => moves.push(m),
      onArea: () => {},
      onReset: (id) => resets.push(id),
      onClose: (id) => closes.push(id),
      makeView: (_doc, body, shape) => {
        const v = { shape, sizes: [], zooms: [], tags: [], picks: [], cleared: 0, disposed: false };
        made.push(v);
        return {
          resize: (a, b) => v.sizes.push([a, b]),
          highlight: (part) => v.picks.push(part),
          pause: () => {},
          setMarking: () => {},
          clearMark: () => (v.cleared += 1),
          zoomBy: (by) => v.zooms.push(by),
          showLabels: (on) => v.tags.push(on),
          dispose: () => (v.disposed = true),
        };
      },
    });
    const $ = (sel) => doc.querySelector(sel);
    const fire = (node, type, x = 0, y = 0) =>
      node.dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    return { w, doc, gl, made, moves, resets, closes, picks, $, fire };
  }

  it("resizes only the window while dragged, and tells its size when dropped", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    const corner = l.$(".float-size");
    expect(corner.getAttribute("aria-label")).toBe("Drag to resize");
    l.fire(corner, "pointerdown", 0, 0);
    l.fire(corner, "pointermove", 60, 40);
    expect(l.$(".gl-host").style.width).toBe("360px");
    expect(l.$(".gl-host").style.height).toBe("300px");
    expect(l.$(".gl-host").classList.contains("sizing")).toBe(true);
    expect(l.moves).toEqual([]);
    // Never wider than the room right of it, nor smaller than the least.
    l.fire(corner, "pointermove", 5000, -5000);
    l.fire(corner, "pointerup", 5000, -5000);
    expect(l.moves).toEqual([["cube", 600, 60, 400, SCENE_MIN_H]]);
    expect(l.made[0].sizes.at(-1)[0]).toBe(398);
    // It stays that size until the board comes back with it; a resize never makes the view again.
    l.gl.sync([CUBE]);
    expect(l.$(".gl-host").style.width).toBe("400px");
    l.gl.sync([{ ...CUBE, w: 400, h: SCENE_MIN_H, sized: true }]);
    l.gl.sync([{ ...CUBE, w: 350, h: 200, sized: true }]);
    expect(l.$(".gl-host").style.width).toBe("350px");
    expect(l.made).toHaveLength(1);
  });

  it("resizes with the arrow keys on the corner, telling the tile once they stop", () => {
    vi.useFakeTimers();
    const l = layer();
    l.gl.sync([CUBE]);
    const steps = [];
    l.doc.addEventListener("keydown", (e) => steps.push(e.key));
    const key = (k, shiftKey = false) =>
      l
        .$(".float-size")
        .dispatchEvent(new l.w.KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true }));
    key("ArrowLeft");
    key("ArrowDown", true);
    expect(steps).toEqual([]);
    expect(l.moves).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(l.moves).toEqual([["cube", 600, 60, 300 - KEY_STEP, 260 + BIG_STEP]]);
  });

  it("zooms the view with its buttons", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    l.$(".float-zoom-in").click();
    l.$(".float-zoom-out").click();
    expect(l.made[0].zooms).toEqual([ZOOM_STEP, 1 / ZOOM_STEP]);
    expect(l.$(".float-zoom-in").getAttribute("aria-label")).toBe("Zoom in");
  });

  it("sets how see-through the background is with a slider, kept when the view is made again", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    const button = () => l.$(".float-clear");
    const slider = () => l.$(".float-opacity .scrub");
    const host = () => l.$(".gl-host");
    const key = (k) =>
      slider().dispatchEvent(new l.w.KeyboardEvent("keydown", { key: k, bubbles: true }));
    expect(host().style.getPropertyValue("--float-solid")).toBe(`${OPACITY}%`);
    expect(l.$(".float-opacity").hidden).toBe(true);
    l.fire(button(), "click");
    expect(l.$(".float-opacity").hidden).toBe(false);
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(slider().getAttribute("role")).toBe("slider");
    expect(slider().getAttribute("aria-label")).toBe("Background opacity");
    // Its keys never step the explanation.
    const steps = [];
    l.doc.addEventListener("keydown", (e) => steps.push(e.key));
    key("ArrowDown");
    key("PageDown");
    expect(host().style.getPropertyValue("--float-solid")).toBe(`${OPACITY - 5 - 25}%`);
    expect(l.$(".float-opacity output").textContent).toBe(`${OPACITY - 30}%`);
    expect(slider().getAttribute("aria-valuenow")).toBe(String(OPACITY - 30));
    expect(host().classList.contains("clear")).toBe(false);
    key("Home");
    expect(host().classList.contains("clear")).toBe(true);
    expect(steps).toEqual([]);
    key("Escape");
    expect(l.$(".float-opacity").hidden).toBe(true);
    // Made again (a new look), it stays as see-through as the user set it.
    l.gl.sync([{ ...CUBE, objects: [{ kind: "sphere", at: [0, 0, 0] }] }]);
    expect(l.made).toHaveLength(2);
    expect(host().style.getPropertyValue("--float-solid")).toBe("0%");
    expect(host().classList.contains("clear")).toBe(true);
  });

  it("scrubs the see-through straight from its button, pressed and dragged", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    const button = l.$(".float-clear");
    const pop = () => l.$(".float-opacity");
    const solid = () => l.$(".gl-host").style.getPropertyValue("--float-solid");
    l.fire(button, "pointerdown", 100, 100);
    l.fire(button, "pointermove", 100, 100 - 30 * SCRUB_PX);
    // Up is more solid, and the slider shows while it lasts.
    expect(solid()).toBe(`${OPACITY + 30}%`);
    expect(pop().hidden).toBe(false);
    l.fire(button, "pointermove", 100, 100 + 500 * SCRUB_PX);
    expect(solid()).toBe("0%");
    l.fire(button, "pointerup", 100, 100 + 500 * SCRUB_PX);
    l.fire(button, "click", 100, 100 + 500 * SCRUB_PX);
    // Let go, the slider goes; the click that ends the drag doesn't open it again.
    expect(pop().hidden).toBe(true);
    expect(solid()).toBe("0%");
  });

  it("clears what's drawn and picked on the model, and closes the window", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    l.$(".float-reset").click();
    expect(l.made[0].cleared).toBe(1);
    expect(l.made[0].picks).toEqual([null]);
    expect(l.resets).toEqual(["cube"]);
    expect(l.$(".float-close").getAttribute("aria-label")).toBe("Close this 3D view");
    l.$(".float-close").click();
    expect(l.closes).toEqual(["cube"]);
    // The board takes it away: the window goes with it.
    l.gl.sync([]);
    expect(l.$(".gl-host")).toBeNull();
    expect(l.made[0].disposed).toBe(true);
  });

  it("hides and shows the labels, and keeps them hidden when the view is made again", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    const tags = () => l.$(".float-tags");
    expect(tags().getAttribute("aria-pressed")).toBe("true");
    tags().click();
    expect(l.made[0].tags).toEqual([false]);
    l.gl.sync([{ ...CUBE, objects: [{ kind: "sphere", at: [0, 0, 0] }] }]);
    expect(l.made[1].tags).toEqual([false]);
    expect(tags().getAttribute("aria-pressed")).toBe("false");
    tags().click();
    expect(l.made[1].tags).toEqual([false, true]);
  });

  it("folds down to its bar with a double-click on it, and shows again at its size with another", () => {
    vi.useFakeTimers();
    const l = layer();
    l.gl.sync([{ ...CUBE, w: 420, h: 300 }]);
    const grip = l.$(".float-grip");
    const host = () => l.$(".gl-host");
    const double = () => {
      l.fire(grip, "click");
      l.fire(grip, "click");
      l.fire(grip, "dblclick");
    };
    double();
    expect(host().classList.contains("folded")).toBe(true);
    expect(host().style.height).toBe("");
    expect(l.$(".float-fold").getAttribute("aria-expanded")).toBe("false");
    double();
    expect(host().classList.contains("folded")).toBe(false);
    expect(host().style.width).toBe("420px");
    expect(host().style.height).toBe("300px");
    // The clicks of a double-click don't point, and nothing moved.
    vi.advanceTimersByTime(1000);
    expect(l.picks).toEqual([]);
    expect(l.moves).toEqual([]);
  });

  it("hides the corner while folded", () => {
    const l = layer();
    l.gl.sync([CUBE]);
    l.$(".float-fold").click();
    expect(l.$(".float-size").hidden).toBe(true);
    l.$(".float-fold").click();
    expect(l.$(".float-size").hidden).toBe(false);
  });
});
