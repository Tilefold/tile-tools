/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — the tile
 *
 * Connects the game to Tilefold: registers the commands and listeners (at
 * once, before any await, as Tilefold requires), shows and hides the
 * overlay, turns clicks and commands into game actions, pauses when the
 * user looks away, plays sounds, keeps the best score and a resumable
 * snapshot in the tile's storage, and records an activity trail.
 *
 * Event handlers return at once and do their work in the background, so a
 * busy window can never push one past its half-second limit. Redraws are
 * coalesced: while one frame is on its way to the window, further changes
 * just mark the scene dirty and the next frame carries all of them.
 *
 * If Tilefold restarts the tile's worker, the first event or command loads
 * the saved game back (paused) instead of starting from nothing.
 */
import { registerCommands } from "./commands.js";
import { createTrail } from "./audit.js";
import { LAYOUT_KEYS, readSettings } from "./settings.js";
import { createSession } from "./session.js";
import { clearSound, createSounds } from "./sound.js";
import { createStore } from "./store.js";
import { actionForClick, diffItems, sceneItems } from "./view.js";

/**
 * Runs Tilefall. Call it at the top of the tile's function, after its
 * settings are registered and before any `await`.
 *
 * @param {any} tf The tile API.
 * @param {{ createGame: (opts: object) => any, gravityMs: (level: number) => number }} engine
 * @returns {{ session: ReturnType<typeof createSession>, run: (action: string) => Promise<void> }}
 *   Handles for tests.
 */
export function runTilefall(tf, engine) {
  const trail = createTrail(tf);
  const store = createStore(tf);
  const settings = () => readSettings(tf.settings);
  const sounds = createSounds(tf, () => settings().sounds);
  const numberFormat = (() => {
    try {
      const nf = new Intl.NumberFormat();
      return (n) => nf.format(n);
    } catch {
      return (n) => String(n);
    }
  })();

  /** Whether the game is meant to be on screen. */
  let visible = false;
  /** The window layout last reported by Tilefold. */
  let layout = null;
  /** The scene last sent to the window, or null when it must be shown afresh. */
  let shown = null;
  /** The best score as last read or written. */
  let best = 0;

  // ------------------------------------------------------------ drawing
  let drawing = null;
  let dirty = false;

  /** Builds the scene and sends it (whole the first time, then only changes). */
  const paint = async () => {
    if (!visible) return;
    const items = sceneItems({
      status: session.status,
      state: session.state(),
      best,
      settings: settings(),
      layout,
      t: (key, args) => tf.t(key, args),
      format: numberFormat,
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items });
      // False means the user has overlays hidden: keep the game, pause it, try again later.
      if (ok === false) {
        shown = null;
        pause("hidden");
        return;
      }
      shown = items;
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

  // ------------------------------------------------------------ the game
  const session = createSession({
    engine,
    onChange: () => void draw(),
    onEvent: (e) => void onGameEvent(e).catch((err) => trail.error(err)),
    onError: (err) => trail.error(err),
  });

  /** Figures recorded with every game record. */
  const figures = () => {
    const s = session.state();
    return s ? { score: s.score, lines: s.lines, level: s.level } : {};
  };

  /** Saves the game in progress (or forgets it when there is none). */
  const save = async () => {
    const snap = session.snapshot();
    if (snap) await store.saveSnapshot(snap.game, snap.seconds);
  };

  /** Sounds, saving and records for the game's moments. */
  const onGameEvent = async (e) => {
    if (e.type === "start") {
      trail.record("game.start", { level: Number(e.level) || 1 });
    } else if (e.type === "clear") {
      sounds.play(clearSound(e.lines));
      await save();
    } else if (e.type === "level") {
      trail.info(`level ${e.level}`);
    } else if (e.type === "over") {
      sounds.play("over");
      const isBest = await store.offerBest(e.score);
      if (isBest) {
        best = Math.max(best, Number(e.score) || 0);
        trail.record("best.new", { score: Number(e.score) || 0 });
      }
      await store.addGame(e.lines, e.seconds);
      await store.clearSnapshot();
      trail.record("game.over", {
        score: Number(e.score) || 0,
        lines: Number(e.lines) || 0,
        level: Number(e.level) || 1,
        seconds: Number(e.seconds) || 0,
        best: isBest,
      });
      await draw();
    }
  };

  /** Pauses a running game, recording why and saving it. */
  function pause(reason) {
    if (!session.pause()) return false;
    trail.record("game.pause", { reason, ...figures() });
    void save().catch((err) => trail.error(err));
    return true;
  }

  /** Resumes a paused game. */
  const resume = () => {
    if (!session.resume()) return false;
    trail.record("game.resume", figures());
    return true;
  };

  // ------------------------------------------------------------ loading
  let loading = null;
  /** Loads the best score and any saved game, once per worker. */
  const ensureLoaded = () => {
    if (!loading) {
      loading = (async () => {
        best = await store.best();
        const snap = await store.snapshot();
        if (snap && session.status === "none" && session.restore(snap)) {
          trail.record("game.restore", figures());
        }
      })().catch((err) => trail.error(err));
    }
    return loading;
  };

  // ------------------------------------------------------------ showing
  /** Puts the game on screen. */
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
    await draw();
  };

  /** Takes the game off screen, pausing and saving it first. */
  const hide = async () => {
    pause("toggle");
    await save();
    visible = false;
    shown = null;
    await tf.overlay.hide();
    await store.setVisible(false);
    trail.record("view.hide", {});
  };

  // ------------------------------------------------------------ actions
  /**
   * Runs one action, from a command or a click.
   *
   * @param {string} action newGame, pause, toggle, or a move.
   */
  const run = async (action) => {
    await ensureLoaded();
    if (action === "toggle") return visible ? hide() : show();
    if (action === "newGame") {
      if (!visible) await show();
      await store.clearSnapshot();
      session.newGame({ startLevel: settings().startLevel });
      return draw();
    }
    if (action === "pause") {
      if (!visible) return show();
      if (session.status === "playing") pause("user");
      else if (session.status === "paused") resume();
      else {
        await store.clearSnapshot();
        session.newGame({ startLevel: settings().startLevel });
      }
      return draw();
    }
    // Moves only count while the game is on screen and running.
    if (!visible) return undefined;
    session.act(action);
    return drawing ?? undefined;
  };

  /**
   * Wraps an event handler so it returns at once and its work carries on
   * in the background, with failures logged rather than thrown.
   */
  const background = (fn) => (e) => {
    void (async () => {
      await ensureLoaded();
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
      const action = actionForClick(String(e.item), session.status);
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
      pause("hidden");
      // Tilefold took the scene away; show it whole when the user brings overlays back.
      shown = null;
    }),
  );

  tf.on(
    "window.blurred",
    background(async () => {
      if (settings().pauseOnBlur) pause("blur");
    }),
  );

  tf.on(
    "user.idle",
    background(async () => {
      pause("idle");
    }),
  );

  tf.on(
    "setting.changed",
    background(async (e) => {
      const key = e && e.key;
      if (!visible) return;
      if (LAYOUT_KEYS.includes(key)) {
        try {
          layout = await tf.overlay.layout();
        } catch {
          // Keep the last layout.
        }
      }
      await draw();
    }),
  );

  return { session, run };
}
