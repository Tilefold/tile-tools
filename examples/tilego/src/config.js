/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — which relay it plays through
 *
 * The page connects to this room relay. A tile may only reach hosts its
 * tile.json asks for, so to play through your own relay change both: the
 * address here and the `net:` permission in tile.json. Any server that
 * speaks the room protocol (see page-src/relay.js) will do; it needs no
 * account unless you build it to.
 */

/** The relay's WebSocket address: `wss://`, on the default port. */
export const RELAY_URL = "wss://play.tilefold.com/rooms";
