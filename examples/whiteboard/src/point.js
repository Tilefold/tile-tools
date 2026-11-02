/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — pointing on screen
 *
 * The agent's "Point on screen" command: marks on what the user's panes and
 * the document viewer show (highlights, boxes, underlines, arrows and
 * notes), drawn by Tilefold with tf.annotate (Tilefold 0.1.23, permission
 * window.annotate). The agent names each place by what is there, such as
 * text on a pane's screen or a line of the file the viewer shows; Tilefold
 * finds it and keeps the mark on it as the pane scrolls. The tile never
 * sees the pane: it learns only whether each mark was placed, and tells
 * the agent what to do about the ones that weren't.
 *
 * What the agent says with its marks (`say`) goes on the board as a step,
 * so the explanation is always there in words too.
 *
 * Pure apart from the `tf` calls it's given, so tests drive it with a fake.
 */

/** What to do about a mark that wasn't placed, by Tilefold's reason. */
export const WHY = {
  "no-pane":
    'There\'s no such pane. Name it by its session (your own is in $TILEFOLD_SESSION_ID), the name the user gave it, "focused", or its place in the tab (1 = first).',
  "not-found":
    "That text isn't on that pane's screen now (only what's on screen is searched, not the scrollback). Check the exact text, case and spaces, or give a row.",
  "no-row": "There's no such row on that screen, or no such line in that file.",
  "not-shown":
    "That file isn't in the document viewer's current tab in the Raw view (or the pane isn't shown). Ask the user to open it; the mark appears once it's shown.",
};

/** The agent's next step after a Point. */
export function nextAfter(items, shown) {
  const misses = [...new Set(items.filter((i) => !i.placed).map((i) => i.why))];
  const parts = misses.map((why) => `${why}: ${WHY[why] ?? "It couldn't be placed."}`);
  if (!shown) {
    parts.push(
      "The user has hidden tile overlays (Option-Command-O), so the marks are kept but not drawn until they show them again.",
    );
  }
  if (parts.length) return parts.join(" ");
  return "The user sees the marks on their screen. Explain them in say (it goes on the board), read the board with { wait: true } for their question, and Point with { clear: true } when you move on.";
}

/**
 * Pointing for the tile: `say(text)` puts the agent's words on the board
 * as a step; `audit(action)` records one word.
 * @param {any} tf
 * @param {{ say: (text: string) => Promise<void>, audit: (action: string) => void }} board
 */
export function pointing(tf, board) {
  const can = () => !!tf.annotate;

  /** Runs Point on screen with the agent's input. */
  async function point(input) {
    if (!can()) {
      throw new Error(
        "This Tilefold can't point on your panes: it needs Tilefold 0.1.23 or later, with the user's OK for this tile to draw on panes. Use Draw on the board instead.",
      );
    }
    if (!input || typeof input !== "object") {
      throw new Error("input: { marks: [...], say?, clear? }, or { clear: true } to remove them");
    }
    const { marks, say, clear } = input;
    if (clear !== undefined && typeof clear !== "boolean") throw new Error("clear: true or false");
    if (say !== undefined && (typeof say !== "string" || !say.trim())) {
      throw new Error("say: what you're pointing out, in words");
    }
    if (marks === undefined) {
      if (clear !== true)
        throw new Error("marks: a list of marks, or { clear: true } to remove them");
      const { cleared } = await tf.annotate.clear();
      board.audit("unpointed");
      if (say) await board.say(say);
      return { cleared, next: "The marks are gone." };
    }
    let result;
    try {
      result = await tf.annotate.draw(marks, { clear: clear === true });
    } catch (err) {
      // Tilefold calls the list "items"; the agent sent it as "marks".
      const message = String(err && err.message ? err.message : err).replace(/^items/, "marks");
      throw Object.assign(new Error(message), { name: err && err.name });
    }
    board.audit("pointed");
    if (say) await board.say(say);
    return {
      marks: result.items,
      shown: result.shown,
      next: nextAfter(result.items, result.shown),
    };
  }

  /** The marks drawn now, for Read the board; null where Tilefold can't point. */
  async function marks() {
    if (!can()) return null;
    return (await tf.annotate.list()).items;
  }

  /** Removes every mark (the board was cleared). */
  async function clearAll() {
    if (can()) await tf.annotate.clear();
  }

  return { point, marks, clearAll, can };
}
