/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Service Status (example tile)
 *
 * The smallest tile that uses the internet. It asks for one host in
 * tile.json (`net:www.githubstatus.com`) and reads GitHub's public status
 * page with `tf.net.fetch`, which Tilefold performs after checking that
 * permission. No key or sign-in is involved. Run the command to check now,
 * or pick an interval in its settings: it then checks by itself and only
 * speaks up when the status changes.
 *
 * Shown on purpose:
 * - the command starts the check and returns at once, because a command
 *   that takes longer than ten seconds stops the tile (a request may take
 *   up to thirty);
 * - errors are told apart by their `name`, not their message;
 * - `tf.net` is missing on a Tilefold without tile networking, so the tile
 *   says so instead of failing.
 *
 * Build:  npx @tilefold/tile-tools build
 */
import { STATUS_URL, errorKey, parseStatus, statusKey } from "./status.js";

/** The intervals offered in settings: stored value (minutes) and its label. */
const EVERY = [
  { value: "0", key: "setting-every-off" },
  { value: "15", key: "setting-every-quarter" },
  { value: "60", key: "setting-every-hour" },
];

export default (tf) => {
  /** The interval timer, while one runs. */
  let timer = null;
  /** True while a check is under way, so two never overlap. */
  let busy = false;

  /** Starts (or stops) checking by itself, as the setting says. */
  function schedule() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    const minutes = Number(tf.settings.get("every"));
    if (minutes > 0) timer = setInterval(() => void check(false), minutes * 60_000);
  }

  /**
   * Reads the status page. `byUser` checks always answer with a notice;
   * checks on a timer stay quiet unless the status changed.
   */
  async function check(byUser) {
    if (busy) return;
    busy = true;
    try {
      if (!tf.net) {
        if (byUser) await tf.toast(tf.t("error-no-network"));
        return;
      }
      let status;
      try {
        const res = await tf.net.fetch(STATUS_URL, { headers: { accept: "application/json" } });
        // A 4xx or 5xx answer still resolves, with `ok` false.
        status = res.ok ? parseStatus(await res.json().catch(() => null)) : null;
        if (!status) {
          if (byUser) await tf.toast(tf.t(res.ok ? "error-bad-answer" : "error-failed"));
          return;
        }
      } catch (err) {
        if (byUser) await tf.toast(tf.t(errorKey(err)));
        else await tf.log.warn(`status check failed: ${err?.name}: ${err?.message}`);
        return;
      }
      const last = await tf.store.get("last");
      if (last !== status.indicator) {
        await tf.store.set("last", status.indicator);
        // The activity log keeps a record of every change the tile saw.
        await tf.audit("status-changed", { from: last, to: status.indicator });
      }
      // The first timed check only notes the status; later ones report changes.
      if (byUser || (last !== null && last !== status.indicator)) {
        await tf.toast(tf.t(statusKey(status.indicator), { description: status.description }));
      }
    } finally {
      busy = false;
    }
  }

  // Register everything at the top, before any `await`.
  tf.setting("every", "0", tf.t("setting-every"), {
    choices: EVERY.map((c) => ({ value: c.value, label: tf.t(c.key) })),
  });

  tf.command(
    tf.t("cmd-check"),
    () => {
      // Start the check and return: the request may outlast a command's ten seconds.
      void check(true);
    },
    { id: "check-now" },
  );

  tf.on("app.ready", () => {
    schedule();
    void check(false);
  });

  tf.on("setting.changed", ({ key }) => {
    if (key === "every") schedule();
  });
};
