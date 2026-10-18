/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — moving the player
 *
 * Holds where the user put the player and follows their drags of it. A
 * drag that starts on one of the `handles` (the card, or the control dock
 * under a docked video) moves the whole group with the pointer: the card
 * and its buttons, or the dock and the video above it. Where it is dropped
 * is saved in `tf.store`, so it stays there whichever pane is focused and
 * comes back there after a restart. `reset` puts it back in the focused
 * pane's corner. Each drop and reset is recorded in the activity log
 * (never where it was put).
 *
 * The video itself can't start a drag: it is YouTube's own page, which
 * keeps the pointer for its player.
 */
import { contentOf, createDrag, readPosition } from "./position.js";

/** The `tf.store` key of the saved position. */
export const POSITION_KEY = "position";

/**
 * Creates the mover.
 *
 * @param {{
 *   tf: any,
 *   handles: string[],
 *   layout: () => any,
 *   size: () => { w: number, h: number },
 *   origin: () => { x: number, y: number },
 *   redraw: () => Promise<unknown> | unknown,
 * }} deps `handles` are the overlay item ids that start a drag, `layout`
 *   is Tilefold's latest window layout, `size` the group's size now,
 *   `origin` where the group is drawn now, `redraw` asks for a new frame.
 */
export function createMover({ tf, handles, layout, size, origin, redraw }) {
  /** Where the user dragged the player (null: the focused pane's corner). */
  let position = null;
  /** Whether the saved position has been read. */
  let loaded = false;
  const drag = createDrag();
  /** Where the current drag last drew the group, not yet saved. */
  let moved = null;

  const audit = (action, details) =>
    Promise.resolve()
      .then(() => tf.audit(action, details))
      .catch(() => {});
  const save = (value) =>
    Promise.resolve()
      .then(() => tf.store.set(POSITION_KEY, value))
      .catch(() => {});

  return {
    /** The current position, for the scene (null: the pane's corner). */
    position: () => position,

    /** Whether a drag is under way. */
    dragging: () => drag.active(),

    /** Reads the saved position back, once, as the player comes on screen. */
    async load() {
      if (loaded) return position;
      loaded = true;
      position = readPosition(await Promise.resolve(tf.store.get(POSITION_KEY)).catch(() => null));
      return position;
    },

    /**
     * Puts a dragged player back in the pane's corner. `via` says what
     * asked ("command" or "corner"). Nothing happens, and nothing is
     * recorded, when it is already there.
     */
    async reset(via) {
      drag.cancel();
      moved = null;
      if (position === null) return false;
      position = null;
      await save(null);
      void audit("card.reset", { via });
      await redraw();
      return true;
    },

    /**
     * Follows an overlay pointer event if it is part of a drag of the
     * player. Returns true when it was (the caller then ignores it).
     */
    async pointer(e) {
      const px = Number(e?.x);
      const py = Number(e?.y);
      if (e?.type === "dragstart" && handles.includes(String(e.item))) {
        drag.start(px, py, origin());
        moved = null;
        return true;
      }
      // Later events of a drag count whatever is under the pointer: a quick
      // move can outrun the last redraw and leave the pointer off the group.
      if (!drag.active() || (e?.type !== "drag" && e?.type !== "drop")) return false;
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
      // A drop without a usable point keeps the group where the last move
      // drew it, so what is on screen is what gets saved.
      const dropped = drag.end(px, py, content, w, h) ?? moved;
      moved = null;
      if (dropped) {
        position = dropped;
        await save(dropped);
        void audit("card.moved", { via: "drag" });
        await redraw();
      }
      return true;
    },
  };
}
