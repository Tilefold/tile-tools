/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — what to fix, picked on the card
 *
 * The card's chip ("English · Mistakes only") is a menu of what to fix:
 * the two built-in modes and the user's own cases (cases.js, from the
 * `cases` setting). The pick is kept in the tile's store (`mode-pick`:
 * "fix", "natural" or "case:<name>") until the user picks again or the
 * setting changes; otherwise the `mode` setting decides. A pick of a case
 * that is gone falls back to the setting.
 *
 * From the menu the user also adds a case or edits the one picked: the
 * card shows a small form (the session's `editing`: the case it was, the
 * name, the instructions, and why the last save didn't go), and Save
 * writes the whole list back to the setting with `tf.settings.set`
 * (Tilefold 0.1.27; on an older one, cases are added in Settings only).
 * A pick, a save or a removal checks the shown prompt again if it was
 * already checked. Messages from the page: `mode` ({ to }), `case-edit`
 * ({ was }), `case-save` ({ was, name, rules }), `case-cancel`,
 * `case-remove` ({ name }).
 *
 * Audited: `mode-picked` ({ mode }: "fix", "natural" or "case"),
 * `case-saved` ({ added }), `case-removed`; never a case's name or words.
 */
import { formatCases, nameOf, removeCase, saveCase } from "./cases.js";

/** The store key of the card's pick. */
export const PICK_KEY = "mode-pick";

/** The longest pick kept from the page. */
const MAX_PICK = 80;

/**
 * @param {any} tf
 * @param {{ current: () => { mode: string, cases: { name: string, rules: string }[] },
 *   sessions: { get: (id: string) => any }, check: (id: string, text: string) => Promise<void>,
 *   render: () => Promise<void>, audit: (action: string, details?: object) => void,
 *   warn: (err: unknown) => void }} o
 */
export function createModes(tf, o) {
  /** The card's pick, or null for the setting's. */
  let pick = null;
  let loaded = false;

  const cases = () => o.current().cases;
  const canEdit = () => typeof tf.settings?.set === "function";

  const load = async () => {
    if (loaded) return;
    loaded = true;
    const v = await tf.store.get(PICK_KEY).catch(() => null);
    pick = typeof v === "string" ? v.slice(0, MAX_PICK) : null;
  };

  /** What to fix now: `{ mode, name, rules }`; mode "fix", "natural" or "case". */
  const resolved = () => {
    if (pick?.startsWith("case:")) {
      const c = cases().find((x) => x.name === pick.slice(5));
      if (c) return { mode: "case", name: c.name, rules: c.rules };
    }
    if (pick === "fix" || pick === "natural") return { mode: pick, name: "", rules: "" };
    return { mode: o.current().mode, name: "", rules: "" };
  };

  /** Keeps the card's pick (null: back to the setting's). */
  const keep = async (next) => {
    pick = next;
    if (next === null) await tf.store.delete(PICK_KEY).catch(o.warn);
    else await tf.store.set(PICK_KEY, next).catch(o.warn);
  };

  /** Checks pane `id`'s prompt again if it was already checked. */
  const again = async (id) => {
    const s = o.sessions.get(id);
    if (s?.step === "result" && s.draft) await o.check(id, s.draft);
  };

  /** Writes `list` to the setting; false when Tilefold refused it. */
  const write = async (list) => {
    try {
      await tf.settings.set("cases", formatCases(list));
      return true;
    } catch (err) {
      o.warn(err);
      return false;
    }
  };

  return {
    load,
    /** What to fix now. */
    now: () => resolved(),
    /** The `mode` setting changed: it decides again. */
    settingChanged: () => keep(null),
    /** What the card's chip and menu show. */
    view: () => {
      const r = resolved();
      return {
        modeId: r.mode === "case" ? `case:${r.name}` : r.mode,
        caseName: r.name,
        cases: cases().map((c) => c.name),
        canEditCases: canEdit(),
      };
    },
    /** Takes a message from the page about what to fix; false for any other. */
    async hear(m, id) {
      const s = o.sessions.get(id);
      if (m.type === "mode") {
        const to = typeof m.to === "string" ? m.to.slice(0, MAX_PICK) : "";
        const known =
          to === "fix" ||
          to === "natural" ||
          (to.startsWith("case:") && cases().some((c) => c.name === to.slice(5)));
        if (!known) return true;
        await keep(to);
        o.audit("mode-picked", { mode: to.startsWith("case:") ? "case" : to });
        await o.render();
        await again(id);
        return true;
      }
      if (!s) return m.type.startsWith("case-");
      if (m.type === "case-edit") {
        if (!canEdit()) return true;
        const was = typeof m.was === "string" ? cases().find((c) => c.name === m.was) : null;
        s.editing = {
          was: was?.name ?? null,
          name: was?.name ?? "",
          rules: was?.rules ?? "",
          why: "",
        };
        await o.render();
        return true;
      }
      if (m.type === "case-cancel") {
        s.editing = null;
        await o.render();
        return true;
      }
      if (m.type === "case-save") {
        if (!s.editing || !canEdit()) return true;
        const was = s.editing.was;
        const r = saveCase(cases(), was, { name: m.name, rules: m.rules });
        const draft = { was, name: String(m.name ?? ""), rules: String(m.rules ?? "") };
        if (r.why) {
          s.editing = { ...draft, why: r.why };
          return o.render().then(() => true);
        }
        if (!(await write(r.cases))) {
          s.editing = { ...draft, why: "case-not-saved" };
          return o.render().then(() => true);
        }
        s.editing = null;
        await keep(`case:${r.name}`);
        o.audit("case-saved", { added: was === null });
        await o.render();
        await again(id);
        return true;
      }
      if (m.type === "case-remove") {
        const name = nameOf(m.name);
        if (!canEdit() || !cases().some((c) => c.name === name)) return true;
        if (!(await write(removeCase(cases(), name)))) return true;
        s.editing = null;
        if (pick === `case:${name}`) await keep(null);
        o.audit("case-removed");
        await o.render();
        return true;
      }
      return false;
    },
  };
}
