/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree's window — row styles (tests)
 *
 * A row is a draggable button, and WebKit let the text inside a draggable
 * element be selected: over a file's name the cursor became a text cursor
 * and a press started a selection instead of a click. The rows' text is
 * not selectable and takes the row's cursor; the rename field, typed in
 * inside a row, stays selectable with a text cursor.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";

const PAGE = fileURLToPath(new NodeURL("../../examples/folder-tree/page/", import.meta.url));
const css = (name) => readFileSync(`${PAGE}${name}`, "utf8");

/** The declarations of the rule whose selector is exactly `selector`. */
function rule(text, selector) {
  const plain = text.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of plain.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.join(", ") === selector) return m[2];
  }
  return null;
}

describe("Folder Tree window rows", () => {
  it("can't have their text selected, name included", () => {
    const body = rule(css("tree.css"), ".row, .row *");
    expect(body).toMatch(/(^|;)\s*user-select:\s*none/);
    expect(body).toMatch(/-webkit-user-select:\s*none/);
  });

  it("show the row's cursor over everything in them", () => {
    expect(rule(css("tree.css"), ".row *")).toMatch(/cursor:\s*inherit/);
    expect(rule(css("tree.css"), ".row")).toMatch(/cursor:\s*pointer/);
  });

  it("keep the rename field selectable, with a text cursor", () => {
    const body = rule(css("tools.css"), ".rename");
    expect(body).toMatch(/(^|;)\s*user-select:\s*text/);
    expect(body).toMatch(/-webkit-user-select:\s*text/);
    expect(body).toMatch(/cursor:\s*text/);
  });
});
