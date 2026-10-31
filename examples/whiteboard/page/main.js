/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page
 *
 * Draws the board the tile sends: the content's numbered lines, and over
 * them the shapes of every step up to the one shown, the newest step's
 * fading in. The step's caption (what the agent says in it) is above the
 * board, with Back and Next to go over the explanation again. A click on
 * a line or a drawing points at it; with or without a question typed in,
 * Ask sends it to the tile, for the agent to read. A 3D scene turns while
 * it's dragged (that only changes the view here, not the board).
 *
 * Messages with the tile: the page says `hello` when it loads and gets
 * `setup` (the labels in the user's language and the board), then `board`
 * after every change. It sends `step` ({ n }), `ask` ({ line?, shape?,
 * question? }) and `close`. Labels hold `{n}` and `{total}` where those go.
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // src/layout.js
  var WIDTH = 1e3;
  var MAX_HEIGHT = 6e3;
  var MIN_HEIGHT = 560;
  var CONTENT_TOP = 20;
  var LINE_H = 22;
  var CHAR_W = 9.6;
  var GUTTER_X = 44;
  var TEXT_X = 56;
  var CONTENT_MAX_W = 640;
  var BOTTOM_PAD = 40;
  var LABEL_CHAR = 0.56;
  var LABEL_LEADING = 1.35;
  var clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  function contentBox(content) {
    if (!content || content.lines.length === 0) {
      return { x: 0, y: CONTENT_TOP, w: 0, h: 0, from: 0, to: -1 };
    }
    const longest = content.lines.reduce((n, l) => Math.max(n, l.length), 0);
    const w = Math.min(CONTENT_MAX_W, TEXT_X + longest * CHAR_W + 16);
    return {
      x: 0,
      y: CONTENT_TOP,
      w: Math.round(w),
      h: content.lines.length * LINE_H,
      from: content.from,
      to: content.from + content.lines.length - 1
    };
  }
  function lineBox(content, line, cols) {
    if (!content) return null;
    const i = line - content.from;
    if (!Number.isInteger(i) || i < 0 || i >= content.lines.length) return null;
    const y = CONTENT_TOP + i * LINE_H;
    const text = content.lines[i];
    if (cols) {
      const [a, b] = cols;
      return { x: TEXT_X + (a - 1) * CHAR_W, y, w: (b - a + 1) * CHAR_W, h: LINE_H };
    }
    const w = Math.max(CHAR_W, Math.min(CONTENT_MAX_W - TEXT_X, text.length * CHAR_W));
    return { x: TEXT_X, y, w, h: LINE_H };
  }
  function wrapText(text, max) {
    const out = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        let w = word;
        while (w.length > max) {
          if (line) out.push(line);
          line = "";
          out.push(w.slice(0, max));
          w = w.slice(max);
        }
        if (!line) line = w;
        else if (line.length + 1 + w.length <= max) line += ` ${w}`;
        else {
          out.push(line);
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  }
  var labelLines = (text, w, size) => wrapText(text, Math.max(4, Math.floor((w - 16) / (size * LABEL_CHAR))));
  var labelHeight = (n, size) => n * size * LABEL_LEADING;
  var NOTE_SIZE = 15;
  var NOTE_PAD = 10;
  var noteHeight = (text, w) => Math.ceil(labelHeight(labelLines(text, w, NOTE_SIZE).length, NOTE_SIZE) + NOTE_PAD * 2);
  function shapeBox(shape, find2, content) {
    switch (shape.kind) {
      case "box":
      case "ellipse":
      case "scene3d":
        return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
      case "note":
        return { x: shape.x, y: shape.y, w: shape.w, h: noteHeight(shape.text, shape.w) };
      case "text": {
        const w = shape.text.length * shape.size * LABEL_CHAR;
        const x = shape.align === "middle" ? shape.x - w / 2 : shape.align === "end" ? shape.x - w : shape.x;
        return { x, y: shape.y - shape.size, w, h: shape.size * LABEL_LEADING };
      }
      case "highlight": {
        const top = lineBox(content, shape.lines[0], shape.cols);
        const bottom = lineBox(content, shape.lines[1], shape.cols);
        if (!top || !bottom) return null;
        const w = shape.cols ? top.w : contentBox(content).w - TEXT_X + 4;
        return { x: top.x - 4, y: top.y, w, h: bottom.y + bottom.h - top.y };
      }
      case "arrow":
      case "line": {
        const ends = endsOf(shape, find2, content);
        if (!ends) return null;
        const [a, b] = ends;
        return {
          x: Math.min(a[0], b[0]),
          y: Math.min(a[1], b[1]),
          w: Math.abs(a[0] - b[0]),
          h: Math.abs(a[1] - b[1])
        };
      }
      case "path":
        return pathBox(shape.d);
      default:
        return null;
    }
  }
  function pathBox(d) {
    const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    if (!xs.length || !ys.length) return { x: 0, y: 0, w: 0, h: 0 };
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  var centerOf = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  function sidePoint(b, side) {
    const [cx, cy] = centerOf(b);
    if (side === "top") return [cx, b.y];
    if (side === "bottom") return [cx, b.y + b.h];
    if (side === "left") return [b.x, cy];
    if (side === "right") return [b.x + b.w, cy];
    return [cx, cy];
  }
  function sideFacing(b, p) {
    const [cx, cy] = centerOf(b);
    const dx = (p[0] - cx) / Math.max(1, b.w);
    const dy = (p[1] - cy) / Math.max(1, b.h);
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
    return dy >= 0 ? "bottom" : "top";
  }
  function targetOf(point2, find2, content) {
    if (Array.isArray(point2)) return { at: point2 };
    if ("line" in point2) {
      const b2 = lineBox(content, point2.line, point2.col ? [point2.col, point2.col] : void 0);
      if (!b2) return null;
      if (point2.col) return { at: centerOf(b2), box: b2, side: point2.side };
      return { at: [b2.x + b2.w + 6, b2.y + b2.h / 2], box: b2, side: point2.side, lineEnd: true };
    }
    const other = find2(point2.shape);
    if (!other || other.kind === "arrow" || other.kind === "line") return null;
    const b = shapeBox(other, find2, content);
    return b ? { at: centerOf(b), box: b, side: point2.side } : null;
  }
  function endPoint(t, toward) {
    if (!t.box) return t.at;
    if (t.lineEnd && (!t.side || t.side === "right")) return t.at;
    if (t.side === "center") return centerOf(t.box);
    return sidePoint(t.box, t.side ?? sideFacing(t.box, toward));
  }
  function endsOf(shape, find2, content) {
    const a = targetOf(shape.from, find2, content);
    const b = targetOf(shape.to, find2, content);
    if (!a || !b) return null;
    return [endPoint(a, b.at), endPoint(b, a.at)];
  }
  function boardHeight(content, shapes, find2) {
    const c = contentBox(content);
    let bottom = c.y + c.h;
    for (const s of shapes) {
      const b = shapeBox(s, find2, content);
      if (b) bottom = Math.max(bottom, b.y + b.h);
    }
    return clamp(Math.ceil(bottom + BOTTOM_PAD), MIN_HEIGHT, MAX_HEIGHT);
  }

  // src/scene.js
  var COLORS = [
    "accent",
    "red",
    "orange",
    "yellow",
    "green",
    "teal",
    "blue",
    "purple",
    "gray"
  ];

  // page-src/project.js
  var DISTANCE = 4;
  var LIGHT = normalize([-0.4, 0.7, 0.6]);
  function normalize(v) {
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  }
  var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function rotate(p, yaw, pitch) {
    const a = yaw * Math.PI / 180;
    const b = pitch * Math.PI / 180;
    const x1 = p[0] * Math.cos(a) + p[2] * Math.sin(a);
    const z1 = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
    const y2 = p[1] * Math.cos(b) - z1 * Math.sin(b);
    const z2 = p[1] * Math.sin(b) + z1 * Math.cos(b);
    return [x1, y2, z2];
  }
  function boxCorners(o) {
    const [w, h, d] = o.size.map((s) => s / 2);
    const [x, y, z] = o.at;
    const out = [];
    for (const dx of [-w, w])
      for (const dy of [-h, h]) for (const dz of [-d, d]) out.push([x + dx, y + dy, z + dz]);
    return out;
  }
  var FACES = [
    [0, 1, 3, 2],
    // left (x -)
    [4, 6, 7, 5],
    // right (x +)
    [0, 4, 5, 1],
    // bottom (y -)
    [2, 3, 7, 6],
    // top (y +)
    [0, 2, 6, 4],
    // back (z -)
    [1, 5, 7, 3]
    // front (z +)
  ];
  function extentOf(objects) {
    let r2 = 1;
    for (const o of objects) {
      const reach = o.kind === "box" ? Math.hypot(...o.size) / 2 : o.kind === "sphere" ? o.r : 0;
      r2 = Math.max(r2, Math.hypot(...o.at) + reach);
      if (o.kind === "line") r2 = Math.max(r2, Math.hypot(...o.to));
    }
    return r2;
  }
  function sceneItems(objects, camera, rect) {
    const extent = extentOf(objects);
    const scale = Math.min(rect.w, rect.h) / 2 / extent * 0.85;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const far = extent * DISTANCE;
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
          if (normal[2] <= 0) continue;
          const depth = f.reduce((s, i) => s + seen[i].depth, 0) / 4;
          const shade = Math.max(0, dot(normal, LIGHT));
          items.push({
            type: "poly",
            points: f.map((i) => seen[i].at),
            color: o.color,
            shade,
            depth
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
            depth: -Infinity
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
          depth: c.depth
        });
        if (o.label) {
          items.push({
            type: "text",
            x: c.at[0],
            y: c.at[1] - o.r * scale * c.k - 6,
            text: o.label,
            color: o.color,
            depth: -Infinity
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
          depth: (a.depth + b.depth) / 2
        });
        if (o.label) {
          const mid = [(a.at[0] + b.at[0]) / 2, (a.at[1] + b.at[1]) / 2];
          items.push({
            type: "text",
            x: mid[0],
            y: mid[1] - 6,
            text: o.label,
            color: o.color,
            depth: -Infinity
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
          dot: true
        });
        if (o.label) {
          items.push({
            type: "text",
            x: c.at[0] + 8,
            y: c.at[1] - 6,
            text: o.label,
            color: o.color,
            depth: -Infinity
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
          depth: -Infinity
        });
      }
    }
    return items.sort((a, b) => b.depth - a.depth);
  }

  // page-src/svg.js
  var NS = "http://www.w3.org/2000/svg";
  function el(doc2, tag, attrs = {}, children = []) {
    const node = doc2.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== void 0 && v !== null && v !== false) node.setAttribute(k, String(v));
    }
    for (const c of children) node.append(typeof c === "string" ? doc2.createTextNode(c) : c);
    return node;
  }
  var r = (n) => Math.round(n * 10) / 10;
  function textBlock(doc2, lines, { x, y, size, align = "middle", cls = "label" }) {
    const lead = size * 1.35;
    const top = align === "middle" ? y - labelHeight(lines.length, size) / 2 + size : y + size;
    return el(
      doc2,
      "text",
      { class: cls, x: r(x), y: r(top), "font-size": size, "text-anchor": align },
      lines.map((line, i) => el(doc2, "tspan", { x: r(x), dy: i === 0 ? 0 : r(lead) }, [line]))
    );
  }
  function curveOf(a, b, curve) {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const c = [mx - dy / len * curve * len * 0.5, my + dx / len * curve * len * 0.5];
    const mid = [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4];
    return { c, mid };
  }
  function shapeNode(doc2, s, find2, content, cameraOf2, hint) {
    const cls = `shape k-${s.kind} c-${s.color}`;
    const g = el(doc2, "g", { class: cls, "data-shape": s.id });
    switch (s.kind) {
      case "box":
      case "ellipse": {
        const attrs = { class: s.fill ? "body filled" : "body" };
        g.append(
          s.kind === "box" ? el(doc2, "rect", { ...attrs, x: s.x, y: s.y, width: s.w, height: s.h, rx: 8 }) : el(doc2, "ellipse", {
            ...attrs,
            cx: s.x + s.w / 2,
            cy: s.y + s.h / 2,
            rx: s.w / 2,
            ry: s.h / 2
          })
        );
        if (s.label) {
          g.append(
            textBlock(doc2, labelLines(s.label, s.w, 15), {
              x: s.x + s.w / 2,
              y: s.y + s.h / 2,
              size: 15
            })
          );
        }
        return g;
      }
      case "note": {
        const b = shapeBox(s, find2, content);
        g.append(
          el(doc2, "rect", { class: "body note", x: s.x, y: s.y, width: s.w, height: b.h, rx: 6 })
        );
        g.append(
          textBlock(doc2, labelLines(s.text, s.w, NOTE_SIZE), {
            x: s.x + 10,
            y: s.y + 10 - NOTE_SIZE * 0.2,
            size: NOTE_SIZE,
            align: "start"
          })
        );
        return g;
      }
      case "text":
        g.append(
          el(
            doc2,
            "text",
            { class: "label free", x: s.x, y: s.y, "font-size": s.size, "text-anchor": s.align },
            [s.text]
          )
        );
        return g;
      case "highlight": {
        const b = shapeBox(s, find2, content);
        if (!b) return null;
        g.append(
          el(doc2, "rect", {
            class: "body band",
            x: r(b.x),
            y: r(b.y),
            width: r(b.w),
            height: r(b.h),
            rx: 4
          })
        );
        if (s.label) {
          const last = lineBox(content, s.lines[1]);
          const x = contentBox(content).w + 8;
          g.append(
            el(doc2, "text", { class: "label tag", x: r(x), y: r(last.y + 16), "font-size": 13 }, [
              s.label
            ])
          );
        }
        return g;
      }
      case "arrow":
      case "line": {
        const ends = endsOf(s, find2, content);
        if (!ends) return null;
        const [a, b] = ends;
        const { c, mid } = curveOf(a, b, s.curve);
        const d = s.curve ? `M${r(a[0])} ${r(a[1])} Q${r(c[0])} ${r(c[1])} ${r(b[0])} ${r(b[1])}` : `M${r(a[0])} ${r(a[1])} L${r(b[0])} ${r(b[1])}`;
        g.append(
          el(doc2, "path", {
            class: s.dashed ? "stroke dashed" : "stroke",
            d,
            "marker-end": s.kind === "arrow" ? `url(#head-${s.color})` : void 0,
            "marker-start": s.both ? `url(#tail-${s.color})` : void 0
          })
        );
        if (s.label) {
          g.append(
            el(
              doc2,
              "text",
              {
                class: "label on-line",
                x: r(mid[0]),
                y: r(mid[1] - 6),
                "font-size": 13,
                "text-anchor": "middle"
              },
              [s.label]
            )
          );
        }
        return g;
      }
      case "path":
        g.append(
          el(doc2, "path", {
            class: `stroke${s.fill ? " filled" : ""}${s.dashed ? " dashed" : ""}`,
            d: s.d
          })
        );
        return g;
      case "scene3d":
        g.append(sceneNode(doc2, s, cameraOf2(s.id), hint));
        return g;
      default:
        return null;
    }
  }
  function sceneNode(doc2, s, camera, hint) {
    const g = el(doc2, "g", { class: "scene" });
    g.append(el(doc2, "rect", { class: "frame", x: s.x, y: s.y, width: s.w, height: s.h, rx: 8 }));
    const inner = { x: s.x, y: s.y + (s.label ? 24 : 0), w: s.w, h: s.h - (s.label ? 24 : 0) };
    const body = el(doc2, "g", { class: "pieces" });
    for (const p of sceneItems(s.objects, camera, inner)) {
      const pc = `c-${p.color}`;
      if (p.type === "poly") {
        body.append(
          el(doc2, "polygon", {
            class: `face ${pc}`,
            points: p.points.map(([x, y]) => `${r(x)},${r(y)}`).join(" "),
            "fill-opacity": r(0.35 + p.shade * 0.55)
          })
        );
      } else if (p.type === "circle") {
        body.append(
          el(doc2, "circle", {
            class: `${p.dot ? "dot" : "ball"} ${pc}`,
            cx: r(p.cx),
            cy: r(p.cy),
            r: r(p.r)
          })
        );
      } else if (p.type === "line") {
        body.append(
          el(doc2, "line", {
            class: `edge ${pc}`,
            x1: r(p.a[0]),
            y1: r(p.a[1]),
            x2: r(p.b[0]),
            y2: r(p.b[1])
          })
        );
      } else {
        body.append(
          el(
            doc2,
            "text",
            { class: `label ${pc}`, x: r(p.x), y: r(p.y), "font-size": 13, "text-anchor": "middle" },
            [p.text]
          )
        );
      }
    }
    g.append(body);
    if (s.label) {
      g.append(
        el(doc2, "text", { class: "label title", x: s.x + 12, y: s.y + 18, "font-size": 14 }, [
          s.label
        ])
      );
    }
    if (hint) {
      g.append(
        el(
          doc2,
          "text",
          {
            class: "scene-hint",
            x: s.x + s.w - 10,
            y: s.y + s.h - 10,
            "font-size": 11,
            "text-anchor": "end"
          },
          [hint]
        )
      );
    }
    return g;
  }
  function markers(doc2, colors) {
    const defs = el(doc2, "defs");
    for (const c of colors) {
      for (const [id, orient] of [
        [`head-${c}`, "auto"],
        [`tail-${c}`, "auto-start-reverse"]
      ]) {
        defs.append(
          el(
            doc2,
            "marker",
            {
              id,
              viewBox: "0 0 10 10",
              refX: 8,
              refY: 5,
              markerWidth: 7,
              markerHeight: 7,
              orient,
              class: `head c-${c}`
            },
            [el(doc2, "path", { d: "M0 0 L10 5 L0 10 z" })]
          )
        );
      }
    }
    return defs;
  }

  // page-src/main.js
  var bridge = window.tilefold;
  var doc = document;
  var $ = (id) => doc.getElementById(id);
  var send = (message) => {
    if (bridge) bridge.post(message).catch(() => {
    });
  };
  var labels = {};
  var board = null;
  var drawnStep = -1;
  var pointed = null;
  var cameras = /* @__PURE__ */ new Map();
  var FIT_MIN = 700;
  var zoom = "fit";
  var L = (key, vars = {}) => String(labels[key] ?? "").replace(/\{(n|total)\}/g, (_, k) => String(vars[k] ?? ""));
  var find = (id) => board?.shapes.find((s) => s.id === id);
  var cameraOf = (id) => cameras.get(id) ?? find(id)?.camera ?? { yaw: 35, pitch: 25 };
  function words() {
    doc.documentElement.lang = labels["page-lang"] || "en";
    doc.documentElement.dir = labels["page-dir"] || "ltr";
    doc.title = L("page-title");
    $("title").textContent = board?.title || L("page-title");
    $("close").title = L("page-close");
    $("close").setAttribute("aria-label", L("page-close"));
    const rtl = doc.documentElement.dir === "rtl";
    $("back").textContent = `${rtl ? "\u2192" : "\u2190"} ${L("step-back")}`;
    $("next").textContent = `${L("step-next")} ${rtl ? "\u2190" : "\u2192"}`;
    $("zoom").textContent = L(zoom === "fit" ? "zoom-actual" : "zoom-fit");
    $("empty-title").textContent = L("empty-title");
    $("empty-hint").textContent = L("empty-hint");
    $("question").placeholder = L("ask-placeholder");
    $("send").textContent = L("ask-send");
    $("ask-hint").textContent = L("ask-hint");
    $("unpoint").textContent = L("ask-clear");
    $("board").setAttribute("aria-label", L("board-label"));
  }
  function caption() {
    const total = board.steps.length;
    const n = board.step;
    $("steps").hidden = total <= 1;
    $("count").textContent = n === 0 ? L("step-start") : L("step-count", { n, total: total - 1 });
    $("back").disabled = n === 0;
    $("next").disabled = n >= total - 1;
    const say = board.steps[n]?.say;
    $("caption").textContent = say ?? "";
    $("caption").hidden = !say;
  }
  function contentNodes(svg) {
    const c = board.content;
    if (!c) return;
    const g = el(doc, "g", { class: `content ${c.kind}` });
    c.lines.forEach((text, i) => {
      const n = c.from + i;
      const y = CONTENT_TOP + i * LINE_H;
      const row = el(doc, "g", { class: "line", "data-line": n });
      row.append(el(doc, "rect", { class: "hit", x: 0, y, width: WIDTH, height: LINE_H }));
      row.append(
        el(doc, "text", { class: "num", x: GUTTER_X, y: y + 16, "text-anchor": "end" }, [String(n)])
      );
      row.append(el(doc, "text", { class: "code", x: TEXT_X, y: y + 16 }, [text]));
      g.append(row);
    });
    svg.append(g);
  }
  function draw() {
    const svg = $("board");
    svg.replaceChildren();
    const empty = !board.content && board.shapes.length === 0;
    $("empty").hidden = !empty || board.steps.length > 1;
    svg.toggleAttribute("hidden", empty);
    caption();
    $("title").textContent = board.title || L("page-title");
    if (empty) return;
    const height = boardHeight(board.content, board.shapes, find);
    svg.setAttribute("viewBox", `0 0 ${WIDTH} ${height}`);
    svg.style.width = zoom === "fit" ? "100%" : `${WIDTH}px`;
    svg.style.minWidth = zoom === "fit" ? `${FIT_MIN}px` : "";
    svg.append(markers(doc, COLORS));
    const shown = board.shapes.filter((s) => s.step <= board.step);
    const fresh = board.step > drawnStep ? board.step : -1;
    const under = el(doc, "g", { class: "under" });
    const over = el(doc, "g", { class: "over" });
    for (const s of shown) {
      const node = shapeNode(doc, s, find, board.content, cameraOf, L("scene-hint"));
      if (!node) continue;
      if (s.step === fresh && fresh > 0) node.classList.add("fresh");
      (s.kind === "highlight" ? under : over).append(node);
    }
    svg.append(under);
    contentNodes(svg);
    svg.append(over);
    drawnStep = board.step;
    mark();
  }
  function mark() {
    for (const n of $("board").querySelectorAll(".pointed")) n.classList.remove("pointed");
    if (pointed && "line" in pointed && !lineBox(board.content, pointed.line)) pointed = null;
    if (pointed && "shape" in pointed && !find(pointed.shape)) pointed = null;
    const node = pointed ? $("board").querySelector(
      "line" in pointed ? `[data-line="${pointed.line}"]` : `[data-shape="${pointed.shape}"]`
    ) : null;
    node?.classList.add("pointed");
    $("pointing").hidden = !pointed;
    $("pointed").textContent = !pointed ? "" : "line" in pointed ? L("ask-line", { n: pointed.line }) : L("ask-shape");
  }
  function point(e) {
    const shape = e.target.closest?.("[data-shape]");
    const line = e.target.closest?.("[data-line]");
    let next = null;
    if (shape) next = { shape: shape.getAttribute("data-shape") };
    else if (line) next = { line: Number(line.getAttribute("data-line")) };
    const same = next && pointed && JSON.stringify(next) === JSON.stringify(pointed);
    pointed = same ? null : next;
    mark();
    if (pointed) $("question").focus();
  }
  function askIt(e) {
    e.preventDefault();
    const question = $("question").value.trim();
    if (!pointed && !question) return;
    send({ type: "ask", ...pointed ?? {}, ...question ? { question } : {} });
    $("question").value = "";
    pointed = null;
    mark();
    $("ask-status").textContent = L("ask-sent");
  }
  function dragScenes() {
    let drag = null;
    $("board").addEventListener("pointerdown", (e) => {
      const g = e.target.closest?.(".k-scene3d");
      if (!g) return;
      const id = g.getAttribute("data-shape");
      drag = { id, x: e.clientX, y: e.clientY, cam: { ...cameraOf(id) }, moved: false };
      g.setPointerCapture?.(e.pointerId);
    });
    $("board").addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      const cam = {
        yaw: drag.cam.yaw + dx * 0.6,
        pitch: Math.max(-89, Math.min(89, drag.cam.pitch + dy * 0.6))
      };
      cameras.set(drag.id, cam);
      const g = $("board").querySelector(`[data-shape="${drag.id}"]`);
      const s = find(drag.id);
      if (g && s) g.replaceChildren(sceneNode(doc, s, cam, L("scene-hint")));
    });
    const end = () => {
      if (drag?.moved) suppressClick = true;
      drag = null;
    };
    $("board").addEventListener("pointerup", end);
    $("board").addEventListener("pointercancel", end);
  }
  var suppressClick = false;
  function wire() {
    $("close").addEventListener("click", () => send({ type: "close" }));
    $("back").addEventListener("click", () => board && send({ type: "step", n: board.step - 1 }));
    $("next").addEventListener("click", () => board && send({ type: "step", n: board.step + 1 }));
    $("zoom").addEventListener("click", () => {
      zoom = zoom === "fit" ? "actual" : "fit";
      words();
      if (board) draw();
    });
    $("board").addEventListener("click", (e) => {
      if (suppressClick) return void (suppressClick = false);
      point(e);
    });
    $("unpoint").addEventListener("click", () => {
      pointed = null;
      mark();
    });
    $("ask").addEventListener("submit", askIt);
    $("question").addEventListener("input", () => $("ask-status").textContent = "");
    doc.addEventListener("keydown", (e) => {
      if (!board || e.target === $("question")) return;
      if (e.key === "ArrowLeft" && board.step > 0) send({ type: "step", n: board.step - 1 });
      if (e.key === "ArrowRight" && board.step < board.steps.length - 1)
        send({ type: "step", n: board.step + 1 });
    });
    dragScenes();
  }
  function followTheme(theme) {
    if (theme && (theme.mode === "light" || theme.mode === "dark")) {
      doc.documentElement.dataset.mode = theme.mode;
    } else delete doc.documentElement.dataset.mode;
  }
  wire();
  followTheme(bridge?.theme);
  bridge?.onTheme?.(followTheme);
  bridge?.onMessage((m) => {
    if (!m || typeof m !== "object") return;
    if (m.do === "setup") {
      labels = m.labels && typeof m.labels === "object" ? m.labels : {};
      board = m.board;
      drawnStep = board?.step ?? -1;
      words();
      if (board) draw();
    } else if (m.do === "board" && m.board) {
      if (board && m.board.steps.length < board.steps.length) drawnStep = -1;
      board = m.board;
      draw();
    }
  });
  send({ type: "hello" });
})();
