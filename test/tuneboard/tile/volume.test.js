/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — volume
 *
 * Volume clicks show the new volume at once and go out as one request when
 * the clicks pause; the volume the user chose wins over Spotify's late
 * reports for a few seconds, so the card doesn't jump back and the next
 * click builds on it; a failed send is reported and lets Spotify's report
 * count again. While music plays inside Tilefold, the volume goes straight
 * to the player in Tuneboard's page instead of through Spotify.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTuneboard } from "../../../examples/tuneboard/src/tile/run.js";
import {
  VOLUME_HOLD_MS,
  VOLUME_SETTLE_MS,
  VOLUME_STEP,
  createSession,
} from "../../../examples/tuneboard/src/tile/session.js";
import { registerSettings } from "../../../examples/tuneboard/src/tile/settings.js";
import { createFactory, createFakeClient } from "../support/fake-spotify.js";
import { createHost, drain } from "../support/fake-tf.js";

/** A session on a fake client, with its own clock. */
function setup(clientOpts, sessionOpts = {}) {
  let time = 1000;
  const session = createSession({ now: () => time, ...sessionOpts });
  const client = createFakeClient(clientOpts);
  return { session, client, tick: (ms) => (time += ms) };
}

describe("volume in the session", () => {
  it("steps the volume and stops at the ends, sending quick clicks as one", async () => {
    vi.useFakeTimers();
    try {
      const { session, client, tick } = setup({ volume: 95 });
      session.setClient(client);
      await session.refresh();
      expect(await session.control("volumeUp")).toEqual({ ok: true, did: "volume", volume: 100 });
      expect(await session.control("volumeDown")).toEqual({
        ok: true,
        did: "volume",
        volume: 100 - VOLUME_STEP,
      });
      expect(session.playback().volume).toBe(90);
      // Nothing is sent until the clicks pause; then only the last volume.
      expect(client.calls.filter((c) => c.startsWith("setVolume"))).toEqual([]);
      await vi.advanceTimersByTimeAsync(VOLUME_SETTLE_MS);
      expect(client.calls.filter((c) => c.startsWith("setVolume"))).toEqual(["setVolume:90"]);
      tick(VOLUME_HOLD_MS + 1);
      client.state.volume = 3;
      await session.refresh();
      expect((await session.control("volumeDown")).volume).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the chosen volume while Spotify still reports the old one", async () => {
    vi.useFakeTimers();
    try {
      const { session, client, tick } = setup({ volume: 50 });
      session.setClient(client);
      await session.refresh();
      await session.control("volumeUp");
      await vi.advanceTimersByTimeAsync(VOLUME_SETTLE_MS);
      // Spotify answers with the old volume for a moment.
      client.state.volume = 50;
      await session.refresh();
      expect(session.playback().volume).toBe(60);
      // The next click builds on 60, not on the stale 50.
      expect((await session.control("volumeUp")).volume).toBe(70);
      await vi.advanceTimersByTimeAsync(VOLUME_SETTLE_MS);
      // After the hold, Spotify's report counts again.
      tick(VOLUME_HOLD_MS + 1);
      client.state.volume = 65;
      await session.refresh();
      expect(session.playback().volume).toBe(65);
      expect((await session.control("volumeDown")).volume).toBe(55);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the volume its own way when told, and reports a failed send", async () => {
    vi.useFakeTimers();
    try {
      const sent = [];
      const errors = [];
      const { session, client } = setup(
        { volume: 40 },
        {
          setVolume: async (volume, playing) => {
            sent.push([volume, playing.device]);
            if (volume > 55) throw Object.assign(new Error("gone"), { code: "network" });
          },
          onVolumeError: (code) => errors.push(code),
        },
      );
      session.setClient(client);
      await session.refresh();
      await session.control("volumeUp");
      await vi.advanceTimersByTimeAsync(VOLUME_SETTLE_MS);
      expect(sent).toEqual([[50, "MacBook"]]);
      expect(client.calls.filter((c) => c.startsWith("setVolume"))).toEqual([]);
      await session.control("volumeUp");
      await vi.advanceTimersByTimeAsync(VOLUME_SETTLE_MS);
      expect(errors).toEqual(["network"]);
      // A failed send lets Spotify's report count again at once.
      await session.refresh();
      expect(session.playback().volume).toBe(40);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("volume of the player inside Tilefold", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Starts Tuneboard with nothing playing, then plays in Tilefold on device `dev-1`. */
  async function playingHere() {
    const { host, tf } = createHost({ net: true, page: true });
    const factory = createFactory({ track: null });
    registerSettings(tf);
    runTuneboard(tf, { createSpotify: factory.createSpotify });
    await drain();
    await host.command("refresh");
    void host.command("play-here");
    await host.advance(0);
    await host.fromPage({ type: "ready", deviceId: "dev-1" });
    await host.advance(1000);
    return { host, factory };
  }

  it("goes straight to the page while music plays there", async () => {
    const { host, factory } = await playingHere();
    await host.command("volume-up");
    await host.advance(VOLUME_SETTLE_MS);
    const posts = host.page.calls.filter(([c]) => c === "post").map(([, m]) => m);
    expect(posts).toContainEqual({ do: "volume", value: 0.6 });
    expect(factory.client.calls.filter((c) => c.startsWith("setVolume"))).toEqual([]);
  });

  it("goes through Spotify when the music plays on another device", async () => {
    const { host, factory } = await playingHere();
    factory.client.state.deviceId = "phone-1";
    factory.client.state.device = "Phone";
    await host.command("refresh");
    await host.command("volume-down");
    await host.advance(VOLUME_SETTLE_MS);
    expect(factory.client.calls).toContain("setVolume:40");
    const posts = host.page.calls.filter(([c]) => c === "post").map(([, m]) => m);
    expect(posts.some((m) => m.do === "volume")).toBe(false);
  });
});
