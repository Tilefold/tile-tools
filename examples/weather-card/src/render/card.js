/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — the card
 *
 * The tile's one picture. Two modes:
 *
 *   weather  the place, the weather now, the next four hours and, when
 *            turned on, Claude's one-line summary underneath
 *
 *     ┌──────────────────────────────────┐
 *     │ ☀   Berlin                       │
 *     │     18°  Partly cloudy           │
 *     │          Feels 16° · 12 km/h     │
 *     │ 15:00   16:00   17:00   18:00    │
 *     │  ☁ 17°   ☂ 16°   ☂ 15°   ☁ 14°   │
 *     │ Take a light jacket after five.  │
 *     └──────────────────────────────────┘
 *
 *   The place has a line of its own, so a long name never pushes the
 *   weather off the card.
 *
 *   message  a state with no weather (no place set, not found, refused…):
 *            an icon in the state's tone, a title and a hint
 *
 * Pure: it takes already-translated text and returns a data URL and a size.
 */
import { alertIcon, weatherIcon } from "./icons.js";
import { THEME, svgUrl, textEl, wrapLines } from "./svg.js";

/** The card's width, and its height without and with a summary line. */
export const CARD_W = 232;
export const CARD_H = 116;
export const SUMMARY_H = 34;
export const MESSAGE_H = 88;

/** The summary's text size and the width it wraps in. */
const SUMMARY_SIZE = 10;
const SUMMARY_W = CARD_W - 24;

/** Icon colour by message tone. */
const TONES = { info: THEME.info, warn: THEME.warn, error: THEME.error };

/** The frame behind everything. */
function frame(h) {
  return (
    `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${h - 1}" rx="12" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`
  );
}

/**
 * The weather card.
 *
 * @param {{ temp: string, place: string, condition: string, detail: string,
 *           kind: string, day: boolean,
 *           hours: { hour: string, kind: string, temp: string, rain: string }[],
 *           summary?: string, summaryMuted?: boolean }} v
 *   Every text is ready to show (translated, with units).
 * @returns {{ image: string, w: number, h: number }}
 */
export function renderWeather(v) {
  const h = CARD_H + (v.summary ? SUMMARY_H : 0);
  let body = frame(h);
  body += weatherIcon(v.kind, v.day, 12, 10, 40);
  body += textEl({ x: 60, y: 24, text: v.place, size: 12, weight: 600, maxWidth: CARD_W - 72 });
  // Room for "-12°" and "104°" at full size.
  body += textEl({ x: 60, y: 50, text: v.temp, size: 22, weight: 700, maxWidth: 58 });
  body += textEl({ x: 120, y: 40, text: v.condition, size: 11, maxWidth: CARD_W - 132 });
  const detail = { x: 120, y: 54, text: v.detail, size: 9, color: THEME.muted };
  body += textEl({ ...detail, maxWidth: CARD_W - 132 });
  const cell = (CARD_W - 16) / 4;
  v.hours.slice(0, 4).forEach((hour, i) => {
    const cx = Math.round(8 + cell * i + cell / 2);
    body += textEl({
      x: cx,
      y: 72,
      text: hour.hour,
      size: 9,
      color: THEME.muted,
      maxWidth: cell - 4,
      anchor: "middle",
    });
    body += weatherIcon(hour.kind, true, cx - 20, 77, 18);
    body += textEl({ x: cx + 1, y: 91, text: hour.temp, size: 11, maxWidth: cell / 2 });
    if (hour.rain) {
      body += textEl({
        x: cx,
        y: 106,
        text: hour.rain,
        size: 9,
        color: THEME.rain,
        maxWidth: cell - 4,
        anchor: "middle",
      });
    }
  });
  if (v.summary) {
    body += `<line x1="12" y1="${CARD_H - 2}" x2="${CARD_W - 12}" y2="${CARD_H - 2}" stroke="${THEME.border}"/>`;
    wrapLines(v.summary, SUMMARY_SIZE, SUMMARY_W, 2).forEach((line, i) => {
      body += textEl({
        x: 12,
        y: CARD_H + 13 + i * 13,
        text: line,
        size: SUMMARY_SIZE,
        color: v.summaryMuted ? THEME.muted : THEME.text,
        maxWidth: SUMMARY_W,
      });
    });
  }
  return { image: svgUrl(CARD_W, h, body), w: CARD_W, h };
}

/**
 * A message card: an alert icon in the tone's colour, and a title and a
 * hint wrapped over four lines between them.
 *
 * @param {{ title: string, hint: string, tone: "info" | "warn" | "error" }} v
 * @returns {{ image: string, w: number, h: number }}
 */
export function renderMessage(v) {
  const color = TONES[v.tone] ?? THEME.info;
  const width = CARD_W - 66;
  let body = frame(MESSAGE_H);
  body += alertIcon(12, 12, color);
  // The title may take two lines when the hint needs only one, and the other way round.
  const title = wrapLines(v.title, 12, width, 2);
  const hint = wrapLines(v.hint, 10, width, 4 - title.length);
  let y = 25;
  for (const line of title) {
    body += textEl({ x: 54, y, text: line, size: 12, weight: 600, maxWidth: width });
    y += 15;
  }
  y += 2;
  for (const line of hint) {
    body += textEl({ x: 54, y, text: line, size: 10, color: THEME.muted, maxWidth: width });
    y += 13;
  }
  return { image: svgUrl(CARD_W, MESSAGE_H, body), w: CARD_W, h: MESSAGE_H };
}
