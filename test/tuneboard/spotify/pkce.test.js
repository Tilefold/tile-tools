/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 */
import { describe, expect, it } from "vitest";
import {
  buildAuthorizeUrl,
  createCodeChallenge,
  createCodeVerifier,
  SPOTIFY_SCOPES,
} from "../../../examples/tuneboard/src/spotify/index.js";

describe("PKCE", () => {
  it("matches the published SHA-256 challenge vector", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(await createCodeChallenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates a 43-character URL-safe verifier from secure bytes", () => {
    const fakeCrypto = { getRandomValues: (bytes) => bytes.fill(255) };
    expect(createCodeVerifier(fakeCrypto)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createCodeVerifier(fakeCrypto)).toBe("_".repeat(42) + "8");
  });

  it("builds the authorization URL with the requested scopes and S256", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "client id",
        redirectUri: "http://127.0.0.1:8888/callback?a=b",
        codeChallenge: "challenge",
        state: "nonce",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "client id",
      redirect_uri: "http://127.0.0.1:8888/callback?a=b",
      scope: SPOTIFY_SCOPES.join(" "),
      code_challenge_method: "S256",
      code_challenge: "challenge",
      state: "nonce",
    });
  });
});
