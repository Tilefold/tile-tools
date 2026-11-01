/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — real 3D tests
 *
 * The newer 3D objects (cylinder, arrow, lathe, wing, tube) are checked
 * field by field and within limits; where the page can't draw real 3D they
 * fall back to the simple objects the flat drawing knows; the wing's
 * airfoil is a proper closed section; a mesh is made for every object but a
 * label, carrying the object's part; and the user can ask about a part of a
 * scene, which the agent then hears by name.
 */
import { describe, expect, it } from "vitest";
import { ask, draw, emptyBoard, show } from "../../examples/whiteboard/src/board.js";
import { aboutLine } from "../../examples/whiteboard/src/askAgent.js";
import { checkShape, LIMITS } from "../../examples/whiteboard/src/scene.js";
import { simplify } from "../../examples/whiteboard/page-src/project.js";
import {
  airfoil,
  labelAnchor,
  objectGroup,
  standardMaterial,
} from "../../examples/whiteboard/page-src/meshes.js";

/** A scene of `objects`, checked. */
const scene = (objects) =>
  checkShape({ kind: "scene3d", id: "s", x: 500, y: 0, w: 400, h: 300, objects });
/** The error message checking `objects` gives. */
const why = (objects) => {
  try {
    scene(objects);
  } catch (err) {
    return err.message;
  }
  throw new Error("expected the scene to be refused");
};

const WING = { kind: "wing", at: [0, 0, 0], span: 40, chord: 12, label: "wing" };

describe("the newer 3D objects", () => {
  it("fill in defaults and keep what was given", () => {
    const [cyl, arrow, lathe, wing, tube] = scene([
      { kind: "cylinder", at: [0, 0, 0], to: [10, 0, 0] },
      { kind: "arrow", at: [0, 0, 0], to: [0, 20, 0], color: "green", label: "lift" },
      {
        kind: "lathe",
        at: [0, 0, 0],
        profile: [
          [0, -10],
          [5, 0],
          [0, 10],
        ],
        axis: "x",
      },
      WING,
      {
        kind: "tube",
        points: [
          [0, 0, 0],
          [10, 5, 0],
          [20, 0, 0],
        ],
        flow: true,
      },
    ]).objects;
    expect(cyl).toMatchObject({ r: 3, r2: 3, to: [10, 0, 0] });
    expect(arrow).toMatchObject({ r: 1.2, color: "green", label: "lift" });
    expect(lathe).toMatchObject({
      axis: "x",
      profile: [
        [0, -10],
        [5, 0],
        [0, 10],
      ],
    });
    expect(wing).toMatchObject({
      thickness: 0.12,
      camber: 0.03,
      taper: 1,
      sweep: 0,
      mirror: true,
      vertical: false,
    });
    // A tube is placed by its first point.
    expect(tube).toMatchObject({ at: [0, 0, 0], r: 0.8, flow: true });
  });

  it("refuse what's wrong, naming the field", () => {
    expect(why([{ kind: "cylinder", at: [0, 0, 0] }])).toMatch(/objects\[0\]\.to/);
    expect(why([{ kind: "lathe", at: [0, 0, 0], profile: [[1, 1]] }])).toMatch(
      /profile: a list of 2/,
    );
    expect(
      why([
        {
          kind: "lathe",
          at: [0, 0, 0],
          profile: [
            [1, 1],
            [-1, 2],
          ],
        },
      ]),
    ).toMatch(/profile\[1\]\[0\]/);
    expect(why([{ ...WING, sweep: 80 }])).toMatch(/sweep: a number from -60 to 60/);
    expect(why([{ ...WING, mirror: "yes" }])).toMatch(/mirror: true or false/);
    expect(why([{ kind: "tube", points: "nope" }])).toMatch(/\.at: \[x, y, z\]/);
    expect(why([{ kind: "box", at: [0, 0, 0], rot: [0, 0] }])).toMatch(/rot: \[x, y, z\]/);
    expect(why([{ kind: "box", at: [0, 0, 0], opacity: 0 }])).toMatch(/opacity/);
  });

  it("keep scenes within their point limits", () => {
    const long = Array.from({ length: LIMITS.points3d + 1 }, (_, i) => [i, 0, 0]);
    expect(why([{ kind: "tube", points: long }])).toMatch(/points/);
    const full = Array.from({ length: LIMITS.points3d }, (_, i) => [i % 100, 0, 0]);
    const many = Array.from({ length: 30 }, () => ({ kind: "tube", points: full }));
    expect(why(many)).toMatch(/at most 1500 points in all/);
  });
});

