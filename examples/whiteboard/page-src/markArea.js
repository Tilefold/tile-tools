/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — drawing on a 3D model
 *
 * With drawing on (the pencil on the window's bar), or Shift held, a drag
 * on a 3D view draws freehand instead of turning the model. When a stroke
 * is let go, the page finds where it lands on the model: it casts a ray
 * through points along it, and each ray that hits the model gives a point
 * on its surface and the part there. A stroke stays on the surface as a
 * line, which keeps its place as the model turns (the objects never move,
 * only the camera). A stroke that ends where it began is a loop: it also
 * marks the area inside it, found on a grid of rays, as a tinted patch.
 * The user can draw several strokes (the oldest go after STROKES); after
 * each, what they all cover goes to the page: the parts, up to AREA_POINTS
 * surface points, the view it was drawn from, and whether it's lines, an
 * area or both. The tile checks all of that again before the agent sees it.
 */
import {
  CircleGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

/** The most points of a drawing the page sends (the tile keeps no more). */
export const AREA_POINTS = 32;
/** The most strokes kept on a model; drawing more takes the oldest away. */
export const STROKES = 24;
/** How close a stroke's end must come to its start to close a loop, in pixels. */
export const CLOSE_PX = 22;
/** The most points a stroke keeps as it's drawn, and how far apart they are at least, in pixels. */
const STROKE_MAX = 400;
const STROKE_GAP = 3;
/** The pen's width on the model, as a radius in pixels, and how often a stroke is sampled. */
const PEN_PX = 2.5;
const PEN_GAP = 2;
/** The most rays one stroke's line casts. */
const PEN_MAX = 600;
/** About how many grid points inside a loop are tried. */
const GRID = 196;
const SVG = "http://www.w3.org/2000/svg";

/** Whether point `p` is inside polygon `poly` (both in pixels), by the even-odd rule. */
export function insidePolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Points on a grid inside `poly`, about `max` of them at most, and the
 * grid's step in pixels.
 */
export function gridInside(poly, max = GRID) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const step = Math.max(4, Math.sqrt(((x1 - x0) * (y1 - y0)) / max));
  const out = [];
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      if (insidePolygon([x, y], poly)) out.push([x, y]);
    }
  }
  return { points: out, step };
}

/** A stroke's length in pixels. */
const lengthOf = (pts) =>
  pts.reduce(
    (sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0),
    0,
  );

/**
 * Whether a stroke closes a loop: it ends within CLOSE_PX of where it
 * began, after going far enough round to hold an area.
 */
export function isLoop(pts) {
  if (pts.length < 8) return false;
  const [a, b] = [pts[0], pts.at(-1)];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) > CLOSE_PX) return false;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const wide = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return wide >= 2 * CLOSE_PX && lengthOf(pts) >= 4 * CLOSE_PX;
}

/**
 * Points every `gap` pixels along a stroke, from its first point to its
 * last, but never more than `max` (the gap grows instead).
 */
export function along(pts, gap = PEN_GAP, max = PEN_MAX) {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
  const step = Math.max(gap, lengthOf(pts) / Math.max(1, max - 1));
  const out = [[pts[0][0], pts[0][1]]];
  let left = step;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    let t = left;
    while (t <= d && out.length < max) {
      out.push([ax + ((bx - ax) * t) / d, ay + ((by - ay) * t) / d]);
      t += step;
    }
    left = t - d;
  }
  const last = pts.at(-1);
  const end = out.at(-1);
  if ((end[0] !== last[0] || end[1] !== last[1]) && out.length < max) out.push([last[0], last[1]]);
  return out;
}

/** At most `n` of `list`, spread evenly over it. */
export function spread(list, n) {
  if (list.length <= n) return list.slice();
  return Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]);
}

/**
 * What a drawing covers, for the page to send: its parts (most covered
 * first), up to AREA_POINTS surface points rounded to a tenth, the view it
 * was drawn from, and `drawn` ("lines" or "both") when it isn't only an area.
 * @param {Array<{ at: number[], part: string | null }>} hits
 * @param {{ yaw: number, pitch: number }} view
 * @param {"area" | "lines" | "both"} [drawn]
 */
export function summarize(hits, view, drawn = "area") {
  const counts = new Map();
  for (const h of hits) if (h.part) counts.set(h.part, (counts.get(h.part) ?? 0) + 1);
  const parts = [...counts].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  const points = spread(hits, AREA_POINTS).map((h) => h.at.map((n) => Math.round(n * 10) / 10));
  const out = { parts, points, view: { yaw: view.yaw, pitch: view.pitch } };
  if (drawn === "lines" || drawn === "both") out.drawn = drawn;
  return out;
}

/**
 * Drawing for one 3D view.
 * @param {{ doc: Document, body: HTMLElement, canvas: HTMLCanvasElement,
 *   camera: import("three").PerspectiveCamera, scene: import("three").Scene,
 *   parts: import("three").Object3D[], color: string,
 *   view: () => { yaw: number, pitch: number },
 *   onMark: (area: ReturnType<typeof summarize>) => void,
 *   onMode: (on: boolean) => void }} o
 */
