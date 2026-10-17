/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold — tf.browser
 *
 * The browser part of the fake Tilefold in fake-host.mjs: `tf.browser` for
 * a tile's first page and `tf.browser.page(name)` for its named pages, each
 * keeping what it shows and every call, with Tilefold 0.1.11's checks (web
 * addresses only, page names of 1 to 32 lowercase letters, digits and
 * dashes). With `onePage`, it is a Tilefold that keeps one page per tile
 * (no `page()`). See fake-host.mjs for how tests use it.
 */

/** `tf.browser`, keeping what each page shows and every call. */
export function addBrowser(tf, host, named, onePage = false) {
  /** One page's state: what it shows, and every call made to it. */
  const fresh = () => ({ open: false, docked: false, url: "about:blank", title: "", calls: [] });
  // The tile's first page; its named pages (tf.browser.page) by name.
  host.browser = { ...fresh(), pages: {} };
  const address = (text) => {
    if (/^\s*(javascript|data|file|about|blob):/i.test(text)) {
      throw named("BrowserError", "only http and https pages open here");
    }
    return /^https?:\/\//i.test(text) ? text : `http://${text}`;
  };
  /** The API for one page, `state`, called `name` (null: the first). */
  const api = (state, name) => {
    const need = () => {
      if (!state.open) throw named("BrowserError", "the browser is not open");
    };
    const shown = () => ({
      url: state.url,
      title: state.title,
      docked: state.docked,
      ...(name ? { page: name } : {}),
    });
    const methods = {
      async open(url, options) {
        state.calls.push(options === undefined ? ["open", url] : ["open", url, options]);
        if (url !== undefined && url !== null) state.url = address(url);
        if (options !== undefined && options !== null && typeof options !== "object") {
          throw named("TypeError", "options must be an object");
        }
        if (typeof options?.docked === "boolean") state.docked = options.docked;
        else if (!state.open) state.docked = false;
        state.open = true;
        return shown();
      },
      async dock(docked) {
        state.calls.push(["dock", docked]);
        if (typeof docked !== "boolean") throw named("TypeError", "dock takes true or false");
        need();
        state.docked = docked;
        return null;
      },
      async go(url) {
        state.calls.push(["go", url]);
        need();
        state.url = address(url);
        return null;
      },
      async back() {
        state.calls.push(["back"]);
        need();
        return null;
      },
      async forward() {
        state.calls.push(["forward"]);
        need();
        return null;
      },
      async reload() {
        state.calls.push(["reload"]);
        need();
        return null;
      },
      async close() {
        state.calls.push(["close"]);
        state.open = false;
        return null;
      },
      async info() {
        return state.open ? shown() : null;
      },
    };
    return methods;
  };
  /** A page name, checked as Tilefold 0.1.11 checks it. */
  const pageName = (name) => {
    const text = String(name);
    if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(text)) {
      throw named("TypeError", "a page name is 1 to 32 lowercase letters, digits and dashes");
    }
    return text;
  };
  tf.browser = {
    ...api(host.browser, null),
    page(name) {
      const key = pageName(name);
      host.browser.pages[key] ??= fresh();
      return Object.freeze(api(host.browser.pages[key], key));
    },
  };
  // A Tilefold from before several pages per tile: no page().
  if (onePage) delete tf.browser.page;
  /** The state of page `name` (none: the first). */
  const stateOf = (name) => (name ? (host.browser.pages[name] ??= fresh()) : host.browser);
  host.visit = async (url, title = "", name = null) => {
    const state = stateOf(name);
    state.url = url;
    state.title = title;
    await host.emit("browser.navigated", { url, title, ...(name ? { page: name } : {}) });
  };
  host.closeBrowser = async (name = null) => {
    const state = stateOf(name);
    state.open = false;
    await host.emit("browser.closed", { url: state.url, ...(name ? { page: name } : {}) });
  };
}