describe("where the page can't draw real 3D", () => {
  it("draws each newer object as the simple ones it knows", () => {
    const out = simplify(
      scene([
        { kind: "arrow", at: [0, 0, 0], to: [0, 20, 0], label: "lift" },
        {
          kind: "tube",
          points: [
            [0, 0, 0],
            [5, 0, 0],
            [9, 0, 0],
          ],
          label: "air",
        },
        {
          kind: "lathe",
          at: [0, 0, 0],
          profile: [
            [0, -10],
            [4, 0],
            [0, 30],
          ],
          axis: "x",
        },
        { ...WING, mirror: false },
      ]).objects,
    );
    expect(out.map((o) => o.kind)).toEqual(["line", "point", "line", "line", "box", "box"]);
    expect(out[0]).toMatchObject({ to: [0, 20, 0], label: "lift" });
    expect(out[3].label).toBeUndefined();
    // The lathe's box runs along x, from -10 to 30.
    expect(out[4]).toMatchObject({ at: [10, 0, 0], size: [40, 8, 8] });
    // A one-sided wing reaches out along z from where it starts.
    expect(out[5]).toMatchObject({ at: [0, 0, 20] });
    expect(out[5].size[2]).toBe(40);
  });
});

describe("the meshes", () => {
  it("shape a wing as a closed airfoil, round at the front and sharp at the back", () => {
    const loop = airfoil(0.12, 0.04, 24);
    expect(loop).toHaveLength(48);
    expect(loop[0]).toEqual([1, expect.any(Number)]);
    const thickest = Math.max(...loop.map(([, y]) => y)) - Math.min(...loop.map(([, y]) => y));
    expect(thickest).toBeGreaterThan(0.12);
    expect(thickest).toBeLessThan(0.2);
    // Cambered: more above the line than below it.
    expect(Math.max(...loop.map(([, y]) => y))).toBeGreaterThan(
      -Math.min(...loop.map(([, y]) => y)),
    );
  });

  it("makes a mesh for every object but a label, naming nothing it wasn't told", () => {
    const objects = scene([
      { kind: "box", at: [0, 0, 0], size: [4, 4, 4] },
      { kind: "sphere", at: [0, 0, 0] },
      { kind: "point", at: [0, 0, 0] },
      { kind: "line", at: [0, 0, 0], to: [5, 0, 0] },
      { kind: "cylinder", at: [0, 0, 0], to: [5, 0, 0], r2: 0 },
      { kind: "arrow", at: [0, 0, 0], to: [0, 9, 0] },
      {
        kind: "lathe",
        at: [0, 0, 0],
        profile: [
          [0, 0],
          [3, 2],
          [0, 4],
        ],
      },
      WING,
      {
        kind: "tube",
        points: [
          [0, 0, 0],
          [5, 5, 0],
          [9, 0, 0],
        ],
      },
      { kind: "label", at: [1, 1, 1], text: "here" },
    ]).objects;
    const material = (hex, opacity, double) => standardMaterial(hex, opacity, double);
    const groups = objects.map((o) => objectGroup(o, material));
    expect(groups.slice(0, 9).every((g) => g && g.children.length > 0)).toBe(true);
    expect(groups[9]).toBeNull();
    // An arrow is a shaft and a head; its label goes at its tip.
    expect(groups[5].children).toHaveLength(2);
    expect(labelAnchor(objects[5], groups[5]).toArray()).toEqual([0, 9, 0]);
    // A wing's label goes above it.
    expect(labelAnchor(objects[7], groups[7]).y).toBeGreaterThan(0);
  });
});

describe("asking about a part", () => {
  const board = () => {
    const b = show(emptyBoard(), { text: "lift\nweight", kind: "text", title: "Flight" });
    return draw(b, {
      shapes: [{ kind: "scene3d", id: "plane", x: 500, y: 0, w: 400, h: 300, objects: [WING] }],
    }).board;
  };

  it("keeps the part when the scene has it, and drops one it doesn't", () => {
    expect(ask(board(), { shape: "plane", part: "wing", question: "why curved?" }).asked).toEqual({
      n: 1,
      shape: "plane",
      part: "wing",
      question: "why curved?",
    });
    expect(ask(board(), { shape: "plane", part: "rudder" }).asked).toEqual({
      n: 1,
      shape: "plane",
    });
  });

  it("names the part in the line the agent gets", () => {
    const b = ask(board(), { shape: "plane", part: "wing", question: "why curved?" });
    expect(aboutLine(b, b.asked)).toMatch(/pointing at the scene3d "plane", at its part "wing"\./);
  });
});
