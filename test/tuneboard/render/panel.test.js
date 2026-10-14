/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the playlist panel's picture and its covers
 *
 * The panel is one picture within the overlay's size limit, with up to five
 * rows (cover or note, escaped name, owner line, the picked row
 * highlighted), a message instead of the rows while loading, empty or
 * failed, and a footer whose arrows dim at the ends and whose "Show all"
 * appears only when it can work. Clicks map to rows and footer buttons at
 * any display size, and outside clicks to nothing. Covers are fetched
 * without the sign-in, only small pictures of known types are kept, and
 * each is fetched once, failures included.
 */
import { describe, expect, it, vi } from "vitest";
import {
  PANEL_H,
  PANEL_W,
  ROWS,
  panelHit,
  renderPanel,
} from "../../../examples/tuneboard/src/render/panel.js";
import { MAX_SIDE, svgOf } from "../../../examples/tuneboard/src/render/svg.js";
import {
  MAX_COVER_BYTES,
  base64Of,
  createCovers,
} from "../../../examples/tuneboard/src/spotify/covers.js";
import { pickThumb } from "../../../examples/tuneboard/src/spotify/playlists.js";

const row = (n, extra = {}) => ({
  name: `Mix ${n}`,
  meta: "by Ana · ♪ 3",
  cover: null,
  picked: false,
  ...extra,
});

const view = (extra = {}) => ({
  rows: [1, 2, 3].map((n) => row(n)),
  status: null,
  range: "1–3 of 3",
  canPrev: false,
  canNext: false,
  allLabel: "Show all",
  ...extra,
});

describe("panel picture", () => {
  it("fits the overlay's limits and draws each row", () => {
    expect(PANEL_W).toBeLessThanOrEqual(MAX_SIDE);
    expect(PANEL_H).toBeLessThanOrEqual(MAX_SIDE);
    const svg = svgOf(renderPanel(view()));
    for (const n of [1, 2, 3]) expect(svg).toContain(`Mix ${n}`);
    expect(svg).toContain("1–3 of 3");
    expect(svg).toContain("Show all");
  });

  it("escapes names, embeds covers and highlights the picked row", () => {
    const cover = "data:image/jpeg;base64,AAAA";
    const svg = svgOf(
      renderPanel(view({ rows: [row(1, { name: `<b>&"x"`, cover, picked: true })] })),
    );
    expect(svg).toContain("&lt;b&gt;&amp;&quot;x&quot;");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain(`href="${cover}"`);
    expect(svg).toContain('fill-opacity="0.18"');
  });

  it("shows at most five rows, or the message instead of them", () => {
    const many = renderPanel(view({ rows: [1, 2, 3, 4, 5, 6, 7].map((n) => row(n)) }));
    expect(svgOf(many)).toContain("Mix 5");
    expect(svgOf(many)).not.toContain("Mix 6");
    const failed = svgOf(renderPanel(view({ status: { text: "Sign in again.", error: true } })));
    expect(failed).toContain("Sign in again.");
    expect(failed).not.toContain("Mix 1");
  });

  it("dims arrows at the ends and leaves out Show all when it can't work", () => {
    const ends = svgOf(renderPanel(view({ allLabel: null })));
    expect(ends.match(/opacity="0.35"/g)).toHaveLength(2);
    expect(ends).not.toContain("Show all");
    const middle = svgOf(renderPanel(view({ canPrev: true, canNext: true })));
    expect(middle).not.toMatch(/opacity="0.35"/);
  });

  it("is drawn at the size it is shown", () => {
    expect(svgOf(renderPanel(view(), { displayW: 166, displayH: 166 }))).toContain(
      'width="166" height="166"',
    );
  });
});

