/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 */
import { describe, expect, it, vi } from "vitest";
import { createTokenManager } from "../../../examples/tuneboard/src/spotify/index.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("token manager", () => {
  it("posts a form and caches until 60 seconds before expiry", async () => {
    let time = 1_000;
    const requests = [];
    const manager = createTokenManager({
      clientId: "client",
      refreshToken: "refresh",
      now: () => time,
      fetchFn: async (url, init) => {
        requests.push({ url, init });
        return json({ access_token: `access-${requests.length}`, expires_in: 120 });
      },
    });
    expect(await manager.getAccessToken()).toBe("access-1");
    expect(requests[0].url).toBe("https://accounts.spotify.com/api/token");
    expect(requests[0].init.method).toBe("POST");
    expect(requests[0].init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(requests[0].init.body))).toEqual({
      grant_type: "refresh_token",
      refresh_token: "refresh",
      client_id: "client",
    });
    time += 59_999;
    expect(await manager.getAccessToken()).toBe("access-1");
    time += 1;
    expect(await manager.getAccessToken()).toBe("access-2");
    expect(requests).toHaveLength(2);
  });

  it("stores a rotated refresh token and reports it to the caller", async () => {
    const onRefreshToken = vi.fn();
    const bodies = [];
    const manager = createTokenManager({
      clientId: "client",
      refreshToken: "original",
      onRefreshToken,
      fetchFn: async (_url, init) => {
        bodies.push(new URLSearchParams(init.body));
        return json(
          bodies.length === 1
            ? { access_token: "a", expires_in: 3600, refresh_token: "rotated" }
            : { access_token: "b", expires_in: 3600 },
        );
      },
    });
    await manager.getAccessToken();
    manager.invalidateAccessToken("a");
    await manager.getAccessToken();
    expect(onRefreshToken).toHaveBeenCalledExactlyOnceWith("rotated");
    expect(manager.getRefreshToken()).toBe("rotated");
    expect(bodies.map((body) => body.get("refresh_token"))).toEqual(["original", "rotated"]);
  });

  it("shares a single in-flight refresh among concurrent callers", async () => {
    let resolveResponse;
    const fetchFn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const manager = createTokenManager({ fetchFn, clientId: "client", refreshToken: "refresh" });
    const pending = Promise.all(Array.from({ length: 8 }, () => manager.getAccessToken()));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    resolveResponse(json({ access_token: "one", expires_in: 3600 }));
    expect(await pending).toEqual(Array(8).fill("one"));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("never reads the global fetch", async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error("global fetch used");
    };
    try {
      const manager = createTokenManager({
        clientId: "client",
        refreshToken: "refresh",
        fetchFn: async () => json({ access_token: "a", expires_in: 3600 }),
      });
      expect(await manager.getAccessToken()).toBe("a");
    } finally {
      globalThis.fetch = previous;
    }
  });
});
