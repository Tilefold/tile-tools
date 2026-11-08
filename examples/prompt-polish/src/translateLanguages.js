/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the languages a prompt can be translated into
 *
 * Any language Claude or the user's agent can write, not only the twelve
 * Promptsmith checks prompts in. The user names each one as they like:
 *
 * - a language code, such as `vi`, `sw`, `pt-PT`, `zh-TW` or `es-419`
 *   (any case); it is kept in its standard form ("zh-TW");
 * - or its name, in English or in the language itself, such as
 *   "Vietnamese", "Tiếng Việt", "Traditional Chinese" or "Kiswahili".
 *
 * Names come from the JavaScript runtime's own list of languages
 * (`Intl.DisplayNames`), so a code it has no name for (`xx`) is not a
 * language. Without that list, only Promptsmith's twelve languages are
 * known. Used by the tile and by its page (which shows, as the user types,
 * what each entry was read as). Pure.
 */
import { LANGUAGES } from "./languages.js";

/** The longest entry read as one language, in characters. */
const MAX_WORD = 40;
/** What a language code looks like: a language, then a script or a region. */
const TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$/i;

/**
 * The languages looked up by name: the two-letter codes, a few common
 * three-letter ones, and the usual regional and script forms.
 */
const NAMED = (
  "aa ab af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy " +
  "da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr " +
  "ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv " +
  "kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no " +
  "nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn " +
  "so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo " +
  "wa wo xh yi yo za zh zu fil yue haw ceb hmn " +
  "zh-Hans zh-Hant zh-TW zh-HK pt-PT pt-BR es-419 en-GB en-US fr-CA sr-Latn"
).split(" ");

/** A runtime name list, or null where there is none. */
function displayNames(locale) {
  try {
    if (typeof Intl?.DisplayNames !== "function") return null;
    return new Intl.DisplayNames([locale], { type: "language", fallback: "none" });
  } catch {
    return null;
  }
}

const ENGLISH = displayNames("en");

/** The standard form of language code `tag`, or null when it isn't one. */
function canonical(tag) {
  if (!TAG.test(tag)) return null;
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The English name of the language with `code` ("Vietnamese"), or null
 * when the runtime knows none.
 *
 * @param {string} code
 */
export function englishName(code) {
  const own = LANGUAGES.find((l) => l.code === code);
  if (own) return own.name;
  try {
    return ENGLISH?.of(code) ?? null;
  } catch {
    return null;
  }
}

/**
 * The language's own name for itself ("Tiếng Việt"), else its English name,
 * else its code.
 *
 * @param {string} code
 */
export function nativeName(code) {
  const own = LANGUAGES.find((l) => l.code === code);
  if (own) return own.native;
  try {
    const name = displayNames(code)?.of(code);
    if (name) return name;
  } catch {
    // An odd code: fall back below.
  }
  return englishName(code) ?? code;
}

/** Each known name, lowercased, to its code; made on first use. */
let byName = null;
function names() {
  if (byName) return byName;
  byName = new Map();
  const add = (name, code) => {
    const key = String(name ?? "").toLocaleLowerCase();
    if (key && !byName.has(key)) byName.set(key, code);
  };
  for (const l of LANGUAGES) {
    add(l.name, l.code);
    add(l.native, l.code);
  }
  for (const code of NAMED) {
    const english = englishName(code);
    if (!english) continue;
    add(english, code);
    add(nativeName(code), code);
  }
  return byName;
}

/**
 * The code of the language `word` names (a code or a name, any case), or
 * null when it names none.
 *
 * @param {unknown} word
 */
export function languageCode(word) {
  const w = String(typeof word === "string" ? word : "").trim();
  if (!w || [...w].length > MAX_WORD) return null;
  const key = w.toLocaleLowerCase();
  // Promptsmith's own first, by code: "zh-cn" is its "zh-CN".
  const own = LANGUAGES.find((l) => l.code.toLowerCase() === key);
  if (own) return own.code;
  const named = names().get(key);
  if (named) return named;
  const code = canonical(w);
  return code && englishName(code) && englishName(code) !== code ? code : null;
}

/**
 * How a language is named to Claude and to the agent: "Vietnamese (vi)".
 *
 * @param {string} code
 */
export const askName = (code) => `${englishName(code) ?? code} (${code})`;

/**
 * How a language is shown to the user: its own name and its code,
 * "Tiếng Việt · vi".
 *
 * @param {string} code
 */
export const shownName = (code) => `${nativeName(code)} · ${code}`;
