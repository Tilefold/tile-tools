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
 * a save didn't go), and offers Remove only for a case being edited. The
 * chip names what to fix before the language. Asked before a check, the
 * menu shows first with its heading, and closing it tells the tile. With a
 * case picked, the prompt's button applies it by name.
 *
 * Modified 2026-11-07 (pick before checking): the chip's order, and the
 *   menu asked before the check.
 * Modified 2026-11-07 (case rework): a rework's changes have their own
 *   ✕ and ↺ buttons; a click on the text does nothing there.
 * Modified 2026-11-08 (apply a case): the write step's Apply button.
 * Modified 2026-11-08 (menu divider): a line between the cases and Edit / Add.
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
    expect(p.$("chip").textContent).toBe("Video editing · 한국어");
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

describe("what to fix, asked before the check", () => {
  const ASKED = { ...CASES, draft: "make a cut", input: true, choosing: true };

  it("shows the menu first, saying the pick starts the check", () => {
    const p = page();
    ready(p, ASKED);
    expect(p.$("body").querySelector(".case-title").textContent).toBe(t("label-mode-choose"));
    expect(items(p).map((b) => b.textContent)).toContain("Video editing");
    expect(p.$("draft")).toBeNull();
    p.click(items(p)[2]);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "mode", to: "case:Video editing" });
  });

  it("closes with Cancel, the chip or Escape, telling the tile", () => {
    for (const close of [
      (p) => p.click(p.$("foot").querySelector("button")),
      (p) => p.click(p.$("chip")),
      (p) => p.w.document.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Escape" })),
    ]) {
      const p = page();
      ready(p, ASKED);
      close(p);
      expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "choose-skip" });
      expect(p.posted.some((m) => m.type === "fold")).toBe(false);
      // The tile answers with the prompt, no longer asking.
      p.tell({ do: "show", view: viewFor({ ...ASKED, choosing: false }) });
      expect(p.$("draft").value).toBe("make a cut");
    }
  });
});

describe("the menu's divider", () => {
  it("sits between the last case and Edit / Add", () => {
    const p = page();
    ready(p, { ...CASES, modeId: "case:Video editing", caseName: "Video editing" });
    p.click(p.$("chip"));
    const kids = [...p.$("body").querySelector(".menu").children];
    const line = kids.findIndex((k) => k.matches("hr.menu-line"));
    expect(kids.filter((k) => k.matches("hr.menu-line"))).toHaveLength(1);
    expect(kids[line - 1].textContent).toBe("Video editing");
    expect(kids.slice(line + 1).map((k) => k.textContent)).toEqual([
      t("label-edit-case", { name: "Video editing" }),
      t("label-add-case"),
    ]);
  });
});

describe("applying a case picked", () => {
  it("names the case on the prompt's button, which starts the check", () => {
    const p = page();
    ready(p, { ...CASES, modeId: "case:Video editing", caseName: "Video editing", draft: "a cut" });
    const go = p.$("foot").querySelector(".btn.primary");
    expect(go.textContent).toBe("Apply “Video editing”");
    expect(go.classList.contains("apply")).toBe(true);
    p.click(go);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "check", text: "a cut" });
  });

  it("keeps Check for the built-in modes", () => {
    const p = page();
    ready(p, { ...CASES, draft: "a cut" });
    expect(p.$("foot").querySelector(".btn.primary").textContent).toBe(t("label-check"));
  });
});

describe("a case's rework", () => {
  const REWORK = {
    ...CASES,
    modeId: "case:Video editing",
    caseName: "Video editing",
    step: "result",
    draft: "for it?",
    parts: [
      { id: 1, del: "for", ins: "For" },
      { same: " it?" },
      { id: 2, del: "", ins: " Make it 15 seconds." },
    ],
  };
  const changesOf = (p) => [...p.$("body").querySelectorAll(".chg")];

  it("undoes a change only with its own ✕, never by a click on the text", () => {
    const p = page();
    ready(p, REWORK);
    expect(p.$("body").querySelector(".diff").classList.contains("rework")).toBe(true);
    expect(p.$("body").textContent).toContain(t("label-click-hint-rework"));
    const [, second] = changesOf(p);
    expect(second.getAttribute("role")).toBeNull();
    p.click(second.querySelector("ins"));
    expect(p.posted.some((m) => m.type === "toggle")).toBe(false);
    const x = second.querySelector("button.chg-x");
    expect(x.textContent).toBe("✕");
    expect(x.getAttribute("aria-label")).toBe(t("label-undo-change"));
    p.click(x);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "toggle", id: 2 });
  });

  it("keeps an undone addition in sight, with ↺ to bring it back", () => {
    const p = page();
    ready(p, { ...REWORK, rejected: new Set([2]) });
    const second = changesOf(p)[1];
    expect(second.classList.contains("off")).toBe(true);
    expect(second.querySelector("ins").textContent).toBe(" Make it 15 seconds.");
    const x = second.querySelector("button.chg-x");
    expect(x.textContent).toBe("↺");
    expect(x.title).toBe(t("label-restore-change"));
  });

  it("keeps click-to-undo for the built-in modes", () => {
    const p = page();
    ready(p, { ...REWORK, modeId: "fix", caseName: "" });
    const [first] = changesOf(p);
    expect(first.getAttribute("role")).toBe("button");
    expect(first.querySelector("button")).toBeNull();
    p.click(first);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "toggle", id: 1 });
  });
});
