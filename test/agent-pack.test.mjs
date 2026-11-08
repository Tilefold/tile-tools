// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Agent Pack — tests
 *
 * One command per preset offers that agent with `tf.agent.define`, with a
 * command a shell never treats as special; a notice says how it went
 * (added, already there, declined, full, refused, or why it failed); an
 * older Tilefold is told it needs a newer one; audits name only the preset
 * and whether it was added.
 *
 * Your own agent: Add your own agent… opens a panel with a name field and
 * a command field; what was typed shows under them, with what to fix
 * (only once something is typed); what clears the context steps through
 * /clear, /new and nothing; Add this agent offers the draft, trimmed and
 * with single spaces, and starts over once it is added (keeping it when
 * declined); a command a shell would treat as special is never offered;
 * the ready-made agents are rows that offer themselves; audits never hold
 * a name or a command. The checks match Tilefold's rules.
 *
 * Modified 2026-11-08 (own agent): the panel and its checks.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { startTile } from "./fake-host.mjs";
import { PRESETS, resultKey } from "../examples/agent-pack/src/presets.js";
import {
  commandProblem,
  draftProblem,
  nameProblem,
  nextClear,
  toDefinition,
} from "../examples/agent-pack/src/ownAgent.js";
import { clickTarget, panelContent } from "../examples/agent-pack/src/panel.js";

const DIR = fileURLToPath(new URL("../examples/agent-pack/", import.meta.url));

describe("Agent Pack", () => {
  it("has a command for each preset, and every command is safe to type", async () => {
    const host = await startTile(DIR, { define: true });
    const ids = host.regs.filter((r) => r.kind === "command").map((r) => r.id);
    expect(ids).toEqual(["add-own", ...PRESETS.map((p) => `add-${p.id}`)]);
    for (const p of PRESETS) expect(p.command).toMatch(/^[A-Za-z0-9._,:=@%+/~ -]+$/);
  });

  it("offers the agent and says it was added", async () => {
    const host = await startTile(DIR, { define: true });
    await host.command("add-grok");
    expect(host.defines).toEqual([
      { name: "Grok Build", command: "grok", clear: "/clear", title: "Grok" },
    ]);
    expect(host.toasts.at(-1)).toContain("Grok Build was added");
    expect(host.audits).toContainEqual({
      action: "offered",
      details: { preset: "grok", added: true },
    });
  });

  it("says when it was there already, declined, full or refused", async () => {
    for (const [answer, words] of [
      [{ added: false, why: "exists", id: "kimi" }, "one of your agents already"],
      [{ added: false, why: "declined" }, "wasn't added"],
      [{ added: false, why: "full" }, "20 agents"],
      [{ added: false, why: "refused" }, "couldn't keep"],
    ]) {
      const host = await startTile(DIR, { define: answer });
      await host.command("add-kimi");
      expect(host.toasts.at(-1)).toContain(words);
    }
    expect(resultKey(null)).toBe("toast-refused");
  });

  it("says why when the offer fails, and asks for a newer Tilefold without define", async () => {
    const busy = await startTile(DIR, {
      define: () => {
        throw Object.assign(new Error("x"), { name: "BusyError" });
      },
    });
    await busy.command("add-vibe");
    expect(busy.toasts.at(-1)).toContain("BusyError");
    const old = await startTile(DIR, {});
    await old.command("add-vibe");
    expect(old.toasts.at(-1)).toContain("newer Tilefold");
  });

  it("needs a newer Tilefold for its own panel without define or panels", async () => {
    const host = await startTile(DIR, { define: true });
    await host.command("add-own");
    expect(host.toasts.at(-1)).toContain("newer Tilefold");
  });
});

/** The labels of the panel's rows, without Fluent's isolation marks. */
const labels = (host) => host.panel.content.rows.map((r) => r.label.replace(/[\u2068\u2069]/g, ""));

