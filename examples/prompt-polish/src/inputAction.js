/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — the ✦ Polish button in Tilefold's agent input box
 *
 * Where Tilefold has input actions (`tf.input`, Tilefold 0.1.27, permission
 * `input.actions`), Prompt Polish adds a ✦ Polish button to the box where
 * the user writes to their agent. A click hands the tile what the box
 * holds: the card opens for that pane with the text in it and the check
 * already running. On the result, Use puts the corrected prompt back in
 * the box (`tf.input.replace`; Tilefold highlights the changes, offers
 * Undo and never sends it) and Keep mine leaves the box as it was
 * (`tf.input.release`). If the user edited the box meanwhile, or took too
 * long, or the box went, the card says so.
 *
 * Which pane: the event never names it, so the pane is the one whose row
 * holds the box's spot (`overlay.layout`), else the focused one.
 *
 * Each session holds at most one open request (`s.input`); closing the card
 * or starting over releases it. Only counts are audited (`used`), never
 * the prompt.
 */
import { build, changeCount } from "./polish.js";
import { resetSession } from "./sessions.js";

/** The button's id in the box. */
export const ACTION_ID = "polish";

/** What Tilefold answered, as the card's problem message. */
const WHY_KEYS = {
  changed: "error-input-changed",
  expired: "error-input-expired",
  gone: "error-input-gone",
};

/**
 * The pane whose input row holds `spot` (the box Tilefold reported), else
 * the focused pane; null when the layout has neither.
 */
export function paneAt(layout, spot) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  if (spot && [spot.x, spot.y, spot.w, spot.h].every(Number.isFinite)) {
    const cx = spot.x + spot.w / 2;
    const cy = spot.y + spot.h / 2;
    const hit = panes.find((p) => {
      const r = p?.composer;
      return r && cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
    });
    if (hit && typeof hit.id === "string") return hit.id;
  }
  const focused = panes.find((p) => p?.focused && typeof p.id === "string");
  return focused ? focused.id : null;
}

/**
 * @param {any} tf
 * @param {{ sessions: any, render: (id: string) => Promise<void>,
 *   audit: (action: string, details: object) => void, warn: (err: unknown) => void,
 *   layout: () => Promise<object | null>, openFor: (id: string) => Promise<void>,
 *   check: (id: string, text: string) => Promise<void>, fold: (id: string) => Promise<void>,
 *   noPane: string }} deps
 */
export function createInputAction(tf, deps) {
  const { sessions, render, audit, warn, layout, openFor, check, fold, noPane } = deps;
  const available = () => typeof tf.input?.action === "function";

  /** Adds the ✦ Polish button (registered with everything else, up front). */
  const register = () => {
    if (available()) tf.input.action({ id: ACTION_ID, label: tf.t("action-label") });
  };

  /** Ends pane `id`'s open request without a change, if it has one. */
  const release = async (id) => {
    const s = sessions.get(id);
    const request = s?.input?.request;
    if (!request) return;
    s.input = null;
    await tf.input.release(request).catch(warn);
  };

  /** The user clicked ✦ Polish: the card opens for that pane and checks at once. */
  const clicked = async (e) => {
    if (!e || e.action !== ACTION_ID || typeof e.request !== "string") return;
    const id = paneAt(await layout(), e.spot) ?? noPane;
    // An earlier click on this pane that wasn't answered gives way.
    await release(id);
    const s = sessions.ensure(id);
    resetSession(s);
    s.input = { request: e.request };
    s.draft = String(e.text ?? "");
    await openFor(id);
    await check(id, s.draft);
  };

  /** Use: the corrected prompt goes back in the box. */
  const use = async (id) => {
    const s = sessions.get(id);
    const request = s?.input?.request;
    if (!s || !request || s.step !== "result") return;
    const total = changeCount(s.parts);
    const undone = s.parts.filter((p) => p.id && s.rejected.has(p.id)).length;
    s.input = null;
    let r;
    try {
      r = await tf.input.replace(request, { text: build(s.parts, s.rejected) });
    } catch (err) {
      warn(err);
      r = { done: false, why: "gone" };
    }
    if (r?.done) {
      // Counts only: never the prompt.
      audit("used", { kept: total - undone, undone });
      resetSession(s);
      await fold(id);
      return;
    }
    Object.assign(s, { step: "problem", problem: WHY_KEYS[r?.why] ?? WHY_KEYS.gone });
    await render(id);
  };

  /** Keep mine: the box stays as it was, and the card folds away. */
  const keep = async (id) => {
    const s = sessions.get(id);
    if (!s?.input) return;
    await release(id);
    resetSession(s);
    await fold(id);
  };

  return { available, register, clicked, use, keep, release };
}
