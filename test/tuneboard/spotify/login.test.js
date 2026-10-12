/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createAuthorization,
  exchangeCode,
  parseCallback,
  parseClientId,
  REDIRECT_URI,
  runLogin,
  waitForCode,
} from "../../../examples/tuneboard/scripts/spotify-login.mjs";

describe("Node sign-in helper", () => {
  it("accepts a client id and rejects a missing value", () => {
    expect(parseClientId(["--client-id", "my-client"])).toBe("my-client");
    expect(() => parseClientId([])).toThrow("Usage:");
    expect(() => parseClientId(["--client-id"])).toThrow("Usage:");
  });

  it("reuses PKCE and binds the state and exact loopback redirect", async () => {
    const auth = await createAuthorization("my-client");
    const url = new URL(auth.url);
    expect(url.searchParams.get("client_id")).toBe("my-client");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(auth.state);
    expect(auth.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(auth.state).toHaveLength(32);
  });

  it("accepts only callbacks with the expected state", () => {
    expect(parseCallback("/other", "nonce")).toBeNull();
    expect(parseCallback("/callback?state=nonce&code=abc", "nonce")).toBe("abc");
    expect(() => parseCallback("/callback?state=wrong&code=abc", "nonce")).toThrow("state");
    expect(() => parseCallback("/callback?state=nonce&error=access_denied", "nonce")).toThrow(
      "access_denied",
    );
    expect(() => parseCallback("/callback?state=nonce", "nonce")).toThrow("code");
  });

  it("binds only to loopback and finishes when the user denies authorization", async () => {
    let onRequest;
    const listen = vi.fn((port, host, ready) => ready());
    const server = {
      once: vi.fn(),
      listen,
      close: vi.fn(),
    };
    const { code } = await waitForCode("nonce", {
      serverFactory: (callback) => {
        onRequest = callback;
        return server;
      },
    });
    expect(listen).toHaveBeenCalledWith(8888, "127.0.0.1", expect.any(Function));
    const response = { writeHead: vi.fn(), end: vi.fn() };
    onRequest({ url: "/callback?state=wrong&code=abc" }, response);
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    onRequest({ url: "/callback?state=nonce&error=access_denied" }, response);
    await expect(code).rejects.toThrow("access_denied");
  });

  it("exchanges the authorization code with a fake fetch", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ refresh_token: "new-refresh" }), { status: 200 }),
    );
    expect(
      await exchangeCode({ clientId: "client", code: "code", verifier: "verifier", fetchFn }),
    ).toBe("new-refresh");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://accounts.spotify.com/api/token");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
      grant_type: "authorization_code",
      code: "code",
      redirect_uri: REDIRECT_URI,
      client_id: "client",
      code_verifier: "verifier",
    });
  });

  it("rejects a failed exchange or a response without a refresh token", async () => {
    const input = { clientId: "client", code: "code", verifier: "verifier" };
    await expect(
      exchangeCode({
        ...input,
        fetchFn: async () =>
          new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
      }),
    ).rejects.toThrow("invalid_grant");
    await expect(
      exchangeCode({
        ...input,
        fetchFn: async () =>
          new Response(JSON.stringify({ access_token: "only-access" }), { status: 200 }),
      }),
    ).rejects.toThrow("refresh token");
  });

  it("prints the authorize URL and refresh token once, then closes", async () => {
    const lines = [];
    const close = vi.fn();
    await runLogin({
      clientId: "client",
      fetchFn: async () =>
        new Response(JSON.stringify({ refresh_token: "secret-refresh" }), { status: 200 }),
      log: (line) => lines.push(line),
      wait: async () => ({ server: { close }, code: Promise.resolve("the-code") }),
    });
    expect(lines.filter((line) => line === "secret-refresh")).toHaveLength(1);
    expect(lines.some((line) => line.startsWith("https://accounts.spotify.com/authorize?"))).toBe(
      true,
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
