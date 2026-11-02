// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — marking an area on a 3D model
 *
 * The page's loop: which points are inside it, the grid tried inside it,
 * and what an area covers (its parts, most covered first, and at most
 * AREA_POINTS rounded points). The tile trusts none of it: only the
 * scene's own labels, finite points within the room, no more than the
 * limit, a view in range; then it works out the middle and extent itself
 * and puts the area into words for the agent and the ask card. On the
 * window, the pencil turns marking on and off, and an area's mark stays
 * only while that area is what's pointed at.
 */
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { AREA_POINTS, areaWords, checkArea } from "../../examples/whiteboard/src/area.js";
import { aboutLine } from "../../examples/whiteboard/src/askAgent.js";
import { ask, draw, emptyBoard, show } from "../../examples/whiteboard/src/board.js";
import {
  AREA_POINTS as PAGE_POINTS,
  gridInside,
  insidePolygon,
  spread,
  summarize,
} from "../../examples/whiteboard/page-src/markArea.js";
import { createGlLayer } from "../../examples/whiteboard/page-src/glLayer.js";
import { startTile } from "../fake-host.mjs";

const PLANE = {
  kind: "scene3d",
  id: "plane",
  x: 500,
  y: 20,
  w: 400,
  h: 300,
  label: "Airplane",
  objects: [
    { kind: "sphere", at: [0, 0, 0], r: 10, label: "fuselage" },
    { kind: "box", at: [0, 0, 20], size: [10, 2, 30], label: "wing" },
  ],
};
const board = () => draw(show(emptyBoard(), { text: "Lift\nWeight" }), { shapes: [PLANE] }).board;
const AREA = {
  parts: ["wing", "fuselage"],
  points: [
    [-2, 1, 10],
    [4, 1, 30],
    [1, 2.04, 20],
  ],
  view: { yaw: 120.4, pitch: 40 },
};

