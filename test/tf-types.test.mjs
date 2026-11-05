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
 * Modified 2026-10-30 (Tilefold 0.1.23): `tf.annotate` and `annotate.cleared`.
 * Modified 2026-11-05 (Tilefold 0.1.26): the events are read from the API
 *   reference's event table, names and payloads both, so a new one can't be
 *   left out (`viewer.opened`).
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
      "readonly annotate?:",
      "type AnnotationTarget",
      "interface ScreensaverFrame",
      "interface TilePageBridge",
    ];
    for (const m of members) expect(TYPES, m).toContain(m);
  });

  it("lists every event and error name", () => {
    // Every event in the API reference's event table, from app.ready on.
    const api = readFileSync(new URL("../docs/tf-api.md", import.meta.url), "utf8");
    const table = api.slice(api.indexOf("| `app.ready` |")).split("\n\n")[0];
    const events = [...table.matchAll(/^\| `([a-z]+\.[a-z]+)` \|/gm)].map((m) => m[1]);
    expect(events.length).toBeGreaterThan(20);
    expect(events).toContain("viewer.opened");
    for (const e of events) {
      // In the list of names, and with its payload in the event map.
      expect(TYPES, e).toContain(`| "${e}"`);
      expect(TYPES, e).toContain(`"${e}":`);
    }
    const docs = readFileSync(new URL("../docs/limits-and-errors.md", import.meta.url), "utf8");
    const names = [...docs.matchAll(/^\| `([A-Za-z]+Error)` \|/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    for (const n of names) expect(TYPES, n).toContain(`"${n}"`);
  });
});
