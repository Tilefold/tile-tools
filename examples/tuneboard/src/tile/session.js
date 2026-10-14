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
 *   denied      Tilefold refused the request (the user hasn't allowed
 *               Spotify's host); retried slowly, in case they allow it
 *   signed-out  no client id or refresh token, or Spotify refused them
 *   connecting  signed in, waiting for the first answer
 *   no-device   Spotify answered but nothing is playing anywhere
 *   playing     a track is playing
 *   paused      a track is paused
 *   premium     a control was refused because the account isn't Premium
 *   error       Spotify or the network failed; retried with back-off
 *
 * Volume clicks show the new volume at once and are sent once the user
 * pauses (quick clicks become one request). For a few seconds after, the
 * volume the user chose wins over the one Spotify reports, which lags
 * behind; otherwise the card would jump back and the next click would
 * start from the old volume. Mute sets the volume to 0 and remembers the
 * volume before, which a second mute brings back (Spotify has no mute of
 * its own); raising the volume while muted unmutes too.
 *
 * `nextDelay()` tells the poller how long to wait: the normal interval
 * after an answer, Spotify's Retry-After when rate-limited, a doubling
 * back-off after errors, a slow retry while refused, and null (stop) when
 * only the user can fix it (signed out, Premium needed).
 */

/** All states. */
export const STATES = Object.freeze([
  "no-network",
  "denied",
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

/** The volume unmuting goes back to when the volume before muting is unknown. */
export const UNMUTE_VOLUME = 50;

/** How long volume clicks wait for more before the volume is sent, in ms. */
export const VOLUME_SETTLE_MS = 300;

/** How long the chosen volume wins over what Spotify reports, in ms. */
export const VOLUME_HOLD_MS = 3000;

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
 *             progressMs: number, device: string, deviceId: string, volume: number|null } | null}
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
    deviceId: p.device && typeof p.device.id === "string" ? p.device.id : "",
    volume: p.device ? clampInt(p.device.volume, 0, 100, null) : null,
  };
}

/**
 * Creates a session.
 *
 * @param {{ now?: () => number, onChange?: () => void,
 *           onState?: (from: string, to: string) => void,
 *           setVolume?: (volume: number, playback: any) => Promise<unknown>,
 *           onVolumeError?: (code: string) => void }} [o]
 *   `onChange` hears about anything that changes the picture; `onState`
 *   about each change of state. `setVolume` sends a volume (default: the
 *   client's), and `onVolumeError` hears when sending it failed.
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
  /** @type {number|null} The volume the user chose last, until it is sent and settled. */
  let volumeTarget = null;
  /** Until when `volumeTarget` wins over Spotify's reports. */
  let holdUntil = 0;
  /** @type {ReturnType<typeof setTimeout>|null} The pending send. */
  let volumeTimer = null;
  /** Whether a volume is being sent now. */
  let sendingVolume = false;
  /** The volume last sent. */
  let sentVolume = null;
  /** @type {number|null} The volume before muting, which unmuting brings back. */
  let mutedFrom = null;

  /** Chooses a volume: shown at once, sent once the clicks pause, held a while. */
  const chooseVolume = (volume) => {
    volumeTarget = volume;
    holdUntil = now() + VOLUME_HOLD_MS;
    if (playback) playback = { ...playback, volume };
    if (volume > 0) mutedFrom = null;
    scheduleVolume();
    changed();
    return { ok: true, did: "volume", volume };
  };

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
    // Spotify reports a new volume late: the one the user chose wins for a while.
    if (volumeTarget !== null && now() < holdUntil) {
      if (playback) playback = { ...playback, volume: volumeTarget };
    } else if (!sendingVolume && volumeTimer === null) {
      volumeTarget = null;
    }
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
    } else if (code === "denied") {
      playback = null;
      go("denied");
    } else if (code === "rate-limit") {
      const after = Number(err && err.retryAfterMs);
      retryAfter = Number.isFinite(after) && after > 0 ? after : POLL_MS * 2;
    } else {
      failures += 1;
      go("error");
    }
    return code;
  };

  /** Sends the chosen volume, once, and again if it changed meanwhile. */
  const sendVolume = async () => {
    volumeTimer = null;
    if (sendingVolume || volumeTarget === null || !client) return;
    const volume = volumeTarget;
    sendingVolume = true;
    try {
      await (o.setVolume ? o.setVolume(volume, playback) : client.setVolume(volume));
      sentVolume = volume;
      holdUntil = now() + VOLUME_HOLD_MS;
    } catch (err) {
      volumeTarget = null;
      holdUntil = 0;
      const code = applyError(err);
      changed();
      if (o.onVolumeError) o.onVolumeError(code);
    } finally {
      sendingVolume = false;
    }
    if (volumeTarget !== null && volumeTarget !== sentVolume) scheduleVolume();
  };

  /** Sends the volume once the clicks pause. */
  const scheduleVolume = () => {
    if (volumeTimer !== null) clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => void sendVolume(), VOLUME_SETTLE_MS);
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
     * @param {"playPause"|"next"|"previous"|"volumeUp"|"volumeDown"|"mute"} action
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
          // Quick clicks build on the volume just chosen, not on Spotify's stale one.
          const current = volumeTarget ?? (playback ? playback.volume : null);
          if (current === null) return { ok: false, code: "no-volume" };
          const step = action === "volumeUp" ? VOLUME_STEP : -VOLUME_STEP;
          // Raising from mute starts from the volume before muting.
          const base = current === 0 && step > 0 && mutedFrom !== null ? mutedFrom - step : current;
          return chooseVolume(/** @type {number} */ (clampInt(base + step, 0, 100, current)));
        }
        if (action === "mute") {
          const current = volumeTarget ?? (playback ? playback.volume : null);
          if (current === null) return { ok: false, code: "no-volume" };
          if (current > 0) {
            const before = current;
            chooseVolume(0);
            mutedFrom = before;
            return { ok: true, did: "volume", volume: 0 };
          }
          return chooseVolume(mutedFrom ?? UNMUTE_VOLUME);
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
      // Allowing the host again needs the user; check now and then, not often.
      if (status === "denied") return MAX_BACKOFF_MS;
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
