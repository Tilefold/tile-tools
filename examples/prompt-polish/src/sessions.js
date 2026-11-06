/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — one prompt per pane
 *
 * Each pane gets its own Prompt Polish: its own draft, its own fixes and
 * whether its card is open. The tile has one page, so it shows only the
 * session of the pane the user works in (the focused one): Send to agent
 * then always reaches that pane's agent, which Tilefold's ask card offers
 * first. Switching panes or tabs switches sessions; a pane with nothing
 * open shows nothing (over the pane), or an empty draft (beside the
 * panes). Panes are known by the opaque ids of `overlay.layout`, which
 * last for the session.
 *
 * Kept in memory only, never stored. Pure: no Tilefold calls.
 *
 * Modified 2026-11-06 (input actions): a session's open `input` request.
 */

/** The most sessions kept; the least recently used goes first. */
export const MAX_SESSIONS = 24;

/** A fresh session: writing, nothing open. */
export function freshSession() {
  return {
    open: false,
    step: "write",
    draft: "",
    parts: [],
    notes: [],
    rejected: new Set(),
    clean: false,
    problem: "",
    busy: false,
    // A click on ✦ Polish in the agent input box waiting for Use or Keep mine.
    input: null,
  };
}

/** Back to writing an empty prompt, the card still open or not as it was. */
export function resetSession(s) {
  Object.assign(s, {
    step: "write",
    draft: "",
    parts: [],
    notes: [],
    rejected: new Set(),
    clean: false,
    problem: "",
  });
  return s;
}

/** The id of the focused pane of a layout, or null. */
export function focusedId(layout) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  const p = panes.find((x) => x && x.focused && typeof x.id === "string");
  return p ? p.id : null;
}

/**
 * The sessions, by pane id. `get(id)` finds one; `ensure(id)` finds or
 * makes one (forgetting the least recently used past MAX_SESSIONS, but
 * never one that is checking); `drop(id)` forgets one.
 */
export function createSessions() {
  /** Insertion order is use order: a session used again moves to the end. */
  const byPane = new Map();

  const touch = (id, s) => {
    byPane.delete(id);
    byPane.set(id, s);
    return s;
  };

  return {
    get(id) {
      return typeof id === "string" ? (byPane.get(id) ?? null) : null;
    },
    ensure(id) {
      if (typeof id !== "string" || !id) return null;
      const s = byPane.get(id);
      if (s) return touch(id, s);
      for (const [old, o] of byPane) {
        if (byPane.size < MAX_SESSIONS) break;
        if (!o.busy) byPane.delete(old);
      }
      return touch(id, freshSession());
    },
    drop(id) {
      byPane.delete(id);
    },
    size: () => byPane.size,
    ids: () => [...byPane.keys()],
  };
}
