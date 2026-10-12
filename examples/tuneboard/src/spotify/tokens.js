/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Access tokens live in memory. The tile persists a rotated refresh token
 * through the callback, while concurrent callers share one refresh request.
 */
import { networkError, responseError, SpotifyError } from "./errors.js";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

export function createTokenManager({
  fetchFn,
  clientId,
  refreshToken,
  now = Date.now,
  onRefreshToken,
} = {}) {
  if (typeof fetchFn !== "function") throw new TypeError("fetchFn is required");
  if (!clientId || !refreshToken) throw new TypeError("clientId and refreshToken are required");
  let currentRefreshToken = refreshToken;
  let accessToken;
  let expiresAt = 0;
  let inFlight;

  async function refresh() {
    if (inFlight) return inFlight;
    // Assign synchronously before any await, so all callers join this work.
    inFlight = (async () => {
      let response;
      try {
        response = await fetchFn(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: currentRefreshToken,
            client_id: clientId,
          }).toString(),
        });
      } catch (cause) {
        throw networkError(cause);
      }
      if (!response.ok) throw await responseError(response, { tokenEndpoint: true, now });
      let data;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (
        !data?.access_token ||
        !Number.isFinite(Number(data.expires_in)) ||
        Number(data.expires_in) <= 0
      ) {
        throw new SpotifyError("unknown", "Spotify returned an invalid token response");
      }
      if (data.refresh_token && data.refresh_token !== currentRefreshToken) {
        currentRefreshToken = data.refresh_token;
        onRefreshToken?.(currentRefreshToken);
      }
      accessToken = data.access_token;
      expiresAt = now() + Number(data.expires_in) * 1000;
      return accessToken;
    })();
    try {
      return await inFlight;
    } finally {
      inFlight = undefined;
    }
  }

  function getAccessToken() {
    if (accessToken && now() < expiresAt - 60_000) return Promise.resolve(accessToken);
    return refresh();
  }

  function invalidateAccessToken(staleToken) {
    // A late 401 for an old request must not invalidate a newer token.
    if (accessToken === staleToken) expiresAt = 0;
  }

  return {
    getAccessToken,
    invalidateAccessToken,
    refresh,
    getRefreshToken: () => currentRefreshToken,
  };
}
