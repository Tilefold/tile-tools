// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — the upright slider to scrub
 *
 * A press anywhere on its track jumps there and a drag scrubs (the top is
 * 100), always within 0..100 and on its step; the keys step it, jump a
 * quarter and go to the ends without reaching the page; it tells only the
 * values that change, and is a slider to assistive tech.
 */
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createScrubSlider } from "../../examples/whiteboard/page-src/scrubSlider.js";

/** A slider whose track is 100 pixels tall, from y 100 to y 200. */
function slider(value = 50) {
  const w = new JSDOM("<!doctype html><body></body>", { url: "https://board.test/" }).window;
  const heard = [];
  const s = createScrubSlider(w.document, {
    label: "Background opacity",
    value,
    step: 5,
    onInput: (v) => heard.push(v),
  });
  w.document.body.append(s.el);
  s.el.querySelector(".scrub-track").getBoundingClientRect = () => ({
    top: 100,
    bottom: 200,
    height: 100,
    left: 0,
    right: 6,
    width: 6,
  });
  const fire = (type, y) =>
    s.el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, button: 0, clientY: y }));
  const key = (k) => {
    const e = new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
    s.el.dispatchEvent(e);
    return e;
  };
  return { w, s, heard, fire, key };
}

describe("the scrub slider", () => {
  it("jumps where it's pressed and scrubs with a drag, kept within 0..100 on its step", () => {
    const t = slider();
    t.fire("pointerdown", 120);
    expect(t.s.value()).toBe(80);
    expect(t.s.el.classList.contains("scrubbing")).toBe(true);
    t.fire("pointermove", 163);
    expect(t.s.value()).toBe(35);
    t.fire("pointermove", 400);
    expect(t.s.value()).toBe(0);
    t.fire("pointermove", -50);
    expect(t.s.value()).toBe(100);
    t.fire("pointerup", -50);
    expect(t.s.el.classList.contains("scrubbing")).toBe(false);
    // After it's let go, moving the pointer changes nothing.
    t.fire("pointermove", 150);
    expect(t.s.value()).toBe(100);
    expect(t.heard).toEqual([80, 35, 0, 100]);
  });

  it("steps with the keys, which never reach the page", () => {
    const t = slider(50);
    const reached = [];
    t.w.document.addEventListener("keydown", (e) => reached.push(e.key));
    t.key("ArrowUp");
    t.key("ArrowRight");
    t.key("ArrowLeft");
    expect(t.s.value()).toBe(55);
    t.key("PageUp");
    expect(t.s.value()).toBe(80);
    t.key("End");
    expect(t.s.value()).toBe(100);
    t.key("ArrowUp");
    t.key("Home");
    expect(t.s.value()).toBe(0);
    expect(reached).toEqual([]);
    // Other keys pass on.
    expect(t.key("a").defaultPrevented).toBe(false);
    expect(reached).toEqual(["a"]);
    // Only values that changed are told.
    expect(t.heard).toEqual([55, 60, 55, 80, 100, 0]);
  });

  it("is a slider to assistive tech, and sets quietly from outside", () => {
    const t = slider(55);
    expect(t.s.el.getAttribute("role")).toBe("slider");
    expect(t.s.el.getAttribute("aria-orientation")).toBe("vertical");
    expect(t.s.el.getAttribute("aria-valuenow")).toBe("55");
    expect(t.s.el.getAttribute("aria-valuetext")).toBe("55%");
    t.s.set(12);
    expect(t.s.value()).toBe(10);
    expect(t.s.el.querySelector(".scrub-fill").style.height).toBe("10%");
    expect(t.heard).toEqual([]);
    t.s.scrubBy(10, 7.6);
    expect(t.s.value()).toBe(20);
    expect(t.heard).toEqual([20]);
  });
});
