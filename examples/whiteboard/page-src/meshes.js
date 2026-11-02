/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — the meshes of a real 3D scene
 *
 * Turns each checked 3D object (scene.js) into three.js meshes: boxes,
 * spheres and points; lines, cylinders and arrows between two points; a
 * lathe (a profile spun round an axis, for bodies such as a fuselage, a
 * bottle or a rocket); a wing (a cambered airfoil stretched along a span,
 * tapered, swept and tilted, on one side or both); and a tube along a smooth
 * curve, for airflow or a path. Each mesh carries the object's index and
 * label as its part, so a click can name what the user pointed at. Also
 * where each object's label goes.
 *
 * Only data comes in: no object can load anything or run code.
 */
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

const UP = new Vector3(0, 1, 0);
const rad = (d) => (d * Math.PI) / 180;
const vec = (p) => new Vector3(p[0], p[1], p[2]);

/** A mesh of `geometry` standing from `a` to `b` (its own axis is y). */
function between(geometry, a, b, material) {
  const mesh = new Mesh(geometry, material);
  const dir = new Vector3().subVectors(b, a);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  if (dir.lengthSq() > 0) mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  return mesh;
}

/**
 * A NACA four-digit airfoil of `points` per side, leading edge at x = 0 and
 * trailing edge at x = 1, as one loop: the upper surface back to front, then
 * the lower surface front to back.
 */
export function airfoil(thickness, camber, points = 24) {
  const p = 0.4;
  const upper = [];
  const lower = [];
  for (let i = 0; i <= points; i++) {
    // Cosine spacing: more points near the rounded leading edge.
    const x = (1 - Math.cos((i / points) * Math.PI)) / 2;
    const yt =
      5 *
      thickness *
      (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc =
      x < p
        ? (camber / p ** 2) * (2 * p * x - x * x)
        : (camber / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
    upper.push([x, yc + yt]);
    lower.push([x, yc - yt]);
  }
  return [...upper.reverse(), ...lower.slice(1, -1)];
}

/** A wing's geometry: the airfoil at stations along the span, closed at the tips. */
function wingGeometry(o) {
  const section = airfoil(o.thickness, o.camber);
  const stations = 10;
  const sides = o.mirror ? [-1, 1] : [1];
  const pos = [];
  const index = [];
  const n = section.length;
  for (const side of sides) {
    const base = pos.length / 3;
    for (let k = 0; k <= stations; k++) {
      const s = k / stations;
      const chord = o.chord * (1 - (1 - o.taper) * s);
      const out = o.span * s;
      const back = Math.tan(rad(o.sweep)) * out;
      const lift = Math.tan(rad(o.dihedral)) * out;
      for (const [x, y] of section) {
        // The nose points to +x: the leading edge is at +chord/2 at the root.
        const px = o.chord / 2 - x * chord - back;
        const py = y * chord + lift;
        if (o.vertical) pos.push(px, out, py * side);
        else pos.push(px, py, out * side);
      }
    }
    for (let k = 0; k < stations; k++) {
      for (let i = 0; i < n; i++) {
        const a = base + k * n + i;
        const b = base + k * n + ((i + 1) % n);
        index.push(a, b, a + n, b, b + n, a + n);
      }
    }
    // Close each end with a fan.
    for (const k of [0, stations]) {
      for (let i = 1; i < n - 1; i++)
        index.push(base + k * n, base + k * n + i, base + k * n + i + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * The meshes for one object, in a group placed and turned as it says; null
 * for a label, which has no mesh. `materialOf(color, opacity)` gives its
 * material.
 */
export function objectGroup(o, materialOf) {
  const m = materialOf(o.color, o.opacity ?? 1);
  const g = new Group();
  const at = vec(o.at);
  switch (o.kind) {
    case "box":
      g.add(new Mesh(new BoxGeometry(...o.size), m));
      g.position.copy(at);
      break;
    case "sphere":
      g.add(new Mesh(new SphereGeometry(o.r, 40, 24), m));
      g.position.copy(at);
      break;
    case "point":
      g.add(new Mesh(new SphereGeometry(1.4, 20, 12), m));
      g.position.copy(at);
      break;
    case "line":
    case "cylinder": {
      const to = vec(o.to);
      const len = at.distanceTo(to);
      const r = o.kind === "line" ? 0.45 : o.r;
      const r2 = o.kind === "line" ? 0.45 : o.r2;
      g.add(between(new CylinderGeometry(r2, r, len, 28), at, to, m));
      break;
    }
    case "arrow": {
      const to = vec(o.to);
      const len = at.distanceTo(to);
      const head = Math.min(len * 0.35, o.r * 6);
      const neck = new Vector3().lerpVectors(at, to, (len - head) / len);
      g.add(between(new CylinderGeometry(o.r, o.r, len - head, 20), at, neck, m));
      g.add(between(new ConeGeometry(o.r * 2.6, head, 28), neck, to, m));
      break;
    }
    case "lathe": {
      const geo = new LatheGeometry(
        o.profile.map(([r, h]) => new Vector2(r, h)),
        56,
      );
      if (o.axis === "x") geo.rotateZ(-Math.PI / 2);
      if (o.axis === "z") geo.rotateX(Math.PI / 2);
      g.add(new Mesh(geo, materialOf(o.color, o.opacity ?? 1, true)));
      g.position.copy(at);
      break;
    }
    case "wing":
      g.add(new Mesh(wingGeometry(o), materialOf(o.color, o.opacity ?? 1, true)));
      g.position.copy(at);
      break;
    case "tube": {
      const curve = new CatmullRomCurve3(o.points.map(vec));
      g.add(new Mesh(new TubeGeometry(curve, 96, o.r, 12), m));
      g.userData.curve = curve;
      break;
    }
    default:
      return null;
  }
  if (o.rot) g.rotation.set(rad(o.rot[0]), rad(o.rot[1]), rad(o.rot[2]));
  return g;
}

/** Where an object's label goes: above a solid, at a line's far end, mid-curve on a tube. */
export function labelAnchor(o, group) {
  if (o.kind === "label" || !group) return vec(o.at);
  if (o.kind === "line" || o.kind === "arrow" || o.kind === "cylinder") return vec(o.to);
  if (o.kind === "tube") return group.userData.curve.getPoint(0.5);
  const bounds = new Box3().setFromObject(group);
  return new Vector3(
    (bounds.min.x + bounds.max.x) / 2,
    bounds.max.y,
    (bounds.min.z + bounds.max.z) / 2,
  );
}

/** A standard material in `hex`, double-sided for open or hand-built surfaces. */
export function standardMaterial(hex, opacity, doubleSided = false) {
  return new MeshStandardMaterial({
    color: hex,
    roughness: 0.5,
    metalness: 0.08,
    transparent: opacity < 1,
    opacity,
    side: doubleSided ? DoubleSide : undefined,
  });
}
