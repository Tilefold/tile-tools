// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane's page — its state (tests)
 *
 * The page takes its text, settings and recent list from the tile, plays
 * what the user pastes or picks once YouTube's player is ready, reports a
 * started video once with its title, and turns YouTube's error codes into
 * the right message.
 */
import { describe, expect, it } from "vitest";
import {
  apiFailed,
  apiReady,
  initialState,
  pick,
  playerError,
  receive,
  started,
  statusLine,
  showsLinkBox,
  statusMessage,
  submit,
} from "../../examples/watchpane/page-src/watch-model.js";

const ID = "dQw4w9WgXcQ";
const OTHER = "9bZkp7q19f0";

const STRINGS = {
  loading: "loading",
  empty: "empty",
  noPlayer: "no player",
  badLink: "bad link",
  errNotFound: "not found",
  errNoEmbed: "no embed",
  errConfig: "refused ({code})",
  errOther: "failed ({code})",
};

/** A page the tile has set up, with YouTube's player script loaded. */
function ready(extra = {}) {
  const { state } = receive(initialState(), {
    do: "setup",
    lang: "de",
    dir: "ltr",
    strings: STRINGS,
    options: { autoplay: true, captions: false, private: true },
    recent: [{ id: OTHER, title: "Earlier" }],
    ...extra,
  });
  return apiReady(state).state;
}

describe("receive", () => {
  it("takes the setup, cleaning the options and the recent list", () => {
    const { state, send, act } = receive(initialState(), {
      do: "setup",
      lang: "ar",
      dir: "rtl",
      strings: STRINGS,
      options: { autoplay: false, captions: true, private: "yes" },
      recent: [{ id: ID, title: "One" }, { id: "bad" }, null, { id: OTHER, title: 7 }],
    });
    expect(send).toBeNull();
    expect(act).toBeNull();
    expect(state).toMatchObject({ configured: true, lang: "ar", dir: "rtl" });
    expect(state.options).toEqual({ autoplay: false, captions: true, private: true });
    expect(state.recent).toEqual([
      { id: ID, title: "One" },
      { id: OTHER, title: "" },
    ]);
  });

  it("ignores what it doesn't know", () => {
    const s = initialState();
    expect(receive(s, null).state).toBe(s);
    expect(receive(s, { do: "explode" }).state).toBe(s);
    expect(receive(s, { do: "play", id: "<script>" }).act).toBeNull();
  });

  it("plays a video the tile names", () => {
    const { act, state } = receive(ready(), { do: "play", id: ID });
    expect(act).toEqual({ load: { id: ID, start: 0 } });
    expect(state.current.from).toBe("tile");
  });

  it("toggles only when something was picked", () => {
    expect(receive(ready(), { do: "toggle" }).act).toBeNull();
    const playing = submit(ready(), ID).state;
    expect(receive(playing, { do: "toggle" }).act).toEqual({ toggle: true });
  });
});

describe("the user", () => {
  it("pastes a link and it plays from its start time", () => {
    const { state, act, send } = submit(ready(), `https://youtu.be/${ID}?t=90`);
    expect(act).toEqual({ load: { id: ID, start: 90 } });
    expect(send).toBeNull();
    expect(state.current).toEqual({ id: ID, start: 90, from: "link" });
  });

  it("pastes something else and is told so", () => {
    const { state, act } = submit(ready(), "not a link");
    expect(act).toBeNull();
    expect(statusLine(state)).toEqual({ text: "bad link", error: true });
  });

  it("picks a recent video, but only one in the list", () => {
    expect(pick(ready(), OTHER).act).toEqual({ load: { id: OTHER, start: 0 } });
    expect(pick(ready(), ID).act).toBeNull();
  });

  it("pastes before YouTube's player has loaded, and it plays once it has", () => {
    const early = receive(initialState(), { do: "setup", strings: STRINGS }).state;
    const waiting = submit(early, ID);
    expect(waiting.act).toBeNull();
    expect(apiReady(waiting.state).act).toEqual({ load: { id: ID, start: 0 } });
  });
});

