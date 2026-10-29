/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — what an agent's action adds to a row
 *
 * Shared by the panel's tree, its "Now" section and its "Recent" footer:
 * text cut to Tilefold's limits, short ages ("12s", "5m"), and the colour,
 * pulse, pane badge, age and tooltip an agent's action gives a file's row.
 */
import { age, TONES } from "./activity.js";

/** `text` cut to `max` characters (Tilefold's limits), with "…" when cut. */
export function clamp(text, max) {
  const chars = [...String(text)];
  return chars.length <= max ? String(text) : `${chars.slice(0, max - 1).join("")}…`;
}

/** Message keys, written out so each can be found in the code. */
const AGO_KEYS = { s: "ago-s", m: "ago-m", h: "ago-h", d: "ago-d" };
const HINT_KEYS = { r: "hint-r", e: "hint-e", a: "hint-a", d: "hint-d" };
export const NOW_KEYS = { r: "now-r", e: "now-e", a: "now-a", d: "now-d" };

/** A short age, such as "12s" or "5m". */
export const agoText = (t, ms) => {
  const { unit, n } = age(ms);
  return t(AGO_KEYS[unit], { n });
};

/** The tooltip for an action: who did what, how long ago, and the path. */
const activityHint = (t, e, now, path) =>
  clamp(
    `${t(HINT_KEYS[e.action] ?? HINT_KEYS.e, { pane: e.pane, ago: agoText(t, now - e.ts) })}\n${path}`,
    512,
  );

/** What an event adds to a file's row. */
export const marked = (t, e, now, { pulse, path }) => ({
  tone: TONES[e.action] ?? "warning",
  ...(pulse ? { pulse: true, badge: e.pane } : {}),
  trail: agoText(t, now - e.ts),
  hint: activityHint(t, e, now, path),
});
