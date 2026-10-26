/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the tile
 *
 * Runs the quiz library and shows it where the user wants it (place.js):
 *
 * - On a card (the default): the quiz page floating over the panes,
 *   borderless, with a grip above it (card.js). Before Tilefold 0.1.11,
 *   which can't float pages, the page opens in a window of its own.
 * - Docked beside the panes (Tilefold 0.1.20): the page in the dock on the
 *   right, where the panes make room for it. The card's dock button puts it
 *   there; the docked page's float button, or Tilefold's own Undock, puts it
 *   back on a card. Moving reloads the page, which then says hello again.
 * - In a panel beside the panes: rows Tilefold draws in the user's theme.
 *   Also the fallback without tile pages (before 0.1.7).
 *
 * Two screens: the list of quizzes (the built-in one and those AI agents
 * made from the user's files, agent.js), and the quiz being taken. The
 * quizzes live here, never in the page: the page only draws the view it is
 * sent and says what the user clicked, so every place shows the same.
 * Progress is kept per quiz. How the card looks is look.js's: Tilefold's
 * theme where Tilefold tells it, else its own light or dark.
 *
 * Messages with the page: it says `hello` (with the system's light or dark)
 * when it loads and gets `setup` (its language, labels, look and place) and
 * `show` (the view); it sends `pick`, `next`, `again`, `list`, `open-quiz`,
 * `theme`, `scheme`, `place` (to the card or the dock), `move` and `resize`
 * (dragging the card's top bar or corner) and `close`. What happens is
 * recorded in the tile's log as one-word actions (tile.<id>.<action>):
 * `opened`, `moved`, `answered`, `finished`, `restarted`, `closed`,
 * `theme-switched`.
 *
 * Event handlers get half a second, so each one starts its work in the
 * background and returns at once.
 */
import { createAgentCommands, AGENT_COMMANDS } from "./agent.js";
import { createCard } from "./card.js";
import { BUILTIN_ID, visible, withBest, withBuiltin } from "./library.js";
import { createLook } from "./look.js";
import { isMovable, placeOf, showsAt } from "./place.js";
import { nextQuestion, pickChoice, startQuiz } from "./quiz.js";
import { COMMANDS, cornerSetting, showAsSetting } from "./settings.js";
import { createStore } from "./store.js";
import {
  ROW,
  cardView,
  choiceOfRow,
  listCardView,
  listPanelView,
  panelView,
  quizOfRow,
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
  const look = createLook(tf, store);

  let loaded = false;
  /** The library's index, the built-in quiz included. */
  let index = [];
  /** The quiz being taken and where the user is in it, or null on the list. */
  let quiz = null;
  let state = null;
  /** Where the quiz shows now: "card", "side", "window", "panel", or null when closed. */
  let where = null;
  /** The card or the dock, as the user last moved it (until the setting changes). */
  let chosen = null;

  const canFloat = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  // Docking beside the panes came with Tilefold's theme for tiles (0.1.20).
  const canSide = () => !!tf.page && typeof tf.theme === "function";
  const card = canFloat()
    ? createCard(tf, {
        corner: () => cornerSetting(tf.settings),
        theme: () => look.mode(),
        colors: () => look.colors(),
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
    quiz = q;
    state = q ? await store.progress(id, q.questions.length) : null;
    await store.saveCurrent(q ? id : null);
    return !!q;
  };

  /** Reads what was kept, once. */
  const load = async () => {
    if (loaded) return;
    loaded = true;
    index = await loadIndex();
    const current = await store.current();
    if (current) await select(current);
    chosen = await store.placement();
    await look.load();
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

  /** Shows the page on the floating card (or in a window where it can't float). */
  const toCard = async () => {
    if (card) {
      await tf.page.open({ dock: await card.pageSpot() });
      where = "card";
      await card.show();
    } else {
      await tf.page.open();
      where = "window";
    }
  };

  /** Shows the page docked beside the panes. */
  const toSide = async () => {
    await card?.hide();
    await tf.page.open({ side: true });
    where = "side";
  };

  /** Opens the quiz where it should go, or moves it there; falls back as needed. */
  const open = async () => {
    await load();
    const place = placeOf(showAsSetting(tf.settings), chosen, canSide());
    if (where && showsAt(where, place)) return render();
    // Between the card and the dock the page moves (Tilefold reloads it there).
    if (where && where !== "panel" && isMovable(place)) {
      await (place === "side" ? toSide() : toCard());
      audit("moved", { to: where });
      return;
    }
    if (where) await close(false);
    if ((place === "panel" || !tf.page) && tf.panel) {
      where = "panel";
      await render();
    } else if (tf.page) {
      await (place === "side" ? toSide() : toCard());
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

  /** The user moved the quiz to the card or the dock: remembered, then done. */
  const moveTo = async (place) => {
    if (!isMovable(place) || (place === "side" && !canSide())) return;
    await load();
    chosen = place;
    await store.savePlacement(place);
    await open();
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
  };

  /** Takes quiz `id` from the list. */
  const openQuiz = async (id) => {
    await load();
    if (!(await select(String(id)))) return render();
    if (where) await render();
    else await open();
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

  /** Draws the card as it looks now (light or dark, Tilefold's colors). */
  const applyLook = async () => {
    if (where && where !== "panel") await post({ do: "theme", theme: look.mode() });
    await card?.redraw();
  };

  /** Switches between light and dark (on a Tilefold whose theme doesn't decide). */
  const switchTheme = async () => {
    await load();
    if (look.follows()) return;
    audit("theme-switched", { to: await look.switchMode() });
    await applyLook();
  };

  /** A message from the page. */
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      look.systemIs(m.scheme);
      await post({
        do: "setup",
        lang: tf.t("page-lang"),
        dir: tf.t("page-dir"),
        theme: look.mode(),
        // Tilefold's theme draws the page: its own light and dark step aside.
        themed: look.follows(),
        // Only the floating card moves and resizes from the page.
        docked: where === "card",
        // Which way it can move: to the dock from the card, back from the dock.
        place: where === "card" && canSide() ? "card" : where === "side" ? "side" : null,
        labels: {
          close: tf.t("page-close"),
          list: tf.t("list-back"),
          theme: tf.t("page-theme"),
          resize: tf.t("page-resize"),
          dock: tf.t("page-dock"),
          float: tf.t("page-float"),
        },
      });
      await card?.redraw();
      return render();
    }
    if (m.type === "scheme") {
      look.systemIs(m.scheme);
      return applyLook();
    }
    if (m.type === "pick") return pick(Number(m.choice));
    if (m.type === "next") return next();
    if (m.type === "again") return restart();
    if (m.type === "list") return showList();
    if (m.type === "open-quiz") return openQuiz(m.id);
    if (m.type === "theme") return switchTheme();
    if (m.type === "place") return moveTo(m.to);
    if (m.type === "move") return card?.pageMove(m);
    if (m.type === "resize") return card?.pageResize(m);
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
      // Closed from elsewhere (the window's or the dock's close button, the tile turned off).
      if (where && where !== "panel") {
        const was = where;
        where = null;
        await card?.hide();
        audit("closed", { as: was });
      }
    }),
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock on the dock's bar: back on the card.
    background(async () => {
      if (where === "side") where = null;
      await moveTo("card");
    }),
  );
  tf.on(
    "theme.changed",
    background(async (e) => {
      look.tilefoldChanged(e);
      await applyLook();
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
  tf.on(
    "setting.changed",
    background(async () => {
      await load();
      const now = { corner: cornerSetting(tf.settings), showAs: showAsSetting(tf.settings) };
      if (now.showAs !== showAs) {
        // A choice in Settings wins over the user's last move.
        showAs = now.showAs;
        chosen = null;
        await store.savePlacement(null);
        if (where) await open();
      }
      if (await look.settingChanged()) await applyLook();
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