describe("YouTube's player", () => {
  it("reports a started video once, with its title cut to 200 characters", () => {
    const picked = submit(ready(), ID).state;
    const first = started(picked, ID, `  ${"T".repeat(250)}  `);
    expect(first.send).toEqual({ type: "watching", id: ID, title: "T".repeat(200), from: "link" });
    expect(started(first.state, ID, "again").send).toBeNull();
    // Another video than the one picked isn't reported.
    expect(started(picked, OTHER, "x").send).toBeNull();
  });

  it.each([
    [100, "not found"],
    [105, "not found"],
    [101, "no embed"],
    [150, "no embed"],
    [153, "refused (153)"],
    [152, "refused (152)"],
    [5, "failed (5)"],
    ["junk", "failed (0)"],
  ])("error %s shows %s and tells the tile", (code, text) => {
    const { state, send } = playerError(submit(ready(), ID).state, code);
    expect(statusLine(state)).toEqual({ text, error: true });
    expect(send).toEqual({ type: "error", code: Number.isSafeInteger(Number(code)) ? code : 0 });
  });

  it("didn't load: the page says so and tells the tile", () => {
    const { state, send } = apiFailed(
      receive(initialState(), { do: "setup", strings: STRINGS }).state,
    );
    expect(send).toEqual({ type: "error", code: "api" });
    expect(statusLine(state)).toEqual({ text: "no player", error: true });
  });

  it("a new pick clears an earlier error", () => {
    const failed = playerError(submit(ready(), ID).state, 150).state;
    expect(statusLine(pick(failed, OTHER).state)).toEqual({ text: "", error: false });
  });
});

describe("statusLine", () => {
  it("says loading, then invites a paste when there is nothing to show", () => {
    const setUp = receive(initialState(), { do: "setup", strings: STRINGS }).state;
    expect(statusLine(setUp)).toEqual({ text: "loading", error: false });
    expect(statusLine(apiReady(setUp).state)).toEqual({ text: "empty", error: false });
    expect(statusLine(ready())).toEqual({ text: "", error: false });
  });
});

describe("the card", () => {
  it("runs the card's controls only on a video, and only known ones", () => {
    expect(receive(ready(), { do: "control", action: "pause" }).act).toBeNull();
    const playing = receive(ready(), { do: "play", id: ID }).state;
    expect(receive(playing, { do: "control", action: "forward" }).act).toEqual({
      control: "forward",
    });
    expect(receive(playing, { do: "control", action: "explode" }).act).toBeNull();
  });

  it("reports the player's state in whole seconds, cleaned", () => {
    const playing = receive(ready(), { do: "play", id: ID }).state;
    expect(
      statusMessage(playing, {
        title: " T ",
        playing: true,
        time: 12.9,
        duration: 300.2,
        muted: true,
      }),
    ).toEqual({
      type: "status",
      id: ID,
      title: "T",
      playing: true,
      time: 12,
      duration: 300,
      muted: true,
    });
    expect(statusMessage(ready(), { time: NaN, duration: -4, playing: "yes" })).toEqual({
      type: "status",
      id: null,
      title: "",
      playing: false,
      time: 0,
      duration: 0,
      muted: false,
    });
  });
});

describe("docked in Tilefold's window", () => {
  it("shows the link box until a video is picked, and when the card asks", () => {
    const docked = ready({ docked: true });
    expect(docked.docked).toBe(true);
    expect(showsLinkBox(docked)).toBe(true);
    const playing = submit(docked, `https://youtu.be/${ID}`).state;
    expect(showsLinkBox(playing)).toBe(false);
    const asked = receive(playing, { do: "paste" }).state;
    expect(showsLinkBox(asked)).toBe(true);
    expect(showsLinkBox(submit(asked, `https://youtu.be/${OTHER}`).state)).toBe(false);
    // In a window of its own the link box is always there.
    expect(showsLinkBox(ready())).toBe(false);
  });
});
