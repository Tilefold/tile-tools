/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — the tile
 *
 * The user writes a prompt on the tile's page, in the language they chose.
 * Check asks Claude to correct it (`tf.ai.ask`, with the user's own key;
 * Tilefold shows them the question first). The fixes come back as a diff
 * the user goes through, undoing any change to keep their own words, with
 * a short reason for each. Send to agent puts the result on Tilefold's ask
 * card (`tf.agent.ask`), where the user presses Return to send it to the
 * agent in the pane they work in: the tile never types into a pane.
 *
 * One Prompt Polish per pane (sessions.js): each pane has its own draft
 * and fixes, and the page shows the one of the pane the user works in. So
 * switching panes or tabs switches prompts, a pane where it isn't open
 * shows nothing over it, and Send to agent always goes to that pane's
 * agent (the ask card offers it first).
 *
 * Where the page shows (show.js, place.js). By default a small "Polish"
 * pill sits at the right end of the pane's bottom row, by where the user
 * types (an overlay item, shown as soon as the tile runs); clicking it
 * opens the card above it (`tf.page.open({ dock })`, Tilefold 0.1.11),
 * which folds back into the pill after sending. Or the card stays open
 * over the pane, above its input, or the page sits in the dock beside the
 * panes (`tf.page.open({ side: true })`, Tilefold 0.1.20). The page's
 * header switches between them, and the choice is kept until the setting
 * changes. Prompt Polish: Close hides the pill until Write a prompt.
 *
 * The prompts live only in the tile's memory and go only to Claude (after
 * the user's yes) and to the ask card. They are never stored and never
 * recorded: the tile's log gets one-word actions (tile.<id>.<action>) with
 * counts only: `opened`, `closed`, `checked`, `sent`, `view-changed`,
 * `card-moved`, `card-filled`.
 *
 * Who checks (setting `checker`): Claude with the user's own key
 * (claudeRun.js), or an agent (agentRun.js), for users without a key: the
 * polish agent in a tab of its own where Tilefold has one (the setting
 * `helperAgent` picks it), else the agent in the pane through the ask
 * card. The agent hands its correction back through the Hand back command
 * (`tile_run`), and the same diff shows. Where the key is missing, the
 * polish agent checks it instead (or the card offers to ask the agent).
 *
 * Event handlers get half a second, so each starts its work in the
 * background and returns at once.
 *
 * Modified 2026-11-06 (no-key mode): the agent in the pane can check the
 *   prompt; Claude's check moved to claudeRun.js.
 * Modified 2026-11-06 (input actions): the ✦ Polish button in Tilefold's
 *   agent input box (inputAction.js) opens the card checking that text, and
 *   Use / Keep mine answer it. Send to agent moved to sendToAgent.js.
 * Modified 2026-11-06 (Stop): Tilefold's × closes the card
 *   (`input.cancelled`), and a card closed or gone ends its request.
 * Modified 2026-11-07 (move, fill, fold): the card can be dragged and fill
 *   the pane (cardMoves.js); folded over the agent input box, it leaves the
 *   pill while there is something to come back to.
 */
import { HAND_BACK, HAND_BACK_INPUT } from "./agentCheck.js";
import { createAgentRun } from "./agentRun.js";
import { createCardMoves } from "./cardMoves.js";
import { createLog } from "./log.js";
import { createClaudeRun } from "./claudeRun.js";
import { createInputAction } from "./inputAction.js";
import { createSendToAgent } from "./sendToAgent.js";
import { languageOf } from "./languages.js";
import { viewOf as checkView } from "./place.js";
import { blocker, build } from "./polish.js";
import { createSessions, keepsPill, resetSession, waitingFixes } from "./sessions.js";
import { cardSettings, COMMANDS, settingsOf } from "./settings.js";
import { BUTTON_ID, createStage } from "./show.js";
import { setupOf, viewOf } from "./view.js";

export { BUTTON_ID };
/** The store key of the view the user last chose on the page. */
export const VIEW_KEY = "view";
/** The longest draft kept from the page, in characters. */
const MAX_DRAFT = 20_000;
/** The session id used where Tilefold reports no panes (a page in a window). */
const NO_PANE = "window";

