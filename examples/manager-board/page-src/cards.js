/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — cards opening in place, and the one-pane chip
 *
 * `createCards` opens a card in place or folds it again (`toggle`), and
 * fetches each whole text it needs once with the tile's `fullText` call,
 * keeping it for the rest of the session; `textOf` gives an event's whole
 * text once fetched, else its summary. A text that can't be read now keeps
 * its summary, and the next opening tries again. Which cards are open is
 * not kept between sessions.
 *
 * `onlyChip` is the chip above the view while the board shows one pane,
 * with × to show every pane again.
 */
import { h } from "./dom.js";

/**
 * @param {{ st: { expanded: Set<string>, full: Map<string, string> },
 *   call: (name: string, args: object) => Promise<unknown>, render: () => void }} o
 */
export function createCards({ st, call, render }) {
  /** Opens `e`'s card (fetching what it needs), or folds it. */
  async function toggle(e) {
    const key = e.key || e.id;
    if (st.expanded.has(key)) {
      st.expanded.delete(key);
      render();
      return;
    }
    st.expanded.add(key);
    render();
    const want = (e.lines || [e]).filter((l) => l.more && !st.full.has(l.id));
    for (const l of want) {
      try {
        const text = await call("fullText", { id: l.id });
        st.full.set(l.id, typeof text === "string" ? text : l.summary);
      } catch {
        continue;
      }
      render();
    }
  }
  /** An event's whole text once fetched, else its summary. */
  const textOf = (e) => st.full.get(e.id) ?? e.summary;
  return { toggle, textOf };
}

/** The chip that says the board shows one pane, with × to show every pane again. */
export function onlyChip(st, L, nameOf, render) {
  return h(
    "div",
    { class: "only-chip", role: "status" },
    h("span", {}, L("only-pane", { name: nameOf(st.onlyPane) })),
    h(
      "button",
      {
        type: "button",
        class: "icon",
        id: "only-clear",
        "aria-label": L("only-pane-clear"),
        title: L("only-pane-clear"),
        onclick: () => ((st.onlyPane = null), render()),
      },
      "×",
    ),
  );
}
