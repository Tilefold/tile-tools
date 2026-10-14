/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — logic tests
 *
 * The pure parts: weather codes to kinds; the two Open-Meteo requests
 * (encoded place, language, units, only the fields the card needs) and
 * their answers (first place found, the weather now, the next four hours
 * after the current one, units, odd answers); Tilefold's refusals told
 * apart from failures; Claude's question (fast model, small limit, the
 * numbers the card shows) and the answer cleaned to one line; and the card
 * pictures (sizes within Tilefold's limits, text escaped, the summary line
 * only when there is one, long hints split).
 */
import { describe, expect, it } from "vitest";
import { kindOf, KINDS, KIND_TEXT } from "../examples/weather-card/src/weather/codes.js";
import {
  cleanQuery,
  failureOf,
  forecastUrl,
  geocodeUrl,
  HOURS,
  parseForecast,
  parsePlace,
} from "../examples/weather-card/src/weather/openMeteo.js";
import {
  cleanSummary,
  MAX_SUMMARY,
  summaryFailure,
  summaryQuestion,
} from "../examples/weather-card/src/weather/summary.js";
import {
  CARD_H,
  MESSAGE_H,
  SUMMARY_H,
  renderMessage,
  renderWeather,
} from "../examples/weather-card/src/render/card.js";
import { MAX_SIDE, textWidth, wrapLines } from "../examples/weather-card/src/render/svg.js";

/** A forecast answer like Open-Meteo's, for 14:30 local time. */
export const FORECAST = {
  current: {
    time: "2026-10-13T14:30",
    temperature_2m: 17.6,
    apparent_temperature: 15.2,
    weather_code: 2,
    wind_speed_10m: 11.8,
    is_day: 1,
  },
  current_units: { temperature_2m: "°C", wind_speed_10m: "km/h" },
  hourly: {
    time: [
      "2026-10-13T14:00",
      "2026-10-13T15:00",
      "2026-10-13T16:00",
      "2026-10-13T17:00",
      "2026-10-13T18:00",
      "2026-10-13T19:00",
    ],
    temperature_2m: [17, 17.4, 16.1, 14.9, 13.2, 12],
    weather_code: [2, 3, 61, 80, 3, 0],
    precipitation_probability: [5, 10, 60, 70, 20, 0],
  },
};

const svgOf = (url) => decodeURIComponent(url.slice(url.indexOf(",") + 1));

describe("weather codes", () => {
  it("maps every WMO group to a kind", () => {
    expect([0, 1, 2, 3, 45, 48].map(kindOf)).toEqual([
      "clear",
      "partly",
      "partly",
      "cloudy",
      "fog",
      "fog",
    ]);
    expect([51, 57, 61, 67, 80, 82].map(kindOf)).toEqual([
      "drizzle",
      "drizzle",
      "rain",
      "rain",
      "rain",
      "rain",
    ]);
    expect([71, 77, 85, 86, 95, 99].map(kindOf)).toEqual([
      "snow",
      "snow",
      "snow",
      "snow",
      "storm",
      "storm",
    ]);
  });

  it("calls anything else unknown, and names every kind", () => {
    expect([4, 100, -1, 1.5, "x", null].map(kindOf)).toEqual(Array(6).fill("unknown"));
    for (const kind of [...KINDS, "unknown"]) expect(KIND_TEXT[kind]).toMatch(/^cond-/);
  });
});

