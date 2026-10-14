/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Built tile tests
 *
 * Runs the built main.js — the exact file Tilefold loads, with the real
 * Spotify client bundled in — against the fake Tilefold host and a fake
 * Spotify Web API: it registers everything up front, sends nothing
 * without a network, shows the track once the user has signed in through
 * Tilefold (never sending a token of its own), plays, pauses, skips and
 * changes the volume with the right requests, handles a missing or
 * refused sign-in, Premium, no device, server
 * errors and rate limits, keeps the scene within Tilefold's limits, and
 * shows every state in every language it ships.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { svgOf } from "../../../examples/tuneboard/src/render/svg.js";
import { COMMANDS } from "../../../examples/tuneboard/src/tile/commands.js";
import { POLL_MS } from "../../../examples/tuneboard/src/tile/session.js";
import { SETTINGS } from "../../../examples/tuneboard/src/tile/settings.js";
import { CARD_ID, buttonId } from "../../../examples/tuneboard/src/tile/view.js";
import { createFakeApi } from "../support/fake-api.js";
import { ROOT, createHost, drain, messagesOf } from "../support/fake-tf.js";

/** Gives every start its own module instance, like a fresh worker. */
let starts = 0;

/**
 * Starts the built main.js against a fake host and (unless `net: false`)
 * the fake API.
 *
 * @param {{ net?: boolean, api?: ReturnType<typeof createFakeApi>, settings?: object,
 *           store?: object, locale?: string, fetch?: Function }} [opts]
 */
async function startBuilt(opts = {}) {
  const api = opts.api ?? createFakeApi();
  const { host, tf } = createHost({
    net: opts.net ?? true,
    fetch: opts.fetch ?? api.fetch,
    settings: opts.settings ?? {},
    signedIn: api.signedIn,
    store: opts.store,
    locale: opts.locale,
  });
  starts += 1;
  const mod = await import(`${pathToFileURL(join(ROOT, "main.js")).href}?start=${starts}`);
  mod.default(tf);
  await drain();
  return { host, api };
}

/** The decoded card. */
const card = (host) => svgOf(host.item(CARD_ID).image);

/** The requests to one player path, e.g. "GET " or "POST /next". */
const calls = (api, what) =>
  api.log.filter(
    (r) => `${r.method} ${new URL(r.url).pathname.replace("/v1/me/player", "")}` === what,
  ).length;

/** Checks the current scene against Tilefold's overlay limits. */
function expectWithinLimits(host) {
  const items = host.overlay.items;
  expect(items.length).toBeLessThanOrEqual(8);
  let chars = 0;
  for (const item of items) {
    expect(item.id.length).toBeLessThanOrEqual(32);
    expect(item.w).toBeLessThanOrEqual(256);
    expect(item.h).toBeLessThanOrEqual(256);
    expect(item.label.length).toBeLessThanOrEqual(80);
    expect(item.image).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    chars += item.image.length;
  }
  expect(chars).toBeLessThan(1_000_000);
}

