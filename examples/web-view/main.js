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
 * on a page named after its port (`tf.browser.page("3000")`). Docked, they
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
 * Last updated by: Tilefold
 *
 * Build:  npx @tilefold/tile-tools build
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/addresses.js
var MAX_PAGES = 6;
var MAX_NAME = 32;
var PORT_ONLY = /^:?(\d{1,5})$/;
function expandAddress(text) {
  const port = PORT_ONLY.exec(text)?.[1];
  if (port && Number(port) >= 1 && Number(port) <= 65535) return `localhost:${Number(port)}`;
  return text;
}
function readAddresses(value) {
  if (typeof value !== "string") return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const part of value.split(/[\s,]+/)) {
    const address = expandAddress(part.trim());
    if (!address || seen.has(address.toLowerCase())) continue;
    seen.add(address.toLowerCase());
    out.push(address);
    if (out.length === MAX_PAGES) break;
  }
  return out;
}
function baseName(address) {
  let url = null;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(address) ? address : `http://${address}`);
  } catch {
  }
  const raw = url ? url.port || url.hostname.split(".")[0] : address;
  const name = String(raw).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_NAME).replace(/-+$/, "");
  return name || "page";
}
function unique(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const name = `${base.slice(0, MAX_NAME - suffix.length)}${suffix}`;
    if (!taken.has(name)) return name;
  }
}
function planPages(addresses) {
  const taken = /* @__PURE__ */ new Set();
  return addresses.map((address, i) => {
    if (i === 0) return { address, page: null };
    const page = unique(baseName(address), taken);
    taken.add(page);
    return { address, page };
  });
}

// src/recent.js
var MAX_RECENT = 12;
var MAX_RECENT_ALL = 48;
var PAGE_NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?)?$/;
function pageOf(page) {
  return typeof page === "string" && PAGE_NAME.test(page) ? page : "";
}
var MAX_TITLE = 120;
var ROW_PREFIX = "page:";
function isPage(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) && url.length <= 4096;
}
function cap(list) {
  const seen = /* @__PURE__ */ new Map();
  return list.filter((e) => {
    const n = (seen.get(e.page) ?? 0) + 1;
    seen.set(e.page, n);
    return n <= MAX_RECENT;
  }).slice(0, MAX_RECENT_ALL);
}
function readRecent(value) {
  if (!Array.isArray(value)) return [];
  return cap(
    value.filter((e) => e && isPage(e.url) && typeof e.title === "string").map((e) => ({ url: e.url, title: e.title.slice(0, MAX_TITLE), page: pageOf(e.page) }))
  );
}
function remember(list, seen) {
  if (!isPage(seen?.url)) return list;
  const page = pageOf(seen.page);
  const same = (e) => e.url === seen.url && e.page === page;
  const old = list.find(same);
  const title = (seen.title || old?.title || "").slice(0, MAX_TITLE);
  return cap([{ url: seen.url, title, page }, ...list.filter((e) => !same(e))]);
}
function shortAddress(url) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
function rowId(entry) {
  return `${ROW_PREFIX}${entry.page}|${entry.url}`;
}
function readRowId(id) {
  if (typeof id !== "string" || !id.startsWith(ROW_PREFIX)) return null;
  const rest = id.slice(ROW_PREFIX.length);
  const bar = rest.indexOf("|");
  if (bar < 0 || !PAGE_NAME.test(rest.slice(0, bar))) return { page: "", url: rest };
  return { page: rest.slice(0, bar), url: rest.slice(bar + 1) };
}
function panelRows(list) {
  return list.filter((e) => rowId(e).length <= 1024).map((e) => ({
    id: rowId(e),
    label: (e.title || shortAddress(e.url)).slice(0, 256) || e.url.slice(0, 256),
    icon: "link",
    hint: e.url.slice(0, 512),
    page: e.page
  }));
}
function errorKey(err) {
  return err?.name === "BrowserError" ? "error-refused" : "error-failed";
}

// src/main.js
var main_default = (tf) => {
  let recent = [];
  async function showPanel() {
    if (!tf.panel) return;
    if (!tf.settings.get("panel") || recent.length === 0) {
      await tf.panel.hide();
      return;
    }
    await tf.panel.show({
      title: tf.t("panel-title"),
      subtitle: tf.t("panel-subtitle"),
      rows: panelRows(recent)
    });
  }
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
  const open = (b, url) => b.open(url, { docked: tf.settings.get("docked") === true });
  async function pages(b) {
    const planned = planPages(readAddresses(String(tf.settings.get("address"))));
    if (typeof b.page === "function") {
      return planned.map((p) => ({ ...p, b: p.page ? b.page(p.page) : b }));
    }
    if (planned.length > 1) await tf.toast(tf.t("error-one-page"));
    return planned.slice(0, 1).map((p) => ({ ...p, b }));
  }
  const eachPage = (step) => steer(async (b) => {
    for (const p of await pages(b)) await step(p);
  });
  tf.command(tf.t("cmd-open"), () => void eachPage((p) => open(p.b, p.address)), {
    id: "open"
  });
  tf.command(
    tf.t("cmd-move"),
    () => void steer(async (b) => {
      const first = await b.info();
      const docked = first ? !first.docked : true;
      for (const p of await pages(b)) {
        const now = await p.b.info();
        if (!now) await p.b.open(p.address, { docked: true });
        else if (now.docked !== docked) await p.b.dock(docked);
      }
    }),
    { id: "move" }
  );
  tf.command(
    tf.t("cmd-reload"),
    () => void eachPage(async (p) => {
      if (await p.b.info()) await p.b.reload();
    }),
    { id: "reload" }
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
    { id: "clear" }
  );
  tf.on("app.ready", async () => {
    recent = readRecent(await tf.store.get("recent"));
    await showPanel();
  });
  tf.on("browser.navigated", async ({ url, title, page }) => {
    const next = remember(recent, { url, title, page });
    if (next === recent) return;
    recent = next;
    await tf.store.set("recent", recent);
    await showPanel();
  });
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
export default main_default;
