/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — overlay view
 *
 * Turns the session into the overlay scene Tilefold draws: six items (the
 * card, four buttons and the volume control), plus the playlist panel
 * while it is open,
 * each with its picture, rectangle, spoken label and click settings.
 * `sceneItems` builds the full scene; `diffItems` keeps only what changed
 * since the last frame, so the progress bar moving resends just the card
 * and leaves the buttons alone, and `removedIds` names the items that are
 * gone (the panel, when it closes).
 *
 * Pure: everything it needs — state, playback, settings, layout and
 * labels — is passed in.
 *
 * Modified 2026-10-14 (the scene takes where the user dragged the card).
 *
 * Last updated by: Tilefold
 */
import { BUTTONS, iconFor, renderButton, renderVolume } from "../render/buttons.js";
import { renderCard } from "../render/card.js";
import { renderPanel } from "../render/panel.js";
import { computeLayout } from "./scene.js";
import { CONTROL_STATES } from "./session.js";

/** Item ids. */
export const CARD_ID = "card";
export const PANEL_ID = "panel";
export const VOLUME_ID = "btn-volume";
/** Title and hint for each status card, spelled out so the keys can be found. */
const STATE_TEXT = {
  "no-network": ["state-no-network", "state-no-network-hint"],
  denied: ["state-denied", "state-denied-hint"],
  "signed-out": ["state-signed-out", "state-signed-out-hint"],
  connecting: ["state-connecting", "state-connecting-hint"],
  "no-device": ["state-no-device", "state-no-device-hint"],
  premium: ["state-premium", "state-premium-hint"],
  error: ["state-error", "state-error-hint"],
};

export const buttonId = (id) => `btn-${id}`;

/** The fields compared between frames (id is the key, never compared). */
const FIELDS = ["image", "x", "y", "w", "h", "label", "hit", "cursor", "opacity"];

/** The tone of each state's message card. */
export const TONE = Object.freeze({
  "no-network": "warn",
  denied: "warn",
  "signed-out": "info",
  connecting: "info",
  "no-device": "info",
  premium: "warn",
  error: "error",
  playing: "info",
  paused: "info",
});

/** The longest spoken label Tilefold keeps. */
const MAX_LABEL = 80;

/**
 * What the card shows: the track while playing or paused, else the state's
 * title and hint.
 *
 * @param {{ status: string, playback: any, progressMs: number,
 *           t: (key: string, args?: object) => string }} input
 * @returns {any} A view for `renderCard`.
 */
export function cardView(input) {
  const { status, playback, t } = input;
  if ((status === "playing" || status === "paused") && playback) {
    const device = playback.device ? t("card-on-device", { device: playback.device }) : "";
    const detail =
      status === "paused" ? [t("card-paused"), device].filter(Boolean).join(" · ") : device;
    // The volume is shown on its own, so a long device name never cuts it off.
    const volume =
      playback.volume === null
        ? ""
        : playback.volume === 0
          ? t("card-muted")
          : t("card-volume", { volume: playback.volume });
    return {
      mode: "track",
      title: playback.title || t("card-unknown-title"),
      artists: playback.artists.join(", "),
      detail,
      volume,
      progress: playback.durationMs > 0 ? input.progressMs / playback.durationMs : 0,
      playing: status === "playing",
    };
  }
  return {
    mode: "message",
    tone: TONE[status] ?? "info",
    title: t((STATE_TEXT[status] ?? STATE_TEXT.error)[0]),
    hint: t((STATE_TEXT[status] ?? STATE_TEXT.error)[1]),
  };
}

/**
 * The card's spoken label.
 *
 * @param {any} view What {@link cardView} returned.
 * @param {(key: string, args?: object) => string} t
 * @returns {string}
 */
export function cardLabel(view, t) {
  const text =
    view.mode === "track"
      ? t(view.playing ? "card-label-playing" : "card-label-paused", {
          title: view.title,
          artists: view.artists,
        })
      : `${view.title}. ${view.hint}`;
  return text.slice(0, MAX_LABEL);
}

