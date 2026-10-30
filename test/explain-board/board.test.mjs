// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Explain Board — the board, its shapes and where they sit
 *
 * Content is cut into numbered lines at fixed places, so a line or a
 * column has an exact box. Shapes are checked like any data from outside:
 * a bad field fails with its name and what it should be, and colors come
 * from the palette only. Drawing with a say adds a step and shows it;
 * without, the shapes join the last step; an id already there replaces
 * that shape; arrows may point at lines and at shapes drawn in the same
 * call, never at missing ones. Erasing takes arrows that pointed at what
 * went, a new Show starts over, the board refuses to grow past what a
 * message can carry, and the user's asks are numbered.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_BOARD_BYTES,
  ask,
  describe as describeBoard,
  draw,
  emptyBoard,
  erase,
  goTo,
  isBoard,
  show,
} from "../../examples/explain-board/src/board.js";
import {
  CHAR_W,
  CONTENT_TOP,
  LINE_H,
  MIN_HEIGHT,
  TEXT_X,
  boardHeight,
  contentBox,
  endsOf,
  lineBox,
  wrapText,
} from "../../examples/explain-board/src/layout.js";
import { checkContent, checkShape } from "../../examples/explain-board/src/scene.js";

const CODE = "function add(a, b) {\n  return a + b;\n}\n";
const shown = (extra = {}) => show(emptyBoard(), { text: CODE, title: "add", ...extra });

describe("layout", () => {
  it("puts each content line at a fixed place, numbered from `from`", () => {
    const c = checkContent({ text: CODE, from: 10 });
    expect(c.lines).toEqual(["function add(a, b) {", "  return a + b;", "}"]);
    expect(lineBox(c, 10)).toEqual({ x: TEXT_X, y: CONTENT_TOP, w: 20 * CHAR_W, h: LINE_H });
    expect(lineBox(c, 11).y).toBe(CONTENT_TOP + LINE_H);
    expect(lineBox(c, 13)).toBeNull();
    expect(lineBox(c, 9)).toBeNull();
    // Columns 3..8 of line 11 ("return").
    expect(lineBox(c, 11, [3, 8])).toEqual({
      x: TEXT_X + 2 * CHAR_W,
      y: CONTENT_TOP + LINE_H,
      w: 6 * CHAR_W,
      h: LINE_H,
    });
    expect(contentBox(c)).toMatchObject({ from: 10, to: 12, h: 3 * LINE_H });
  });

  it("turns tabs into spaces, keeps CRLF content in lines, and drops a last empty line", () => {
    expect(checkContent({ text: "a\r\n\tb\r\n" }).lines).toEqual(["a", "  b"]);
    expect(checkContent({ text: "" }).lines).toEqual([""]);
  });

  it("wraps text at spaces and cuts words longer than a line", () => {
    expect(wrapText("one two three four", 9)).toEqual(["one two", "three", "four"]);
    expect(wrapText("abcdefghijkl", 5)).toEqual(["abcde", "fghij", "kl"]);
    expect(wrapText("a\nb", 10)).toEqual(["a", "b"]);
  });

  it("grows the board for its lowest shape, within limits", () => {
    expect(boardHeight(null, [], () => undefined)).toBe(MIN_HEIGHT);
    const tall = [{ kind: "box", x: 0, y: 900, w: 10, h: 100 }];
    expect(boardHeight(null, tall, () => undefined)).toBe(1040);
  });
});

