/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board — pipeline status
 *
 * GitLab has a dozen pipeline statuses; the board needs six groups, each
 * with a colour, a message and whether it is still going. It also works
 * out which pipelines finished since the last check, for the notice, and
 * how long ago a pipeline last changed. Pure.
 */

/** The group of each GitLab status. */
const GROUP_OF = {
  created: "pending",
  waiting_for_resource: "pending",
  preparing: "pending",
  pending: "pending",
  scheduled: "pending",
  running: "running",
  success: "success",
  failed: "failed",
  canceled: "canceled",
  canceling: "canceled",
  skipped: "canceled",
  manual: "manual",
};

/** Colour and message of each group, spelled out so the keys can be found. */
export const GROUPS = Object.freeze({
  running: { color: "#3b82f6", text: "status-running" },
  pending: { color: "#a1a1aa", text: "status-pending" },
  success: { color: "#22c55e", text: "status-success" },
  failed: { color: "#ef4444", text: "status-failed" },
  canceled: { color: "#71717a", text: "status-canceled" },
  manual: { color: "#a855f7", text: "status-manual" },
});

/**
 * The group of a status ("pending" for one GitLab adds later).
 *
 * @param {unknown} status
 * @returns {keyof typeof GROUPS}
 */
export function groupOf(status) {
  return /** @type {any} */ (GROUP_OF[/** @type {string} */ (status)] ?? "pending");
}

/** True while a pipeline is still going (so it is worth checking often). */
export function isActive(status) {
  const g = groupOf(status);
  return g === "running" || g === "pending";
}

/**
 * Pipelines that were going at the last check and have finished now, as
 * `{ iid, ref, group }`. A pipeline seen for the first time never counts:
 * the board doesn't announce what finished while it wasn't looking.
 *
 * @param {Map<number, string>} before Status by pipeline id at the last check.
 * @param {{ id: number, iid: number, ref: string, status: string }[]} now
 * @returns {{ iid: number, ref: string, group: string }[]}
 */
export function finishedSince(before, now) {
  const out = [];
  for (const p of now) {
    const was = before.get(p.id);
    if (was === undefined || !isActive(was) || isActive(p.status)) continue;
    out.push({ iid: p.iid, ref: p.ref, group: groupOf(p.status) });
  }
  return out;
}

/**
 * How long ago a time was, as a message key and a number.
 *
 * @param {string} iso
 * @param {number} now Milliseconds since 1970.
 * @returns {{ key: string, n: number }}
 */
export function ageOf(iso, now) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return { key: "age-unknown", n: 0 };
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return { key: "age-now", n: 0 };
  if (minutes < 60) return { key: "age-minutes", n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: "age-hours", n: hours };
  return { key: "age-days", n: Math.floor(hours / 24) };
}
