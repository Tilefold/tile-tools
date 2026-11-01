/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — the layer of real 3D views
 *
 * Keeps one WebGL view (three3d.js) for each 3D scene shown on the board,
 * each in a window that floats over the board (floatView.js), in a layer
 * on top of the board's SVG in the same scroller, so a window scrolls and
 * scales with the board and the content under it stays as it is.
 *
 * A window sits at its scene's x, y on the board. The user moves it by its
 * bar: while they drag, only the window moves here; when they drop it,
 * `onMove` gives its new place in board units (inside the board, the
 * scene's size kept), for the tile to keep, and the window stays there
 * until the board comes back with it. The arrow keys on the bar move it in
 * steps, and tell the tile once the keys stop. A window the user touches
 * comes to the front; one they fold shows just its bar, and its view
 * pauses. A view is made again only when what it shows (its objects,
 * camera, size or title) or the theme changed, never when it only moved;
 * turning one keeps its camera in `cameras`.
 */
import { WIDTH } from "../src/layout.js";
import { createFloat } from "./floatView.js";
import { createView } from "./three3d.js";

/** How long after the last arrow key a keyboard move is told to the tile, in ms. */
const KEY_SETTLE_MS = 400;

/**
 * @param {{ doc: Document, svg: SVGSVGElement,
 *   labels: () => { hint: string, move: string, fold: string, unfold: string, untitled: string,
 *     mark: string, marking: string },
 *   cameras: Map<string, any>,
 *   onPick: (id: string, part: string | null) => void,
 *   onMove: (id: string, x: number, y: number) => void,
 *   onArea: (id: string, area: object) => void,
 *   makeView?: typeof createView }} o
 *   `makeView` stands in for the WebGL view in tests.
 */
export function createGlLayer(o) {
  const { doc, svg } = o;
  const makeView = o.makeView ?? createView;
  const layer = doc.createElement("div");
  layer.className = "gl-layer";
  svg.after(layer);
  /** Each scene's window: its key, the window, its view, its shape, and where the user put it. */
  const views = new Map();
  /** The scenes the user folded, by id; kept while the page is open. */
  const folded = new Set();
  let theme = 0;
  /** The next window brought to the front gets this. */
  let top = 1;

  /** A palette color as the theme draws it now. */
  const color = (name) => {
    const css = doc.defaultView.getComputedStyle(doc.documentElement);
    const v = css.getPropertyValue(name === "accent" ? "--accent" : `--ink-${name}`).trim();
    return v || "#5b5bd6";
  };

  /** Board units to pixels, as the board is drawn now. */
  const scale = () => (svg.getBoundingClientRect().width || WIDTH) / WIDTH;
  /** The board's height in units, from what the page draws. */
  const boardH = () => svg.viewBox?.baseVal?.height || Number.POSITIVE_INFINITY;

  /** `x`, `y` kept so the whole of `s` stays on the board. */
  const inside = (s, x, y) => ({
    x: Math.round(Math.min(Math.max(0, WIDTH - s.w), Math.max(0, x))),
    y: Math.round(Math.min(Math.max(0, boardH() - s.h), Math.max(0, y))),
  });

  /** Where a window is now: where the user put it, else where its scene is. */
  const placeOf = (v) => v.place ?? { x: v.shape.x, y: v.shape.y };

  /** Moves and sizes one window over the board. */
  const put = (v) => {
    const k = scale();
    const at = placeOf(v);
    const w = Math.max(1, Math.round(v.shape.w * k));
    const h = Math.max(1, Math.round(v.shape.h * k));
    v.win.host.style.transform = `translate(${Math.round(at.x * k)}px, ${Math.round(at.y * k)}px)`;
    v.win.host.style.width = `${w}px`;
    v.win.host.style.height = v.win.folded() ? "" : `${h}px`;
    if (!v.win.folded()) v.view.resize(Math.max(1, w - 2), Math.max(1, h - v.win.barHeight() - 2));
  };

  /** Moves the layer onto the board and every window into place. */
  const layout = () => {
    // Where the board sits in its scroller (an SVG element has no offsetLeft).
    const scroller = layer.parentElement;
    const at = svg.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    layer.style.left = `${at.left - box.left + scroller.scrollLeft - scroller.clientLeft}px`;
    layer.style.top = `${at.top - box.top + scroller.scrollTop - scroller.clientTop}px`;
    for (const v of views.values()) put(v);
  };
  const Observer = doc.defaultView.ResizeObserver;
  if (Observer) new Observer(layout).observe(svg);

  /** Brings a window in front of the others. */
  const raise = (v) => (v.win.host.style.zIndex = String(top++));

  /** Makes the window and the view for scene `s`. */
  function open(s, key) {
    const t = o.labels();
    const v = { key, shape: s, place: null, grabbed: null, timer: 0 };
    v.win = createFloat(doc, {
      title: s.label || t.untitled,
      labels: t,
      folded: folded.has(s.id),
      onGrab: () => {
        raise(v);
        v.grabbed = placeOf(v);
      },
      onDrag: (dx, dy) => {
        const k = scale();
        v.place = inside(v.shape, v.grabbed.x + dx / k, v.grabbed.y + dy / k);
        put(v);
      },
      onDrop: () => {
        v.grabbed = null;
        const at = placeOf(v);
        o.onMove(v.shape.id, at.x, at.y);
      },
      onKey: (dx, dy) => {
        const at = placeOf(v);
        v.place = inside(v.shape, at.x + dx, at.y + dy);
        put(v);
        doc.defaultView.clearTimeout(v.timer);
        v.timer = doc.defaultView.setTimeout(() => {
          const now = placeOf(v);
          o.onMove(v.shape.id, now.x, now.y);
        }, KEY_SETTLE_MS);
      },
      onFold: (on) => {
        if (on) folded.add(s.id);
        else folded.delete(s.id);
        v.view.pause(on);
        put(v);
      },
      onPick: () => {
        raise(v);
        o.onPick(s.id, null);
      },
      onMarkMode: (on) => v.view.setMarking(on),
    });
    v.win.host.dataset.scene = s.id;
    v.win.host.addEventListener("pointerdown", () => raise(v));
    layer.append(v.win.host);
    v.view = makeView(doc, v.win.body, s, {
      color,
      camera: o.cameras.get(s.id),
      hint: t.hint,
      onTurn: (cam) => o.cameras.set(s.id, cam),
      onPick: (part) => o.onPick(s.id, part),
      markHint: t.marking,
      onMark: (area) => o.onArea(s.id, area),
      onMarkMode: (on) => v.win.setMarking(on),
    });
    if (v.win.folded()) v.view.pause(true);
    return v;
  }

  /** Takes a window and its view away. */
  function close(v) {
    doc.defaultView.clearTimeout(v.timer);
    v.view.dispose();
    v.win.host.remove();
  }

  /** What a view shows: a move alone doesn't make it again. */
  const keyOf = (s) =>
    `${theme}:${JSON.stringify([s.objects, s.camera, s.w, s.h, s.label ?? null])}`;

  return {
    /** Shows windows for `scenes` (the scene3d shapes shown now) and drops the rest. */
    sync(scenes) {
      const keep = new Set();
      for (const s of scenes) {
        keep.add(s.id);
        const key = keyOf(s);
        let v = views.get(s.id);
        if (v && v.key !== key) {
          close(v);
          v = null;
        }
        if (!v) {
          v = open(s, key);
          views.set(s.id, v);
        } else {
          // The board caught up with where the user put it (or the agent moved it).
          if (v.place && !v.grabbed && v.place.x === s.x && v.place.y === s.y) v.place = null;
          v.shape = s;
        }
      }
      for (const [id, v] of views) {
        if (keep.has(id)) continue;
        close(v);
        views.delete(id);
      }
      layout();
    },
    /**
     * Marks the part pointed at in scene `id` (nothing, elsewhere); an area's
     * mark stays only while that area is what's pointed at.
     */
    highlight(id, part, area = false) {
      for (const [sid, v] of views) {
        v.view.highlight(sid === id ? part : null);
        if (sid !== id || !area) v.view.clearMark();
      }
    },
    /** The theme changed: make every view again in its colors. */
    themeChanged() {
      theme += 1;
    },
  };
}
