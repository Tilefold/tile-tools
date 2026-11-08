// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith page — what to fix, and the user's own cases
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
 * Modified 2026-11-08 (edit any case): Edit… above Add with no case in use,
 *   asking which case first.
 * Modified 2026-11-08 (translations): a case's translations under the
 *   fixes, with Copy and Use this / Send this; the form's languages field.
 * Modified 2026-11-08 (built-in translations): Edit for the built-in case
 *   in use, Edit another case…, and the built-in case's form (its name,
 *   a note, the languages field; Save and Cancel, no Remove).
 * Modified 2026-11-08 (any language): the languages field's help, and what
 *   it reads as the user types (each language's own name and code, what it
 *   doesn't recognize, and a note past eight).
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
    expect(old.$("body").textContent).toContain("Settings → Tiles → Promptsmith");
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
      translate: "",
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
    expect(p.$("body").querySelector(".menu-ask").textContent).toBe(t("label-mode-choose"));
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

describe("editing a case with a built-in one in use", () => {
  it("edits the built-in one, or asks which own case with Edit another", () => {
    const p = page();
    ready(p, { cases: ["Video editing", "Email"], canEditCases: true });
    p.click(p.$("chip"));
    const tail = items(p).slice(-3);
    expect(tail.map((b) => b.textContent)).toEqual([
      t("label-edit-case", { name: t("setting-mode-fix") }),
      t("label-edit-another"),
      t("label-add-case"),
    ]);
    p.click(tail[0]);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "case-edit", builtin: "fix" });
    p.click(p.$("chip"));
    const before = p.posted.length;
    p.click(items(p).slice(-2)[0]);
    expect(p.posted.slice(before).some((m) => m.type === "case-edit")).toBe(false);
    expect(p.$("body").querySelector(".menu-ask").textContent).toBe(t("label-edit-which"));
    expect(items(p).map((b) => b.textContent)).toEqual(["Video editing", "Email"]);
    p.click(items(p)[1]);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "case-edit", was: "Email" });
  });

  it("goes back to the menu from Cancel", () => {
    const p = page();
    ready(p, { cases: ["Video editing"], canEditCases: true });
    p.click(p.$("chip"));
    p.click(items(p).at(-2));
    p.click(p.$("foot").querySelector("button"));
    expect(items(p).at(-1).textContent).toBe(t("label-add-case"));
  });

  it("isn't offered without cases", () => {
    const p = page();
    ready(p, { cases: [], canEditCases: true });
    p.click(p.$("chip"));
    expect(items(p).map((b) => b.textContent)).not.toContain(t("label-edit-cases"));
  });
});

