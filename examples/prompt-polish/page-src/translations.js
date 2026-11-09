/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith page — a case's translations
 *
 * Under the fixes, each translation of the corrected prompt the case asked
 * for: the language's own name, the text (in that language, its direction
 * found from the text), Copy, and Use this (the agent input box) or Send
 * this (the ask card), which tell the tile the language only; the tile
 * takes the text from its own result. Text is set with textContent only.
 */

/**
 * The translations' section, or null when there are none.
 *
 * @param {any} v the view (`translations`: [{ code, native, text }], `input`)
 * @param {any} L the labels
 * @param {{ el: Function, button: Function }} o
 */
export function translationsOf(v, L, o) {
  const list = Array.isArray(v.translations) ? v.translations : [];
  if (!list.length) return null;
  const box = o.el("section", "translations");
  box.setAttribute("aria-label", L.translations);
  box.append(o.el("b", "case-title", L.translations));
  for (const x of list) {
    const item = o.el("div", "tl");
    const head = o.el("div", "tl-head");
    const copy = o.button("link", L.copy, null);
    copy.addEventListener("click", () => {
      void copyText(x.text).then((ok) => {
        if (ok) copy.textContent = L.copied;
      });
    });
    const go = o.button("btn", v.input ? L.useThis : L.sendThis, {
      type: "send",
      translation: x.code,
    });
    head.append(o.el("b", "tl-lang", x.native), o.el("span", "spacer"), copy, go);
    const text = o.el("p", "tl-text", x.text);
    text.lang = x.code;
    text.dir = "auto";
    item.append(head, text);
    box.append(item);
  }
  return box;
}

/** Copies `text`: the clipboard where the page may use it, else a selection. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
