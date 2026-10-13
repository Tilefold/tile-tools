/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — Open-Meteo
 *
 * Builds the two requests the tile makes and reads their answers. Open-Meteo
 * is free for personal use and needs no key, so the tile only asks for the
 * two hosts (`net:geocoding-api.open-meteo.com`, `net:api.open-meteo.com`)
 * and never declares a credential:
 *
 *   1. the place the user typed  →  its name, country and coordinates
 *   2. the coordinates           →  the weather now and the next hours
 *
 * Pure: no `tf`, no network. The tile hands the answers in, which keeps this
 * file easy to test and to reuse.
 */
import { kindOf } from "./codes.js";

/** Where places are looked up. */
export const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

/** Where forecasts come from. */
export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** How many hours ahead the card shows. */
export const HOURS = 4;

/** The units each setting asks Open-Meteo for. */
const UNITS = {
  metric: { temperature_unit: "celsius", wind_speed_unit: "kmh" },
  imperial: { temperature_unit: "fahrenheit", wind_speed_unit: "mph" },
};

/** A place the user typed, trimmed and kept to a sensible length. */
export function cleanQuery(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

/**
 * The geocoding request for a place name, with names in the user's language.
 *
 * @param {string} query
 * @param {string} language Two-letter code, such as "de".
 * @returns {string}
 */
export function geocodeUrl(query, language = "en") {
  const params = new URLSearchParams({
    name: cleanQuery(query),
    count: "1",
    language: /^[a-z]{2}$/.test(language) ? language : "en",
    format: "json",
  });
  return `${GEOCODING_URL}?${params}`;
}

/**
 * The first place in a geocoding answer, or null when there is none.
 *
 * @param {any} json
 * @returns {{ name: string, country: string, lat: number, lon: number } | null}
 */
export function parsePlace(json) {
  const first = json && Array.isArray(json.results) ? json.results[0] : null;
  if (!first || typeof first !== "object") return null;
  const lat = Number(first.latitude);
  const lon = Number(first.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {
    name: String(first.name ?? "").slice(0, 60) || "?",
    country: String(first.country ?? "").slice(0, 60),
    lat: Math.round(lat * 1e4) / 1e4,
    lon: Math.round(lon * 1e4) / 1e4,
  };
}

/**
 * The forecast request for a place, in the units the user picked.
 *
 * @param {{ lat: number, lon: number }} place
 * @param {string} units "metric" or "imperial".
 * @returns {string}
 */
export function forecastUrl(place, units = "metric") {
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    forecast_hours: String(HOURS + 2),
    timezone: "auto",
    ...(UNITS[units] ?? UNITS.metric),
  });
  return `${FORECAST_URL}?${params}`;
}

/** A finite number rounded to a whole one, or null. */
const whole = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * Reads a forecast answer: the weather now and the next {@link HOURS} hours
 * after the current one. Returns null when the answer has no usable "now".
 *
 * @param {any} json
 * @returns {null | {
 *   now: { temp: number, feels: number|null, wind: number|null, kind: string, day: boolean },
 *   hours: { hour: string, temp: number|null, kind: string, rain: number|null }[],
 *   units: { temp: string, wind: string },
 * }}
 */
export function parseForecast(json) {
  const current = json && json.current;
  if (!current || typeof current !== "object") return null;
  const temp = whole(current.temperature_2m);
  if (temp === null) return null;
  const units = (json && json.current_units) || {};
  const now = {
    temp,
    feels: whole(current.apparent_temperature),
    wind: whole(current.wind_speed_10m),
    kind: kindOf(current.weather_code),
    day: current.is_day !== 0,
  };
  const hourly = (json && json.hourly) || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const nowTime = typeof current.time === "string" ? current.time : "";
  /** @type {{ hour: string, temp: number|null, kind: string, rain: number|null }[]} */
  const hours = [];
  for (let i = 0; i < times.length && hours.length < HOURS; i++) {
    const time = String(times[i]);
    // Local times in the same ISO form, so text order is time order.
    if (nowTime && time <= nowTime) continue;
    hours.push({
      hour: /T(\d\d:\d\d)/.exec(time)?.[1] ?? time.slice(-5),
      temp: whole(hourly.temperature_2m?.[i]),
      kind: kindOf(hourly.weather_code?.[i]),
      rain: whole(hourly.precipitation_probability?.[i]),
    });
  }
  return {
    now,
    hours,
    units: {
      temp: typeof units.temperature_2m === "string" ? units.temperature_2m.slice(0, 4) : "°",
      wind: typeof units.wind_speed_10m === "string" ? units.wind_speed_10m.slice(0, 6) : "",
    },
  };
}

/**
 * What a Tilefold error means for the card, by its `name`:
 * "denied" when Tilefold refused the request (nothing reached Open-Meteo),
 * otherwise "error" (try again at the next check).
 *
 * @param {unknown} err
 * @returns {"denied" | "error"}
 */
export function failureOf(err) {
  const name = err && typeof err === "object" ? /** @type {any} */ (err).name : "";
  return name === "PermissionDeniedError" || name === "NetworkPolicyError" ? "denied" : "error";
}
