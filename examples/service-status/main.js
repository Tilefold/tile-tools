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
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/status.js
var STATUS_URL = "https://www.githubstatus.com/api/v2/status.json";
var KEYS = {
  none: "status-none",
  minor: "status-minor",
  major: "status-major",
  critical: "status-critical"
};
var MAX_DESCRIPTION = 120;
function parseStatus(json) {
  const status = json && typeof json === "object" ? json.status : null;
  if (!status || typeof status !== "object") return null;
  const { indicator, description } = status;
  if (typeof indicator !== "string" || !indicator) return null;
  return {
    indicator,
    description: typeof description === "string" ? description.trim().slice(0, MAX_DESCRIPTION) : ""
  };
}
function statusKey(indicator) {
  return Object.hasOwn(KEYS, indicator) ? KEYS[indicator] : "status-unknown";
}
function errorKey(err) {
  switch (err && typeof err === "object" ? err.name : "") {
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
var EVERY = [
  { value: "0", key: "setting-every-off" },
  { value: "15", key: "setting-every-quarter" },
  { value: "60", key: "setting-every-hour" }
];
var main_default = (tf) => {
  let timer = null;
  let busy = false;
  function schedule() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    const minutes = Number(tf.settings.get("every"));
    if (minutes > 0) timer = setInterval(() => void check(false), minutes * 6e4);
  }
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
        await tf.audit("status-changed", { from: last, to: status.indicator });
      }
      if (byUser || last !== null && last !== status.indicator) {
        await tf.toast(tf.t(statusKey(status.indicator), { description: status.description }));
      }
    } finally {
      busy = false;
    }
  }
  tf.setting("every", "0", tf.t("setting-every"), {
    choices: EVERY.map((c) => ({ value: c.value, label: tf.t(c.key) }))
  });
  tf.command(
    tf.t("cmd-check"),
    () => {
      void check(true);
    },
    { id: "check-now" }
  );
  tf.on("app.ready", () => {
    schedule();
    void check(false);
  });
  tf.on("setting.changed", ({ key }) => {
    if (key === "every") schedule();
  });
};
export default main_default;
