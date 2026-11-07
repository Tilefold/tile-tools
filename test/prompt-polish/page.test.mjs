// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — the built page
 *
 * page/index.html with the built page/main.js in a jsdom window and a fake
 * Tilefold bridge, sent the setup and views the tile builds: it says hello,
 * draws the step to write in (sized in words, or characters for Japanese;
 * Check off while empty or too long), sends the draft and Check; draws the
 * fixes with a visible mark for a changed space, toggles a change, sends;
 * names the pane whose prompt it shows in every message, and sends a
 * draft still waiting to its own pane before drawing another pane's;
 * switches views and folds from its header; reports its height; and never
 * reads text from the tile (or from Claude) as markup.
 *
 * Modified 2026-11-07 (readable see-through card): text keeps a solid
 *   surface over the pane.
 * Modified 2026-11-06 (no-key mode): waiting for the agent with Cancel, and
 *   "Ask the agent instead" offered only for a missing key or Claude.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { languageOf } from "../../examples/prompt-polish/src/languages.js";
import { changes, diff } from "../../examples/prompt-polish/src/polish.js";
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

describe("the page", () => {
  it("says hello, then draws the step to write in with the tile's labels", () => {
    const p = page();
    expect(p.posted[0]).toEqual({ pane: null, type: "hello" });
    ready(p, { draft: "로그인 하면 안돼요" });
    expect(p.$("name").textContent).toBe("Prompt Polish");
    expect(p.$("where").textContent).toBe("over the pane");
    expect(p.$("chip").textContent).toBe("한국어 · Mistakes only");
    expect(p.$("draft").value).toBe("로그인 하면 안돼요");
    expect(p.$("foot").textContent).toContain("Words: 3");
    expect(p.$("views").querySelectorAll("button")).toHaveLength(3);
    expect(p.$("views").querySelector('[aria-pressed="true"]').title).toBe(
      "Over the agent's pane, above its input",
    );
  });

  it("sizes Japanese in characters, and turns Check off while empty or too long", () => {
    const p = page();
    ready(p, { language: languageOf("ja", "en"), draft: "バグを 直して" });
    expect(p.$("foot").textContent).toContain("Characters: 6");
    const area = p.$("draft");
    const check = [...p.$("foot").querySelectorAll("button")].find(
      (b) => b.textContent === "Check",
    );
    area.value = "";
    area.dispatchEvent(new p.w.Event("input"));
    expect(check.disabled).toBe(true);
    area.value = "x".repeat(2001);
    area.dispatchEvent(new p.w.Event("input"));
    expect(check.disabled).toBe(true);
    expect(p.$("body").querySelector(".warn").hidden).toBe(false);
  });

  it("sends the draft as the user types, and Check with the text", async () => {
    const p = page();
    ready(p);
    const area = p.$("draft");
    area.value = "고쳐 주세요";
    area.dispatchEvent(new p.w.Event("input"));
    await new Promise((r) => setTimeout(r, 350));
    expect(p.posted).toContainEqual({ pane: "p1", type: "draft", text: "고쳐 주세요" });
    p.click([...p.$("foot").querySelectorAll("button")].find((b) => b.textContent === "Check"));
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "check", text: "고쳐 주세요" });
  });

  it("draws the fixes with a mark for a changed space, toggles a change, and sends", () => {
    const p = page();
    const parts = changes(diff("로그인 하면", "로그인하면"));
    ready(p, {
      step: "result",
      parts,
      notes: [{ from: "로그인 하면", to: "로그인하면", kind: "spacing", why: "Written together." }],
    });
    const chg = p.$("body").querySelector(".chg");
    expect(chg.textContent).toBe("␣");
    expect(p.$("body").querySelector(".kind").textContent).toBe("spacing");
    expect(p.$("body").querySelector(".why").textContent).toBe("Written together.");
    p.click(chg);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "toggle", id: 1 });
    p.click(
      [...p.$("foot").querySelectorAll("button")].find((b) => b.textContent === "Send to agent"),
    );
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "send" });
  });

  it("switches views and folds from its header; the side dock has no fold", () => {
    const p = page();
    ready(p);
    p.click(p.$("views").querySelectorAll("button")[1]);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "view", to: "corner" });
    p.click(p.$("fold"));
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "fold" });
    p.tell({ do: "show", view: viewFor({ view: "side" }) });
    expect(p.$("fold").hidden).toBe(true);
    expect(p.$("where").textContent).toBe("beside the panes");
  });

  it("sends a draft still waiting to its own pane before drawing another pane's prompt", () => {
    const p = page();
    ready(p, { pane: "p1" });
    const area = p.$("draft");
    area.value = "첫 번째 창";
    area.dispatchEvent(new p.w.Event("input"));
    p.tell({ do: "show", view: viewFor({ pane: "p2", draft: "두 번째 창" }) });
    expect(p.posted).toContainEqual({ pane: "p1", type: "draft", text: "첫 번째 창" });
    expect(p.$("draft").value).toBe("두 번째 창");
    p.click([...p.$("foot").querySelectorAll("button")].find((b) => b.textContent === "Check"));
    expect(p.posted.at(-1)).toEqual({ pane: "p2", type: "check", text: "두 번째 창" });
  });

  it("waits for the agent in the pane, with Cancel", () => {
    const p = page();
    ready(p, { step: "agent", draft: "고쳐 주세요" });
    expect(p.$("body").textContent).toContain("Asked the agent to check your 한국어…");
    expect(p.$("body").textContent).toContain("Press Return on the ask card");
    const buttons = [...p.$("foot").querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Cancel"]);
    p.click(buttons[0]);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "cancel-agent" });
  });

  it("offers to ask the agent when there is no key, and only then", () => {
    const p = page();
    ready(p, { step: "problem", problem: "error-no-key", draft: "고쳐 주세요" });
    const ask = [...p.$("foot").querySelectorAll("button")].find(
      (b) => b.textContent === "Ask the agent instead",
    );
    p.click(ask);
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "agent-check" });
    ready(p, { step: "problem", problem: "error-refused", draft: "고쳐 주세요" });
    expect(p.$("foot").textContent).not.toContain("Ask the agent instead");
    ready(p, { step: "problem", problem: "error-no-key", draft: "  " });
    expect(p.$("foot").textContent).not.toContain("Ask the agent instead");
  });

  it("is see-through over the pane as the setting says, and solid elsewhere", () => {
    const p = page();
    const root = p.w.document.documentElement;
    ready(p, { solid: 70 });
    expect(root.classList.contains("see-through")).toBe(true);
    expect(root.style.getPropertyValue("--solid")).toBe("70%");
    ready(p, { solid: 100 });
    expect(root.classList.contains("see-through")).toBe(false);
    // Beside the panes the page isn't over anything: always solid.
    ready(p, { solid: 70, view: "side" });
    expect(root.classList.contains("see-through")).toBe(false);
    // Never below 30%, whatever it is told.
    ready(p, { solid: 5 });
    expect(root.style.getPropertyValue("--solid")).toBe("30%");
  });

  it("keeps every piece of text on a solid surface when see-through", () => {
    const css = readFileSync(`${DIR}page/polish.css`, "utf8");
    const rule = css.match(/([^{}]*)\{\s*background: var\(--bg\);\s*\}/g) ?? [];
    const solid = rule.find((r) => r.includes("see-through")) ?? "";
    for (const part of ["header", ".foot", ".body > *", ".notes li"]) {
      expect(solid).toContain(part);
    }
  });

  it("counts the polish agent's seconds while it works, with its hint", async () => {
    const p = page();
    const since = Date.now() - 5000;
    ready(p, {
      step: "agent",
      helper: true,
      helperName: "Claude Code",
      helperStage: "working",
      helperSince: since,
    });
    const body = () => p.$("body").textContent.replace(/[\u2068\u2069]/g, "");
    expect(body()).toContain("Claude Code is working on your 한국어…");
    expect(
      p
        .$("body")
        .querySelector(".elapsed")
        .textContent.replace(/[\u2068\u2069]/g, ""),
    ).toBe("5 s");
    expect(body()).toContain("It works in its own tab.");
    expect(p.$("body").querySelector(".shimmer")).not.toBeNull();
    // Getting it ready: no count yet, and the hint about its first questions.
    ready(p, { step: "agent", helper: true, helperName: "Codex", helperStage: "starting" });
    expect(body()).toContain("Getting Codex ready in its own tab…");
    expect(p.$("body").querySelector(".elapsed")).toBeNull();
  });

  it("offers Keep mine, Use and Send to agent for a prompt from the agent input box", () => {
    const p = page();
    const parts = changes(diff("안돼요", "안 돼요"));
    ready(p, { step: "result", parts, input: { request: "r" } });
    const buttons = [...p.$("foot").querySelectorAll("button")];
    const named = (label) => buttons.find((b) => b.textContent === label);
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Back to edit",
      "Keep mine",
      "Use",
      "Send to agent",
    ]);
    p.click(named("Send to agent"));
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "send-now" });
    p.click(named("Use"));
    expect(p.posted.at(-1)).toEqual({ pane: "p1", type: "send" });
  });

  it("tells the tile how tall it is", async () => {
    const p = page();
    ready(p);
    await p.frame();
    expect(p.posted.some((m) => m.type === "size" && Number.isFinite(m.h))).toBe(true);
  });

  it("fits its content, growing and shrinking with it, not the space it fills", async () => {
    const p = page();
    // Stand-in sizes: the content's extent, and a scroll height stuck at the old size.
    let content = 300;
    p.w.document.createRange = () => ({
      selectNodeContents: () => {},
      getBoundingClientRect: () => ({ height: content }),
    });
    Object.defineProperty(p.$("body"), "scrollHeight", { get: () => 300 });
    const sizes = () => p.posted.filter((m) => m.type === "size").map((m) => m.h);
    ready(p);
    await p.frame();
    content = 120;
    ready(p, { step: "checking" });
    await p.frame();
    const [tall, short] = sizes().slice(-2);
    expect(tall - short).toBe(180);
  });

  it("never reads text from the tile or from Claude as markup", () => {
    const p = page();
    const evil = '<img src=x onerror="alert(1)">';
    const parts = changes(diff(`a ${evil}`, `b ${evil}`));
    ready(p, {
      step: "result",
      parts,
      notes: [{ from: evil, to: "b", kind: "grammar", why: evil }],
    });
    expect(p.$("body").querySelector("img")).toBeNull();
    expect(p.$("body").textContent).toContain(evil);
  });
});
