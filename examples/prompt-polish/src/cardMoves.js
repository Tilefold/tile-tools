/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — moving and filling the card
 *
 * Over the pane the user can drag the card by its header and make it fill
 * the pane (its ▢ button, or a double click on the header). The page sends
 * `drag` with `phase` "start", "move" or "end" and how far the pointer went
 * since the start (`dx`, `dy`, in pixels), and `max` to switch filling on
 * or off. The drag is kept as an offset from where the card would be; the
 * stage keeps it inside the pane (`kept`), and that is what the next drag
 * starts from. Moves come many times a second, so only the latest waits
 * while one is being placed. Choosing another view puts the card back.
 *
 * Audited: `card-filled` (on or off) and `card-moved` once per drag, never
 * where to.
 */

const ZERO = Object.freeze({ dx: 0, dy: 0 });

/** The farthest one drag can say it went, in pixels. */
const MAX_DRAG = 10_000;

/** A number from the page, kept within ±MAX_DRAG; else 0. */
const px = (v) => (Number.isFinite(v) ? Math.max(-MAX_DRAG, Math.min(MAX_DRAG, v)) : 0);

/**
 * @param {{ place: () => Promise<void>, render: () => Promise<void>,
 *   audit: (action: string, details?: object) => void, kept: () => { dx: number, dy: number } }} o
 *   render redraws the page (its ▢ button shows whether the card fills the pane)
 */
export function createCardMoves(o) {
  let offset = ZERO;
  let max = false;
  /** Where the card was when this drag started, or null between drags. */
  let base = null;
  let placing = null;
  let again = false;

  /** Places the card; moves arriving meanwhile are placed once it's done, latest only. */
  const placeLatest = () => {
    if (placing) {
      again = true;
      return placing;
    }
    placing = (async () => {
      do {
        again = false;
        await o.place();
      } while (again);
    })().finally(() => (placing = null));
    return placing;
  };

  return {
    /** What the stage needs: the drag and whether the card fills the pane. */
    state: () => ({ offset, max }),
    /** Back where it belongs (another view was chosen). */
    reset() {
      offset = ZERO;
      max = false;
      base = null;
    },
    /** Takes a `drag` or `max` message from the page; false for any other. */
    async hear(m) {
      if (m.type === "max") {
        max = !max;
        base = null;
        o.audit("card-filled", { on: max });
        await o.place();
        await o.render();
        return true;
      }
      if (m.type !== "drag" || max) return m.type === "drag";
      if (m.phase === "start" || !base) base = o.kept();
      offset = { dx: base.dx + px(m.dx), dy: base.dy + px(m.dy) };
      if (m.phase === "end") {
        base = null;
        o.audit("card-moved");
      }
      await placeLatest();
      // What could be kept inside the pane is where the next drag starts.
      if (m.phase === "end") offset = o.kept();
      return true;
    },
  };
}