/** The locales the tile ships. */
const LOCALES = readdirSync(join(ROOT, "locales"));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("built main.js", () => {
  it("registers every setting, command and listener at once", async () => {
    const { host } = await startBuilt();
    expect(host.regs.filter((r) => r.kind === "setting").map((r) => r.key)).toEqual(
      SETTINGS.map((s) => s.key),
    );
    expect(host.regs.filter((r) => r.kind === "command").map((r) => r.id)).toEqual(
      COMMANDS.map((c) => c.id),
    );
    expect(host.regs.filter((r) => r.kind === "hook")).toHaveLength(9);
  });

  it("sends nothing anywhere when Tilefold offers no network", async () => {
    const { host, api } = await startBuilt({ net: false });
    await host.command("toggle");
    for (const c of COMMANDS) await host.command(c.id);
    await host.advance(POLL_MS * 3);
    expect(api.log).toHaveLength(0);
  });

  it("shows the track once signed in, and only talks to Spotify's API", async () => {
    const { host, api } = await startBuilt();
    await host.command("toggle");
    expect(card(host)).toContain("Clair de Lune");
    expect(card(host)).toContain("Claude Debussy");
    expectWithinLimits(host);
    for (const r of api.log) {
      expect(new URL(r.url).host).toBe("api.spotify.com");
      expect(r.auth).toBe("spotify");
      expect(JSON.stringify(r.headers ?? {})).not.toMatch(/authorization|bearer/i);
    }
  });

  it("plays, pauses, skips and changes the volume", async () => {
    const { host, api } = await startBuilt();
    await host.command("toggle");
    await host.command("play-pause");
    expect(calls(api, "PUT /pause")).toBe(1);
    expect(host.item(buttonId("play")).label).toBe("Play");
    await host.click(buttonId("play"));
    expect(calls(api, "PUT /play")).toBe(1);
    await host.command("next");
    await host.advance(1000);
    expect(card(host)).toContain("Rêverie");
    await host.command("previous");
    await host.command("volume-up");
    await host.advance(400);
    expect(api.log.some((r) => r.url.endsWith("/volume?volume_percent=60"))).toBe(true);
    expect(api.player.volume).toBe(60);
    expectWithinLimits(host);
  });

  it("asks to sign in, sending nothing, until the user signs in in Settings", async () => {
    const api = createFakeApi({ signedIn: false });
    const { host } = await startBuilt({ api });
    await host.command("toggle");
    expect(card(host)).toContain("Not signed in to Spotify");
    expect(api.log).toHaveLength(0);
    api.signedIn = true;
    host.signedIn = true;
    await host.advance(5000);
    expect(card(host)).toContain("Clair de Lune");
  });

  it("asks to sign in again when Spotify refuses the token", async () => {
    const api = createFakeApi({ tokenValid: false });
    const { host } = await startBuilt({ api });
    await host.command("toggle");
    expect(card(host)).toContain("Not signed in to Spotify");
    expect(host.actions()).toContain("auth.failed");
    const n = api.log.length;
    await host.advance(POLL_MS * 4);
    expect(api.log.length).toBe(n);
  });

  it("shows signed out when Tilefold has lost the sign-in", async () => {
    const api = createFakeApi();
    const { host } = await startBuilt({ api });
    await host.command("toggle");
    api.signedIn = false;
    await host.advance(POLL_MS);
    expect(card(host)).toContain("Not signed in to Spotify");
  });

  it("says Premium is needed when a control is refused", async () => {
    const { host } = await startBuilt({ api: createFakeApi({ premium: false }) });
    await host.command("toggle");
    await host.command("next");
    expect(card(host)).toContain("Spotify Premium needed");
  });

  it("says nothing is playing, and can start playback", async () => {
    const { host, api } = await startBuilt({ api: createFakeApi({ item: null }) });
    await host.command("toggle");
    expect(card(host)).toContain("Nothing is playing");
    await host.command("play-pause");
    expect(calls(api, "PUT /play")).toBe(1);
  });

  it("backs off after server errors", async () => {
    const api = createFakeApi();
    let failing = false;
    const fetch = async (url, init) => {
      if (failing && url.startsWith("https://api.spotify.com")) {
        api.log.push({ method: init.method ?? "GET", url });
        return { status: 503, headers: {}, json: async () => ({}) };
      }
      return api.fetch(url, init);
    };
    const { host } = await startBuilt({ api, fetch });
    await host.command("toggle");
    failing = true;
    await host.advance(POLL_MS);
    expect(card(host)).toContain("Spotify didn&apos;t answer");
    const n = calls(api, "GET ");
    await host.advance(POLL_MS * 3);
    // 5 s then 10 s then 20 s: two more asks in 15 s, not three.
    expect(calls(api, "GET ")).toBe(n + 2);
    failing = false;
    await host.advance(20000);
    expect(card(host)).toContain("Clair de Lune");
  });

  it("waits as long as Spotify's Retry-After asks", async () => {
    const { host, api } = await startBuilt();
    await host.command("toggle");
    api.rateLimitOnce = "30";
    await host.advance(POLL_MS);
    const n = calls(api, "GET ");
    await host.advance(29000);
    expect(calls(api, "GET ")).toBe(n);
    await host.advance(1500);
    expect(calls(api, "GET ")).toBe(n + 1);
  });
});

describe("every state in every language", () => {
  /** Ways to reach each state with the fake API. */
  const SCENARIOS = {
    "no-network": { net: false },
    "signed-out": { api: () => createFakeApi({ signedIn: false }) },
    "no-device": { api: () => createFakeApi({ item: null }) },
    error: {
      fetch: async () => ({ status: 500, headers: {}, json: async () => ({}) }),
    },
    playing: {},
  };

  for (const locale of LOCALES) {
    it(`shows every state in ${locale}`, async () => {
      const m = messagesOf(locale);
      for (const [state, s] of Object.entries(SCENARIOS)) {
        const { host } = await startBuilt({ ...s, api: s.api ? s.api() : undefined, locale });
        await host.command("toggle");
        expectWithinLimits(host);
        const label = host.item(CARD_ID).label;
        if (state === "playing") {
          expect(label, `${locale} ${state}`).toBe(
            m
              .get("card-label-playing")
              .replace("{ $title }", "Clair de Lune")
              .replace("{ $artists }", "Claude Debussy")
              .slice(0, 80),
          );
        } else {
          expect(label.startsWith(m.get(`state-${state}`).slice(0, 40)), `${locale} ${state}`).toBe(
            true,
          );
        }
        for (const b of ["previous", "play", "next", "volume", "playlists"]) {
          expect(host.item(buttonId(b)).label.length).toBeGreaterThan(0);
        }
      }
      // Premium and paused need a control first.
      const premium = await startBuilt({ api: createFakeApi({ premium: false }), locale });
      await premium.host.command("toggle");
      await premium.host.command("next");
      expect(premium.host.item(CARD_ID).label.startsWith(m.get("state-premium").slice(0, 40))).toBe(
        true,
      );
      const paused = await startBuilt({ locale });
      await paused.host.command("toggle");
      await paused.host.command("play-pause");
      expect(card(paused.host)).toContain(
        m.get("card-paused").replace(/&/g, "&amp;").replace(/'/g, "&apos;"),
      );
      await drain();
    });
  }
});
