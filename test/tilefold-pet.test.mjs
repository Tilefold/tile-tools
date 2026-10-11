// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet (example tile) — tests
 *
 * The pet appears with the app on the floor of the focused pane, unless the
 * user hid it; roams its pane (or keeps to the bottom), shows its back
 * walking up and its face walking down, and now and then wanders into
 * another pane; a click pats it, a double-click plays, a drag carries it and
 * it stays where it is dropped; it naps when you step away and greets you
 * when you return; the commands show, hide, call and send it to bed. The
 * Character setting offers Tessa, Coco and Biscuit with translated labels;
 * switching redraws at once and is recorded; an unknown character falls
 * back to Tessa. Dogs bark with valid WAV clips (once at a pat, twice at
 * play), never when Bark is off; Tessa never barks.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";

const DIR = fileURLToPath(new URL("../examples/tilefold-pet/", import.meta.url));

/** The floor of the one-pane layout for a 48 px pet: just above the Composer. */
const FLOOR = 724 - 48 - 2;

/** Two side-by-side panes; the left one has focus. */
const TWO_PANES = {
  content: { w: 1200, h: 800 },
  panes: [
    { id: "p1", x: 0, y: 40, w: 600, h: 730, focused: true, composer: null },
    { id: "p2", x: 600, y: 40, w: 600, h: 730, focused: false, composer: null },
  ],
};

