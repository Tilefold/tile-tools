/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — playing inside Tilefold
 *
 * With nothing playing anywhere, Play opens Tuneboard's player page hidden,
 * waits for the page's "ready" with its device id and starts Spotify
 * playing there; "Play in Tilefold" does the same on request and "Stop
 * playing in Tilefold" closes the page. Spotify's player errors become the
 * right notice (Premium, sign in again, not supported), a page that never
 * gets ready times out, a closed page is noticed, and a Tilefold without
 * pages just says it can't play music itself. Every step is recorded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { READY_TIMEOUT_MS } from "../../../examples/tuneboard/src/tile/player.js";
import { runTuneboard } from "../../../examples/tuneboard/src/tile/run.js";
import { registerSettings } from "../../../examples/tuneboard/src/tile/settings.js";
import { createFactory } from "../support/fake-spotify.js";
import { createHost, drain, messagesOf } from "../support/fake-tf.js";

const EN = messagesOf("en");

/** Starts Tuneboard with nothing playing anywhere, and with tile pages unless told not to. */
async function start({ page = true } = {}) {
  const { host, tf } = createHost({ net: true, page });
  const factory = createFactory({ track: null });
  registerSettings(tf);
  const handles = runTuneboard(tf, { createSpotify: factory.createSpotify });
  await drain();
  // Connect and learn that nothing plays.
  await host.command("refresh");
  return { host, tf, factory, ...handles };
}

/** Runs a command without waiting for it (the player waits for the page). */
const begin = (host, id) => void host.command(id);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("playing in Tilefold", () => {
  it("starts from Play when nothing plays anywhere, and moves playback there", async () => {
    const { host, factory, session } = await start();
    expect(session.status).toBe("no-device");
    begin(host, "play-pause");
    await host.advance(0);
    expect(host.page).toMatchObject({ open: true, visible: false });
    await host.fromPage({ type: "ready", deviceId: "dev-1" });
    await host.advance(0);
    expect(factory.client.calls).toContain("playOn:dev-1");
    await host.advance(1000);
    expect(session.status).toBe("playing");
    expect(host.actions()).toEqual(
      expect.arrayContaining(["player.start", "player.ready", "control.play-here"]),
    );
    expect(host.audits.find((a) => a.action === "control.play-here").details).toEqual({ ok: true });
  });

  it("reuses a ready player and stops it on request", async () => {
    const { host, factory } = await start();
    begin(host, "play-here");
    await host.advance(0);
    await host.fromPage({ type: "ready", deviceId: "dev-1" });
    await host.advance(1000);
    await host.command("play-here");
    expect(host.page.calls.filter(([c]) => c === "open")).toHaveLength(1);
    expect(factory.client.calls.filter((c) => c.startsWith("playOn:"))).toHaveLength(2);
    await host.command("stop-here");
    expect(host.page.open).toBe(false);
    expect(host.actions()).toContain("player.stop");
  });

  it("tells the user why Spotify's player failed", async () => {
    for (const [kind, key] of [
      ["account_error", "player-error-premium"],
      ["authentication_error", "player-error-sign-in"],
      ["token", "player-error-sign-in"],
      ["initialization_error", "player-error-unsupported"],
      ["playback_error", "player-error-other"],
    ]) {
      const { host, factory } = await start();
      begin(host, "play-here");
      await host.advance(0);
      await host.fromPage({ type: "error", kind });
      await host.advance(0);
      expect(host.toasts, kind).toEqual([EN.get(key)]);
      expect(factory.client.calls.some((c) => c.startsWith("playOn:"))).toBe(false);
      const done = host.audits.find((a) => a.action === "control.play-here");
      expect(done.details).toEqual({ ok: false, code: kind });
    }
  });

  it("gives up when the page never gets ready, or is closed", async () => {
    const slow = await start();
    begin(slow.host, "play-here");
    await slow.host.advance(READY_TIMEOUT_MS);
    expect(slow.host.toasts).toEqual([EN.get("player-error-other")]);

    const closed = await start();
    begin(closed.host, "play-here");
    await closed.host.advance(0);
    await closed.host.closePage();
    await closed.host.advance(0);
    expect(closed.host.actions()).toContain("player.closed");
    expect(closed.host.toasts).toEqual([EN.get("player-error-other")]);
  });

  it("forgets the device when the page says it is gone", async () => {
    const { host, factory } = await start();
    begin(host, "play-here");
    await host.advance(0);
    await host.fromPage({ type: "ready", deviceId: "dev-1" });
    await host.advance(1000);
    await host.fromPage({ type: "not-ready" });
    begin(host, "play-here");
    await host.advance(0);
    await host.fromPage({ type: "ready", deviceId: "dev-2" });
    await host.advance(0);
    expect(factory.client.calls).toContain("playOn:dev-2");
  });

  it("ignores messages it does not know", async () => {
    const { host } = await start();
    for (const m of [null, "x", { type: "error", kind: "made-up" }, { type: "ready" }]) {
      await host.fromPage(m);
    }
    expect(host.actions()).toContain("player.error");
    expect(host.audits.find((a) => a.action === "player.error").details).toEqual({
      code: "unknown",
    });
    expect(host.actions()).not.toContain("player.ready");
  });

  it("says it can't play music itself on a Tilefold without pages", async () => {
    const { host, factory, session } = await start({ page: false });
    expect(session.status).toBe("no-device");
    await host.command("play-here");
    expect(host.toasts).toEqual([EN.get("player-unavailable")]);
    // Play keeps its old meaning: ask Spotify to play wherever it last played.
    await host.command("play-pause");
    expect(factory.client.calls).toContain("play");
  });
});
