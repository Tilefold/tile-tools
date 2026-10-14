/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Spotify client — playlists and playing them
 *
 * The user's playlists are read a page at a time through the `spotify`
 * sign-in and come back in the page's small, safe shape: a playlist URI,
 * trimmed text, a track count and one cover from Spotify's image hosts
 * only. Empty entries are skipped and the next page is known. A playlist
 * plays on the active device or on a named one, and Play in Tilefold
 * starts playing on its device. Bad arguments are refused before anything
 * is sent, and a sign-in without the playlist permission says "scope".
 */
import { describe, expect, it } from "vitest";
import { createSpotify } from "../../../examples/tuneboard/src/spotify/index.js";
import {
  MAX_TEXT,
  PAGE_SIZE,
  isCoverUrl,
  isPlaylistUri,
  pickCover,
  playlistModel,
  playlistPage,
} from "../../../examples/tuneboard/src/spotify/playlists.js";

/** A response shaped like Tilefold's `tf.net.fetch` answer. */
const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {},
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

/** A playlist as Spotify sends it. */
const raw = (n, extra = {}) => ({
  uri: `spotify:playlist:abc${n}`,
  name: `  Mix ${n}  `,
  owner: { display_name: "Ana", id: "ana" },
  tracks: { total: n },
  images: [
    { url: `https://mosaic.scdn.co/640/${n}`, width: 640, height: 640 },
    { url: `https://mosaic.scdn.co/300/${n}`, width: 300, height: 300 },
    { url: `https://mosaic.scdn.co/60/${n}`, width: 60, height: 60 },
  ],
  ...extra,
});

describe("playlist model", () => {
  it("knows playlist URIs and Spotify's image hosts", () => {
    expect(isPlaylistUri("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")).toBe(true);
    for (const bad of ["spotify:album:1", "spotify:playlist:", "spotify:playlist:a b", 3, null]) {
      expect(isPlaylistUri(bad)).toBe(false);
    }
    expect(isCoverUrl("https://i.scdn.co/image/ab67")).toBe(true);
    expect(isCoverUrl("https://image-cdn-ak.spotifycdn.com/image/ab67")).toBe(true);
    for (const bad of [
      "http://i.scdn.co/image/1",
      "https://scdn.co.evil.example/1",
      "https://evilscdn.co/1",
      "https://i.scdn.co:8443/1",
      "https://user@i.scdn.co/1",
      "javascript:alert(1)",
      "not a url",
      null,
    ]) {
      expect(isCoverUrl(bad)).toBe(false);
    }
  });

  it("picks the smallest cover that is big enough, else the largest", () => {
    expect(pickCover(raw(1).images)).toBe("https://mosaic.scdn.co/300/1");
    expect(
      pickCover([
        { url: "https://i.scdn.co/a", width: 60 },
        { url: "https://i.scdn.co/b", width: 100 },
      ]),
    ).toBe("https://i.scdn.co/b");
    // Spotify leaves out the size of a single cover.
    expect(pickCover([{ url: "https://i.scdn.co/only", width: null }])).toBe(
      "https://i.scdn.co/only",
    );
    expect(pickCover([{ url: "https://example.com/x", width: 300 }])).toBeNull();
    expect(pickCover(null)).toBeNull();
    expect(pickCover([])).toBeNull();
  });

  it("keeps only what the page shows, trimmed", () => {
    expect(playlistModel(raw(7))).toEqual({
      uri: "spotify:playlist:abc7",
      name: "Mix 7",
      owner: "Ana",
      tracks: 7,
      cover: "https://mosaic.scdn.co/300/7",
      thumb: "https://mosaic.scdn.co/60/7",
    });
    const long = playlistModel(raw(1, { name: "x".repeat(MAX_TEXT + 50), owner: { id: "bob" } }));
    expect(long.name).toHaveLength(MAX_TEXT);
    expect(long.owner).toBe("bob");
    // A newer answer may count tracks under `items`; a missing count is null.
    expect(playlistModel(raw(1, { tracks: undefined, items: { total: 4 } })).tracks).toBe(4);
    expect(playlistModel(raw(1, { tracks: null })).tracks).toBeNull();
    expect(playlistModel(raw(1, { images: null })).cover).toBeNull();
    expect(playlistModel(null)).toBeNull();
    expect(playlistModel({ uri: "spotify:album:1", name: "x" })).toBeNull();
  });

  it("skips empty entries and knows where the next page starts", () => {
    const first = playlistPage(
      { items: [raw(1), null, raw(2)], total: 5, next: "https://api.spotify.com/…" },
      0,
    );
    expect(first.items.map((p) => p.uri)).toEqual([
      "spotify:playlist:abc1",
      "spotify:playlist:abc2",
    ]);
    expect(first).toMatchObject({ total: 5, nextOffset: 3 });
    expect(
      playlistPage({ items: [raw(4), raw(5)], total: 5, next: null }, 3).nextOffset,
    ).toBeNull();
    expect(playlistPage({}, 0)).toEqual({ items: [], total: 0, nextOffset: null });
  });
});

describe("playlist requests", () => {
  it("reads the user's playlists a page at a time through the sign-in", async () => {
    const { spotify, calls } = fakeClient(() =>
      reply(200, { items: [raw(1)], total: 51, next: "more" }),
    );
    const page = await spotify.playlists(50);
    expect(calls).toEqual([
      {
        url: `https://api.spotify.com/v1/me/playlists?limit=${PAGE_SIZE}&offset=50`,
        init: { method: "GET", auth: "spotify" },
      },
    ]);
    expect(page.items).toHaveLength(1);
    expect(page.nextOffset).toBeNull();
    await expect(spotify.playlists(-1)).rejects.toThrow(RangeError);
    await expect(spotify.playlists(1.5)).rejects.toThrow(RangeError);
  });

  it("plays a playlist on the active device or a named one", async () => {
    const { spotify, calls } = fakeClient();
    await spotify.playContext("spotify:playlist:abc1");
    await spotify.playContext("spotify:playlist:abc1", "dev-1");
    expect(calls).toEqual([
      {
        url: "https://api.spotify.com/v1/me/player/play",
        init: {
          method: "PUT",
          auth: "spotify",
          headers: { "content-type": "application/json" },
          body: '{"context_uri":"spotify:playlist:abc1"}',
        },
      },
      {
        url: "https://api.spotify.com/v1/me/player/play?device_id=dev-1",
        init: {
          method: "PUT",
          auth: "spotify",
          headers: { "content-type": "application/json" },
          body: '{"context_uri":"spotify:playlist:abc1"}',
        },
      },
    ]);
  });

  it("starts playing on a device", async () => {
    const { spotify, calls } = fakeClient();
    await spotify.playOn("dev-1");
    expect(calls).toEqual([
      {
        url: "https://api.spotify.com/v1/me/player/play?device_id=dev-1",
        init: { method: "PUT", auth: "spotify" },
      },
    ]);
  });

  it("refuses bad arguments before sending anything", () => {
    const { spotify, calls } = fakeClient();
    expect(() => spotify.playContext("spotify:album:1")).toThrow(TypeError);
    expect(() => spotify.playContext("spotify:playlist:abc1", "")).toThrow(TypeError);
    expect(() => spotify.playOn("")).toThrow(TypeError);
    expect(() => spotify.playOn(undefined)).not.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("says 'scope' when the sign-in may not read playlists", async () => {
    const { spotify } = fakeClient(() =>
      reply(403, { error: { status: 403, message: "Insufficient client scope" } }),
    );
    await expect(spotify.playlists()).rejects.toMatchObject({ code: "scope", status: 403 });
  });
});
