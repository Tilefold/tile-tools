/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — the window a 3D scene floats in
 *
 * A 3D scene floats over the board, content and all, in a small window the
 * user can move: a bar along its top with the scene's title, which they
 * drag (or focus and move with the arrow keys, Shift for bigger steps).
 * A click on the bar that isn't a drag points at the whole scene; a
 * double-click folds the window down to its bar, and another shows it
 * again at its size. Buttons
 * on the bar zoom the model out and in, show or hide the parts' labels,
 * set how see-through the window's background is (a slider, 0 to 100%,
 * which a press and drag on the button scrubs straight away),
 * turn on drawing on the model, clear what's drawn and picked on it, fold
 * the window down to its bar, so it never hides the content for good, and
 * close it. A corner at the bottom right resizes it, by drag or arrow keys.
 * The window only reports what the user does; where it sits on the board,
 * and how big it is, is up to the layer that holds it (glLayer.js).
 */

import { icon } from "./icons.js";
import { createScrubSlider } from "./scrubSlider.js";

/** How far one arrow key moves or resizes a window, in board units (Shift: BIG_STEP). */
export const KEY_STEP = 10;
export const BIG_STEP = 50;
/** How much one press of a zoom button zooms. */
export const ZOOM_STEP = 1.25;
/** How solid a window's background is at first, in percent (0 is see-through). */
export const OPACITY = 55;
/** The opacity slider's step, in percent. */
const OPACITY_STEP = 5;
/** How far a drag on the see-through button goes for one percent, in pixels. */
export const SCRUB_PX = 1.5;
/** How far a press must travel before it's a drag rather than a click, in pixels. */
const DRAG_PX = 4;
/** How long a click on the bar waits, in ms, to be sure it isn't half of a double-click. */
export const CLICK_WAIT_MS = 250;

/**
 * Follows drags that start on `el`: `grab` once the press travels,
 * `drag` with the pixels from where it started, `drop` at the end. A press
 * that doesn't travel is a click, which `click` gets; the click that ends a
 * drag is swallowed.
 * @param {HTMLElement} el
 * @param {{ grab: () => void, drag: (dx: number, dy: number) => void, drop: () => void,
 *   click?: () => void, moving: (on: boolean) => void }} on
 */
function dragging(el, on) {
  let drag = null;
  let dragged = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moving: false };
    dragged = false;
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moving && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!drag.moving) {
      drag.moving = true;
      on.moving(true);
      on.grab();
    }
    on.drag(dx, dy);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const was = drag.moving;
    drag = null;
    on.moving(false);
    if (was) {
      dragged = true;
      on.drop();
    }
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("click", () => {
    // The click that ends a drag isn't one that points.
    if (dragged) return void (dragged = false);
    on.click?.();
  });
}

/**
 * The arrow keys on `el` give `fn` a step in board units (Shift: a bigger
 * one); they don't reach the page, where they'd step the explanation.
 */
function arrowKeys(el, fn) {
  el.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? BIG_STEP : KEY_STEP;
    const by = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (!by) return;
    e.preventDefault();
    e.stopPropagation();
    fn(by[0], by[1]);
  });
}

/** A small button for the bar, with its icon (icons.js); its label says what it does. */
function barButton(doc, cls, name, label) {
  const b = doc.createElement("button");
  b.type = "button";
  b.className = cls;
  b.title = label;
  b.setAttribute("aria-label", label);
  b.append(icon(doc, name));
  return b;
}

/** A thin line between groups of buttons on the bar. */
function separator(doc) {
  const s = doc.createElement("span");
  s.className = "float-sep";
  s.setAttribute("aria-hidden", "true");
  return s;
}

/**
 * A button on the bar that's on or off; `fn` hears each change.
 * Returns how to set it without telling `fn`.
 */
