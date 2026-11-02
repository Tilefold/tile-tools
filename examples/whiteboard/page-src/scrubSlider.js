/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — an upright slider to scrub
 *
 * A vertical slider from 0 to 100 drawn by the page, so it looks and
 * behaves the same in every engine (an upright native range doesn't). A
 * press anywhere on its track jumps there and a drag scrubs; the arrow
 * keys step it, Page Up and Page Down jump a quarter, Home and End go to
 * the ends. It's a real slider to assistive tech (role, value, label).
 * `scrubBy` lets another control scrub it from a drag of its own.
 */

/** How far one press of Page Up or Page Down moves it. */
const PAGE = 25;

/**
 * @param {Document} doc
 * @param {{ label: string, value: number, step: number,
 *   onInput: (value: number) => void }} o
 *   `onInput` hears each new value the user gives it.
 */
export function createScrubSlider(doc, o) {
  const el = doc.createElement("div");
  el.className = "scrub";
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-orientation", "vertical");
  el.setAttribute("aria-label", o.label);
  el.setAttribute("aria-valuemin", "0");
  el.setAttribute("aria-valuemax", "100");
  const track = doc.createElement("div");
  track.className = "scrub-track";
  const fill = doc.createElement("div");
  fill.className = "scrub-fill";
  const thumb = doc.createElement("div");
  thumb.className = "scrub-thumb";
  track.append(fill, thumb);
  el.append(track);

  let value = 0;
  /** Kept to 0..100, on the step. */
  const fit = (n) => {
    const v = Math.round(Math.min(100, Math.max(0, Number(n) || 0)) / o.step) * o.step;
    return Math.min(100, Math.max(0, v));
  };
  /** Shows `n` without telling anyone. */
  const show = (n) => {
    value = fit(n);
    fill.style.height = `${value}%`;
    thumb.style.bottom = `${value}%`;
    el.setAttribute("aria-valuenow", String(value));
    el.setAttribute("aria-valuetext", `${value}%`);
    return value;
  };
  /** Takes `n` from the user: shows it, and says so when it changed. */
  const take = (n) => {
    const before = value;
    show(n);
    if (value !== before) o.onInput(value);
  };
  show(o.value);

  /** The value where pointer `y` is on the track (the top is 100), or null when unmeasured. */
  const at = (y) => {
    const r = track.getBoundingClientRect();
    if (!r.height) return null;
    return ((r.bottom - y) / r.height) * 100;
  };

  // A press anywhere on it jumps there; a drag scrubs.
  let pressed = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    pressed = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
    el.focus();
    el.classList.add("scrubbing");
    const v = at(e.clientY);
    if (v !== null) take(v);
  });
  el.addEventListener("pointermove", (e) => {
    if (pressed === null || e.pointerId !== pressed) return;
    const v = at(e.clientY);
    if (v !== null) take(v);
  });
  const end = (e) => {
    if (pressed === null || e.pointerId !== pressed) return;
    pressed = null;
    el.classList.remove("scrubbing");
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  el.addEventListener("keydown", (e) => {
    const by = {
      ArrowUp: o.step,
      ArrowRight: o.step,
      ArrowDown: -o.step,
      ArrowLeft: -o.step,
      PageUp: PAGE,
      PageDown: -PAGE,
    }[e.key];
    if (by !== undefined) take(value + by);
    else if (e.key === "Home") take(0);
    else if (e.key === "End") take(100);
    else return;
    e.preventDefault();
    // Its keys don't step the explanation or move the window.
    e.stopPropagation();
  });

  return {
    el,
    /** The value now. */
    value: () => value,
    /** Sets it without telling `onInput`. */
    set: (n) => show(n),
    /** Moves it by `n` from `from`, as the user scrubbing it from elsewhere. */
    scrubBy: (from, n) => take(from + n),
    focus: () => el.focus(),
  };
}
