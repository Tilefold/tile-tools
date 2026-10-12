/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile behaviour tests
 *
 * The whole tile against a fake Tilefold and a fake Spotify client, the
 * way a user meets it: registration up front; the card with no network,
 * signed out and signed in; polling that follows visibility, focus and the
 * poll setting; controls by command (also while hidden) and by click;
 * the progress clock; sign-in failures, token rotation and pasting a new
 * token; restoring the card after a restart; hidden overlays; layout
 * changes; and an activity trail that never carries a token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { svgOf } from "../../../examples/tuneboard/src/render/svg.js";
import { CONFIRM_MS, runTuneboard } from "../../../examples/tuneboard/src/tile/run.js";
import { POLL_MS } from "../../../examples/tuneboard/src/tile/session.js";
import { COMMANDS } from "../../../examples/tuneboard/src/tile/commands.js";
import { registerSettings } from "../../../examples/tuneboard/src/tile/settings.js";
import { KEYS, fingerprint } from "../../../examples/tuneboard/src/tile/store.js";
import { CARD_ID, buttonId } from "../../../examples/tuneboard/src/tile/view.js";
import { createFactory } from "../support/fake-spotify.js";
import { createHost, drain } from "../support/fake-tf.js";

/** Signed-in settings. */
const SIGNED_IN = { clientId: "cid-123", refreshToken: "pasted-token" };

/**
 * Starts the tile the way main.js does, with network and a fake Spotify
 * unless told otherwise.
 *
 * @param {{ net?: boolean, factory?: boolean, settings?: object, store?: object,
 *           client?: object, overlaysOff?: boolean }} [opts]
 */
async function start(opts = {}) {
  const { host, tf } = createHost({
    net: opts.net ?? true,
    settings: opts.settings ?? SIGNED_IN,
    store: opts.store,
    overlaysOff: opts.overlaysOff,
  });
  const factory = createFactory(opts.client);
  registerSettings(tf);
  const handles = runTuneboard(
    tf,
    opts.factory === false ? {} : { createSpotify: factory.createSpotify },
  );
  await drain();
  return { host, tf, factory, ...handles };
}

/** The decoded SVG of the card. */
const card = (host) => svgOf(host.item(CARD_ID).image);

/** How many times the current client asked what is playing. */
const asks = (factory) => factory.client.calls.filter((c) => c === "getPlayback").length;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("registration", () => {
  it("registers settings, commands and listeners before any await", () => {
    const { host, tf } = createHost();
    registerSettings(tf);
    runTuneboard(tf, {});
    const kinds = host.regs.map((r) => r.kind);
    expect(kinds.filter((k) => k === "setting")).toHaveLength(5);
    expect(kinds.filter((k) => k === "command")).toHaveLength(COMMANDS.length);
    expect(
      host.regs
        .filter((r) => r.kind === "hook")
        .map((r) => r.event)
        .sort(),
    ).toEqual(
      [
        "app.ready",
        "overlay.hidden",
        "overlay.layout",
        "overlay.pointer",
        "setting.changed",
        "user.active",
        "user.idle",
        "window.blurred",
        "window.focused",
      ].sort(),
    );
  });
});

describe("without network or sign-in", () => {
  it("says it can't reach Spotify when Tilefold offers no network", async () => {
    const { host, factory } = await start({ net: false });
    await host.command("toggle");
    expect(card(host)).toContain("Can&apos;t reach Spotify yet");
    expect(factory.builds).toHaveLength(0);
    expect(host.requests).toHaveLength(0);
  });

  it("says the same when no Spotify client is plugged in", async () => {
    const { host } = await start({ factory: false });
    await host.command("toggle");
    expect(card(host)).toContain("Can&apos;t reach Spotify yet");
  });

  it("asks for sign-in when the settings are empty", async () => {
    const { host, factory } = await start({ settings: {} });
    await host.command("toggle");
    expect(card(host)).toContain("Not signed in to Spotify");
    expect(factory.builds).toHaveLength(0);
  });

  it("records a refused control when nothing can be controlled", async () => {
    const { host } = await start({ net: false });
    await host.command("next");
    expect(host.audits).toContainEqual({
      action: "control.next",
      details: { ok: false, code: "unavailable" },
    });
  });
});

