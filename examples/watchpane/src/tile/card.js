/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the card over the panes
 *
 * Keeps the card's state and draws it with `tf.overlay`: what the page
 * last reported (`status`: the video, playing or paused, where it is,
 * muted), whether the recent list is open, where the panes are, and where
 * the user dragged the player (mover.js). The buttons play or pause, skip
 * ten seconds back or forward, mute, open the recent list (a click on a
 * video plays it), and open or close the video.
 *
 * Where Tilefold can dock a page in its window (0.1.11), the video plays
 * docked over the panes, with the controls in one dock right under it,
 * as wide as the video, and the recent list beside them (scene.js). The
 * card works out the video's spot (`videoSpot`) and moves the page there
 * whenever the panes move, or the user drags the dock; a click on the
 * dock outside its buttons shows the box to paste a link. Without a
 * docked video the small card shows instead, with its own row of
 * buttons; a click on it shows the video. Elsewhere (older Tilefolds)
 * the video plays in a window of its own, which a click on the card
 * brings forward. Either way the video stays visible, as YouTube asks.
 *
 * A redraw that keeps the same items only updates them (the progress
 * moves every second while a video plays); opening or closing the list
 * draws the scene again. Pictures arrive later than the status and draw
 * the card again when they do.
 */
import { actionForClick, BUTTONS, renderButton } from "../render/buttons.js";
import { clock, renderCard } from "../render/card.js";
import { dockHit, renderDock } from "../render/dock.js";
import { listHit, renderList } from "../render/list.js";
import { createMover } from "./mover.js";
import { computeLayout, groupSize, listRows } from "./scene.js";
import { createThumbs } from "./thumbs.js";

/** The overlay items a drag of the player starts on. */
export const HANDLES = ["card", "dock-l", "dock-r"];

/** What the page reports, cleaned: or null for anything malformed. */
export function cleanStatus(m) {
  if (!m || typeof m !== "object" || typeof m.id !== "string") return null;
  const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    id: m.id,
    title: typeof m.title === "string" ? m.title.slice(0, 200) : "",
    playing: m.playing === true,
    time: n(m.time),
    duration: n(m.duration),
    muted: m.muted === true,
  };
}

/** The card's view: the video on now, or a message. */
export function cardView(t, status, recent, thumb) {
  if (!status)
    return { mode: "message", tone: "info", title: t("card-idle"), hint: t("card-idle-hint") };
  const known = recent.find((v) => v.id === status.id);
  const where = status.duration
    ? `${clock(status.time)} / ${clock(status.duration)}`
    : clock(status.time);
  const line = status.playing ? where : t("card-paused", { time: where });
  return {
    mode: "video",
    title: status.title || known?.title || status.id,
    detail: status.muted ? t("card-muted", { line }) : line,
    progress: status.duration ? status.time / status.duration : 0,
    playing: status.playing,
    thumb: thumb ?? null,
  };
}

/**
 * The card for `tf`. `hooks`: `post(message)` to the page, `openWindow()`
 * shows (or brings forward) the video's window, `play(id)` plays a video
 * (opening the window when needed), `recent()` the videos watched lately,
 * `isOpen()` whether the window is open, `corner()` the corner setting,
 * `docked()` whether the video is docked, `redock(spot)` moves it,
 * `closeWindow()` stops it, `paste()` shows the docked page's link box.
 */
