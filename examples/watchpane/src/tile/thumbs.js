/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — video pictures for the card
 *
 * Fetches a video's picture from YouTube's image host (`net:i.ytimg.com`)
 * and turns it into a data URL the card can draw: the overlay takes no
 * web addresses. Each picture is fetched once (a second ask while the
 * first is under way waits for it) and the last few are remembered; one
 * that fails, or is too big, is remembered as none, and the card shows a
 * plain frame instead.
 */

/** The picture's address: 320 × 180, no letterbox bars. */
export const thumbUrl = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
/** Largest picture taken, in bytes. */
export const MAX_THUMB_BYTES = 48 * 1024;
/** Pictures remembered. */
const REMEMBERED = 20;
/** Types the card can draw. */
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Bytes as base64. */
export function base64Of(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** A picture cache over `fetchFn` (`tf.net.fetch`, or null without networking). */
export function createThumbs(fetchFn) {
  const known = new Map();
  const pending = new Map();

  const download = async (id) => {
    try {
      const response = await fetchFn(thumbUrl(id), { method: "GET" });
      if (!response?.ok) return null;
      const type = String(response.headers?.["content-type"] ?? "")
        .split(";")[0]
        .trim();
      if (!TYPES.includes(type)) return null;
      const bytes = await response.bytes();
      if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_THUMB_BYTES) {
        return null;
      }
      return `data:${type};base64,${base64Of(bytes)}`;
    } catch {
      return null;
    }
  };

  return {
    /** The picture for video `id` (a data URL), or null. */
    get(id) {
      if (!fetchFn || !/^[A-Za-z0-9_-]{11}$/.test(String(id))) return Promise.resolve(null);
      if (known.has(id)) return Promise.resolve(known.get(id));
      if (!pending.has(id)) {
        pending.set(
          id,
          download(id).then((value) => {
            pending.delete(id);
            known.set(id, value);
            while (known.size > REMEMBERED) known.delete(known.keys().next().value);
            return value;
          }),
        );
      }
      return pending.get(id);
    },
    /** The picture if it is already here (undefined while unknown). */
    peek: (id) => known.get(id),
  };
}