/** Math.random answers: queued values first, then `rest`. */
let queue = [];
let rest = 0.4;
beforeEach(() => {
  vi.useFakeTimers();
  queue = [];
  rest = 0.4;
  vi.spyOn(Math, "random").mockImplementation(() => (queue.length ? queue.shift() : rest));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A started pet, on screen. */
async function started(opts = {}) {
  const host = await startTile(DIR, opts);
  await host.emit("app.ready");
  return host;
}

const pet = (host) => host.item("pet");
const SLEEPING = "%3Ctext"; // the "z" drawn in the sleeping pose

describe("Tilefold Pet", () => {
  it("appears with the app on the floor of the focused pane", async () => {
    const host = await started();
    expect(pet(host)).toMatchObject({ w: 48, h: 48, y: FLOOR, hit: true, label: "Tessa" });
    expect(pet(host).image.startsWith("data:image/svg+xml")).toBe(true);
    expect(host.store.get("visible")).toBe(true);
    expect(host.errors).toEqual([]);
  });

  it("stays hidden at start when the user hid it", async () => {
    const host = await started({ store: { visible: false } });
    expect(host.overlay).toBeNull();
  });

  it("roams anywhere in its pane, or only along the bottom when asked", async () => {
    const host = await started();
    await host.advance(1500);
    expect(pet(host).moveMs).toBeGreaterThan(0);
    expect(pet(host).y).toBeLessThan(FLOOR);
    expect(pet(host).y).toBeGreaterThanOrEqual(40 + 8);

    const floor = await started({ settings: { roam: "floor" } });
    await floor.advance(1500);
    expect(pet(floor).sheet).toEqual({ frames: 2, fps: 6 });
    expect(pet(floor).y).toBe(FLOOR);
  });

  it("shows its back walking up and its face walking down", async () => {
    const host = await started({ settings: { character: "poodle" } });
    await host.advance(1500);
    const up = pet(host);
    expect(up.sheet).toEqual({ frames: 4, fps: 8 });
    const upImage = up.image;
    await host.emit("overlay.pointer", { item: "pet", type: "dragstart", x: 0, y: 0 });
    await host.emit("overlay.pointer", { item: "pet", type: "drop", x: up.x + 24, y: 60 });
    expect(pet(host).y).toBe(48);
    await host.advance(1500);
    expect(pet(host).y).toBeGreaterThan(48);
    expect(pet(host).image).not.toBe(upImage);
  });

  it("now and then wanders into another pane", async () => {
    const host = await started({ layout: TWO_PANES });
    // choose → walk (0.4), wander → another pane (0.1), then which pane, x and y.
    queue = [0.4, 0.1];
    await host.advance(1500);
    expect(pet(host).x).toBeGreaterThanOrEqual(600);
  });

  it("loves a pat, plays on a double-click, and records both", async () => {
    const host = await started();
    await host.emit("overlay.pointer", { item: "pet", type: "click", x: 10, y: 10 });
    expect(pet(host)).toMatchObject({ bubble: "♥" });
    await host.emit("overlay.pointer", { item: "pet", type: "dblclick", x: 10, y: 10 });
    expect(pet(host)).toMatchObject({ bubble: "Wheee!" });
    expect(host.audits.map((a) => a.action)).toEqual(["pat", "play"]);
    await host.advance(4000);
    expect(pet(host).bubble).toBeNull();
  });

  it("is carried by a drag and stays where it is dropped", async () => {
    const host = await started();
    await host.emit("overlay.pointer", { item: "pet", type: "dragstart", x: 0, y: 0 });
    expect(pet(host).bubble).toBe("Whoa!");
    await host.emit("overlay.pointer", { item: "pet", type: "drop", x: 500, y: 300 });
    expect(pet(host)).toMatchObject({ x: 476, y: 276 });
  });

  it("naps when you step away and greets you when you return", async () => {
    const host = await started({ settings: { sleepAfterIdle: 5 } });
    await host.emit("user.idle", { minutes: 4 });
    expect(pet(host).image).not.toContain(SLEEPING);
    await host.emit("user.idle", { minutes: 45 });
    expect(pet(host).image).toContain(SLEEPING);
    await host.emit("user.active");
    expect(pet(host).bubble).toBe("Welcome back!");
  });

  it("shows, hides, comes when called, and goes to bed on command", async () => {
    const host = await started({ settings: { name: "Mochi", size: 64 } });
    await host.command("toggle");
    expect(host.overlay).toBeNull();
    expect(host.store.get("visible")).toBe(false);
    await host.command("call");
    expect(pet(host)).toMatchObject({ label: "Mochi", w: 64, x: 600 - 32 });
    await host.command("nap");
    expect(pet(host).image).toContain(SLEEPING);
    await host.command("nap");
    expect(pet(host).image).not.toContain(SLEEPING);
  });

  it("comes back on the next event after a restart, unless it was hidden", async () => {
    const restarted = await startTile(DIR);
    await restarted.emit("window.focused");
    expect(pet(restarted)).toMatchObject({ label: "Tessa" });
    const hidden = await startTile(DIR, { store: { visible: false } });
    await hidden.emit("window.focused");
    expect(hidden.overlay).toBeNull();
  });

  it("speaks the user's language", async () => {
    const host = await started({ locale: "ko" });
    await host.emit("overlay.pointer", { item: "pet", type: "dblclick", x: 1, y: 1 });
    expect(pet(host).bubble).toBe("신난다!");
  });
});

describe("Tilefold Pet characters", () => {
  it("offers Tessa, Coco and Biscuit, Tessa first, with translated labels", async () => {
    const host = await startTile(DIR);
    const setting = host.regs.find((r) => r.kind === "setting" && r.key === "character");
    expect(setting.default).toBe("tessa");
    expect(setting.choices).toEqual([
      { value: "tessa", label: "Tessa, the tile creature" },
      { value: "poodle", label: "Coco, the white poodle" },
      { value: "terrier", label: "Biscuit, the scruffy terrier" },
    ]);
    const ja = await startTile(DIR, { locale: "ja" });
    const jaSetting = ja.regs.find((r) => r.kind === "setting" && r.key === "character");
    expect(jaSetting.choices[1].label).toBe("ココ（白いプードル）");
  });

  it("draws each character with its own name and art", async () => {
    const tessa = await started();
    const coco = await started({ settings: { character: "poodle" } });
    const biscuit = await started({ settings: { character: "terrier" } });
    expect([pet(coco).label, pet(biscuit).label]).toEqual(["Coco", "Biscuit"]);
    expect(new Set([pet(tessa).image, pet(coco).image, pet(biscuit).image]).size).toBe(3);
    const named = await started({ settings: { character: "poodle", name: "  Bijou " } });
    expect(pet(named).label).toBe("Bijou");
  });

  it("switches character at once, keeps sleeping, and records the change", async () => {
    const host = await started();
    await host.command("nap");
    await host.setSetting("character", "poodle");
    expect(pet(host)).toMatchObject({ label: "Coco" });
    expect(pet(host).image).toContain(SLEEPING);
    expect(host.audits).toContainEqual({ action: "character", details: { character: "poodle" } });
  });

  it("falls back to Tessa for an unknown character", async () => {
    const host = await started({ settings: { character: "unicorn" } });
    expect(pet(host).label).toBe("Tessa");
    expect(host.errors).toEqual([]);
  });
});

describe("Tilefold Pet barking", () => {
  it("barks once at a pat and twice at play, with valid WAV clips", async () => {
    const host = await started({ settings: { character: "poodle" } });
    await host.emit("overlay.pointer", { item: "pet", type: "click", x: 1, y: 1 });
    await host.emit("overlay.pointer", { item: "pet", type: "dblclick", x: 1, y: 1 });
    expect(host.sounds).toHaveLength(2);
    const [one, two] = host.sounds;
    expect(one.src.startsWith("data:audio/wav;base64,UklGR")).toBe(true); // "RIFF"
    expect(two.src.length).toBeGreaterThan(one.src.length);
    expect(one.volume).toBe(0.5);
    expect(pet(host).bubble).toBe("Woof!");
  });

  it("Biscuit barks lower than Coco", async () => {
    const coco = await started({ settings: { character: "poodle" } });
    const biscuit = await started({ settings: { character: "terrier" } });
    for (const host of [coco, biscuit]) {
      await host.emit("overlay.pointer", { item: "pet", type: "click", x: 1, y: 1 });
    }
    expect(biscuit.sounds[0].src).not.toBe(coco.sounds[0].src);
  });

  it("stays quiet when Bark is off, and Tessa never barks", async () => {
    const quiet = await started({ settings: { character: "poodle", bark: false } });
    await quiet.emit("overlay.pointer", { item: "pet", type: "click", x: 1, y: 1 });
    expect(quiet.sounds).toEqual([]);
    const tessa = await started();
    await tessa.emit("overlay.pointer", { item: "pet", type: "dblclick", x: 1, y: 1 });
    expect(tessa.sounds).toEqual([]);
  });
});
