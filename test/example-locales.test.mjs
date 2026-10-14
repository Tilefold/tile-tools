// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Example translations — tests
 *
 * The network, key, AI and arcade examples ship in all twelve of Tilefold's
 * languages. Each translation has exactly the English message keys, keeps
 * every message's `{ $variables }`, uses only simple `key = text` lines,
 * and keeps the names that must not be translated (GitHub, Claude,
 * Tilefold, the host names the tile reaches, and the `tf.` calls).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Tilefold's languages. */
const LOCALES = ["ar", "de", "en", "es", "fr", "hi", "it", "ja", "ko", "pt-BR", "ru", "zh-CN"];

/** The examples checked here. */
const EXAMPLES = [
  "brickfold",
  "girder-jump",
  "github-inbox",
  "orbit-guard",
  "pipeline-board",
  "service-status",
  "shell-tips",
  "watchpane",
  "weather-card",
];

/** Words that stay as they are in every language, when the English message has them. */
const KEPT = [
  "GitHub",
  "Claude",
  "Tilefold",
  "Anthropic",
  "www.githubstatus.com",
  "api.github.com",
  "tf.net.fetch",
  "tf.ai.ask",
  "Open-Meteo",
  "GitLab",
  "Orbit Guard",
  "Brickfold",
  "Girder Jump",
  "YouTube",
  "Watchpane",
];

/** The messages of one locale, checking every line on the way. */
function messages(example, locale) {
  const source = readFileSync(
    new URL(`../examples/${example}/locales/${locale}/tile.ftl`, import.meta.url),
    "utf8",
  );
  const result = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const match = /^([a-z][a-z0-9-]*) = (\S.*)$/.exec(line);
    expect(match, `${example}/${locale}: unexpected line ${line}`).not.toBeNull();
    const [, key, value] = match;
    expect(result.has(key), `${example}/${locale}: duplicate key ${key}`).toBe(false);
    result.set(key, value);
  }
  return result;
}

/** The `{ $variables }` of a message, sorted. */
const variables = (message) =>
  [...message.matchAll(/\{\s*\$([a-z][a-z0-9-]*)\s*\}/g)].map((m) => m[1]).sort();

describe.each(EXAMPLES)("%s", (example) => {
  const english = messages(example, "en");

  describe.each(LOCALES.filter((l) => l !== "en"))("%s", (locale) => {
    const translated = messages(example, locale);

    it("has exactly the English message keys", () => {
      expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
    });

    it("keeps each message's variables and the names that are never translated", () => {
      for (const [key, value] of english) {
        const other = translated.get(key);
        expect(variables(other), `${locale}: ${key}`).toEqual(variables(value));
        for (const word of KEPT) {
          if (value.includes(word)) expect(other, `${locale}: ${key}`).toContain(word);
        }
      }
    });
  });
});
