/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Session and view tests
 *
 * The state machine against the fake Spotify client: every state and how
 * it is reached, the controls with their instant feedback, each error
 * code, the poll delays (normal, rate limit, back-off, stop), progress
 * between answers, and cleaning odd playback data. Then the overlay view:
 * six items within Tilefold's limits, the card for every state, button
 * dimming and labels, diffs, and what each click does.
 */
import { describe, expect, it } from "vitest";
import { svgOf } from "../../../examples/tuneboard/src/render/svg.js";
import {
  MAX_BACKOFF_MS,
  POLL_MS,
  STATES,
  VOLUME_STEP,
  cleanPlayback,
  clampInt,
  createSession,
} from "../../../examples/tuneboard/src/tile/session.js";
import {
  CARD_ID,
  TONE,
  actionForClick,
  buttonId,
  cardView,
  diffItems,
  sceneItems,
} from "../../../examples/tuneboard/src/tile/view.js";
import { createFakeClient } from "../support/fake-spotify.js";
import { ONE_PANE, messagesOf } from "../support/fake-tf.js";

/** A session with a controllable clock and a record of state changes. */
function setup(clientOpts) {
  let time = 1000;
  const states = [];
  let changes = 0;
  const session = createSession({
    now: () => time,
    onChange: () => (changes += 1),
    onState: (from, to) => states.push(`${from}>${to}`),
  });
  const client = createFakeClient(clientOpts);
  return {
    session,
    client,
    states,
    changes: () => changes,
    tick: (ms) => (time += ms),
  };
}

/** The English `t` the fake host uses. */
const en = messagesOf("en");
const t = (key, args = {}) => {
  const text = en.get(key);
  if (text === undefined) throw new Error(`no message ${key}`);
  return text.replace(/\{ \$(\w+) \}/g, (_, n) => String(args[n] ?? ""));
};

describe("session states", () => {
  it("starts with no network and moves to connecting with a client", () => {
    const { session, client, states } = setup();
    expect(session.status).toBe("no-network");
    expect(session.connected).toBe(false);
    session.setClient(client);
    expect(session.status).toBe("connecting");
    expect(states).toEqual(["no-network>connecting"]);
  });

  it("shows signed-out when there is no client for that reason", () => {
    const { session } = setup();
    session.setClient(null, "signed-out");
    expect(session.status).toBe("signed-out");
  });

  it("reaches playing, paused and no-device from Spotify's answers", async () => {
    const { session, client } = setup();
    session.setClient(client);
    expect(await session.refresh()).toBe(true);
    expect(session.status).toBe("playing");
    client.state.isPlaying = false;
    await session.refresh();
    expect(session.status).toBe("paused");
    client.state.track = null;
    await session.refresh();
    expect(session.status).toBe("no-device");
    expect(session.playback()).toBeNull();
  });

  it("does nothing on refresh without a client", async () => {
    const { session } = setup();
    expect(await session.refresh()).toBe(false);
    expect(session.status).toBe("no-network");
  });

  for (const [code, state] of [
    ["auth", "signed-out"],
    ["denied", "denied"],
    ["no-device", "no-device"],
    ["network", "error"],
    ["server", "error"],
    ["unknown", "error"],
  ]) {
    it(`goes to ${state} on a ${code} failure`, async () => {
      const { session, client } = setup();
      session.setClient(client);
      client.failNext(code);
      expect(await session.refresh()).toBe(false);
      expect(session.status).toBe(state);
      expect(session.lastCode).toBe(code);
    });
  }

  it("treats an error without a code as unknown", async () => {
    const { session } = setup();
    session.setClient({
      getPlayback: async () => {
        throw new Error("odd");
      },
    });
    await session.refresh();
    expect(session.status).toBe("error");
    expect(session.lastCode).toBe("unknown");
  });

  it("keeps the current state when rate-limited", async () => {
    const { session, client } = setup();
    session.setClient(client);
    await session.refresh();
    client.failNext("rate-limit", { retryAfterMs: 30000 });
    await session.refresh();
    expect(session.status).toBe("playing");
    expect(session.nextDelay()).toBe(30000);
    await session.refresh();
    expect(session.nextDelay()).toBe(POLL_MS);
  });

  it("covers every state in the list", () => {
    expect(STATES).toHaveLength(9);
    for (const s of STATES) expect(TONE[s]).toBeDefined();
  });
});

