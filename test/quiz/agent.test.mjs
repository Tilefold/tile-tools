// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — quizzes AI agents make from the user's files
 *
 * An agent in a pane hands quizzes over with `add-quiz`, as Tilefold's
 * tile_run would: they're checked (what's wrong goes back to the agent),
 * kept, and listed with the built-in quiz. `list-quizzes` tells the agent
 * what's there without pulling the user out of a quiz; `remove-quiz` only
 * marks a quiz removed and `restore-quiz` brings it back. Run from the
 * palette, these commands say how to ask an agent. The activity log gets
 * the quiz's id and size, never its text.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AGENT_COMMANDS } from "../../examples/quiz/src/agent.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/quiz/", import.meta.url));
const start = (opts = {}) => startTile(DIR, { page: "dock", panel: true, ...opts });

/** A quiz as an agent would send it. */
const QUIZ = {
  title: "Cell biology",
  questions: [
    {
      question: "What makes most of a cell's ATP?",
      choices: ["The nucleus", "The mitochondria", "The ribosomes"],
      answer: 1,
      why: "Mitochondria make ATP through cellular respiration.",
    },
    {
      question: "What holds a cell's DNA?",
      choices: ["The nucleus", "The membrane"],
      answer: 0,
      why: "In eukaryotic cells, DNA is kept in the nucleus.",
    },
  ],
};

/** The last view the tile sent the page. */
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;

describe("the agents' commands", () => {
  it("describe what to send in at most 300 characters", () => {
    for (const c of AGENT_COMMANDS.filter((x) => x.input)) {
      expect(c.input.length, c.id).toBeLessThanOrEqual(300);
    }
  });

  it("add a quiz, which the list then shows and the user can take", async () => {
    const host = await start();
    const added = await host.command("add-quiz", QUIZ);
    expect(added).toMatchObject({ title: "Cell biology", questions: 2 });
    expect(added.id).toMatch(/^cell-biology-/);
    expect(host.store.get(`quiz:${added.id}`).title).toBe("Cell biology");
    expect(host.audits).toContainEqual({
      action: "quiz-added",
      details: { quiz: added.id, questions: 2 },
    });
    // The text of the quiz never goes into the log.
    expect(JSON.stringify(host.audits)).not.toContain("mitochondria");

    await host.command("open");
    await host.emit("page.message", { message: { type: "hello", scheme: "light" } });
    expect(lastView(host).quizzes.map((q) => q.title)).toEqual(["Terminal quiz", "Cell biology"]);
    await host.emit("page.message", { message: { type: "open-quiz", id: added.id } });
    expect(lastView(host)).toMatchObject({
      title: "Cell biology",
      question: "What makes most of a cell's ATP?",
      progress: "Question 1 of 2",
    });
  });

  it("refuse a bad quiz with what to fix, and keep nothing", async () => {
    const host = await start();
    const bad = { ...QUIZ, questions: [{ ...QUIZ.questions[0], answer: 7 }] };
    await expect(host.command("add-quiz", bad)).rejects.toThrow(
      /questions\[0\]\.answer must be the index/,
    );
    expect([...host.store.keys()].filter((k) => k.startsWith("quiz:"))).toEqual([]);
  });

  it("show a list the user is looking at as quizzes arrive", async () => {
    const host = await start();
    await host.command("open");
    await host.emit("page.message", { message: { type: "hello", scheme: "light" } });
    await host.command("add-quiz", QUIZ);
    expect(lastView(host).quizzes).toHaveLength(2);
  });

  it("list the quizzes for the agent, without pulling the user out of a quiz", async () => {
    const host = await start();
    const { id } = await host.command("add-quiz", QUIZ);
    await host.command("open");
    await host.emit("page.message", { message: { type: "hello", scheme: "light" } });
    await host.emit("page.message", { message: { type: "open-quiz", id: "terminal" } });
    const listed = await host.command("list-quizzes");
    expect(listed.quizzes).toEqual([
      { id: "terminal", title: "Terminal quiz", questions: 6, best: null },
      { id, title: "Cell biology", questions: 2, best: null },
    ]);
    expect(lastView(host).screen).toBe("quiz");
  });

  it("open the list when the quiz is closed", async () => {
    const host = await start();
    await host.command("list-quizzes");
    expect(host.page.open).toBe(true);
  });

  it("only mark a quiz removed, and bring it back", async () => {
    const host = await start();
    const { id } = await host.command("add-quiz", QUIZ);
    expect(await host.command("remove-quiz", { id })).toMatchObject({ removed: id });
    expect(host.store.has(`quiz:${id}`)).toBe(true);
    let listed = await host.command("list-quizzes");
    expect(listed.quizzes.map((q) => q.id)).toEqual(["terminal"]);
    expect(listed.removed).toEqual([{ id, title: "Cell biology" }]);
    await host.command("restore-quiz", { id });
    listed = await host.command("list-quizzes");
    expect(listed.quizzes.map((q) => q.id)).toEqual(["terminal", id]);
    expect(host.audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(["quiz-removed", "quiz-restored"]),
    );
  });

  it("refuse to remove the built-in quiz or one that isn't there", async () => {
    const host = await start();
    await expect(host.command("remove-quiz", { id: "terminal" })).rejects.toThrow(/built-in/);
    await expect(host.command("remove-quiz", { id: "nope" })).rejects.toThrow(/No quiz "nope"/);
    await expect(host.command("remove-quiz", {})).rejects.toThrow(/Send \{ id \}/);
    await expect(host.command("restore-quiz", { id: "nope" })).rejects.toThrow(/No removed quiz/);
  });

  it("say how to ask an agent when run from the palette", async () => {
    const host = await start();
    await host.command("add-quiz");
    expect(host.toasts[0]).toMatch(/AI agents in your panes do this/);
  });
});