describe("checking shapes", () => {
  it("fills in defaults", () => {
    expect(checkShape({ kind: "box", x: 1, y: 2, w: 30, h: 40 })).toEqual({
      kind: "box",
      color: "accent",
      x: 1,
      y: 2,
      w: 30,
      h: 40,
      fill: true,
    });
    expect(checkShape({ kind: "note", x: 0, y: 0, text: " hi " })).toMatchObject({
      w: 260,
      text: "hi",
    });
    expect(checkShape({ kind: "highlight", line: 3 })).toMatchObject({ lines: [3, 3] });
    expect(checkShape({ kind: "arrow", from: [0, 0], to: { line: 2, col: 4 } })).toMatchObject({
      to: { line: 2, col: 4 },
      curve: 0,
      both: false,
      dashed: false,
    });
  });

  it("names the field and what it should be", () => {
    expect(() => checkShape({ kind: "star" }, "shapes[0]")).toThrow(
      /shapes\[0\]\.kind: one of box/,
    );
    expect(() => checkShape({ kind: "box", x: -5, y: 0, w: 10, h: 10 })).toThrow(
      "shape.x: a number from 0 to 1000",
    );
    expect(() => checkShape({ kind: "box", x: 0, y: 0, w: 10, h: 10, color: "#ff0000" })).toThrow(
      /color: one of accent/,
    );
    expect(() => checkShape({ kind: "arrow", from: "here", to: [0, 0] })).toThrow(/from: \[x, y\]/);
    expect(() => checkShape({ kind: "highlight", lines: [5, 2] })).toThrow(/first ≤ last/);
    expect(() => checkShape({ kind: "note", x: 0, y: 0, text: "x".repeat(601) })).toThrow(
      /at most 600/,
    );
    expect(() => checkShape({ kind: "box", id: "no spaces", x: 0, y: 0, w: 9, h: 9 })).toThrow(
      /\.id/,
    );
  });

  it("takes path data only, nothing that could load or run", () => {
    expect(checkShape({ kind: "path", d: "M10 10 L 20 20 Q30 5 40 20 Z" }).d).toBe(
      "M10 10 L 20 20 Q30 5 40 20 Z",
    );
    expect(() => checkShape({ kind: "path", d: "M0 0 url(javascript:x)" })).toThrow(
      /SVG path data/,
    );
    expect(() => checkShape({ kind: "path", d: "<script>" })).toThrow(/SVG path data/);
  });

  it("checks 3D scenes object by object", () => {
    const s = checkShape({
      kind: "scene3d",
      x: 600,
      y: 60,
      w: 300,
      h: 240,
      objects: [
        { kind: "box", at: [0, 0, 0] },
        { kind: "sphere", at: [20, 0, 0], r: 6, label: "ball" },
        { kind: "line", at: [0, 0, 0], to: [0, 30, 0] },
        { kind: "label", at: [0, 40, 0], text: "up" },
      ],
    });
    expect(s.camera).toEqual({ yaw: 35, pitch: 25 });
    expect(s.objects[0].size).toEqual([10, 10, 10]);
    expect(s.objects[3].label).toBe("up");
    expect(() => checkShape({ kind: "scene3d", x: 0, y: 0, w: 99, h: 99, objects: [] })).toThrow(
      /objects/,
    );
    expect(() =>
      checkShape({
        kind: "scene3d",
        x: 0,
        y: 0,
        w: 99,
        h: 99,
        objects: [{ kind: "box", at: [0, 0, 500] }],
      }),
    ).toThrow(/objects\[0\]\.at\[2\]: a number from -100 to 100/);
  });
});

