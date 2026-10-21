/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake host tests
 *
 * The fake Tilefold host's network, credential and AI stand-ins behave like
 * the app: requests are recorded with the credential they name, a missing
 * credential fails before anything is answered, `tf.auth.has` reports what
 * the user set up, `tf.ai.ask` records questions, fails when AI is not set
 * up and can wait for an answer given later, and notices and warnings are
 * recorded. A command runs with an agent's input only when it says it takes
 * some, and hands back what it returned as plain JSON.
 *
 * Modified 2026-10-20 (agent input): commands with input and results.
 *
 * Last updated by: Tilefold
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTile } from "./fake-host.mjs";

let dir = "";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "fake-host-"));
  mkdirSync(join(dir, "locales", "en"), { recursive: true });
  writeFileSync(join(dir, "locales", "en", "tile.ftl"), "tile-name = Probe\n");
  writeFileSync(
    join(dir, "main.js"),
    `export default (tf) => {
      tf.command("Fetch", async () => {
        const r = await tf.net.fetch("https://api.example.com/x", { auth: "svc" });
        tf.audit("fetched", { status: r.status, ok: r.ok, body: await r.text() });
      }, { id: "fetch" });
      tf.command("Has", async () => tf.audit("has", { svc: await tf.auth.has("svc") }), { id: "has" });
      tf.command("Ask", async () => {
        try { tf.audit("answer", { text: (await tf.ai.ask("hi")).text }); }
        catch (e) { tf.audit("failed", { name: e.name }); }
      }, { id: "ask" });
      const cards = [];
      tf.command("Add card", (card) => {
        cards.push(card.title);
        return { cards, at: new Date(0), skip: () => 1 };
      }, { id: "add-card", input: "{ title }: the card to add" });
      tf.command("Big", () => "x".repeat(70000), { id: "big" });
      tf.command("Say", async () => {
        await tf.toast("hello");
        await tf.log.warn("careful");
      }, { id: "say" });
    };\n`,
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("fake host", () => {
  it("answers tf.net.fetch for set-up credentials and refuses others", async () => {
    const host = await startTile(dir, {
      net: () => ({ status: 201, body: "made" }),
      credentials: ["svc"],
    });
    await host.command("fetch");
    expect(host.requests).toEqual([{ url: "https://api.example.com/x", init: { auth: "svc" } }]);
    expect(host.audits).toContainEqual({
      action: "fetched",
      details: { status: 201, ok: true, body: "made" },
    });
    host.credentials.clear();
    await expect(host.command("fetch")).rejects.toMatchObject({ name: "CredentialMissingError" });
  });

  it("reports credentials for tf.auth.has", async () => {
    const host = await startTile(dir, { credentials: ["svc"] });
    await host.command("has");
    host.credentials.delete("svc");
    await host.command("has");
    expect(host.audits.map((a) => a.details.svc)).toEqual([true, false]);
  });

  it("records tf.ai.ask questions and fails without AI", async () => {
    const off = await startTile(dir);
    await off.command("ask");
    expect(off.audits).toContainEqual({ action: "failed", details: { name: "AiNotSetUpError" } });
    const on = await startTile(dir, { ai: (q) => `echo ${q}` });
    await on.command("ask");
    expect(on.questions).toEqual(["hi"]);
    expect(on.audits).toContainEqual({ action: "answer", details: { text: "echo hi" } });
  });

  it("can hold an answer back until the test gives it", async () => {
    let give;
    const later = new Promise((resolve) => (give = resolve));
    const host = await startTile(dir, { ai: () => later });
    const asked = host.command("ask");
    expect(host.questions).toEqual(["hi"]);
    expect(host.audits).toEqual([]);
    give("later");
    await asked;
    expect(host.audits).toContainEqual({ action: "answer", details: { text: "later" } });
  });

  it("records notices and warnings", async () => {
    const host = await startTile(dir);
    await host.command("say");
    expect(host.toasts).toEqual(["hello"]);
    expect(host.warnings).toEqual(["careful"]);
  });

  it("runs a command with an agent's input when it takes some, and hands back its result", async () => {
    const host = await startTile(dir);
    expect(host.regs.find((r) => r.id === "add-card")).toMatchObject({
      input: "{ title }: the card to add",
    });
    expect(await host.command("add-card", { title: "Fix login" })).toEqual({
      cards: ["Fix login"],
      at: "1970-01-01T00:00:00.000Z",
    });
    // A command without input refuses it; from the palette it gets null.
    await expect(host.command("say", { x: 1 })).rejects.toThrow(/takes no input/);
    expect(await host.command("say")).toBeUndefined();
    await expect(host.command("big")).rejects.toThrow(/64 KB/);
  });
});
