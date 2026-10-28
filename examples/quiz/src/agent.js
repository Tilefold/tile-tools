/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — quizzes from the user's own files, made by an AI agent
 *
 * A tile can't read the user's files, but the AI agents in the user's
 * panes (Claude Code, Codex…) can. The user asks one, say "make quizzes
 * from the files in ./notes with the Quiz tile"; the agent reads them,
 * writes the questions, and hands each quiz over through Tilefold's
 * `tile_run` with the commands below (the user allows that once). What a
 * command returns goes back to the agent, and so does what to fix when a
 * quiz doesn't check out.
 *
 * - `add-quiz` takes `{ title, questions: [{ question, choices, answer, why }] }`.
 * - `list-quizzes` tells the agent what's in the library (and shows the
 *   list when the quiz is closed; a quiz the user is taking stays put).
 * - `remove-quiz` and `restore-quiz` take `{ id }`: a removed quiz is only
 *   marked removed, never deleted, so it can come back.
 *
 * Run from the palette (no input), the agents' commands say how to ask an
 * agent instead. Each change is recorded in the tile's activity log
 * (`quiz-added`, `quiz-removed`, `quiz-restored`), with the quiz's id and
 * size, never its text.
 */
import {
  BUILTIN_ID,
  LIMITS,
  checkQuiz,
  entryFor,
  markRemoved,
  markRestored,
  quizId,
  visible,
} from "./library.js";

/** The commands agents use: id, title key, and what to send (at most 300 characters). */
export const AGENT_COMMANDS = [
  {
    id: "add-quiz",
    title: "cmd-add-quiz",
    input:
      "{ title, questions: [{ question, choices: 2-6 answers, answer: index of the right one from 0, why: one sentence }] }: a quiz made from the user's files, at most 30 questions; send several quizzes one by one",
  },
  { id: "list-quizzes", title: "cmd-list-quizzes" },
  {
    id: "remove-quiz",
    title: "cmd-remove-quiz",
    input:
      "{ id }: a quiz from list-quizzes to remove (it is kept, and restore-quiz brings it back)",
  },
  {
    id: "restore-quiz",
    title: "cmd-restore-quiz",
    input: "{ id }: a removed quiz from list-quizzes to bring back",
  },
];

/** An error whose message tells the agent what to do. */
const refuse = (message) => Object.assign(new Error(message), { name: "TypeError" });

/** The id an agent sent in `{ id }`, checked. */
function idOf(input) {
  const id = input && typeof input === "object" ? /** @type {any} */ (input).id : null;
  if (typeof id !== "string" || !id) throw refuse("Send { id }, an id from list-quizzes.");
  return id;
}

/**
 * The agents' commands.
 *
 * @param {any} tf
 * @param {{
 *   store: ReturnType<import("./store.js").createStore>,
 *   loadIndex: () => Promise<import("./library.js").IndexEntry[]>,
 *   saveIndex: (index: import("./library.js").IndexEntry[]) => Promise<void>,
 *   revealList: () => Promise<void>,
 *   changed: () => Promise<void>,
 *   audit: (action: string, details: object) => void,
 *   now: () => number,
 * }} o
 */
export function createAgentCommands(tf, o) {
  /** Run from the palette: say how to ask an agent. */
  const howTo = async () => {
    await tf.toast(tf.t("toast-ask-agent"));
    return undefined;
  };

  return {
    async "add-quiz"(input) {
      if (input === null || input === undefined) return howTo();
      const quiz = checkQuiz(input);
      const index = await o.loadIndex();
      if (visible(index).length >= LIMITS.quizzes) {
        throw refuse(`The library holds at most ${LIMITS.quizzes} quizzes; remove one first.`);
      }
      const id = quizId(quiz.title, o.now());
      await o.store.saveQuiz(id, quiz);
      await o.saveIndex([...index, entryFor(id, quiz, o.now())]);
      o.audit("quiz-added", { quiz: id, questions: quiz.questions.length });
      await o.changed();
      return {
        id,
        title: quiz.title,
        questions: quiz.questions.length,
        note: "Added. The user finds it with Quiz: Show all quizzes.",
      };
    },

    async "list-quizzes"() {
      const index = await o.loadIndex();
      await o.revealList();
      return {
        quizzes: visible(index).map((e) => ({
          id: e.id,
          title: e.builtin ? tf.t(e.title) : e.title,
          questions: e.count,
          best: e.best,
        })),
        removed: index.filter((e) => e.removed).map((e) => ({ id: e.id, title: e.title })),
      };
    },

    async "remove-quiz"(input) {
      if (input === null || input === undefined) return howTo();
      const id = idOf(input);
      const index = await o.loadIndex();
      const entry = index.find((e) => e.id === id && !e.removed);
      if (!entry) throw refuse(`No quiz "${id}". Use list-quizzes to see the ids.`);
      if (id === BUILTIN_ID) throw refuse("The built-in quiz can't be removed.");
      await o.saveIndex(markRemoved(index, id));
      o.audit("quiz-removed", { quiz: id });
      await o.changed();
      return { removed: id, note: "Kept, not deleted: restore-quiz brings it back." };
    },

    async "restore-quiz"(input) {
      if (input === null || input === undefined) return howTo();
      const id = idOf(input);
      const index = await o.loadIndex();
      if (!index.some((e) => e.id === id && e.removed)) {
        throw refuse(`No removed quiz "${id}". Use list-quizzes to see the ids.`);
      }
      await o.saveIndex(markRestored(index, id));
      o.audit("quiz-restored", { quiz: id });
      await o.changed();
      return { restored: id };
    },
  };
}