describe("panel clicks", () => {
  const at = { x: 100, y: 200, w: PANEL_W, h: PANEL_H };

  it("map to rows and footer buttons", () => {
    expect(panelHit(at, 150, 200 + 6 + 2)).toEqual({ kind: "row", index: 0 });
    expect(panelHit(at, 150, 200 + 6 + 34 * 4 + 10)).toEqual({ kind: "row", index: ROWS - 1 });
    const foot = 200 + PANEL_H - 6 - 13;
    expect(panelHit(at, 100 + 20, foot)).toEqual({ kind: "prev" });
    expect(panelHit(at, 100 + 50, foot)).toEqual({ kind: "next" });
    expect(panelHit(at, 100 + 180, foot)).toEqual({ kind: "all" });
    expect(panelHit(at, 100 + 90, foot)).toBeNull();
  });

  it("work at the small size too, and ignore clicks outside", () => {
    const small = { x: 0, y: 0, w: PANEL_W * 0.8, h: PANEL_H * 0.8 };
    expect(panelHit(small, 20 * 0.8, (6 + 34 + 5) * 0.8)).toEqual({ kind: "row", index: 1 });
    expect(panelHit(at, 0, 0)).toBeNull();
    expect(panelHit(at, 100 + PANEL_W + 5, 250)).toBeNull();
    expect(panelHit(null, 1, 1)).toBeNull();
  });
});

describe("covers", () => {
  /** A cover answer as Tilefold's network gives it. */
  const image = (bytes, type = "image/jpeg") => ({
    ok: true,
    status: 200,
    headers: { "content-type": type },
    bytes: async () => bytes,
  });

  it("picks the smallest known-size cover as a thumbnail", () => {
    expect(
      pickThumb([
        { url: "https://mosaic.scdn.co/640/a", width: 640 },
        { url: "https://mosaic.scdn.co/60/a", width: 60 },
        { url: "https://mosaic.scdn.co/300/a", width: 300 },
      ]),
    ).toBe("https://mosaic.scdn.co/60/a");
    // A single cover of unknown size could be large: no thumbnail.
    expect(pickThumb([{ url: "https://i.scdn.co/image/a", width: null }])).toBeNull();
    expect(pickThumb(null)).toBeNull();
  });

  it("turns a small picture into a data URL, fetched without the sign-in", async () => {
    const fetchFn = vi.fn(async () => image(new Uint8Array([1, 2, 3])));
    const covers = createCovers({ fetchFn });
    expect(await covers.get("https://i.scdn.co/image/a")).toBe("data:image/jpeg;base64,AQID");
    expect(fetchFn).toHaveBeenCalledWith("https://i.scdn.co/image/a", { method: "GET" });
    expect(covers.peek("https://i.scdn.co/image/a")).toBe("data:image/jpeg;base64,AQID");
    expect(covers.peek("https://i.scdn.co/image/other")).toBeUndefined();
  });

  it("refuses large pictures, other types, failures and other hosts, each asked once", async () => {
    const answers = {
      "https://i.scdn.co/big": image(new Uint8Array(MAX_COVER_BYTES + 1)),
      "https://i.scdn.co/svg": image(new Uint8Array([1]), "image/svg+xml"),
      "https://i.scdn.co/gone": { ok: false, status: 404, headers: {}, bytes: async () => null },
    };
    const fetchFn = vi.fn(async (url) => {
      if (url === "https://i.scdn.co/throws") throw new Error("offline");
      return answers[url];
    });
    const covers = createCovers({ fetchFn });
    for (const url of [...Object.keys(answers), "https://i.scdn.co/throws"]) {
      expect(await covers.get(url)).toBeNull();
      expect(await covers.get(url)).toBeNull();
      expect(covers.peek(url)).toBeNull();
    }
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(await covers.get("https://example.com/x.jpg")).toBeNull();
    expect(await createCovers({ fetchFn: null }).get("https://i.scdn.co/a")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("shares one download between callers asking at once", async () => {
    const fetchFn = vi.fn(async () => image(new Uint8Array([9])));
    const covers = createCovers({ fetchFn });
    const [a, b] = await Promise.all([
      covers.get("https://i.scdn.co/a"),
      covers.get("https://i.scdn.co/a"),
    ]);
    expect(a).toBe(b);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("encodes bytes as base64 in chunks", () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 256);
    expect(base64Of(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});
