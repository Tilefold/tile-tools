// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — one prompt per pane
 *
 * Sessions are found and made by pane id, start empty and closed, reset
 * back to writing; past the limit the least recently used one goes, never
 * one that is checking; the focused pane's id is read from a layout.
 * Whether what to fix is asked first is cleared by a reset, by going back
 * to the prompt, and by closing the menu (only while it is asked).
 *
 * Modified 2026-11-07 (pick before checking): `choosing`.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_SESSIONS,
  applyToSession,
  createSessions,
  focusedId,
  freshSession,
  resetSession,
} from "../../examples/prompt-polish/src/sessions.js";

describe("sessions", () => {
  it("are made per pane, empty and closed, and found again", () => {
    const all = createSessions();
    const a = all.ensure("p1");
    expect(a).toMatchObject({ open: false, step: "write", draft: "" });
    a.draft = "x";
    expect(all.ensure("p1").draft).toBe("x");
    expect(all.get("p2")).toBeNull();
    expect(all.ensure("p2")).not.toBe(a);
    expect(all.size()).toBe(2);
  });

  it("take no bad ids, and can be forgotten", () => {
    const all = createSessions();
    expect(all.ensure("")).toBeNull();
    expect(all.ensure(42)).toBeNull();
    expect(all.get(undefined)).toBeNull();
    all.ensure("p1");
    all.drop("p1");
    expect(all.get("p1")).toBeNull();
  });

  it("forget the least recently used past the limit, but never one that is checking", () => {
    const all = createSessions();
    for (let i = 0; i < MAX_SESSIONS; i++) all.ensure(`p${i}`);
    all.get("p0").busy = true;
    all.ensure("p1");
    all.ensure("new");
    expect(all.size()).toBe(MAX_SESSIONS);
    expect(all.get("p0")).not.toBeNull();
    expect(all.get("p1")).not.toBeNull();
    expect(all.get("p2")).toBeNull();
  });

  it("reset back to writing, keeping whether the card is open", () => {
    const s = Object.assign(freshSession(), {
      open: true,
      step: "result",
      draft: "x",
      clean: true,
    });
    s.rejected.add(1);
    resetSession(s);
    expect(s).toMatchObject({ open: true, step: "write", draft: "", clean: false, problem: "" });
    expect(s.rejected.size).toBe(0);
  });

  it("read the focused pane from a layout", () => {
    expect(focusedId({ panes: [{ id: "p1" }, { id: "p2", focused: true }] })).toBe("p2");
    expect(focusedId({ panes: [{ id: "p1" }] })).toBeNull();
    expect(focusedId(null)).toBeNull();
  });
});

describe("what to fix, asked before the check", () => {
  it("starts unasked, and a reset clears it", () => {
    const s = freshSession();
    expect(s.choosing).toBe(false);
    s.choosing = true;
    expect(resetSession(s).choosing).toBe(false);
  });

  it("is cleared by closing the menu, only while it is asked", () => {
    const s = { ...freshSession(), choosing: true };
    expect(applyToSession(s, { type: "choose-skip" })).toEqual({
      done: true,
      changed: true,
      toggled: false,
    });
    expect(s.choosing).toBe(false);
    expect(applyToSession(s, { type: "choose-skip" }).done).toBe(false);
  });

  it("is cleared by going back to the prompt", () => {
    const s = { ...freshSession(), step: "result", choosing: true };
    applyToSession(s, { type: "back" });
    expect(s).toMatchObject({ step: "write", choosing: false });
  });
});
