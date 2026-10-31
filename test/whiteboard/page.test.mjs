// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — the built page
 *
 * page/index.html with the built page/main.js in a jsdom window and a fake
 * Tilefold bridge, sent boards as the tile sends them: an empty board says
 * how to start, content shows as numbered lines, the shapes of the steps up
 * to the one shown are drawn (the newest fading in) with the step's caption,
 * and Back and Next ask the tile for the other steps. A click on a line or
 * a drawing points at it, Ask sends it with the question, a 3D scene turns
 * when dragged without pointing at it, colors are only palette classes, and
 * text an agent wrote is never read as markup.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { draw, emptyBoard, goTo, show } from "../../examples/whiteboard/src/board.js";
import { PAGE_KEYS } from "../../examples/whiteboard/src/strings.js";

const PAGE = fileURLToPath(new URL("../../examples/whiteboard/page/", import.meta.url));
const HTML = readFileSync(`${PAGE}index.html`, "utf8").replace(/<script[^>]*><\/script>/, "");
const SCRIPT = readFileSync(`${PAGE}main.js`, "utf8");

/** English labels as the tile sends them, with the page's own marks. */
const ftl = readFileSync(
  fileURLToPath(new URL("../../examples/whiteboard/locales/en/tile.ftl", import.meta.url)),
  "utf8",
);
const english = new Map([...ftl.matchAll(/^([a-z][\w-]*) = (.*)$/gm)].map((m) => [m[1], m[2]]));
const LABELS = Object.fromEntries(
  PAGE_KEYS.map((k) => [k, english.get(k).replace(/\{ \$(\w+) \}/g, "{$1}")]),
);

const windows = [];
afterEach(() => {
  for (const w of windows.splice(0)) w.close();
});

