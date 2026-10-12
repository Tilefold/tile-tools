/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the tile
 *
 * Connects the session to Tilefold: registers the commands and listeners
 * (at once, before any await, as Tilefold requires), signs in to Spotify
 * with the settings and the network Tilefold offers, polls what is playing
 * while the card is on screen, turns clicks and commands into controls,
 * shows and hides the overlay, and records an activity trail.
 *
 * The controls work from the keyboard even while the card is hidden, so
 * the shortcuts double as media keys. Polling stops while the card is
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
import { createPoller } from "./poller.js";
import { ACCOUNT_KEYS, LAYOUT_KEYS, readSettings } from "./settings.js";
import { createSession } from "./session.js";
import { createStore } from "./store.js";
import { findTransport } from "./transport.js";
import { actionForClick, diffItems, sceneItems } from "./view.js";

/** How often the progress bar moves while a track plays, in ms. */
export const CLOCK_MS = 1000;

/** How long after a control to ask Spotify for the result, in ms. */
export const CONFIRM_MS = 800;

/** The audit action for each control result. */
const CONTROL_ACTION = {
  play: "control.play",
  pause: "control.pause",
  next: "control.next",
  previous: "control.previous",
  volume: "control.volume",
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
 * @param {{ createSpotify?: (opts: { fetchFn: Function, clientId: string, refreshToken: string,
 *           now: () => number, onRefreshToken: (token: string) => void }) => any,
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
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items });
      // False means the user has overlays hidden: the next poll tries again.
      shown = ok === false ? null : items;
      return;
    }
    const changes = diffItems(shown, items);
    shown = items;
    if (changes.length) await tf.overlay.update({ items: changes });
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
        trail.record("auth.failed", { code: "auth" });
        // The saved newer token was refused: next time, start again from Settings.
        void store.forgetRefreshToken();
      }
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

  /** Builds the Spotify client from the settings (or explains why there is none). */
  const connect = () => {
    connecting = (async () => {
      poller.stop();
      const s = settings();
      const fetchFn = findTransport(tf);
      if (!fetchFn || typeof deps.createSpotify !== "function") {
        session.setClient(null, "no-network");
        return;
      }
      if (!s.clientId || !s.refreshToken) {
        session.setClient(null, "signed-out");
        return;
      }
      const refreshToken = await store.refreshToken(s.refreshToken);
      const client = deps.createSpotify({
        fetchFn,
        clientId: s.clientId,
        refreshToken,
        now,
        onRefreshToken: (token) => {
          void store.saveRefreshToken(s.refreshToken, token);
          trail.record("auth.rotated", {});
        },
      });
      session.setClient(client);
      // Polling (when on) asks at once; otherwise ask once so the card is not left empty.
      if (!poller.running) await session.refresh();
    })().catch((err) => {
      trail.error(err);
      session.setClient(null, "signed-out");
    });
    return connecting;
  };

  /** Connects once per worker, on first use. */
  const ensureConnected = () => connecting ?? connect();

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
    updateTimers();
    await draw();
    updateTimers();
  };

  /** Takes the card off screen and stops polling. */
  const hide = async () => {
    visible = false;
    shown = null;
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
      // Settings may have changed since; a refresh also retries signing in.
      if (!session.connected || session.status === "signed-out" || session.status === "premium") {
        await connect();
      } else {
        await session.refresh();
      }
      updateTimers();
      if (poller.running) poller.soon(0);
      return visible ? draw() : undefined;
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
      if (!e || e.type !== "click" || !visible) return;
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
      if (ACCOUNT_KEYS.includes(key)) await connect();
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
