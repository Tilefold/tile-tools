/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — the layer of real 3D views
 *
 * Keeps one WebGL view (three3d.js) over the frame of each 3D scene shown
 * on the board, in a layer on top of the board's SVG in the same scroller,
 * so a view scrolls and scales with the board. A view is made again only
 * when its scene or the theme changed; turning one keeps its camera in
 * `cameras`. The SVG still draws each scene's frame and title under it.
 */
import { WIDTH } from "../src/layout.js";
import { createView } from "./three3d.js";

/** Board units a scene's title takes at its top. */
const TITLE_H = 24;

/**
 * @param {{ doc: Document, svg: SVGSVGElement, hint: () => string,
 *   cameras: Map<string, any>, onPick: (id: string, part: string | null) => void }} o
 */
export function createGlLayer(o) {
  const { doc, svg } = o;
  const layer = doc.createElement("div");
  layer.className = "gl-layer";
  svg.after(layer);
  /** Each scene's view: its key (the scene and the theme), host, view and shape. */
  const views = new Map();
  let theme = 0;

  /** A palette color as the theme draws it now. */
  const color = (name) => {
    const css = doc.defaultView.getComputedStyle(doc.documentElement);
    const v = css.getPropertyValue(name === "accent" ? "--accent" : `--ink-${name}`).trim();
    return v || "#5b5bd6";
  };

  /** Moves and sizes every view over its scene's frame. */
  const layout = () => {
    // Where the board sits in its scroller (an SVG element has no offsetLeft).
    const scroller = layer.parentElement;
    const at = svg.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    layer.style.left = `${at.left - box.left + scroller.scrollLeft - scroller.clientLeft}px`;
    layer.style.top = `${at.top - box.top + scroller.scrollTop - scroller.clientTop}px`;
    const scale = at.width / WIDTH;
    for (const { host, view, shape: s } of views.values()) {
      const top = s.label ? TITLE_H : 0;
      const w = Math.max(1, Math.round(s.w * scale) - 2);
      const h = Math.max(1, Math.round((s.h - top) * scale) - 2);
      host.style.transform = `translate(${Math.round(s.x * scale) + 1}px, ${Math.round((s.y + top) * scale) + 1}px)`;
      host.style.width = `${w}px`;
      host.style.height = `${h}px`;
      view.resize(w, h);
    }
  };
  new doc.defaultView.ResizeObserver(layout).observe(svg);

  return {
    /** Shows views for `scenes` (the scene3d shapes shown now) and drops the rest. */
    sync(scenes) {
      const keep = new Set();
      for (const s of scenes) {
        const key = `${theme}:${JSON.stringify(s)}`;
        keep.add(s.id);
        if (views.get(s.id)?.key === key) continue;
        views.get(s.id)?.view.dispose();
        const host = views.get(s.id)?.host ?? doc.createElement("div");
        host.className = "gl-host";
        layer.append(host);
        const view = createView(doc, host, s, {
          color,
          camera: o.cameras.get(s.id),
          hint: o.hint(),
          onTurn: (cam) => o.cameras.set(s.id, cam),
          onPick: (part) => o.onPick(s.id, part),
        });
        views.set(s.id, { key, host, view, shape: s });
      }
      for (const [id, v] of views) {
        if (keep.has(id)) continue;
        v.view.dispose();
        v.host.remove();
        views.delete(id);
      }
      layout();
    },
    /** Marks the part pointed at in scene `id` (nothing, elsewhere). */
    highlight(id, part) {
      for (const [sid, v] of views) v.view.highlight(sid === id ? part : null);
    },
    /** The theme changed: make every view again in its colors. */
    themeChanged() {
      theme += 1;
    },
  };
}