describe("poll delays", () => {
  it("is the normal interval after an answer and while connecting", async () => {
    const { session, client } = setup();
    expect(session.nextDelay()).toBeNull();
    session.setClient(client);
    expect(session.nextDelay()).toBe(POLL_MS);
    await session.refresh();
    expect(session.nextDelay()).toBe(POLL_MS);
  });

  it("doubles after each error up to a minute", async () => {
    const { session, client } = setup();
    session.setClient(client);
    client.failAll("server");
    const delays = [];
    for (let i = 0; i < 6; i++) {
      await session.refresh();
      delays.push(session.nextDelay());
    }
    expect(delays).toEqual([5000, 10000, 20000, 40000, MAX_BACKOFF_MS, MAX_BACKOFF_MS]);
    client.failAll(null);
    await session.refresh();
    expect(session.nextDelay()).toBe(POLL_MS);
  });

  it("uses a sane wait when Retry-After is missing", async () => {
    const { session, client } = setup();
    session.setClient(client);
    client.failNext("rate-limit");
    await session.refresh();
    expect(session.nextDelay()).toBe(POLL_MS * 2);
  });

  it("stops when only the user can fix things", async () => {
    const { session, client } = setup();
    session.setClient(client);
    client.failNext("auth");
    await session.refresh();
    expect(session.nextDelay()).toBeNull();
    session.setClient(client);
    await session.refresh();
    client.failNext("premium");
    await session.control("next");
    expect(session.status).toBe("premium");
    expect(session.nextDelay()).toBeNull();
  });
});

describe("controls", () => {
  it("pauses and plays with instant feedback", async () => {
    const { session, client } = setup();
    session.setClient(client);
    await session.refresh();
    expect(await session.control("playPause")).toEqual({ ok: true, did: "pause" });
    expect(session.status).toBe("paused");
    expect(client.calls).toContain("pause");
    expect(await session.control("playPause")).toEqual({ ok: true, did: "play" });
    expect(session.status).toBe("playing");
    expect(client.calls).toContain("play");
  });

  it("plays when nothing is playing on any device", async () => {
    const { session, client } = setup({ track: null });
    session.setClient(client);
    await session.refresh();
    expect(session.status).toBe("no-device");
    expect(await session.control("playPause")).toEqual({ ok: true, did: "play" });
    expect(client.calls).toContain("play");
  });

  it("skips forwards and back", async () => {
    const { session, client } = setup();
    session.setClient(client);
    await session.refresh();
    expect(await session.control("next")).toEqual({ ok: true, did: "next" });
    expect(await session.control("previous")).toEqual({ ok: true, did: "previous" });
    expect(client.calls).toEqual(["getPlayback", "next", "previous"]);
  });

  it("steps the volume and stops at the ends", async () => {
    const { session, client } = setup({ volume: 95 });
    session.setClient(client);
    await session.refresh();
    expect(await session.control("volumeUp")).toEqual({ ok: true, did: "volume", volume: 100 });
    expect(await session.control("volumeDown")).toEqual({
      ok: true,
      did: "volume",
      volume: 100 - VOLUME_STEP,
    });
    expect(session.playback().volume).toBe(90);
    client.state.volume = 3;
    await session.refresh();
    expect((await session.control("volumeDown")).volume).toBe(0);
  });

  it("refuses volume when Spotify reports none", async () => {
    const { session, client } = setup({ volume: null });
    session.setClient(client);
    await session.refresh();
    expect(await session.control("volumeUp")).toEqual({ ok: false, code: "no-volume" });
    expect(client.calls).not.toContain("setVolume:60");
  });

  it("refuses controls while signed out, connecting or offline", async () => {
    const { session, client } = setup();
    expect(await session.control("next")).toEqual({ ok: false, code: "unavailable" });
    session.setClient(client);
    expect(await session.control("next")).toEqual({ ok: false, code: "unavailable" });
    expect(client.calls).toEqual([]);
  });

  it("reports an unknown action", async () => {
    const { session, client } = setup();
    session.setClient(client);
    await session.refresh();
    expect(await session.control(/** @type {any} */ ("dance"))).toEqual({
      ok: false,
      code: "unknown-action",
    });
  });

  it("returns the failure code of a refused control", async () => {
    const { session, client } = setup();
    session.setClient(client);
    await session.refresh();
    client.failNext("premium");
    expect(await session.control("playPause")).toEqual({ ok: false, code: "premium" });
    expect(session.status).toBe("premium");
  });

  it("tells listeners about changes", async () => {
    const { session, client, changes } = setup();
    session.setClient(client);
    const before = changes();
    await session.refresh();
    await session.control("volumeUp");
    expect(changes()).toBe(before + 2);
  });
});

describe("progress and playback data", () => {
  it("counts time since the last answer while playing, up to the end", async () => {
    const { session, client, tick } = setup();
    session.setClient(client);
    await session.refresh();
    expect(session.progressMs()).toBe(60000);
    tick(5000);
    expect(session.progressMs()).toBe(65000);
    tick(10 ** 7);
    expect(session.progressMs()).toBe(300000);
  });

  it("stands still while paused, and keeps its place when paused by the user", async () => {
    const { session, client, tick } = setup();
    session.setClient(client);
    await session.refresh();
    tick(2000);
    await session.control("playPause");
    tick(9000);
    expect(session.progressMs()).toBe(62000);
  });

  it("is 0 with nothing playing", () => {
    expect(setup().session.progressMs()).toBe(0);
  });

  it("cleans odd playback data", () => {
    expect(cleanPlayback(null)).toBeNull();
    expect(cleanPlayback({ isPlaying: true })).toBeNull();
    expect(
      cleanPlayback({
        isPlaying: "yes",
        track: { title: 5, artists: ["A", "", 7], durationMs: -4 },
        progressMs: "x",
        device: { name: "Phone", volume: 140 },
      }),
    ).toEqual({
      isPlaying: false,
      title: "",
      artists: ["A", "7"],
      durationMs: 0,
      progressMs: 0,
      device: "Phone",
      volume: 100,
    });
  });

  it("clamps whole numbers with a fallback", () => {
    expect(clampInt("12.6", 0, 100, 0)).toBe(13);
    expect(clampInt(null, 0, 100, null)).toBeNull();
    expect(clampInt("abc", 0, 100, 5)).toBe(5);
  });

  it("hands out copies", async () => {
    const { session, client } = setup();
    session.setClient(client);
    await session.refresh();
    session.playback().artists.push("X");
    expect(session.playback().artists).toEqual(["Claude Debussy", "Ivan Moravec"]);
  });
});