/** @param {any} tf */
export function runPolish(tf) {
  const { warn, audit, background } = createLog(tf);

  const canFloat = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  // Docking beside the panes came with Tilefold's theme for tiles (0.1.20).
  const canSide = () => !!tf.page && typeof tf.theme === "function";

  const sessions = createSessions();
  const stage = createStage(tf, { warn, canSide });
  const kept = () => stage.kept();
  const moves = createCardMoves({ place: () => place(), render: () => render(), audit, kept });
  /** Whether Prompt Polish is on at all (the pill and the side dock show while it is). */
  let active = false;
  /** The user closed it from the palette: the pill stays away until Write a prompt. */
  let dismissed = false;
  /** The pane whose session the page shows now, or null. */
  let shown = null;
  /** The view the user chose on the page (until the setting changes), or null. */
  let chosen = null;
  let loaded = false;

  const current = () => settingsOf(tf.settings);
  const language = () => languageOf(current().language, tf.t("page-lang"));

  /** The view to use: the user's choice, else the setting; what this Tilefold can do. */
  const effectiveView = () => {
    let v = chosen ?? current().view;
    if (v !== "side" && !canFloat()) v = "side";
    if (v === "side" && !canSide()) v = canFloat() ? "bottom" : "window";
    return v;
  };

  /** The pane the user works in (a fixed id where Tilefold reports no panes). */
  const focusId = () => stage.focus() ?? NO_PANE;

  const load = async () => {
    if (loaded) return;
    loaded = true;
    const v = await tf.store.get(VIEW_KEY).catch(() => null);
    chosen = v === "bottom" || v === "corner" || v === "side" ? v : null;
    if (typeof tf.theme === "function") {
      stage.setAccent((await tf.theme().catch(() => null))?.colors?.accent ?? null);
    }
  };

  /** Sends the page a message; a closed page drops it (it gets everything on hello). */
  const post = async (message) => {
    if (!stage.where()) return;
    try {
      await tf.page.post(message);
    } catch {
      // Closed in the meantime.
    }
  };

  /** Draws pane `id`'s session on the page, if it is the one showing. */
  const render = async (id = shown) => {
    const s = sessions.get(id);
    if (!s || id !== shown) return;
    // The polish agent is called what the user renamed its pane to, if they did.
    const { max, collapsed } = moves.state();
    const card = { ...cardSettings(current()), max, collapsed };
    const called = agentRun.calledName();
    if (called) card.helperName = called;
    await post({
      do: "show",
      view: viewOf({ ...s, pane: id, view: effectiveView(), language: language(), ...card }, tf.t),
    });
  };

  /**
   * Shows the focused pane's Prompt Polish where it belongs, and nothing
   * for a pane where it isn't open. Called on open, on every layout change
   * (focus, tabs, panes moving) and whenever what shows changes.
   */
  const place = async () => {
    await stage.ensureLayout();
    const view = effectiveView();
    const id = focusId();
    // Beside the panes and in a window there is always a prompt for the pane you're in.
    const s = view === "side" || view === "window" ? sessions.ensure(id) : sessions.get(id);
    // A folded card with something to come back to keeps its pill, even over the input box.
    const show = {
      view,
      active,
      open: !!s?.open,
      waiting: waitingFixes(s),
      keepPill: keepsPill(s),
    };
    const where = await stage.show({ ...show, ...moves.state() });
    const next = where && s ? id : null;
    if (next !== shown) {
      shown = next;
      await render();
    }
  };

  /** Opens Prompt Polish for the pane the user works in. */
  const open = async () => {
    await load();
    if (!tf.page) {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return;
    }
    await stage.ensureLayout();
    const s = sessions.ensure(focusId());
    const was = active && s.open;
    active = true;
    dismissed = false;
    s.open = true;
    await place();
    if (!was) audit("opened", { view: effectiveView() });
  };

  /** Opens the card for pane `id` (a click in its agent input box). */
  const openFor = async (id) => {
    await load();
    if (!tf.page) return;
    await stage.ensureLayout();
    stage.focusOn(id);
    const s = sessions.ensure(id);
    const was = active && s.open;
    active = true;
    dismissed = false;
    s.open = true;
    await place();
    if (!was) audit("opened", { view: effectiveView(), from: "input" });
  };

  /** After Use or Keep mine: the card folds away (beside the panes, a fresh prompt shows). */
  const foldAfter = async (id) => {
    const v = effectiveView();
    const s = sessions.get(id);
    if (s && v !== "side" && v !== "window") s.open = false;
    await place();
    await render(id);
  };

  /** Closes the shown pane's card (×): its prompt goes; beside the panes, the dock closes. */
  const closeShown = async () => {
    const s = sessions.get(shown);
    if (s) {
      await inputAction.release(shown);
      agentRun.forget(shown);
      resetSession(s);
      s.open = false;
    }
    const v = effectiveView();
    if (v === "side" || v === "window") active = false;
    await place();
    audit("closed", {});
  };

  /** Closes everything, in every pane (the palette's Close). */
  const closeAll = async () => {
    const was = active;
    active = false;
    dismissed = true;
    await inputAction.releaseAll();
    for (const id of sessions.ids()) sessions.drop(id);
    await place();
    if (was) audit("closed", {});
  };

  /** The user chose a view on the page: kept, and the page moves there. */
  const chooseView = async (to) => {
    const v = checkView(to);
    if (v !== to) return;
    chosen = v;
    moves.reset();
    await tf.store.set(VIEW_KEY, v);
    const s = sessions.ensure(focusId());
    s.open = true;
    audit("view-changed", { to: v });
    await place();
  };

  /** Folds the card into the Polish pill (from the bottom or corner view). */
  const fold = async () => {
    const v = effectiveView();
    if (v === "side" || v === "window") return;
    if (v !== "corner") {
      chosen = "corner";
      await tf.store.set(VIEW_KEY, "corner");
      audit("view-changed", { to: "corner" });
    }
    const s = sessions.get(focusId());
    if (s) s.open = false;
    await place();
  };

  // The two ways to check a prompt share how they show what they found.
  const deps = {
    sessions,
    render,
    refreshButton: async () => {
      if (stage.buttonShown()) await place();
    },
    audit,
    warn,
    language,
    mode: () => current().mode,
    fast: () => current().fast,
    helperAgent: () => current().helperAgent,
  };
  const agentRun = createAgentRun(tf, deps);
  // Without a key, the polish agent checks it (where Tilefold has one).
  const claudeRun = createClaudeRun(tf, { ...deps, noKey: agentRun.takeOver });
  const sendToAgent = createSendToAgent(tf, {
    ...deps,
    // With the pill, the card folds back into it.
    afterSend: async (s) => {
      if (effectiveView() !== "corner") return;
      s.open = false;
      await place();
    },
  });
  const inputAction = createInputAction(tf, {
    ...deps,
    layout: async () => (await stage.ensureLayout(), stage.layout()),
    openFor,
    check: (id, text) => check(id, text),
    fold: foldAfter,
    noPane: NO_PANE,
  });

  /** Checks pane `id`'s prompt: by Claude with the user's key, or by the agent in the pane. */
  const check = async (id, text, by = current().checker) => {
    const s = sessions.get(id);
    if (!s) return;
    s.draft = String(text ?? "").slice(0, MAX_DRAFT);
    if (s.busy || blocker(s.draft)) return;
    if (by === "agent") return agentRun.check(id, s.draft);
    return claudeRun.check(id, s.draft);
  };

  /** A message from the page; `pane` says whose prompt it is about. */
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      await post({ do: "setup", ...setupOf(tf.t) });
      return render();
    }
    if (await moves.hear(m)) return;
    if (m.type === "view") return chooseView(m.to);
    if (m.type === "fold") return fold();
    if (m.type === "size") {
      if (stage.setHeight(Number(m.h))) await place();
      return;
    }
    if (m.type === "close") return closeShown();
    // Everything else is about one pane's prompt: the one it was typed for.
    const id = typeof m.pane === "string" ? m.pane : shown;
    const s = sessions.get(id);
    if (!s) return;
    if (m.type === "draft") {
      if (s.step === "write") s.draft = String(m.text ?? "").slice(0, MAX_DRAFT);
      return;
    }
    if (m.type === "check") return check(id, m.text);
    if (m.type === "agent-check") return check(id, s.draft, "agent");
    if (m.type === "cancel-agent") return agentRun.cancel(id);
    if (m.type === "as-is")
      return sendToAgent(id, String(m.text ?? "").slice(0, MAX_DRAFT), "as-is");
    if (m.type === "toggle" && s.step === "result") {
      const n = Number(m.id);
      if (!s.parts.some((p) => p.id === n)) return;
      if (s.rejected.has(n)) s.rejected.delete(n);
      else s.rejected.add(n);
      await render(id);
      if (stage.buttonShown()) await place();
      return;
    }
    if (m.type === "clean" && s.step === "result") {
      s.clean = !s.clean;
      return render(id);
    }
    if (m.type === "back") {
      s.step = "write";
      return render(id);
    }
    // From the agent input box: Use puts it back there, Keep mine leaves it.
    if (m.type === "send" && s.step === "result" && s.input) return inputAction.use(id);
    if (m.type === "send-now" && s.step === "result" && s.input) return inputAction.use(id, true);
    if (m.type === "keep") return inputAction.keep(id);
    if (m.type === "send" && s.step === "result")
      return sendToAgent(id, build(s.parts, s.rejected), "corrected");
    if (m.type === "again") {
      await inputAction.release(id);
      agentRun.forget(id);
      resetSession(s);
      return render(id);
    }
  };

  /**
   * Shows the Polish pill without being asked, when that is the view: as
   * soon as the tile runs, and whenever the panes change, unless the user
   * closed Prompt Polish from the palette.
   */
  const wake = async () => {
    await load();
    if (active || dismissed || !canFloat() || effectiveView() !== "corner") return;
    active = true;
    await place();
  };

  // ------------------------------------------------- registration (nothing awaited above)
  // ✦ Polish in Tilefold's agent input box, where this Tilefold has it.
  inputAction.register();
  tf.on(
    "input.action",
    background((e) => inputAction.clicked(e)),
  );
  tf.on(
    "input.cancelled",
    background((e) => inputAction.cancelled(e)),
  );
  const runs = { open, close: closeAll };
  for (const c of COMMANDS) {
    tf.command(
      tf.t(c.title),
      background(() => runs[c.id]()),
      { id: c.id },
    );
  }
  // For AI agents: the agent in the pane hands back the prompt it corrected.
  tf.command(
    tf.t("cmd-hand-back"),
    async (input) => (input == null ? void (await open()) : agentRun.handBack(input)),
    { id: HAND_BACK, input: HAND_BACK_INPUT },
  );
  tf.on(
    "page.message",
    background((e) => hear(e && e.message)),
  );
  tf.on(
    "page.closed",
    background(async () => {
      // Closed from elsewhere: the window's or the dock's close button, the tile turned off.
      if (!stage.where()) return;
      stage.lostPage();
      // Its request ends with it, so Tilefold's button stops spinning.
      await inputAction.releaseAll();
      const s = sessions.get(shown);
      shown = null;
      const v = effectiveView();
      if (v === "side" || v === "window") active = false;
      else if (s) s.open = false;
      await place();
    }),
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock on the dock's bar: back over the pane.
    background(async () => {
      stage.lostPage();
      shown = null;
      await chooseView("bottom");
    }),
  );
  tf.on(
    "overlay.layout",
    background(async (e) => {
      if (!e || !Array.isArray(e.panes)) return;
      stage.setLayout(e);
      await wake();
      if (active) await place();
    }),
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.item !== BUTTON_ID || e.type !== "click") return;
      const s = sessions.ensure(focusId());
      s.open = !s.open;
      await place();
    }),
  );
  tf.on(
    "overlay.hidden",
    // The user hid tile overlays: the button goes, and the card with it.
    background(async () => {
      stage.lostOverlay();
      if (stage.where() === "card") await closeAll();
    }),
  );
  tf.on(
    "theme.changed",
    background(async (e) => {
      stage.setAccent(e?.colors?.accent ?? null);
      if (stage.buttonShown()) await place();
    }),
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      await load();
      if (e?.key === "view") {
        // A choice in Settings wins over the page's last switch.
        chosen = null;
        await tf.store.delete(VIEW_KEY);
        await wake();
        if (active) await place();
      }
      await render();
    }),
  );

  // The pill shows as soon as the tile runs (after registering everything).
  void Promise.resolve().then(wake).catch(warn);

  return {
    state: () => ({ where: stage.where(), shown, active, sessions: sessions.size() }),
  };
}
