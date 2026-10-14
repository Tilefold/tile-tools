/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the Library window
 *
 * "Show playlists" opens Tuneboard's page as a window that keeps running
 * when closed, and tells it to show the Library in the user's language (at
 * once, and again when a newly opened page says hello). The page's requests
 * for playlists are answered a page at a time with each owner line
 * translated; a pick plays where music already plays, or starts the player
 * inside Tilefold when nothing does. Failures reach the page as the user's
 * own message; bad requests from the page are ignored; a Tilefold without
 * pages says so. The view (thumbnails or list) the user picks is
 * remembered and sent each time the Library opens. Every step is recorded,
 * never with a name or URI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTuneboard } from "../../../examples/tuneboard/src/tile/run.js";
import { registerSettings } from "../../../examples/tuneboard/src/tile/settings.js";
import { createFactory, playlist } from "../support/fake-spotify.js";
import { createHost, drain, messagesOf } from "../support/fake-tf.js";

const EN = messagesOf("en");

/** Starts Tuneboard with three playlists; `track: null` means nothing plays anywhere. */
async function start({ page = true, track, signedIn = true } = {}) {
  const { host, tf } = createHost({ net: true, page, signedIn });
  const factory = createFactory({ track, playlists: [1, 2, 3].map(playlist) });
  registerSettings(tf);
  const handles = runTuneboard(tf, { createSpotify: factory.createSpotify });
  await drain();
  await host.command("refresh");
  return { host, tf, factory, ...handles };
}

/** What the tile posted to its page. */
const posts = (host) => host.page.calls.filter(([c]) => c === "post").map(([, m]) => m);

