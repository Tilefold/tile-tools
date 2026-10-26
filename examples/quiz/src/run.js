/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the tile
 *
 * Runs the quiz and shows it the way the user chose:
 *
 * - On a card (the default): the quiz page docked in Tilefold's window,
 *   borderless, with a grip above it to drag it by (card.js). On a
 *   Tilefold that can't dock pages (before 0.1.11) the page opens in a
 *   window of its own instead.
 * - In a panel beside the panes: rows Tilefold draws in the user's theme.
 *   Also the fallback when tile pages are missing (before 0.1.7).
 *
 * The quiz itself lives here (quiz.js), never in the page: the page only
 * draws the view it is sent and says what the user clicked, so both ways
 * of showing the quiz behave the same. The state is saved after every
 * step, so closing the quiz or restarting Tilefold resumes it.
 *
 * Messages with the page: it says `hello` when it loads and gets `setup`
 * (its language and labels) and `show` (the view); it sends `pick`,
 * `next`, `again` and `close`. What the user does is recorded in the
 * tile's activity log: `quiz.opened`, `quiz.answered` (which question and
 * whether it was right, never anything typed), `quiz.finished`,
 * `quiz.restarted`, `quiz.closed`.
 *
 * Event handlers get half a second, so each one starts its work in the
 * background and returns at once.
 */
import { createCard } from "./card.js";
import { QUESTIONS } from "./questions.js";
import { nextQuestion, pickChoice, restoreQuiz, startQuiz } from "./quiz.js";
import { COMMANDS, cornerSetting, showAsSetting } from "./settings.js";
import { ROW, cardView, choiceOfRow, panelView } from "./view.js";

/** The store key of the quiz's progress. */
export const PROGRESS_KEY = "progress";

