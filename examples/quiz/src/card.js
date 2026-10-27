/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the floating card
 *
 * Keeps the borderless card where it belongs and as big as the user made
 * it: the quiz page docked in Tilefold's window, with a thin grip above it
 * drawn as overlay items. It follows the focused pane's corner as panes
 * open, close and move (`overlay.layout`), or stays where the user put it.
 *
 * The user moves the card two ways, and both end the same:
 * - by the card's own top bar: the page follows the pointer itself and
 *   reports how far it has moved since the press (`pageMove`), as a docked
 *   page keeps the pointer and Tilefold never sees that drag;
 * - by the grip, which Tilefold reports as `overlay.pointer` drags.
 * And resizes it by its bottom-right corner, which the page reports the
 * same way (`pageResize`); the top-left corner stays put meanwhile. While a
 * drag is under way the page moves or grows on every step, and the spot and
 * size are kept only when the user lets go.
 *
 * The run module opens and closes the page; this module only says where it
 * goes (`pageSpot`) and moves it (`tf.page.dock`). Moves, resizes and resets
 * are recorded in the tile's activity log (`card-moved`, `card-resized`,
 * `card-reset`: a tile's action is one word, recorded as tile.<id>.<action>).
 */
import { gripImages } from "./grip.js";
import { contentOf, createDrag, positionFor, readPosition } from "./position.js";
import { cardOf, cardSpots, readSize } from "./scene.js";

/** The store keys of the card's place and size. */
export const POSITION_KEY = "position";
export const SIZE_KEY = "size";
/** Whether an overlay item is a piece of the grip. */
export const isGrip = (id) => /^grip-\d+$/.test(String(id));

/** A drag the page reports: where it is in the press, and how far it went. */
const PHASES = ["start", "move", "end"];
const amount = (n) => (Number.isFinite(n) ? Math.round(n) : 0);

/**
 * @param {any} tf
 * @param {{
 *   corner: () => string,
 *   theme: () => "light" | "dark",
 *   colors?: () => Record<string, string> | null,
 *   label: () => string,
 *   warn: (err: unknown) => void,
 * }} o
 */
