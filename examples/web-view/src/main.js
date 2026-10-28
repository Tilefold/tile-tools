/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web View (example tile)
 *
 * Shows the web app you're building beside your panes, or in a window of
 * its own if you prefer (a setting). "Web View: Open" opens the address
 * from its settings (port 5173 on this computer unless you change it); after that,
 * type any address in Tilefold's bar above the page. "Web View: Beside
 * the panes or in a window" moves it between the two. Pages you open are
 * remembered, and a panel docked beside the panes lists the recent ones:
 * click one to open it again.
 *
 * Several addresses (`localhost:5173, localhost:3000`) open several pages
 * at once, one per address: the first on the tile's first page, each other
 * on a page named after its port (`tf.browser.page("3000")`). A range of
 * ports (`3000-3010` or `3000~3010`) opens one page per port. Docked, they
 * stack beside the panes. Open, Move, Reload and Close act on every page;
 * Back and Forward on the first. The panel lists each page's recent
 * addresses on that page's tab, and a click opens one again in its page.
 *
 * Shown on purpose:
 * - the `browser` permission and `tf.browser`: Tilefold draws the window and
 *   its bar and checks every address; the tile only steers it and hears
 *   where it went (`browser.navigated`), never what the page shows;
 * - `tf.browser` (and `tf.panel`) are missing on an older Tilefold, so the
 *   tile says so instead of failing;
 * - several pages at once (`tf.browser.page`), and a Tilefold without them
 *   showing just the first address;
 * - errors are told apart by their `name`, not their message.
 *
 * Modified 2026-10-17 (each tab's panel lists its own pages): recent
 * addresses keep their browser page, and the panel's rows say which.
 *
 * Modified 2026-10-18 (renamed): Web Preview is now Web View (example.web-view).
 *
 * Modified 2026-10-19 (port ranges): the address setting takes ranges of ports.
 *
 * Last updated by: Tilefold
 *
 * Build:  npx @tilefold/tile-tools build
 */
import { planPages, readAddresses } from "./addresses.js";
import { errorKey, panelRows, readRecent, readRowId, remember } from "./recent.js";

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

  tf.setting("address", "5173", tf.t("setting-address"));
  tf.setting("docked", true, tf.t("setting-docked"));
  tf.setting("panel", true, tf.t("setting-panel"));

  /** Opens `url` in page `b` where the settings say (beside the panes, or a window). */
  const open = (b, url) => b.open(url, { docked: tf.settings.get("docked") === true });

  /**
   * The pages for the addresses in the settings, each with its browser
   * (`b`). A Tilefold that opens one page at a time gets just the first
   * address, and the user is told why.
   */
  async function pages(b) {
    const planned = planPages(readAddresses(String(tf.settings.get("address"))));
    if (typeof b.page === "function") {
      return planned.map((p) => ({ ...p, b: p.page ? b.page(p.page) : b }));
    }
    if (planned.length > 1) await tf.toast(tf.t("error-one-page"));
    return planned.slice(0, 1).map((p) => ({ ...p, b }));
  }

  /** Runs `step` on every page of the addresses in the settings. */
  const eachPage = (step) =>
    steer(async (b) => {
      for (const p of await pages(b)) await step(p);
    });

  tf.command(tf.t("cmd-open"), () => void eachPage((p) => open(p.b, p.address)), {
    id: "open",
  });
  // Moves the pages between the dock and a window (all the way the first
  // goes); opens a closed one docked.
  tf.command(
    tf.t("cmd-move"),
    () =>
      void steer(async (b) => {
        const first = await b.info();
        const docked = first ? !first.docked : true;
        for (const p of await pages(b)) {
          const now = await p.b.info();
          if (!now) await p.b.open(p.address, { docked: true });
          else if (now.docked !== docked) await p.b.dock(docked);
        }
      }),
    { id: "move" },
  );
  tf.command(
    tf.t("cmd-reload"),
    () =>
      void eachPage(async (p) => {
        if (await p.b.info()) await p.b.reload();
      }),
    { id: "reload" },
  );
  tf.command(tf.t("cmd-back"), () => void steer((b) => b.back()), { id: "back" });
  tf.command(tf.t("cmd-forward"), () => void steer((b) => b.forward()), { id: "forward" });
  tf.command(tf.t("cmd-close"), () => void eachPage((p) => p.b.close()), { id: "close" });
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

  // Each page the browser lands on goes to the top of the list, with the
  // browser page it was in (none named: the first page).
  tf.on("browser.navigated", async ({ url, title, page }) => {
    const next = remember(recent, { url, title, page });
    if (next === recent) return;
    recent = next;
    await tf.store.set("recent", recent);
    await showPanel();
  });

  // A recent address opens again in the browser page it was seen in.
  tf.on("panel.click", ({ row }) => {
    const hit = readRowId(row);
    if (!hit) return;
    void steer((b) => {
      const target = hit.page && typeof b.page === "function" ? b.page(hit.page) : b;
      return open(target, hit.url);
    });
  });

  tf.on("setting.changed", ({ key }) => {
    if (key === "panel") void showPanel();
  });
};
