/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Spotify Web API (tests only)
 *
 * A function shaped like `tf.net.fetch` that answers the way Spotify's
 * accounts and player endpoints do, so the built tile can be tested end to
 * end with the real client inside it: the refresh-token grant (optionally
 * rotating the token), GET /me/player (204 when nothing plays), play,
 * pause, next, previous and volume, Premium refusals and rate limits.
 * Answers are plain objects without `ok`, as a host's might be, so the
 * tile's own clean-up of responses is exercised too.
 */

/** The player's starting track, in Spotify's own JSON shape. */
export const ITEM = Object.freeze({
  name: "Clair de Lune",
  artists: [{ name: "Claude Debussy" }],
  album: { name: "Suite bergamasque" },
  duration_ms: 300000,
});

/**
 * A plain response object.
 *
 * @param {number} status
 * @param {unknown} [body]
 * @param {Record<string, string>} [headers]
 */
function reply(status, body, headers = {}) {
  return {
    status,
    headers: { get: (name) => headers[name] ?? headers[String(name).toLowerCase()] ?? null },
    json: async () => {
      if (body === undefined) throw new SyntaxError("no body");
      return body;
    },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

/**
 * Creates the fake API.
 *
 * @param {{ refreshTokens?: string[], rotate?: boolean, premium?: boolean,
 *           playing?: boolean, item?: object|null, volume?: number }} [opts]
 *   `refreshTokens` are accepted by the token endpoint (default
 *   ["pasted-token"]); `rotate` hands out a new refresh token each time;
 *   `premium: false` refuses every player command.
 */
export function createFakeApi(opts = {}) {
  const api = {
    /** @type {{ method: string, url: string, body?: string }[]} */
    log: [],
    valid: new Set(opts.refreshTokens ?? ["pasted-token"]),
    issued: 0,
    rotations: 0,
    premium: opts.premium !== false,
    /** Set to answer the next player request with 429 and this Retry-After. */
    rateLimitOnce: /** @type {string|null} */ (null),
    player: {
      item: opts.item === undefined ? { ...ITEM } : opts.item,
      playing: opts.playing ?? true,
      progress: 60000,
      volume: opts.volume ?? 50,
    },
    /** The current access token (anything else gets a 401). */
    access: "",

    /** The `tf.net.fetch` stand-in. */
    fetch: async (url, init = {}) => {
      const method = init.method ?? "GET";
      api.log.push({ method, url, body: init.body });
      const u = new URL(url);
      if (u.host === "accounts.spotify.com") return api.token(init);
      if (u.host !== "api.spotify.com")
        return reply(404, { error: { status: 404, message: "Not found" } });
      const auth = init.headers && init.headers.Authorization;
      if (auth !== `Bearer ${api.access}`)
        return reply(401, { error: { status: 401, message: "Expired token" } });
      if (api.rateLimitOnce !== null) {
        const after = api.rateLimitOnce;
        api.rateLimitOnce = null;
        return reply(429, undefined, { "Retry-After": after });
      }
      return api.player_(method, u);
    },

    /** The refresh-token grant. */
    token(init) {
      const form = new URLSearchParams(String(init.body ?? ""));
      if (form.get("grant_type") !== "refresh_token" || !form.get("client_id")) {
        return reply(400, { error: "invalid_request" });
      }
      if (!api.valid.has(form.get("refresh_token") ?? "")) {
        return reply(400, { error: "invalid_grant", error_description: "Invalid refresh token" });
      }
      api.issued += 1;
      api.access = `access-${api.issued}`;
      const body = { access_token: api.access, token_type: "Bearer", expires_in: 3600 };
      if (opts.rotate) {
        api.rotations += 1;
        const next = `rotated-${api.rotations}`;
        api.valid = new Set([next]);
        Object.assign(body, { refresh_token: next });
      }
      return reply(200, body);
    },

    /** The player endpoints. */
    player_(method, u) {
      const p = api.player;
      const path = u.pathname.replace("/v1/me/player", "");
      if (method === "GET" && path === "") {
        if (!p.item) return reply(204);
        return reply(200, {
          is_playing: p.playing,
          item: p.item,
          progress_ms: p.progress,
          device: { name: "MacBook", volume_percent: p.volume },
          shuffle_state: false,
          repeat_state: "off",
        });
      }
      if (!api.premium) {
        return reply(403, {
          error: { status: 403, message: "Premium required", reason: "PREMIUM_REQUIRED" },
        });
      }
      if (!p.item && path !== "/play") {
        return reply(404, {
          error: { status: 404, message: "No active device", reason: "NO_ACTIVE_DEVICE" },
        });
      }
      if (method === "PUT" && path === "/play") p.playing = true;
      else if (method === "PUT" && path === "/pause") p.playing = false;
      else if (method === "POST" && path === "/next") {
        p.item = { ...ITEM, name: "Rêverie", duration_ms: 280000 };
        p.progress = 0;
      } else if (method === "POST" && path === "/previous") p.progress = 0;
      else if (method === "PUT" && path === "/volume")
        p.volume = Number(u.searchParams.get("volume_percent"));
      else return reply(404, { error: { status: 404, message: "Not found" } });
      return reply(204);
    },
  };
  return api;
}
