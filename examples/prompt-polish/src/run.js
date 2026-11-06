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
 * Where the page shows (place.js): on a card over the focused pane, above
 * its input (`tf.page.open({ dock })`, Tilefold 0.1.11), following the
 * pane as the user moves between panes (`overlay.layout`); behind a round
 * button in that pane's corner (an overlay item), the card opening above
 * it; or in the dock beside the panes (`tf.page.open({ side: true })`,
 * Tilefold 0.1.20). The page's header switches between them, and the
 * choice is kept until the setting changes. A pane too small for the card
 * sends it to the side dock; a Tilefold that can't dock pages opens it in
 * a window of its own.
 *
 * The prompt lives only in the tile's memory while the page is open, and
 * goes only to Claude (after the user's yes) and to the ask card. It is
 * never stored and never recorded: the tile's log gets one-word actions
 * (tile.<id>.<action>) with counts only: `opened`, `closed`, `checked`,
 * `sent`, `view-changed`.
 *
 * Event handlers get half a second, so each starts its work in the
 * background and returns at once.
 */
import { buildAsk, errorKey, readAnswer } from "./answer.js";
import { buttonImage } from "./button.js";
import { languageOf } from "./languages.js";
import { placeFor, sameSpot, viewOf as checkView } from "./place.js";
import { blocker, build, changeCount, changes, diff } from "./polish.js";
import { COMMANDS, settingsOf } from "./settings.js";
import { setupOf, viewOf } from "./view.js";

/** The store key of the view the user last chose on the page. */
export const VIEW_KEY = "view";
/** The overlay item id of the corner button. */
export const BUTTON_ID = "polish-button";
/** The longest draft kept from the page, in characters. */
const MAX_DRAFT = 20_000;

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
  const rtl = () => tf.t("page-dir") === "rtl";

  /** What the user is doing, in memory only. */
  const s = {
    step: "write",
    draft: "",
    parts: [],
    notes: [],
    rejected: new Set(),
    clean: false,
    problem: "",
  };
  /** Where the page is: "card", "side", "window", or null when closed. */
  let where = null;
  /** Whether the corner button is drawn, and whether its card is open. */
  let buttonShown = false;
  let cornerOpen = false;
  /** The view the user chose on the page (until the setting changes), or null. */
  let chosen = null;
  let loaded = false;
  /** The last layout, the card's spot, and how tall the page asked to be. */
  let layout = null;
  let spot = null;
  let wantH = 260;
  /** Tilefold's accent, for the button. */
  let accent = null;
  /** True while a question to Claude is under way, so only one is asked. */
  let busy = false;

  const current = () => settingsOf(tf.settings);
  const language = () => languageOf(current().language, tf.t("page-lang"));

  /** The view to use: the user's choice, else the setting; what this Tilefold can do. */
  const effectiveView = () => {
    let v = chosen ?? current().view;
    if (v !== "side" && !canFloat()) v = "side";
    if (v === "side" && !canSide()) v = canFloat() ? "bottom" : "window";
    return v;
  };

  const load = async () => {
    if (loaded) return;
    loaded = true;
    const v = await tf.store.get(VIEW_KEY).catch(() => null);
    chosen = v === "bottom" || v === "corner" || v === "side" ? v : null;
    if (typeof tf.theme === "function") {
      accent = (await tf.theme().catch(() => null))?.colors?.accent ?? null;
    }
  };

  /** Sends the page a message; a closed page drops it (it gets everything on hello). */
  const post = async (message) => {
    if (!where) return;
    try {
      await tf.page.post(message);
    } catch {
      // Closed in the meantime.
    }
  };

  const render = () =>
    post({
      do: "show",
      view: viewOf(
        { ...s, view: effectiveView(), language: language(), mode: current().mode },
        tf.t,
      ),
    });

  /** The waiting fixes, for the button's badge. */
  const waiting = () =>
    s.step === "result"
      ? changeCount(s.parts) - s.parts.filter((p) => p.id && s.rejected.has(p.id)).length
      : 0;

  /** Draws or moves the corner button. */
  const drawButton = async (rect) => {
    const item = {
      id: BUTTON_ID,
      image: buttonImage({ accent, waiting: waiting(), open: cornerOpen }),
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      hit: true,
      cursor: "pointer",
      label: tf.t("button-label"),
    };
    if (buttonShown) await tf.overlay.update({ items: [item] });
    else await tf.overlay.show({ items: [item] });
    buttonShown = true;
  };

  const hideButton = async () => {
    if (!buttonShown) return;
    buttonShown = false;
    await tf.overlay.hide().catch(warn);
  };

  /** Closes the page only (the corner button may stay). */
  const closePage = async () => {
    if (!where) return;
    where = null;
    spot = null;
    await tf.page.close().catch(warn);
  };

  /** Shows the page at `card` over the pane: opens it there, moves it, or brings it out of the dock. */
  const toCard = async (card) => {
    if (where === "card") {
      if (!sameSpot(card, spot)) await tf.page.dock(card);
    } else {
      await tf.page.open({ dock: card });
    }
    where = "card";
    spot = card;
  };

  const toSide = async () => {
    await hideButton();
    if (where !== "side") await tf.page.open({ side: true });
    where = "side";
    spot = null;
  };

  /**
   * Shows everything where it belongs now: opens, moves or closes the page
   * and the button. Called on open, on every layout change, and when the
   * page asks for another height.
   */
  const place = async () => {
    const v = effectiveView();
    if (v === "side") return toSide();
    if (v === "window") {
      await hideButton();
      if (!where) await tf.page.open();
      where = "window";
      return;
    }
    if (!layout) layout = await tf.overlay.layout();
    const spots = placeFor(layout, v, { h: wantH, open: cornerOpen, rtl: rtl() });
    if (!spots) {
      // The pane is too small for the card: beside the panes, or a window.
      if (where !== "side" && where !== "window") await tf.toast(tf.t("toast-too-small"));
      await hideButton();
      if (canSide()) return toSide();
      if (!where) await tf.page.open();
      where = "window";
      return;
    }
    if (spots.button) await drawButton(spots.button);
    else await hideButton();
    if (spots.card) await toCard(spots.card);
    else await closePage();
  };

  /** Opens Prompt Polish where it should be (the corner view opens its card). */
  const open = async () => {
    await load();
    if (!tf.page) {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return;
    }
    const was = where || buttonShown;
    if (effectiveView() === "corner") cornerOpen = true;
    await place();
    if (!was) audit("opened", { view: effectiveView() });
  };

  /** Closes the page and the button; the draft goes with them. */
  const close = async (record = true) => {
    const was = where || buttonShown;
    cornerOpen = false;
    await closePage();
    await hideButton();
    Object.assign(s, {
      step: "write",
      draft: "",
      parts: [],
      notes: [],
      rejected: new Set(),
      problem: "",
    });
    if (was && record) audit("closed", {});
  };

  /** The user chose a view on the page: kept, and the page moves there. */
  const chooseView = async (to) => {
    const v = checkView(to);
    if (v !== to) return;
    chosen = v;
    await tf.store.set(VIEW_KEY, v);
    cornerOpen = v === "corner";
    audit("view-changed", { to: v });
    await place();
  };

  /** Folds the card into the corner button (from the bottom or corner view). */
  const fold = async () => {
    if (effectiveView() === "side" || !canFloat()) return;
    if (effectiveView() !== "corner") {
      chosen = "corner";
      await tf.store.set(VIEW_KEY, "corner");
      audit("view-changed", { to: "corner" });
    }
    cornerOpen = false;
    await place();
  };

  /** Asks Claude to check the prompt, then shows the fixes. */
  const check = async (text) => {
    s.draft = String(text ?? "").slice(0, MAX_DRAFT);
    if (busy || blocker(s.draft)) return;
    if (!tf.ai) {
      Object.assign(s, { step: "problem", problem: "error-no-ai" });
      return render();
    }
    busy = true;
    const original = s.draft;
    const lang = language();
    const { mode, fast } = current();
    s.step = "checking";
    await render();
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
        return render();
      }
      const r = readAnswer(answer.text, original);
      if (!r.ok) {
        Object.assign(s, {
          step: "problem",
          problem: r.why === "changed-code" ? "error-changed-code" : "error-unreadable",
        });
        return render();
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
      await render();
      if (buttonShown) await place();
    } finally {
      busy = false;
    }
  };

  /** Puts `text` on Tilefold's ask card for the agent in the pane the user works in. */
  const sendToAgent = async (text, how) => {
    const question = String(text ?? "").trim();
    if (!question) return;
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
    Object.assign(s, { step: "sent", draft: "", parts: [], notes: [], rejected: new Set() });
    await render();
    // In the corner view the card folds back into its button.
    if (effectiveView() === "corner") {
      cornerOpen = false;
      await place();
    }
  };

  /** A message from the page. */
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      await post({ do: "setup", ...setupOf(tf.t) });
      return render();
    }
    if (m.type === "draft") {
      if (s.step === "write") s.draft = String(m.text ?? "").slice(0, MAX_DRAFT);
      return;
    }
    if (m.type === "check") return check(m.text);
    if (m.type === "as-is") return sendToAgent(String(m.text ?? "").slice(0, MAX_DRAFT), "as-is");
    if (m.type === "toggle" && s.step === "result") {
      const id = Number(m.id);
      if (!s.parts.some((p) => p.id === id)) return;
      if (s.rejected.has(id)) s.rejected.delete(id);
      else s.rejected.add(id);
      await render();
      if (buttonShown) await place();
      return;
    }
    if (m.type === "clean" && s.step === "result") {
      s.clean = !s.clean;
      return render();
    }
    if (m.type === "back") {
      s.step = "write";
      return render();
    }
    if (m.type === "send" && s.step === "result")
      return sendToAgent(build(s.parts, s.rejected), "corrected");
    if (m.type === "again") {
      Object.assign(s, { step: "write", draft: "" });
      return render();
    }
    if (m.type === "view") return chooseView(m.to);
    if (m.type === "fold") return fold();
    if (m.type === "size") {
      const h = Number(m.h);
      if (!Number.isFinite(h) || Math.abs(h - wantH) < 2) return;
      wantH = h;
      if (where === "card") await place();
      return;
    }
    if (m.type === "close") return close();
  };

  /** Runs a handler's work in the background, so the handler returns at once. */
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch(warn);

  // ------------------------------------------------- registration (nothing awaited above)
  const runs = { open, close: () => close() };
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
      if (!where) return;
      where = null;
      spot = null;
      if (buttonShown && effectiveView() === "corner") cornerOpen = false;
      else await close();
    }),
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock on the dock's bar: back over the pane.
    background(async () => {
      where = null;
      await chooseView("bottom");
    }),
  );
  tf.on(
    "overlay.layout",
    background(async (e) => {
      if (!e || !Array.isArray(e.panes)) return;
      layout = e;
      if (where === "card" || buttonShown) await place();
    }),
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.item !== BUTTON_ID || e.type !== "click") return;
      cornerOpen = !cornerOpen;
      await place();
    }),
  );
  tf.on(
    "overlay.hidden",
    // The user hid tile overlays: the button goes, and the card with it.
    background(async () => {
      buttonShown = false;
      if (where === "card") await close();
    }),
  );
  tf.on(
    "theme.changed",
    background(async (e) => {
      accent = e?.colors?.accent ?? accent;
      if (buttonShown) await place();
    }),
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      await load();
      const now = current();
      if (e?.key === "view") {
        // A choice in Settings wins over the page's last switch.
        chosen = null;
        await tf.store.delete(VIEW_KEY);
        cornerOpen = now.view === "corner" && where === "card";
        if (where || buttonShown) await place();
      }
      await render();
    }),
  );

  return { state: () => ({ where, step: s.step, buttonShown, cornerOpen }) };
}
