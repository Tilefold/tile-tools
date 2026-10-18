/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — moving the card
 *
 * Holds where the user put the card and follows their drags of it. A drag
 * that starts on the card moves the card and its buttons with the pointer;
 * where it is dropped is saved, so the card stays there whichever pane is
 * focused, and comes back there after a restart. `reset` puts it back in
 * the focused pane's corner. Each drop and reset is recorded in the trail.
 */
import { contentOf, createDrag } from "./position.js";

/**
 * Creates the mover.
 *
 * @param {{
 *   store: { position: () => Promise<any>, setPosition: (pos: any) => Promise<boolean> },
 *   trail: { record: (action: string, details?: Record<string, unknown>) => void },
 *   layout: () => any,
 *   size: () => { w: number, h: number },
 *   cardRect: () => { x: number, y: number },
 *   redraw: () => Promise<unknown> | unknown,
 *   cardId: string,
 * }} deps `layout` is Tilefold's latest window layout, `size` the card
 *   group's size, `cardRect` where the card is drawn now, `redraw` asks
 *   for a new frame.
 */
export function createMover({ store, trail, layout, size, cardRect, redraw, cardId }) {
  /** Where the user dragged the card (null: the focused pane's corner). */
  let position = null;
  const drag = createDrag();
  /** Where the current drag last drew the card, not yet saved. */
  let moved = null;

  return {
    /** The current position, for the scene (null: the pane's corner). */
    position: () => position,

    /** Reads the saved position back, as the card comes on screen. */
    async load() {
      position = await store.position();
      return position;
    },

    /**
     * Puts a dragged card back in the pane's corner. `via` says what asked
     * ("command" or "corner"). Nothing happens, and nothing is recorded,
     * when the card is already there.
     */
    async reset(via) {
      drag.cancel();
      moved = null;
      if (position === null) return false;
      position = null;
      await store.setPosition(null);
      trail.record("view.reset", { via });
      await redraw();
      return true;
    },

    /**
     * Follows an overlay pointer event if it is part of a drag of the card.
     * Returns true when it was (the caller then ignores it), false otherwise.
     */
    async pointer(e) {
      const px = Number(e.x);
      const py = Number(e.y);
      if (e.type === "dragstart" && e.item === cardId) {
        drag.start(px, py, cardRect());
        moved = null;
        return true;
      }
      // Later events of a drag count whatever is under the pointer: a quick
      // move can outrun the card's last redraw and leave the pointer off it.
      if (!drag.active() || (e.type !== "drag" && e.type !== "drop")) return false;
      const content = contentOf(layout());
      const { w, h } = size();
      if (e.type === "drag") {
        const next = drag.move(px, py, content, w, h);
        if (next) {
          // Only drawn while dragging; saved once, on the drop.
          moved = next;
          position = next;
          await redraw();
        }
        return true;
      }
      // A drop without a usable point keeps the card where the last move drew it,
      // so what is on screen is what gets saved.
      const dropped = drag.end(px, py, content, w, h) ?? moved;
      moved = null;
      if (dropped) {
        position = dropped;
        await store.setPosition(dropped);
        trail.record("view.move", { via: "drag" });
        await redraw();
      }
      return true;
    },
  };
}
