/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the tile
 *
 * Runs the quiz library and shows it the way the user chose:
 *
 * - On a card (the default): the quiz page docked in Tilefold's window,
 *   borderless, with a grip above it to drag it by (card.js). On a
 *   Tilefold that can't dock pages (before 0.1.11) the page opens in a
 *   window of its own instead.
 * - In a panel beside the panes: rows Tilefold draws in the user's theme.
 *   Also the fallback when tile pages are missing (before 0.1.7).
 *
 * Two screens: the list of quizzes (the built-in one and those AI agents
 * made from the user's files, agent.js), and the quiz being taken. The
 * quizzes live here, never in the page: the page only draws the view it
 * is sent and says what the user clicked, so the card and the panel always
 * agree. Progress is kept per quiz, so every quiz resumes where it was left.
 *
 * Messages with the page: it says `hello` (with the system's light or dark)
 * when it loads and gets `setup` (its language, labels and appearance) and
 * `show` (the view); it sends `pick`, `next`, `again`, `list`, `open-quiz`,
 * `theme` (switch light or dark), `scheme` (the system's changed) and
 * `close`. What the user does is recorded in the tile's activity log, as
 * one-word actions (Tilefold records them as tile.<id>.<action>): `opened`,
 * `answered` (which quiz and question, and whether it was right), `finished`,
 * `restarted`, `closed`, `theme-switched`.
 *
 * Event handlers get half a second, so each one starts its work in the
 * background and returns at once.
 */
import { createAgentCommands, AGENT_COMMANDS } from "./agent.js";
import { appearanceOf, effectiveTheme, flipped, schemeOf } from "./appearance.js";
import { createCard } from "./card.js";
import { BUILTIN_ID, visible, withBest, withBuiltin } from "./library.js";
import { nextQuestion, pickChoice, startQuiz } from "./quiz.js";
import { COMMANDS, appearanceSetting, cornerSetting, showAsSetting } from "./settings.js";
import { createStore } from "./store.js";
import {
  ROW,
  cardView,
  choiceOfRow,
  listCardView,
  listPanelView,
  panelView,
  quizOfRow,
  say,
} from "./view.js";

/** @param {any} tf */
export function runQuiz(tf) {
  /** Logs what went wrong in the tile's log; logging never throws. */
  const warn = (err) =>
    void Promise.resolve()
      .then(() => tf.log.warn(String(err && err.message ? err.message : err)))
      .catch(() => {});
  const audit = (action, details) =>
    void Promise.resolve()
      .then(() => tf.audit(action, details))
      .catch(warn);
  const store = createStore(tf);

  let loaded = false;
  /** The library's index, the built-in quiz included. */
  let index = [];
  /** The quiz being taken and where the user is in it, or null on the list. */
  let quiz = null;
  let state = null;
  /** Where the quiz shows now: "card", "window", "panel", or null when closed. */
  let where = null;
  /** Light or dark: switched by the user (kept), and the system's as the page saw it. */
  let switched = null;
  let system = null;

  const theme = () => effectiveTheme(appearanceSetting(tf.settings), switched, system);
  const canDock = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  const card = canDock()
    ? createCard(tf, {
        corner: () => cornerSetting(tf.settings),
        title: () => (quiz ? say(quiz, tf.t, quiz.title) : tf.t("list-title")),
        rtl: () => tf.t("page-dir") === "rtl",
        theme,
        label: () => tf.t("grip-label"),
        warn,
      })
    : null;

  const loadIndex = async () => withBuiltin(await store.index());
  const saveIndex = async (next) => {
    index = next;
    await store.saveIndex(next);
  };

  /** Takes the quiz `id`, at its saved progress; the list when it's gone. */
  const select = async (id) => {
    const entry = visible(index).find((e) => e.id === id);
    const q = entry ? await store.quiz(id) : null;
    if (!q) {
      quiz = null;
      state = null;
      await store.saveCurrent(null);
      return false;
    }
    quiz = q;
    state = await store.progress(id, q.questions.length);
    await store.saveCurrent(id);
    return true;
  };

  /** Reads what was kept, once. */
  const load = async () => {
    if (loaded) return;
    loaded = true;
    index = await loadIndex();
    const current = await store.current();
    if (current) await select(current);
    switched = await store.appearance();
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

  /** Shows the current screen wherever the quiz is showing. */
  const render = async () => {
    if (where === "panel") {
      const content = quiz ? panelView(state, quiz, tf.t) : listPanelView(visible(index), tf.t);
      await tf.panel.show(content);
    } else if (where) {
      const view = quiz ? cardView(state, quiz, tf.t) : listCardView(visible(index), tf.t);
      await post({ do: "show", view });
    }
  };

  /** Saves the quiz's new state and shows it. */
  const update = async (next) => {
    if (!quiz || next === state) return;
    state = next;
    await store.saveProgress(quiz.id, state);
    await render();
  };

  /** Opens the quiz the way the setting says, falling back as needed. */
  const open = async () => {
    await load();
    const wanted = showAsSetting(tf.settings);
    if (where) {
      // Already open the right way: bring it up to date.
      if ((where === "panel" ? "panel" : "card") === wanted) return render();
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
    audit("opened", { as: where });
  };

  /** Closes the quiz; everything stays kept. */
  const close = async (record = true) => {
    const was = where;
    if (!was) return;
    where = null;
    if (was === "panel") await tf.panel.hide();
    else {
      await card?.hide();
      await tf.page.close();
    }
    if (record) audit("closed", { as: was });
  };

  /** Shows the list of quizzes, opening the quiz if it's closed. */
  const showList = async () => {
    await load();
    index = await loadIndex();
    quiz = null;
    state = null;
    await store.saveCurrent(null);
    if (where) await render();
    else await open();
    await card?.redraw();
  };

  /** Takes quiz `id` from the list. */
  const openQuiz = async (id) => {
    await load();
    if (!(await select(String(id)))) return render();
    if (where) await render();
    else await open();
    await card?.redraw();
  };

  /** Starts the quiz being taken over (the built-in one from the list). */
  const restart = async () => {
    await load();
    if (!quiz) await select(BUILTIN_ID);
    if (!quiz) return;
    await update(startQuiz(quiz.questions.length));
    audit("restarted", { quiz: quiz.id });
    if (!where) await open();
  };

  /** The user picked choice `i` for the current question. */
  const pick = async (i) => {
    if (!quiz) return;
    const n = state.index + 1;
    const { state: next, correct } = pickChoice(state, quiz.questions, i);
    if (correct === null) return;
    await update(next);
    audit("answered", { quiz: quiz.id, question: n, correct });
  };

  /** The user moved on from an answered question. */
  const next = async () => {
    if (!quiz) return;
    const after = nextQuestion(state);
    // Nothing to do (not answered yet, or already over): nothing to record.
    if (after === state) return;
    if (after.done) await saveIndex(withBest(index, quiz.id, after.score));
    await update(after);
    if (after.done) audit("finished", { quiz: quiz.id, score: after.score, total: after.total });
  };

  /** Draws the card light or dark, now. */
  const applyTheme = async () => {
    if (where === "card" || where === "window") await post({ do: "theme", theme: theme() });
    await card?.redraw();
  };

  /** Switches between light and dark, and remembers it. */
  const switchTheme = async () => {
    await load();
    switched = flipped(theme());
    await store.saveAppearance(switched);
    audit("theme-switched", { to: switched });
    await applyTheme();
  };

  /** A message from the page. */
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      system = schemeOf(m.scheme) ?? system;
      await post({
        do: "setup",
        lang: tf.t("page-lang"),
        dir: tf.t("page-dir"),
        theme: theme(),
        labels: { close: tf.t("page-close"), list: tf.t("list-back"), theme: tf.t("page-theme") },
      });
      await card?.redraw();
      return render();
    }
    if (m.type === "scheme") {
      system = schemeOf(m.scheme) ?? system;
      return applyTheme();
    }
    if (m.type === "pick") return pick(Number(m.choice));
    if (m.type === "next") return next();
    if (m.type === "again") return restart();
    if (m.type === "list") return showList();
    if (m.type === "open-quiz") return openQuiz(m.id);
    if (m.type === "theme") return switchTheme();
    if (m.type === "close") return close();
  };

  /** A click on a panel row. */
  const clicked = async (e) => {
    if (where !== "panel" || !e || e.action !== "activate") return;
    const choice = choiceOfRow(e.row);
    if (choice !== null) return pick(choice);
    const id = quizOfRow(e.row);
    if (id !== null) return openQuiz(id);
    if (e.row === ROW.list) return showList();
    if (e.row === ROW.next) return next();
    if (e.row === ROW.again) return restart();
  };

  const agent = createAgentCommands(tf, {
    store,
    loadIndex: async () => {
      await load();
      return index;
    },
    saveIndex,
    // Shows the list only when the quiz is closed: never pulls the user out of a quiz.
    revealList: async () => (where ? undefined : showList()),
    // The list on show takes in what an agent changed.
    changed: async () => (where && !quiz ? render() : undefined),
    audit,
    now: () => Date.now(),
  });

  /** Runs a handler's work in the background, so the handler returns at once. */
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch(warn);

  // ------------------------------------------------- registration (nothing awaited above)
  const runs = {
    open,
    list: showList,
    close: () => close(),
    restart,
    theme: switchTheme,
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
  // Agents' commands answer the agent, so they run to the end (within ten seconds).
  for (const c of AGENT_COMMANDS) {
    tf.command(tf.t(c.title), (input) => agent[c.id](input), {
      id: c.id,
      ...(c.input ? { input: c.input } : {}),
    });
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
        audit("closed", { as: "page" });
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
        audit("closed", { as: "panel" });
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
    // with "Quiz: Start or show". Everything stays kept.
    background(() => (where === "card" ? close() : undefined)),
  );
  /** The settings as last seen, to tell what changed. */
  let corner = cornerSetting(tf.settings);
  let showAs = showAsSetting(tf.settings);
  let appearance = appearanceSetting(tf.settings);
  tf.on(
    "setting.changed",
    background(async () => {
      const now = {
        corner: cornerSetting(tf.settings),
        showAs: showAsSetting(tf.settings),
        appearance: appearanceOf(appearanceSetting(tf.settings)),
      };
      if (now.showAs !== showAs) {
        showAs = now.showAs;
        if (where) await open();
      }
      if (now.appearance !== appearance) {
        // A choice in Settings wins over the last switch.
        appearance = now.appearance;
        await load();
        switched = null;
        await store.saveAppearance(null);
        await applyTheme();
      }
      if (now.corner !== corner) {
        corner = now.corner;
        // Choosing a corner puts a dragged card back in the pane.
        if (await card?.reset("corner")) return;
      }
      await card?.redraw();
    }),
  );

  return { state: () => ({ where, quiz: quiz?.id ?? null, state }) };
}
