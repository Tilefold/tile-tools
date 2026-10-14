/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Thin Spotify player client. Every request goes through the network
 * function it is given (Tilefold's `tf.net.fetch` in the tile) and names
 * the `spotify` sign-in, so Tilefold adds the user's token itself: the
 * client never sees, stores or refreshes a token. A 401 means the user has
 * to sign in again. HTTP is injected, so it is tested offline.
 * `transfer` moves playback to a device, and `playOn` starts playing on
 * one, such as the player Tuneboard's own page starts inside Tilefold.
 * `playlists` reads the user's playlists a page at a time, and
 * `playContext` plays one of them.
 */
import { hostError, networkError, responseError } from "./errors.js";
import { PAGE_SIZE, isPlaylistUri, playlistPage } from "./playlists.js";

const API_URL = "https://api.spotify.com/v1";

/** The player endpoints, under API_URL. */
const PLAYER = "/me/player";

/** The sign-in the tile declares in tile.json (`auth.spotify`). */
export const AUTH_NAME = "spotify";

function playbackModel(data) {
  const item = data.item;
  return {
    isPlaying: Boolean(data.is_playing),
    track: item
      ? {
          title: item.name ?? "",
          artists: Array.isArray(item.artists)
            ? item.artists.map((artist) => artist.name).filter(Boolean)
            : [],
          album: item.album?.name ?? "",
          durationMs: item.duration_ms ?? 0,
        }
      : null,
    progressMs: data.progress_ms ?? 0,
    device: data.device
      ? {
          id: data.device.id ?? "",
          name: data.device.name ?? "",
          volume: data.device.volume_percent ?? null,
        }
      : null,
    shuffle: Boolean(data.shuffle_state),
    repeat: data.repeat_state ?? "off",
  };
}

/**
 * Creates the client.
 *
 * @param {{ fetchFn: (url: string, init?: object) => Promise<any>, now?: () => number }} o
 *   `fetchFn` takes `{ method, headers, body, auth }` and resolves to a
 *   response with `ok`, `status`, `headers` and `json()`.
 */
export function createSpotify({ fetchFn, now = Date.now } = {}) {
  if (typeof fetchFn !== "function") throw new TypeError("fetchFn is required");

  async function request(path, { method = "GET", query, body } = {}) {
    const url = new URL(API_URL + path);
    if (query)
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    const init = { method, auth: AUTH_NAME };
    if (body !== undefined) {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetchFn(url.toString(), init);
    } catch (cause) {
      throw hostError(cause) ?? networkError(cause);
    }
    if (!response.ok) throw await responseError(response, { now });
    if (response.status === 204) return null;
    if (method === "GET") return response.json();
    return undefined;
  }

  /** A player request (path under /me/player). */
  const player = (path = "", init) => request(PLAYER + path, init);

  /** Checks a device id ("" or undefined: the active device). */
  const deviceQuery = (deviceId) => {
    if (deviceId === undefined) return undefined;
    if (typeof deviceId !== "string" || !deviceId) throw new TypeError("A device id is required");
    return { device_id: deviceId };
  };

  const nonnegativeMs = (value) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError("Position must be a nonnegative integer in milliseconds");
    return value;
  };

  return {
    async getPlayback() {
      const data = await player();
      return data === null ? null : playbackModel(data);
    },
    play: () => player("/play", { method: "PUT" }),
    pause: () => player("/pause", { method: "PUT" }),
    next: () => player("/next", { method: "POST" }),
    previous: () => player("/previous", { method: "POST" }),
    setVolume(volume) {
      if (!Number.isInteger(volume) || volume < 0 || volume > 100)
        throw new RangeError("Volume must be an integer from 0 to 100");
      return player("/volume", { method: "PUT", query: { volume_percent: volume } });
    },
    seek(ms) {
      return player("/seek", { method: "PUT", query: { position_ms: nonnegativeMs(ms) } });
    },
    transfer(deviceId, play = true) {
      if (typeof deviceId !== "string" || !deviceId) throw new TypeError("A device id is required");
      return player("", { method: "PUT", body: { device_ids: [deviceId], play: Boolean(play) } });
    },
    /** Starts playing on a device (it becomes the active one); resumes what was last played. */
    playOn(deviceId) {
      return player("/play", { method: "PUT", query: deviceQuery(deviceId) });
    },
    /** Plays a playlist on a device, or on the active device when none is given. */
    playContext(uri, deviceId) {
      if (!isPlaylistUri(uri)) throw new TypeError("A Spotify playlist URI is required");
      return player("/play", {
        method: "PUT",
        query: deviceQuery(deviceId),
        body: { context_uri: uri },
      });
    },
    /** One page of the user's playlists, from `offset`. */
    async playlists(offset = 0) {
      if (!Number.isSafeInteger(offset) || offset < 0)
        throw new RangeError("Offset must be a nonnegative integer");
      const data = await request("/me/playlists", { query: { limit: PAGE_SIZE, offset } });
      return playlistPage(data ?? {}, offset);
    },
    setShuffle(enabled) {
      if (typeof enabled !== "boolean") throw new TypeError("Shuffle must be a boolean");
      return player("/shuffle", { method: "PUT", query: { state: enabled } });
    },
  };
}
