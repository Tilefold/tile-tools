/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the floating card
 *
 * Keeps the borderless card where it belongs: the quiz page docked in
 * Tilefold's window, with the grip above it drawn as overlay items. It
 * follows the focused pane's corner as panes open, close and move
 * (`overlay.layout`), or stays where the user dropped it after dragging
 * the grip (`overlay.pointer`). While a drag is under way the page moves
 * with the grip on every step, and the spot is saved only on the drop.
 *
 * The run module opens and closes the page; this module only says where
 * it goes (`pageSpot`) and moves it (`tf.page.dock`). Moves and resets are
 * recorded in the tile's activity log (`card-moved`, `card-reset`: a tile's
 * action is one word, which Tilefold records as tile.<id>.<action>).
 */
import { gripImages } from "./grip.js";
import { contentOf, createDrag, readPosition } from "./position.js";
import { CARD, cardSpots } from "./scene.js";

/** The store key of the dropped position. */
export const POSITION_KEY = "position";
/** The grip's two overlay items, either of which drags the card. */
export const GRIP_ITEMS = ["grip-l", "grip-r"];

/**
 * @param {any} tf
 * @param {{
 *   corner: () => string,
 *   title: () => string,
 *   rtl: () => boolean,
 *   theme: () => "light" | "dark",
 *   label: () => string,
 *   warn: (err: unknown) => void,
 * }} o
 */
export function createCard(tf, o) {
  /** The last layout Tilefold reported, or null before the first. */
  let layout = null;
  /** The dropped position, or null to follow the pane's corner. */
  let position = null;
  /** Whether the grip is drawn (the card is showing). */
  let shown = false;
  /** The page's last spot, so it moves only when the spot changes. */
  let lastPage = "";
  const drag = createDrag();

  const audit = (action, details) =>
    Promise.resolve()
      .then(() => tf.audit(action, details))
      .catch(o.warn);

  /** The layout, asking Tilefold for it the first time. */
  const currentLayout = async () => {
    if (!layout) layout = await tf.overlay.layout();
    return layout;
  };

  const spots = async () => cardSpots(await currentLayout(), o.corner(), position);

  /** The grip's overlay items at the card's spot. */
  const items = (s) => {
    const images = gripImages(o.title(), o.rtl(), o.theme());
    const grip = (id, r, image) => ({
      id,
      image,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      hit: true,
      cursor: "grab",
      label: o.label(),
    });
    return [grip("grip-l", s.gripL, images.left), grip("grip-r", s.gripR, images.right)];
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

  /** Draws the grip and moves the page to the card's current spot. */
  const draw = async () => {
    if (!shown) return;
    const s = await spots();
    await tf.overlay.update({ items: items(s) });
    dockPage(s.page);
  };

  return {
    /** Reads the dropped position kept from an earlier session. */
    async load() {
      position = readPosition(await tf.store.get(POSITION_KEY));
    },

    /** Where the page goes now (to open it docked there). */
    async pageSpot() {
      return (await spots()).page;
    },

    /** Draws the grip; the page was just opened at `pageSpot()`. */
    async show() {
      const s = await spots();
      await tf.overlay.show({ items: items(s) });
      shown = true;
      lastPage = JSON.stringify(s.page);
    },

    /** Takes the grip away (the page is closing or closed). */
    async hide() {
      drag.cancel();
      if (!shown) return;
      shown = false;
      lastPage = "";
      await tf.overlay.hide();
    },

    /** Redraws in the user's language, corner or appearance, after a change. */
    redraw: draw,

    /** Follows a new window layout. */
    async moved(next) {
      if (next && typeof next === "object") layout = next;
      if (!drag.active()) await draw();
    },

    /** Handles a pointer event on the overlay: drags by the grip. */
    async pointer(e) {
      if (!shown || !e || typeof e !== "object") return;
      const content = contentOf(await currentLayout());
      if (e.type === "dragstart" && GRIP_ITEMS.includes(e.item)) {
        drag.start(e.x, e.y, (await spots()).card);
        return;
      }
      if (e.type === "drag") {
        const at = drag.move(e.x, e.y, content, CARD.w, CARD.h);
        if (at) {
          position = at;
          await draw();
        }
        return;
      }
      if (e.type === "drop") {
        const at = drag.end(e.x, e.y, content, CARD.w, CARD.h);
        if (!at) return;
        position = at;
        await draw();
        await tf.store.set(POSITION_KEY, position);
        void audit("card-moved", { via: "drag" });
      }
    },

    /** Puts the card back in the pane's corner; false if it was there already. */
    async reset(via) {
      drag.cancel();
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
