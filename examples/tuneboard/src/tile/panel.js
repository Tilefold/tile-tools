/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the playlist panel attached to the card
 *
 * The Playlists button on the card opens or closes a panel of the user's
 * playlists, five at a time, drawn next to the card. ▲ and ▼ turn the
 * pages (the next 50 are asked for when the user reaches the end of what is
 * loaded), a click on a row plays that playlist (pick.js decides where), and
 * "Show all" opens the Library window when this Tilefold has tile pages.
 * Covers are downloaded small and only for the rows on screen; the panel
 * is redrawn as each arrives. Opening the panel again starts from the top
 * with a fresh list.
 *
 * It draws on the overlay and needs no tile page of its own; where pages
 * are missing, "Show all" and playing inside Tilefold aren't offered.
 * Each step is recorded without names or URIs.
 */
import { ROWS } from "../render/panel.js";
import { codeOf, messageFor } from "./pick.js";

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
    /** Index of the first row on screen. */
    first: 0,
    loading: false,
    /** @type {string|null} An error message key, shown instead of the rows. */
    error: null,
    /** @type {string|null} The playlist picked last, highlighted. */
    picked: null,
  };

  /** Fetches the covers of the rows on screen, redrawing as each arrives. */
  const fetchCovers = () => {
    for (const p of state.items.slice(state.first, state.first + ROWS)) {
      if (p.thumb && covers.peek(p.thumb) === undefined) {
        void covers.get(p.thumb).then((cover) => {
          if (cover && state.open) onChange();
        });
      }
    }
  };

  /** Pages of playlists asked for at most per load, to fill the rows on screen. */
  const MAX_REQUESTS = 3;

  /**
   * Loads playlists from `offset` (0 starts afresh), asking again while the
   * rows from `want` on aren't filled and Spotify has more.
   */
  const load = async (offset, want = offset) => {
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
        from = state.items.length < want + ROWS ? page.nextOffset : null;
      }
      trail.record("library.load", { ok: true, from: "panel" });
    } catch (err) {
      state.error = messageFor(err);
      trail.record("library.load", { ok: false, code: codeOf(err), from: "panel" });
    } finally {
      state.loading = false;
    }
    fetchCovers();
    onChange();
  };

  /** Moves a page up or down, loading more at the end when there is more. */
  const turn = async (step) => {
    if (state.loading) return;
    const first = state.first + step * ROWS;
    if (first < 0) return;
    // Fill the new page from Spotify when it isn't all loaded yet.
    if (first + ROWS > state.items.length && state.nextOffset !== null) {
      await load(state.nextOffset, first);
    }
    if (first >= state.items.length) return;
    state.first = first;
    fetchCovers();
    onChange();
  };

  /** Plays the playlist in a row on screen. */
  const pick = async (index) => {
    const p = state.items[state.first + index];
    if (!p || state.loading) return;
    state.picked = p.uri;
    onChange();
    try {
      await picker.play(p.uri, "panel");
      afterPlay();
    } catch (err) {
      tf.toast(tf.t(messageFor(err)));
    }
  };

  return {
    /** Whether the panel is open. */
    get open() {
      return state.open;
    },

    /** Opens or closes the panel; opening loads the list afresh. */
    async toggle() {
      state.open = !state.open;
      trail.record(state.open ? "panel.show" : "panel.hide", {});
      if (!state.open) return onChange();
      state.first = 0;
      await load(0);
    },

    /**
     * Acts on a click the picture decoded (see `panelHit`).
     *
     * @param {{ kind: string, index?: number } | null} hit
     */
    async click(hit) {
      if (!hit || !state.open) return;
      if (hit.kind === "row") return pick(hit.index ?? -1);
      if (hit.kind === "prev") return turn(-1);
      if (hit.kind === "next") return turn(1);
      if (hit.kind === "all" && library.available()) return library.show();
    },

    /**
     * What the panel shows now, in the user's language, or null when closed.
     *
     * @returns {null | { rows: object[], status: { text: string, error?: boolean } | null,
     *   range: string, canPrev: boolean, canNext: boolean, allLabel: string|null, label: string }}
     */
    view() {
      if (!state.open) return null;
      const shown = state.items.slice(state.first, state.first + ROWS);
      let status = null;
      if (state.error) status = { text: tf.t(state.error), error: true };
      else if (state.loading && shown.length === 0) status = { text: tf.t("library-loading") };
      else if (shown.length === 0) status = { text: tf.t("library-empty") };
      const range = shown.length
        ? tf.t("panel-range", {
            from: state.first + 1,
            to: state.first + shown.length,
            total: Math.max(state.total, state.items.length),
          })
        : "";
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
        status,
        range,
        canPrev: state.first > 0,
        canNext: state.first + ROWS < state.items.length || state.nextOffset !== null,
        allLabel: library.available() ? tf.t("panel-show-all") : null,
        label: [tf.t("library-title"), range].filter(Boolean).join(", "),
      };
    },
  };
}