/**
 * The full scene.
 *
 * @param {{
 *   status: string,
 *   playback: any,
 *   progressMs: number,
 *   settings: { size: string, corner: string },
 *   layout: any,
 *   t: (key: string, args?: object) => string,
 *   panel?: any,
 *   position?: { fx: number, fy: number } | null,
 * }} input `panel` is what the open panel shows (null or left out: closed);
 *   `position` is where the user dragged the card (null or left out: the pane's corner).
 * @returns {object[]} Overlay items.
 */
export function sceneItems(input) {
  const { status, playback, settings, t } = input;
  const panel = input.panel ?? null;
  const rects = computeLayout(input.layout, settings, {
    panel: panel !== null,
    position: input.position ?? null,
  });
  const view = cardView(input);
  const card = rects[CARD_ID];
  const playing = status === "playing";
  const canControl = CONTROL_STATES.includes(status);

  const items = [
    {
      id: CARD_ID,
      image: renderCard(view, { displayW: card.w, displayH: card.h }),
      ...card,
      hit: true,
      cursor: "pointer",
      label: cardLabel(view, t),
    },
  ];
  for (const b of BUTTONS) {
    const r = rects[buttonId(b.id)];
    // Volume needs a device whose volume Spotify reported.
    const isVolume = b.id === "volume";
    // The playlists button works whatever plays; the others need a device.
    const dim =
      b.id !== "playlists" &&
      (!canControl || (isVolume && !(playback && playback.volume !== null)));
    const label = b.id === "play" && playing ? t("button-pause") : t(b.label);
    items.push({
      id: buttonId(b.id),
      image: isVolume
        ? renderVolume({ displayW: r.w, displayH: r.h, dim, muted: playback?.volume === 0 })
        : renderButton(iconFor(b.id, playing), {
            displaySize: r.w,
            dim,
            on: b.id === "playlists" && panel !== null,
          }),
      ...r,
      hit: true,
      cursor: "pointer",
      label: label.slice(0, MAX_LABEL),
    });
  }
  if (panel) {
    const r = rects[PANEL_ID];
    items.push({
      id: PANEL_ID,
      image: renderPanel(panel, { displayW: r.w, displayH: r.h }),
      ...r,
      hit: true,
      cursor: "pointer",
      label: String(panel.label ?? "").slice(0, MAX_LABEL),
    });
  }
  return items;
}

/**
 * The ids of items in `prev` that `next` no longer has.
 *
 * @param {object[]|null} prev
 * @param {object[]} next
 * @returns {string[]}
 */
export function removedIds(prev, next) {
  const kept = new Set(next.map((i) => i.id));
  return (prev ?? []).map((i) => i.id).filter((id) => !kept.has(id));
}

/**
 * What changed between two scenes: for each item that differs, its id and
 * only the fields that differ. Items missing from `prev` are sent whole.
 *
 * @param {object[]|null} prev
 * @param {object[]} next
 * @returns {object[]}
 */
export function diffItems(prev, next) {
  const before = new Map((prev ?? []).map((i) => [i.id, i]));
  const out = [];
  for (const item of next) {
    const old = before.get(item.id);
    if (!old) {
      out.push(item);
      continue;
    }
    const change = { id: item.id };
    let any = false;
    for (const f of FIELDS) {
      if (item[f] !== old[f]) {
        change[f] = item[f];
        any = true;
      }
    }
    if (any) out.push(change);
  }
  return out;
}

/**
 * The action a click on an item asks for: the card refreshes, each button
 * runs its own action. The panel's and the volume control's clicks depend
 * on where they land, so the tile decodes them itself (`panelHit`,
 * `volumeHit`).
 *
 * @param {string} itemId
 * @returns {string|null}
 */
export function actionForClick(itemId) {
  if (itemId === CARD_ID) return "refresh";
  const b = BUTTONS.find((x) => buttonId(x.id) === itemId);
  return b ? b.action : null;
}