function toggle(doc, cls, name, label, on, fn) {
  const b = barButton(doc, cls, name, label);
  let state = !!on;
  const show = () => {
    b.setAttribute("aria-pressed", String(state));
    b.classList.toggle("on", state);
  };
  show();
  b.addEventListener("click", () => {
    state = !state;
    show();
    fn(state);
  });
  return {
    b,
    set(next) {
      state = !!next;
      show();
    },
  };
}

/**
 * The window for one scene.
 *
 * @param {Document} doc
 * @param {{ title: string,
 *   labels: { move: string, fold: string, unfold: string, mark: string, size: string,
 *     zoomIn: string, zoomOut: string, clear: string, opacity: string, tags: string,
 *     reset: string, close: string },
 *   folded: boolean, opacity?: number, tags?: boolean,
 *   onGrab: () => void,
 *   onDrag: (dx: number, dy: number) => void,
 *   onDrop: () => void,
 *   onKey: (dx: number, dy: number) => void,
 *   onSizeGrab: () => void,
 *   onSize: (dx: number, dy: number) => void,
 *   onSizeDrop: () => void,
 *   onSizeKey: (dw: number, dh: number) => void,
 *   onFold: (folded: boolean) => void,
 *   onZoom: (by: number) => void,
 *   onOpacity: (percent: number) => void,
 *   onReset: () => void,
 *   onClose: () => void,
 *   onTags: (shown: boolean) => void,
 *   onMarkMode: (on: boolean) => void,
 *   onPick: () => void }} o
 *   onGrab, onDrag (pixels from where the drag started) and onDrop follow a
 *   drag of the bar, onSizeGrab, onSize and onSizeDrop one of the corner;
 *   onKey and onSizeKey move and resize by board units; onPick is a click.
 *   `opacity` is how solid its background starts (OPACITY when left out);
 *   `tags` false starts its labels hidden.
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
  const title = doc.createElement("span");
  title.className = "float-title";
  // Text the agent wrote is only ever text, never markup.
  title.textContent = o.title;
  // Dots to drag by, and a cube: a 3D view.
  grip.append(icon(doc, "grip"), icon(doc, "cube"), title);

  const out = barButton(doc, "float-zoom-out", "zoom-out", o.labels.zoomOut);
  const inn = barButton(doc, "float-zoom-in", "zoom-in", o.labels.zoomIn);
  out.addEventListener("click", () => o.onZoom(1 / ZOOM_STEP));
  inn.addEventListener("click", () => o.onZoom(ZOOM_STEP));
  // Labels, a see-through background, and drawing: each on or off.
  const tags = toggle(doc, "float-tags", "tags", o.labels.tags, o.tags !== false, o.onTags);
  const mark = toggle(doc, "float-mark", "pen", o.labels.mark, false, o.onMarkMode);
  // Clears what's drawn on the model and the part picked.
  const reset = barButton(doc, "float-reset", "eraser", o.labels.reset);
  reset.addEventListener("click", () => o.onReset());
  const fold = doc.createElement("button");
  fold.type = "button";
  fold.className = "float-fold";
  const close = barButton(doc, "float-close", "close", o.labels.close);
  close.addEventListener("click", () => o.onClose());

  // How see-through the background is: a button that opens an upright slider under it
  // when clicked, and scrubs it straight away when pressed and dragged up or down.
  const clear = barButton(doc, "float-clear", "opacity", o.labels.clear);
  clear.setAttribute("aria-expanded", "false");
  const pop = doc.createElement("div");
  pop.className = "float-opacity";
  pop.hidden = true;
  const shown = doc.createElement("output");
  /** Sets how solid the background is, 0 to 100 percent. */
  const solid = (v) => {
    shown.textContent = `${v}%`;
    host.style.setProperty("--float-solid", `${v}%`);
    // Fully see-through: no edge or shadow either, until the pointer's over it.
    host.classList.toggle("clear", v === 0);
    return v;
  };
  const slider = createScrubSlider(doc, {
    label: o.labels.opacity,
    value: Number.isFinite(o.opacity) ? o.opacity : OPACITY,
    step: OPACITY_STEP,
    onInput: (v) => o.onOpacity(solid(v)),
  });
  solid(slider.value());
  pop.append(slider.el, shown);
  const openPop = (on, focus = true) => {
    pop.hidden = !on;
    clear.setAttribute("aria-expanded", String(on));
    clear.classList.toggle("on", on);
    if (!on) return;
    // Under its button, on the window's right side.
    const right = host.clientWidth - (clear.offsetLeft + clear.offsetWidth);
    pop.style.right = `${Math.max(0, right)}px`;
    pop.style.top = `${bar.offsetHeight}px`;
    if (focus) slider.focus();
  };
  // Scrubbing from the button: up is more solid; the slider shows while it lasts.
  let from = 0;
  dragging(clear, {
    grab: () => {
      from = slider.value();
      openPop(true, false);
    },
    drag: (_dx, dy) => slider.scrubBy(from, -dy / SCRUB_PX),
    drop: () => openPop(false),
    click: () => openPop(pop.hidden),
    moving: (on) => host.classList.toggle("scrubbing", on),
  });
  // It closes when the user goes elsewhere, or presses Esc.
  pop.addEventListener("focusout", (e) => {
    if (!pop.contains(e.relatedTarget) && e.relatedTarget !== clear) openPop(false);
  });
  pop.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    openPop(false);
    clear.focus();
  });
  // In groups: the view, how it looks, drawing, the window.
  bar.append(
    grip,
    out,
    inn,
    separator(doc),
    tags.b,
    clear,
    separator(doc),
    mark.b,
    reset,
    separator(doc),
    fold,
    close,
  );

  const body = doc.createElement("div");
  body.className = "float-body";
  // The corner that resizes the window.
  const size = barButton(doc, "float-size", "resize", o.labels.size);
  host.append(bar, body, size, pop);

  let folded = !!o.folded;
  const showFold = () => {
    host.classList.toggle("folded", folded);
    body.hidden = folded;
    size.hidden = folded;
    if (folded) pop.hidden = true;
    const label = folded ? o.labels.unfold : o.labels.fold;
    fold.title = label;
    fold.setAttribute("aria-label", label);
    fold.setAttribute("aria-expanded", String(!folded));
    // Up folds it, down shows it again.
    fold.replaceChildren(icon(doc, folded ? "fold-down" : "fold-up"));
  };
  showFold();
  /** Folds it down to its bar, or shows it again. */
  const toggleFold = () => {
    folded = !folded;
    showFold();
    o.onFold(folded);
  };
  fold.addEventListener("click", toggleFold);

  // A click points, unless a second one follows: a double-click folds it, or shows it again.
  let picking = 0;
  const win = doc.defaultView;
  grip.addEventListener("dblclick", (e) => {
    e.preventDefault();
    win.clearTimeout(picking);
    toggleFold();
  });

  // Dragging the bar moves the window; dragging the corner resizes it.
  dragging(grip, {
    grab: o.onGrab,
    drag: o.onDrag,
    drop: o.onDrop,
    click: () => {
      win.clearTimeout(picking);
      picking = win.setTimeout(o.onPick, CLICK_WAIT_MS);
    },
    moving: (on) => host.classList.toggle("moving", on),
  });
  dragging(size, {
    grab: o.onSizeGrab,
    drag: o.onSize,
    drop: o.onSizeDrop,
    moving: (on) => host.classList.toggle("sizing", on),
  });
  arrowKeys(grip, o.onKey);
  arrowKeys(size, o.onSizeKey);

  return {
    /** The whole window, which the layer places. */
    host,
    /** Where the 3D view draws. */
    body,
    /** The bar's height in pixels now (0 before it's laid out). */
    barHeight: () => bar.offsetHeight,
    /** Whether it's folded down to its bar. */
    folded: () => folded,
    /** Shows drawing as on or off (Esc in the view turns it off). */
    setMarking: (on) => mark.set(on),
  };
}