export function createCard(tf, hooks) {
  const thumbs = createThumbs(tf.net ? (url, init) => tf.net.fetch(url, init) : null);
  let visible = false;
  let listOpen = false;
  let status = null;
  let layout = null;
  /** The item ids drawn last, to tell an update from a new scene. */
  let drawn = "";
  /** The docked video's spot as last sent, to send only changes. */
  let docked = "";

  const t = (key, args) => tf.t(key, args);

  const mover = createMover({
    tf,
    handles: HANDLES,
    layout: () => layout,
    size: () => groupSize(hooks.docked()),
    origin: () => rectsNow().group,
    redraw: () => draw(),
  });

  /** Every rectangle of the scene as it is now (`list` overrides whether the list is open). */
  const rectsNow = (list = listOpen) =>
    computeLayout(layout, hooks.corner(), {
      list,
      video: hooks.docked(),
      position: mover.position(),
    });

  /** The recent list's item, at `rect`, with `rows` rows. */
  const listItem = (rect, rows) => ({
    id: "list",
    image: renderList(
      {
        heading: t("list-heading"),
        empty: t("list-empty"),
        videos: hooks.recent(),
        current: status?.id ?? null,
      },
      { rows },
    ),
    ...rect,
    hit: true,
    cursor: "pointer",
    label: t("button-list"),
  });

  /** The player's items: the dock's two halves under the video, and the list. */
  const playerItems = (rects, state) => {
    const view = cardView(t, status, hooks.recent(), null);
    // Nothing on yet: the hint points at the dock, not the card.
    if (view.mode === "message") view.hint = t("dock-idle-hint");
    const halves = renderDock(view, state);
    const out = ["dock-l", "dock-r"].map((id) => ({
      id,
      image: id === "dock-l" ? halves.left : halves.right,
      ...rects[id],
      hit: true,
      cursor: "pointer",
      label: t("dock-label"),
    }));
    if (listOpen) out.push(listItem(rects.list, listRows(true)));
    return out;
  };

  /** Every item of the scene. */
  const items = () => {
    const rects = rectsNow();
    if (rects.video && JSON.stringify(rects.video) !== docked) {
      docked = JSON.stringify(rects.video);
      void Promise.resolve(hooks.redock(rects.video)).catch(() => {});
    }
    const state = { playing: !!status?.playing, muted: !!status?.muted, listOpen };
    if (rects.video) return playerItems(rects, state);
    const thumb = status ? thumbs.peek(status.id) : null;
    if (status && thumb === undefined) {
      // The picture comes later; the card is drawn again when it does.
      void thumbs.get(status.id).then(() => draw());
    }
    const out = [
      {
        id: "card",
        image: renderCard(cardView(t, status, hooks.recent(), thumb)),
        ...rects.card,
        hit: true,
        cursor: "pointer",
        label: t("card-idle-hint"),
      },
      ...BUTTONS.map((b) => ({
        id: `btn-${b.id}`,
        image: renderButton(b.id, state),
        ...rects[`btn-${b.id}`],
        hit: true,
        cursor: "pointer",
        label: t(b.label),
      })),
    ];
    if (listOpen) out.push(listItem(rects.list, listRows(false)));
    return out;
  };

  /** Draws the card (only while it is shown). */
  const draw = async () => {
    if (!visible) return;
    if (!layout) layout = await tf.overlay.layout();
    const scene = items();
    const ids = scene.map((i) => i.id).join(",");
    if (ids === drawn) await tf.overlay.update({ items: scene });
    else {
      drawn = ids;
      await tf.overlay.show({ items: scene });
    }
  };

  /** Runs a button's action. */
  const act = async (action) => {
    if (action === "list") {
      listOpen = !listOpen;
      return draw();
    }
    if (action === "window") return hooks.isOpen() ? hooks.closeWindow() : hooks.openWindow();
    // Playback needs the window: open it (it plays the last video) if it's closed.
    if (!hooks.isOpen()) return hooks.openWindow();
    const control = action === "mute" ? (status?.muted ? "unmute" : "mute") : action;
    return hooks.post({ do: "control", action: control });
  };

  return {
    /** Whether the card is shown. */
    get visible() {
      return visible;
    },
    /** Shows the card. */
    async show() {
      if (visible) return;
      visible = true;
      drawn = "";
      layout = null;
      await mover.load();
      void tf.audit("card.shown", {}).catch(() => {});
      await draw();
    },
    /** Hides the card (`byUser`: the user hid the overlays). */
    async hide(byUser = false) {
      if (!visible) return;
      visible = false;
      listOpen = false;
      void tf.audit("card.hidden", { byUser }).catch(() => {});
      if (!byUser) await tf.overlay.hide();
    },
    /** What the page reported about the player. */
    async status(message) {
      const next = cleanStatus(message);
      if (!next) return;
      status = next;
      await draw();
    },
    /** The window closed: the video stopped. */
    async stopped() {
      status = null;
      docked = "";
      await draw();
    },
    /** Where the docked video goes now (the card's layout read first if needed). */
    async videoSpot() {
      if (!layout) layout = await tf.overlay.layout();
      await mover.load();
      return computeLayout(layout, hooks.corner(), { video: true, position: mover.position() })
        .video;
    },
    /** Puts a dragged player back in the pane's corner (`via`: "command" or "corner"). */
    reset: (via) => mover.reset(via),
    /** The recent list or a setting changed. */
    redraw: () => draw(),
    /** The panes moved. */
    async moved(next) {
      if (next && typeof next === "object") layout = next;
      await draw();
    },
    /** A pointer event on one of the card's items. */
    async pointer(e) {
      if (!visible || !e) return;
      if (await mover.pointer(e)) return;
      if (e.type !== "click") return;
      if (e.item === "card") {
        return hooks.docked() && hooks.isOpen() ? hooks.paste() : hooks.openWindow();
      }
      if (e.item === "dock-l" || e.item === "dock-r") {
        const action = dockHit(rectsNow().dock, Number(e.x), Number(e.y));
        if (action === "paste") return hooks.paste();
        if (action) await act(action);
        return;
      }
      if (e.item === "list") {
        const rows = listRows(hooks.docked());
        const rect = rectsNow(true).list;
        const videos = hooks.recent().slice(0, rows);
        const row = listHit(rect, Number(e.x), Number(e.y), videos.length, rows);
        if (row === null) return;
        listOpen = false;
        await draw();
        return hooks.play(videos[row].id);
      }
      const action = actionForClick(String(e.item));
      if (action) await act(action);
    },
    /** A palette command: one of the buttons' actions. */
    run: (action) => act(action),
  };
}
