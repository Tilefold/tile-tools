/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — network access
 *
 * Finds the function the Spotify client uses to make HTTP requests. A tile
 * runs in a sandboxed worker with the browser's `fetch`, `XMLHttpRequest`
 * and `WebSocket` removed, and this version of Tilefold grants no network
 * permission, so the only place a request may go through is a host call:
 * `tf.net.fetch`, which a later Tilefold is expected to offer behind a
 * `net:` permission. Until then this returns null and the tile shows its
 * "can't reach Spotify yet" card.
 *
 * Deliberately never falls back to a global `fetch`: if one ever leaked
 * into the worker, using it would bypass the user's permission choice.
 *
 * The host's answer may be a plain object rather than a browser Response,
 * so `withOk` fills in `ok` from the status when it is missing.
 */

/**
 * The response with `ok` set (true for a 2xx status) when the host left it out.
 *
 * @param {any} response
 * @returns {any}
 */
export function withOk(response) {
  if (!response || typeof response !== "object" || typeof response.ok === "boolean")
    return response;
  const status = Number(response.status);
  return Object.assign(Object.create(Object.getPrototypeOf(response)), response, {
    ok: status >= 200 && status < 300,
  });
}

/**
 * The network function, or null when Tilefold offers none.
 *
 * @param {any} tf The tile API.
 * @returns {((url: string, init?: object) => Promise<any>) | null}
 */
export function findTransport(tf) {
  try {
    const net = tf && tf.net;
    if (net && typeof net.fetch === "function")
      return async (url, init) => withOk(await net.fetch(url, init));
  } catch {
    // A host that throws on property access has no usable network either.
  }
  return null;
}
