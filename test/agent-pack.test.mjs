// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Agent Pack — tests
 *
 * One command per preset offers that agent with `tf.agent.define`, with a
 * command a shell never treats as special; a notice says how it went
 * (added, already there, declined, full, refused, or why it failed); an
 * older Tilefold is told it needs a newer one; audits name only the preset
 * and whether it was added.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { startTile } from "./fake-host.mjs";
import { PRESETS, resultKey } from "../examples/agent-pack/src/presets.js";

const DIR = fileURLToPath(new URL("../examples/agent-pack/", import.meta.url));

describe("Agent Pack", () => {
  it("has a command for each preset, and every command is safe to type", async () => {
    const host = await startTile(DIR, { define: true });
    const ids = host.regs.filter((r) => r.kind === "command").map((r) => r.id);
    expect(ids).toEqual(PRESETS.map((p) => `add-${p.id}`));
    for (const p of PRESETS) expect(p.command).toMatch(/^[A-Za-z0-9._,:=@%+/~ -]+$/);
  });

  it("offers the agent and says it was added", async () => {
    const host = await startTile(DIR, { define: true });
    await host.command("add-grok");
    expect(host.defines).toEqual([
      { name: "Grok Build", command: "grok", clear: "/clear", title: "Grok" },
    ]);
    expect(host.toasts.at(-1)).toContain("Grok Build was added");
    expect(host.audits).toContainEqual({
      action: "offered",
      details: { preset: "grok", added: true },
    });
  });

  it("says when it was there already, declined, full or refused", async () => {
    for (const [answer, words] of [
      [{ added: false, why: "exists", id: "kimi" }, "one of your agents already"],
      [{ added: false, why: "declined" }, "wasn't added"],
      [{ added: false, why: "full" }, "20 agents"],
      [{ added: false, why: "refused" }, "couldn't keep"],
    ]) {
      const host = await startTile(DIR, { define: answer });
      await host.command("add-kimi");
      expect(host.toasts.at(-1)).toContain(words);
    }
    expect(resultKey(null)).toBe("toast-refused");
  });

  it("says why when the offer fails, and asks for a newer Tilefold without define", async () => {
    const busy = await startTile(DIR, {
      define: () => {
        throw Object.assign(new Error("x"), { name: "BusyError" });
      },
    });
    await busy.command("add-vibe");
    expect(busy.toasts.at(-1)).toContain("BusyError");
    const old = await startTile(DIR, {});
    await old.command("add-vibe");
    expect(old.toasts.at(-1)).toContain("newer Tilefold");
  });
});