describe("Open-Meteo requests", () => {
  it("looks a place up by name in the user's language", () => {
    const url = new URL(geocodeUrl("  São   Paulo ", "pt"));
    expect(url.origin).toBe("https://geocoding-api.open-meteo.com");
    expect(url.searchParams.get("name")).toBe("São Paulo");
    expect(url.searchParams.get("language")).toBe("pt");
    expect(url.searchParams.get("count")).toBe("1");
    expect(new URL(geocodeUrl("Oslo", "pt-BR")).searchParams.get("language")).toBe("en");
  });

  it("keeps a typed place short and tidy", () => {
    expect(cleanQuery("a".repeat(200))).toHaveLength(80);
    expect(cleanQuery(42)).toBe("");
  });

  it("asks for the weather now and the next hours, in the chosen units", () => {
    const metric = new URL(forecastUrl({ lat: 52.52, lon: 13.41 }, "metric"));
    expect(metric.origin).toBe("https://api.open-meteo.com");
    expect(metric.searchParams.get("latitude")).toBe("52.52");
    expect(metric.searchParams.get("current")).toContain("weather_code");
    expect(metric.searchParams.get("hourly")).toContain("precipitation_probability");
    expect(metric.searchParams.get("forecast_hours")).toBe(String(HOURS + 2));
    expect(metric.searchParams.get("temperature_unit")).toBe("celsius");
    const imperial = new URL(forecastUrl({ lat: 40.7, lon: -74 }, "imperial"));
    expect(imperial.searchParams.get("temperature_unit")).toBe("fahrenheit");
    expect(imperial.searchParams.get("wind_speed_unit")).toBe("mph");
  });
});

describe("Open-Meteo answers", () => {
  it("takes the first place found, rounded", () => {
    const place = parsePlace({
      results: [{ name: "Berlin", country: "Germany", latitude: 52.52437, longitude: 13.41053 }],
    });
    expect(place).toEqual({ name: "Berlin", country: "Germany", lat: 52.5244, lon: 13.4105 });
  });

  it("finds nothing in an empty or odd answer", () => {
    expect(parsePlace({})).toBeNull();
    expect(parsePlace({ results: [] })).toBeNull();
    expect(parsePlace({ results: [{ name: "X", latitude: "a", longitude: 1 }] })).toBeNull();
    expect(parsePlace({ results: [{ name: "X", latitude: 95, longitude: 1 }] })).toBeNull();
    expect(parsePlace(null)).toBeNull();
  });

  it("reads the weather now and the four hours after the current one", () => {
    const f = parseForecast(FORECAST);
    expect(f.now).toEqual({ temp: 18, feels: 15, wind: 12, kind: "partly", day: true });
    expect(f.hours.map((h) => h.hour)).toEqual(["15:00", "16:00", "17:00", "18:00"]);
    expect(f.hours[1]).toEqual({ hour: "16:00", temp: 16, kind: "rain", rain: 60 });
    expect(f.units).toEqual({ temp: "°C", wind: "km/h" });
  });

  it("copes with missing parts, and refuses an answer without a temperature", () => {
    const night = parseForecast({ current: { temperature_2m: -3, is_day: 0 } });
    expect(night).toMatchObject({
      now: { temp: -3, feels: null, wind: null, day: false },
      hours: [],
    });
    expect(night.units).toEqual({ temp: "°", wind: "" });
    expect(parseForecast({ current: {} })).toBeNull();
    expect(parseForecast({})).toBeNull();
  });
});

describe("failures", () => {
  const named = (name) => Object.assign(new Error(name), { name });

  it("tells Tilefold's refusals from everything else", () => {
    expect(failureOf(named("PermissionDeniedError"))).toBe("denied");
    expect(failureOf(named("NetworkPolicyError"))).toBe("denied");
    for (const n of ["TimeoutError", "NetworkError", "RateLimitError", "HttpError"]) {
      expect(failureOf(named(n))).toBe("error");
    }
    expect(failureOf(null)).toBe("error");
  });

  it("treats Don't send as a choice and names the notes worth showing", () => {
    expect(summaryFailure(named("AiDeclinedError"))).toBe("declined");
    expect(summaryFailure(named("AiNotSetUpError"))).toBe("summary-no-key");
    expect(summaryFailure(named("PermissionDeniedError"))).toBe("summary-denied");
    expect(summaryFailure(named("BudgetExceededError"))).toBe("summary-budget");
    expect(summaryFailure(named("NetworkError"))).toBe("");
  });
});

