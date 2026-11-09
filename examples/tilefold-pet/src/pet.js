/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — behaviour
 *
 * The pet's life on top of the panes, the same for every character: it
 * roams all over the pane it is in (or, with "Along the bottom", walks
 * just above the Composer), now and then wanders into another pane, sits,
 * looks around, naps when you step away and perks up when
 * you come back. A click gives a pat, a double-click plays, and a drag
 * carries it anywhere (or onto a pane's floor, when it keeps to the
 * bottom). A dog barks when patted, played with or greeting you, unless
 * its Bark setting is off. The look, the
 * walking pace and a few speech bubbles come from the chosen character;
 * changing the character, name or size redraws it at once.
 *
 * Behaviour is a small state machine on timers in this worker. It stops
 * planning a minute after Tilefold loses focus and while overlays are
 * hidden. Event handlers return at once and do their drawing in the
 * background, so a busy window can never push one past its time limit;
 * and if Tilefold restarts the tile's worker, the pet comes back on the
 * next event instead of standing frozen. Pats, plays and character changes are recorded in the activity
 * log (counts and the character id only).
 *
 * Modified 2026-10-12 (a click, double-click, drag or nap during a walk
 * stops the pet where it is instead of making it jump to the walk's end).
 * Modified 2026-11-08 (one tab or every tab): "Show on" (tabs.js).
 *
 * Last updated by: Tilefold
 */
import { characterById, posesOf } from "./characters/index.js";
import { watchTab } from "./tabs.js";

/**
 * Registers Tilefold Pet's commands and listeners and runs the pet. Call it at
 * the top of the tile's function, after its settings, before any `await`.
 *
 * @param {any} tf The tile API.
 */
export function runPet(tf) {
  /** Where it is, what it's doing, and the window it lives in. */
  const pet = { x: 0, y: 0, flip: false, state: "off", asleep: false, pane: null };
  /**
   * The walk in progress, if any: where it started, when, and how long it
   * takes. pet.x and pet.y already hold where it is heading, because Tilefold
   * glides the drawing there by itself over `ms`.
   */
  let move = null;
  let layout = null;
  let timer = null;
  let bubbleTimer = null;
  let blurTimer = null;
  let paused = false;
  let idleMinutes = 0;

  const rand = (min, max) => min + Math.random() * (max - min);
  const character = () => characterById(tf.settings.get("character"));
  const size = () => {
    const n = Math.round(Number(tf.settings.get("size")));
    return Number.isFinite(n) ? Math.min(96, Math.max(24, n)) : 48;
  };
  const name = () =>
    String(tf.settings.get("name") || "")
      .trim()
      .slice(0, 24) || character().name;
  const chatty = () => tf.settings.get("speech") !== false;
  /** Whether it roams all over its pane (the default) or keeps to the bottom. */
  const roams = () => tf.settings.get("roam") !== "floor";
  /** The character's own message for a moment, or the shared one. */
  const bubble = (moment, key) => character().bubbles[moment] ?? key;

  /** The pane it walks in: the focused one, else the first. */
  const homePane = () =>
    (layout && (layout.panes.find((p) => p.focused) || layout.panes[0])) || null;

  /** The floor of a pane (or the window): where its feet go, and how far it may walk. */
  const floorOf = (pane) => {
    const sz = size();
    if (!pane) {
      const w = layout ? layout.content.w : 800;
      const h = layout ? layout.content.h : 600;
      return { y: h - sz - 30, min: 8, max: Math.max(8, w - sz - 8) };
    }
    const bottom = pane.composer ? pane.composer.y : pane.y + pane.h;
    return {
      y: bottom - sz - 2,
      min: pane.x + 8,
      max: Math.max(pane.x + 8, pane.x + pane.w - sz - 8),
    };
  };

  /** The pane it is in: when roaming, the last one it walked into; else the focused one. */
  const currentPane = () =>
    (roams() && layout && layout.panes.find((p) => p.id === pet.pane)) || homePane();

  /**
   * Where it may stand in a pane: anywhere from just below the pane's top to
   * its floor when roaming, else only on the floor.
   */
  const areaOf = (pane) => {
    const f = floorOf(pane);
    const top = roams() ? (pane ? pane.y + 8 : 8) : f.y;
    return { minX: f.min, maxX: f.max, minY: Math.min(top, f.y), maxY: f.y };
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /**
   * Stops a walk where the pet has got to. Tilefold glides it in a straight
   * line at a steady pace, so the spot is that far along the line. Without
   * this, drawing it with no glide (a pat, a nap...) would make it jump to
   * the end of its walk, which on a long walk is far across the pane.
   */
  const settle = () => {
    if (!move) return;
    const t = move.ms > 0 ? clamp((Date.now() - move.start) / move.ms, 0, 1) : 1;
    pet.x = move.fromX + (pet.x - move.fromX) * t;
    pet.y = move.fromY + (pet.y - move.fromY) * t;
    move = null;
  };

  /** The pane under a point, if any. */
  const paneAt = (x, y) =>
    (layout && layout.panes.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)) ||
    null;

  /** Draws it: pose, place and how long the move takes. */
  const draw = (pose, extra = {}) => {
    const sz = size();
    const poses = posesOf(character());
    const art = poses[pose] ?? poses.idle;
    const item = {
      id: "pet",
      image: art.image,
      sheet: art.sheet,
      x: Math.round(pet.x),
      y: Math.round(pet.y),
      w: sz,
      h: sz,
      flip: pet.flip,
      anim: pose === "sleep" || pose === "idle" ? "breathe" : "none",
      moveMs: 0,
      hit: true,
      cursor: "grab",
      label: name(),
      ...extra,
    };
    return tf.overlay.update({ items: [item] }).catch(() => {});
  };

  /** Shows a short speech bubble for a few seconds. */
  const say = (key, args = {}) => {
    if (!chatty()) return Promise.resolve();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(
      () => void tf.overlay.update({ items: [{ id: "pet", bubble: null }] }).catch(() => {}),
      4000,
    );
    return tf.overlay
      .update({ items: [{ id: "pet", bubble: tf.t(key, { name: name(), ...args }) }] })
      .catch(() => {});
  };

  /** Runs `next` after `ms`, replacing whatever was planned. */
  const later = (ms, next) => {
    clearTimeout(timer);
    timer = paused ? null : setTimeout(() => void next(), ms);
  };

  let revived = false;
  /**
   * A fresh worker after a restart starts with the pet "off" and no
   * app.ready to come: bring it back (unless the user hid it) on the first
   * event it hears.
   */
  const revive = async () => {
    if (revived || pet.state !== "off") return;
    revived = true;
    if ((await tf.store.get("visible")) !== false) await appear();
  };

  /**
   * Wraps an event handler so it returns at once and its work (which waits
   * on the app for every drawing) carries on in the background.
   */
  const background = (fn) => (e) => {
    void (async () => {
      await revive();
      await fn(e);
    })().catch((err) => void tf.log.error(String((err && err.message) || err)).catch(() => {}));
  };
  // Whether it is away on another tab ("Show on" the tab where it was opened).
  const tab = watchTab(tf, background);

  // ------------------------------------------------------------ behaviour
  /** Stands and breathes, then picks what to do next. */
  const idle = async () => {
    pet.state = "idle";
    await draw("idle");
    later(rand(4000, 12000), choose);
  };

  /**
   * Walks at the character's pace to a spot in `pane` (its current one by
   * default): a random one unless given. Mostly-up or mostly-down walks use
   * the character's back or front view when it has them.
   */
  const walk = async (toX, toY, pane = currentPane()) => {
    // A new walk starts from where the pet is now, not from where the last one was going.
    settle();
    const a = areaOf(pane);
    const x = Math.round(clamp(toX ?? rand(a.minX, a.maxX), a.minX, a.maxX));
    const y = Math.round(clamp(toY ?? rand(a.minY, a.maxY), a.minY, a.maxY));
    const dx = x - pet.x;
    const dy = y - pet.y;
    const pace = (character().speed * size()) / 48;
    const ms = Math.min(20000, Math.max(400, (Math.hypot(dx, dy) / pace) * 1000));
    const poses = posesOf(character());
    let pose = "walk";
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0 && poses.walkUp) pose = "walkUp";
      if (dy > 0 && poses.walkDown) pose = "walkDown";
    }
    if (pose === "walk" && Math.abs(dx) >= 1) pet.flip = dx < 0;
    pet.state = "walk";
    move = { fromX: pet.x, fromY: pet.y, start: Date.now(), ms };
    pet.x = x;
    pet.y = y;
    pet.pane = pane ? pane.id : null;
    await draw(pose, { moveMs: ms });
    later(ms, idle);
  };

  /** Now and then a roaming pet wanders into another pane. */
  const wander = () => {
    const others = layout ? layout.panes.filter((p) => p.id !== pet.pane) : [];
    if (!roams() || !others.length || Math.random() >= 0.2) return walk();
    return walk(undefined, undefined, others[Math.floor(Math.random() * others.length)]);
  };

  /** Sits a while: a sitting pose if the character has one, else a blink. */
  const sit = async () => {
    pet.state = "sit";
    if (posesOf(character()).sit) {
      await draw("sit", { anim: "breathe" });
    } else {
      await draw("blink");
      setTimeout(() => {
        if (pet.state === "sit") void draw("idle");
      }, 300);
    }
    later(rand(6000, 20000), choose);
  };

  /** The next thing to do, weighted. */
  const choose = () => {
    if (pet.asleep) return nap();
    const r = Math.random();
    if (r < 0.5) return wander();
    if (r < 0.8) return sit();
    return idle();
  };

  /** Curls up and sleeps until woken. */
  const nap = async () => {
    clearTimeout(timer);
    settle();
    pet.asleep = true;
    pet.state = "sleep";
    await draw("sleep");
  };

  /** Wakes up, stretches, and maybe says hello. */
  const wake = async (greet) => {
    pet.asleep = false;
    await draw("happy", { anim: "bob" });
    if (greet) {
      bark(2);
      await say("bubble-welcome");
    }
    later(1500, idle);
  };

  /** Puts it in its pane, in view: on the floor unless it is roaming and already inside. */
  const place = () => {
    const pane = currentPane();
    const a = areaOf(pane);
    if (!(roams() && pet.y >= a.minY && pet.y <= a.maxY)) pet.y = a.maxY;
    pet.x = clamp(pet.x || rand(a.minX, a.maxX), a.minX, a.maxX);
    pet.pane = pane ? pane.id : null;
  };

  const barkClips = new Map();
  /** Barks `count` times, if the character can and barking is on. */
  const bark = (count) => {
    const c = character();
    if (tf.settings.get("bark") === false || !c.sounds || !c.sounds.bark) return;
    const key = `${c.id}:${count}`;
    if (!barkClips.has(key)) barkClips.set(key, c.sounds.bark(count));
    void tf.sound.play({ src: barkClips.get(key), volume: 0.5 }).catch(() => {});
  };

  /** Shows it, if it isn't on screen yet. */
  const appear = async () => {
    layout = await tf.overlay.layout();
    place();
    const perTab = tf.settings.get("showOn") === "tab";
    const shown = await tf.overlay.show({ items: [], perTab });
    tab.here();
    pet.state = "idle";
    await draw("idle");
    await tf.store.set("visible", true);
    if (shown) later(1500, choose);
  };

  /** Shows it again on the tab in front (or every tab), as "Show on" says. */
  const moveHere = async () => {
    await tf.overlay.hide();
    await appear();
  };

  /** Takes it away. */
  const vanish = async () => {
    clearTimeout(timer);
    settle();
    pet.state = "off";
    await tf.overlay.hide();
    await tf.store.set("visible", false);
  };

  // ------------------------------------------------------------- commands
  // Away on another tab: Show brings it to the tab in front.
  const toggle = async () => (pet.state === "off" ? appear() : tab.away() ? moveHere() : vanish());
  tf.command(tf.t("cmd-toggle"), toggle, {
    id: "toggle",
  });

  tf.command(
    tf.t("cmd-call"),
    async () => {
      if (pet.state === "off") await appear();
      if (pet.asleep) await wake(false);
      const pane = homePane();
      const f = floorOf(pane);
      // To the middle of the floor of the pane you're working in.
      await walk(pane ? pane.x + pane.w / 2 - size() / 2 : (f.min + f.max) / 2, f.y, pane);
    },
    { id: "call" },
  );

  tf.command(
    tf.t("cmd-nap"),
    async () => {
      if (pet.state === "off") await appear();
      return pet.asleep ? wake(false) : nap();
    },
    { id: "nap" },
  );

  // --------------------------------------------------------------- events
  // Starting with Tilefold is what revive() does for a fresh worker.
  tf.on(
    "app.ready",
    background(async () => {}),
  );

  tf.on(
    "setting.changed",
    background(async (e) => {
      const key = e && e.key;
      if (key === "character") await tf.audit("character", { character: character().id });
      if (key === "showOn" && pet.state !== "off") return moveHere();
      if (pet.state === "off" || pet.state === "held") return;
      if (!["character", "size", "name", "roam"].includes(key)) return;
      settle();
      place();
      if (pet.asleep) return void (await draw("sleep"));
      pet.state = "idle";
      await draw("idle");
      later(1500, choose);
    }),
  );

  tf.on(
    "overlay.layout",
    background((next) => {
      layout = next;
      if (pet.state === "off" || pet.state === "held") return undefined;
      // Checked against where it is heading: a walk still under way is left
      // to finish unless that spot is no longer in its area.
      const a = areaOf(currentPane());
      const inside = pet.x >= a.minX && pet.x <= a.maxX && pet.y >= a.minY && pet.y <= a.maxY;
      if (inside && (roams() || Math.abs(pet.y - a.maxY) < 1)) return undefined;
      settle();
      place();
      return draw(pet.asleep ? "sleep" : "idle");
    }),
  );

  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.item !== "pet" || pet.state === "off") return;
      const sz = size();
      // Whatever the pointer does, the pet stays where it is on screen right now.
      if (e.type !== "drag" && e.type !== "drop") settle();
      if (e.type === "click") {
        if (pet.asleep) return wake(true);
        pet.state = "happy";
        bark(1);
        await draw("happy", { anim: "bob" });
        await say(bubble("pat", "bubble-pat"));
        await tf.audit("pat", {});
        later(1500, idle);
      } else if (e.type === "dblclick") {
        pet.asleep = false;
        pet.state = "play";
        bark(2);
        await draw("happy", { anim: "bounce" });
        await say(bubble("play", "bubble-play"));
        await tf.audit("play", {});
        later(2500, idle);
      } else if (e.type === "dragstart") {
        clearTimeout(timer);
        pet.state = "held";
        pet.asleep = false;
        await draw("happy", { anim: "shake" });
        await say(bubble("held", "bubble-held"));
      } else if (e.type === "drag" && pet.state === "held") {
        pet.x = e.x - sz / 2;
        pet.y = e.y - sz / 2;
        await draw("happy", { anim: "shake" });
      } else if (e.type === "drop" && pet.state === "held") {
        // Roaming, it stays where it was let go; otherwise it lands on the floor.
        const pane = paneAt(e.x, e.y) || homePane();
        const a = areaOf(pane);
        pet.x = clamp(e.x - sz / 2, a.minX, a.maxX);
        pet.y = roams() ? clamp(e.y - sz / 2, a.minY, a.maxY) : a.maxY;
        pet.pane = pane ? pane.id : null;
        pet.state = "idle";
        await draw("idle", { moveMs: 300 });
        later(1500, choose);
      }
    }),
  );

  tf.on(
    "overlay.hidden",
    background(async (e) => {
      clearTimeout(timer);
      // Its tab closed: it goes with it.
      if (e && e.by === "tab") await vanish();
    }),
  );

  tf.on(
    "user.idle",
    background(async (e) => {
      idleMinutes = e && Number(e.minutes) ? Number(e.minutes) : idleMinutes;
      const after = Math.round(Number(tf.settings.get("sleepAfterIdle")));
      if (pet.state === "off" || pet.asleep) return;
      if (idleMinutes >= (Number.isFinite(after) && after >= 1 ? after : 5)) await nap();
    }),
  );

  tf.on(
    "user.active",
    background(async () => {
      const away = idleMinutes;
      idleMinutes = 0;
      if (pet.state !== "off" && pet.asleep) await wake(away >= 30);
    }),
  );

  // A minute after Tilefold loses focus it stops planning; it picks up on return.
  tf.on(
    "window.blurred",
    background(() => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        paused = true;
        clearTimeout(timer);
      }, 60000);
    }),
  );

  tf.on(
    "window.focused",
    background(() => {
      clearTimeout(blurTimer);
      if (!paused) return undefined;
      paused = false;
      if (pet.state === "off" || pet.asleep || pet.state === "held") return undefined;
      return idle();
    }),
  );
}