describe("Agent Pack: your own agent", () => {
  it("opens a panel with a name field, a command field and the ready-made agents", async () => {
    const host = await startTile(DIR, { define: true, panel: true });
    await host.command("add-own");
    const rows = host.panel.content.rows;
    expect(host.panel.content.title).toBe("Agent Pack");
    expect(rows.filter((r) => r.input).map((r) => r.id)).toEqual(["own-name", "own-command"]);
    expect(labels(host)).toContain("Name: not set yet");
    expect(labels(host)).toContain("Clears its context with: /clear");
    expect(rows.find((r) => r.id === "own-add")).toMatchObject({ muted: true });
    // Nothing typed yet: nothing to fix is shown.
    expect(rows.some((r) => r.id === "own-problem")).toBe(false);
    for (const p of PRESETS) {
      expect(rows).toContainEqual(
        expect.objectContaining({ id: `preset:${p.id}`, trail: p.command }),
      );
    }
  });

  it("offers what was typed, trimmed, and starts over once it is added", async () => {
    const host = await startTile(DIR, { define: true, panel: true });
    await host.command("add-own");
    await host.emit("panel.input", { row: "own-name", text: "  Gemini for work " });
    await host.emit("panel.input", { row: "own-command", text: " gemini   --model  pro " });
    expect(labels(host)).toContain("Name: Gemini for work");
    expect(labels(host)).toContain("Command: gemini --model pro");
    await host.emit("panel.click", { row: "own-clear", action: "activate" });
    expect(labels(host)).toContain("Clears its context with: /new");
    expect(host.panel.content.rows.find((r) => r.id === "own-add").tone).toBe("accent");
    await host.emit("panel.click", { row: "own-add", action: "activate" });
    expect(host.defines).toEqual([
      { name: "Gemini for work", command: "gemini --model pro", clear: "/new" },
    ]);
    expect(host.toasts.at(-1)).toContain("Gemini for work was added");
    expect(host.audits).toContainEqual({
      action: "offered",
      details: { preset: "own", added: true },
    });
    expect(JSON.stringify(host.audits)).not.toContain("gemini");
    expect(labels(host)).toContain("Name: not set yet");
  });

  it("keeps the draft when declined, and Start over clears it", async () => {
    const host = await startTile(DIR, { define: { added: false, why: "declined" }, panel: true });
    await host.command("add-own");
    await host.emit("panel.input", { row: "own-name", text: "Mine" });
    await host.emit("panel.input", { row: "own-command", text: "mine" });
    await host.emit("panel.click", { row: "own-add", action: "activate" });
    expect(host.toasts.at(-1)).toContain("wasn't added");
    expect(labels(host)).toContain("Name: Mine");
    await host.emit("panel.click", { row: "own-start-over", action: "activate" });
    expect(labels(host)).toContain("Name: not set yet");
    expect(labels(host)).toContain("Command: not set yet");
  });

  it("says what to fix and never offers a command a shell would treat as special", async () => {
    const host = await startTile(DIR, { define: true, panel: true });
    await host.command("add-own");
    await host.emit("panel.input", { row: "own-name", text: "Sneaky" });
    // A part not typed yet reads "not set yet", not as something to fix.
    expect(labels(host)).toContain("Command: not set yet");
    expect(host.panel.content.rows.some((r) => r.id === "own-problem")).toBe(false);
    await host.emit("panel.input", { row: "own-command", text: "agent; rm -rf ~" });
    expect(labels(host)).toContain(
      "Use only letters, digits and . _ , : = @ % + / ~ - in the command.",
    );
    await host.emit("panel.click", { row: "own-add", action: "activate" });
    expect(host.defines).toEqual([]);
  });

  it("offers a ready-made agent from its row", async () => {
    const host = await startTile(DIR, { define: true, panel: true });
    await host.command("add-own");
    await host.emit("panel.click", { row: "preset:aider", action: "activate" });
    expect(host.defines).toEqual([{ name: "Aider", command: "aider", clear: "/clear" }]);
    await host.emit("panel.click", { row: "preset:nope", action: "activate" });
    await host.emit("panel.click", { row: "own-name-now", action: "activate" });
    expect(host.defines).toHaveLength(1);
  });

  it("checks names and commands with Tilefold's rules", () => {
    expect(nameProblem("")).toBe("own-problem-name-empty");
    expect(nameProblem("   ")).toBe("own-problem-name-empty");
    expect(nameProblem("x".repeat(60))).toBeNull();
    expect(nameProblem("x".repeat(61))).toBe("own-problem-name");
    expect(nameProblem("evil\u202Eeman")).toBe("own-problem-name");
    expect(nameProblem("two\nlines")).toBe("own-problem-name");
    expect(commandProblem("")).toBe("own-problem-command-empty");
    expect(commandProblem("gemini --model=pro -p @file ~/x:1,2 %u+v")).toBeNull();
    expect(commandProblem(["a", ...Array(16).fill("b")].join(" "))).toBeNull();
    expect(commandProblem(["a", ...Array(17).fill("b")].join(" "))).toBe(
      "own-problem-command-long",
    );
    for (const bad of [
      "a;b",
      "a|b",
      "a && b",
      "$(x)",
      "`x`",
      "a>b",
      "'a'",
      '"a"',
      "a*",
      "x".repeat(257),
    ]) {
      expect(commandProblem(bad), bad).toBe("own-problem-command-chars");
    }
    expect(draftProblem({ name: "A", command: "a" })).toBeNull();
    expect(toDefinition({ name: " A ", command: " a  b ", clear: "" })).toEqual({
      name: "A",
      command: "a b",
      clear: "",
    });
    expect([nextClear("/clear"), nextClear("/new"), nextClear(""), nextClear("?")]).toEqual([
      "/new",
      "",
      "/clear",
      "/clear",
    ]);
  });

  it("keeps long names and commands within a row's label", () => {
    const t = (key, args) => `${key} ${args ? Object.values(args).join(" ") : ""}`;
    const content = panelContent(t, { name: "n", command: "c".repeat(4000), clear: "/clear" });
    for (const r of content.rows) expect(r.label.length).toBeLessThanOrEqual(256);
    expect(clickTarget("own-add")).toEqual({ kind: "add" });
    expect(clickTarget("own-name")).toBeNull();
  });
});
