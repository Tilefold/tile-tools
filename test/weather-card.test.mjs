/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — tile tests
 *
 * The built tile against the fake Tilefold, the way a user meets it: what
 * it registers; the card on an older Tilefold, without a place, for a place
 * Open-Meteo doesn't know, when Tilefold refuses and when the service
 * fails; looking a place up once and the weather after it; checking only
 * while shown, on the chosen interval; coming back after a restart without
 * asking again; a click or the command refreshing; and Claude's summary
 * (asked only when turned on, with the fast model in the user's language;
 * "Don't send" respected until the user refreshes by hand; a missing key
 * explained) with an activity trail that never carries the place.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";
import { FORECAST } from "./weather-card-logic.test.mjs";

const DIR = fileURLToPath(new URL("../examples/weather-card/", import.meta.url));

const named = (name) => Object.assign(new Error(name), { name });

const BERLIN = {
  results: [{ name: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.41 }],
};

/** A fake Open-Meteo: places by name, and the same forecast for every place. */
function openMeteo({ places = { Berlin: BERLIN }, forecast = FORECAST } = {}) {
  return (url) => {
    const u = new URL(url);
    if (u.host === "geocoding-api.open-meteo.com") {
      return { status: 200, body: JSON.stringify(places[u.searchParams.get("name")] ?? {}) };
    }
    return { status: 200, body: JSON.stringify(forecast) };
  };
}

/** The card's picture as SVG text. */
const svgOf = (host) => {
  const url = host.item("card").image;
  return decodeURIComponent(url.slice(url.indexOf(",") + 1));
};

