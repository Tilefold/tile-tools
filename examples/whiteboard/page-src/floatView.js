/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — the window a 3D scene floats in
 *
 * A 3D scene floats over the board, content and all, in a small window the
 * user can move: a bar along its top with the scene's title, which they
 * drag (or focus and move with the arrow keys, Shift for bigger steps),
 * and a button that folds the window down to its bar, so it never hides
 * the content for good. A click on the bar that isn't a drag points at the
 * whole scene. A Mark button turns on marking an area of the model. The window only reports what the user does; where it sits
 * on the board is up to the layer that holds it (glLayer.js).
 */

/** How far one arrow key moves a window, in board units (Shift: BIG_STEP). */
export const KEY_STEP = 10;
export const BIG_STEP = 50;
/** How far a press must travel before it's a drag rather than a click, in pixels. */
const DRAG_PX = 4;

/**
 * The window for one scene.
 *
 * @param {Document} doc
 * @param {{ title: string, labels: { move: string, fold: string, unfold: string, mark: string },
 *   folded: boolean,
 *   onGrab: () => void,
 *   onDrag: (dx: number, dy: number) => void,
 *   onDrop: () => void,
 *   onKey: (dx: number, dy: number) => void,
 *   onFold: (folded: boolean) => void,
 *   onMarkMode: (on: boolean) => void,
 *   onPick: () => void }} o
 *   onGrab, onDrag (pixels from where the drag started) and onDrop follow a
 *   drag of the bar; onKey moves by board units; onPick is a click.
 */
export function createFloat(doc, o) {
  const host = doc.createElement("div");
  host.className = "gl-host float";
  const bar = doc.createElement("div");
  bar.className = "float-bar";
  const grip = doc.createElement("button");
  grip.type = "button";
  grip.className = "float-grip";
  grip.title = o.labels.move;
  grip.setAttribute("aria-label", `${o.title}: ${o.labels.move}`);
  const dots = doc.createElement("span");
  dots.className = "float-dots";
  dots.setAttribute("aria-hidden", "true");
  const title = doc.createElement("span");
  title.className = "float-title";
  // Text the agent wrote is only ever text, never markup.
  title.textContent = o.title;
  grip.append(dots, title);
  const markBtn = doc.createElement("button");
  markBtn.type = "button";
  markBtn.className = "float-mark";
  markBtn.title = o.labels.mark;
  markBtn.setAttribute("aria-label", o.labels.mark);
  // A pencil, as text, so no icon font is needed.
  markBtn.textContent = "\u270E";
  const fold = doc.createElement("button");
  fold.type = "button";
  fold.className = "float-fold";
  bar.append(grip, markBtn, fold);
  let marking = false;
  const showMark = () => {
    markBtn.setAttribute("aria-pressed", String(marking));
    markBtn.classList.toggle("on", marking);
  };
  showMark();
  markBtn.addEventListener("click", () => {
    marking = !marking;
    showMark();
    o.onMarkMode(marking);
  });
  const body = doc.createElement("div");
  body.className = "float-body";
  host.append(bar, body);

  let folded = !!o.folded;
  const showFold = () => {
    host.classList.toggle("folded", folded);
    body.hidden = folded;
    const label = folded ? o.labels.unfold : o.labels.fold;
    fold.title = label;
    fold.setAttribute("aria-label", label);
    fold.setAttribute("aria-expanded", String(!folded));
    // A plain minus folds it, a square shows it again; text, so no icon font is needed.
    fold.textContent = folded ? "□" : "−";
  };
  showFold();
  fold.addEventListener("click", () => {
    folded = !folded;
    showFold();
    o.onFold(folded);
  });

  // Dragging the bar moves the window; a press that doesn't travel is a click.
  let drag = null;
  let dragged = false;
  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moving: false };
    dragged = false;
    grip.setPointerCapture?.(e.pointerId);
  });
  grip.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moving && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!drag.moving) {
      drag.moving = true;
      host.classList.add("moving");
      o.onGrab();
    }
    o.onDrag(dx, dy);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const was = drag.moving;
    drag = null;
    host.classList.remove("moving");
    if (was) {
      dragged = true;
      o.onDrop();
    }
  };
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  grip.addEventListener("click", () => {
    // The click that ends a drag isn't one that points.
    if (dragged) return void (dragged = false);
    o.onPick();
  });
  grip.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? BIG_STEP : KEY_STEP;
    const by = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (!by) return;
    e.preventDefault();
    // Arrow keys here move the window, not the explanation's steps.
    e.stopPropagation();
    o.onKey(by[0], by[1]);
  });

  return {
    /** The whole window, which the layer places. */
    host,
    /** Where the 3D view draws. */
    body,
    /** The bar's height in pixels now (0 before it's laid out). */
    barHeight: () => bar.offsetHeight,
    /** Whether it's folded down to its bar. */
    folded: () => folded,
    /** Shows marking as on or off (Esc in the view turns it off). */
    setMarking(on) {
      marking = !!on;
      showMark();
    },
  };
}
