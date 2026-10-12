/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * One-time Spotify sign-in helper. It runs in Node, outside the Tilefold
 * worker, and prints a refresh token for the user to paste into Settings.
 */
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAuthorizeUrl, createCodeChallenge, createCodeVerifier } from "../src/spotify/pkce.js";

export const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export function parseClientId(args) {
  const index = args.indexOf("--client-id");
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error("Usage: node scripts/spotify-login.mjs --client-id YOUR_SPOTIFY_CLIENT_ID");
  }
  return args[index + 1];
}

export async function createAuthorization(clientId, cryptoObj = globalThis.crypto) {
  if (!clientId) throw new TypeError("clientId is required");
  const verifier = createCodeVerifier(cryptoObj);
  const state = Buffer.from(cryptoObj.getRandomValues(new Uint8Array(24))).toString("base64url");
  const codeChallenge = await createCodeChallenge(verifier, cryptoObj);
  return {
    verifier,
    state,
    url: buildAuthorizeUrl({ clientId, redirectUri: REDIRECT_URI, codeChallenge, state }),
  };
}

export function parseCallback(requestUrl, expectedState) {
  const url = new URL(requestUrl, REDIRECT_URI);
  if (url.pathname !== "/callback") return null;
  if (!url.searchParams.get("state") || url.searchParams.get("state") !== expectedState) {
    throw new Error("Authorization state did not match; sign-in was rejected");
  }
  if (url.searchParams.has("error")) {
    const error = new Error(`Spotify authorization failed: ${url.searchParams.get("error")}`);
    error.code = "authorization-denied";
    throw error;
  }
  const code = url.searchParams.get("code");
  if (!code) throw new Error("Spotify did not return an authorization code");
  return code;
}

export async function exchangeCode({
  clientId,
  code,
  verifier,
  fetchFn,
  redirectUri = REDIRECT_URI,
}) {
  if (!clientId || !code || !verifier || typeof fetchFn !== "function") {
    throw new TypeError("clientId, code, verifier and fetchFn are required");
  }
  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }).toString(),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      `Spotify token exchange failed (${response.status}): ${data.error_description || data.error || "unknown error"}`,
    );
  if (typeof data.refresh_token !== "string" || !data.refresh_token) {
    throw new Error("Spotify did not return a refresh token");
  }
  return data.refresh_token;
}

export async function waitForCode(state, { port = 8888, serverFactory = createServer } = {}) {
  let settle;
  const code = new Promise((resolveCode, rejectCode) => {
    settle = { resolveCode, rejectCode };
  });
  const server = serverFactory((request, response) => {
    let result;
    try {
      result = parseCallback(request.url, state);
    } catch (error) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.message);
      // A bad state may be an unrelated request. A matching-state denial is final.
      if (error.code === "authorization-denied") settle.rejectCode(error);
      return;
    }
    if (result === null) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Signed in. Return to the terminal for your refresh token.");
    settle.resolveCode(result);
  });
  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once("error", rejectListen);
      server.listen(port, "127.0.0.1", resolveListen);
    });
  } catch (error) {
    server.close();
    throw error;
  }
  return { server, code };
}

export async function runLogin({
  clientId,
  fetchFn = globalThis.fetch,
  log = console.log,
  wait = waitForCode,
} = {}) {
  const { verifier, state, url } = await createAuthorization(clientId);
  const { server, code } = await wait(state);
  try {
    log("Open this URL in your browser to authorize Tuneboard:");
    log(url);
    const refreshToken = await exchangeCode({ clientId, code: await code, verifier, fetchFn });
    log("Paste this refresh token into Tuneboard's Refresh token setting (shown once):");
    log(refreshToken);
  } finally {
    server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLogin({ clientId: parseClientId(process.argv.slice(2)) }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
