/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold, tf.screensaver — tests
 *
 * The fake screensaver checks themes the way Tilefold 0.1.12 does (a draw
 * function, an id of lowercase letters, digits and dashes, a name, unique
 * ids, at most 12) and plays a start's frames: frame 0 with dt 0, then
 * each frame `dt` later, on a context that records calls and settings.
 */
import { describe, expect, it } from "vitest";
import { addScreensaver, DEFAULT_COLORS, fakeContext } from "./fake-screensaver.mjs";

const named = (name, message) => Object.assign(new Error(message), { name });

/** A bare host with `tf.screensaver`. */
function setup() {
  const tf = {};
  const host = { regs: [] };
  addScreensaver(tf, host, named);
  return { tf, host };
}

describe("fake tf.screensaver", () => {
  it("checks themes as Tilefold does", () => {
    const { tf, host } = setup();
    const draw = () => {};
    tf.screensaver.theme("rain", " Rain ", draw);
    expect(host.regs).toEqual([{ kind: "theme", id: "rain", name: "Rain" }]);
    expect(() => tf.screensaver.theme("rain", "Again", draw)).toThrow(/share the id/);
    expect(() => tf.screensaver.theme("Rain!", "Rain", draw)).toThrow(/bad theme id/);
    expect(() => tf.screensaver.theme("blank", "  ", draw)).toThrow(/needs a name/);
    expect(() => tf.screensaver.theme("nodraw", "No draw")).toThrow(TypeError);
    for (let i = 1; i < 12; i += 1) tf.screensaver.theme(`t${i}`, `T${i}`, draw);
    expect(() => tf.screensaver.theme("t12", "T12", draw)).toThrow(/at most 12/);
  });

  it("plays a start's frames", () => {
    const { tf, host } = setup();
    const frames = [];
    tf.screensaver.theme("log", "Log", (f) => {
      frames.push({ time: f.time, dt: f.dt, frame: f.frame, w: f.width, colors: f.colors });
      f.ctx.fillStyle = "#fff";
      f.ctx.fillRect(0, 0, 1, 1);
    });
    const ctx = host.drawTheme("log", { frames: 3, dt: 50, width: 640 });
    expect(frames.map((f) => [f.frame, f.time, f.dt, f.w])).toEqual([
      [0, 0, 0, 640],
      [1, 50, 50, 640],
      [2, 100, 50, 640],
    ]);
    expect(frames[0].colors).toEqual(DEFAULT_COLORS);
    expect(ctx.sets).toContainEqual(["fillStyle", "#fff"]);
    expect(ctx.calls.filter((c) => c[0] === "fillRect")).toHaveLength(3);
    expect(() => host.drawTheme("missing")).toThrow(/no theme/);
  });

  it("records calls and reads back what was set", () => {
    const ctx = fakeContext();
    ctx.font = "16px monospace";
    ctx.fillText("A", 1, 2);
    expect(ctx.font).toBe("16px monospace");
    expect(ctx.calls).toEqual([["fillText", "A", 1, 2]]);
    expect(ctx.measureText("abc").width).toBe(24);
  });
});