describe("the board", () => {
  it("shows content as the first step", () => {
    const b = shown({ say: "A tiny function" });
    expect(b).toMatchObject({
      title: "add",
      step: 0,
      steps: [{ say: "A tiny function" }],
      shapes: [],
    });
    expect(b.content.lines).toHaveLength(3);
    expect(isBoard(b)).toBe(true);
    expect(isBoard({ steps: [] })).toBe(false);
  });

  it("adds a step for each say, and shows it", () => {
    let { board: b, ids } = draw(shown(), {
      say: "It takes two numbers",
      shapes: [
        { kind: "highlight", line: 1, cols: [14, 17] },
        { kind: "note", id: "n", x: 600, y: 56, text: "a and b" },
      ],
    });
    expect(ids).toEqual(["s1", "n"]);
    expect(b.steps).toHaveLength(2);
    expect(b.step).toBe(1);
    expect(b.shapes.map((s) => s.step)).toEqual([1, 1]);
    // Without a say, shapes join the last step and the step shown stays.
    b = goTo(b, 0);
    ({ board: b } = draw(b, {
      shapes: [{ kind: "arrow", from: { shape: "n" }, to: { line: 1, col: 15 } }],
    }));
    expect(b.shapes.at(-1)).toMatchObject({ id: "s2", step: 1 });
    expect(b.step).toBe(0);
  });

  it("replaces a shape drawn again with its id, in its own step", () => {
    let { board: b } = draw(shown(), {
      say: "one",
      shapes: [{ kind: "box", id: "k", x: 600, y: 60, w: 100, h: 40 }],
    });
    ({ board: b } = draw(b, {
      say: "two",
      shapes: [{ kind: "box", id: "k", x: 700, y: 60, w: 100, h: 40, label: "moved" }],
    }));
    expect(b.shapes).toHaveLength(1);
    expect(b.shapes[0]).toMatchObject({ x: 700, label: "moved", step: 1 });
  });

  it("refuses arrows at lines or shapes that aren't there", () => {
    expect(() =>
      draw(shown(), { shapes: [{ kind: "arrow", from: [700, 50], to: { line: 9 } }] }),
    ).toThrow("shapes[0].to.line: there's no line 9 on the board (lines 1 to 3)");
    expect(() => draw(emptyBoard(), { shapes: [{ kind: "highlight", line: 1 }] })).toThrow(
      /show some content first/,
    );
    expect(() =>
      draw(shown(), { shapes: [{ kind: "arrow", from: { shape: "ghost" }, to: [0, 0] }] }),
    ).toThrow(/no shape "ghost"/);
    expect(() => draw(shown(), { shapes: [] })).toThrow(/at least one shape/);
  });

  it("ends arrows on the side facing the other end, or just after a line's text", () => {
    const { board: b } = draw(shown(), {
      shapes: [
        { kind: "box", id: "k", x: 600, y: 56, w: 100, h: 44 },
        { kind: "arrow", id: "a", from: { shape: "k" }, to: { line: 2 } },
      ],
    });
    const find = (id) => b.shapes.find((s) => s.id === id);
    const [from, to] = endsOf(find("a"), find, b.content);
    // The box's left side, at its middle.
    expect(from).toEqual([600, 78]);
    // Just after "  return a + b;" (15 characters) on line 2, at its middle.
    expect(to).toEqual([TEXT_X + 15 * CHAR_W + 6, CONTENT_TOP + LINE_H + LINE_H / 2]);
  });

  it("erases shapes, the arrows to them, a step or everything", () => {
    let { board: b } = draw(shown(), {
      say: "s",
      shapes: [
        { kind: "box", id: "k", x: 600, y: 56, w: 100, h: 44 },
        { kind: "arrow", from: { shape: "k" }, to: { line: 2 } },
        { kind: "note", x: 600, y: 200, text: "stays" },
      ],
    });
    expect(erase(b, { ids: ["k"] }).shapes.map((s) => s.kind)).toEqual(["note"]);
    expect(erase(b, { step: 1 }).shapes).toEqual([]);
    const all = erase(b, { all: true });
    expect(all).toMatchObject({ shapes: [], step: 0, steps: [{ say: null }] });
    expect(all.content).toEqual(b.content);
    expect(() => erase(b, {})).toThrow(/ids/);
  });

  it("starts over with new content, or adds lines with append", () => {
    const { board: b } = draw(shown(), { say: "s", shapes: [{ kind: "highlight", line: 1 }] });
    const again = show(b, { text: "x = 1" });
    expect(again.shapes).toEqual([]);
    expect(again.steps).toHaveLength(1);
    const more = show(b, { text: "// more", append: true });
    expect(more.content.lines).toHaveLength(4);
    expect(more.shapes).toHaveLength(1);
  });

  it("refuses to grow past what one message can carry", () => {
    let b = show(emptyBoard(), { text: "x" });
    const notes = Array.from({ length: 100 }, (_, i) => ({
      kind: "note",
      x: 600,
      y: 60 + i,
      text: "n".repeat(600),
    }));
    ({ board: b } = draw(b, { shapes: notes }));
    ({ board: b } = draw(b, { shapes: notes }));
    expect(new TextEncoder().encode(JSON.stringify(b)).length).toBeLessThan(MAX_BOARD_BYTES);
    // A third hundred of long notes would take it past the limit.
    expect(() => draw(b, { shapes: notes })).toThrow(/The board is full/);
    // And no more than 300 shapes, however small.
    const dots = Array.from({ length: 100 }, () => ({ kind: "text", x: 1, y: 1, text: "." }));
    let small = show(emptyBoard(), { text: "x" });
    for (let i = 0; i < 3; i++) ({ board: small } = draw(small, { shapes: dots }));
    expect(() => draw(small, { shapes: [dots[0]] })).toThrow(/at most 300 on the board/);
  });

  it("numbers the user's asks and ignores empty ones", () => {
    const b = shown();
    expect(ask(b, {})).toBe(b);
    expect(ask(b, { line: 99 })).toBe(b);
    const one = ask(b, { line: 2, question: " why + ? " });
    expect(one.asked).toEqual({ n: 1, line: 2, question: "why + ?" });
    expect(ask(one, { question: "and then?" }).asked).toEqual({ n: 2, question: "and then?" });
  });

  it("clamps steps", () => {
    const { board: b } = draw(shown(), { say: "s", shapes: [{ kind: "highlight", line: 1 }] });
    expect(goTo(b, 9).step).toBe(1);
    expect(goTo(b, -3).step).toBe(0);
  });

  it("describes itself for an agent, with each shape's box", () => {
    const { board: b } = draw(shown(), {
      say: "s",
      shapes: [{ kind: "box", id: "k", x: 600, y: 56, w: 100, h: 44 }],
    });
    const d = describeBoard(b, { lines: true });
    expect(d.content).toMatchObject({
      from: 1,
      to: 3,
      lines: ["function add(a, b) {", "  return a + b;", "}"],
    });
    expect(d.shapes[0].box).toEqual({ x: 600, y: 56, w: 100, h: 44 });
    expect(d.steps).toEqual([
      { n: 0, say: null, shapes: 0 },
      { n: 1, say: "s", shapes: 1 },
    ]);
    expect(d.how.length).toBeGreaterThan(2);
    expect(describeBoard(b).content.lines).toBeUndefined();
  });
});
