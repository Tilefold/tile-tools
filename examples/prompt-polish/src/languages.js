/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the languages
 *
 * The languages a user can write prompts in: Tilefold's twelve. Each has
 * its English name (for the question to Claude) and its own name (for the
 * user, in the setting and on the page's chip). "auto" means the language
 * Tilefold itself is in. Pure: no Tilefold calls.
 */

/** The languages, in the order the setting lists them. */
export const LANGUAGES = [
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "pt-BR", name: "Brazilian Portuguese", native: "Português (Brasil)" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "zh-CN", name: "Simplified Chinese", native: "简体中文" },
];

/** Languages written without spaces between words: their size is in characters. */
const UNSPACED = new Set(["ja", "zh-CN"]);

/**
 * The language the user writes in: the setting's, or Tilefold's own for
 * "auto" (or anything unknown), or English when that is unknown too.
 *
 * @param {unknown} setting
 * @param {string} uiCode the language Tilefold is in (the tile's `page-lang`)
 */
export function languageOf(setting, uiCode) {
  const find = (code) => LANGUAGES.find((l) => l.code === code);
  return find(setting) ?? find(uiCode) ?? find("en");
}

/** Whether a language is sized in characters rather than words. */
export const isUnspaced = (code) => UNSPACED.has(code);
