// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * tf types — tests
 *
 * lib/tf.d.ts is valid TypeScript, and stays in step with the API it
 * describes: every `tf` member, event, permission-backed call and error
 * name the documentation lists is declared.
 *
 * Modified 2026-10-18 (screensaver themes): `tf.screensaver` and its frame type.
 *
 * Last updated by: Tilefold
 */
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import { describe, expect, it } from "vitest";

const TYPES = readFileSync(new URL("../lib/tf.d.ts", import.meta.url), "utf8");

describe("lib/tf.d.ts", () => {
  it("is valid TypeScript", async () => {
    // esbuild parses the declarations and drops them; a syntax error throws.
    const out = await transform(TYPES, { loader: "ts" });
    expect(out.code.trim()).toBe("");
  });

  it("declares every tf member", () => {
    const members = [
      "command(",
      "setting(",
      "on<",
      "guard(",
      "rewrite(",
      "t(",
      "toast(",
      "audit(",
      "readonly log:",
      "readonly store:",
      "readonly settings:",
      "readonly curtain:",
      "readonly window:",
      "readonly overlay:",
      "readonly sound:",
      "readonly net?:",
      "readonly auth?:",
      "readonly ai?:",
      "readonly page?:",
      "readonly panel?:",
      "readonly pane?:",
      "readonly fs?:",
      "readonly viewer?:",
      "readonly screensaver?:",
      "interface ScreensaverFrame",
      "interface TilePageBridge",
    ];
    for (const m of members) expect(TYPES, m).toContain(m);
  });

  it("lists every event and error name", () => {
    const events = [
      "app.ready",
      "window.focused",
      "window.blurred",
      "user.idle",
      "user.active",
      "setting.changed",
      "curtain.dismissed",
      "overlay.pointer",
      "overlay.layout",
      "page.closed",
      "page.message",
      "overlay.hidden",
      "pane.cwd",
      "panel.click",
      "panel.closed",
    ];
    for (const e of events) expect(TYPES, e).toContain(`| "${e}"`);
    const docs = readFileSync(new URL("../docs/limits-and-errors.md", import.meta.url), "utf8");
    const names = [...docs.matchAll(/^\| `([A-Za-z]+Error)` \|/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    for (const n of names) expect(TYPES, n).toContain(`"${n}"`);
  });
});
