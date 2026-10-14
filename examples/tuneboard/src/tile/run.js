/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the tile
 *
 * Connects the session to Tilefold: registers the commands and listeners
 * (at once, before any await, as Tilefold requires), connects to Spotify
 * through Tilefold's network once the user has signed in (Tilefold runs
 * the sign-in and keeps the token; the tile only asks `tf.auth.has`, and
 * while signed out checks again every few seconds, since signing in
 * happens in Settings), polls what is playing
 * while the card is on screen, turns clicks and commands into controls,
 * shows and hides the overlay, and records an activity trail.
 *
 * The controls work from the keyboard even while the card is hidden, so
 * the shortcuts double as media keys. When nothing is playing anywhere,
 * Play starts Tuneboard's own player inside Tilefold (a hidden page running
 * Spotify's player) and moves playback there; "Play in Tilefold" does that
 * on request, and "Stop playing in Tilefold" closes it. "Show playlists"
 * opens the Library, the same page as a window, to pick a playlist to play.
 * Polling stops while the card is
 * hidden, the window is in the background or the user is away, and starts
 * again with an immediate ask when they come back.
 *
 * Event handlers return at once and do their work in the background, so a
 * slow Spotify answer can never push one past its half-second limit.
 * Redraws are coalesced: while one frame is on its way to the window,
 * further changes just mark the scene dirty and the next frame carries all
 * of them.
 */
import { createTrail } from "./audit.js";
import { registerCommands } from "./commands.js";
import { createLibrary } from "./library.js";
import { createPagePlayer } from "./player.js";
import { createPoller } from "./poller.js";
import { LAYOUT_KEYS, readSettings } from "./settings.js";
import { createSession } from "./session.js";
import { createStore } from "./store.js";
import { findTransport } from "./transport.js";
import { createCovers } from "../spotify/covers.js";
import { createPanel } from "./panel.js";
import { createPicker } from "./pick.js";
import { PANEL_ID, actionForClick, diffItems, removedIds, sceneItems } from "./view.js";
import { computeLayout } from "./scene.js";

/** How often the progress bar moves while a track plays, in ms. */
export const CLOCK_MS = 1000;

/** How long after a control to ask Spotify for the result, in ms. */
export const CONFIRM_MS = 800;

/** How often to check for a sign-in while signed out and on screen, in ms. */
export const SIGN_IN_CHECK_MS = 5000;

/**
 * How long to wait before trying again after Spotify refused the sign-in
 * Tilefold holds, in ms (the user may sign in again meanwhile; Refresh
 * tries at once).
 */
export const AUTH_RETRY_MS = 60000;

/** The sign-in Tuneboard declares in tile.json. */
const SIGN_IN = "spotify";

/** The audit action for each control result. */
const CONTROL_ACTION = {
  play: "control.play",
  pause: "control.pause",
  next: "control.next",
  previous: "control.previous",
  volume: "control.volume",
};

/** The message shown when playing in Tilefold fails, by error code. */
const PLAYER_MESSAGE = {
  account_error: "player-error-premium",
  authentication_error: "player-error-sign-in",
  token: "player-error-sign-in",
  initialization_error: "player-error-unsupported",
};

/** The audit action recorded for a control that did not go through. */
const FAILED_ACTION = {
  playPause: "control.play",
  next: "control.next",
  previous: "control.previous",
  volumeUp: "control.volume",
  volumeDown: "control.volume",
};

/**
 * Runs Tuneboard. Call it at the top of the tile's function, after its
 * settings are registered and before any `await`.
 *
 * @param {any} tf The tile API.
 * @param {{ createSpotify?: (opts: { fetchFn: Function, now: () => number }) => any,
 *           now?: () => number }} [deps]
 *   `createSpotify` builds the Spotify client; without it the tile behaves
 *   as if there were no network.
 * @returns {{ session: ReturnType<typeof createSession>, run: (action: string) => Promise<void> }}
 *   Handles for tests.
 */
