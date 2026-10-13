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
import {
  HEADERS,
  errorKey,
  notificationsUrl,
  statusKey,
  summarize,
  summaryKey,
} from "./notifications.js";

/** The credential's name, as declared under `auth` in tile.json. */
const CREDENTIAL = "github";

export default (tf) => {
  /** True while a check is under way, so two never overlap. */
  let busy = false;

  /** Counts the unread notifications and says how many there are. */
  async function check() {
    if (busy) return;
    busy = true;
    try {
      if (!tf.net || !tf.auth) {
        await tf.toast(tf.t("error-no-network"));
        return;
      }
      if (!(await tf.auth.has(CREDENTIAL))) {
        await tf.toast(tf.t("error-no-token"));
        return;
      }
      let res;
      try {
        // No Authorization header here: Tilefold adds the token for api.github.com.
        res = await tf.net.fetch(notificationsUrl(Boolean(tf.settings.get("participating"))), {
          headers: HEADERS,
          auth: CREDENTIAL,
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

  // Register everything at the top, before any `await`.
  tf.setting("participating", false, tf.t("setting-participating"));

  tf.command(
    tf.t("cmd-check"),
    () => {
      // Start the check and return: the request may outlast a command's ten seconds.
      void check();
    },
    { id: "check" },
  );
};
