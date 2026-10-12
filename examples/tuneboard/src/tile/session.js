/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — session state machine
 *
 * Holds what the card shows and decides what happens next. It talks to a
 * Spotify client (any object with getPlayback, play, pause, next,
 * previous and setVolume, whose failures carry a `code`) and knows nothing
 * about Tilefold, so it is tested on its own.
 *
 * States:
 *
 *   no-network  Tilefold offers tiles no network (no client at all)
 *   signed-out  no client id or refresh token, or Spotify refused them
 *   connecting  signed in, waiting for the first answer
 *   no-device   Spotify answered but nothing is playing anywhere
 *   playing     a track is playing
 *   paused      a track is paused
 *   premium     a control was refused because the account isn't Premium
 *   error       Spotify or the network failed; retried with back-off
 *
 * `nextDelay()` tells the poller how long to wait: the normal interval
 * after an answer, Spotify's Retry-After when rate-limited, a doubling
 * back-off after errors, and null (stop) when only the user can fix it
 * (signed out, Premium needed).
 */

/** All states. */
export const STATES = Object.freeze([
  "no-network",
  "signed-out",
  "connecting",
  "no-device",
  "playing",
  "paused",
  "premium",
  "error",
]);

/** States in which the controls do something. */
export const CONTROL_STATES = Object.freeze(["playing", "paused", "no-device", "premium", "error"]);

/** How often to ask Spotify what is playing, in ms. */
export const POLL_MS = 5000;

/** The longest back-off after repeated errors, in ms. */
export const MAX_BACKOFF_MS = 60000;

/** How much one volume step changes the volume, in percent. */
export const VOLUME_STEP = 10;

/**
 * A whole number within [min, max], or `fallback` when it is not a number.
 *
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number|null} fallback
 * @returns {number|null}
 */
