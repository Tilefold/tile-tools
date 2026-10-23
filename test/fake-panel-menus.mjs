/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold host — panel menus (tests only)
 *
 * The right-click menus of a panel (Tilefold 0.1.16), checked as Tilefold
 * checks them: at most 8 named menus of at most 12 lines, items with an id
 * of lowercase letters, digits and dashes (unique in their menu), a label
 * of 1–64 characters and optionally the error tone, and separators; every
 * row's `menu`, and the panel's own, must name one of them. `choose(row,
 * item)` plays the user picking an item, and only passes on an item of the
 * menu that row (null: the empty space) opens, as Tilefold does.
 * `doubleClick(row)` plays a double-click: the two `panel.click` events,
 * then `panel.dblclick`, only for a row of the shown panel.
 */

const NAME = /^[a-z][a-z0-9-]{0,31}$/;

/** Throws a TypeError (via `named`) when the content's menus are malformed. */
export function checkPanelMenus(content, named) {
  const menus = content.menus ?? {};
  if (typeof menus !== "object" || Array.isArray(menus)) throw named("TypeError", "menus");
  const names = Object.keys(menus);
  if (names.length > 8) throw named("TypeError", "at most 8 menus");
  for (const name of names) {
    const list = menus[name];
    if (!NAME.test(name) || !Array.isArray(list) || !list.length || list.length > 12) {
      throw named("TypeError", `menus.${name}`);
    }
    const ids = new Set();
    for (const e of list) {
      if (e?.separator === true) continue;
      const ok =
        NAME.test(e?.id ?? "") &&
        !ids.has(e.id) &&
        typeof e.label === "string" &&
        e.label.trim().length > 0 &&
        [...e.label.trim()].length <= 64 &&
        (e.tone === undefined || e.tone === null || e.tone === "error");
      if (!ok) throw named("TypeError", `menus.${name} item`);
      ids.add(e.id);
    }
    if (!ids.size) throw named("TypeError", `menus.${name} has no items`);
  }
  const rows = [...(content.rows ?? []), ...(content.footer?.rows ?? [])];
  for (const ref of [content.menu, ...rows.map((r) => r.menu)]) {
    if (ref !== undefined && ref !== null && !(ref in menus)) throw named("TypeError", "menu");
  }
}

/** Plays a choice from a row's menu (null: the empty space), as Tilefold passes it on. */
export function chooseFromMenu(host, row, item) {
  const content = host.panel.content;
  if (!content) return undefined;
  const rows = [...(content.rows ?? []), ...(content.footer?.rows ?? [])];
  const found = row === null ? null : rows.find((r) => r.id === row);
  if (row !== null && !found) return undefined;
  const name = found ? found.menu : content.menu;
  const items = (content.menus ?? {})[name] ?? [];
  if (!items.some((e) => e.id === item)) return undefined;
  return host.emit("panel.menu", { row, item });
}

/** Plays a double-click on `row`: two clicks, then `panel.dblclick`, as Tilefold sends them. */
export async function doubleClick(host, row) {
  const content = host.panel.content;
  const rows = [...(content?.rows ?? []), ...(content?.footer?.rows ?? [])];
  const found = rows.find((r) => r.id === row);
  if (!found) return;
  const action = found.expandable ? (found.expanded ? "collapse" : "expand") : "activate";
  await host.emit("panel.click", { row, action });
  await host.emit("panel.click", { row, action });
  await host.emit("panel.dblclick", { row });
}
