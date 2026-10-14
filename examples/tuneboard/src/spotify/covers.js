/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — small playlist covers for the card's panel
 *
 * The overlay draws only pictures handed to it whole, so a cover shown in
 * the panel must be downloaded and turned into a `data:` URL first. This
 * fetches thumbnails from Spotify's image hosts (never with the sign-in:
 * they are public), keeps only small PNG, JPEG, WebP or GIF pictures, and
 * remembers each answer, including a failure, so a cover is fetched at most
 * once per session. The memory is capped; the oldest entries go first.
 */
import { isCoverUrl } from "./playlists.js";

/** The largest thumbnail kept, in bytes (a panel row shows it at 26 pixels). */
export const MAX_COVER_BYTES = 24 * 1024;

/** How many covers are remembered at most. */
export const MAX_REMEMBERED = 200;

/** The picture types the overlay accepts, by Content-Type. */
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Base64 of bytes, without relying on Node's Buffer (tiles run in a worker).
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function base64Of(bytes) {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Creates the cover cache.
 *
 * @param {{ fetchFn: ((url: string, init?: object) => Promise<any>) | null }} deps
 *   Tilefold's network (null: no covers at all).
 * @returns {{ get: (url: string|null) => Promise<string|null>, peek: (url: string|null) => string|null|undefined }}
 */
export function createCovers({ fetchFn }) {
  /** @type {Map<string, Promise<string|null>>} */
  const pending = new Map();
  /** @type {Map<string, string|null>} */
  const known = new Map();

  /** Remembers an answer, forgetting the oldest beyond the cap. */
  const remember = (url, value) => {
    known.set(url, value);
    while (known.size > MAX_REMEMBERED) known.delete(known.keys().next().value);
  };

  /** Downloads one cover; null when it isn't a small picture. */
  const download = async (url) => {
    try {
      const response = await fetchFn(url, { method: "GET" });
      if (!response || !response.ok) return null;
      const type = String(response.headers?.["content-type"] ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!TYPES.includes(type)) return null;
      const bytes = await response.bytes();
      if (!(bytes instanceof Uint8Array) || bytes.length === 0) return null;
      if (bytes.length > MAX_COVER_BYTES) return null;
      return `data:${type};base64,${base64Of(bytes)}`;
    } catch {
      return null;
    }
  };

  return {
    /** The cover as a data URL, fetching it the first time; null when there is none. */
    get(url) {
      if (!fetchFn || !isCoverUrl(url)) return Promise.resolve(null);
      if (known.has(url)) return Promise.resolve(known.get(url) ?? null);
      if (!pending.has(url)) {
        pending.set(
          url,
          download(url).then((value) => {
            pending.delete(url);
            remember(url, value);
            return value;
          }),
        );
      }
      return /** @type {Promise<string|null>} */ (pending.get(url));
    },
    /** The cover if it is already known (undefined while not fetched yet). */
    peek(url) {
      if (!url || !known.has(url)) return undefined;
      return known.get(url);
    },
  };
}
