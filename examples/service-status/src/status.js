/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Service Status — reading a status page. A plain module: it knows nothing
 * about Tilefold, so it is easy to test on its own.
 *
 * GitHub's status page (like most Atlassian Statuspage sites) answers
 * `/api/v2/status.json` with `{ status: { indicator, description } }`,
 * where the indicator is "none", "minor", "major" or "critical".
 */

/** The page this example reads. Its host is the tile's `net:` permission. */
export const STATUS_URL = "https://www.githubstatus.com/api/v2/status.json";

/** The message key for each indicator the page is known to send. */
const KEYS = {
  none: "status-none",
  minor: "status-minor",
  major: "status-major",
  critical: "status-critical",
};

/** The longest description shown; the rest is cut. */
const MAX_DESCRIPTION = 120;

/**
 * The status from the page's JSON, or null when it doesn't look like a
 * status answer.
 *
 * @param {unknown} json
 * @returns {{ indicator: string, description: string } | null}
 */
export function parseStatus(json) {
  const status = json && typeof json === "object" ? json.status : null;
  if (!status || typeof status !== "object") return null;
  const { indicator, description } = status;
  if (typeof indicator !== "string" || !indicator) return null;
  return {
    indicator,
    description:
      typeof description === "string" ? description.trim().slice(0, MAX_DESCRIPTION) : "",
  };
}

/**
 * The message key that describes `indicator` (an unknown one gets a
 * neutral message that quotes the page).
 *
 * @param {string} indicator
 * @returns {string}
 */
export function statusKey(indicator) {
  return Object.hasOwn(KEYS, indicator) ? KEYS[indicator] : "status-unknown";
}

/**
 * The message key for an error `tf.net.fetch` threw. Tilefold names its
 * errors, so a tile can tell "not allowed" from "offline" without parsing
 * messages.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function errorKey(err) {
  switch (err && typeof err === "object" ? err.name : "") {
    case "PermissionDeniedError":
    case "NetworkPolicyError":
      return "error-denied";
    case "RateLimitError":
      return "error-rate";
    default:
      // TimeoutError, NetworkError, TooLargeError and anything unexpected.
      return "error-failed";
  }
}