export function clampInt(value, min, max, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Cleans a playback model from the client into exactly the fields the card
 * needs, so a missing or odd field never breaks drawing. Null in, null out.
 *
 * @param {any} p
 * @returns {{ isPlaying: boolean, title: string, artists: string[], durationMs: number,
 *             progressMs: number, device: string, volume: number|null } | null}
 */
export function cleanPlayback(p) {
  if (!p || typeof p !== "object") return null;
  const track = p.track && typeof p.track === "object" ? p.track : null;
  if (!track) return null;
  const artists = Array.isArray(track.artists) ? track.artists.map(String).filter(Boolean) : [];
  const durationMs = clampInt(track.durationMs, 0, 24 * 3600 * 1000, 0) ?? 0;
  return {
    isPlaying: p.isPlaying === true,
    title: typeof track.title === "string" ? track.title : "",
    artists,
    durationMs,
    progressMs: clampInt(p.progressMs, 0, durationMs || 24 * 3600 * 1000, 0) ?? 0,
    device: p.device && typeof p.device.name === "string" ? p.device.name : "",
    volume: p.device ? clampInt(p.device.volume, 0, 100, null) : null,
  };
}

/**
 * Creates a session.
 *
 * @param {{ now?: () => number, onChange?: () => void,
 *           onState?: (from: string, to: string) => void }} [o]
 *   `onChange` hears about anything that changes the picture; `onState`
 *   about each change of state.
 */
export function createSession(o = {}) {
  const now = o.now ?? (() => Date.now());
  /** @type {any} */
  let client = null;
  let status = "no-network";
  /** @type {ReturnType<typeof cleanPlayback>} */
  let playback = null;
  let fetchedAt = 0;
  let failures = 0;
  /** @type {number|null} */
  let retryAfter = null;
  /** The code of the last failure, for the card and the trail. */
  let lastCode = "";

  /** Moves to a state, telling listeners. */
  const go = (next) => {
    if (next === status) return;
    const from = status;
    status = next;
    if (o.onState) o.onState(from, next);
  };
  const changed = () => {
    if (o.onChange) o.onChange();
  };

  /** Applies an answer from Spotify. */
  const applyPlayback = (raw) => {
    failures = 0;
    retryAfter = null;
    lastCode = "";
    playback = cleanPlayback(raw);
    fetchedAt = now();
    if (!playback) go("no-device");
    else go(playback.isPlaying ? "playing" : "paused");
  };

  /** Applies a failure; returns its code. */
  const applyError = (err) => {
    const code = (err && typeof err.code === "string" && err.code) || "unknown";
    lastCode = code;
    if (code === "auth") {
      playback = null;
      go("signed-out");
    } else if (code === "premium") {
      go("premium");
    } else if (code === "no-device") {
      playback = null;
      go("no-device");
    } else if (code === "rate-limit") {
      const after = Number(err && err.retryAfterMs);
      retryAfter = Number.isFinite(after) && after > 0 ? after : POLL_MS * 2;
    } else {
      failures += 1;
      go("error");
    }
    return code;
  };

  const session = {
    get status() {
      return status;
    },
    get lastCode() {
      return lastCode;
    },
    /** True when a client is set and Spotify can be asked. */
    get connected() {
      return client !== null;
    },

    /**
     * Sets (or clears) the Spotify client. With none, `reason` says why:
     * "no-network" or "signed-out".
     *
     * @param {any} next
     * @param {"no-network"|"signed-out"} [reason]
     */
    setClient(next, reason = "signed-out") {
      client = next ?? null;
      playback = null;
      failures = 0;
      retryAfter = null;
      lastCode = "";
      go(client ? "connecting" : reason);
      changed();
    },

    /** Asks Spotify what is playing. Never throws; returns false on failure. */
    async refresh() {
      if (!client) return false;
      try {
        applyPlayback(await client.getPlayback());
        changed();
        return true;
      } catch (err) {
        applyError(err);
        changed();
        return false;
      }
    },

    /**
     * Runs one control. Shows the likely result at once (play turns into
     * pause, the volume moves) and leaves confirming it to the next poll.
     *
     * @param {"playPause"|"next"|"previous"|"volumeUp"|"volumeDown"} action
     * @returns {Promise<{ ok: boolean, code?: string, did?: string, volume?: number }>}
     */
    async control(action) {
      if (!client || !CONTROL_STATES.includes(status)) return { ok: false, code: "unavailable" };
      try {
        if (action === "playPause") {
          const playing = status === "playing";
          if (playing) await client.pause();
          else await client.play();
          if (playback) {
            playback = { ...playback, isPlaying: !playing, progressMs: session.progressMs() };
            fetchedAt = now();
            go(playing ? "paused" : "playing");
          }
          changed();
          return { ok: true, did: playing ? "pause" : "play" };
        }
        if (action === "next" || action === "previous") {
          if (action === "next") await client.next();
          else await client.previous();
          return { ok: true, did: action };
        }
        if (action === "volumeUp" || action === "volumeDown") {
          const current = playback ? playback.volume : null;
          if (current === null) return { ok: false, code: "no-volume" };
          const step = action === "volumeUp" ? VOLUME_STEP : -VOLUME_STEP;
          const volume = /** @type {number} */ (clampInt(current + step, 0, 100, current));
          await client.setVolume(volume);
          if (playback) playback = { ...playback, volume };
          changed();
          return { ok: true, did: "volume", volume };
        }
        return { ok: false, code: "unknown-action" };
      } catch (err) {
        const code = applyError(err);
        changed();
        return { ok: false, code };
      }
    },

    /**
     * How long to wait before the next poll, or null to stop until the user
     * does something.
     *
     * @returns {number|null}
     */
    nextDelay() {
      if (!client || status === "signed-out" || status === "premium") return null;
      if (retryAfter !== null) return Math.max(retryAfter, POLL_MS);
      if (status === "error")
        return Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** Math.max(0, failures - 1));
      return POLL_MS;
    },

    /** The track's position now, counting time since the last answer while playing. */
    progressMs() {
      if (!playback) return 0;
      const moved = playback.isPlaying ? Math.max(0, now() - fetchedAt) : 0;
      const at = playback.progressMs + moved;
      return playback.durationMs > 0 ? Math.min(playback.durationMs, at) : at;
    },

    /** A copy of what is playing, or null. */
    playback() {
      return playback ? { ...playback, artists: [...playback.artists] } : null;
    },
  };
  return session;
}
