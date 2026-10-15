/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the card over the panes
 *
 * Keeps the card's state and draws it with `tf.overlay`: what the page
 * last reported (`status`: the video, playing or paused, where it is,
 * muted), whether the recent list is open, and where the panes are. The
 * card's buttons play or pause, skip ten seconds back or forward, mute,
 * open the recent list (a click on a video plays it) and bring the
 * video's window forward; a click on the card does that too. The video
 * itself always plays in its window, which YouTube asks to stay visible.
 *
 * A redraw that keeps the same items only updates them (the progress
 * moves every second while a video plays); opening or closing the list
 * draws the scene again. Pictures arrive later than the status and draw
 * the card again when they do.
 */
import { actionForClick, BUTTONS, renderButton } from "../render/buttons.js";
import { clock, renderCard } from "../render/card.js";
import { listHit, LIST_ROWS, renderList } from "../render/list.js";
import { computeLayout } from "./scene.js";
import { createThumbs } from "./thumbs.js";

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
 * `isOpen()` whether the window is open, `corner()` the corner setting.
 */
export function createCard(tf, hooks) {
  const thumbs = createThumbs(tf.net ? (url, init) => tf.net.fetch(url, init) : null);
  let visible = false;
  let listOpen = false;
  let status = null;
  let layout = null;
  /** The item ids drawn last, to tell an update from a new scene. */
  let drawn = "";

  const t = (key, args) => tf.t(key, args);

  /** Every item of the scene. */
  const items = () => {
    const rects = computeLayout(layout, hooks.corner(), { list: listOpen });
    const thumb = status ? thumbs.peek(status.id) : null;
    if (status && thumb === undefined) {
      // The picture comes later; the card is drawn again when it does.
      void thumbs.get(status.id).then(() => draw());
    }
    const state = { playing: !!status?.playing, muted: !!status?.muted, listOpen };
    const out = [
      {
        id: "card",
        image: renderCard(cardView(t, status, hooks.recent(), thumb)),
        ...rects.card,
        hit: true,
        cursor: "pointer",
        label: t("button-window"),
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
    if (listOpen) {
      out.push({
        id: "list",
        image: renderList({
          heading: t("list-heading"),
          empty: t("list-empty"),
          videos: hooks.recent(),
          current: status?.id ?? null,
        }),
        ...rects.list,
        hit: true,
        cursor: "pointer",
        label: t("button-list"),
      });
    }
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
    if (action === "window") return hooks.openWindow();
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
      await draw();
    },
    /** The recent list or a setting changed. */
    redraw: () => draw(),
    /** The panes moved. */
    async moved(next) {
      if (next && typeof next === "object") layout = next;
      await draw();
    },
    /** A pointer event on one of the card's items. */
    async pointer(e) {
      if (!visible || e?.type !== "click") return;
      if (e.item === "card") return hooks.openWindow();
      if (e.item === "list") {
        const rect = computeLayout(layout, hooks.corner(), { list: true }).list;
        const videos = hooks.recent().slice(0, LIST_ROWS);
        const row = listHit(rect, Number(e.x), Number(e.y), videos.length);
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
