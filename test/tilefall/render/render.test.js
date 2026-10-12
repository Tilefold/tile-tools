/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Render tests
 *
 * The SVG helpers, the board, the panel and the buttons: valid data URLs
 * within Tilefold's size limit, escaped text, the right blocks in the right
 * places, banners, ghost on/off, dimming, and long labels squeezed to fit.
 */
import { describe, expect, it } from "vitest";
import {
  BOARD_H,
  BOARD_W,
  CELL,
  PAD,
  renderBoard,
} from "../../../examples/tilefall/src/render/board.js";
import {
  BUTTONS,
  BUTTON,
  iconFor,
  renderButton,
} from "../../../examples/tilefall/src/render/buttons.js";
import {
  PANEL_H,
  PANEL_W,
  PREVIEW_CELLS,
  panelLabel,
  previewEl,
  renderPanel,
} from "../../../examples/tilefall/src/render/panel.js";
import {
  MAX_SIDE,
  PIECE_COLORS,
  blockEl,
  codeOf,
  colorOf,
  escapeXml,
  svgOf,
  svgUrl,
  textEl,
  textWidth,
} from "../../../examples/tilefall/src/render/svg.js";

/** An empty 20×10 board. */
const emptyBoard = () => Array.from({ length: 20 }, () => Array(10).fill(0));

/** A minimal engine state. */
const state = (over = {}) => ({
  board: emptyBoard(),
  active: {
    kind: "T",
    cells: [
      [4, 0],
      [3, 1],
      [4, 1],
      [5, 1],
    ],
  },
  ghost: [
    [4, 18],
    [3, 19],
    [4, 19],
    [5, 19],
  ],
  next: ["I", "O", "S"],
  hold: null,
  canHold: true,
  score: 0,
  lines: 0,
  level: 1,
  over: false,
  clears: 0,
  lastClear: null,
  ...over,
});

/** The width and height attributes of a picture. */
const sizeOf = (url) => {
  const m = svgOf(url).match(/width="([\d.]+)" height="([\d.]+)"/);
  return { w: Number(m[1]), h: Number(m[2]) };
};

describe("svg helpers", () => {
  it("escapes XML special characters", () => {
    expect(escapeXml(`<a & "b" 'c'>`)).toBe("&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;");
    expect(escapeXml(42)).toBe("42");
  });

  it("makes an svg data URL that decodes back", () => {
    const url = svgUrl(10, 20, '<rect width="1" height="1"/>');
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(svgOf(url)).toContain('viewBox="0 0 10 20"');
    expect(svgOf(url)).toContain("<rect");
  });

  it("caps the display size at Tilefold's limit", () => {
    const { w, h } = sizeOf(svgUrl(10, 10, "", 999, 300));
    expect(w).toBe(MAX_SIDE);
    expect(h).toBe(MAX_SIDE);
  });

  it("maps kinds to codes and colours", () => {
    expect(codeOf("I")).toBe(1);
    expect(codeOf("L")).toBe(7);
    expect(codeOf("?")).toBe(0);
    expect(colorOf("I")).toBe(PIECE_COLORS[1]);
    expect(colorOf(5)).toBe(PIECE_COLORS[5]);
    expect(colorOf(0)).toBe("#6b7280");
    expect(colorOf(99)).toBe("#6b7280");
  });

  it("estimates wide scripts wider than Latin", () => {
    expect(textWidth("AB", 10)).toBeCloseTo(12);
    expect(textWidth("次へ", 10)).toBeCloseTo(20);
    expect(textWidth("다음", 10)).toBeCloseTo(20);
  });

  it("squeezes text only when it would overflow", () => {
    expect(textEl({ x: 0, y: 0, text: "OK", size: 10, maxWidth: 50 })).not.toContain("textLength");
    const long = textEl({ x: 0, y: 0, text: "NÄCHSTES TEIL BITTE", size: 10, maxWidth: 50 });
    expect(long).toContain('textLength="50"');
    expect(long).toContain("NÄCHSTES TEIL BITTE");
  });

  it("escapes the text it draws", () => {
    expect(textEl({ x: 0, y: 0, text: "<b>", size: 9 })).toContain("&lt;b&gt;");
  });

  it("draws a block with an optional opacity", () => {
    expect(blockEl(0, 0, 10, "#fff")).not.toContain('opacity="0.5"');
    expect(blockEl(0, 0, 10, "#fff", 0.5)).toContain('opacity="0.5"');
  });
});

