/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Spotify client (tests only)
 *
 * Stands in for the real Spotify client: it keeps a small player (a track,
 * playing or paused, a device with a volume) that the controls change, and
 * records every call. `failNext(code)` makes the next call throw an error
 * with that code, the way the real client reports Spotify's answers;
 * `failAll(code)` keeps failing until `failAll(null)`.
 * `createFactory()` returns a `createSpotify` replacement that remembers the
 * options it was built with and the clients it made.
 */

/** A track the fake player starts with. */
export const TRACK = Object.freeze({
  title: "Clair de Lune",
  artists: ["Claude Debussy", "Ivan Moravec"],
  album: "Suite bergamasque",
  durationMs: 300000,
});

/**
 * An error shaped like the real client's.
 *
 * @param {string} code
 * @param {object} [extra]
 */
export function spotifyError(code, extra = {}) {
  return Object.assign(new Error(`spotify ${code}`), { code }, extra);
}

/**
 * Creates a fake client.
 *
 * @param {{ playing?: boolean, track?: object|null, volume?: number|null, device?: string }} [opts]
 */
export function createFakeClient(opts = {}) {
  const state = {
    track: opts.track === undefined ? { ...TRACK } : opts.track,
    isPlaying: opts.playing ?? true,
    progressMs: 60000,
    device: opts.device ?? "MacBook",
    volume: opts.volume === undefined ? 50 : opts.volume,
  };
  /** @type {{ code: string, extra?: object }[]} */
  const queued = [];
  /** @type {{ code: string, extra?: object } | null} */
  let always = null;

  const client = {
    calls: /** @type {string[]} */ ([]),
    state,
    failNext(code, extra) {
      queued.push({ code, extra });
    },
    failAll(code, extra) {
      always = code ? { code, extra } : null;
    },
    /** Throws the queued or standing failure, if any. */
    check(name) {
      client.calls.push(name);
      const f = queued.shift() ?? always;
      if (f) throw spotifyError(f.code, f.extra);
    },
    async getPlayback() {
      client.check("getPlayback");
      if (!state.track) return null;
      return {
        isPlaying: state.isPlaying,
        track: { ...state.track, artists: [...state.track.artists] },
        progressMs: state.progressMs,
        device: { name: state.device, volume: state.volume },
        shuffle: false,
        repeat: "off",
      };
    },
    async play() {
      client.check("play");
      state.isPlaying = true;
    },
    async pause() {
      client.check("pause");
      state.isPlaying = false;
    },
    async next() {
      client.check("next");
      state.track = { ...TRACK, title: "Next Song", artists: ["Someone"] };
      state.progressMs = 0;
    },
    async previous() {
      client.check("previous");
      state.progressMs = 0;
    },
    async setVolume(v) {
      client.check(`setVolume:${v}`);
      state.volume = v;
    },
  };
  return client;
}

/**
 * A `createSpotify` replacement for the tile.
 *
 * @param {Parameters<typeof createFakeClient>[0]} [opts]
 */
export function createFactory(opts) {
  const factory = {
    /** @type {any[]} */
    builds: [],
    /** @type {ReturnType<typeof createFakeClient>[]} */
    clients: [],
    /** The most recent client. */
    get client() {
      return factory.clients[factory.clients.length - 1];
    },
    createSpotify(options) {
      factory.builds.push(options);
      const c = createFakeClient(opts);
      factory.clients.push(c);
      return c;
    },
  };
  return factory;
}
