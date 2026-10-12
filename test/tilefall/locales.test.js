/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Locale consistency tests
 *
 * Checks that translations preserve every English key and Fluent variable.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LOCALES = ["ar", "de", "es", "fr", "hi", "it", "ja", "ko", "pt-BR", "ru", "zh-CN"];

/** Read the single-line messages used by this tile; reject duplicate keys. */
function messages(locale) {
  const source = readFileSync(
    new URL(`../../examples/tilefall/locales/${locale}/tile.ftl`, import.meta.url),
    "utf8",
  );
  const result = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const match = /^([a-z][a-z0-9-]*) = (.*)$/.exec(line);
    expect(match, `Unexpected Fluent line in ${locale}: ${line}`).not.toBeNull();
    const [, key, value] = match;
    expect(result.has(key), `Duplicate key ${key} in ${locale}`).toBe(false);
    result.set(key, value);
  }
  return result;
}

/** Compare variable names, including repeated uses of the same variable. */
function variables(message) {
  return [...message.matchAll(/\{\s*\$([a-z][a-z0-9-]*)\s*\}/g)].map((match) => match[1]).sort();
}

const english = messages("en");

describe.each(LOCALES)("%s translation", (locale) => {
  const translated = messages(locale);

  it("has exactly the English message keys", () => {
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("keeps the same variables in every message", () => {
    for (const [key, value] of english) {
      expect(variables(translated.get(key)), `${locale}: ${key}`).toEqual(variables(value));
    }
  });

  it("keeps Tilefall as the game name", () => {
    expect(translated.get("tile-name")).toBe("Tilefall");
  });
});
