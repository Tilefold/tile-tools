/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — turning a 3D scene into flat shapes
 *
 * A 3D scene is drawn as plain SVG: each object becomes polygons, circles,
 * lines and labels in the scene's box, seen from a camera that turns round
 * the scene's middle (`yaw` round the vertical axis, `pitch` up and down,
 * both in degrees) with a little perspective. Pieces are sorted from far
 * to near and drawn in that order, so nearer faces cover farther ones, and
 * each face of a box is shaded by how much it faces the light.
 *
 * Pure: the page draws what `sceneItems` returns, and the tests check it.
 */

/** How far the camera stands, in multiples of the scene's size: smaller is more perspective. */
const DISTANCE = 4;
/** Where the light comes from (towards the viewer, up and to the left), normalized. */
const LIGHT = normalize([-0.4, 0.7, 0.6]);

function normalize(v) {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * A point turned by the camera: `yaw` round the vertical (y) axis, then
 * `pitch` round the horizontal (x) axis. y is up in the scene.
 */
export function rotate(p, yaw, pitch) {
  const a = (yaw * Math.PI) / 180;
  const b = (pitch * Math.PI) / 180;
  const x1 = p[0] * Math.cos(a) + p[2] * Math.sin(a);
  const z1 = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
  const y2 = p[1] * Math.cos(b) - z1 * Math.sin(b);
  const z2 = p[1] * Math.sin(b) + z1 * Math.cos(b);
  return [x1, y2, z2];
}

/** The eight corners of a box object, in the scene. */
export function boxCorners(o) {
  const [w, h, d] = o.size.map((s) => s / 2);
  const [x, y, z] = o.at;
  const out = [];
  for (const dx of [-w, w])
    for (const dy of [-h, h]) for (const dz of [-d, d]) out.push([x + dx, y + dy, z + dz]);
  return out;
}

/** A box's six faces, as corner indexes going round each face. */
const FACES = [
  [0, 1, 3, 2], // left (x -)
  [4, 6, 7, 5], // right (x +)
  [0, 4, 5, 1], // bottom (y -)
  [2, 3, 7, 6], // top (y +)
  [0, 2, 6, 4], // back (z -)
  [1, 5, 7, 3], // front (z +)
];

/** How far the scene reaches from its middle, so it fills its box. */
export function extentOf(objects) {
  let r = 1;
  for (const o of objects) {
    const reach = o.kind === "box" ? Math.hypot(...o.size) / 2 : o.kind === "sphere" ? o.r : 0;
    r = Math.max(r, Math.hypot(...o.at) + reach);
    if (o.kind === "line") r = Math.max(r, Math.hypot(...o.to));
  }
  return r;
}

/**
 * The flat pieces of a scene, from far to near, in board units inside
 * `rect` ({ x, y, w, h }):
 *
 *   { type: "poly", points: [[x, y], ...], color, shade, depth }
 *   { type: "circle", cx, cy, r, color, depth }
 *   { type: "line", a: [x, y], b: [x, y], color, depth }
 *   { type: "text", x, y, text, color, depth }
 *
 * `shade` is 0 (in shadow) to 1 (facing the light).
 */
/**
 * The newer objects (cylinder, arrow, tube, lathe, wing) as the simple ones
 * this flat drawing knows: lines along them, or the box they fill. Used where
 * the page can't draw real 3D.
 */
export function simplify(objects) {
  const out = [];
  for (const o of objects) {
    const base = { color: o.color, ...(o.label ? { label: o.label } : {}) };
    if (o.kind === "cylinder" || o.kind === "arrow") {
      out.push({ kind: "line", at: o.at, to: o.to, ...base });
      if (o.kind === "arrow") out.push({ kind: "point", at: o.to, color: o.color });
    } else if (o.kind === "tube") {
      o.points
        .slice(1)
        .forEach((p, i) =>
          out.push({ kind: "line", at: o.points[i], to: p, color: o.color, ...(i ? {} : base) }),
        );
    } else if (o.kind === "lathe") {
      const r = Math.max(...o.profile.map((p) => p[0]));
      const hs = o.profile.map((p) => p[1]);
      const len = Math.max(...hs) - Math.min(...hs) || 1;
      const mid = (Math.max(...hs) + Math.min(...hs)) / 2;
      const i = { x: 0, y: 1, z: 2 }[o.axis];
      const at = [...o.at];
      at[i] += mid;
      const size = [r * 2, r * 2, r * 2];
      size[i] = len;
      out.push({ kind: "box", at, size, ...base });
    } else if (o.kind === "wing") {
      const span = o.mirror ? o.span * 2 : o.span;
      const at = [...o.at];
      if (!o.mirror) at[o.vertical ? 1 : 2] += o.span / 2;
      const thick = Math.max(0.5, o.chord * o.thickness);
      const size = o.vertical ? [o.chord, span, thick] : [o.chord, thick, span];
      out.push({ kind: "box", at, size, ...base });
    } else {
      out.push(o);
    }
  }
  return out;
}

export function sceneItems(objects, camera, rect) {
  objects = simplify(objects);
  const extent = extentOf(objects);
  const scale = (Math.min(rect.w, rect.h) / 2 / extent) * 0.85;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const far = extent * DISTANCE;

  /** A scene point on the board, and how deep it is (bigger is farther). */
  const view = (p) => {
    const [x, y, z] = rotate(p, camera.yaw, camera.pitch);
    const k = far / (far - z);
    return { at: [cx + x * scale * k, cy - y * scale * k], depth: -z, k };
  };

  const items = [];
  for (const o of objects) {
    if (o.kind === "box") {
      const corners = boxCorners(o);
      const turned = corners.map((c) => rotate(c, camera.yaw, camera.pitch));
      const seen = corners.map(view);
      for (const f of FACES) {
        const [a, b, c] = f.map((i) => turned[i]);
        const normal = normalize(cross(sub(b, a), sub(c, a)));
        // Faces turned away from the camera (which looks along -z) are hidden.
        if (normal[2] <= 0) continue;
        const depth = f.reduce((s, i) => s + seen[i].depth, 0) / 4;
        const shade = Math.max(0, dot(normal, LIGHT));
        items.push({
          type: "poly",
          points: f.map((i) => seen[i].at),
          color: o.color,
          shade,
          depth,
        });
      }
      if (o.label) {
        const top = view([o.at[0], o.at[1] + o.size[1] / 2, o.at[2]]);
        items.push({
          type: "text",
          x: top.at[0],
          y: top.at[1] - 8,
          text: o.label,
          color: o.color,
          depth: -Infinity,
        });
      }
    } else if (o.kind === "sphere") {
      const c = view(o.at);
      items.push({
        type: "circle",
        cx: c.at[0],
        cy: c.at[1],
        r: o.r * scale * c.k,
        color: o.color,
        depth: c.depth,
      });
      if (o.label) {
        items.push({
          type: "text",
          x: c.at[0],
          y: c.at[1] - o.r * scale * c.k - 6,
          text: o.label,
          color: o.color,
          depth: -Infinity,
        });
      }
    } else if (o.kind === "line") {
      const a = view(o.at);
      const b = view(o.to);
      items.push({
        type: "line",
        a: a.at,
        b: b.at,
        color: o.color,
        depth: (a.depth + b.depth) / 2,
      });
      if (o.label) {
        const mid = [(a.at[0] + b.at[0]) / 2, (a.at[1] + b.at[1]) / 2];
        items.push({
          type: "text",
          x: mid[0],
          y: mid[1] - 6,
          text: o.label,
          color: o.color,
          depth: -Infinity,
        });
      }
    } else if (o.kind === "point") {
      const c = view(o.at);
      items.push({
        type: "circle",
        cx: c.at[0],
        cy: c.at[1],
        r: 4,
        color: o.color,
        depth: c.depth,
        dot: true,
      });
      if (o.label) {
        items.push({
          type: "text",
          x: c.at[0] + 8,
          y: c.at[1] - 6,
          text: o.label,
          color: o.color,
          depth: -Infinity,
        });
      }
    } else if (o.kind === "label") {
      const c = view(o.at);
      items.push({
        type: "text",
        x: c.at[0],
        y: c.at[1],
        text: o.label,
        color: o.color,
        depth: -Infinity,
      });
    }
  }
  // Far first; labels (depth -Infinity) last, so they're always readable.
  return items.sort((a, b) => b.depth - a.depth);
}
