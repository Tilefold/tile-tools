/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Arcade kit — the tile
 *
 * Connects a game to Tilefold. The game brings a pure engine (no Tilefold
 * in it), a renderer that draws the board as an SVG picture, its moves and
 * their buttons and shortcuts, and its sounds. This kit does the rest:
 *
 * - registers the commands (New game, Pause or resume, Show or hide, and
 *   the game's moves) and the listeners, at once, before any `await`;
 * - shows the board and its buttons as an overlay in a corner of the pane
 *   (permission window.overlay) and sends only what changed each frame;
 * - runs the game clock while a game is playing and on screen;
 * - turns clicks on the board and buttons into actions: click the board to
 *   start, pause, resume or play again;
 * - pauses when you switch apps, go idle, or hide overlays;
 * - plays sounds (permission sound.play), keeps the best score in the
 *   tile's storage, and records starts, game overs and new bests in the
 *   activity log.
 *
 * Event handlers and commands return at once and do their work in the
 * background, so none of them can run past Tilefold's time limits. Redraws
 * are coalesced: while one frame is on its way to the window, later changes
 * mark the scene dirty and the next frame carries them all.
 *
 * This file is the same in every arcade example.
 */
import { computeLayout } from "./layout.js";
import { LAYOUT_KEYS, readSettings, SIZES } from "./settings.js";
import { createSounds } from "./sound.js";
import { buttonImage } from "../render/svg.js";

/** The kit's own commands, with ids shared by every arcade example. */
const KIT_COMMANDS = [
  { id: "new-game", title: "cmd-new-game", action: "newGame" },
  { id: "pause", title: "cmd-pause", action: "pause" },
];

/** The board's spoken label for each game status. */
const BOARD_LABELS = {
  none: "board-label-none",
  playing: "board-label-playing",
  paused: "board-label-paused",
  over: "board-label-over",
};

/** The fields compared between frames. */
const FIELDS = ["image", "x", "y", "w", "h", "label", "hit", "cursor"];

/**
 * The scene items that differ between two frames (whole items, by id).
 *
 * @param {any[]} before
 * @param {any[]} after
 * @returns {any[]}
 */
export function diffItems(before, after) {
  const old = new Map(before.map((i) => [i.id, i]));
  const out = [];
  for (const item of after) {
    const prev = old.get(item.id);
    if (!prev) {
      out.push(item);
      continue;
    }
    const change = { id: item.id };
    let changed = false;
    for (const f of FIELDS) {
      if (item[f] !== prev[f]) {
        change[f] = item[f];
        changed = true;
      }
    }
    if (changed) out.push(change);
  }
  return out;
}

/**
 * What a click on the board does for each game status.
 *
 * @param {string} status none, playing, paused or over.
 * @returns {string}
 */
export function boardAction(status) {
  return status === "playing" || status === "paused" ? "pause" : "newGame";
}

/**
 * Runs an arcade game. Call it at the top of the tile's function, after
 * the settings are registered and before any `await`.
 *
 * @param {any} tf The tile API.
 * @param {{
 *   board: { w: number, h: number },
 *   tickMs: number,
 *   create: (seed: number) => { state: any, act: (a: string) => any[], step: (ms: number) => any[] },
 *   render: (o: { state: any, status: string, best: number, t: Function, format: Function,
 *                 w: number, h: number }) => string,
 *   moves: { id: string, title: string, action: string, key: { mac: string, other: string },
 *            icon?: string, label?: string }[],
 *   toggleKey: { mac: string, other: string },
 *   sounds: Record<string, any>,
 *   soundFor: (event: any) => string | undefined,
 *   seed?: () => number,
 * }} game
 * @returns {{ run: (action: string) => Promise<void>, status: () => string, engine: () => any }}
 *   Handles for tests.
 */
export function runArcade(tf, game) {
  const settings = () => readSettings(tf.settings);
  const sounds = createSounds(tf, () => settings().sounds, game.sounds);
  const format = (() => {
    try {
      const nf = new Intl.NumberFormat();
      return (n) => nf.format(n);
    } catch {
      return (n) => String(n);
    }
  })();
  const seed = game.seed ?? (() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const buttons = [
    ...game.moves.filter((m) => m.icon),
    { id: "pause", icon: "pause", action: "pause" },
  ];

  /** @type {"none" | "playing" | "paused" | "over"} */
  let status = "none";
  let engine = null;
  let best = 0;
  let visible = false;
  let layout = null;
  let shown = null;
  let clock = null;

  /** Logs a failure to the tile's Log; never throws. */
  const fail = (err) => {
    void Promise.resolve(tf.log?.error(String(err && err.message ? err.message : err))).catch(
      () => {},
    );
  };
  /** Adds an activity record; never throws. */
  const record = (action, details) => {
    void Promise.resolve(tf.audit?.(action, details)).catch(() => {});
  };

  // ------------------------------------------------------------ drawing
  /** The full scene for the current state. */
  const items = () => {
    const s = settings();
    const rects = computeLayout(
      layout,
      s,
      game.board,
      buttons.map((b) => b.id),
    );
    const scale = SIZES[s.size] ?? 1;
    const t = (key, args) => tf.t(key, args);
    const board = rects.board;
    const list = [
      {
        id: "board",
        image: game.render({
          state: engine ? engine.state : null,
          status,
          best,
          t,
          format,
          w: board.w,
          h: board.h,
        }),
        ...board,
        label: tf.t(BOARD_LABELS[status]),
        hit: true,
        cursor: "pointer",
      },
    ];
    for (const b of buttons) {
      const r = rects[`btn-${b.id}`];
      const icon = b.id === "pause" && status !== "playing" ? "play" : b.icon;
      list.push({
        id: `btn-${b.id}`,
        image: buttonImage(icon, Math.round(30 * scale)),
        ...r,
        label: tf.t(b.id === "pause" ? "button-pause" : b.label),
        hit: true,
        cursor: "pointer",
      });
    }
    return list;
  };

  /** Sends the scene: whole the first time, then only what changed. */
  const paint = async () => {
    if (!visible) return;
    const next = items();
    if (!shown) {
      const ok = await tf.overlay.show({ items: next });
      if (ok === false) {
        // The user has overlays hidden: keep the game, paused, and show it later.
        pause("hidden");
        return;
      }
      shown = next;
      return;
    }
    const changes = diffItems(shown, next);
    shown = next;
    if (changes.length) await tf.overlay.update({ items: changes });
  };

  let drawing = null;
  let dirty = false;
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
          // The window lost or refused the scene: send it whole next time.
          shown = null;
          fail(err);
        } finally {
          drawing = null;
        }
      })();
    }
    return drawing;
  };

  // ------------------------------------------------------------ the game
  /** Starts or stops the clock to match the status and visibility. */
  const syncClock = () => {
    const want = status === "playing" && visible;
    if (want && clock === null) clock = setInterval(tick, game.tickMs);
    if (!want && clock !== null) {
      clearInterval(clock);
      clock = null;
    }
  };

  /** Plays sounds for events and ends the game when it is over. */
  const handle = (events) => {
    for (const e of events ?? []) {
      const name = game.soundFor(e);
      if (name) sounds.play(name);
    }
    if (engine && engine.state.over && status === "playing") void gameOver();
  };

  /** One step of the game clock. */
  function tick() {
    if (status !== "playing" || !engine) return;
    try {
      handle(engine.step(game.tickMs));
    } catch (err) {
      fail(err);
    }
    void draw();
  }

  const gameOver = async () => {
    status = "over";
    syncClock();
    const score = Number(engine.state.score) || 0;
    const isBest = score > best;
    if (isBest) {
      best = score;
      await tf.store.set("best", best);
      record("best-new", { score });
    }
    record("game-over", { score, level: Number(engine.state.level) || 1, best: isBest });
    await draw();
  };

  const newGame = () => {
    engine = game.create(seed());
    status = "playing";
    record("game-start", {});
    syncClock();
  };

  /** Pauses a running game. */
  function pause(reason) {
    if (status !== "playing") return false;
    status = "paused";
    syncClock();
    record("game-pause", { reason });
    void draw();
    return true;
  }

  const resume = () => {
    if (status !== "paused") return false;
    status = "playing";
    syncClock();
    return true;
  };

  // ------------------------------------------------------------ loading and showing
  let loading = null;
  /** Loads the best score once per worker. */
  const ensureLoaded = () => {
    loading ??= (async () => {
      const stored = Number(await tf.store.get("best"));
      if (Number.isFinite(stored) && stored > best) best = stored;
    })().catch(fail);
    return loading;
  };

  const show = async () => {
    visible = true;
    shown = null;
    try {
      layout = await tf.overlay.layout();
    } catch {
      layout = null;
    }
    await tf.store.set("visible", true);
    syncClock();
    await draw();
  };

  const hide = async () => {
    pause("hidden");
    visible = false;
    shown = null;
    syncClock();
    await tf.overlay.hide();
    await tf.store.set("visible", false);
  };

  // ------------------------------------------------------------ actions
  /**
   * Runs one action, from a command or a click.
   *
   * @param {string} action toggle, newGame, pause, or one of the game's moves.
   */
  const run = async (action) => {
    await ensureLoaded();
    if (action === "toggle") return visible ? hide() : show();
    if (action === "newGame") {
      if (!visible) await show();
      newGame();
      return draw();
    }
    if (action === "pause") {
      if (!visible) return show();
      if (status === "playing") pause("user");
      else if (status === "paused") resume();
      else newGame();
      return draw();
    }
    // Moves only count while a game is on screen and running.
    if (!visible || status !== "playing" || !engine) return undefined;
    handle(engine.act(action));
    return draw();
  };

  /** Wraps a handler so it returns at once and its work carries on in the background. */
  const background = (fn) => (e) => {
    void (async () => {
      await ensureLoaded();
      await fn(e);
    })().catch(fail);
  };

  // ------------------------------------------------------------ registration (before any await)
  const commands = [
    ...KIT_COMMANDS,
    { id: "toggle", title: "cmd-toggle", action: "toggle", key: game.toggleKey },
    ...game.moves,
  ];
  for (const c of commands) {
    const options = c.key ? { id: c.id, key: c.key } : { id: c.id };
    tf.command(tf.t(c.title), () => void run(c.action).catch(fail), options);
  }

  tf.on(
    "app.ready",
    background(async () => {
      if (!visible && (await tf.store.get("visible")) === true) await show();
    }),
  );

  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.type !== "click" || !visible) return;
      const id = String(e.item);
      if (id === "board") return run(boardAction(status));
      const b = buttons.find((x) => `btn-${x.id}` === id);
      if (b) return run(b.action);
      return undefined;
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
      if (!visible) return;
      if (e && LAYOUT_KEYS.includes(e.key)) {
        try {
          layout = await tf.overlay.layout();
        } catch {
          // Keep the last layout.
        }
      }
      await draw();
    }),
  );

  return { run, status: () => status, engine: () => engine };
}
