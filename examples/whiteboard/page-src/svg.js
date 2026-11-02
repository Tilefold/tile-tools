/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — drawing shapes as SVG
 *
 * Builds the SVG elements for each shape an agent drew (scene.js), in
 * board units. Colors are class names (`c-red`, …) the page's styles map
 * to the user's theme, never colors the agent wrote. Text goes in as text
 * nodes, so nothing an agent writes is read as markup.
 */
import {
  contentBox,
  endsOf,
  labelHeight,
  labelLines,
  lineBox,
  NOTE_SIZE,
  shapeBox,
} from "../src/layout.js";
import { sceneItems } from "./project.js";

const NS = "http://www.w3.org/2000/svg";

/**
 * An SVG element with attributes, and children (elements or text).
 *
 * @param {Document} doc
 */
export function el(doc, tag, attrs = {}, children = []) {
  const node = doc.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null && v !== false) node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(typeof c === "string" ? doc.createTextNode(c) : c);
  return node;
}

/** Rounds a number for an attribute. */
const r = (n) => Math.round(n * 10) / 10;

/** Lines of text centered round (cx, cy), or from (x, y) when `start`. */
function textBlock(doc, lines, { x, y, size, align = "middle", cls = "label" }) {
  const lead = size * 1.35;
  const top = align === "middle" ? y - labelHeight(lines.length, size) / 2 + size : y + size;
  return el(
    doc,
    "text",
    { class: cls, x: r(x), y: r(top), "font-size": size, "text-anchor": align },
    lines.map((line, i) => el(doc, "tspan", { x: r(x), dy: i === 0 ? 0 : r(lead) }, [line])),
  );
}

/** The middle of a quadratic curve from a to b bent by `curve`, and its control point. */
export function curveOf(a, b, curve) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  // Bend to the side, by up to half the arrow's length.
  const c = [mx - (dy / len) * curve * len * 0.5, my + (dx / len) * curve * len * 0.5];
  const mid = [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4];
  return { c, mid };
}

/**
 * The SVG for one shape, or null when it points at something missing.
 *
 * @param {Document} doc
 * @param {object} s  the shape
 * @param {(id: string) => object | undefined} find
 * @param {object | null} content
 * @param {(id: string) => { yaw: number, pitch: number }} cameraOf  a 3D scene's camera now
 * @param {string} [hint]  what a 3D scene says in its corner ("Drag to turn")
 */
export function shapeNode(doc, s, find, content, cameraOf, hint) {
  const cls = `shape k-${s.kind} c-${s.color}`;
  const g = el(doc, "g", { class: cls, "data-shape": s.id });
  switch (s.kind) {
    case "box":
    case "ellipse": {
      const attrs = { class: s.fill ? "body filled" : "body" };
      g.append(
        s.kind === "box"
          ? el(doc, "rect", { ...attrs, x: s.x, y: s.y, width: s.w, height: s.h, rx: 8 })
          : el(doc, "ellipse", {
              ...attrs,
              cx: s.x + s.w / 2,
              cy: s.y + s.h / 2,
              rx: s.w / 2,
              ry: s.h / 2,
            }),
      );
      if (s.label) {
        g.append(
          textBlock(doc, labelLines(s.label, s.w, 15), {
            x: s.x + s.w / 2,
            y: s.y + s.h / 2,
            size: 15,
          }),
        );
      }
      return g;
    }
    case "note": {
      const b = shapeBox(s, find, content);
      g.append(
        el(doc, "rect", { class: "body note", x: s.x, y: s.y, width: s.w, height: b.h, rx: 6 }),
      );
      g.append(
        textBlock(doc, labelLines(s.text, s.w, NOTE_SIZE), {
          x: s.x + 10,
          y: s.y + 10 - NOTE_SIZE * 0.2,
          size: NOTE_SIZE,
          align: "start",
        }),
      );
      return g;
    }
    case "text":
      g.append(
        el(
          doc,
          "text",
          { class: "label free", x: s.x, y: s.y, "font-size": s.size, "text-anchor": s.align },
          [s.text],
        ),
      );
      return g;
    case "highlight": {
      const b = shapeBox(s, find, content);
      if (!b) return null;
      g.append(
        el(doc, "rect", {
          class: "body band",
          x: r(b.x),
          y: r(b.y),
          width: r(b.w),
          height: r(b.h),
          rx: 4,
        }),
      );
      if (s.label) {
        // Labels go just right of the content column, clear of the code.
        const last = lineBox(content, s.lines[1]);
        const x = contentBox(content).w + 8;
        g.append(
          el(doc, "text", { class: "label tag", x: r(x), y: r(last.y + 16), "font-size": 13 }, [
            s.label,
          ]),
        );
      }
      return g;
    }
    case "arrow":
    case "line": {
      const ends = endsOf(s, find, content);
      if (!ends) return null;
      const [a, b] = ends;
      const { c, mid } = curveOf(a, b, s.curve);
      const d = s.curve
        ? `M${r(a[0])} ${r(a[1])} Q${r(c[0])} ${r(c[1])} ${r(b[0])} ${r(b[1])}`
        : `M${r(a[0])} ${r(a[1])} L${r(b[0])} ${r(b[1])}`;
      g.append(
        el(doc, "path", {
          class: s.dashed ? "stroke dashed" : "stroke",
          d,
          "marker-end": s.kind === "arrow" ? `url(#head-${s.color})` : undefined,
          "marker-start": s.both ? `url(#tail-${s.color})` : undefined,
        }),
      );
      if (s.label) {
        g.append(
          el(
            doc,
            "text",
            {
              class: "label on-line",
              x: r(mid[0]),
              y: r(mid[1] - 6),
              "font-size": 13,
              "text-anchor": "middle",
            },
            [s.label],
          ),
        );
      }
      return g;
    }
    case "path":
      g.append(
        el(doc, "path", {
          class: `stroke${s.fill ? " filled" : ""}${s.dashed ? " dashed" : ""}`,
          d: s.d,
        }),
      );
      return g;
    case "scene3d":
      g.append(sceneNode(doc, s, cameraOf(s.id), hint));
      return g;
    default:
      return null;
  }
}

