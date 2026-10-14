// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Arcade kit — tests
 *
 * The kit the arcade examples share: its files are the same in every
 * example (so each folder can be copied on its own and they never drift);
 * the layout puts the board and its centred button row in the chosen
 * corner, above the Composer, scaled for the small size; settings fall back
 * to their defaults; sounds make valid WAV clips and keep inside Tilefold's
 * limits; frames send only what changed; a board click does the right
 * thing for each status; and every example's default shortcuts are its own.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { boardAction, diffItems } from "../examples/orbit-guard/src/tile/arcade.js";
import { BUTTON, computeLayout } from "../examples/orbit-guard/src/tile/layout.js";
import { readSettings } from "../examples/orbit-guard/src/tile/settings.js";
import {
  MAX_PER_MINUTE,
  MIN_GAP_MS,
  RATE,
  createSounds,
  toneSamples,
  wavUrl,
} from "../examples/orbit-guard/src/tile/sound.js";
import { MOVES as BRICK_MOVES } from "../examples/brickfold/src/brickfold.js";
import { MOVES as GIRDER_MOVES } from "../examples/girder-jump/src/girder.js";
import { MOVES as ORBIT_MOVES } from "../examples/orbit-guard/src/orbit.js";

const GAMES = ["orbit-guard", "brickfold", "girder-jump"];
const KIT = [
  "src/tile/arcade.js",
  "src/tile/layout.js",
  "src/tile/settings.js",
  "src/tile/sound.js",
  "src/render/svg.js",
  "src/engine/rng.js",
];

const read = (game, file) =>
  readFileSync(new URL(`../examples/${game}/${file}`, import.meta.url), "utf8");

const PANE = {
  content: { w: 1200, h: 800 },
  panes: [
    {
      id: "p1",
      x: 0,
      y: 40,
      w: 1200,
      h: 730,
      focused: true,
      composer: { x: 0, y: 724, w: 1200, h: 46 },
    },
  ],
};