describe("view", () => {
  const playback = cleanPlayback(
    createFakeClient().state.track && {
      isPlaying: true,
      track: {
        title: "Clair de Lune",
        artists: ["Claude Debussy", "Ivan Moravec"],
        durationMs: 300000,
      },
      progressMs: 60000,
      device: { name: "MacBook", volume: 50 },
    },
  );
  const base = {
    playback,
    progressMs: 75000,
    settings: { size: "medium", corner: "bottom-right" },
    layout: ONE_PANE,
    t,
  };

  it("shows the track while playing", () => {
    const v = cardView({ ...base, status: "playing" });
    expect(v).toEqual({
      mode: "track",
      title: "Clair de Lune",
      artists: "Claude Debussy, Ivan Moravec",
      detail: "On MacBook · volume 50%",
      progress: 0.25,
      playing: true,
    });
  });

  it("says paused, and fills in a missing title", () => {
    const v = cardView({
      ...base,
      status: "paused",
      playback: { ...playback, title: "", device: "" },
    });
    expect(v.detail).toBe("Paused");
    expect(v.title).toBe("Unknown track");
    expect(v.playing).toBe(false);
  });

  for (const status of [
    "no-network",
    "denied",
    "signed-out",
    "connecting",
    "no-device",
    "premium",
    "error",
  ]) {
    it(`shows the ${status} message`, () => {
      const v = cardView({ ...base, status, playback: null });
      expect(v).toEqual({
        mode: "message",
        tone: TONE[status],
        title: t(`state-${status}`),
        hint: t(`state-${status}-hint`),
      });
      const card = sceneItems({ ...base, status, playback: null })[0];
      expect(svgOf(card.image)).toContain(t(`state-${status}`).replace(/'/g, "&apos;"));
      expect(card.label.length).toBeLessThanOrEqual(80);
    });
  }

  it("builds six items within Tilefold's limits", () => {
    const items = sceneItems({ ...base, status: "playing" });
    expect(items).toHaveLength(6);
    expect(items.map((i) => i.id)).toEqual([
      CARD_ID,
      "btn-previous",
      "btn-play",
      "btn-next",
      "btn-volume-down",
      "btn-volume-up",
    ]);
    for (const i of items) {
      expect(i.w).toBeLessThanOrEqual(256);
      expect(i.h).toBeLessThanOrEqual(256);
      expect(i.hit).toBe(true);
      expect(i.label.length).toBeLessThanOrEqual(80);
      expect(i.image.startsWith("data:image/svg+xml")).toBe(true);
    }
    expect(items[0].label).toBe("Playing Clair de Lune by Claude Debussy, Ivan Moravec");
    expect(items[2].label).toBe("Pause");
  });

  it("labels the play button Play while paused", () => {
    expect(sceneItems({ ...base, status: "paused" })[2].label).toBe("Play");
  });

  it("dims every button when the controls can't work, and volume without a volume", () => {
    const dimmed = (items) => items.slice(1).map((i) => svgOf(i.image).includes(`opacity="0.35"`));
    expect(dimmed(sceneItems({ ...base, status: "signed-out", playback: null }))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(dimmed(sceneItems({ ...base, status: "playing" }))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(dimmed(sceneItems({ ...base, status: "no-device", playback: null }))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it("resends only what changed", () => {
    const a = sceneItems({ ...base, status: "playing" });
    const b = sceneItems({ ...base, status: "playing", progressMs: 90000 });
    const diff = diffItems(a, b);
    expect(diff.map((d) => d.id)).toEqual([CARD_ID]);
    expect(Object.keys(diff[0])).toEqual(["id", "image"]);
    expect(diffItems(a, a)).toEqual([]);
    expect(diffItems(null, a)).toEqual(a);
  });

  it("maps clicks to actions", () => {
    expect(actionForClick(CARD_ID)).toBe("refresh");
    expect(actionForClick(buttonId("play"))).toBe("playPause");
    expect(actionForClick(buttonId("volume-up"))).toBe("volumeUp");
    expect(actionForClick("nope")).toBeNull();
  });
});
