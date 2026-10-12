/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Small, stable error vocabulary for the tile UI. Spotify's error bodies
 * vary between OAuth and player endpoints, so status is also considered.
 */

export class SpotifyError extends Error {
  constructor(code, message, { status, retryAfterMs, cause } = {}) {
    super(message, { cause });
    this.name = "SpotifyError";
    this.code = code;
    if (status !== undefined) this.status = status;
    if (retryAfterMs !== undefined) this.retryAfterMs = retryAfterMs;
  }
}

export function networkError(cause) {
  return new SpotifyError("network", "Could not reach Spotify", { cause });
}

function retryAfterMs(value, now) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now()) : undefined;
}

export async function responseError(response, { tokenEndpoint = false, now = Date.now } = {}) {
  // Some errors have no body. Reading failure must not hide the HTTP status.
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const detail = body?.error;
  const reason = typeof detail === "string" ? detail : detail?.reason;
  const message = body?.error_description || detail?.message || "Spotify request failed";
  const status = response.status;
  let code = "unknown";
  if (reason === "invalid_grant" || (tokenEndpoint && status === 400) || status === 401)
    code = "auth";
  else if (status === 403 && reason === "PREMIUM_REQUIRED") code = "premium";
  else if (status === 404 && reason === "NO_ACTIVE_DEVICE") code = "no-device";
  else if (status === 429) code = "rate-limit";
  else if (status >= 500) code = "server";
  return new SpotifyError(code, message, {
    status,
    retryAfterMs:
      code === "rate-limit" ? retryAfterMs(response.headers?.get?.("Retry-After"), now) : undefined,
  });
}
