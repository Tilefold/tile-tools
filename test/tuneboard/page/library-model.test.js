/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard's Library page — its state
 *
 * The Library stays hidden until the tile shows it; showing it takes the
 * user's language and asks for the first page. Pages of playlists replace
 * or extend the list without duplicates, "more" asks from the next offset
 * only when there is one and nothing is loading, a pick is sent only for a
 * listed playlist, and the status line shows the error, the notice,
 * "loading" or "empty". State is never changed in place.
 */
import { describe, expect, it } from "vitest";
import {
  initialState,
  more,
  play,
  receive,
  refresh,
  statusLine,
} from "../../../examples/tuneboard/page/library-model.js";

const STRINGS = { title: "Your playlists", loading: "Loading…", empty: "None yet." };
const item = (n) => ({ uri: `spotify:playlist:pl${n}`, name: `P${n}`, byline: "by Ana" });

/** The state after the tile showed the Library and sent the first page. */
function loaded() {
  let { state } = receive(initialState(), {
    do: "library",
    lang: "ar",
    dir: "rtl",
    strings: STRINGS,
  });
  ({ state } = receive(state, {
    do: "playlists",
    offset: 0,
    items: [item(1), item(2)],
    total: 3,
    nextOffset: 2,
  }));
  return state;
}

describe("Library state", () => {
  it("stays hidden until the tile shows it, then asks for the first page", () => {
    const start = initialState();
    expect(start.shown).toBe(false);
    const step = receive(start, { do: "library", lang: "ar", dir: "rtl", strings: STRINGS });
    expect(step.state).toMatchObject({ shown: true, lang: "ar", dir: "rtl", loading: true });
    expect(step.send).toEqual({ type: "want-playlists", offset: 0 });
    expect(start.shown).toBe(false);
    // Only "rtl" turns the page around.
    expect(receive(start, { do: "library", dir: "sideways" }).state.dir).toBe("ltr");
  });

  it("ignores messages it doesn't know", () => {
    const start = initialState();
    for (const m of [null, "text", { do: "dance" }]) {
      expect(receive(start, m)).toEqual({ state: start, send: null });
    }
  });

  it("extends the list without duplicates, and a first page replaces it", () => {
    let state = loaded();
    expect(state.items.map((p) => p.uri)).toEqual(["spotify:playlist:pl1", "spotify:playlist:pl2"]);
    ({ state } = receive(state, {
      do: "playlists",
      offset: 2,
      items: [item(2), item(3), null],
      total: 3,
      nextOffset: null,
    }));
    expect(state.items.map((p) => p.name)).toEqual(["P1", "P2", "P3"]);
    expect(state.nextOffset).toBeNull();
    ({ state } = receive(state, { do: "playlists", offset: 0, items: [item(9)], total: 1 }));
    expect(state.items.map((p) => p.name)).toEqual(["P9"]);
  });

  it("asks for more only when there is more and nothing is loading", () => {
    const state = loaded();
    const step = more(state);
    expect(step.send).toEqual({ type: "want-playlists", offset: 2 });
    expect(more(step.state).send).toBeNull();
    expect(more({ ...state, nextOffset: null }).send).toBeNull();
    expect(refresh(step.state).send).toBeNull();
    expect(refresh(state).send).toEqual({ type: "want-playlists", offset: 0 });
  });

  it("sends a pick only for a listed playlist", () => {
    const state = loaded();
    expect(play(state, "spotify:playlist:pl2").send).toEqual({
      type: "play-playlist",
      uri: "spotify:playlist:pl2",
    });
    expect(play(state, "spotify:playlist:other").send).toBeNull();
  });

  it("shows the error, the notice, loading or empty", () => {
    const start = receive(initialState(), { do: "library", strings: STRINGS }).state;
    expect(statusLine(start)).toEqual({ text: "Loading…" });
    const empty = receive(start, { do: "playlists", offset: 0, items: [], total: 0 }).state;
    expect(statusLine(empty)).toEqual({ text: "None yet." });
    const failed = receive(start, { do: "library-error", message: "Sign in again." }).state;
    expect(statusLine(failed)).toEqual({ text: "Sign in again.", error: true });
    expect(failed.loading).toBe(false);
    const playing = receive(loaded(), {
      do: "playing",
      uri: "spotify:playlist:pl1",
      message: "Playing.",
    }).state;
    expect(statusLine(playing)).toEqual({ text: "Playing." });
    expect(playing.playing).toBe("spotify:playlist:pl1");
    // A new pick clears the last notice and error.
    expect(statusLine(play(playing, "spotify:playlist:pl2").state)).toEqual({ text: "" });
  });
});
