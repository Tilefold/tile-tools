/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Small, stable error vocabulary for the tile UI. Spotify's error bodies
 * vary between endpoints, so the status is also considered. Errors thrown
 * by Tilefold itself (its sign-in, network rules and limits) are mapped by
 * their `name`.
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

/** Tilefold's own errors, by name, and the code each means for the card. */
const HOST_CODES = {
  CredentialMissingError: "auth",
  // The user hasn't allowed Spotify's host, or Tilefold refused the request:
  // nothing reached Spotify, so this is not a Spotify failure.
  PermissionDeniedError: "denied",
  NetworkPolicyError: "denied",
  RateLimitError: "rate-limit",
  TimeoutError: "network",
  NetworkError: "network",
  TooLargeError: "server",
};

/**
 * A Spotify error for an error Tilefold threw, or null when it isn't one.
 *
 * @param {any} err
 * @returns {SpotifyError|null}
 */
export function hostError(err) {
  const code = err && typeof err.name === "string" ? HOST_CODES[err.name] : undefined;
  if (!code) return null;
  return new SpotifyError(code, String(err.message || err.name), { cause: err });
}

/** A header from a Headers object or a plain object of lowercase names. */
function header(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name) ?? undefined;
  return headers[name.toLowerCase()];
}

function retryAfterMs(value, now) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now()) : undefined;
}

export async function responseError(response, { now = Date.now } = {}) {
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
  if (status === 401) code = "auth";
  else if (status === 403 && reason === "PREMIUM_REQUIRED") code = "premium";
  else if (status === 404 && reason === "NO_ACTIVE_DEVICE") code = "no-device";
  else if (status === 429) code = "rate-limit";
  else if (status >= 500) code = "server";
  return new SpotifyError(code, message, {
    status,
    retryAfterMs:
      code === "rate-limit"
        ? retryAfterMs(header(response.headers, "Retry-After"), now)
        : undefined,
  });
}
