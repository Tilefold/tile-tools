// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish page — what to fix, and the user's own cases
 *
 * The chip names what to fix and opens its menu in the card's body: the
 * built-in modes and the user's cases, the one in use checked; a pick is
 * sent and closes the menu, as does Cancel or Escape. Editing is offered
 * for a case in use, adding always, or where to add cases in Settings when
 * this Tilefold can't save them from the card. The case form sends what
 * was typed, keeps it when the tile draws the form again (with the reason
 * a save didn't go), and offers Remove only for a case being edited.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { languageOf } from "../../examples/prompt-polish/src/languages.js";
import { setupOf, viewOf } from "../../examples/prompt-polish/src/view.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const HTML = readFileSync(`${DIR}page/index.html`, "utf8")
  .replace(/<script[^>]*><\/script>/, "")
  .replace(/<link[^>]*>/, "");
const SCRIPT = readFileSync(`${DIR}page/main.js`, "utf8");
const ftl = readFileSync(`${DIR}locales/en/tile.ftl`, "utf8");
const english = new Map([...ftl.matchAll(/^([a-z][\w-]*) = (.*)$/gm)].map((m) => [m[1], m[2]]));
/** The tile's `tf.t`, in English. */
const t = (key, args = {}) =>
  english.get(key).replace(/\{ \$(\w+) \}/g, (_, n) => String(args[n] ?? ""));

const windows = [];
afterEach(() => {
  for (const w of windows.splice(0)) w.close();
});

/** The page in its own window, talking to a fake tile. */
function page() {
  const dom = new JSDOM(HTML, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  windows.push(w);
  const posted = [];
  let listener = null;
  w.tilefold = {
    theme: null,
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
    tell: (m) => listener(m),
    click: (node) => node.dispatchEvent(new w.MouseEvent("click", { bubbles: true })),
    frame: () => new Promise((r) => w.requestAnimationFrame(() => r())),
  };
}

/** A state as the tile keeps it, made into the view it sends. */
const viewFor = (s) =>
  viewOf(
    {
      pane: "p1",
      draft: "",
      parts: [],
      notes: [],
      rejected: new Set(),
      clean: false,
      problem: "",
      view: "bottom",
      mode: "fix",
      language: languageOf("ko", "en"),
      ...s,
    },
    t,
  );

const ready = (p, s = {}) => {
  p.tell({ do: "setup", ...setupOf(t) });
  p.tell({ do: "show", view: viewFor(s) });
};

const CASES = { cases: ["Video editing"], canEditCases: true };
const items = (p) => [...p.$("body").querySelectorAll(".menu-item")];

describe("the menu of what to fix", () => {
  it("opens from the chip with the modes and cases, the one in use checked", () => {
    const p = page();
    ready(p, { ...CASES, modeId: "case:Video editing", caseName: "Video editing" });
    expect(p.$("chip").textContent).toBe("한국어 · Video editing");
    expect(p.$("chip").getAttribute("aria-expanded")).toBe("false");
    p.click(p.$("chip"));
    expect(p.$("chip").getAttribute("aria-expanded")).toBe("true");
    const labels = items(p).map((b) => b.textContent);
    expect(labels).toEqual([
      "Mistakes only",
      expect.any(String),
      "Video editing",
      "Edit “Video editing”…",
      "Add your own…",
    ]);
    const checked = items(p).filter((b) => b.getAttribute("aria-checked") === "true");
    expect(checked.map((b) => b.textContent)).toEqual(["Video editing"]);
  });

  it("sends a pick and closes; Cancel and Escape close it too", () => {
    const p = page();
    ready(p, CASES);
    p.click(p.$("chip"));
    p.click(items(p)[1]);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "mode", to: "natural" });
    expect(p.$("body").querySelector(".menu")).toBeNull();
    p.click(p.$("chip"));
    p.click(p.$("foot").querySelector("button"));
    expect(p.$("body").querySelector(".menu")).toBeNull();
    p.click(p.$("chip"));
    p.w.document.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Escape" }));
    expect(p.$("body").querySelector(".menu")).toBeNull();
    // Escape closed only the menu: the card wasn't folded.
    expect(p.posted.some((m) => m.type === "fold")).toBe(false);
  });

  it("offers adding a case, or says where to, on a Tilefold that can't save them", () => {
    const p = page();
    ready(p, CASES);
    p.click(p.$("chip"));
    p.click(items(p).at(-1));
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "case-edit", was: null });
    const old = page();
    ready(old, { cases: [], canEditCases: false });
    old.click(old.$("chip"));
    expect(items(old)).toHaveLength(2);
    expect(old.$("body").textContent).toContain("Settings → Tiles → Prompt Polish");
  });
});

describe("the case form", () => {
  const editing = (e) => ({ ...CASES, editing: { was: null, name: "", rules: "", why: "", ...e } });

  it("sends what was typed, and keeps it when drawn again with a reason", () => {
    const p = page();
    ready(p, editing({}));
    const form = p.$("body").querySelector("form.case");
    form.elements.namedItem("name").value = "Email";
    form.elements.namedItem("rules").value = "Keep it short.";
    p.click(p.$("foot").querySelector(".primary"));
    expect(p.posted.at(-1)).toEqual({
      pane: "p1",
      type: "case-save",
      name: "Email",
      rules: "Keep it short.",
    });
    // The tile draws the form again, saying why: what was typed stays.
    p.tell({ do: "show", view: viewFor(editing({ why: "case-name-taken" })) });
    const again = p.$("body").querySelector("form.case");
    expect(again.elements.namedItem("name").value).toBe("Email");
    expect(p.$("body").querySelector("[role=alert]").textContent).toBe(
      "You already have a case with this name.",
    );
    // No Remove for a new case.
    expect(p.$("foot").textContent).not.toContain("Remove");
  });

  it("edits a case, with Remove and Cancel", () => {
    const p = page();
    ready(p, editing({ was: "Video editing", name: "Video editing", rules: "Say it." }));
    const form = p.$("body").querySelector("form.case");
    expect(form.elements.namedItem("rules").value).toBe("Say it.");
    const [remove] = p.$("foot").querySelectorAll("button");
    p.click(remove);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "case-remove", name: "Video editing" });
    p.w.document.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Escape" }));
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "case-cancel" });
  });
});
