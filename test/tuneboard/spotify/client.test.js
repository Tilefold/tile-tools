/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 */
import { describe, expect, it, vi } from "vitest";
import { createSpotify, SpotifyError } from "../../../examples/tuneboard/src/spotify/index.js";

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const noContent = () => new Response(null, { status: 204 });

function fakeClient(playerResponse = noContent()) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    return url.includes("accounts.spotify.com")
      ? json({ access_token: "access", expires_in: 3600 })
      : playerResponse;
  };
  return {
    spotify: createSpotify({ fetchFn, clientId: "client", refreshToken: "refresh" }),
    calls,
  };
}

describe("player client", () => {
  it("returns null for empty playback and maps a populated response", async () => {
    const empty = fakeClient();
    expect(await empty.spotify.getPlayback()).toBeNull();
    expect(empty.calls[1].url).toBe("https://api.spotify.com/v1/me/player");
    expect(empty.calls[1].init.headers.Authorization).toBe("Bearer access");

    const full = fakeClient(
      json({
        is_playing: true,
        item: {
          name: "Song",
          artists: [{ name: "A" }, { name: "B" }],
          album: { name: "Record" },
          duration_ms: 123000,
        },
        progress_ms: 5000,
        device: { name: "Desk", volume_percent: 42 },
        shuffle_state: true,
        repeat_state: "context",
      }),
    );
    expect(await full.spotify.getPlayback()).toEqual({
      isPlaying: true,
      track: { title: "Song", artists: ["A", "B"], album: "Record", durationMs: 123000 },
      progressMs: 5000,
      device: { name: "Desk", volume: 42 },
      shuffle: true,
      repeat: "context",
    });
  });

  it.each([
    ["getPlayback", [], "GET", "", ""],
    ["play", [], "PUT", "/play", ""],
    ["pause", [], "PUT", "/pause", ""],
    ["next", [], "POST", "/next", ""],
    ["previous", [], "POST", "/previous", ""],
    ["setVolume", [37], "PUT", "/volume", "volume_percent=37"],
    ["seek", [12345], "PUT", "/seek", "position_ms=12345"],
    ["setShuffle", [true], "PUT", "/shuffle", "state=true"],
  ])("%s sends %s %s with Bearer auth", async (name, args, method, path, query) => {
    const { spotify, calls } = fakeClient();
    await spotify[name](...args);
    const request = calls[1];
    expect(request.url).toBe(
      `https://api.spotify.com/v1/me/player${path}${query ? `?${query}` : ""}`,
    );
    expect(request.init).toEqual({ method, headers: { Authorization: "Bearer access" } });
  });

  it("validates values before sending a request", () => {
    const { spotify, calls } = fakeClient();
    expect(() => spotify.setVolume(-1)).toThrow(RangeError);
    expect(() => spotify.setVolume(101)).toThrow(RangeError);
    expect(() => spotify.seek(-1)).toThrow(RangeError);
    expect(() => spotify.setShuffle("true")).toThrow(TypeError);
    expect(calls).toHaveLength(0);
  });

  it("refreshes once and retries a 401 with the new token", async () => {
    const calls = [];
    let tokenNumber = 0;
    const spotify = createSpotify({
      clientId: "client",
      refreshToken: "refresh",
      fetchFn: async (url, init) => {
        calls.push({ url, init });
        if (url.includes("accounts.spotify.com"))
          return json({ access_token: `access-${++tokenNumber}`, expires_in: 3600 });
        return calls.filter((call) => call.url.includes("api.spotify.com")).length === 1
          ? json({ error: { message: "expired" } }, 401)
          : noContent();
      },
    });
    await spotify.pause();
    expect(calls.map(({ url }) => new URL(url).hostname)).toEqual([
      "accounts.spotify.com",
      "api.spotify.com",
      "accounts.spotify.com",
      "api.spotify.com",
    ]);
    expect(calls[1].init.headers.Authorization).toBe("Bearer access-1");
    expect(calls[3].init.headers.Authorization).toBe("Bearer access-2");
  });

  it("stops after a second 401", async () => {
    const fetchFn = vi.fn(async (url) =>
      url.includes("accounts.spotify.com")
        ? json({ access_token: "access", expires_in: 3600 })
        : json({ error: { message: "expired" } }, 401),
    );
    const spotify = createSpotify({ fetchFn, clientId: "client", refreshToken: "refresh" });
    await expect(spotify.play()).rejects.toMatchObject({ code: "auth", status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });
});

describe("error mapping", () => {
  it.each([
    [403, { error: { reason: "PREMIUM_REQUIRED", message: "premium" } }, "premium"],
    [404, { error: { reason: "NO_ACTIVE_DEVICE", message: "device" } }, "no-device"],
    [429, { error: { message: "slow down" } }, "rate-limit"],
    [500, { error: { message: "broken" } }, "server"],
    [400, { error: { message: "other" } }, "unknown"],
  ])("maps HTTP %s to %s", async (status, body, code) => {
    const { spotify } = fakeClient(
      json(body, status, status === 429 ? { "Retry-After": "3" } : {}),
    );
    try {
      await spotify.play();
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(SpotifyError);
      expect(error).toMatchObject({ code, status });
      if (status === 429) expect(error.retryAfterMs).toBe(3000);
    }
  });

  it("maps an invalid refresh grant to auth", async () => {
    const spotify = createSpotify({
      clientId: "client",
      refreshToken: "bad",
      fetchFn: async () => json({ error: "invalid_grant", error_description: "expired" }, 400),
    });
    await expect(spotify.play()).rejects.toMatchObject({ code: "auth", status: 400 });
  });

  it("maps a wrong client id at the token endpoint to auth", async () => {
    const spotify = createSpotify({
      clientId: "wrong",
      refreshToken: "refresh",
      fetchFn: async () =>
        json({ error: "invalid_client", error_description: "Invalid client" }, 400),
    });
    await expect(spotify.getPlayback()).rejects.toMatchObject({ code: "auth", status: 400 });
  });

  it("keeps a 400 from the player endpoint as unknown", async () => {
    const { spotify } = fakeClient(json({ error: { status: 400, message: "Bad request" } }, 400));
    await expect(spotify.next()).rejects.toMatchObject({ code: "unknown", status: 400 });
  });

  it("maps a thrown fetch to network", async () => {
    const spotify = createSpotify({
      clientId: "client",
      refreshToken: "refresh",
      fetchFn: async () => {
        throw new Error("offline");
      },
    });
    await expect(spotify.play()).rejects.toMatchObject({ code: "network" });
  });
});
