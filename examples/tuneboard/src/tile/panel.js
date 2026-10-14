/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the playlist panel attached to the card
 *
 * The Playlists button on the card opens or closes a panel of the user's
 * playlists, drawn next to the card with room for five rows. Dragging the
 * rows scrolls them smoothly, and letting go settles on a whole row; ▲ and
 * ▼ scroll a page at a time. The next playlists are asked for in the
 * background as the user nears the end of what is loaded. A click on a row
 * plays that playlist (pick.js decides where), and "Show all" opens the
 * Library window when this Tilefold has tile pages. Covers are downloaded
 * small, only for the rows in view; the panel is redrawn as each arrives.
 * Opening the panel again starts from the top with a fresh list.
 *
 * It draws on the overlay and needs no tile page of its own; where pages
 * are missing, "Show all" and playing inside Tilefold aren't offered.
 * Each step is recorded without names or URIs (scrolling isn't recorded).
 */
import { ROWS, ROW_H, panelHit, panelPoint } from "../render/panel.js";
import { codeOf, messageFor } from "./pick.js";

/** Pages of playlists asked for at most per load, to fill the rows in view. */
const MAX_REQUESTS = 3;

/** How many rows ahead of the end of the view to start loading more. */
const LOAD_AHEAD = ROWS;

/**
 * Creates the panel.
 *
 * @param {any} tf The tile API.
 * @param {{ trail: { record: Function, error: Function },
 *           client: () => Promise<any>,
 *           picker: { play: (uri: string, from: string) => Promise<void> },
 *           covers: { get: (url: string|null) => Promise<string|null>,
 *                     peek: (url: string|null) => string|null|undefined },
 *           library: { available: () => boolean, show: () => Promise<void> },
 *           onChange: () => void,
 *           afterPlay?: () => void }} deps
 *   `onChange` asks the card to redraw; `afterPlay` lets it catch up after a pick.
 */
export function createPanel(tf, deps) {
  const { trail, client, picker, covers, library, onChange } = deps;
  const afterPlay = deps.afterPlay ?? (() => {});

  const state = {
    open: false,
    /** @type {any[]} */
    items: [],
    total: 0,
    /** @type {number|null} */
    nextOffset: null,
    /** How far the rows are scrolled, in the panel's own pixels. */
    scroll: 0,
    loading: false,
    /** @type {string|null} An error message key, shown instead of the rows. */
    error: null,
    /** @type {string|null} The playlist picked last, highlighted. */
    picked: null,
    /** @type {{ y: number, scroll: number } | null} Where a drag started. */
    drag: null,
  };

  /** The furthest the loaded rows can scroll. */
  const maxScroll = () => Math.max(0, (state.items.length - ROWS) * ROW_H);
  /** The index of the row at the top of the view. */
  const top = () => Math.floor(state.scroll / ROW_H);
  /** A scroll position settled on a whole row. */
  const snapped = (scroll) => Math.round(scroll / ROW_H) * ROW_H;

  /** Fetches the covers of the rows in view, redrawing as each arrives. */
  const fetchCovers = () => {
    for (const p of state.items.slice(top(), top() + ROWS + 1)) {
      if (p.thumb && covers.peek(p.thumb) === undefined) {
        void covers.get(p.thumb).then((cover) => {
          if (cover && state.open) onChange();
        });
      }
    }
  };

  /**
   * Loads playlists from `offset` (0 starts afresh), asking again while
   * fewer than `want` are loaded and Spotify has more.
   */
  const load = async (offset, want = offset + ROWS) => {
    state.loading = true;
    state.error = null;
    onChange();
    try {
      const spotify = await client();
      if (!spotify) throw Object.assign(new Error("not signed in"), { code: "auth" });
      let from = offset;
      for (let i = 0; i < MAX_REQUESTS && from !== null; i++) {
        const page = await spotify.playlists(from);
        const known = new Set(from === 0 ? [] : state.items.map((p) => p.uri));
        const fresh = page.items.filter((p) => !known.has(p.uri));
        state.items = from === 0 ? fresh : [...state.items, ...fresh];
        state.total = page.total;
        state.nextOffset = page.nextOffset;
        from = state.items.length < want ? page.nextOffset : null;
      }
      trail.record("library.load", { ok: true, from: "panel" });
    } catch (err) {
      // With rows already shown, a failed "more" keeps them and stops there.
      if (state.items.length === 0 || offset === 0) state.error = messageFor(err);
      else state.nextOffset = null;
      trail.record("library.load", { ok: false, code: codeOf(err), from: "panel" });
    } finally {
      state.loading = false;
    }
    fetchCovers();
    onChange();
  };

  /** Loads more in the background when the view nears the end of what is loaded. */
  const loadAhead = () => {
    if (state.loading || state.nextOffset === null) return;
    if (top() + ROWS + LOAD_AHEAD < state.items.length) return;
    void load(state.nextOffset, top() + ROWS + LOAD_AHEAD).catch((err) => trail.error(err));
  };

  /** Scrolls to a position (kept within the loaded rows) and redraws. */
  const scrollTo = (scroll) => {
    const next = Math.min(Math.max(0, scroll), maxScroll());
    if (next === state.scroll) return;
    state.scroll = next;
    fetchCovers();
    loadAhead();
    onChange();
  };

  /** Scrolls a page up or down, loading the next page first when needed. */
  const turn = async (step) => {
    if (state.loading) return;
    const target = snapped(state.scroll) + step * ROWS * ROW_H;
    const needed = Math.floor(target / ROW_H) + ROWS;
    if (step > 0 && needed > state.items.length && state.nextOffset !== null) {
      await load(state.nextOffset, needed);
    }
    scrollTo(target);
  };

  /** Plays the playlist at a point in the rows' room. */
  const pick = async (y) => {
    const p = state.items[Math.floor((y + state.scroll) / ROW_H)];
    if (!p || state.error) return;
    state.picked = p.uri;
    onChange();
    try {
      await picker.play(p.uri, "panel");
      afterPlay();
    } catch (err) {
      tf.toast(tf.t(messageFor(err)));
    }
  };

  /** Acts on a click on the panel. */
  const click = async (hit) => {
    if (!hit) return;
    if (hit.kind === "row") return pick(hit.y);
    if (hit.kind === "prev") return turn(-1);
    if (hit.kind === "next") return turn(1);
    if (hit.kind === "all" && library.available()) return library.show();
  };

  return {
    /** Whether the panel is open. */
    get open() {
      return state.open;
    },

    /** Opens or closes the panel; opening loads the list afresh, from the top. */
    async toggle() {
      state.open = !state.open;
      state.drag = null;
      trail.record(state.open ? "panel.show" : "panel.hide", {});
      if (!state.open) return onChange();
      state.scroll = 0;
      await load(0);
    },

    /**
     * Handles a pointer event on the panel: clicks, and drags that scroll.
     *
     * @param {{ type: string, x: number, y: number }} e Tilefold's event.
     * @param {{ x: number, y: number, w: number, h: number }} rect Where the panel is.
     */
    async pointer(e, rect) {
      if (!state.open || !e) return;
      if (e.type === "click") return click(panelHit(rect, Number(e.x), Number(e.y)));
      const p = panelPoint(rect, Number(e.x), Number(e.y));
      if (!p) return;
      if (e.type === "dragstart") {
        // Only a drag that starts on the rows scrolls them.
        const hit = panelHit(rect, Number(e.x), Number(e.y));
        state.drag = hit && hit.kind === "row" ? { y: p.y, scroll: state.scroll } : null;
      } else if (e.type === "drag" && state.drag) {
        scrollTo(state.drag.scroll - (p.y - state.drag.y));
      } else if (e.type === "drop" && state.drag) {
        scrollTo(state.drag.scroll - (p.y - state.drag.y));
        state.drag = null;
        scrollTo(snapped(state.scroll));
      }
    },

    /**
     * What the panel shows now, in the user's language, or null when closed.
     *
     * @returns {null | { rows: object[], shift: number, bar: { top: number, size: number } | null,
     *   status: { text: string, error?: boolean } | null, range: string,
     *   canPrev: boolean, canNext: boolean, allLabel: string|null, label: string }}
     */
    view() {
      if (!state.open) return null;
      const first = top();
      const shown = state.items.slice(first, first + ROWS + 1);
      let status = null;
      if (state.error) status = { text: tf.t(state.error), error: true };
      else if (state.loading && shown.length === 0) status = { text: tf.t("library-loading") };
      else if (shown.length === 0) status = { text: tf.t("library-empty") };
      const count = Math.max(state.total, state.items.length);
      const last = Math.min(first + ROWS, state.items.length);
      const range = shown.length
        ? tf.t("panel-range", { from: first + 1, to: last, total: count })
        : "";
      const room = (count - ROWS) * ROW_H;
      return {
        rows: shown.map((p) => ({
          name: p.name,
          meta: [
            p.owner ? tf.t("library-by", { owner: p.owner }) : "",
            p.tracks === null ? "" : `♪ ${p.tracks}`,
          ]
            .filter(Boolean)
            .join(" · "),
          cover: covers.peek(p.thumb) ?? null,
          picked: p.uri === state.picked,
        })),
        shift: state.scroll - first * ROW_H,
        bar: count > ROWS ? { top: Math.min(1, state.scroll / room), size: ROWS / count } : null,
        status,
        range,
        canPrev: state.scroll > 0,
        canNext: state.scroll < maxScroll() || state.nextOffset !== null,
        allLabel: library.available() ? tf.t("panel-show-all") : null,
        label: [tf.t("library-title"), range].filter(Boolean).join(", "),
      };
    },
  };
}