/** A 3D scene's frame and its pieces, seen from `camera`, with `hint` in its corner. */
export function sceneNode(doc, s, camera, hint) {
  const g = el(doc, "g", { class: "scene" });
  g.append(el(doc, "rect", { class: "frame", x: s.x, y: s.y, width: s.w, height: s.h, rx: 8 }));
  const inner = { x: s.x, y: s.y + (s.label ? 24 : 0), w: s.w, h: s.h - (s.label ? 24 : 0) };
  const body = el(doc, "g", { class: "pieces" });
  for (const p of sceneItems(s.objects, camera, inner)) {
    const pc = `c-${p.color}`;
    if (p.type === "poly") {
      body.append(
        el(doc, "polygon", {
          class: `face ${pc}`,
          points: p.points.map(([x, y]) => `${r(x)},${r(y)}`).join(" "),
          "fill-opacity": r(0.35 + p.shade * 0.55),
        }),
      );
    } else if (p.type === "circle") {
      body.append(
        el(doc, "circle", {
          class: `${p.dot ? "dot" : "ball"} ${pc}`,
          cx: r(p.cx),
          cy: r(p.cy),
          r: r(p.r),
        }),
      );
    } else if (p.type === "line") {
      body.append(
        el(doc, "line", {
          class: `edge ${pc}`,
          x1: r(p.a[0]),
          y1: r(p.a[1]),
          x2: r(p.b[0]),
          y2: r(p.b[1]),
        }),
      );
    } else {
      body.append(
        el(
          doc,
          "text",
          { class: `label ${pc}`, x: r(p.x), y: r(p.y), "font-size": 13, "text-anchor": "middle" },
          [p.text],
        ),
      );
    }
  }
  g.append(body);
  if (s.label) {
    g.append(
      el(doc, "text", { class: "label title", x: s.x + 12, y: s.y + 18, "font-size": 14 }, [
        s.label,
      ]),
    );
  }
  if (hint) {
    g.append(
      el(
        doc,
        "text",
        {
          class: "scene-hint",
          x: s.x + s.w - 10,
          y: s.y + s.h - 10,
          "font-size": 11,
          "text-anchor": "end",
        },
        [hint],
      ),
    );
  }
  return g;
}

/** Arrowheads for each palette color, at the end of a stroke and (turned round) at its start. */
export function markers(doc, colors) {
  const defs = el(doc, "defs");
  for (const c of colors) {
    for (const [id, orient] of [
      [`head-${c}`, "auto"],
      [`tail-${c}`, "auto-start-reverse"],
    ]) {
      defs.append(
        el(
          doc,
          "marker",
          {
            id,
            viewBox: "0 0 10 10",
            refX: 8,
            refY: 5,
            markerWidth: 7,
            markerHeight: 7,
            orient,
            class: `head c-${c}`,
          },
          [el(doc, "path", { d: "M0 0 L10 5 L0 10 z" })],
        ),
      );
    }
  }
  return defs;
}