describe("signed in", () => {
  it("builds the client from the settings and the network", async () => {
    const { host, factory } = await start();
    await host.command("toggle");
    expect(factory.builds).toHaveLength(1);
    expect(factory.builds[0]).toMatchObject({ clientId: "cid-123", refreshToken: "pasted-token" });
    expect(factory.builds[0].fetchFn).toBeTypeOf("function");
    expect(card(host)).toContain("Clair de Lune");
    expect(host.item(buttonId("play")).label).toBe("Pause");
  });

  it("polls while the card is on screen, and stops when it is hidden", async () => {
    const { host, factory } = await start();
    await host.command("toggle");
    const first = asks(factory);
    await host.advance(POLL_MS * 3);
    expect(asks(factory)).toBe(first + 3);
    await host.command("toggle");
    expect(host.overlay).toBeNull();
    const hidden = asks(factory);
    await host.advance(POLL_MS * 4);
    expect(asks(factory)).toBe(hidden);
  });

  it("stops polling while the user is away and asks at once on return", async () => {
    const { host, factory } = await start();
    await host.command("toggle");
    await host.emit("window.blurred");
    const away = asks(factory);
    await host.advance(POLL_MS * 4);
    expect(asks(factory)).toBe(away);
    await host.emit("window.focused");
    await host.advance(300);
    expect(asks(factory)).toBe(away + 1);
    await host.emit("user.idle");
    await host.advance(POLL_MS * 2);
    expect(asks(factory)).toBe(away + 1);
    await host.emit("user.active");
    await host.advance(300);
    expect(asks(factory)).toBe(away + 2);
  });

  it("asks once and then waits when polling is turned off", async () => {
    const { host, factory } = await start({ settings: { ...SIGNED_IN, poll: false } });
    await host.command("toggle");
    expect(card(host)).toContain("Clair de Lune");
    const n = asks(factory);
    await host.advance(POLL_MS * 4);
    expect(asks(factory)).toBe(n);
  });

  it("moves the progress bar every second while playing", async () => {
    const { host } = await start({ settings: { ...SIGNED_IN, poll: false } });
    await host.command("toggle");
    const before = host.item(CARD_ID).image;
    const updates = host.updates.length;
    await host.advance(1000);
    expect(host.item(CARD_ID).image).not.toBe(before);
    expect(host.updates.length).toBe(updates + 1);
    expect(host.updates.at(-1).items.map((i) => i.id)).toEqual([CARD_ID]);
  });
});

describe("controls", () => {
  it("pauses and plays by command, confirming with Spotify shortly after", async () => {
    const { host, factory } = await start({ settings: { ...SIGNED_IN, poll: false } });
    await host.command("toggle");
    await host.command("play-pause");
    expect(factory.client.calls).toContain("pause");
    expect(host.item(buttonId("play")).label).toBe("Play");
    expect(card(host)).toContain("Paused");
    const n = asks(factory);
    await host.advance(CONFIRM_MS);
    expect(asks(factory)).toBe(n + 1);
    await host.command("play-pause");
    expect(factory.client.calls).toContain("play");
    expect(host.actions()).toEqual(expect.arrayContaining(["control.pause", "control.play"]));
  });

  it("skips and changes the volume by command", async () => {
    const { host, factory } = await start();
    await host.command("toggle");
    await host.command("next");
    await host.command("previous");
    await host.command("volume-up");
    await host.command("volume-down");
    expect(factory.client.calls).toEqual(
      expect.arrayContaining(["next", "previous", "setVolume:60", "setVolume:50"]),
    );
    expect(host.audits).toContainEqual({
      action: "control.volume",
      details: { ok: true, volume: 60 },
    });
    await host.advance(CONFIRM_MS);
    expect(card(host)).toContain("Next Song");
  });

  it("works from the keyboard while the card is hidden", async () => {
    const { host, factory } = await start();
    await host.command("next");
    expect(factory.client.calls).toContain("next");
    expect(host.overlay).toBeNull();
    expect(host.shows).toBe(0);
  });

  it("runs the buttons and refreshes from the card when clicked", async () => {
    const { host, factory } = await start({ settings: { ...SIGNED_IN, poll: false } });
    await host.command("toggle");
    await host.click(buttonId("next"));
    expect(factory.client.calls).toContain("next");
    const n = asks(factory);
    await host.click(CARD_ID);
    expect(asks(factory)).toBe(n + 1);
    expect(host.actions()).toContain("control.refresh");
  });

  it("ignores clicks while hidden and other pointer events", async () => {
    const { host, factory } = await start();
    await host.click(buttonId("next"));
    await host.command("toggle");
    await host.emit("overlay.pointer", { type: "drag", item: buttonId("next") });
    expect(factory.client.calls).not.toContain("next");
  });

  it("shows Premium needed when Spotify refuses a control, and retries on refresh", async () => {
    const { host, factory } = await start();
    await host.command("toggle");
    factory.client.failNext("premium");
    await host.command("next");
    expect(card(host)).toContain("Spotify Premium needed");
    expect(host.audits).toContainEqual({
      action: "control.next",
      details: { ok: false, code: "premium" },
    });
    await host.command("refresh");
    expect(factory.builds).toHaveLength(2);
    expect(card(host)).toContain("Clair de Lune");
  });
});