describe("arcade kit", () => {
  it.each(KIT)("%s is the same in every arcade example", (file) => {
    const first = read(GAMES[0], file);
    for (const game of GAMES.slice(1)) expect(read(game, file), `${game}/${file}`).toBe(first);
  });

  it("lays out the board with a centred button row in each corner, above the Composer", () => {
    const board = { w: 240, h: 256 };
    const ids = ["a", "b", "c"];
    const br = computeLayout(PANE, { size: "medium", corner: "bottom-right" }, board, ids);
    expect(br.board).toEqual({ x: 1200 - 240 - 12, y: expect.any(Number), w: 240, h: 256 });
    expect(br["btn-c"].y + br["btn-c"].h).toBe(724 - 12);
    const row = ids.map((id) => br[`btn-${id}`]);
    const left = row[0].x - br.board.x;
    const right = br.board.x + br.board.w - (row[2].x + row[2].w);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    expect(row[0].w).toBe(BUTTON);

    const tl = computeLayout(PANE, { size: "small", corner: "top-left" }, board, ids);
    expect(tl.board).toEqual({ x: 12, y: 40 + 12, w: 180, h: 192 });

    // Without panes, the whole window is used.
    const bare = computeLayout(null, { size: "medium", corner: "top-right" }, board, ids);
    expect(bare.board.x).toBe(800 - 240 - 12);
  });

  it("cleans up settings, falling back to the defaults", () => {
    const get = (values) => ({ get: (k) => values[k] });
    expect(readSettings(get({}))).toEqual({
      sounds: true,
      size: "medium",
      corner: "bottom-right",
      pauseOnBlur: true,
    });
    expect(
      readSettings(get({ sounds: false, size: "huge", corner: "middle", pauseOnBlur: false })),
    ).toEqual({ sounds: false, size: "medium", corner: "bottom-right", pauseOnBlur: false });
    expect(
      readSettings({
        get: () => {
          throw new Error("x");
        },
      }).size,
    ).toBe("medium");
  });

  it("makes valid WAV clips of the right length", () => {
    const samples = toneSamples([
      { from: 440, ms: 100 },
      { from: 220, to: 110, ms: 50, wave: "noise" },
    ]);
    expect(samples.length).toBe(Math.round(RATE * 0.1) + Math.round(RATE * 0.05));
    for (const v of samples) expect(Math.abs(v)).toBeLessThanOrEqual(1);
    const url = wavUrl(samples);
    expect(url).toMatch(/^data:audio\/wav;base64,UklGR/);
    expect(url.length).toBeLessThan(400_000);
  });

  it("keeps sounds inside Tilefold's limits, and quiet when turned off", async () => {
    let now = 0;
    const plays = [];
    const tf = { sound: { play: vi.fn(async (clip) => void plays.push(clip)) } };
    let on = true;
    const sounds = createSounds(
      tf,
      () => on,
      { beep: { from: 440, ms: 50 } },
      () => now,
    );
    sounds.play("beep");
    sounds.play("beep"); // too soon
    now += MIN_GAP_MS;
    sounds.play("beep");
    sounds.play("missing");
    await Promise.resolve();
    await Promise.resolve();
    expect(plays).toHaveLength(2);
    on = false;
    const before = plays.length;
    now += 120_000;
    sounds.play("beep");
    await new Promise((r) => setTimeout(r, 0));
    expect(plays.length).toBe(before);
    // Tilefold allows 30 a minute; the kit stays below that on its own.
    expect(MAX_PER_MINUTE).toBeLessThan(30);
  });

  it("caps sounds per minute", async () => {
    let now = 0;
    let count = 0;
    const tf = { sound: { play: async () => void count++ } };
    const sounds = createSounds(
      tf,
      () => true,
      { beep: { from: 440, ms: 50 } },
      () => now,
    );
    for (let i = 0; i < 60; i++) {
      sounds.play("beep");
      now += MIN_GAP_MS;
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(count).toBe(MAX_PER_MINUTE);
  });

  it("sends only the fields that changed, and new items whole", () => {
    const a = [
      { id: "board", image: "1", x: 0, y: 0, w: 1, h: 1, label: "L", hit: true, cursor: "pointer" },
    ];
    expect(diffItems(a, a)).toEqual([]);
    expect(diffItems(a, [{ ...a[0], image: "2" }])).toEqual([{ id: "board", image: "2" }]);
    const extra = { id: "btn", image: "b", x: 1, y: 1, w: 1, h: 1 };
    expect(diffItems(a, [...a, extra])).toEqual([extra]);
  });

  it("starts, pauses or resumes with a board click, by status", () => {
    expect(boardAction("none")).toBe("newGame");
    expect(boardAction("over")).toBe("newGame");
    expect(boardAction("playing")).toBe("pause");
    expect(boardAction("paused")).toBe("pause");
  });

  it("gives every example its own default shortcuts, Tilefall and Tuneboard included", () => {
    const chords = new Map();
    const add = (owner, key) => {
      for (const k of new Set([key.mac, key.other])) {
        expect(chords.get(k), `${k} is taken by ${chords.get(k)} and ${owner}`).toBeUndefined();
        chords.set(k, owner);
      }
    };
    for (const [game, moves] of [
      ["orbit-guard", ORBIT_MOVES],
      ["brickfold", BRICK_MOVES],
      ["girder-jump", GIRDER_MOVES],
    ]) {
      for (const m of moves) add(game, m.key);
      const toggle = /toggleKey: \{ mac: "([^"]+)", other: "([^"]+)" \}/.exec(
        read(game, "src/main.js"),
      );
      add(game, { mac: toggle[1], other: toggle[2] });
    }
    for (const other of ["tilefall", "tuneboard"]) {
      const src = readFileSync(new URL(`../examples/${other}/main.js`, import.meta.url), "utf8");
      for (const m of src.matchAll(/"((?:Ctrl|Alt|Shift|Meta)\+[A-Za-z+]+)"/g)) {
        expect(chords.has(m[1]) ? `${m[1]} (${chords.get(m[1])})` : null, other).toBeNull();
      }
    }
  });
});