/** The page in its own window, talking to a fake tile. */
function page({ theme = null } = {}) {
  const dom = new JSDOM(HTML, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  windows.push(w);
  const posted = [];
  let listener = null;
  w.tilefold = {
    theme,
    post: async (m) => void posted.push(structuredClone(m)),
    onMessage: (fn) => {
      listener = fn;
      return () => {};
    },
    onTheme: () => () => {},
  };
  w.eval(SCRIPT);
  const $ = (id) => w.document.getElementById(id);
  return {
    w,
    $,
    posted,
    setup: (board) => listener({ do: "setup", labels: LABELS, board }),
    send: (board) => listener({ do: "board", board }),
    click: (node) => node.dispatchEvent(new w.MouseEvent("click", { bubbles: true })),
  };
}

const CODE = "let total = 0;\nfor (const x of xs) total += x;\nreturn total;";

/** A board with content and two steps, shown at `step`. */
function explained(step = 2) {
  let b = show(emptyBoard(), { text: CODE, title: "Sum", say: "Adds up a list" });
  ({ board: b } = draw(b, {
    say: "Start at zero",
    shapes: [
      { kind: "highlight", line: 1, color: "green", label: "start" },
      { kind: "note", id: "n", x: 640, y: 56, text: "<b>not bold</b>" },
    ],
  }));
  ({ board: b } = draw(b, {
    say: "Add each one",
    shapes: [
      {
        kind: "arrow",
        id: "a",
        from: { shape: "n" },
        to: { line: 2 },
        color: "red",
        label: "loop",
      },
    ],
  }));
  return goTo(b, step);
}

describe("the page", () => {
  it("says hello, then how to start on an empty board", () => {
    const p = page();
    expect(p.posted).toEqual([{ type: "hello" }]);
    p.setup(emptyBoard());
    expect(p.$("empty").hidden).toBe(false);
    expect(p.$("board").hasAttribute("hidden")).toBe(true);
    expect(p.$("empty-title").textContent).toBe("Nothing to explain yet");
    expect(p.$("steps").hidden).toBe(true);
  });

  it("shows only the agent's words when it points on the panes without content", () => {
    const p = page();
    p.setup(draw(emptyBoard(), { shapes: [], say: "This line stops the build" }).board);
    expect(p.$("empty").hidden).toBe(true);
    expect(p.$("board").hasAttribute("hidden")).toBe(true);
    expect(p.$("caption").textContent).toBe("This line stops the build");
  });

  it("draws the content as numbered lines, and the steps up to the one shown", () => {
    const p = page();
    p.setup(explained(1));
    expect(p.$("board").hasAttribute("hidden")).toBe(false);
    expect(p.$("title").textContent).toBe("Sum");
    const lines = [...p.$("board").querySelectorAll(".line")];
    expect(lines.map((l) => l.querySelector(".num").textContent)).toEqual(["1", "2", "3"]);
    expect(lines[1].querySelector(".code").textContent).toBe("for (const x of xs) total += x;");
    // Step 1: the highlight and the note, not yet the arrow.
    expect(p.$("board").querySelector(".k-highlight.c-green")).not.toBeNull();
    expect(p.$("board").querySelector('[data-shape="a"]')).toBeNull();
    expect(p.$("caption").textContent).toBe("Start at zero");
    expect(p.$("count").textContent).toBe("Step 1 of 2");
    // Back and Next say which way they go.
    expect(p.$("back").textContent).toBe("\u2190 Back");
    expect(p.$("next").textContent).toBe("Next \u2192");
    // Highlights sit under the text.
    expect(p.$("board").querySelector(".under .k-highlight")).not.toBeNull();
  });

  it("fades in a step newly reached, draws the arrow with its head and label", () => {
    const p = page();
    p.setup(explained(1));
    p.send(explained(2));
    const arrow = p.$("board").querySelector('[data-shape="a"]');
    expect(arrow.classList.contains("fresh")).toBe(true);
    expect(arrow.querySelector("path").getAttribute("marker-end")).toBe("url(#head-red)");
    expect(arrow.querySelector(".on-line").textContent).toBe("loop");
    expect(p.$("board").querySelector("#head-red")).not.toBeNull();
    expect(p.$("next").disabled).toBe(true);
  });

  it("never reads an agent's text as markup", () => {
    const p = page();
    p.setup(explained(2));
    const note = p.$("board").querySelector('[data-shape="n"]');
    expect(note.querySelector("b")).toBeNull();
    expect(note.textContent).toContain("<b>not");
  });

  it("asks the tile for the other steps", () => {
    const p = page();
    p.setup(explained(1));
    p.click(p.$("next"));
    p.click(p.$("back"));
    expect(p.posted.slice(1)).toEqual([
      { type: "step", n: 2 },
      { type: "step", n: 0 },
    ]);
    p.$("board").dispatchEvent(
      new p.w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(p.posted.at(-1)).toEqual({ type: "step", n: 2 });
  });

  it("points at a line or a drawing, and asks about it", async () => {
    const p = page();
    p.setup(explained(2));
    p.click(p.$("board").querySelector('[data-line="2"] .hit'));
    expect(p.$("pointing").hidden).toBe(false);
    expect(p.$("pointed").textContent).toBe("Line 2");
    p.$("question").value = "why +=?";
    p.$("ask").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
    expect(p.posted.at(-1)).toEqual({ type: "ask", line: 2, question: "why +=?" });
    expect(p.$("ask-status").textContent).toMatch(/^Asked/);
    expect(p.$("pointing").hidden).toBe(true);
    // A drawing, then the same one again to stop pointing.
    const note = p.$("board").querySelector('[data-shape="n"] rect');
    p.click(note);
    expect(p.$("pointed").textContent).toBe("This drawing");
    p.click(note);
    expect(p.$("pointing").hidden).toBe(true);
    // Nothing pointed at and no question: nothing to send.
    const before = p.posted.length;
    p.$("ask").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
    expect(p.posted.length).toBe(before);
  });

  it("turns a 3D scene by dragging it, without pointing at it", () => {
    const p = page();
    let b = show(emptyBoard(), { text: "cube" });
    ({ board: b } = draw(b, {
      shapes: [
        {
          kind: "scene3d",
          id: "cube",
          x: 600,
          y: 60,
          w: 300,
          h: 260,
          objects: [{ kind: "box", at: [0, 0, 0], color: "blue" }],
        },
      ],
    }));
    p.setup(b);
    const scene = () => p.$("board").querySelector('[data-shape="cube"]');
    const faces = () =>
      [...scene().querySelectorAll("polygon")].map((f) => f.getAttribute("points")).join("|");
    expect(scene().querySelectorAll("polygon").length).toBe(3);
    expect(scene().querySelector(".scene-hint").textContent).toBe("Drag to turn");
    const before = faces();
    const fire = (type, x) =>
      scene()
        .querySelector("polygon")
        .dispatchEvent(new p.w.MouseEvent(type, { bubbles: true, clientX: x, clientY: 10 }));
    // jsdom has no PointerEvent: pointer events are mouse events with a pointer type.
    for (const [type, x] of [
      ["pointerdown", 10],
      ["pointermove", 60],
      ["pointerup", 60],
      ["click", 60],
    ]) {
      fire(type, x);
    }
    expect(faces()).not.toBe(before);
    expect(p.$("pointing").hidden).toBe(true);
  });

  it("follows Tilefold's light or dark, and speaks right to left", () => {
    const p = page({ theme: { mode: "dark", colors: {} } });
    expect(p.w.document.documentElement.dataset.mode).toBe("dark");
    expect(page().w.document.documentElement.dataset.mode).toBeUndefined();
    const rtl = page();
    rtl.setup.call(null, emptyBoard());
    expect(rtl.w.document.documentElement.dir).toBe("ltr");
    // The Arabic labels say right to left.
    const ar = readFileSync(
      fileURLToPath(new URL("../../examples/whiteboard/locales/ar/tile.ftl", import.meta.url)),
      "utf8",
    );
    expect(ar).toMatch(/^page-dir = rtl$/m);
    Object.assign(LABELS, { "page-dir": "rtl", "page-lang": "ar" });
    try {
      const arabic = page();
      arabic.setup(emptyBoard());
      expect(arabic.w.document.documentElement.dir).toBe("rtl");
      expect(arabic.w.document.documentElement.lang).toBe("ar");
      // The arrows follow the direction: Back points right, Next points left.
      expect(arabic.$("back").textContent).toMatch(/^\u2192 /);
      expect(arabic.$("next").textContent).toMatch(/ \u2190$/);
    } finally {
      Object.assign(LABELS, { "page-dir": "ltr", "page-lang": "en" });
    }
  });

  it("uses only palette classes for colors", () => {
    const p = page();
    p.setup(explained(2));
    const html = p.$("board").outerHTML;
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
    for (const node of p.$("board").querySelectorAll(".shape")) {
      expect(
        [...node.classList].some((c) =>
          /^c-(accent|red|orange|yellow|green|teal|blue|purple|gray)$/.test(c),
        ),
      ).toBe(true);
    }
  });
});