describe("a case's translations", () => {
  const RESULT = {
    ...CASES,
    modeId: "case:Video editing",
    caseName: "Video editing",
    step: "result",
    draft: "for it",
    parts: [{ id: 1, del: "for", ins: "For" }, { same: " it" }],
    translations: [{ code: "ja", text: "それのために" }],
  };

  it("shows each under the fixes, in its language, with Send this", () => {
    const p = page();
    ready(p, RESULT);
    const tl = p.$("body").querySelector(".translations .tl");
    expect(tl.querySelector(".tl-lang").textContent).toBe("日本語 · ja");
    const text = tl.querySelector(".tl-text");
    expect(text.textContent).toBe("それのために");
    expect(text.lang).toBe("ja");
    const go = [...tl.querySelectorAll("button")].find(
      (b) => b.textContent === t("label-send-this"),
    );
    p.click(go);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "send", translation: "ja" });
  });

  it("offers Use this for a prompt from the agent input box", () => {
    const p = page();
    ready(p, { ...RESULT, input: true });
    const labels = [...p.$("body").querySelectorAll(".tl button")].map((b) => b.textContent);
    expect(labels).toEqual([t("label-copy"), t("label-use-this")]);
  });

  it("shows none without translations", () => {
    const p = page();
    ready(p, { ...RESULT, translations: [] });
    expect(p.$("body").querySelector(".translations")).toBeNull();
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

describe("the form for a built-in case", () => {
  it("shows its name and a note, only the languages field, and no Remove", () => {
    const p = page();
    ready(p, { ...CASES, editing: { builtin: "natural", translate: "ja, ko", why: "" } });
    const form = p.$("body").querySelector("form.case");
    expect(form.querySelector(".case-title").textContent).toBe(t("label-case-builtin"));
    expect(form.querySelector(".case-name").textContent).toBe(t("setting-mode-natural"));
    expect(form.textContent).toContain(t("label-case-builtin-note"));
    expect(form.querySelector("textarea")).toBeNull();
    expect(form.querySelector("input[name=name]")).toBeNull();
    expect(form.elements.namedItem("translate").value).toBe("ja, ko");
    const labels = [...p.$("foot").querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toEqual([t("label-cancel"), t("label-case-save")]);
  });

  it("saves the languages typed, keeping them over a redraw", () => {
    const p = page();
    const s = { ...CASES, editing: { builtin: "fix", translate: "", why: "" } };
    ready(p, s);
    const field = p.$("body").querySelector("form.case").elements.namedItem("translate");
    field.value = "fr, es";
    p.tell({ do: "show", view: viewFor(s) });
    const again = p.$("body").querySelector("form.case").elements.namedItem("translate");
    expect(again.value).toBe("fr, es");
    p.click([...p.$("foot").querySelectorAll("button")].at(-1));
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "case-save", translate: "fr, es" });
  });

  it("shows why a save didn't go", () => {
    const p = page();
    ready(p, { ...CASES, editing: { builtin: "fix", translate: "ja", why: "case-not-saved" } });
    expect(p.$("body").querySelector("[role=alert]").textContent).toBe(t("case-not-saved"));
  });
});

describe("the polish agent's buttons", () => {
  it("offers Show its tab while it starts", () => {
    const p = page();
    ready(p, { step: "agent", helper: true, helperStage: "starting", canShowHelper: true });
    const show = [...p.$("foot").querySelectorAll("button")].find(
      (b) => b.textContent === t("label-helper-show"),
    );
    p.click(show);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "helper-show" });
  });

  it("offers Show and Restart when it didn't start, and nothing on an older Tilefold", () => {
    const p = page();
    ready(p, { step: "problem", problem: "error-helper-not-started", canShowHelper: true });
    const labels = [...p.$("foot").querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toEqual([t("label-back"), t("label-helper-restart"), t("label-helper-show")]);
    const old = page();
    ready(old, { step: "problem", problem: "error-helper-not-started" });
    expect([...old.$("foot").querySelectorAll("button")]).toHaveLength(1);
  });
});

describe("the languages field", () => {
  /** Types `text` in the open form's languages field. */
  const type = (p, text) => {
    const field = p.$("body").querySelector("form.case").elements.namedItem("translate");
    field.value = text;
    field.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    return p.$("body").querySelector(".tl-reads");
  };

  it("says how to name the languages, and reads them as the user types", () => {
    const p = page();
    ready(p, { ...CASES, editing: { builtin: "fix", translate: "ja", why: "" } });
    const form = p.$("body").querySelector("form.case");
    expect(form.querySelector(".tl-help").textContent).toBe(t("label-case-translate-help"));
    expect(form.querySelector(".tl-reads").textContent).toBe(
      `${t("label-translate-preview")} 日本語 · ja`,
    );
    const reads = type(p, "Vietnamese, pt-pt, Elvish");
    expect(reads.textContent).toBe(
      `${t("label-translate-preview")} Tiếng Việt · vi, ${"português europeu"} · pt-PT ` +
        t("label-translate-unknown", { words: "Elvish" }),
    );
    expect(reads.classList.contains("warn")).toBe(true);
  });

  it("notes when there are more than eight, and is quiet when empty", () => {
    const p = page();
    ready(p, { ...CASES, editing: { was: null, name: "", rules: "", translate: "", why: "" } });
    expect(type(p, "").textContent).toBe("");
    const reads = type(p, "vi, th, id, ms, sw, am, yo, zu, xh");
    expect(reads.textContent).toContain(t("label-translate-too-many", { max: 8 }));
    expect(reads.textContent.split(",")).toHaveLength(8);
  });

  it("sets what it reads as text only", () => {
    const p = page();
    ready(p, { ...CASES, editing: { builtin: "fix", translate: "", why: "" } });
    const reads = type(p, "<img src=x onerror=alert(1)>");
    expect(reads.querySelector("img")).toBeNull();
    expect(reads.textContent).toContain("<img");
  });
});
