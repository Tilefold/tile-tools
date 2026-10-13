/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * GitHub Inbox — the GitHub side. A plain module: it builds the request
 * and reads the answer, and knows nothing about Tilefold or the token
 * (Tilefold adds the token itself), so it is easy to test on its own.
 */

/** How many notifications one check reads (GitHub's page size). */
export const PAGE_SIZE = 50;

/** The longest notification title shown; the rest is cut. */
const MAX_TITLE = 80;

/** Headers GitHub's REST API asks for. Never an Authorization header here. */
export const HEADERS = Object.freeze({
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
});

/**
 * The address of the unread notifications, optionally only those of
 * threads the user takes part in.
 *
 * @param {boolean} participating
 * @returns {string}
 */
export function notificationsUrl(participating) {
  const query = new URLSearchParams({ per_page: String(PAGE_SIZE) });
  if (participating) query.set("participating", "true");
  return `https://api.github.com/notifications?${query}`;
}

/**
 * What a page of notifications says: how many, whether there may be more
 * than one page, and the newest one's title. Null when it isn't a list.
 *
 * @param {unknown} json
 * @returns {{ count: number, more: boolean, newest: string } | null}
 */
export function summarize(json) {
  if (!Array.isArray(json)) return null;
  // GitHub lists the most recently updated first.
  const first = json[0];
  const title = first && first.subject && typeof first.subject.title === "string";
  return {
    count: json.length,
    more: json.length >= PAGE_SIZE,
    newest: title ? first.subject.title.trim().slice(0, MAX_TITLE) : "",
  };
}

/**
 * The message key for a notice about `summary`.
 *
 * @param {{ count: number, more: boolean }} summary
 * @returns {string}
 */
export function summaryKey(summary) {
  if (summary.count === 0) return "inbox-none";
  return summary.more ? "inbox-many" : "inbox-some";
}

/**
 * The message key for an answer GitHub gave with an error status.
 *
 * @param {number} status
 * @returns {string}
 */
export function statusKey(status) {
  // 401: the token is wrong or expired; 403: it lacks the notifications scope.
  if (status === 401 || status === 403) return "error-token";
  return "error-failed";
}

/**
 * The message key for an error `tf.net.fetch` threw, by the error's name.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function errorKey(err) {
  switch (err && typeof err === "object" ? err.name : "") {
    case "CredentialMissingError":
      // The user removed the token, or it was never entered.
      return "error-no-token";
    case "CredentialStoreError":
      return "error-keychain";
    case "PermissionDeniedError":
    case "NetworkPolicyError":
      return "error-denied";
    case "RateLimitError":
      return "error-rate";
    default:
      return "error-failed";
  }
}