/** The card's visible text, line after line, joined with spaces. */
const textOf = (host) =>
  [...svgOf(host).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(" ");

const hosts = (host) => host.requests.map((r) => new URL(r.url).host);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:30:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("registration", () => {
  it("registers its settings and two commands, the toggle with a shortcut", async () => {
    const host = await startTile(DIR, { net: openMeteo() });
    const settings = host.regs.filter((r) => r.kind === "setting").map((r) => r.key);
    expect(settings).toEqual(["place", "units", "corner", "every", "summary"]);
    expect(host.regs.find((r) => r.key === "summary").default).toBe(false);
    expect(host.regs.filter((r) => r.kind === "command").map((r) => r.id)).toEqual([
      "toggle",
      "refresh",
    ]);
    expect(host.requests).toEqual([]);
  });
});

describe("the card's messages", () => {
  it("says this Tilefold is too old, and sends nothing, without tile networking", async () => {
    const host = await startTile(DIR, { settings: { place: "Berlin" } });
    await host.command("toggle");
    expect(host.item("card").label).toBe("Can't reach the weather service");
    expect(svgOf(host)).toContain("too old");
  });

  it("asks for a place before sending anything", async () => {
    const host = await startTile(DIR, { net: openMeteo() });
    await host.command("toggle");
    expect(host.item("card").label).toBe("Where are you?");
    expect(host.requests).toEqual([]);
  });

  it("names a place Open-Meteo doesn't know", async () => {
    const host = await startTile(DIR, { net: openMeteo(), settings: { place: "Atlantis" } });
    await host.command("toggle");
    expect(host.item("card").label).toBe("Place not found");
    expect(svgOf(host)).toContain("Atlantis");
    expect(hosts(host)).toEqual(["geocoding-api.open-meteo.com"]);
  });

  it("says where to allow it when Tilefold refuses the request", async () => {
    const host = await startTile(DIR, {
      settings: { place: "Berlin" },
      net: () => {
        throw named("PermissionDeniedError");
      },
    });
    await host.command("toggle");
    expect(host.item("card").label).toBe("Weather Card may not reach Open-Meteo");
    expect(svgOf(host)).toContain("Settings → Tiles");
  });

  it("says the service didn't answer on an error, and recovers at the next check", async () => {
    let fail = true;
    const meteo = openMeteo();
    const host = await startTile(DIR, {
      settings: { place: "Berlin" },
      net: (url) => (fail ? { status: 503, body: "" } : meteo(url)),
    });
    await host.command("toggle");
    expect(host.item("card").label).toBe("The weather service didn't answer");
    expect(host.audits.at(-1)).toEqual({
      action: "forecast",
      details: { ok: false, code: "HttpError" },
    });
    fail = false;
    await host.advance(30 * 60_000);
    expect(host.item("card").label).toBe("Weather in Berlin: 18°, Partly cloudy");
  });
});

describe("the weather", () => {
  it("looks the place up in the user's language, then gets the weather", async () => {
    const host = await startTile(DIR, { net: openMeteo(), settings: { place: " Berlin " } });
    await host.command("toggle");
    expect(hosts(host)).toEqual(["geocoding-api.open-meteo.com", "api.open-meteo.com"]);
    const geo = new URL(host.requests[0].url);
    expect(geo.searchParams.get("name")).toBe("Berlin");
    expect(geo.searchParams.get("language")).toBe("en");
    expect(new URL(host.requests[1].url).searchParams.get("latitude")).toBe("52.52");
    // No credential: Open-Meteo needs no key.
    expect(host.requests.every((r) => r.init.auth === undefined)).toBe(true);
    expect(host.item("card").label).toBe("Weather in Berlin: 18°, Partly cloudy");
    const svg = svgOf(host);
    expect(svg).toContain("Berlin");
    expect(svg).toContain("Feels 15° · 12 km/h");
    expect(svg).toContain("16:00");
    expect(host.audits).toContainEqual({ action: "forecast", details: { ok: true } });
    // The trail never carries the place.
    expect(JSON.stringify(host.audits)).not.toContain("Berlin");
  });

  it("refreshes from the command and a click without looking the place up again", async () => {
    const host = await startTile(DIR, { net: openMeteo(), settings: { place: "Berlin" } });
    await host.command("toggle");
    await host.command("refresh");
    await host.emit("overlay.pointer", { item: "card", type: "click", x: 1, y: 1 });
    await host.advance(0);
    expect(hosts(host)).toEqual([
      "geocoding-api.open-meteo.com",
      "api.open-meteo.com",
      "api.open-meteo.com",
      "api.open-meteo.com",
    ]);
  });

  it("checks on the chosen interval while shown, and sends nothing while hidden", async () => {
    const host = await startTile(DIR, {
      net: openMeteo(),
      settings: { place: "Berlin", every: "15" },
    });
    await host.command("toggle");
    expect(host.requests).toHaveLength(2);
    await host.advance(15 * 60_000);
    expect(host.requests).toHaveLength(3);
    await host.command("toggle");
    expect(host.overlay).toBeNull();
    await host.advance(3 * 60 * 60_000);
    expect(host.requests).toHaveLength(3);
  });

  it("looks a new place up and asks in the new units when the settings change", async () => {
    const host = await startTile(DIR, {
      net: openMeteo({ places: { Berlin: BERLIN, Oslo: BERLIN } }),
      settings: { place: "Berlin" },
    });
    await host.command("toggle");
    await host.setSetting("units", "imperial");
    await host.advance(0);
    expect(new URL(host.requests.at(-1).url).searchParams.get("temperature_unit")).toBe(
      "fahrenheit",
    );
    await host.setSetting("place", "Oslo");
    await host.advance(0);
    expect(new URL(host.requests.at(-2).url).searchParams.get("name")).toBe("Oslo");
  });

  it("comes back after a restart with the last weather, without asking again", async () => {
    const first = await startTile(DIR, { net: openMeteo(), settings: { place: "Berlin" } });
    await first.command("toggle");
    const store = Object.fromEntries(first.store);
    const again = await startTile(DIR, { net: openMeteo(), settings: { place: "Berlin" }, store });
    await again.emit("app.ready");
    await again.advance(0);
    expect(again.item("card").label).toBe("Weather in Berlin: 18°, Partly cloudy");
    expect(again.requests).toEqual([]);
  });

  it("speaks the user's language", async () => {
    const host = await startTile(DIR, {
      net: openMeteo(),
      settings: { place: "Berlin" },
      locale: "de",
    });
    await host.command("toggle");
    expect(new URL(host.requests[0].url).searchParams.get("language")).toBe("de");
    expect(host.item("card").label).toBe("Wetter in Berlin: 18°, Teilweise bewölkt");
  });
});

describe("Claude's summary", () => {
  it("is never asked for while turned off", async () => {
    const ai = vi.fn(() => "Nice day.");
    const host = await startTile(DIR, { net: openMeteo(), settings: { place: "Berlin" }, ai });
    await host.command("toggle");
    expect(host.questions).toEqual([]);
  });

  it("asks the fast model in the user's language and shows the answer", async () => {
    const host = await startTile(DIR, {
      net: openMeteo(),
      settings: { place: "Berlin", summary: true },
      ai: () => '"Umbrella after four; clear by evening."',
    });
    await host.command("toggle");
    await host.advance(0);
    expect(host.questions).toHaveLength(1);
    const q = host.questions[0];
    expect(q).toMatchObject({ model: "fast", maxTokens: 80 });
    expect(q.system).toContain("in English");
    expect(q.prompt).toContain("Place: Berlin, Germany");
    expect(textOf(host)).toContain("Umbrella after four; clear by evening.");
    expect(host.audits).toContainEqual({ action: "summary", details: { ok: true } });
  });

  it("respects Don't send until the user refreshes by hand", async () => {
    const host = await startTile(DIR, {
      net: openMeteo(),
      settings: { place: "Berlin", summary: true },
      ai: () => {
        throw named("AiDeclinedError");
      },
    });
    await host.command("toggle");
    await host.advance(0);
    expect(host.questions).toHaveLength(1);
    expect(svgOf(host)).not.toContain("Claude");
    await host.advance(30 * 60_000);
    expect(host.questions).toHaveLength(1);
    await host.command("refresh");
    await host.advance(0);
    expect(host.questions).toHaveLength(2);
  });

  it("explains a missing Anthropic key on the card", async () => {
    const host = await startTile(DIR, {
      net: openMeteo(),
      settings: { place: "Berlin", summary: true },
    });
    await host.command("toggle");
    await host.advance(0);
    expect(textOf(host)).toContain("Add your Anthropic key");
  });

  it("asks once when the summary is turned on, and clears it when turned off", async () => {
    const host = await startTile(DIR, {
      net: openMeteo(),
      settings: { place: "Berlin" },
      ai: () => "Dry all afternoon.",
    });
    await host.command("toggle");
    await host.setSetting("summary", true);
    await host.advance(0);
    expect(host.questions).toHaveLength(1);
    expect(textOf(host)).toContain("Dry all afternoon.");
    await host.setSetting("summary", false);
    await host.advance(0);
    expect(textOf(host)).not.toContain("Dry all afternoon.");
  });
});
