/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Girder Jump — the construction site
 *
 * The fixed layout every level is played on: six girders stacked up the
 * field, each with a gap at one end so crates drop to the girder below, the
 * ladders between them, and a short ledge at the top with the beacon you
 * climb to. Crates roll towards a girder's gap, so the girders alternate:
 * the top one rolls right, the next left, and so on down; the ground
 * girder has no gap and crates roll off its left end.
 *
 *     ledge  ═══★═══
 *            ║
 *     5  R═══════════════   →
 *       ═════════════════   ←  4
 *     3  ════════════════   →
 *       ═════════════════   ←  2
 *     1  ════════════════   →
 *     0 ═══════════════════ ←  (start at the left)
 */
import { H } from "./field.js";

/** The ground girder's top, and the climb between two girders. */
export const GROUND_Y = H - 12;
export const FLOOR_GAP = 34;

/**
 * The girders, ground first: the y of the walking surface and the span
 * from x0 to x1. Index 6 is the ledge with the beacon.
 *
 * @type {{ y: number, x0: number, x1: number }[]}
 */
export const FLOORS = [
  { y: GROUND_Y, x0: 4, x1: 236 },
  { y: GROUND_Y - FLOOR_GAP, x0: 4, x1: 214 },
  { y: GROUND_Y - FLOOR_GAP * 2, x0: 26, x1: 236 },
  { y: GROUND_Y - FLOOR_GAP * 3, x0: 4, x1: 214 },
  { y: GROUND_Y - FLOOR_GAP * 4, x0: 26, x1: 236 },
  { y: GROUND_Y - FLOOR_GAP * 5, x0: 4, x1: 214 },
  { y: GROUND_Y - FLOOR_GAP * 6, x0: 96, x1: 150 },
];

/** The girder the crates are thrown on, and the ledge you climb to. */
export const TOP_FLOOR = 5;
export const LEDGE = 6;

/**
 * Ladders: from girder `floor` up to the next one, at `x`.
 *
 * @type {{ floor: number, x: number }[]}
 */
export const LADDERS = [
  { floor: 0, x: 196 },
  { floor: 1, x: 56 },
  { floor: 1, x: 150 },
  { floor: 2, x: 190 },
  { floor: 3, x: 44 },
  { floor: 3, x: 120 },
  { floor: 4, x: 178 },
  { floor: 5, x: 120 },
];

/** Where you start, and where the robot stands and throws from. */
export const START = { floor: 0, x: 28 };
export const ROBOT_X = 22;
export const BEACON_X = 136;

/**
 * Which way crates roll on a girder: +1 right, -1 left.
 *
 * @param {number} floor
 * @returns {1 | -1}
 */
export function rollDir(floor) {
  return (TOP_FLOOR - floor) % 2 === 0 ? 1 : -1;
}

/**
 * The ladder from `floor` up, near `x` (within `reach`), or null.
 *
 * @param {number} floor
 * @param {number} x
 * @param {number} [reach]
 * @returns {{ floor: number, x: number } | null}
 */
export function ladderUp(floor, x, reach = 7) {
  return LADDERS.find((l) => l.floor === floor && Math.abs(l.x - x) <= reach) ?? null;
}

/**
 * The ladder down from `floor` (one that comes up to it), near `x`, or null.
 *
 * @param {number} floor
 * @param {number} x
 * @param {number} [reach]
 * @returns {{ floor: number, x: number } | null}
 */
export function ladderDown(floor, x, reach = 7) {
  return LADDERS.find((l) => l.floor === floor - 1 && Math.abs(l.x - x) <= reach) ?? null;
}
