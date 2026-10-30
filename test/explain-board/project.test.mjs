// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Explain Board — 3D scenes as flat shapes
 *
 * The camera turns round the scene's middle; a box shows at most three of
 * its faces (those facing the camera), shaded by the light; pieces come
 * from far to near with labels last; and the scene fills its box whatever
 * its size, staying inside it.
 */
import { describe, expect, it } from "vitest";
import {
  boxCorners,
  extentOf,
  rotate,
  sceneItems,
} from "../../examples/explain-board/page-src/project.js";

const RECT = { x: 100, y: 100, w: 200, h: 200 };
const near = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("3D scenes", () => {
  it("turns points by yaw and pitch", () => {
    near(rotate([1, 0, 0], 0, 0), [1, 0, 0]);
    near(rotate([1, 0, 0], 90, 0), [0, 0, -1]);
    near(rotate([0, 0, 1], 0, 90), [0, -1, 0]);
  });

  it("shows only the faces of a box that face the camera", () => {
    const box = { kind: "box", at: [0, 0, 0], size: [10, 10, 10], color: "blue" };
    expect(boxCorners(box)).toHaveLength(8);
    // Straight on, only the front face shows.
    expect(
      sceneItems([box], { yaw: 0, pitch: 0 }, RECT).filter((p) => p.type === "poly"),
    ).toHaveLength(1);
    // From above and to the side, three.
    const faces = sceneItems([box], { yaw: 35, pitch: 25 }, RECT).filter((p) => p.type === "poly");
    expect(faces).toHaveLength(3);
    for (const f of faces) expect(f.shade).toBeGreaterThanOrEqual(0);
    expect(new Set(faces.map((f) => f.shade.toFixed(3))).size).toBeGreaterThan(1);
  });

  it("draws far pieces first and labels last, inside the scene's box", () => {
    const objects = [
      { kind: "sphere", at: [0, 0, -30], r: 5, color: "red", label: "far" },
      { kind: "sphere", at: [0, 0, 30], r: 5, color: "green" },
      { kind: "line", at: [-30, 0, 0], to: [30, 0, 0], color: "gray" },
      { kind: "point", at: [10, 10, 10], color: "accent" },
    ];
    const items = sceneItems(objects, { yaw: 0, pitch: 0 }, RECT);
    const balls = items.filter((p) => p.type === "circle" && !p.dot);
    expect(balls[0].color).toBe("red");
    // Nearer looks bigger.
    expect(balls[1].r).toBeGreaterThan(balls[0].r);
    expect(items.at(-1)).toMatchObject({ type: "text", text: "far" });
    for (const p of items.filter((i) => i.type === "circle")) {
      expect(p.cx).toBeGreaterThanOrEqual(RECT.x);
      expect(p.cx).toBeLessThanOrEqual(RECT.x + RECT.w);
    }
    expect(extentOf(objects)).toBeCloseTo(35, 6);
  });
});
