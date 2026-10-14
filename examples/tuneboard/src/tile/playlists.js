/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the two ways to pick a playlist
 *
 * Builds the Library window (library.js) and the card's playlist panel
 * (panel.js) around one picker (pick.js), so both play a pick the same
 * way, and gives the panel its cover cache on Tilefold's network. Both
 * register their listeners when created, so call this at the top of the
 * tile's function, before any `await`.
 */
import { createCovers } from "../spotify/covers.js";
import { createLibrary } from "./library.js";
import { createPanel } from "./panel.js";
import { createPicker } from "./pick.js";
import { findTransport } from "./transport.js";

/**
 * Creates the Library window and the panel.
 *
 * @param {any} tf The tile API.
 * @param {{ trail: any, store: any, player: any,
 *           client: () => Promise<any>,
 *           afterPlay: () => void,
 *           onChange: () => void }} deps
 *   `client` resolves to the connected Spotify client (null: signed out);
 *   `afterPlay` lets the card catch up after a pick; `onChange` redraws it.
 * @returns {{ library: ReturnType<typeof createLibrary>, panel: ReturnType<typeof createPanel> }}
 */
export function createPlaylistViews(tf, { trail, store, player, client, afterPlay, onChange }) {
  const picker = createPicker({ trail, player, client });
  const library = createLibrary(tf, { trail, store, picker, client, afterPlay });
  const panel = createPanel(tf, {
    trail,
    client,
    picker,
    library,
    afterPlay,
    covers: createCovers({ fetchFn: findTransport(tf) }),
    onChange,
  });
  return { library, panel };
}
