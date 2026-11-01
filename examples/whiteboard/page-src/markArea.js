/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — marking an area on a 3D model
 *
 * With marking on (the Mark button on the window's bar), or Shift held, a
 * drag on a 3D view draws a loop instead of turning the model. When the
 * loop is let go, the page finds where it lands on the model: it casts a
 * ray through points along the loop and on a grid inside it, and each ray
 * that hits the model gives a point on its surface and the part there.
 * Those points become the mark, a tinted patch on the surface that stays
 * where it is as the model turns (the objects never move, only the
 * camera), and what the area covers goes to the page: the parts, up to
 * AREA_POINTS surface points and the view it was marked from. The tile
 * checks all of that again before the agent sees it.
 */
import {
  CircleGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

/** The most points of an area the page sends (the tile keeps no more). */
export const AREA_POINTS = 32;
/** The most points a loop keeps, and how far apart they are at least, in pixels. */
const LOOP_MAX = 300;
const LOOP_GAP = 3;
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

/** At most `n` of `list`, spread evenly over it. */
export function spread(list, n) {
  if (list.length <= n) return list.slice();
  return Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]);
}

/**
 * What an area covers, for the page to send: its parts (most covered
 * first), up to AREA_POINTS surface points rounded to a tenth, and the
 * view it was marked from.
 * @param {Array<{ at: number[], part: string | null }>} hits
 * @param {{ yaw: number, pitch: number }} view
 */
export function summarize(hits, view) {
  const counts = new Map();
  for (const h of hits) if (h.part) counts.set(h.part, (counts.get(h.part) ?? 0) + 1);
  const parts = [...counts].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  const points = spread(hits, AREA_POINTS).map((h) => h.at.map((n) => Math.round(n * 10) / 10));
  return { parts, points, view: { yaw: view.yaw, pitch: view.pitch } };
}

/**
 * Marking for one 3D view.
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
  /** The loop being drawn: its pointer and its points in pixels. */
  let drawing = null;
  /** The mark shown on the model. */
  let mark = null;

  // The loop as it's drawn, over the view.
  const overlay = doc.createElementNS(SVG, "svg");
  overlay.setAttribute("class", "mark-draw");
  const line = doc.createElementNS(SVG, "polygon");
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
    // Facing the camera, so the patch sits on the side the user sees.
    if (normal.dot(ray.ray.direction) > 0) normal.negate();
    return { point: hit.point.clone(), normal, part: hit.object.userData.part ?? null };
  };

  /** Takes the mark off the model. */
  const clear = () => {
    if (!mark) return;
    o.scene.remove(mark);
    mark.traverse((c) => {
      c.geometry?.dispose();
      c.material?.dispose();
    });
    mark = null;
  };

  /** Puts a tinted patch on the model where `inner` hit, edged along the loop's `edge` hits. */
  const show = (inner, edge, step, h) => {
    clear();
    mark = new Group();
    const fov = (camera.fov * Math.PI) / 180;
    const all = [...inner, ...edge.filter(Boolean)];
    const discs = new InstancedMesh(
      new CircleGeometry(1, 14),
      new MeshBasicMaterial({
        color: o.color,
        transparent: true,
        opacity: 0.55,
        side: DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      all.length,
    );
    const z = new Vector3(0, 0, 1);
    /** The size of one grid step on the model at `s`, so the discs join up. */
    const size = (s) => (2 * camera.position.distanceTo(s.point) * Math.tan(fov / 2) * step) / h;
    all.forEach((s, i) => {
      const r = size(s) * 0.75;
      const pos = s.point.clone().addScaledVector(s.normal, r * 0.08);
      const turn = new Quaternion().setFromUnitVectors(z, s.normal);
      discs.setMatrixAt(i, new Matrix4().compose(pos, turn, new Vector3(r, r, r)));
    });
    mark.add(discs);
    // The loop's edge, where it runs along the model: not where it jumps from one surface to another.
    const seg = [];
    for (let i = 0; i < edge.length; i++) {
      const a = edge[i];
      const b = edge[(i + 1) % edge.length];
      if (!a || !b || a.point.distanceTo(b.point) > 2 * Math.max(size(a), size(b))) continue;
      for (const s of [a, b])
        seg.push(
          ...s.point
            .clone()
            .addScaledVector(s.normal, size(s) * 0.1)
            .toArray(),
        );
    }
    if (seg.length) {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(seg, 3));
      mark.add(new LineSegments(g, new LineBasicMaterial({ color: o.color })));
    }
    o.scene.add(mark);
  };

  /** The loop is let go: mark what it covers, if it covers any of the model. */
  const finish = () => {
    const loop = drawing.points;
    drawing = null;
    overlay.remove();
    if (loop.length < 3) return;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    const { points: grid, step } = gridInside(loop);
    const edge = loop.map((p) => hitAt(p, w, h));
    const inner = grid.map((p) => hitAt(p, w, h)).filter(Boolean);
    const hits = [...inner, ...edge.filter(Boolean)];
    if (!hits.length) return;
    show(inner, edge, step, h);
    o.onMark(
      summarize(
        hits.map((s) => ({ at: s.point.toArray(), part: s.part })),
        o.view(),
      ),
    );
  };

  // Caught on the way down to the canvas, so the camera controls never see a marking drag.
  const down = (e) => {
    if (e.target !== canvas || e.button !== 0 || !(on || e.shiftKey)) return;
    e.stopPropagation();
    e.preventDefault();
    drawing = { id: e.pointerId, points: [at(e)] };
    canvas.setPointerCapture?.(e.pointerId);
    line.setAttribute("points", "");
    body.append(overlay);
  };
  const move = (e) => {
    if (!drawing || e.pointerId !== drawing.id) return;
    e.stopPropagation();
    const p = at(e);
    const last = drawing.points.at(-1);
    if (drawing.points.length >= LOOP_MAX || Math.hypot(p[0] - last[0], p[1] - last[1]) < LOOP_GAP)
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

  /** Turns marking on or off. */
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
