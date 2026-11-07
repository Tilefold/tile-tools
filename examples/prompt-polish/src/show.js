/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — putting the page and the button where they belong
 *
 * Owns the page's place and the corner button: opens, moves and closes
 * the page (`tf.page.open` with a dock spot or beside the panes,
 * `tf.page.dock`, `tf.page.close`) and draws or hides the button
 * (`tf.overlay`). It keeps the last pane layout Tilefold reported and
 * which pane is focused (staying with the last one when focus moves away
 * from the panes, to the dock or a window).
 *
 * The run module decides what should show; `show()` makes it so:
 *
 *   view "bottom"  the card over the focused pane when its session is open
 *   view "corner"  the Polish pill on the focused pane, the card above it when open
 *   view "side"    the page beside the panes
 *   view "window"  a window of its own (a Tilefold that can't dock pages)
 *
 * A pane too small for the card sends the page beside the panes (or a
 * window), with a notice once.
 *
 * Modified 2026-11-06 (input actions): no pill over a pane whose row is
 *   Tilefold's agent input box (it has its own ✦ Polish button there);
 *   `focusOn` moves to the pane a click in that box came from.
 * Modified 2026-11-07 (card stays in its pane): the pane kept while focus
 *   is away from the panes counts only while it is on screen, so a card
 *   never follows you into another tab.
 * Modified 2026-11-07 (see-through card): the card opens see-through, so
 *   the page's own background decides how much of the pane shows.
 */
import { buttonImage, pillWidth } from "./button.js";
import { focusedId } from "./sessions.js";
import { placeFor, sameSpot } from "./place.js";

/** The overlay item id of the corner button. */
export const BUTTON_ID = "polish-button";

/**
 * @param {any} tf
 * @param {{ warn: (err: unknown) => void, canSide: () => boolean }} o
 */
export function createStage(tf, o) {
  /** Where the page is: "card", "side", "window", or null when closed. */
  let where = null;
  let spot = null;
  let buttonShown = false;
  /** Whether the overlay is shown at all (the pill, or empty). */
  let sceneShown = false;
  let layout = null;
  /** The focused pane's id, kept while focus is away from the panes. */
  let focus = null;
  /** How tall the page asked to be, and Tilefold's accent for the button. */
  let wantH = 260;
  let accent = null;
  /** Whether the "too small" notice was shown for this time it didn't fit. */
  let toldSmall = false;

  const rtl = () => tf.t("page-dir") === "rtl";

  const closePage = async () => {
    if (!where) return;
    where = null;
    spot = null;
    await tf.page.close().catch(o.warn);
  };

  /**
   * Takes the pill away, keeping an empty overlay: only a tile showing one
   * hears where the panes are and which one has the focus, and the card
   * must hear when you go to another tab even where it draws no pill.
   */
  const hideButton = async () => {
    if (!buttonShown) return;
    buttonShown = false;
    // Showing replaces the scene (an update only changes the items it names).
    await tf.overlay.show({ items: [] }).catch(o.warn);
  };

  /** Takes the overlay away altogether (Prompt Polish closed). */
  const dropOverlay = async () => {
    if (!sceneShown) return;
    buttonShown = false;
    sceneShown = false;
    await tf.overlay.hide().catch(o.warn);
  };

  /** Keeps an empty overlay while Prompt Polish shows, to hear the layout. */
  const keepOverlay = async () => {
    if (sceneShown || !tf.overlay) return;
    sceneShown = true;
    await tf.overlay.show({ items: [] }).catch(o.warn);
  };

  /** The pill's word in the user's language, and its width. */
  const pill = () => {
    const label = tf.t("pill-label");
    return { label, w: pillWidth(label) };
  };

  const drawButton = async (rect, waiting, open) => {
    const item = {
      id: BUTTON_ID,
      image: buttonImage({ ...pill(), accent, waiting, open, rtl: rtl() }),
      ...rect,
      hit: true,
      cursor: "pointer",
      label: tf.t("button-label"),
    };
    if (sceneShown) await tf.overlay.update({ items: [item] });
    else await tf.overlay.show({ items: [item] });
    buttonShown = true;
    sceneShown = true;
  };

  const toCard = async (card) => {
    if (where === "card") {
      if (!sameSpot(card, spot)) await tf.page.dock(card);
    } else {
      // See-through where Tilefold allows it: the page's background decides how much.
      await tf.page.open({ dock: card, seeThrough: true });
    }
    where = "card";
    spot = card;
  };

  const toSide = async () => {
    await hideButton();
    if (where !== "side") await tf.page.open({ side: true });
    where = "side";
    spot = null;
  };

  const toWindow = async () => {
    await hideButton();
    if (!where) await tf.page.open();
    where = "window";
    spot = null;
  };

  /** Reads the layout the first time (when the tile can float its page). */
  const ensureLayout = async () => {
    if (layout || !tf.overlay) return;
    const l = await tf.overlay.layout().catch(() => null);
    if (l) setLayout(l);
  };

  /** Takes a layout Tilefold reported. */
  function setLayout(l) {
    layout = l;
    // Focus away from the panes keeps the pane you were in, but only while
    // it is on screen: in another tab, the card isn't drawn there.
    const here = Array.isArray(l?.panes) && l.panes.some((p) => p?.id === focus);
    focus = focusedId(l) ?? (here ? focus : null);
  }

  return {
    setLayout,
    ensureLayout,
    focus: () => focus,
    layout: () => layout,
    /** The pane a click in its agent input box came from. */
    focusOn: (id) => void (focus = id ?? focus),
    where: () => where,
    buttonShown: () => buttonShown,
    setAccent: (a) => void (accent = a ?? accent),
    setHeight(h) {
      if (!Number.isFinite(h) || Math.abs(h - wantH) < 2) return false;
      wantH = h;
      return where === "card";
    },
    /** The overlay was hidden by the user: the button is gone. */
    lostOverlay: () => void ((buttonShown = false), (sceneShown = false)),
    /** The page was closed from elsewhere. */
    lostPage() {
      where = null;
      spot = null;
    },

    /**
     * Shows what should be: `view`, whether the focused pane's card is open,
     * whether anything shows at all (`active`), and the button's badge.
     * Returns where the page ended up.
     */
    async show({ view, open, active, waiting = 0 }) {
      if (!active) {
        await closePage();
        await dropOverlay();
        return where;
      }
      await keepOverlay();
      if (view === "side") {
        await toSide();
        return where;
      }
      if (view === "window") {
        await toWindow();
        return where;
      }
      await ensureLayout();
      if (view === "bottom" && !open) {
        await hideButton();
        await closePage();
        return where;
      }
      const spots = placeFor(layout, view, {
        h: wantH,
        open,
        rtl: rtl(),
        pane: focus,
        bw: pill().w,
        noPill: !!(layout?.panes ?? []).find((p) => p.id === focus)?.agentInput,
      });
      if (!spots) {
        // No pane to show over (another tab), or the pane is too small.
        const hasPane = (layout?.panes ?? []).some((p) => p.id === focus);
        await hideButton();
        if (!hasPane) {
          await closePage();
          return where;
        }
        if (!toldSmall) {
          toldSmall = true;
          await tf.toast(tf.t("toast-too-small"));
        }
        if (o.canSide()) await toSide();
        else await toWindow();
        return where;
      }
      toldSmall = false;
      if (spots.button) await drawButton(spots.button, waiting, open);
      else await hideButton();
      if (spots.card) await toCard(spots.card);
      else await closePage();
      return where;
    },
  };
}
