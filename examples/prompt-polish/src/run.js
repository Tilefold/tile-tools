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
 * Where the page shows (show.js, place.js): on a card over the pane,
 * above its input (`tf.page.open({ dock })`, Tilefold 0.1.11); behind a
 * round button in the pane's corner (an overlay item), the card opening
 * above it; or in the dock beside the panes (`tf.page.open({ side: true })`,
 * Tilefold 0.1.20). The page's header switches between them, and the
 * choice is kept until the setting changes.
 *
 * The prompts live only in the tile's memory and go only to Claude (after
 * the user's yes) and to the ask card. They are never stored and never
 * recorded: the tile's log gets one-word actions (tile.<id>.<action>) with
 * counts only: `opened`, `closed`, `checked`, `sent`, `view-changed`.
 *
 * Event handlers get half a second, so each starts its work in the
 * background and returns at once.
 */
import { buildAsk, errorKey, readAnswer } from "./answer.js";
import { languageOf } from "./languages.js";
import { viewOf as checkView } from "./place.js";
import { blocker, build, changeCount, changes, diff } from "./polish.js";
import { createSessions, resetSession } from "./sessions.js";
import { COMMANDS, settingsOf } from "./settings.js";
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
  const warn = (err) =>
    void Promise.resolve()
      .then(() => tf.log.warn(String(err && err.message ? err.message : err)))
      .catch(() => {});
  const audit = (action, details) =>
    void Promise.resolve()
      .then(() => tf.audit(action, details))
      .catch(warn);

  const canFloat = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  // Docking beside the panes came with Tilefold's theme for tiles (0.1.20).
  const canSide = () => !!tf.page && typeof tf.theme === "function";

  const sessions = createSessions();
  const stage = createStage(tf, { warn, canSide });
  /** Whether Prompt Polish is on at all (the corner button and the side dock show while it is). */
  let active = false;
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
    await post({
      do: "show",
      view: viewOf(
        { ...s, pane: id, view: effectiveView(), language: language(), mode: current().mode },
        tf.t,
      ),
    });
  };

  /** The fixes still waiting in a session, for the button's badge. */
  const waiting = (s) =>
    s && s.step === "result"
      ? changeCount(s.parts) - s.parts.filter((p) => p.id && s.rejected.has(p.id)).length
      : 0;

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
    const where = await stage.show({ view, active, open: !!s?.open, waiting: waiting(s) });
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
    s.open = true;
    await place();
    if (!was) audit("opened", { view: effectiveView() });
  };

  /** Closes the shown pane's card (×): its prompt goes; beside the panes, the dock closes. */
  const closeShown = async () => {
    const s = sessions.get(shown);
    if (s) {
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
    for (const id of sessions.ids()) sessions.drop(id);
    await place();
    if (was) audit("closed", {});
  };

  /** The user chose a view on the page: kept, and the page moves there. */
  const chooseView = async (to) => {
    const v = checkView(to);
    if (v !== to) return;
    chosen = v;
    await tf.store.set(VIEW_KEY, v);
    const s = sessions.ensure(focusId());
    s.open = true;
    audit("view-changed", { to: v });
    await place();
  };

  /** Folds the card into the corner button (from the bottom or corner view). */
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

  /** Asks Claude to check pane `id`'s prompt, then shows the fixes there. */
  const check = async (id, text) => {
    const s = sessions.get(id);
    if (!s) return;
    s.draft = String(text ?? "").slice(0, MAX_DRAFT);
    if (s.busy || blocker(s.draft)) return;
    if (!tf.ai) {
      Object.assign(s, { step: "problem", problem: "error-no-ai" });
      return render(id);
    }
    s.busy = true;
    const original = s.draft;
    const lang = language();
    const { mode, fast } = current();
    s.step = "checking";
    await render(id);
    try {
      let answer;
      try {
        answer = await tf.ai.ask(
          buildAsk({
            text: original,
            language: lang.name,
            mode,
            uiLanguage: tf.t("ai-language"),
            fast,
          }),
        );
      } catch (err) {
        const key = errorKey(err);
        Object.assign(s, key ? { step: "problem", problem: key } : { step: "write" });
        return render(id);
      }
      const r = readAnswer(answer.text, original);
      if (!r.ok) {
        Object.assign(s, {
          step: "problem",
          problem: r.why === "changed-code" ? "error-changed-code" : "error-unreadable",
        });
        return render(id);
      }
      Object.assign(s, {
        step: "result",
        parts: changes(diff(original, r.corrected)),
        notes: r.notes,
        rejected: new Set(),
        clean: false,
      });
      // Counts only: never the prompt or the fixes.
      audit("checked", {
        language: lang.code,
        mode,
        changes: changeCount(s.parts),
        model: String(answer.model ?? ""),
        outputTokens: Number(answer.usage?.outputTokens ?? 0),
      });
      await render(id);
      if (stage.buttonShown()) await place();
    } finally {
      s.busy = false;
    }
  };

  /** Puts `text` on Tilefold's ask card for the agent in the pane the user works in. */
  const sendToAgent = async (id, text, how) => {
    const s = sessions.get(id);
    const question = String(text ?? "").trim();
    if (!s || !question) return;
    if (typeof tf.agent?.ask !== "function") return tf.toast(tf.t("error-no-agent-ask"));
    let r;
    try {
      r = await tf.agent.ask({
        question,
        about: tf.t("ask-about", { language: language().native }),
      });
    } catch (err) {
      warn(err);
      return tf.toast(tf.t("error-ask-failed"));
    }
    if (!r?.shown)
      return tf.toast(tf.t(r?.why === "busy" ? "error-ask-busy" : "error-ask-no-pane"));
    const total = how === "corrected" ? changeCount(s.parts) : 0;
    const undone =
      how === "corrected" ? s.parts.filter((p) => p.id && s.rejected.has(p.id)).length : 0;
    audit("sent", { how, kept: total - undone, undone });
    resetSession(s).step = "sent";
    await render(id);
    // In the corner view the card folds back into its button.
    if (effectiveView() === "corner") {
      s.open = false;
      await place();
    }
  };

  /** A message from the page; `pane` says whose prompt it is about. */
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      await post({ do: "setup", ...setupOf(tf.t) });
      return render();
    }
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
    if (m.type === "send" && s.step === "result")
      return sendToAgent(id, build(s.parts, s.rejected), "corrected");
    if (m.type === "again") {
      resetSession(s);
      return render(id);
    }
  };

  /** Runs a handler's work in the background, so the handler returns at once. */
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch(warn);

  // ------------------------------------------------- registration (nothing awaited above)
  const runs = { open, close: closeAll };
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
      // Closed from elsewhere: the window's or the dock's close button, the tile turned off.
      if (!stage.where()) return;
      stage.lostPage();
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
        if (active) await place();
      }
      await render();
    }),
  );

  return {
    state: () => ({ where: stage.where(), shown, active, sessions: sessions.size() }),
  };
}
