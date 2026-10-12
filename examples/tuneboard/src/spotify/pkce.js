/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Spotify authorization helpers. The verifier stays with the caller until
 * the authorization code is exchanged; only its challenge goes in the URL.
 */

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
];

function base64url(bytes) {
  // Build in small chunks so a long input cannot exhaust call arguments.
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createCodeVerifier(cryptoObj = globalThis.crypto) {
  if (!cryptoObj?.getRandomValues) throw new TypeError("Secure randomness is required for PKCE");
  // 32 random bytes encode to 43 URL-safe characters, within PKCE's range.
  return base64url(cryptoObj.getRandomValues(new Uint8Array(32)));
}

export async function createCodeChallenge(verifier, cryptoObj = globalThis.crypto) {
  if (typeof verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    throw new TypeError("Invalid PKCE code verifier");
  }
  if (!cryptoObj?.subtle?.digest) throw new TypeError("SHA-256 is required for PKCE");
  const digest = await cryptoObj.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function buildAuthorizeUrl({ clientId, redirectUri, codeChallenge, state }) {
  if (!clientId || !redirectUri || !codeChallenge || !state) {
    throw new TypeError("clientId, redirectUri, codeChallenge and state are required");
  }
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
  }).toString();
  return url.toString();
}
