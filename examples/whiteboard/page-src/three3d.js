/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — a 3D scene drawn for real
 *
 * Draws one 3D scene with WebGL (three.js, bundled into the page; nothing
 * is loaded from the internet): lit, shaded solids the user turns by
 * dragging, zooms with the wheel or a pinch, turns with the arrow keys and
 * puts back with a double-click or 0. It opens with a slow turn so the
 * shape reads as 3D, which stops at the user's first touch (and never runs
 * when they ask for reduced motion). Labels are HTML beside their objects,
 * kept apart so none covers another. Tubes marked `flow` carry beads along
 * them, for air or current. A click that isn't a drag points at the part
 * under it (the object's label) for the question box; the part under the
 * pointer glows a little first, with its label, to show what a click would
 * point at. A folded window's view is paused, so it costs nothing. With
 * marking on, or Shift held, a drag draws a loop that marks an area of the
 * model instead (markArea.js).
 *
 * Where WebGL isn't available the page draws its flat SVG version instead
 * (`webglAvailable`).
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createMarker } from "./markArea.js";
import { labelAnchor, objectGroup, standardMaterial } from "./meshes.js";

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Whether this page can draw with WebGL. */
export function webglAvailable(doc) {
  try {
    const c = doc.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * A live 3D view of `shape` (a checked scene3d) in `host`, an element the
 * page sizes and places over the scene's frame.
 * @param {Document} doc
 * @param {HTMLElement} host
 * @param {any} shape
 * @param {{ color: (name: string) => string, camera: { yaw: number, pitch: number, zoom?: number },
 *   onTurn: (cam: { yaw: number, pitch: number, zoom: number }) => void,
 *   onPick: (part: string | null) => void, hint: string, still?: boolean,
 *   markHint?: string, onMark?: (area: object) => void, onMarkMode?: (on: boolean) => void }} o
 */
export function createView(doc, host, shape, o) {
  const win = doc.defaultView;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.className = "gl";
  host.append(canvas);
  const labels = doc.createElement("div");
  labels.className = "gl-labels";
  host.append(labels);
  const hint = doc.createElement("span");
  hint.className = "gl-hint";
  hint.textContent = o.hint;
  host.append(hint);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x5a5f73, 1.1));
  scene.add(new AmbientLight(0xffffff, 0.25));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(0.6, 1, 0.8);
  scene.add(sun);

  // The objects, each a group whose meshes name their part.
  const parts = [];
  const tags = [];
  const flows = [];
  shape.objects.forEach((obj, i) => {
    const group = objectGroup(obj, (name, opacity, double) =>
      standardMaterial(o.color(name), opacity, double),
    );
    if (group) {
      group.traverse((c) => (c.userData.part = obj.label ?? null));
      scene.add(group);
      parts.push(group);
      if (obj.kind === "tube" && obj.flow) flows.push({ group, r: obj.r, color: obj.color });
    }
    if (obj.label) {
      const tag = doc.createElement("span");
      tag.className = "gl-label";
      tag.textContent = obj.label;
      tag.style.color = o.color(obj.color);
      labels.append(tag);
      tags.push({ tag, at: labelAnchor(obj, group), index: i, part: obj.label });
    }
  });

  // Beads that run along each flowing tube.
  const beads = flows.flatMap(({ group, r, color }) =>
    Array.from({ length: 7 }, (_, k) => {
      const bead = new Mesh(
        new SphereGeometry(Math.max(r * 1.6, 0.8), 14, 10),
        standardMaterial(o.color(color), 1),
      );
      scene.add(bead);
      return { bead, curve: group.userData.curve, phase: k / 7 };
    }),
  );

  // The camera looks at the middle of everything, from far enough to see it all.
  const bounds = new Box3();
  for (const g of parts) bounds.expandByObject(g);
  for (const t of tags) bounds.expandByPoint(t.at);
  const sphere = bounds.isEmpty()
    ? new Sphere(new Vector3(), 10)
    : bounds.getBoundingSphere(new Sphere());
  const camera = new PerspectiveCamera(35, 1, 0.1, 10000);
  // Close enough that the scene fills its frame; its bounding sphere is loose, so a bit closer still.
  const fit = (sphere.radius / Math.tan(rad(35) / 2)) * 0.82;
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(sphere.center);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = fit * 0.3;
  controls.maxDistance = fit * 3;
  controls.rotateSpeed = 0.8;

  /** Puts the camera at `cam` (degrees round and up, and a zoom factor). */
  const place = (cam) => {
    const yaw = rad(cam.yaw);
    const pitch = rad(Math.max(-85, Math.min(85, cam.pitch)));
    const dist = fit / (cam.zoom ?? 1);
    camera.position.set(
      sphere.center.x + dist * Math.sin(yaw) * Math.cos(pitch),
      sphere.center.y + dist * Math.sin(pitch),
      sphere.center.z + dist * Math.cos(yaw) * Math.cos(pitch),
    );
    camera.lookAt(sphere.center);
    controls.update();
  };
  const start = { yaw: shape.camera?.yaw ?? 35, pitch: shape.camera?.pitch ?? 25 };
  place(o.camera ?? start);

  /** The camera now, as the page keeps it between redraws. */
  const now = () => {
    const off = new Vector3().subVectors(camera.position, controls.target);
    const dist = off.length();
    return {
      yaw: Math.round(deg(Math.atan2(off.x, off.z))),
      pitch: Math.round(deg(Math.asin(off.y / dist))),
      zoom: Math.round((fit / dist) * 100) / 100,
    };
  };

  // A slow turn at first, until the user takes over.
  const still = o.still || win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotate = !still && !o.camera;
  controls.autoRotateSpeed = 1.6;
  const takeOver = () => (controls.autoRotate = false);
  canvas.addEventListener("pointerdown", takeOver);
  canvas.addEventListener("wheel", takeOver, { passive: true });
  controls.addEventListener("end", () => o.onTurn(now()));

  // Keys: arrows turn, + and - zoom, 0 puts the agent's view back.
  canvas.addEventListener("keydown", (e) => {
    const cam = now();
    const step = {
      ArrowLeft: [-12, 0],
      ArrowRight: [12, 0],
      ArrowUp: [0, 10],
      ArrowDown: [0, -10],
    }[e.key];
    if (step) place({ ...cam, yaw: cam.yaw + step[0], pitch: cam.pitch + step[1] });
    else if (e.key === "+" || e.key === "=") place({ ...cam, zoom: Math.min(3, cam.zoom * 1.2) });
    else if (e.key === "-") place({ ...cam, zoom: Math.max(0.35, cam.zoom / 1.2) });
    else if (e.key === "0") place(start);
    else return;
    e.preventDefault();
    takeOver();
    o.onTurn(now());
  });
  canvas.addEventListener("dblclick", () => {
    takeOver();
    place(start);
    o.onTurn(now());
  });

  // A click (not a drag) points at the part under it.
  const ray = new Raycaster();
  /** Where an event is, in the view's -1..1 coordinates. */
  const ndc = (e) => {
    const r = canvas.getBoundingClientRect();
    return new Vector2(
      ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
      -((e.clientY - r.top) / Math.max(1, r.height)) * 2 + 1,
    );
  };
  /** The part (an object's label) at `at`, or null. */
  const partAt = (at) => {
    ray.setFromCamera(at, camera);
    return ray.intersectObjects(parts, true)[0]?.object.userData.part ?? null;
  };
  let down = null;
  canvas.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    o.onPick(partAt(ndc(e)));
  });

  // The part under the pointer glows a little, found once a frame, not on every move.
  let hoverAt = null;
  let hovered = null;
  let picked = null;
  canvas.addEventListener("pointermove", (e) => {
    hoverAt = e.buttons ? null : ndc(e);
    if (e.buttons) setHover(null);
  });
  canvas.addEventListener("pointerleave", () => {
    hoverAt = null;
    setHover(null);
  });
  /** Lights the part pointed at, and less the one under the pointer, with their labels. */
  const paint = () => {
    for (const g of parts) {
      g.traverse((c) => {
        if (!c.material?.emissive) return;
        const part = c.userData.part;
        const hex = part && part === picked ? 0x333344 : part && part === hovered ? 0x1c1c28 : 0;
        c.material.emissive.setHex(hex);
      });
    }
    for (const t of tags) {
      t.tag.classList.toggle("picked", !!picked && t.part === picked);
      t.tag.classList.toggle("hover", !!hovered && t.part === hovered);
    }
    canvas.classList.toggle("over-part", !!hovered);
  };
  const setHover = (part) => {
    if (part === hovered) return;
    hovered = part;
    paint();
  };

  // Marking an area: a loop drawn on the model instead of turning it.
  const marker = createMarker({
    doc,
    body: host,
    canvas,
    camera,
    scene,
    parts,
    color: o.color("accent"),
    view: () => now(),
    onMark: (area) => o.onMark?.(area),
    onMode: (on) => {
      hint.textContent = on ? (o.markHint ?? o.hint) : o.hint;
      o.onMarkMode?.(on);
    },
  });

  /** Places the labels by their objects, nearest first, moving any that would overlap. */
  const placeLabels = (w, h) => {
    const seen = [];
    const order = tags
      .map((t) => ({ t, p: t.at.clone().project(camera) }))
      .sort((a, b) => a.p.z - b.p.z);
    for (const { t, p } of order) {
      if (p.z > 1) {
        t.tag.hidden = true;
        continue;
      }
      t.tag.hidden = false;
      const tw = t.tag.offsetWidth || 40;
      const th = t.tag.offsetHeight || 16;
      const ax = ((p.x + 1) / 2) * w;
      const ay = ((1 - p.y) / 2) * h;
      const clashes = (x, y) =>
        seen.find((s) => x < s.x + s.w && x + tw > s.x && y < s.y + s.h && y + th > s.y);
      // Above the object, else below, right or left of it; else under the label in the way.
      const spots = [
        [ax - tw / 2, ay - th - 4],
        [ax - tw / 2, ay + 6],
        [ax + 8, ay - th / 2],
        [ax - tw - 8, ay - th / 2],
        [ax + 8, ay - th - 6],
        [ax - tw - 8, ay + 6],
      ];
      let [x, y] = spots.find(([sx, sy]) => !clashes(sx, sy)) ?? spots[0];
      for (let k = 0; k < 8; k++) {
        const clash = clashes(x, y);
        if (!clash) break;
        y = clash.y + clash.h + 2;
      }
      x = Math.max(2, Math.min(w - tw - 2, x));
      y = Math.max(2, Math.min(h - th - 2, y));
      seen.push({ x, y, w: tw, h: th });
      t.tag.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  };

  let width = 0;
  let height = 0;
  let frame = 0;
  let alive = true;
  let paused = false;
  const tick = (time) => {
    frame = 0;
    if (!alive || paused) return;
    controls.update();
    if (hoverAt) {
      setHover(partAt(hoverAt));
      hoverAt = null;
    }
    for (const b of beads) {
      const t = (b.phase + (still ? 0 : time / 4000)) % 1;
      b.bead.position.copy(b.curve.getPoint(t));
    }
    renderer.render(scene, camera);
    placeLabels(width, height);
    frame = win.requestAnimationFrame(tick);
  };

  return {
    /** Sizes the view to `w` × `h` CSS pixels. */
    resize(w, h) {
      if (w === width && h === height) return;
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!frame && !paused) frame = win.requestAnimationFrame(tick);
    },
    /** Marks `part` (or nothing) as the one pointed at. */
    highlight(part) {
      picked = part ?? null;
      paint();
    },
    /** Turns marking an area on or off. */
    setMarking(on) {
      marker.setMode(on);
      hint.textContent = on ? (o.markHint ?? o.hint) : o.hint;
    },
    /** Takes the area's mark off the model. */
    clearMark() {
      marker.clear();
    },
    /** Stops drawing while the window is folded away (`on`), and starts again. */
    pause(on) {
      paused = !!on;
      if (paused && frame) {
        win.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!paused && width && !frame) frame = win.requestAnimationFrame(tick);
    },
    dispose() {
      alive = false;
      win.cancelAnimationFrame(frame);
      controls.dispose();
      marker.dispose();
      scene.traverse((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
      renderer.dispose();
      host.replaceChildren();
    },
  };
}