export function createMarker(o) {
  const { doc, body, canvas, camera } = o;
  const ray = new Raycaster();
  let on = false;
  /** The stroke being drawn: its pointer and its points in pixels. */
  let drawing = null;
  /** The strokes on the model, oldest first: each its group, its hits and whether it's a loop. */
  let strokes = [];

  // The stroke as it's drawn, over the view.
  const overlay = doc.createElementNS(SVG, "svg");
  overlay.setAttribute("class", "mark-draw");
  const line = doc.createElementNS(SVG, "polyline");
  overlay.append(line);

  /** The pixel point of an event in the canvas. */
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  /** The model's surface under pixel `p`: the point, the way the surface faces, the part. */
  const hitAt = (p, w, h) => {
    ray.setFromCamera(new Vector2((p[0] / w) * 2 - 1, -(p[1] / h) * 2 + 1), camera);
    const hit = ray.intersectObjects(o.parts, true)[0];
    if (!hit) return null;
    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : new Vector3(0, 0, 1);
    // Facing the camera, so what's drawn sits on the side the user sees.
    if (normal.dot(ray.ray.direction) > 0) normal.negate();
    return { point: hit.point.clone(), normal, part: hit.object.userData.part ?? null };
  };

  /** Disposes one stroke's meshes. */
  const drop = (group) => {
    o.scene.remove(group);
    group.traverse((c) => {
      c.geometry?.dispose();
      c.material?.dispose();
    });
  };

  /** Takes everything drawn off the model. */
  const clear = () => {
    for (const s of strokes) drop(s.group);
    strokes = [];
  };

  /**
   * Flat discs on the surface at `hits`, each `px` pixels across on screen
   * where it was drawn, so they join up into a line or a patch.
   */
  const discs = (hits, px, opacity, h) => {
    const fov = (camera.fov * Math.PI) / 180;
    const mesh = new InstancedMesh(
      new CircleGeometry(1, 14),
      new MeshBasicMaterial({
        color: o.color,
        transparent: true,
        opacity,
        side: DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      hits.length,
    );
    const z = new Vector3(0, 0, 1);
    hits.forEach((s, i) => {
      const r = (2 * camera.position.distanceTo(s.point) * Math.tan(fov / 2) * px) / h;
      const pos = s.point.clone().addScaledVector(s.normal, r * 0.08);
      const turn = new Quaternion().setFromUnitVectors(z, s.normal);
      mesh.setMatrixAt(i, new Matrix4().compose(pos, turn, new Vector3(r, r, r)));
    });
    return mesh;
  };

  /** What all the strokes cover, for the page. */
  const report = () => {
    const loops = strokes.filter((s) => s.loop).length;
    const drawn = loops === strokes.length ? "area" : loops ? "both" : "lines";
    const hits = strokes.flatMap((s) => s.hits);
    o.onMark(summarize(hits, o.view(), drawn));
  };

  /** The stroke is let go: draw it on the model where it lands, and say what's drawn. */
  const finish = () => {
    const pts = drawing.points;
    drawing = null;
    overlay.remove();
    if (pts.length < 2) return;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    const loop = isLoop(pts);
    // A loop's line runs all the way round, back to where it began.
    const pen = along(loop ? [...pts, pts[0]] : pts)
      .map((p) => hitAt(p, w, h))
      .filter(Boolean);
    let inner = [];
    let step = 0;
    if (loop) {
      const grid = gridInside(pts);
      step = grid.step;
      inner = grid.points.map((p) => hitAt(p, w, h)).filter(Boolean);
    }
    if (!pen.length && !inner.length) return;
    const group = new Group();
    if (inner.length) group.add(discs(inner, step * 0.75, 0.4, h));
    if (pen.length) group.add(discs(pen, PEN_PX, 0.95, h));
    o.scene.add(group);
    const hits = [...inner, ...pen].map((s) => ({ at: s.point.toArray(), part: s.part }));
    strokes.push({ group, hits, loop });
    while (strokes.length > STROKES) drop(strokes.shift().group);
    report();
  };

  // Caught on the way down to the canvas, so the camera controls never see a drawing drag.
  const down = (e) => {
    if (e.target !== canvas || e.button !== 0 || !(on || e.shiftKey)) return;
    e.stopPropagation();
    e.preventDefault();
    drawing = { id: e.pointerId, points: [at(e)] };
    canvas.setPointerCapture?.(e.pointerId);
    line.setAttribute("points", drawing.points[0].join(","));
    body.append(overlay);
  };
  const move = (e) => {
    if (!drawing || e.pointerId !== drawing.id) return;
    e.stopPropagation();
    const p = at(e);
    const last = drawing.points.at(-1);
    if (
      drawing.points.length >= STROKE_MAX ||
      Math.hypot(p[0] - last[0], p[1] - last[1]) < STROKE_GAP
    )
      return;
    drawing.points.push(p);
    line.setAttribute("points", drawing.points.map((q) => q.join(",")).join(" "));
  };
  const up = (e) => {
    if (!drawing || e.pointerId !== drawing.id) return;
    e.stopPropagation();
    finish();
  };
  const cancel = () => {
    drawing = null;
    overlay.remove();
  };
  const key = (e) => {
    if (e.key !== "Escape" || !on) return;
    e.preventDefault();
    e.stopPropagation();
    if (drawing) cancel();
    setMode(false);
    o.onMode(false);
  };
  body.addEventListener("pointerdown", down, true);
  body.addEventListener("pointermove", move, true);
  body.addEventListener("pointerup", up, true);
  body.addEventListener("pointercancel", cancel, true);
  canvas.addEventListener("keydown", key);

  /** Turns drawing on or off. */
  function setMode(next) {
    on = !!next;
    canvas.classList.toggle("marking", on);
    if (!on && drawing) cancel();
  }

  return {
    setMode,
    clear,
    dispose() {
      cancel();
      clear();
      body.removeEventListener("pointerdown", down, true);
      body.removeEventListener("pointermove", move, true);
      body.removeEventListener("pointerup", up, true);
      body.removeEventListener("pointercancel", cancel, true);
      canvas.removeEventListener("keydown", key);
    },
  };
}
