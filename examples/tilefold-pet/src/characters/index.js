/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — characters
 *
 * The pets you can choose in Settings → Tiles → Tilefold Pet → Character. To
 * add one, write a file next to these that exports an object of the same
 * shape and list it below; give it a `setting-character-<id>` message in
 * every locales/<lang>/tile.ftl.
 *
 * A character is:
 *   id       stored as the setting's value; never change it once shipped
 *   label    the message key of its name in the Character list
 *   name     the name it answers to when the "name" setting is empty
 *   speed    walking pace in pixels per second at the default size (48)
 *   bubbles  message keys that replace the shared ones, e.g. { play: … }
 *   sounds   optional { bark(count) → WAV data URL }; only dogs bark
 *   poses()  { idle, blink, walk, happy, sleep, sit?, walkUp?, walkDown? }, each
 *            { image: data URL, sheet: { frames, fps } | null }; drawn once
 *            and kept
 */
import { poodle } from "./poodle.js";
import { terrier } from "./terrier.js";
import { tessa } from "./tessa.js";

/** Every character, in the order the list shows them. */
export const CHARACTERS = [tessa, poodle, terrier];

/** The character a new Tilefold Pet starts with. */
export const DEFAULT_CHARACTER = tessa.id;

const drawn = new Map();

/**
 * The character with this id; the default one for an unknown id.
 *
 * @param {unknown} id
 */
export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) ?? tessa;
}

/**
 * A character's poses, drawn on first use.
 *
 * @param {(typeof CHARACTERS)[number]} character
 */
export function posesOf(character) {
  if (!drawn.has(character.id)) drawn.set(character.id, character.poses());
  return drawn.get(character.id);
}