describe("Claude's summary", () => {
  it("asks the fast model a small question with the card's numbers", () => {
    const q = summaryQuestion({
      place: "Berlin, Germany",
      forecast: parseForecast(FORECAST),
      system: "In German.",
    });
    expect(q).toMatchObject({ system: "In German.", model: "fast", maxTokens: 80 });
    expect(q.prompt.split("\n")).toEqual([
      "Place: Berlin, Germany",
      "Now: 18°C, feels like 15°C, partly, wind 12 km/h, day",
      "15:00: 17°C, cloudy, chance of rain 10%",
      "16:00: 16°C, rain, chance of rain 60%",
      "17:00: 15°C, rain, chance of rain 70%",
      "18:00: 13°C, cloudy, chance of rain 20%",
    ]);
  });

  it("keeps one clean line of the answer", () => {
    expect(cleanSummary('\n  "Grab an umbrella before four."\nMore text')).toBe(
      "Grab an umbrella before four.",
    );
    expect(cleanSummary("- **Bright** until `five`")).toBe("Bright until five");
    expect(cleanSummary("「傘を持って」")).toBe("傘を持って");
    expect(cleanSummary(undefined)).toBe("");
    const long = cleanSummary("x".repeat(300));
    expect(long).toHaveLength(MAX_SUMMARY);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("card pictures", () => {
  const weather = {
    temp: "18°",
    place: "Berlin <&>",
    condition: "Partly cloudy",
    detail: "Feels 15° · 12 km/h",
    kind: "partly",
    day: true,
    hours: [
      { hour: "15:00", kind: "cloudy", temp: "17°", rain: "10%" },
      { hour: "16:00", kind: "rain", temp: "16°", rain: "60%" },
      { hour: "17:00", kind: "storm", temp: "15°", rain: "" },
      { hour: "18:00", kind: "snow", temp: "13°", rain: "20%" },
    ],
  };

  it("draws the weather within Tilefold's limits, with text escaped", () => {
    const card = renderWeather(weather);
    expect(card.h).toBe(CARD_H);
    expect(card.w).toBeLessThanOrEqual(MAX_SIDE);
    const svg = svgOf(card.image);
    expect(card.image.startsWith("data:image/svg+xml")).toBe(true);
    expect(svg).toContain("Berlin &lt;&amp;&gt;");
    expect(svg).toContain("60%");
    expect(svg).not.toContain("<script");
  });

  it("grows by one line for the summary", () => {
    const card = renderWeather({ ...weather, summary: "Umbrella after four." });
    expect(card.h).toBe(CARD_H + SUMMARY_H);
    expect(svgOf(card.image)).toContain("Umbrella after four.");
  });

  it("draws a message with its title and a hint over two lines", () => {
    const card = renderMessage({
      title: "Place not found",
      hint: "Open-Meteo doesn't know this place. Try another spelling or a nearby city.",
      tone: "warn",
    });
    expect(card.h).toBe(MESSAGE_H);
    const svg = svgOf(card.image);
    expect(svg).toContain("Place not found");
    expect(svg).toContain("#f59e0b");
  });

  it("wraps text by width, at spaces, inside long words, and with … when it can't fit", () => {
    const text = "one two three four five six seven eight nine ten";
    const lines = wrapLines(text, 10, 80, 5);
    expect(lines.join(" ")).toBe(text);
    for (const line of lines) expect(textWidth(line, 10)).toBeLessThanOrEqual(80);
    expect(wrapLines("short", 10, 80, 2)).toEqual(["short"]);
    const cut = wrapLines(text, 10, 60, 2);
    expect(cut).toHaveLength(2);
    expect(cut[1].endsWith("…")).toBe(true);
    // Scripts without spaces break where they reach the edge.
    const ja = wrapLines("あ".repeat(30), 10, 100, 3);
    expect(ja[0]).toBe("あ".repeat(10));
    expect(ja).toHaveLength(3);
  });

  it("keeps a long title and hint on the card", () => {
    const svg = svgOf(
      renderMessage({
        title: "Weather Card may not reach Open-Meteo",
        hint: "Allow it in Settings → Tiles, on Weather Card's card.",
        tone: "warn",
      }).image,
    );
    expect(svg).toContain("Open-Meteo");
    expect(svg).toContain("card.");
    expect(svg).not.toContain("…");
  });
});
