/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Spotify client tests
 *
 * Every request names the `spotify` sign-in and carries no token of its
 * own (Tilefold adds it); answers map to the playback model; Spotify's
 * refusals and Tilefold's own errors map to the card's codes; Retry-After
 * is read from a plain headers object as Tilefold returns it.
 */
import { describe, expect, it } from "vitest";
import {
  AUTH_NAME,
  createSpotify,
  hostError,
  SpotifyError,
} from "../../../examples/tuneboard/src/spotify/index.js";

/** A response shaped like Tilefold's `tf.net.fetch` answer. */
const reply = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers,
  json: async () => {
    if (body === undefined) throw new SyntaxError("no body");
    return body;
  },
});

/** A client whose requests are recorded and answered by `answer`. */
function fakeClient(answer = () => reply(204)) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    return answer(url, init);
  };
  return { spotify: createSpotify({ fetchFn }), calls };
}

/** The error a promise rejects with. */
async function failure(p) {
  try {
    await p;
  } catch (err) {
    return err;
  }
  throw new Error("expected a failure");
}

describe("player client", () => {
  it("needs a network function", () => {
    expect(() => createSpotify({})).toThrow(TypeError);
  });

  it("returns null for empty playback and maps a populated response", async () => {
    const empty = fakeClient();
    expect(await empty.spotify.getPlayback()).toBeNull();
    expect(empty.calls).toEqual([
      { url: "https://api.spotify.com/v1/me/player", init: { method: "GET", auth: "spotify" } },
    ]);

    const full = fakeClient(() =>
      reply(200, {
        is_playing: true,
        item: {
          name: "Song",
          artists: [{ name: "A" }, { name: "B" }],
          album: { name: "Record" },
          duration_ms: 1000,
        },
        progress_ms: 250,
        device: { name: "Phone", volume_percent: 40 },
        shuffle_state: true,
        repeat_state: "track",
      }),
    );
    expect(await full.spotify.getPlayback()).toEqual({
      isPlaying: true,
      track: { title: "Song", artists: ["A", "B"], album: "Record", durationMs: 1000 },
      progressMs: 250,
      device: { name: "Phone", volume: 40 },
      shuffle: true,
      repeat: "track",
    });
  });

  it.each([
    ["play", [], "PUT", "/play"],
    ["pause", [], "PUT", "/pause"],
    ["next", [], "POST", "/next"],
    ["previous", [], "POST", "/previous"],
    ["setVolume", [37], "PUT", "/volume?volume_percent=37"],
    ["seek", [12345], "PUT", "/seek?position_ms=12345"],
    ["setShuffle", [true], "PUT", "/shuffle?state=true"],
  ])(
    "%s sends %s through the spotify sign-in, with no token of its own",
    async (name, args, method, path) => {
      const { spotify, calls } = fakeClient();
      await spotify[name](...args);
      expect(calls[0].url).toBe(`https://api.spotify.com/v1/me/player${path}`);
      expect(calls[0].init).toEqual({ method, auth: AUTH_NAME });
      expect(JSON.stringify(calls[0])).not.toMatch(/Bearer|Authorization/i);
    },
  );

  it("refuses bad arguments before sending anything", async () => {
    const { spotify, calls } = fakeClient();
    expect(() => spotify.setVolume(101)).toThrow(RangeError);
    expect(() => spotify.seek(-1)).toThrow(RangeError);
    expect(() => spotify.setShuffle("yes")).toThrow(TypeError);
    expect(calls).toEqual([]);
  });
});

describe("errors", () => {
  it("maps Spotify's answers to the card's codes", async () => {
    const cases = [
      [reply(401, { error: { status: 401, message: "Expired" } }), "auth"],
      [reply(403, { error: { status: 403, reason: "PREMIUM_REQUIRED" } }), "premium"],
      [reply(404, { error: { status: 404, reason: "NO_ACTIVE_DEVICE" } }), "no-device"],
      [reply(429, undefined, { "retry-after": "7" }), "rate-limit"],
      [reply(502, undefined), "server"],
      [reply(400, { error: { message: "Bad" } }), "unknown"],
    ];
    for (const [response, code] of cases) {
      const err = await failure(fakeClient(() => response).spotify.getPlayback());
      expect(err).toBeInstanceOf(SpotifyError);
      expect(err.code, String(response.status)).toBe(code);
    }
    const limited = await failure(
      fakeClient(() => reply(429, undefined, { "retry-after": "7" })).spotify.getPlayback(),
    );
    expect(limited.retryAfterMs).toBe(7000);
  });

  it("maps Tilefold's own errors by name", async () => {
    const thrown = (name) => () => {
      throw Object.assign(new Error(name), { name });
    };
    const cases = [
      ["CredentialMissingError", "auth"],
      ["PermissionDeniedError", "denied"],
      ["NetworkPolicyError", "denied"],
      ["RateLimitError", "rate-limit"],
      ["TimeoutError", "network"],
      ["NetworkError", "network"],
    ];
    for (const [name, code] of cases) {
      const err = await failure(fakeClient(thrown(name)).spotify.play());
      expect(err.code, name).toBe(code);
    }
    const other = await failure(fakeClient(thrown("TypeError")).spotify.play());
    expect(other.code).toBe("network");
    expect(hostError(new Error("plain"))).toBeNull();
  });
});