describe("the page's loop", () => {
  const square = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];

  it("knows what's inside it", () => {
    expect(insidePolygon([50, 50], square)).toBe(true);
    expect(insidePolygon([150, 50], square)).toBe(false);
    // A loop drawn the other way round is the same loop.
    expect(insidePolygon([50, 50], [...square].reverse())).toBe(true);
  });

  it("tries a grid inside it, no bigger than asked", () => {
    const { points, step } = gridInside(square, 100);
    expect(points.length).toBeLessThanOrEqual(100);
    expect(points.length).toBeGreaterThan(60);
    expect(step).toBeCloseTo(10);
    expect(points.every((p) => insidePolygon(p, square))).toBe(true);
    const tri = gridInside(
      [
        [0, 0],
        [100, 0],
        [0, 100],
      ],
      100,
    );
    expect(tri.points.length).toBeLessThan(points.length);
  });

  it("keeps at most n points, spread over the list", () => {
    expect(spread([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(spread([...Array(100).keys()], 4)).toEqual([0, 25, 50, 75]);
  });

  it("says what the area covers: parts most covered first, rounded points", () => {
    const hits = [
      ...Array.from({ length: 50 }, (_, i) => ({ at: [i + 0.123, 1, 2], part: "wing" })),
      ...Array.from({ length: 10 }, () => ({ at: [0, 0, 0], part: "fuselage" })),
      { at: [9, 9, 9], part: null },
    ];
    const a = summarize(hits, { yaw: 30, pitch: 10, zoom: 1 });
    expect(a.parts).toEqual(["wing", "fuselage"]);
    expect(a.points).toHaveLength(PAGE_POINTS);
    expect(a.points[1]).toEqual([1.1, 1, 2]);
    expect(a.view).toEqual({ yaw: 30, pitch: 10 });
    expect(PAGE_POINTS).toBe(AREA_POINTS);
  });
});

describe("the tile checks an area", () => {
  it("keeps the scene's own labels and works out the middle and extent", () => {
    const a = checkArea(PLANE, { ...AREA, parts: ["wing", "nope", "wing", 7, "fuselage"] });
    expect(a).toEqual({
      parts: ["wing", "fuselage"],
      points: [
        [-2, 1, 10],
        [4, 1, 30],
        [1, 2, 20],
      ],
      center: [1, 1.3, 20],
      min: [-2, 1, 10],
      max: [4, 2, 30],
      view: { yaw: 120, pitch: 40 },
    });
  });

  it("makes no area of what isn't one", () => {
    const p = (points) => ({ ...AREA, points });
    for (const bad of [
      null,
      "area",
      [],
      { parts: ["wing"] },
      p([]),
      p([[1, 2]]),
      p([[1, 2, "3"]]),
      p([[1, 2, Number.NaN]]),
      p([[1, 2, 1e6]]),
      p(Array.from({ length: AREA_POINTS + 1 }, () => [0, 0, 0])),
    ]) {
      expect(checkArea(PLANE, bad)).toBeNull();
    }
    expect(checkArea({ kind: "note" }, AREA)).toBeNull();
  });

  it("drops a view out of range, keeping the area", () => {
    expect(checkArea(PLANE, { ...AREA, view: { yaw: 1, pitch: 300 } }).view).toBeUndefined();
    expect(checkArea(PLANE, { ...AREA, view: "top" }).view).toBeUndefined();
  });

  it("puts it into words", () => {
    expect(areaWords(checkArea(PLANE, AREA))).toBe(
      'an area on "wing" and "fuselage" around (1, 1.3, 20), spanning x -2..4, y 1..2, z 10..30, seen from above (yaw 120°, pitch 40°)',
    );
    expect(areaWords(checkArea(PLANE, { points: [[0, 0, 0]] }))).toBe(
      "an area around (0, 0, 0), spanning x 0..0, y 0..0, z 0..0",
    );
  });

  it("keeps the area with the ask, in place of a part, and tells the ask card", () => {
    const b = ask(board(), { shape: "plane", part: "wing", area: AREA, question: "here?" });
    expect(b.asked.area.parts).toEqual(["wing", "fuselage"]);
    expect(b.asked.part).toBeUndefined();
    expect(aboutLine(b, b.asked)).toMatch(
      /pointing at the scene3d "plane" \(Airplane\), at an area on "wing" and "fuselage" around/,
    );
    // An area that doesn't check out leaves the part.
    const c = ask(board(), { shape: "plane", part: "wing", area: { points: "x" } });
    expect(c.asked).toMatchObject({ shape: "plane", part: "wing" });
    expect(c.asked.area).toBeUndefined();
  });
});

describe("the tile tells the agent", () => {
  const DIR = fileURLToPath(new URL("../../examples/whiteboard/", import.meta.url));

  it("names the area in what to do next, and logs one word", async () => {
    const host = await startTile(DIR, { page: "side", theme: { mode: "dark", colors: {} } });
    await host.command("show", { text: "Lift" });
    await host.command("draw", { shapes: [PLANE] });
    await host.emit("page.message", {
      message: { type: "ask", shape: "plane", area: AREA, question: "why here?" },
    });
    const read = await host.command("read", {});
    expect(read.asked.area.center).toEqual([1, 1.3, 20]);
    expect(read.next).toMatch(/an area on "wing" and "fuselage"/);
    expect(host.audits.at(-1)).toEqual({ action: "asked", details: { via: "board" } });
    expect(JSON.stringify(host.audits)).not.toMatch(/wing|why/);
  });
});

describe("marking on the window", () => {
  const windows = [];
  afterEach(() => {
    for (const w of windows.splice(0)) w.close();
  });

  function layer() {
    const dom = new JSDOM('<div class="scroller"><svg id="board"></svg></div>');
    windows.push(dom.window);
    const doc = dom.window.document;
    const views = [];
    const areas = [];
    const gl = createGlLayer({
      doc,
      svg: doc.getElementById("board"),
      labels: () => ({
        hint: "Drag to turn",
        move: "Drag to move",
        fold: "Fold away",
        unfold: "Show again",
        untitled: "3D view",
        mark: "Mark an area",
        marking: "Draw a loop",
      }),
      cameras: new Map(),
      onPick: () => {},
      onMove: () => {},
      onArea: (id, area) => areas.push([id, area]),
      makeView: (_doc, _body, shape, o) => {
        const v = { shape, o, marking: [], cleared: 0 };
        views.push(v);
        return {
          resize: () => {},
          highlight: () => {},
          pause: () => {},
          setMarking: (on) => v.marking.push(on),
          clearMark: () => (v.cleared += 1),
          dispose: () => {},
        };
      },
    });
    return { doc, gl, views, areas };
  }

  it("turns marking on and off with the pencil, and Esc in the view shows it off", () => {
    const l = layer();
    l.gl.sync([PLANE]);
    const pencil = l.doc.querySelector(".float-mark");
    expect(pencil.getAttribute("aria-label")).toBe("Mark an area");
    expect(pencil.getAttribute("aria-pressed")).toBe("false");
    pencil.click();
    expect(pencil.getAttribute("aria-pressed")).toBe("true");
    pencil.click();
    expect(l.views[0].marking).toEqual([true, false]);
    pencil.click();
    // The view turned marking off itself (Esc).
    l.views[0].o.onMarkMode(false);
    expect(pencil.getAttribute("aria-pressed")).toBe("false");
    expect(l.views[0].o.markHint).toBe("Draw a loop");
  });

  it("passes an area on, and keeps its mark only while it's pointed at", () => {
    const l = layer();
    l.gl.sync([PLANE, { ...PLANE, id: "two" }]);
    l.views[0].o.onMark(AREA);
    expect(l.areas).toEqual([["plane", AREA]]);
    l.gl.highlight("plane", null, true);
    expect(l.views.map((v) => v.cleared)).toEqual([0, 1]);
    l.gl.highlight("plane", "wing");
    expect(l.views.map((v) => v.cleared)).toEqual([1, 2]);
  });
});