/** @param {any} tf */
export function runQuiz(tf) {
  /** Logs what went wrong in the tile's log; logging never throws. */
  const warn = (err) =>
    void Promise.resolve()
      .then(() => tf.log.warn(String(err && err.message ? err.message : err)))
      .catch(() => {});
  const audit = (action, details) =>
    Promise.resolve()
      .then(() => tf.audit(action, details))
      .catch(warn);

  let quiz = startQuiz(QUESTIONS.length);
  /** Whether the saved progress has been read. */
  let loaded = false;
  /** Where the quiz shows now: "card", "window", "panel", or null when closed. */
  let where = null;

  const canDock = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  const card = canDock()
    ? createCard(tf, {
        corner: () => cornerSetting(tf.settings),
        title: () => tf.t("quiz-title"),
        rtl: () => tf.t("page-dir") === "rtl",
        label: () => tf.t("grip-label"),
        warn,
      })
    : null;

  /** Reads the saved progress and card position, once. */
  const load = async () => {
    if (loaded) return;
    loaded = true;
    quiz = restoreQuiz(await tf.store.get(PROGRESS_KEY), QUESTIONS.length);
    await card?.load();
  };

  /** Sends the page a message; a closed page drops it. */
  const post = async (message) => {
    try {
      await tf.page.post(message);
    } catch {
      // The page closed in the meantime: it gets everything again on hello.
    }
  };

  /** Shows the quiz's current state wherever it is showing. */
  const render = async () => {
    if (where === "panel") await tf.panel.show(panelView(quiz, QUESTIONS, tf.t));
    else if (where) await post({ do: "show", view: cardView(quiz, QUESTIONS, tf.t) });
  };

  /** Saves a new state and shows it. */
  const update = async (next) => {
    if (next === quiz) return;
    quiz = next;
    await tf.store.set(PROGRESS_KEY, quiz);
    await render();
  };

  /** Opens the quiz the way the setting says, falling back as needed. */
  const open = async () => {
    await load();
    const wanted = showAsSetting(tf.settings);
    if (where) {
      // Already open the right way: bring it up to date.
      const showing = where === "panel" ? "panel" : "card";
      if (showing === wanted) return render();
      await close(false);
    }
    if ((wanted === "panel" || !tf.page) && tf.panel) {
      where = "panel";
      await render();
    } else if (tf.page && card) {
      await tf.page.open({ dock: await card.pageSpot() });
      where = "card";
      await card.show();
    } else if (tf.page) {
      await tf.page.open();
      where = "window";
    } else {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return;
    }
    void audit("quiz.opened", { as: where });
  };

  /** Closes the quiz; its progress stays saved. */
  const close = async (record = true) => {
    const was = where;
    if (!was) return;
    where = null;
    if (was === "panel") await tf.panel.hide();
    else {
      await card?.hide();
      await tf.page.close();
    }
    if (record) void audit("quiz.closed", { as: was });
  };

  /** Starts the quiz over from the first question. */
  const restart = async () => {
    await load();
    await update(startQuiz(QUESTIONS.length));
    void audit("quiz.restarted", {});
    if (!where) await open();
  };

  /** The user picked choice `i` for the current question. */
  const pick = async (i) => {
    const q = QUESTIONS[quiz.index];
    const { state, correct } = pickChoice(quiz, QUESTIONS, i);
    if (correct === null) return;
    await update(state);
    void audit("quiz.answered", { question: q.id, correct });
  };

  /** The user moved on from an answered question. */
  const next = async () => {
    const state = nextQuestion(quiz);
    // Nothing to do (not answered yet, or already over): nothing to record.
    if (state === quiz) return;
    await update(state);
    if (state.done) void audit("quiz.finished", { score: state.score, total: state.total });
  };

  /** A message from the page. */
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      await post({
        do: "setup",
        lang: tf.t("page-lang"),
        dir: tf.t("page-dir"),
        title: tf.t("quiz-title"),
        close: tf.t("page-close"),
      });
      return render();
    }
    if (m.type === "pick") return pick(Number(m.choice));
    if (m.type === "next") return next();
    if (m.type === "again") return restart();
    if (m.type === "close") return close();
  };

  /** A click on a panel row. */
  const clicked = async (e) => {
    if (where !== "panel" || !e || e.action !== "activate") return;
    const choice = choiceOfRow(e.row);
    if (choice !== null) return pick(choice);
    if (e.row === ROW.next) return next();
    if (e.row === ROW.again) return restart();
  };

  /** Runs a handler's work in the background, so the handler returns at once. */
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch(warn);

  // ------------------------------------------------- registration (nothing awaited above)
  const runs = {
    open,
    close: () => close(),
    restart,
    "put-back": async () => {
      await load();
      await card?.reset("command");
    },
  };
  for (const c of COMMANDS) {
    tf.command(
      tf.t(c.title),
      background(() => runs[c.id]()),
      { id: c.id },
    );
  }
  tf.on(
    "page.message",
    background((e) => hear(e && e.message)),
  );
  tf.on(
    "page.closed",
    background(async () => {
      // Closed from elsewhere (the page window's close button, the tile turned off).
      if (where === "card" || where === "window") {
        where = null;
        await card?.hide();
        void audit("quiz.closed", { as: "page" });
      }
    }),
  );
  tf.on(
    "panel.click",
    background((e) => clicked(e)),
  );
  tf.on(
    "panel.closed",
    background((e) => {
      if (where === "panel" && e?.by === "user") {
        where = null;
        void audit("quiz.closed", { as: "panel" });
      }
    }),
  );
  tf.on(
    "overlay.pointer",
    background((e) => card?.pointer(e)),
  );
  tf.on(
    "overlay.layout",
    background((e) => card?.moved(e)),
  );
  tf.on(
    "overlay.hidden",
    // The user hid tile overlays: the card goes with them, and comes back
    // with "Quiz: Start or show". Its progress stays saved.
    background(() => (where === "card" ? close() : undefined)),
  );
  /** The settings as last seen, to tell what changed. */
  let corner = cornerSetting(tf.settings);
  let showAs = showAsSetting(tf.settings);
  tf.on(
    "setting.changed",
    background(async () => {
      const nowCorner = cornerSetting(tf.settings);
      const nowShowAs = showAsSetting(tf.settings);
      if (nowShowAs !== showAs) {
        showAs = nowShowAs;
        if (where) await open();
      }
      if (nowCorner !== corner) {
        corner = nowCorner;
        // Choosing a corner puts a dragged card back in the pane.
        if (await card?.reset("corner")) return;
      }
      await card?.redraw();
    }),
  );

  return { state: () => ({ where, quiz }) };
}
