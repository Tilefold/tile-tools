/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish page — moving and filling the card
 *
 * Over the pane, the header is a handle: dragging it moves the card, and a
 * double click makes it fill the pane (or go back). Only the tile moves the
 * card, so the page tells it how far the pointer went since the drag began
 * (`drag` with `phase` "start", "move", "end", and `dx`, `dy` in screen
 * pixels, which stay true while the card moves under the pointer), at most
 * once a frame. A drag starts only past MIN_DRAG pixels, so a click on the
 * header moves nothing; buttons and the chip in the header are never a
 * handle. Nothing moves beside the panes, in a window, or while the card
 * fills the pane.
 */

/** How far the pointer must go before a press on the header is a drag. */
export const MIN_DRAG = 4;

/** Whether a press on `target` may move the card (not on a button or the chip). */
export const isHandle = (target) =>
  !(target instanceof Element) || !target.closest("button, .chip, a, textarea, input");

/**
 * Makes `head` a handle for the card.
 *
 * @param {HTMLElement} head
 * @param {{ send: (message: object) => void, movable: () => boolean, fillable: () => boolean }} o
 *   movable: the card can be dragged now; fillable: it can fill the pane now
 */
export function setupMoving(head, o) {
  /** The drag going on: its pointer, where it began, how far, and whether it started. */
  let drag = null;
  let frame = 0;
  const root = document.documentElement;

  head.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !o.movable() || !isHandle(e.target)) return;
    drag = { id: e.pointerId, x: e.screenX, y: e.screenY, dx: 0, dy: 0, started: false };
    head.setPointerCapture?.(e.pointerId);
  });

  head.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.screenX - drag.x;
    drag.dy = e.screenY - drag.y;
    if (!drag.started) {
      if (Math.hypot(drag.dx, drag.dy) < MIN_DRAG) return;
      drag.started = true;
      root.classList.add("dragging");
      o.send({ type: "drag", phase: "start", dx: 0, dy: 0 });
    }
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (drag?.started) o.send({ type: "drag", phase: "move", dx: drag.dx, dy: drag.dy });
    });
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // Where the pointer let go (a cancelled drag keeps where it last was).
    if (e.type === "pointerup") {
      drag.dx = e.screenX - drag.x;
      drag.dy = e.screenY - drag.y;
    }
    const { dx, dy, started } = drag;
    drag = null;
    cancelAnimationFrame(frame);
    frame = 0;
    root.classList.remove("dragging");
    if (started) o.send({ type: "drag", phase: "end", dx, dy });
  };
  head.addEventListener("pointerup", end);
  head.addEventListener("pointercancel", end);

  head.addEventListener("dblclick", (e) => {
    if (o.fillable() && isHandle(e.target)) o.send({ type: "max" });
  });
}
