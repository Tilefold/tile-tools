/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the user's playlists, as plain data
 *
 * Turns Spotify's answer to "my playlists" into the small, safe shape the
 * Library page shows: the playlist's URI (to play it), its name, its
 * owner's name, how many tracks it has, one cover image and, when Spotify
 * offers one, a small thumbnail for the card's panel. Covers are kept
 * only when they come over https from Spotify's image hosts, the ones the
 * tile is allowed (`net:*.scdn.co`, `net:*.spotifycdn.com`); the page could
 * not load any other. Entries Spotify leaves empty are skipped, and text is
 * trimmed to a sane length, so a strange answer can't break the page.
 */

/** How many playlists to ask for at a time (Spotify's maximum). */
export const PAGE_SIZE = 50;

/** Longest name or owner kept, in characters. */
export const MAX_TEXT = 200;

/** The width a cover should have at least, in pixels, when there is a choice. */
export const COVER_WIDTH = 160;

/** The widest picture used as a panel thumbnail, in pixels. */
export const THUMB_WIDTH = 160;

/** Spotify's image hosts (and their subdomains) the page may load covers from. */
const IMAGE_DOMAINS = ["scdn.co", "spotifycdn.com"];

/** Whether `uri` is a Spotify playlist URI, such as `spotify:playlist:37i9dQZF1DX`. */
export function isPlaylistUri(uri) {
  return typeof uri === "string" && /^spotify:playlist:[A-Za-z0-9]{1,64}$/.test(uri);
}

/** Whether `url` is an https address on one of Spotify's image hosts. */
export function isCoverUrl(url) {
  if (typeof url !== "string") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.port || parsed.username) return false;
  return IMAGE_DOMAINS.some((d) => parsed.hostname.endsWith(`.${d}`));
}

/**
 * Picks one cover from Spotify's list: the smallest that is at least
 * COVER_WIDTH wide, or else the largest there is; null when none is usable.
 *
 * @param {unknown} images
 * @returns {string|null}
 */
export function pickCover(images) {
  if (!Array.isArray(images)) return null;
  const usable = images.filter((i) => i && isCoverUrl(i.url));
  if (usable.length === 0) return null;
  const width = (i) => (Number.isFinite(i.width) ? i.width : 0);
  const bigEnough = usable.filter((i) => width(i) >= COVER_WIDTH);
  const pool = bigEnough.length ? bigEnough : usable;
  const best = pool.reduce((a, b) =>
    bigEnough.length ? (width(b) < width(a) ? b : a) : width(b) > width(a) ? b : a,
  );
  return best.url;
}

/**
 * The smallest cover whose width Spotify gives and is at most THUMB_WIDTH,
 * for the card's panel (a large one would be too heavy to draw there);
 * null when there is none.
 *
 * @param {unknown} images
 * @returns {string|null}
 */
export function pickThumb(images) {
  if (!Array.isArray(images)) return null;
  const small = images.filter(
    (i) => i && isCoverUrl(i.url) && Number.isFinite(i.width) && i.width <= THUMB_WIDTH,
  );
  if (small.length === 0) return null;
  return small.reduce((a, b) => (b.width < a.width ? b : a)).url;
}

/** Plain text, trimmed to MAX_TEXT characters ("" when not text). */
const text = (value) => (typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "");

/**
 * One playlist for the page, or null when Spotify's entry is unusable.
 *
 * @param {any} p A playlist object from Spotify.
 * @returns {{ uri: string, name: string, owner: string, tracks: number|null,
 *            cover: string|null, thumb: string|null }|null}
 */
export function playlistModel(p) {
  if (!p || typeof p !== "object" || !isPlaylistUri(p.uri)) return null;
  // Spotify has called the track count `tracks.total`; newer answers may say `items.total`.
  const total = p.tracks?.total ?? p.items?.total;
  return {
    uri: p.uri,
    name: text(p.name),
    owner: text(p.owner?.display_name ?? p.owner?.id),
    tracks: Number.isSafeInteger(total) && total >= 0 ? total : null,
    cover: pickCover(p.images),
    thumb: pickThumb(p.images),
  };
}

/**
 * One page of playlists for the page.
 *
 * @param {any} data Spotify's answer to GET /me/playlists.
 * @param {number} offset Where this page starts.
 * @returns {{ items: NonNullable<ReturnType<typeof playlistModel>>[], total: number, nextOffset: number|null }}
 */
export function playlistPage(data, offset) {
  const raw = Array.isArray(data?.items) ? data.items : [];
  const items = raw.map(playlistModel).filter((p) => p !== null);
  const total = Number.isSafeInteger(data?.total) && data.total >= 0 ? data.total : items.length;
  const after = offset + raw.length;
  return { items, total, nextOffset: data?.next && raw.length > 0 && after < total ? after : null };
}