export function createCard(tf, o) {
  /** The last layout Tilefold reported, or null before the first. */
  let layout = null;
  /** Where the user put the card, or null to follow the pane's corner. */
  let position = null;
  /** The page's size as the user left it. */
  let size = readSize(null);
  /** Whether the grip is drawn (the card is showing), and its item ids. */
  let shown = false;
  let drawnIds = "";
  /** The page's last spot, so it moves only when the spot changes. */
  let lastPage = "";
  /** A drag by the grip, and one by the page (its top-left, or size, at the press). */
  const drag = createDrag();
  let pageDrag = null;
  let pageSize = null;

  const audit = (action, details) =>
    Promise.resolve()
      .then(() => tf.audit(action, details))
      .catch(o.warn);

  /** The layout, asking Tilefold for it the first time. */
  const currentLayout = async () => {
    if (!layout) layout = await tf.overlay.layout();
    return layout;
  };

  const spots = async () => cardSpots(await currentLayout(), o.corner(), position, size);

  /** The grip's overlay items at the card's spot. */
  const items = (s) => {
    const images = gripImages(s.card.w, s.grip, o.theme(), o.colors?.() ?? null);
    return s.grip.map((r, i) => ({
      id: `grip-${i}`,
      image: images[i],
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      hit: true,
      cursor: "grab",
      label: o.label(),
    }));
  };

  /** Moves the docked page to its spot, if it changed. */
  const dockPage = (spot) => {
    const key = JSON.stringify(spot);
    if (key === lastPage) return;
    lastPage = key;
    void Promise.resolve()
      .then(() => tf.page.dock(spot))
      .catch(o.warn);
  };

  /** Draws the grip (a new scene when its pieces changed) and moves the page. */
  const draw = async () => {
    if (!shown) return;
    const s = await spots();
    const scene = items(s);
    const ids = scene.map((i) => i.id).join();
    if (ids === drawnIds) await tf.overlay.update({ items: scene });
    else await tf.overlay.show({ items: scene });
    drawnIds = ids;
    dockPage(s.page);
  };

  /** Keeps where the card is now, so a resize grows it from its top-left. */
  const pin = (card) => {
    const content = contentOf(layout);
    const next = cardOf(size);
    position = positionFor(content, next.w, next.h, card.x, card.y);
  };

  return {
    /** Reads the place and size kept from an earlier session. */
    async load() {
      position = readPosition(await tf.store.get(POSITION_KEY));
      size = readSize(await tf.store.get(SIZE_KEY), await currentLayout());
    },

    /** Where the page goes now (to open it docked there). */
    async pageSpot() {
      return (await spots()).page;
    },

    /** Draws the grip; the page was just opened at `pageSpot()`. */
    async show() {
      const s = await spots();
      const scene = items(s);
      await tf.overlay.show({ items: scene });
      shown = true;
      drawnIds = scene.map((i) => i.id).join();
      lastPage = JSON.stringify(s.page);
    },

    /** Takes the grip away (the page is closing or closed). */
    async hide() {
      drag.cancel();
      pageDrag = null;
      pageSize = null;
      if (!shown) return;
      shown = false;
      lastPage = "";
      drawnIds = "";
      await tf.overlay.hide();
    },

    /** Redraws in the user's language, corner or appearance, after a change. */
    redraw: draw,

    /** Follows a new window layout. */
    async moved(next) {
      if (next && typeof next === "object") layout = next;
      size = readSize(size, layout);
      if (!drag.active() && !pageDrag && !pageSize) await draw();
    },

    /** Handles a pointer event on the overlay: drags by the grip. */
    async pointer(e) {
      if (!shown || !e || typeof e !== "object") return;
      const content = contentOf(await currentLayout());
      const card = cardOf(size);
      if (e.type === "dragstart" && isGrip(e.item)) {
        drag.start(e.x, e.y, (await spots()).card);
        return;
      }
      if (e.type === "drag") {
        const at = drag.move(e.x, e.y, content, card.w, card.h);
        if (at) {
          position = at;
          await draw();
        }
        return;
      }
      if (e.type === "drop") {
        const at = drag.end(e.x, e.y, content, card.w, card.h);
        if (!at) return;
        position = at;
        await draw();
        await tf.store.set(POSITION_KEY, position);
        void audit("card-moved", { via: "grip" });
      }
    },

    /** The page's top bar was dragged by `dx`,`dy` since the press. */
    async pageMove(m) {
      if (!shown || !m || !PHASES.includes(m.phase)) return;
      if (m.phase === "start") {
        pageDrag = (await spots()).card;
        return;
      }
      if (!pageDrag) return;
      const card = cardOf(size);
      const content = contentOf(await currentLayout());
      position = positionFor(
        content,
        card.w,
        card.h,
        pageDrag.x + amount(m.dx),
        pageDrag.y + amount(m.dy),
      );
      await draw();
      if (m.phase === "end") {
        pageDrag = null;
        await tf.store.set(POSITION_KEY, position);
        void audit("card-moved", { via: "card" });
      }
    },

    /** The page's corner was dragged by `dw`,`dh` since the press. */
    async pageResize(m) {
      if (!shown || !m || !PHASES.includes(m.phase)) return;
      if (m.phase === "start") {
        pageSize = { size, at: (await spots()).card };
        return;
      }
      if (!pageSize) return;
      size = readSize(
        { w: pageSize.size.w + amount(m.dw), h: pageSize.size.h + amount(m.dh) },
        await currentLayout(),
      );
      pin(pageSize.at);
      await draw();
      if (m.phase === "end") {
        pageSize = null;
        await tf.store.set(SIZE_KEY, size);
        await tf.store.set(POSITION_KEY, position);
        void audit("card-resized", { w: size.w, h: size.h });
      }
    },

    /** Puts the card back in the pane's corner; false if it was there already. */
    async reset(via) {
      drag.cancel();
      pageDrag = null;
      if (!position) return false;
      position = null;
      await tf.store.delete(POSITION_KEY);
      void audit("card-reset", { via });
      await draw();
      return true;
    },

    get visible() {
      return shown;
    },
  };
}