/** The last message the tile posted with `do`. */
const lastPost = (host, kind) =>
  posts(host)
    .filter((m) => m.do === kind)
    .at(-1);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the Library", () => {
  it("opens the page as a window that keeps running, in the user's language", async () => {
    const { host } = await start();
    await host.command("library");
    expect(host.page.calls[0]).toEqual(["open", { visible: true, keepRunning: true }]);
    expect(lastPost(host, "library")).toEqual({
      do: "library",
      lang: "en",
      dir: "ltr",
      view: "grid",
      strings: {
        title: EN.get("library-title"),
        refresh: EN.get("library-refresh"),
        loading: EN.get("library-loading"),
        empty: EN.get("library-empty"),
        more: EN.get("library-more"),
        viewGrid: EN.get("library-view-grid"),
        viewList: EN.get("library-view-list"),
      },
    });
    expect(host.actions()).toContain("library.show");
  });

  it("shows the Library when a newly loaded page says hello, but only if asked for", async () => {
    const { host } = await start();
    await host.fromPage({ type: "hello" });
    expect(posts(host)).toEqual([]);
    await host.command("library");
    const before = posts(host).length;
    await host.fromPage({ type: "hello" });
    await host.advance(0);
    expect(posts(host)).toHaveLength(before + 1);
    // A closed page forgets that the Library was wanted.
    await host.closePage();
    host.page.open = true;
    await host.fromPage({ type: "hello" });
    await host.advance(0);
    expect(posts(host)).toHaveLength(before + 1);
  });

  it("answers requests for playlists a page at a time, with translated owner lines", async () => {
    const { host, factory } = await start();
    await host.command("library");
    await host.fromPage({ type: "want-playlists", offset: 0 });
    await host.advance(0);
    const first = lastPost(host, "playlists");
    expect(first).toMatchObject({ offset: 0, total: 3, nextOffset: 2 });
    expect(first.items[0]).toEqual({
      ...playlist(1),
      byline: EN.get("library-by").replace("{ $owner }", "Ana"),
    });
    await host.fromPage({ type: "want-playlists", offset: 2 });
    await host.advance(0);
    expect(lastPost(host, "playlists")).toMatchObject({ offset: 2, nextOffset: null });
    // A bad offset asks from the start.
    await host.fromPage({ type: "want-playlists", offset: -4 });
    await host.advance(0);
    expect(factory.client.calls.filter((c) => c.startsWith("playlists:"))).toEqual([
      "playlists:0",
      "playlists:2",
      "playlists:0",
    ]);
    const loads = host.audits.filter((a) => a.action === "library.load");
    expect(loads.map((a) => a.details)).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
  });

  it("plays a pick where music already plays", async () => {
    const { host, factory } = await start();
    await host.command("library");
    await host.fromPage({ type: "play-playlist", uri: "spotify:playlist:pl2" });
    await host.advance(0);
    expect(factory.client.calls).toContain("playContext:spotify:playlist:pl2:active");
    expect(host.page.calls.filter(([c]) => c === "open")).toHaveLength(1);
    expect(lastPost(host, "playing")).toEqual({
      do: "playing",
      uri: "spotify:playlist:pl2",
      message: EN.get("library-playing"),
    });
    const played = host.audits.find((a) => a.action === "library.play");
    // Where it played, never what.
    expect(played.details).toEqual({ ok: true, via: "device" });
  });

  it("starts the player inside Tilefold when nothing plays anywhere", async () => {
    const { host, factory } = await start({ track: null });
    await host.command("library");
    void host.fromPage({ type: "play-playlist", uri: "spotify:playlist:pl1" });
    await host.advance(0);
    await host.fromPage({ type: "ready", deviceId: "dev-9" });
    await host.advance(0);
    expect(factory.client.calls).toEqual(
      expect.arrayContaining([
        "playContext:spotify:playlist:pl1:active",
        "playContext:spotify:playlist:pl1:dev-9",
      ]),
    );
    expect(host.audits.find((a) => a.action === "library.play").details).toEqual({
      ok: true,
      via: "tilefold",
    });
  });

  it("tells the page what went wrong, in the user's words", async () => {
    for (const [code, key] of [
      ["scope", "library-error-scope"],
      ["auth", "player-error-sign-in"],
      ["network", "library-error-network"],
      ["premium", "player-error-premium"],
      ["mystery", "library-error-other"],
    ]) {
      const { host, factory } = await start();
      await host.command("library");
      factory.client.failNext(code);
      await host.fromPage({ type: "want-playlists", offset: 0 });
      await host.advance(0);
      expect(lastPost(host, "library-error")).toEqual({
        do: "library-error",
        message: EN.get(key),
      });
      expect(host.audits.find((a) => a.action === "library.load").details).toEqual({
        ok: false,
        code,
      });
    }
  });

  it("reports a failed pick and ignores requests it can't trust", async () => {
    const { host, factory } = await start();
    await host.command("library");
    factory.client.failNext("premium");
    await host.fromPage({ type: "play-playlist", uri: "spotify:playlist:pl1" });
    await host.advance(0);
    expect(lastPost(host, "library-error").message).toBe(EN.get("player-error-premium"));
    const before = factory.client.calls.length;
    for (const bad of [
      { type: "play-playlist", uri: "spotify:album:1" },
      { type: "play-playlist" },
      { type: "unknown" },
      "text",
      null,
    ]) {
      await host.fromPage(bad);
    }
    await host.advance(0);
    expect(factory.client.calls.slice(before).filter((c) => c !== "getPlayback")).toEqual([]);
  });

  it("asks the user to sign in when there is no sign-in", async () => {
    const { host, factory } = await start({ signedIn: false });
    await host.command("library");
    await host.fromPage({ type: "want-playlists", offset: 0 });
    await host.advance(0);
    expect(factory.clients).toEqual([]);
    expect(lastPost(host, "library-error").message).toBe(EN.get("player-error-sign-in"));
  });

  it("remembers the view the user picks and opens with it next time", async () => {
    const { host } = await start();
    await host.command("library");
    for (const view of ["list", "sideways", 42]) await host.fromPage({ type: "set-view", view });
    await host.advance(0);
    expect(host.store.get("libraryView")).toBe("list");
    expect(host.audits.filter((a) => a.action === "library.view").map((a) => a.details)).toEqual([
      { to: "list" },
    ]);
    await host.command("library");
    expect(lastPost(host, "library").view).toBe("list");
    // A damaged saved value falls back to thumbnails.
    host.store.set("libraryView", "carousel");
    await host.command("library");
    expect(lastPost(host, "library").view).toBe("grid");
  });

  it("says this Tilefold can't show it without tile pages", async () => {
    const { host } = await start({ page: false });
    await host.command("library");
    expect(host.toasts).toContain(EN.get("player-unavailable"));
  });
});
