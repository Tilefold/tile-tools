/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake host — tf.input tests
 *
 * The fake agent input box behaves like Tilefold's: input actions are
 * checked when registered; a click hands the tile the box's text with keys
 * masked and a one-time request; a replacement lands once, puts the masked
 * keys back, and answers "changed", "expired" or "gone" when it can't; one
 * too long or for an unknown request is refused; release ends a request;
 * the user's × fires `input.cancelled` and a later answer hears "stopped".
 *
 * Modified 2026-11-07 (reworked prompts): "too long" at Tilefold's new limit.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTile } from "./fake-host.mjs";

let dir = "";

/** Writes a tile whose main.js body is `body` into a fresh folder. */
function tileWith(body) {
  const d = mkdtempSync(join(dir, "tile-"));
  mkdirSync(join(d, "locales", "en"), { recursive: true });
  writeFileSync(join(d, "locales", "en", "tile.ftl"), "tile-name = Probe\n");
  writeFileSync(join(d, "main.js"), `export default (tf) => {\n${body}\n};\n`);
  return d;
}

/** A tile that answers each click with `answer(e)` (a JS expression) and records the result. */
const answering = (answer) =>
  tileWith(`
    tf.input.action({ id: "fix", label: "✦ Fix" });
    tf.on("input.action", async (e) => {
      tf.audit("heard", { text: e.text, language: e.language });
      try { tf.audit("result", await tf.input.replace(e.request, { text: ${answer} })); }
      catch (err) { tf.audit("refused", { name: err.name }); }
    });`);

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "fake-input-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const audit = (host, action) =>
  host.audits.filter((a) => a.action === action).map((a) => a.details);

describe("fake tf.input, stopped", () => {
  it("fires input.cancelled on the user's ×, and answers stopped after", async () => {
    const waits = tileWith(`
      tf.input.action({ id: "fix", label: "Fix" });
      tf.on("input.action", (e) => { globalThis.lastRequest = e.request; });
      tf.on("input.cancelled", (e) => tf.audit("cancelled", { same: e.request === globalThis.lastRequest }));
      tf.command("Answer", async () => tf.input.replace(globalThis.lastRequest, { text: "New." }), { id: "answer" });`);
    const host = await startTile(waits, { input: { text: "old" } });
    await host.clickAction("fix");
    await host.stopAction();
    expect(audit(host, "cancelled")).toEqual([{ same: true }]);
    expect(await host.command("answer")).toEqual({ done: false, why: "stopped" });
    expect(host.box.text).toBe("old");
  });
});

describe("fake tf.input", () => {
  it("checks registrations like Tilefold", async () => {
    for (const bad of [
      `tf.input.action({ id: "Bad", label: "x" })`,
      `tf.input.action({ id: "ok", label: "${"x".repeat(25)}" })`,
      `tf.input.action({ id: "a", label: "a" }); tf.input.action({ id: "a", label: "b" })`,
      `for (const id of ["a", "b", "c"]) tf.input.action({ id, label: id })`,
    ]) {
      await expect(startTile(tileWith(bad), { input: true })).rejects.toThrow();
    }
    const host = await startTile(tileWith(`tf.input.action({ id: "fix", label: " ✦  Fix " })`), {
      input: true,
    });
    expect(host.actions).toEqual([{ id: "fix", label: "✦ Fix" }]);
  });

  it("hands over the text masked and puts the keys back in the replacement", async () => {
    const host = await startTile(answering(`e.text.replace("fix", "Fix")`), {
      input: { text: "fix sk-ant-api03-abcdefghijkl now", language: "ko" },
    });
    await host.clickAction("fix");
    expect(audit(host, "heard")).toEqual([{ text: "fix [redacted] now", language: "ko" }]);
    expect(audit(host, "result")).toEqual([{ done: true }]);
    expect(host.box.text).toBe("Fix sk-ant-api03-abcdefghijkl now");
  });

  it("answers changed, expired and gone", async () => {
    const waits = tileWith(`
      tf.input.action({ id: "fix", label: "Fix" });
      tf.on("input.action", (e) => { globalThis.lastRequest = e.request; });
      tf.command("Answer", async () => tf.input.replace(globalThis.lastRequest, { text: "New." }), { id: "answer" });`);
    const host = await startTile(waits, { input: { text: "old" } });
    await host.clickAction("fix");
    host.box.text = "edited";
    expect(await host.command("answer")).toEqual({ done: false, why: "changed" });
    await host.clickAction("fix");
    host.expireInput();
    expect(await host.command("answer")).toEqual({ done: false, why: "expired" });
    await host.clickAction("fix");
    host.closeBox();
    expect(await host.command("answer")).toEqual({ done: false, why: "gone" });
  });

  it("refuses a replacement too long or for no request, and releases", async () => {
    const host = await startTile(answering(`"x".repeat(3013)`), { input: { text: "abc" } });
    await host.clickAction("fix");
    expect(audit(host, "refused")).toEqual([{ name: "TypeError" }]);
    const release = tileWith(`
      tf.input.action({ id: "fix", label: "Fix" });
      tf.on("input.action", async (e) => {
        await tf.input.release(e.request);
        try { await tf.input.release(e.request); } catch (err) { tf.audit("again", { name: err.name }); }
      });`);
    const host2 = await startTile(release, { input: { text: "abc" } });
    const request = await host2.clickAction("fix");
    expect(host2.box.released).toEqual([request]);
    expect(audit(host2, "again")).toEqual([{ name: "TypeError" }]);
  });
});
