/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish page — what to fix, and the user's own cases
 *
 * The header's chip opens the menu of what to fix, drawn in the card's
 * body (so the card grows to fit it, never cut off): the two built-in
 * modes and the user's own cases, the one in use checked; then "Edit
 * “name”…" for a case in use and "Add your own…", or, where this Tilefold
 * can't save cases from the card, where to add them in Settings. The case
 * form has the case's name, what to do for that kind of prompt, why the
 * last save didn't go, and Save, Cancel and (editing) Remove. What the
 * user typed survives the tile drawing the form again. Text is set with
 * textContent and values only.
 */

/**
 * Draws the menu of what to fix into `body` and `foot`.
 *
 * @param {any} v the view
 * @param {any} L the labels
 * @param {{ el: Function, button: Function, body: HTMLElement, foot: HTMLElement,
 *   pick: (message: object) => void, close: () => void }} o
 */
export function drawModeMenu(v, L, o) {
  const list = o.el("div", "menu");
  list.setAttribute("role", "menu");
  list.setAttribute("aria-label", L.modeMenu);
  const item = (label, message, checked) => {
    const b = o.button(checked === undefined ? "menu-item" : "menu-item pick", label, null);
    b.setAttribute("role", checked === undefined ? "menuitem" : "menuitemradio");
    if (checked !== undefined) b.setAttribute("aria-checked", String(checked));
    b.dir = "auto";
    b.addEventListener("click", () => o.pick(message));
    return b;
  };
  for (const m of v.modes ?? [])
    list.append(item(m.label, { type: "mode", to: m.id }, m.id === v.modeId));
  list.append(o.el("hr", "menu-line"));
  if (v.canEditCases) {
    if (String(v.modeId).startsWith("case:")) {
      const name = String(v.modeId).slice(5);
      list.append(item(L.editCase.replace("{name}", name), { type: "case-edit", was: name }));
    }
    list.append(item(L.addCase, { type: "case-edit", was: null }));
  } else {
    list.append(o.el("p", "muted", L.casesInSettings));
  }
  o.body.replaceChildren(list);
  o.foot.replaceChildren(o.button("btn ghost", L.cancel, null));
  o.foot.firstChild.addEventListener("click", o.close);
  list.querySelector("[aria-checked='true'], button")?.focus();
}

/**
 * Draws the form to add or edit a case into `body` and `foot`, keeping what
 * the user typed in the form already there for the same case.
 *
 * @param {any} v the view (`step` "case": `was`, `name`, `rules`, `why`)
 * @param {any} L the labels
 * @param {{ el: Function, button: Function, body: HTMLElement, foot: HTMLElement,
 *   send: (message: object) => void }} o
 */
export function drawCase(v, L, o) {
  const old = o.body.querySelector("form.case");
  const same = old && old.dataset.was === String(v.was ?? "");
  const typed = same
    ? { name: old.elements.namedItem("name").value, rules: old.elements.namedItem("rules").value }
    : { name: v.name, rules: v.rules };
  const form = o.el("form", "case");
  form.dataset.was = String(v.was ?? "");
  form.append(o.el("b", "case-title", v.was === null ? L.caseNew : L.caseEdit));
  const field = (label, control) => {
    const wrap = o.el("label", "case-field");
    wrap.append(o.el("span", "muted", label), control);
    return wrap;
  };
  const name = o.el("input");
  Object.assign(name, {
    name: "name",
    type: "text",
    maxLength: 60,
    value: typed.name,
    dir: "auto",
  });
  const rules = o.el("textarea");
  Object.assign(rules, {
    name: "rules",
    rows: 5,
    maxLength: 2000,
    value: typed.rules,
    dir: "auto",
  });
  rules.placeholder = L.caseRulesHint;
  form.append(field(L.caseName, name), field(L.caseRules, rules));
  if (v.why) {
    const why = o.el("p", "warn", v.why);
    why.setAttribute("role", "alert");
    form.append(why);
  }
  const save = () => o.send({ type: "case-save", name: name.value, rules: rules.value });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    save();
  });
  o.body.replaceChildren(form);
  const foot = [];
  if (v.was !== null)
    foot.push(o.button("btn ghost", L.caseRemove, { type: "case-remove", name: v.was }));
  foot.push(
    o.el("span", "spacer"),
    o.button("btn ghost", L.cancel, { type: "case-cancel" }),
    o.button("btn primary", L.caseSave, null),
  );
  foot.at(-1).addEventListener("click", save);
  o.foot.replaceChildren(...foot);
  if (!same) (typed.name ? rules : name).focus();
}
