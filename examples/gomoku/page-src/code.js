/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — game codes
 *
 * The relay names each room with six characters from an alphabet without
 * look-alikes (no 0/O, 1/I/L, 5/S, 2/Z, 8/B), so a code read aloud or
 * typed from a chat message comes out right. Players see it as two groups
 * of three ("K7P-4QX"); what they type back is cleaned up the same way:
 * case, spaces and dashes don't matter.
 */

/** The characters a code is made of. */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

/** Characters in a code. */
export const CODE_LENGTH = 6;

/** A code as the relay knows it ("K7P4QX"), from what a player typed; null when it can't be one. */
export function parseCode(text) {
  if (typeof text !== "string") return null;
  const code = text.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** A code as players see it: "K7P-4QX". */
export const showCode = (code) => `${code.slice(0, 3)}-${code.slice(3)}`;
