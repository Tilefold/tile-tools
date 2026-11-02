/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — what the user drew on a 3D scene
 *
 * On the page, the user can draw on a 3D model freehand: lines that stay
 * on its surface, and loops that mark an area of it. The page sends what
 * the drawing covers, and whether it's lines, an area or both: the parts it lands on (the
 * objects' labels), up to AREA_POINTS points on the model's surface in
 * the scene's own coordinates, and the angle the user saw it from. The
 * page is never trusted: `checkArea` keeps only labels the scene really
 * has, finite points inside the scene's room, rounded, and a view inside
 * its range, then works out the area's middle and extent itself; anything
 * else makes no area at all. `areaWords` says where the area is, for the
 * agent and for the line on Tilefold's ask card.
 *
 * Pure: no `tf`, no DOM.
 */

/** The most points of an area kept, and the most parts named. */
export const AREA_POINTS = 32;
export const AREA_PARTS = 8;
/** What a drawing can be, besides an area (the default, which isn't sent). */
const DRAWN = ["lines", "both"];
/** How far from the middle a point may be (objects sit within -100..100, arrows and labels a little out). */
const ROOM = 400;

/** `n` to one decimal place. */
const r1 = (n) => Math.round(n * 10) / 10;

/** One point [x, y, z] the page sent, checked, or null. */
function point(p) {
  if (!Array.isArray(p) || p.length !== 3) return null;
  if (!p.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= ROOM)) {
    return null;
  }
  return p.map(r1);
}

/**
 * The area `raw` from the page on 3D scene `scene`, checked, with its
 * middle and extent; or null when it isn't one.
 *
 * @param {{ kind: string, objects: Array<{ label?: string }> }} scene
 * @param {unknown} raw  { parts: string[], points: number[][], view?: { yaw, pitch },
 *   drawn?: "lines" | "both" }
 * @returns {null | { parts: string[], points: number[][], center: number[],
 *   min: number[], max: number[], view?: { yaw: number, pitch: number },
 *   drawn?: "lines" | "both" }}
 */
export function checkArea(scene, raw) {
  if (scene?.kind !== "scene3d" || !raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  if (!Array.isArray(raw.points) || raw.points.length === 0) return null;
  if (raw.points.length > AREA_POINTS) return null;
  const points = raw.points.map(point);
  if (points.some((p) => p === null)) return null;
  // Only the scene's own labels, each once, in the order the page gave them.
  const labels = new Set(scene.objects.map((o) => o.label).filter(Boolean));
  const parts = Array.isArray(raw.parts)
    ? [...new Set(raw.parts.filter((p) => typeof p === "string" && labels.has(p)))].slice(
        0,
        AREA_PARTS,
      )
    : [];
  const min = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k])));
  const max = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
  const center = [0, 1, 2].map((k) => r1(points.reduce((s, p) => s + p[k], 0) / points.length));
  const out = { parts, points, center, min, max };
  // Lines drawn, or lines and an area; anything else is an area.
  if (DRAWN.includes(raw.drawn)) out.drawn = raw.drawn;
  const v = raw.view;
  if (
    v &&
    typeof v === "object" &&
    Number.isFinite(v.yaw) &&
    Number.isFinite(v.pitch) &&
    Math.abs(v.yaw) <= 720 &&
    Math.abs(v.pitch) <= 90
  ) {
    out.view = { yaw: Math.round(v.yaw), pitch: Math.round(v.pitch) };
  }
  return out;
}

/** "a", "a and b", "a, b and c". */
const list = (xs) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

/** Which way the user looked from, in words. */
function viewWords(v) {
  const pitch = v.pitch > 25 ? "above" : v.pitch < -25 ? "below" : "level";
  return `seen from ${pitch} (yaw ${v.yaw}°, pitch ${v.pitch}°)`;
}

/**
 * Where an area (or the lines drawn) is, in a line: what was drawn, the
 * parts it's on, its middle and extent in the scene's coordinates, and the
 * view it was drawn from.
 * @param {ReturnType<typeof checkArea>} area
 */
export function areaWords(area) {
  const on = area.parts.length ? ` on ${list(area.parts.map((p) => `"${p}"`))}` : "";
  const [x, y, z] = area.center;
  const span = ["x", "y", "z"].map((k, i) => `${k} ${area.min[i]}..${area.max[i]}`).join(", ");
  const view = area.view ? `, ${viewWords(area.view)}` : "";
  const what = { lines: "lines drawn", both: "lines and an area drawn" }[area.drawn] ?? "an area";
  return `${what}${on} around (${x}, ${y}, ${z}), spanning ${span}${view}`;
}
