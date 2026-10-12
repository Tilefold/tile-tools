/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Thin Spotify player client. HTTP is injected so this module can run in a
 * tile worker without browser network globals and can be tested offline.
 */
import { networkError, responseError } from "./errors.js";
import { createTokenManager } from "./tokens.js";

const PLAYER_URL = "https://api.spotify.com/v1/me/player";

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
      ? { name: data.device.name ?? "", volume: data.device.volume_percent ?? null }
      : null,
    shuffle: Boolean(data.shuffle_state),
    repeat: data.repeat_state ?? "off",
  };
}

export function createSpotify({
  fetchFn,
  clientId,
  refreshToken,
  now = Date.now,
  onRefreshToken,
} = {}) {
  const tokens = createTokenManager({ fetchFn, clientId, refreshToken, now, onRefreshToken });

  async function request(path = "", { method = "GET", query, body } = {}) {
    const url = new URL(PLAYER_URL + path);
    if (query)
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    let token = await tokens.getAccessToken();
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = { Authorization: `Bearer ${token}` };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      let response;
      try {
        response = await fetchFn(url.toString(), {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (cause) {
        throw networkError(cause);
      }
      if (response.status === 401 && attempt === 0) {
        tokens.invalidateAccessToken(token);
        token = await tokens.getAccessToken();
        continue;
      }
      if (!response.ok) throw await responseError(response, { now });
      if (response.status === 204) return null;
      if (method === "GET") return response.json();
      return undefined;
    }
  }

  const nonnegativeMs = (value) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError("Position must be a nonnegative integer in milliseconds");
    return value;
  };

  return {
    async getPlayback() {
      const data = await request();
      return data === null ? null : playbackModel(data);
    },
    play: () => request("/play", { method: "PUT" }),
    pause: () => request("/pause", { method: "PUT" }),
    next: () => request("/next", { method: "POST" }),
    previous: () => request("/previous", { method: "POST" }),
    setVolume(volume) {
      if (!Number.isInteger(volume) || volume < 0 || volume > 100)
        throw new RangeError("Volume must be an integer from 0 to 100");
      return request("/volume", { method: "PUT", query: { volume_percent: volume } });
    },
    seek(ms) {
      return request("/seek", { method: "PUT", query: { position_ms: nonnegativeMs(ms) } });
    },
    setShuffle(enabled) {
      if (typeof enabled !== "boolean") throw new TypeError("Shuffle must be a boolean");
      return request("/shuffle", { method: "PUT", query: { state: enabled } });
    },
  };
}
