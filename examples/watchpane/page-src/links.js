/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — reading YouTube links
 *
 * Turns what the user pastes into a video to play: the 11-character video
 * id and, when the link has one, the second to start at. It understands
 * the usual shapes of a YouTube link (watch pages, youtu.be, Shorts, live,
 * embed and the mobile and music sites) and a bare video id. Anything
 * else is refused with null, so nothing the user pastes reaches the player
 * unchecked.
 *
 * Used by both the page (the paste box) and the tile (the recent list,
 * which it checks before trusting what the page sends), so it has no
 * imports and no browser-only code.
 */

/** A YouTube video id: 11 characters from the URL-safe base64 alphabet. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Hosts whose links are read; anything else is not a YouTube link. */
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);

/** Path prefixes that are followed by the video id. */
const ID_PATHS = ["shorts", "live", "embed", "v", "e"];

/** Longest start time accepted, in seconds (a day; longer is a typo). */
const MAX_START = 24 * 60 * 60;

/**
 * Whether `id` is a well-formed YouTube video id.
 *
 * @param {unknown} id
 * @returns {id is string}
 */
export function isVideoId(id) {
  return typeof id === "string" && VIDEO_ID.test(id);
}

/**
 * Reads a start time: plain seconds ("90", "90s") or "1h2m3s" pieces.
 * Returns 0 when there is none or it can't be read.
 *
 * @param {string | null} value
 * @returns {number}
 */
export function parseStart(value) {
  if (!value) return 0;
  const text = value.trim().toLowerCase();
  let seconds = 0;
  if (/^\d+s?$/.test(text)) {
    seconds = Number.parseInt(text, 10);
  } else {
    const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
    if (!parts || !parts[0]) return 0;
    seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  }
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= MAX_START ? seconds : 0;
}

/**
 * The video a pasted link (or bare id) points to, or null.
 *
 * @param {unknown} input What the user pasted.
 * @returns {{ id: string, start: number } | null}
 */
export function parseVideoLink(input) {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!text || text.length > 2048) return null;
  if (isVideoId(text)) return { id: text, start: 0 };

  let url;
  try {
    // Links pasted without a scheme ("youtu.be/…") are read as https.
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  let id = null;
  if (host === "youtu.be") {
    id = segments[0] ?? null;
  } else if (segments[0] === "watch") {
    id = url.searchParams.get("v");
  } else if (ID_PATHS.includes(segments[0] ?? "")) {
    id = segments[1] ?? null;
  }
  if (!isVideoId(id)) return null;
  return { id, start: parseStart(url.searchParams.get("t") ?? url.searchParams.get("start")) };
}
