// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Shell Tips example — tests
 *
 * The question and answer logic on its own, then the built tile against
 * the fake Tilefold: a tip is asked with the system prompt, the user's
 * language, a small token limit and the chosen model; a second tip on the
 * same topic continues the conversation; the tip is cleaned, kept and
 * shown; each of Tilefold's AI errors gets the right notice and "Don't
 * send" gets none; only one question is asked at a time.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";
import {
  MAX_TIP,
  MAX_TOKENS,
  TOPICS,
  buildAsk,
  cleanTip,
  errorKey,
} from "../examples/shell-tips/src/tips.js";

const DIR = fileURLToPath(new URL("../examples/shell-tips/", import.meta.url));

/** An error as Tilefold throws it: told apart by `name`. */
const named = (name) => Object.assign(new Error(name), { name });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("question and answer logic", () => {
  it("asks one question with a system prompt, the language, a token limit and the model", () => {
    const ask = buildAsk({ topic: "docker", language: "Deutsch", fast: true });
    expect(ask.messages).toEqual([
      { role: "user", content: "Give me one tip about Docker on the command line." },
    ]);
    expect(ask.system).toContain("Answer in Deutsch");
    expect(ask.maxTokens).toBe(MAX_TOKENS);
    expect(ask.model).toBe("fast");
    expect(buildAsk({ topic: "git", language: "English", fast: false }).model).toBe("default");
  });

  it("continues the conversation when there was an earlier tip, ending with the user", () => {
    const ask = buildAsk({
      topic: "git",
      language: "English",
      fast: true,
      previous: "Use git switch -.",
    });
    expect(ask.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(ask.messages[1].content).toBe("Use git switch -.");
  });

  it("falls back to the shell for an unknown topic", () => {
    const ask = buildAsk({ topic: "__proto__", language: "English", fast: true });
    expect(ask.messages[0].content).toBe("Give me one tip about zsh and bash in the terminal.");
  });

  it("offers each topic once", () => {
    expect(new Set(TOPICS.map((t) => t.value)).size).toBe(TOPICS.length);
  });

  it("cleans a tip for a notice: no Markdown, one line, cut with an ellipsis", () => {
    expect(cleanTip("**Tip:** run `git switch -`\n\nto go back.")).toBe(
      "Tip: run git switch - to go back.",
    );
    expect(cleanTip("```sh\nls -la\n```")).toBe("ls -la");
    const long = cleanTip("word ".repeat(100));
    expect(long.length).toBeLessThanOrEqual(MAX_TIP);
    expect(long.endsWith("…")).toBe(true);
    expect(cleanTip(undefined)).toBe("");
  });

  it("maps Tilefold's AI errors by name, and stays quiet when the user said no", () => {
    expect(errorKey(named("AiDeclinedError"))).toBeNull();
    expect(errorKey(named("AiNotSetUpError"))).toBe("error-no-key");
    expect(errorKey(named("PermissionDeniedError"))).toBe("error-denied");
    expect(errorKey(named("BudgetExceededError"))).toBe("error-budget");
    expect(errorKey(named("RefusedError"))).toBe("error-refused");
    for (const n of ["RateLimitError", "NetworkError", "TypeError"]) {
      expect(errorKey(named(n))).toBe("error-failed");
    }
  });
});

describe("the tile", () => {
  it("registers a topic list, the model switch and two commands", async () => {
    const host = await startTile(DIR, { ai: () => "" });
    const [topic, fast] = host.regs.filter((r) => r.kind === "setting");
    expect(topic).toMatchObject({ key: "topic", default: "git" });
    expect(topic.choices.map((c) => c.label)).toEqual([
      "git",
      "zsh and bash",
      "Docker",
      "npm",
      "ssh",
    ]);
    expect(fast).toMatchObject({ key: "fast", default: true });
    expect(host.regs.filter((r) => r.kind === "command").map((r) => r.id)).toEqual([
      "new-tip",
      "last-tip",
    ]);
  });

  it("asks Claude for a tip, then shows, keeps and records it", async () => {
    const host = await startTile(DIR, {
      settings: { topic: "ssh" },
      ai: () => "Use **ssh -J** to jump through a bastion host.",
    });
    await host.command("new-tip");
    await host.advance(0);
    expect(host.questions).toHaveLength(1);
    expect(host.questions[0]).toMatchObject({ model: "fast", maxTokens: MAX_TOKENS });
    expect(host.questions[0].system).toContain("Answer in English");
    expect(host.toasts).toEqual(["Use ssh -J to jump through a bastion host."]);
    expect(host.store.get("last")).toEqual({
      topic: "ssh",
      text: "Use ssh -J to jump through a bastion host.",
    });
    expect(host.audits).toEqual([
      { action: "tip-asked", details: { topic: "ssh", model: "claude-opus-5-5", outputTokens: 1 } },
    ]);
  });

  it("asks for a different tip when the topic is the same as last time", async () => {
    const host = await startTile(DIR, {
      store: { last: { topic: "git", text: "Use git switch -." } },
      ai: () => "Use git worktree add to check out two branches at once.",
    });
    await host.command("new-tip");
    await host.advance(0);
    expect(host.questions[0].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("uses the default model when the switch is off, and the user's language", async () => {
    const host = await startTile(DIR, {
      locale: "ja",
      settings: { fast: false },
      ai: () => "git switch - で直前のブランチに戻れます。",
    });
    await host.command("new-tip");
    await host.advance(0);
    expect(host.questions[0].model).toBe("default");
    expect(host.questions[0].system).toContain("Answer in 日本語");
  });

  it("gives each AI error its notice and says nothing after 'Don't send'", async () => {
    const cases = [
      ["AiNotSetUpError", ["Add your Anthropic API key in Settings → AI to get tips."]],
      ["BudgetExceededError", ["Shell Tips has used today's AI allowance. Try again tomorrow."]],
      ["RefusedError", ["Claude didn't give a tip this time. Try again."]],
      ["NetworkError", ["Couldn't reach Claude. Try again later."]],
      ["AiDeclinedError", []],
    ];
    for (const [name, toasts] of cases) {
      const host = await startTile(DIR, {
        ai: () => {
          throw named(name);
        },
      });
      await host.command("new-tip");
      await host.advance(0);
      expect(host.toasts, name).toEqual(toasts);
      expect(host.store.has("last")).toBe(false);
    }
  });

  it("treats an empty answer as no tip", async () => {
    const host = await startTile(DIR, { ai: () => "  " });
    await host.command("new-tip");
    await host.advance(0);
    expect(host.toasts).toEqual(["Claude didn't give a tip this time. Try again."]);
  });

  it("returns from the command at once and asks only one question at a time", async () => {
    let decide;
    // The user is still looking at Tilefold's dialog.
    const waiting = new Promise((resolve) => (decide = resolve));
    const host = await startTile(DIR, { ai: () => waiting });
    await host.command("new-tip");
    await host.command("new-tip");
    expect(host.questions).toHaveLength(1);
    decide("Press Ctrl+R to search your history.");
    await host.advance(0);
    expect(host.toasts).toEqual(["Press Ctrl+R to search your history."]);
  });

  it("shows the last tip again without asking", async () => {
    const host = await startTile(DIR, {
      store: { last: { topic: "npm", text: "npm ci installs exactly the lockfile." } },
      ai: () => "unused",
    });
    await host.command("last-tip");
    expect(host.toasts).toEqual(["npm ci installs exactly the lockfile."]);
    expect(host.questions).toEqual([]);

    const fresh = await startTile(DIR, { ai: () => "unused" });
    await fresh.command("last-tip");
    expect(fresh.toasts).toEqual(["No tip yet. Run Shell Tips: New tip."]);
  });

  it("says so on a Tilefold without AI for tiles", async () => {
    const toasts = [];
    const tf = {
      t: (key) => key,
      setting() {},
      command(_title, run, { id }) {
        if (id === "new-tip") this.run = run;
      },
      settings: { get: () => undefined },
      store: { get: async () => null, set: async () => {} },
      toast: async (text) => void toasts.push(text),
    };
    const mod = await import(`${pathToFileURL(`${DIR}main.js`).href}?no-ai`);
    mod.default(tf);
    tf.run();
    await vi.advanceTimersByTimeAsync(0);
    expect(toasts).toEqual(["error-no-ai"]);
  });
});