describe("signing in", () => {
  it("shows signed out, records it and forgets a saved token when Spotify refuses it", async () => {
    const store = { auth: { v: 1, seed: fingerprint("pasted-token"), token: "rotated" } };
    const { host, factory } = await start({ store });
    await host.command("toggle");
    expect(factory.builds[0].refreshToken).toBe("rotated");
    factory.client.failNext("auth");
    await host.advance(POLL_MS);
    expect(card(host)).toContain("Not signed in to Spotify");
    expect(host.actions()).toContain("auth.failed");
    expect(host.store.get(KEYS.auth)).toBeNull();
    // Polling stops until the user acts.
    const n = asks(factory);
    await host.advance(POLL_MS * 3);
    expect(asks(factory)).toBe(n);
  });

  it("saves a rotated token and signs in with it after a restart", async () => {
    const first = await start();
    await first.host.command("toggle");
    first.factory.builds[0].onRefreshToken("rotated-1");
    await drain();
    expect(first.host.actions()).toContain("auth.rotated");

    const again = await start({ store: Object.fromEntries(first.host.store) });
    await again.host.command("toggle");
    expect(again.factory.builds[0].refreshToken).toBe("rotated-1");
  });

  it("signs in again with a newly pasted token", async () => {
    const { host, factory } = await start({
      store: { auth: { v: 1, seed: fingerprint("pasted-token"), token: "rotated" } },
    });
    await host.command("toggle");
    await host.setSetting("refreshToken", "  fresh-token \n");
    expect(factory.builds).toHaveLength(2);
    expect(factory.builds[1].refreshToken).toBe("fresh-token");
  });

  it("signs out when the client id is cleared", async () => {
    const { host } = await start();
    await host.command("toggle");
    await host.setSetting("clientId", "");
    expect(card(host)).toContain("Not signed in to Spotify");
  });

  it("never puts a token or a track title in the activity trail", async () => {
    const { host, factory } = await start();
    await host.command("toggle");
    factory.builds[0].onRefreshToken("rotated-secret");
    await host.command("next");
    factory.client.failNext("auth");
    await host.advance(POLL_MS);
    const trail = JSON.stringify(host.audits) + host.logs.join("\n") + host.errors.join("\n");
    for (const secret of ["pasted-token", "rotated-secret", "cid-123", "Clair de Lune"])
      expect(trail).not.toContain(secret);
  });
});

describe("showing and the window", () => {
  it("records showing and hiding and remembers it", async () => {
    const { host } = await start();
    await host.command("toggle");
    expect(host.store.get(KEYS.visible)).toBe(true);
    await host.command("toggle");
    expect(host.store.get(KEYS.visible)).toBe(false);
    expect(host.actions()).toEqual(
      expect.arrayContaining(["view.show", "view.hide", "state.change"]),
    );
  });

  it("comes back on screen after a restart when it was left showing", async () => {
    const { host } = await start({ store: { visible: true } });
    await host.emit("app.ready");
    expect(host.overlay).not.toBeNull();
    expect(card(host)).toContain("Clair de Lune");
  });

  it("stays hidden after a restart when it was hidden", async () => {
    const { host } = await start({ store: { visible: false } });
    await host.emit("app.ready");
    expect(host.overlay).toBeNull();
  });

  it("shows the card once overlays are allowed again", async () => {
    const { host } = await start({ overlaysOff: true });
    await host.command("toggle");
    expect(host.overlay).toBeNull();
    host.overlaysOff = false;
    await host.advance(POLL_MS);
    expect(host.overlay).not.toBeNull();
  });

  it("redraws whole after the user hides overlays", async () => {
    const { host } = await start();
    await host.command("toggle");
    const shows = host.shows;
    await host.emit("overlay.hidden");
    await host.advance(POLL_MS);
    expect(host.shows).toBe(shows + 1);
  });

  it("moves with the pane and with the corner setting", async () => {
    const { host } = await start();
    await host.command("toggle");
    const x = host.item(CARD_ID).x;
    await host.emit("overlay.layout", {
      content: { w: 800, h: 600 },
      panes: [{ x: 0, y: 0, w: 800, h: 600, focused: true }],
    });
    expect(host.item(CARD_ID).x).toBeLessThan(x);
    await host.setSetting("corner", "top-left");
    expect(host.item(CARD_ID)).toMatchObject({ x: 12, y: 52 });
  });

  it("keeps going when the window refuses an update", async () => {
    const { host, tf } = await start();
    await host.command("toggle");
    const update = tf.overlay.update;
    tf.overlay.update = async () => {
      throw new Error("scene lost");
    };
    await host.command("volume-up");
    expect(host.errors.some((e) => e.includes("scene lost"))).toBe(true);
    tf.overlay.update = update;
    const shows = host.shows;
    await host.command("volume-down");
    expect(host.shows).toBe(shows + 1);
  });
});
