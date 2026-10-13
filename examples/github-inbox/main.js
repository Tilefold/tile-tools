/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * GitHub Inbox (example tile)
 *
 * A tile that uses an API key without ever seeing it. tile.json declares
 * a credential named "github" (`auth`, type `apiKey`): the header it goes
 * in, its scheme and the one host it may be sent to, which is also a
 * `net:` permission. The user pastes their token under Keys on the tile's
 * card in Settings → Tiles; Tilefold keeps it in the system keychain and
 * adds `Authorization: Bearer <token>` to requests that name it with
 * `{ auth: "github" }`. The tile only learns whether a token is set
 * (`tf.auth.has`).
 *
 * Shown on purpose:
 * - checking `tf.auth.has` first, so a missing token gets a helpful notice
 *   instead of a failed request;
 * - telling "the token is missing" (CredentialMissingError, thrown by
 *   Tilefold) from "GitHub refused the token" (a 401 or 403 answer);
 * - the command starts the work and returns at once;
 * - the activity record holds the count, never notification titles.
 *
 * Build:  npx @tilefold/tile-tools build
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/notifications.js
var PAGE_SIZE = 50;
var MAX_TITLE = 80;
var HEADERS = Object.freeze({
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28"
});
function notificationsUrl(participating) {
  const query = new URLSearchParams({ per_page: String(PAGE_SIZE) });
  if (participating) query.set("participating", "true");
  return `https://api.github.com/notifications?${query}`;
}
function summarize(json) {
  if (!Array.isArray(json)) return null;
  const first = json[0];
  const title = first && first.subject && typeof first.subject.title === "string";
  return {
    count: json.length,
    more: json.length >= PAGE_SIZE,
    newest: title ? first.subject.title.trim().slice(0, MAX_TITLE) : ""
  };
}
function summaryKey(summary) {
  if (summary.count === 0) return "inbox-none";
  return summary.more ? "inbox-many" : "inbox-some";
}
function statusKey(status) {
  if (status === 401 || status === 403) return "error-token";
  return "error-failed";
}
function errorKey(err) {
  switch (err && typeof err === "object" ? err.name : "") {
    case "CredentialMissingError":
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

// src/main.js
var CREDENTIAL = "github";
var main_default = (tf) => {
  let busy = false;
  async function check() {
    if (busy) return;
    busy = true;
    try {
      if (!tf.net || !tf.auth) {
        await tf.toast(tf.t("error-no-network"));
        return;
      }
      if (!await tf.auth.has(CREDENTIAL)) {
        await tf.toast(tf.t("error-no-token"));
        return;
      }
      let res;
      try {
        res = await tf.net.fetch(notificationsUrl(Boolean(tf.settings.get("participating"))), {
          headers: HEADERS,
          auth: CREDENTIAL
        });
      } catch (err) {
        await tf.toast(tf.t(errorKey(err)));
        return;
      }
      if (!res.ok) {
        await tf.toast(tf.t(statusKey(res.status)));
        return;
      }
      const summary = summarize(await res.json().catch(() => null));
      if (!summary) {
        await tf.toast(tf.t("error-failed"));
        return;
      }
      await tf.audit("inbox-checked", { count: summary.count, more: summary.more });
      await tf.toast(tf.t(summaryKey(summary), { count: summary.count, title: summary.newest }));
    } finally {
      busy = false;
    }
  }
  tf.setting("participating", false, tf.t("setting-participating"));
  tf.command(
    tf.t("cmd-check"),
    () => {
      void check();
    },
    { id: "check" }
  );
};
export default main_default;
