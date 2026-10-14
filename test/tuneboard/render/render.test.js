/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Render tests
 *
 * The pure pictures: XML escaping, data URLs within Tilefold's size
 * limit, text width estimates for Latin and wide scripts, ellipsis and
 * squeezing, line wrapping (with and without spaces), the card in track
 * and message mode, and the buttons with their icons and dimming.
 */
import { describe, expect, it } from "vitest";
import {
  BUTTON,
  BUTTONS,
  VOLUME_W,
  iconFor,
  renderButton,
  renderVolume,
  volumeHit,
} from "../../../examples/tuneboard/src/render/buttons.js";
import {
  CARD_H,
  CARD_W,
  clampProgress,
  renderCard,
  wrapLines,
} from "../../../examples/tuneboard/src/render/card.js";
import {
  MAX_SIDE,
  THEME,
  ellipsize,
  escapeXml,
  round2,
  svgOf,
  svgUrl,
  textEl,
  textWidth,
} from "../../../examples/tuneboard/src/render/svg.js";

/** A track view for the card. */
const track = (over = {}) => ({
  mode: "track",
  title: "Clair de Lune",
  artists: "Claude Debussy",
  detail: "On MacBook · volume 50%",
  progress: 0.25,
  playing: true,
  ...over,
});

describe("svg helpers", () => {
  it("escapes every XML special character", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
    );
    expect(escapeXml(42)).toBe("42");
  });

  it("rounds to two decimals", () => {
    expect(round2(1.23456)).toBe(1.23);
    expect(round2(2)).toBe(2);
  });

  it("builds a data URL that decodes back to the SVG", () => {
    const url = svgUrl(10, 20, `<rect width="1" height="1"/>`);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    const doc = svgOf(url);
    expect(doc).toContain(`viewBox="0 0 10 20"`);
    expect(doc).toContain(`width="10" height="20"`);
  });

  it("caps the display size at Tilefold's limit", () => {
    const doc = svgOf(svgUrl(10, 10, "", 999, 300));
    expect(doc).toContain(`width="${MAX_SIDE}" height="${MAX_SIDE}"`);
  });

  it("estimates wide scripts wider than Latin", () => {
    expect(textWidth("abcd", 10)).toBeCloseTo(24);
    expect(textWidth("日本語", 10)).toBeCloseTo(30);
    expect(textWidth("한국", 10)).toBeCloseTo(20);
  });

  it("shortens long text with an ellipsis and leaves short text alone", () => {
    expect(ellipsize("Short", 10, 100)).toBe("Short");
    const long = ellipsize("A very long song title that goes on and on", 10, 60);
    expect(long.endsWith("…")).toBe(true);
    expect(textWidth(long, 10)).toBeLessThanOrEqual(60);
  });

  it("never splits an emoji when shortening", () => {
    const out = ellipsize("🎵🎵🎵🎵🎵🎵🎵🎵🎵🎵🎵🎵", 10, 30);
    expect(out.endsWith("…")).toBe(true);
    expect([...out.slice(0, -1)].every((c) => c === "🎵")).toBe(true);
  });

  it("ellipsizes titles but squeezes labels", () => {
    const title = textEl({ x: 0, y: 0, text: "x".repeat(80), size: 10, maxWidth: 50 });
    expect(title).toContain("…");
    expect(title).not.toContain("textLength");
    const label = textEl({
      x: 0,
      y: 0,
      text: "x".repeat(80),
      size: 10,
      maxWidth: 50,
      squeeze: true,
    });
    expect(label).toContain(`textLength="50"`);
    expect(label).not.toContain("…");
  });

  it("escapes text inside text elements", () => {
    expect(textEl({ x: 1, y: 2, text: "<b>&", size: 9 })).toContain("&lt;b&gt;&amp;");
  });
});

describe("wrapLines", () => {
  it("wraps at spaces within the width", () => {
    const lines = wrapLines("Add your client id and refresh token in Settings.", 10, 100, 5);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 10)).toBeLessThanOrEqual(100);
    expect(lines.join(" ")).toBe("Add your client id and refresh token in Settings.");
  });

  it("breaks text written without spaces", () => {
    const lines = wrapLines(
      "設定でクライアントIDとリフレッシュトークンを追加してください。",
      10,
      100,
      3,
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 10)).toBeLessThanOrEqual(100);
  });

  it("ends with an ellipsis when the text needs more lines than allowed", () => {
    const lines = wrapLines(
      "one two three four five six seven eight nine ten eleven twelve",
      10,
      40,
      2,
    );
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("returns no lines for empty text", () => {
    expect(wrapLines("", 10, 100, 3)).toEqual([]);
  });
});