describe("board", () => {
  it("has a 128 × 248 logical size inside the limit", () => {
    expect(BOARD_W).toBe(128);
    expect(BOARD_H).toBe(248);
    const { w, h } = sizeOf(renderBoard(null));
    expect(w).toBe(128);
    expect(h).toBe(248);
  });

  it("draws an empty board before any game", () => {
    const svg = svgOf(renderBoard(null));
    expect(svg).toContain("<path");
    expect(svg).not.toContain(PIECE_COLORS[3]);
  });

  it("draws locked blocks where the board says", () => {
    const board = emptyBoard();
    board[19][0] = 6;
    const svg = svgOf(renderBoard(state({ board, active: null, ghost: [] })));
    expect(svg).toContain(PIECE_COLORS[6]);
    expect(svg).toContain(`x="${PAD}" y="${PAD + 19 * CELL}"`);
  });

  it("draws the active piece and its ghost", () => {
    const svg = svgOf(renderBoard(state()));
    expect(svg).toContain(PIECE_COLORS[3]);
    expect(svg).toContain('stroke-opacity="0.55"');
  });

  it("leaves the ghost out when it is turned off", () => {
    expect(svgOf(renderBoard(state(), { ghost: false }))).not.toContain('stroke-opacity="0.55"');
  });

  it("leaves the ghost out when the game is over", () => {
    expect(svgOf(renderBoard(state({ over: true })))).not.toContain('stroke-opacity="0.55"');
  });

  it("skips ghost cells that overlap the piece and cells off the board", () => {
    const s = state({
      active: {
        kind: "O",
        cells: [
          [4, 18],
          [5, 18],
          [4, 19],
          [5, 19],
        ],
      },
      ghost: [
        [4, 18],
        [5, 18],
        [4, 19],
        [5, 19],
      ],
    });
    expect(svgOf(renderBoard(s))).not.toContain('stroke-opacity="0.55"');
    const above = state({
      active: {
        kind: "I",
        cells: [
          [3, -1],
          [4, -1],
          [5, -1],
          [6, -1],
        ],
      },
      ghost: [],
    });
    expect(svgOf(renderBoard(above))).not.toContain(PIECE_COLORS[1]);
  });

  it("tolerates a short or ragged board", () => {
    expect(() => renderBoard(state({ board: [[1, 2]] }))).not.toThrow();
    expect(() => renderBoard(state({ board: null }))).not.toThrow();
  });

  it("draws a banner with title, extra line and hint", () => {
    const svg = svgOf(
      renderBoard(state(), {
        banner: { title: "Game over", extra: "Score 1,200", hint: "Click for a new game" },
      }),
    );
    expect(svg).toContain("Game over");
    expect(svg).toContain("Score 1,200");
    expect(svg).toContain("Click for a new game");
  });

  it("scales to a display size", () => {
    const { w, h } = sizeOf(renderBoard(null, { displayW: 96, displayH: 186 }));
    expect([w, h]).toEqual([96, 186]);
  });
});

describe("panel", () => {
  const labels = {
    next: "NEXT",
    hold: "HOLD",
    score: "SCORE",
    best: "BEST",
    level: "LEVEL",
    lines: "Lines",
  };
  const view = {
    next: ["I", "O", "S"],
    hold: "T",
    canHold: true,
    score: "1,200",
    best: "5,000",
    level: "3",
    lines: "24",
  };

  it("has its logical size", () => {
    const { w, h } = sizeOf(renderPanel(view, labels));
    expect([w, h]).toEqual([PANEL_W, PANEL_H]);
  });

  it("shows labels, numbers and pieces", () => {
    const svg = svgOf(renderPanel(view, labels));
    for (const text of ["NEXT", "HOLD", "SCORE", "BEST", "LEVEL", "1,200", "5,000", "Lines 24"]) {
      expect(svg).toContain(text);
    }
    expect(svg).toContain(PIECE_COLORS[1]);
    expect(svg).toContain(PIECE_COLORS[3]);
  });

  it("dims the held piece while it cannot be swapped", () => {
    const svg = svgOf(renderPanel({ ...view, next: [], canHold: false }, labels));
    expect(svg).toContain('opacity="0.35"');
  });

  it("works with nothing next or held", () => {
    expect(() => renderPanel({ ...view, next: undefined, hold: null }, labels)).not.toThrow();
  });

  it("has a preview for every kind and none for unknown ones", () => {
    for (const kind of Object.keys(PREVIEW_CELLS)) {
      expect(PREVIEW_CELLS[kind]).toHaveLength(4);
      expect(previewEl(kind, 10, 10, 5)).toContain("<rect");
    }
    expect(previewEl("X", 10, 10, 5)).toBe("");
    expect(previewEl(null, 10, 10, 5)).toBe("");
  });

  it("gives a short spoken summary", () => {
    expect(panelLabel(view, labels)).toBe("SCORE 1,200, LEVEL 3, Lines 24");
    const huge = panelLabel({ ...view, score: "9".repeat(100) }, labels);
    expect(huge.length).toBeLessThanOrEqual(80);
  });
});

describe("buttons", () => {
  it("lays six buttons out as a 3 × 2 keypad that fits the panel width", () => {
    expect(BUTTONS).toHaveLength(6);
    const cells = new Set(BUTTONS.map((b) => `${b.col},${b.row}`));
    expect(cells.size).toBe(6);
    expect(3 * BUTTON + 2 * 3).toBe(PANEL_W);
  });

  it("draws every icon, dimmed or not", () => {
    for (const icon of ["left", "right", "down", "drop", "rotate", "pause", "play"]) {
      const svg = svgOf(renderButton(icon));
      // The icon group is drawn and not empty.
      expect(svg).toContain('<g opacity="1"><');
      expect(svg).not.toContain('<g opacity="1"></g>');
    }
    expect(svgOf(renderButton("unknown"))).toContain('<g opacity="1"></g>');
    expect(svgOf(renderButton("left", { dim: true }))).toContain('opacity="0.35"');
  });

  it("scales to a display size", () => {
    expect(sizeOf(renderButton("left", { displaySize: 20 }))).toEqual({ w: 20, h: 20 });
  });

  it("turns pause into play while the game is not running", () => {
    expect(iconFor("pause", true)).toBe("pause");
    expect(iconFor("pause", false)).toBe("play");
    expect(iconFor("left", false)).toBe("left");
  });
});
