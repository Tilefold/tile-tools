/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree's window — wording
 *
 * Fills the tile's strings ("§", "§1"… mark where values go) and turns
 * times into short ages ("12s", "5m"), so the window can keep ages
 * ticking without asking the tile. No DOM here, so it is tested directly.
 */

/** `text` with "§" (or "§1", "§2"…) replaced by `values` in order. */
export function fill(text, ...values) {
  let i = 0;
  return String(text ?? "").replace(/§(\d)?/g, (_, n) =>
    String(values[n ? Number(n) - 1 : i++] ?? ""),
  );
}

/** How long ago `ts` was, at `now`, in the strings' short form. */
export function ago(strings, ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  const forms = strings?.ago ?? {};
  if (s < 60) return fill(forms.s ?? "§s", s);
  if (s < 3600) return fill(forms.m ?? "§m", Math.floor(s / 60));
  if (s < 86400) return fill(forms.h ?? "§h", Math.floor(s / 3600));
  return fill(forms.d ?? "§d", Math.floor(s / 86400));
}

/** The class an action takes ("read", "edit", "add", "delete"). */
export const ACTION_CLASS = Object.freeze({ r: "read", e: "edit", a: "add", d: "delete" });

/** Recent files shown before "Show all". */
export const RECENT_FEW = 5;

/** The recent list as shown: the first few, or all of them. */
export const shownRecent = (recent, all) => (all ? recent : recent.slice(0, RECENT_FEW));