describe("card", () => {
  it("draws the track, the artists, the detail and the progress", () => {
    const doc = svgOf(renderCard(track()));
    expect(doc).toContain(`viewBox="0 0 ${CARD_W} ${CARD_H}"`);
    expect(doc).toContain("Clair de Lune");
    expect(doc).toContain("Claude Debussy");
    expect(doc).toContain("On MacBook");
    // A quarter of the 142-unit bar is filled in the accent colour.
    expect(doc).toContain(`width="35.5" height="3" rx="1.5" fill="${THEME.accent}"`);
  });

  it("dims the note icon while paused", () => {
    expect(svgOf(renderCard(track({ playing: false })))).toContain(`opacity="0.5"`);
    expect(svgOf(renderCard(track({ playing: true })))).toContain(`opacity="1"`);
  });

  it("keeps the progress within the bar", () => {
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(2)).toBe(1);
    expect(clampProgress("x")).toBe(0);
    expect(svgOf(renderCard(track({ progress: 5 })))).toContain(
      `width="142" height="3" rx="1.5" fill="${THEME.accent}"`,
    );
  });

  it("escapes track titles", () => {
    expect(svgOf(renderCard(track({ title: "Rock & <Roll>" })))).toContain(
      "Rock &amp; &lt;Roll&gt;",
    );
  });

  it("draws a message in the tone's colour with a wrapped hint", () => {
    const doc = svgOf(
      renderCard({
        mode: "message",
        tone: "error",
        title: "Spotify didn't answer",
        hint: "Trying again shortly.",
      }),
    );
    expect(doc).toContain(THEME.error);
    expect(doc).toContain("Spotify didn&apos;t answer");
    expect(doc).toContain("Trying again shortly.");
  });

  it("uses the note icon for information and the alert icon for warnings", () => {
    const info = svgOf(renderCard({ mode: "message", tone: "info", title: "a", hint: "b" }));
    const warn = svgOf(renderCard({ mode: "message", tone: "warn", title: "a", hint: "b" }));
    expect(info).toContain('<path d="M13 22');
    expect(warn).toContain(THEME.warn);
    expect(warn).toContain('<circle cx="16" cy="16"');
  });

  it("scales to the display size", () => {
    expect(svgOf(renderCard(track(), { displayW: 166, displayH: 58 }))).toContain(
      `width="166" height="58"`,
    );
  });
});

describe("card volume", () => {
  const track = (detail, volume) =>
    svgOf(
      renderCard({
        mode: "track",
        title: "Song",
        artists: "Someone",
        detail,
        volume,
        progress: 0.5,
        playing: true,
      }),
    );

  it("always shows the whole volume, shortening a long device name instead", () => {
    for (const volume of ["0%", "90%", "100%", "Muted"]) {
      const svg = track("On A Very Long Device Name Indeed", volume);
      expect(svg).toContain(`>${volume}<`);
      expect(svg).toContain("…");
    }
    expect(track("On Tilefold", "100%")).toContain(">On Tilefold<");
    expect(track("On Tilefold", "")).not.toContain('text-anchor="end"');
  });
});

describe("buttons", () => {
  it("has five buttons with unique ids, and the volume control's action by place", () => {
    expect(BUTTONS.map((b) => b.id)).toEqual(["previous", "play", "next", "volume", "playlists"]);
    expect(new Set(BUTTONS.map((b) => b.action)).size).toBe(5);
    expect(BUTTONS.find((b) => b.id === "volume")).toMatchObject({ action: null, w: VOLUME_W });
  });

  it("splits the volume control into lower, mute and raise", () => {
    const rect = { x: 100, y: 0, w: VOLUME_W, h: BUTTON };
    expect(volumeHit(rect, 105)).toBe("volumeDown");
    expect(volumeHit(rect, 100 + VOLUME_W / 2)).toBe("mute");
    expect(volumeHit(rect, 100 + VOLUME_W - 3)).toBe("volumeUp");
    expect(volumeHit(rect, 90)).toBeNull();
    expect(volumeHit(rect, 100 + VOLUME_W + 1)).toBeNull();
    // At the small size too.
    expect(volumeHit({ x: 0, y: 0, w: 61, h: 22 }, 30)).toBe("mute");
  });

  it("draws the volume control, crossed out and outlined while muted", () => {
    const loud = svgOf(renderVolume());
    const muted = svgOf(renderVolume({ muted: true }));
    expect(loud).toContain(`viewBox="0 0 ${VOLUME_W} ${BUTTON}"`);
    expect(loud).not.toContain(THEME.error);
    expect(muted).toContain(THEME.error);
    expect(svgOf(renderVolume({ dim: true }))).toContain('opacity="0.35"');
    expect(svgOf(renderVolume({ displayW: 61, displayH: 22 }))).toContain('width="61" height="22"');
  });

  it("draws every icon", () => {
    for (const icon of ["previous", "next", "play", "pause", "playlists"]) {
      const doc = svgOf(renderButton(icon));
      expect(doc).toContain(`viewBox="0 0 ${BUTTON} ${BUTTON}"`);
      expect(doc).toMatch(/<path|<rect x="9.5"/);
    }
  });

  it("dims when asked", () => {
    expect(svgOf(renderButton("next", { dim: true }))).toContain(`opacity="0.35"`);
    expect(svgOf(renderButton("next"))).toContain(`opacity="1"`);
  });

  it("turns play into pause while playing", () => {
    expect(iconFor("play", true)).toBe("pause");
    expect(iconFor("play", false)).toBe("play");
    expect(iconFor("next", true)).toBe("next");
  });

  it("scales to the display size", () => {
    expect(svgOf(renderButton("play", { displaySize: 22 }))).toContain(`width="22" height="22"`);
  });
});
