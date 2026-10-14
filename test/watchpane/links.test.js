// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — reading YouTube links (tests)
 *
 * Every usual shape of a YouTube link gives the video id and start time;
 * anything that isn't a YouTube video link is refused.
 */
import { describe, expect, it } from "vitest";
import { isVideoId, parseStart, parseVideoLink } from "../../examples/watchpane/page-src/links.js";

const ID = "dQw4w9WgXcQ";

describe("isVideoId", () => {
  it("takes 11 URL-safe characters and nothing else", () => {
    expect(isVideoId(ID)).toBe(true);
    expect(isVideoId("a-b_c-d_e-f")).toBe(true);
    expect(isVideoId("short")).toBe(false);
    expect(isVideoId(`${ID}x`)).toBe(false);
    expect(isVideoId("dQw4w9WgXc!")).toBe(false);
    expect(isVideoId(null)).toBe(false);
    expect(isVideoId(12345678901)).toBe(false);
  });
});

describe("parseStart", () => {
  it.each([
    ["90", 90],
    ["90s", 90],
    ["1m30s", 90],
    ["1h", 3600],
    ["1h2m3s", 3723],
    ["2M", 120],
  ])("reads %s as %i seconds", (text, seconds) => {
    expect(parseStart(text)).toBe(seconds);
  });

  it.each([null, "", "0", "abc", "1x", "-5", "100000"])("gives 0 for %s", (text) => {
    expect(parseStart(text)).toBe(0);
  });
});

describe("parseVideoLink", () => {
  it.each([
    [ID, 0],
    [`https://www.youtube.com/watch?v=${ID}`, 0],
    [`https://youtube.com/watch?v=${ID}&t=42`, 42],
    [`https://m.youtube.com/watch?feature=share&v=${ID}`, 0],
    [`https://music.youtube.com/watch?v=${ID}&list=RD1`, 0],
    [`https://youtu.be/${ID}?t=1m5s`, 65],
    [`youtu.be/${ID}`, 0],
    [`www.youtube.com/watch?v=${ID}`, 0],
    [`https://www.youtube.com/shorts/${ID}`, 0],
    [`https://www.youtube.com/live/${ID}?si=abc`, 0],
    [`https://www.youtube.com/embed/${ID}?start=30`, 30],
    [`https://www.youtube-nocookie.com/embed/${ID}`, 0],
    [`  https://www.youtube.com/watch?v=${ID}  `, 0],
  ])("reads %s", (text, start) => {
    expect(parseVideoLink(text)).toEqual({ id: ID, start });
  });

  it.each([
    "",
    "   ",
    "hello world",
    `https://example.com/watch?v=${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `javascript:alert(1)//youtu.be/${ID}`,
    `ftp://youtu.be/${ID}`,
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@somechannel",
    "https://www.youtube.com/playlist?list=PL123",
    `https://youtu.be/${ID}x`,
    `https://${"a".repeat(2050)}`,
  ])("refuses %s", (text) => {
    expect(parseVideoLink(text)).toBeNull();
  });

  it("refuses what isn't text", () => {
    expect(parseVideoLink(undefined)).toBeNull();
    expect(parseVideoLink({ id: ID })).toBeNull();
  });
});
