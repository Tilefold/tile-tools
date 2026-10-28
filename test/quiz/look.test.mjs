// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — where it shows, and how it looks
 *
 * The panel when the setting says so; else the user's last move between
 * the card and the dock, or the setting; never the dock where Tilefold
 * can't dock pages. Tilefold's theme is read checked (plain colors only),
 * and the grip takes its colors from it, else the card's own.
 */
import { describe, expect, it } from "vitest";
import { COLORS, gripColors } from "../../examples/quiz/src/grip.js";
import { readTilefoldTheme } from "../../examples/quiz/src/look.js";
import { isMovable, placeOf, readChosen, showsAt } from "../../examples/quiz/src/place.js";

describe("where the quiz shows", () => {
  it("follows the setting, then the user's move between the card and the dock", () => {
    expect(placeOf("card", null, true)).toBe("card");
    expect(placeOf("side", null, true)).toBe("side");
    expect(placeOf("card", "side", true)).toBe("side");
    expect(placeOf("side", "card", true)).toBe("card");
    expect(placeOf("panel", "side", true)).toBe("panel");
  });

  it("never docks beside the panes where Tilefold can't", () => {
    expect(placeOf("side", null, false)).toBe("card");
    expect(placeOf("card", "side", false)).toBe("card");
  });

  it("reads a kept move, and counts a window as the card", () => {
    expect(readChosen("side")).toBe("side");
    expect(readChosen("panel")).toBeNull();
    expect(readChosen(3)).toBeNull();
    expect(showsAt("window", "card")).toBe(true);
    expect(showsAt("side", "card")).toBe(false);
    expect(isMovable("panel")).toBe(false);
  });
});

describe("Tilefold's theme", () => {
  it("keeps only plain colors, and light or dark", () => {
    expect(
      readTilefoldTheme({
        mode: "light",
        colors: { pane: "#fff", border: "rgb(0 0 0 / 10%)", bad: '"><x>', n: 3 },
      }),
    ).toEqual({ mode: "light", colors: { pane: "#fff", border: "rgb(0 0 0 / 10%)" } });
    expect(readTilefoldTheme({ mode: "weird", colors: {} })?.mode).toBe("dark");
    expect(readTilefoldTheme(null)).toBeNull();
    expect(readTilefoldTheme({ mode: "dark" })).toBeNull();
  });

  it("colors the grip, falling back to the card's own", () => {
    expect(gripColors("light", null)).toBe(COLORS.light);
    expect(
      gripColors("dark", { surfaceRaised: "#123", border: "#456", textMuted: "#789" }),
    ).toEqual({ bar: "#123", border: "#456", dots: "#789" });
    expect(gripColors("dark", { pane: "#000" })).toEqual({
      bar: "#000",
      border: COLORS.dark.border,
      dots: COLORS.dark.dots,
    });
  });
});