export function runTuneboard(tf, deps = {}) {
  const now = deps.now ?? (() => Date.now());
  const trail = createTrail(tf);
  const store = createStore(tf);
  const settings = () => readSettings(tf.settings);
  // Registers its page listeners now, before any await.
  const player = createPagePlayer(tf, { trail });
  /** The connected Spotify client, connecting first when needed (null: signed out). */
  const client = async () => {
    await ensureConnected();
    if (!spotify) await connect();
    return spotify;
  };
  const picker = createPicker({ trail, player, client });
  const afterPlay = () => confirmSoon();
  const library = createLibrary(tf, { trail, store, picker, client, afterPlay });
  const panel = createPanel(tf, {
    trail,
    client,
    picker,
    library,
    afterPlay,
    covers: createCovers({ fetchFn: findTransport(tf) }),
    onChange: () => void draw(),
  });
  /** The Spotify client, once connected. */
  let spotify = null;

  /** Whether the card is meant to be on screen. */
  let visible = false;
  /** Whether the user is here: window focused and not idle. */
  let present = true;
  /** The window layout last reported by Tilefold. */
  let layout = null;
  /** The scene last sent to the window, or null when it must be shown afresh. */
  let shown = null;

  // ------------------------------------------------------------ drawing
  let drawing = null;
  let dirty = false;

  /** Builds the scene and sends it (whole the first time, then only changes). */
  const paint = async () => {
    if (!visible) return;
    const items = sceneItems({
      status: session.status,
      playback: session.playback(),
      progressMs: session.progressMs(),
      settings: settings(),
      layout,
      t: (key, args) => tf.t(key, args),
      panel: panel.view(),
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items });
      // False means the user has overlays hidden: the next poll tries again.
      shown = ok === false ? null : items;
      return;
    }
    const changes = diffItems(shown, items);
    const remove = removedIds(shown, items);
    shown = items;
    if (changes.length || remove.length) {
      await tf.overlay.update({ items: changes, ...(remove.length ? { remove } : {}) });
    }
  };

  /** Asks for a redraw; resolves when the window is up to date. */
  const draw = () => {
    dirty = true;
    if (!drawing) {
      drawing = (async () => {
        try {
          while (dirty) {
            dirty = false;
            await paint();
          }
        } catch (err) {
          // The window lost our scene (or refused it): show it whole next time.
          shown = null;
          trail.error(err);
        } finally {
          drawing = null;
        }
      })();
    }
    return drawing;
  };

  // ------------------------------------------------------------ session and timers
  const session = createSession({
    now,
    onChange: () => {
      updateTimers();
      if (visible) void draw();
    },
    onState: (from, to) => {
      trail.record("state.change", { from, to });
      if (to === "signed-out" && session.lastCode === "auth") {
        // Spotify or Tilefold refused the sign-in: the user signs in again in Settings.
        authFailedAt = now();
        trail.record("auth.failed", { code: "auth" });
      }
      updateSignInCheck();
    },
  });

  const poller = createPoller({
    tick: () => session.refresh(),
    delay: () => session.nextDelay(),
    onError: (err) => trail.error(err),
  });

  /** Moves the progress bar every second while a track plays on screen. */
  let clock = null;

  /** Starts or stops the poller and the clock to match what is going on. */
  function updateTimers() {
    const watch = visible && present && session.connected && settings().poll;
    if (watch && !poller.running) poller.start();
    else if (!watch && poller.running) poller.stop();

    const tick = visible && shown !== null && session.status === "playing";
    if (tick && clock === null) clock = setInterval(() => void draw(), CLOCK_MS);
    else if (!tick && clock !== null) {
      clearInterval(clock);
      clock = null;
    }
  }

  // ------------------------------------------------------------ signing in
  let connecting = null;

  /** Whether the user has signed in to Spotify in Settings (false when unknown). */
  const signedIn = async () => {
    try {
      return Boolean(tf.auth && typeof tf.auth.has === "function" && (await tf.auth.has(SIGN_IN)));
    } catch {
      return false;
    }
  };

  /** Builds the Spotify client (or explains why there is none). */
  const connect = () => {
    connecting = (async () => {
      poller.stop();
      // Until connected again, nothing may use the previous client.
      spotify = null;
      const fetchFn = findTransport(tf);
      if (!fetchFn || typeof deps.createSpotify !== "function" || !tf.auth) {
        session.setClient(null, "no-network");
        return;
      }
      if (!(await signedIn())) {
        session.setClient(null, "signed-out");
        return;
      }
      spotify = deps.createSpotify({ fetchFn, now });
      session.setClient(spotify);
      trail.record("auth.connected", {});
      // Polling (when on) asks at once; otherwise ask once so the card is not left empty.
      if (!poller.running) await session.refresh();
    })().catch((err) => {
      trail.error(err);
      session.setClient(null, "signed-out");
    });
    return connecting;
  };

  /** Connects once per worker, on first use, after clearing a token older versions kept. */
  const ensureConnected = () =>
    connecting ??
    (connecting = (async () => {
      if (await store.clearLegacyAuth()) trail.record("auth.legacy-cleared", {});
      await connect();
    })());

  /** When Spotify last refused the sign-in (0: never). */
  let authFailedAt = 0;

  /** Checks for a sign-in every few seconds while signed out and on screen. */
  let signInCheck = null;
  function updateSignInCheck() {
    const wanted = visible && session.status === "signed-out";
    if (wanted && signInCheck === null) {
      signInCheck = setInterval(() => {
        void (async () => {
          if (session.status !== "signed-out") return;
          // After a refusal, wait longer: the same sign-in would likely be refused again.
          if (authFailedAt && now() - authFailedAt < AUTH_RETRY_MS) return;
          if (await signedIn()) await connect();
        })().catch((err) => trail.error(err));
      }, SIGN_IN_CHECK_MS);
    } else if (!wanted && signInCheck !== null) {
      clearInterval(signInCheck);
      signInCheck = null;
    }
  }

  // ------------------------------------------------------------ showing
  /** Puts the card on screen. */
  const show = async () => {
    visible = true;
    shown = null;
    try {
      layout = await tf.overlay.layout();
    } catch {
      layout = null;
    }
    await store.setVisible(true);
    trail.record("view.show", {});
    updateSignInCheck();
    updateTimers();
    await draw();
    updateTimers();
  };

  /** Takes the card off screen and stops polling. */
  const hide = async () => {
    visible = false;
    shown = null;
    updateSignInCheck();
    updateTimers();
    await tf.overlay.hide();
    await store.setVisible(false);
    trail.record("view.hide", {});
  };

  // ------------------------------------------------------------ actions
  /** Asks Spotify for the result of a control a moment later. */
  const confirmSoon = () => {
    if (poller.running) poller.soon(CONFIRM_MS);
    else setTimeout(() => void session.refresh().catch((err) => trail.error(err)), CONFIRM_MS);
  };

  /** Tells the user something with the tile's own message. */
  const tell = (key) => void Promise.resolve(tf.toast(tf.t(key))).catch(() => {});

  /** Starts the player inside Tilefold and moves Spotify's playback there. */
  const playHere = async () => {
    if (!player.available()) return tell("player-unavailable");
    if (!spotify) await connect();
    if (!spotify) return tell("state-signed-out-hint");
    try {
      // Playing on the device (not moving playback to it) starts the sound there.
      await spotify.playOn(await player.start());
      trail.record("control.play-here", { ok: true });
      confirmSoon();
    } catch (err) {
      const code = String(err?.code ?? "unknown").slice(0, 40);
      trail.record("control.play-here", { ok: false, code });
      tell(PLAYER_MESSAGE[code] ?? "player-error-other");
    }
    return visible ? draw() : undefined;
  };

  /**
   * Runs one action, from a command or a click.
   *
   * @param {string} action toggle, refresh, or a control.
   */
  const run = async (action) => {
    await ensureConnected();
    if (action === "toggle") return visible ? hide() : show();
    if (action === "refresh") {
      trail.record("control.refresh", {});
      // The user may have signed in or out since; a refresh also checks again.
      if (!session.connected || session.status === "signed-out" || session.status === "premium") {
        await connect();
      } else {
        await session.refresh();
      }
      updateTimers();
      if (poller.running) poller.soon(0);
      return visible ? draw() : undefined;
    }
    if (action === "playHere") return playHere();
    if (action === "panel") {
      if (!visible) await show();
      return panel.toggle();
    }
    if (action === "library") {
      return library.available() ? library.show() : tell("player-unavailable");
    }
    if (action === "stopHere") {
      if (player.available()) await player.stop();
      confirmSoon();
      return visible ? draw() : undefined;
    }
    // Nothing is playing anywhere: Play starts the player inside Tilefold.
    if (action === "playPause" && session.status === "no-device" && player.available()) {
      return playHere();
    }
    const result = await session.control(/** @type {any} */ (action));
    if (result.ok) {
      const details = result.did === "volume" ? { ok: true, volume: result.volume } : { ok: true };
      trail.record(CONTROL_ACTION[result.did ?? ""] ?? "control.refresh", details);
      confirmSoon();
    } else if (FAILED_ACTION[action]) {
      trail.record(FAILED_ACTION[action], { ok: false, code: result.code ?? "unknown" });
    }
    return visible ? draw() : undefined;
  };

  /**
   * Wraps an event handler so it returns at once and its work carries on
   * in the background, with failures logged rather than thrown.
   */
  const background = (fn) => (e) => {
    void (async () => {
      await ensureConnected();
      await fn(e);
    })().catch((err) => trail.error(err));
  };

  // ------------------------------------------------------------ registration (no await above this line runs first)
  registerCommands(tf, (action) => run(action).catch((err) => trail.error(err)));

  tf.on(
    "app.ready",
    background(async () => {
      if (!visible && (await store.visible())) await show();
    }),
  );

  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || !visible) return;
      // The panel takes clicks and drags (which scroll it); the rest only clicks.
      if (e.item === PANEL_ID) {
        return panel.pointer(e, computeLayout(layout, settings(), { panel: true })[PANEL_ID]);
      }
      if (e.type !== "click") return;
      const action = actionForClick(String(e.item));
      if (action) await run(action);
    }),
  );

  tf.on(
    "overlay.layout",
    background(async (next) => {
      if (next && typeof next === "object") layout = next;
      if (visible) await draw();
    }),
  );

  tf.on(
    "overlay.hidden",
    background(async () => {
      // Tilefold took the scene away; the next poll or command shows it whole again.
      shown = null;
      updateTimers();
    }),
  );

  /**
   * The user left or came back: stop or resume polling. Resuming starts the
   * poller afresh, which asks at once.
   */
  const presence = (here) =>
    background(async () => {
      present = here;
      updateTimers();
    });
  tf.on("window.blurred", presence(false));
  tf.on("user.idle", presence(false));
  tf.on("window.focused", presence(true));
  tf.on("user.active", presence(true));

  tf.on(
    "setting.changed",
    background(async (e) => {
      const key = e && e.key;
      if (LAYOUT_KEYS.includes(key) && visible) {
        try {
          layout = await tf.overlay.layout();
        } catch {
          // Keep the last layout.
        }
      }
      updateTimers();
      if (visible) await draw();
    }),
  );

  return { session, run };
}
