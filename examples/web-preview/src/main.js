/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web Preview (example tile)
 *
 * Shows the web app you're building in a browser window next to your
 * panes. "Web Preview: Open" opens the address from its settings
 * (`localhost:5173` unless you change it); after that, type any address in
 * the window's own bar. Pages you open are remembered, and a panel docked
 * beside the panes lists the recent ones: click one to open it again.
 *
 * Shown on purpose:
 * - the `browser` permission and `tf.browser`: Tilefold draws the window and
 *   its bar and checks every address; the tile only steers it and hears
 *   where it went (`browser.navigated`), never what the page shows;
 * - `tf.browser` (and `tf.panel`) are missing on an older Tilefold, so the
 *   tile says so instead of failing;
 * - errors are told apart by their `name`, not their message.
 *
 * Build:  npx @tilefold/tile-tools build
 */
import { ROW_PREFIX, errorKey, panelRows, readRecent, remember } from "./recent.js";

export default (tf) => {
  /** Recent pages, newest first (read from the store when Tilefold is ready). */
  let recent = [];

  /** Shows the recent pages in the docked panel, or hides it. */
  async function showPanel() {
    if (!tf.panel) return;
    if (!tf.settings.get("panel") || recent.length === 0) {
      await tf.panel.hide();
      return;
    }
    await tf.panel.show({
      title: tf.t("panel-title"),
      subtitle: tf.t("panel-subtitle"),
      rows: panelRows(recent),
    });
  }

  /** Runs one browser step; a missing browser or a refusal becomes a notice. */
  async function steer(step) {
    if (!tf.browser) {
      await tf.toast(tf.t("error-no-browser"));
      return;
    }
    try {
      await step(tf.browser);
    } catch (err) {
      await tf.toast(tf.t(errorKey(err), { reason: String(err?.message ?? "") }));
    }
  }

  tf.setting("address", "localhost:5173", tf.t("setting-address"));
  tf.setting("panel", true, tf.t("setting-panel"));

  tf.command(
    tf.t("cmd-open"),
    () => void steer((b) => b.open(String(tf.settings.get("address")))),
    {
      id: "open",
    },
  );
  tf.command(tf.t("cmd-reload"), () => void steer((b) => b.reload()), { id: "reload" });
  tf.command(tf.t("cmd-back"), () => void steer((b) => b.back()), { id: "back" });
  tf.command(tf.t("cmd-forward"), () => void steer((b) => b.forward()), { id: "forward" });
  tf.command(tf.t("cmd-close"), () => void steer((b) => b.close()), { id: "close" });
  tf.command(
    tf.t("cmd-clear"),
    async () => {
      recent = [];
      await tf.store.set("recent", []);
      await showPanel();
      await tf.toast(tf.t("recent-cleared"));
    },
    { id: "clear" },
  );

  tf.on("app.ready", async () => {
    recent = readRecent(await tf.store.get("recent"));
    await showPanel();
  });

  // Each page the window lands on goes to the top of the list.
  tf.on("browser.navigated", async ({ url, title }) => {
    const next = remember(recent, { url, title });
    if (next === recent) return;
    recent = next;
    await tf.store.set("recent", recent);
    await showPanel();
  });

  tf.on("panel.click", ({ row }) => {
    if (row.startsWith(ROW_PREFIX)) void steer((b) => b.open(row.slice(ROW_PREFIX.length)));
  });

  tf.on("setting.changed", ({ key }) => {
    if (key === "panel") void showPanel();
  });
};
