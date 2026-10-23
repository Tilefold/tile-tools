# Panels

From **Tilefold 0.1.9**, a tile with the `window.panel` permission can show **a panel docked beside the panes**: a folder tree, a task list, an outline. The panel sits to the right of the panes, and before the document viewer when that is open too. The user can resize it and close it.

You don't draw the panel. You send **rows**, and Tilefold draws them in the user's theme, with its own icons. No HTML, styles or pictures of yours go into Tilefold's window, so a panel is quick to build and always looks at home. For a free-form interface, use a [tile page](tile-pages.md) instead.

The **Folder Tree** example (`examples/folder-tree`) is a complete tile built on a panel.

## 1. Ask for the permission

```json
"permissions": [{ "window.panel": "to show the folder tree beside your panes" }]
```

## 2. Show it

```js
await tf.panel.show({
  title: "app",
  subtitle: "/Users/ada/projects/app",
  rows: [
    { id: "src", label: "src", icon: "folder", expandable: true, expanded: true },
    { id: "src/main.rs", label: "main.rs", icon: "file", depth: 1 },
    { id: "src/lib", label: "lib", icon: "folder", expandable: true, depth: 1 },
    { id: "README.md", label: "README.md", icon: "file" },
  ],
});
```

Each `show` replaces the whole panel and brings it forward. `tf.panel.hide()` takes it away. One tile's panel is docked at a time: the one shown last.

| Row field | |
|---|---|
| `id` | Unique in the panel, 1–1,024 characters. Clicks send it back |
| `label` | The text shown, 1–256 characters, always as plain text |
| `depth` | Indent, from 0 |
| `icon` | `folder`, `file`, `link`, `loading`, `error`, `info` or `none` (the default). For `file`, Tilefold picks the file-type icon (code, markup, styles, data, documents, pictures, archives, scripts, lock files) from the label |
| `expandable`, `expanded` | The row opens and closes, like a folder; `expanded: true` draws it open |
| `muted` | A quiet note, such as "Loading…" or "Empty folder" |
| `hint` | A tooltip, at most 512 characters |
| `section` | Drawn as a section heading, such as "Now" or "Recent" (Tilefold 0.1.11) |
| `tone` | A theme colour for the row's icon, label and badge: `accent`, `info`, `success`, `warning` or `error` (Tilefold 0.1.11) |
| `badge` | A short pill after the label, such as the pane an agent works in or a count, at most 32 characters (Tilefold 0.1.11) |
| `trail` | A short muted text at the row's end, such as "2m", at most 32 characters (Tilefold 0.1.11) |
| `pulse` | A pulsing dot: something is happening on this row now. It stays still for users who ask for less motion (Tilefold 0.1.11) |
| `page` | The tile's browser page the row belongs to: a page name (as in `tf.browser.page(name)`), or `""` for the first page. Each tab's panel lists only the rows for the pages docked on that tab (Tilefold 0.1.11) |

### A footer pinned to the bottom

From **Tilefold 0.1.11**, `footer: { rows }` is a second list pinned under the rows: a "Recent" list, a status, a legend. It takes the room its rows need and grows upward to at most half the panel, then scrolls inside, while the rows above scroll on their own. The keyboard moves from the rows into it.

```js
await tf.panel.show({
  title: "app",
  rows: treeRows,
  footer: {
    rows: [
      { id: "recent", label: "Recent", section: true, expandable: true, expanded: true, badge: "12" },
      { id: "r:main.rs", label: "main.rs", icon: "file", depth: 1, tone: "warning", badge: "api", trail: "2m" },
      { id: "recent-more", label: "Show all 12", depth: 1, tone: "accent" },
    ],
  },
});
```

A tile with browser pages on several tabs can give each row its `page`. Each tab's panel then lists the rows for the pages docked on that tab, plus rows with no `page` and rows whose page isn't docked (in a window, or closed). A section heading with nothing left under it is left out, and on a tab where nothing of the panel would show, the panel steps aside. Web View does this with its recent addresses. Older Tilefolds ignore `page` and show every row on every tab.

Ids are unique across the rows and the footer, and the 5,000-row limit counts both. Tilefold 0.1.9 and 0.1.10 ignore `footer`, `section`, `tone`, `badge`, `trail` and `pulse`: the panel still shows, plainer and without the footer, so keep anything essential in the rows or in a [tile page](tile-pages.md) too.

## 3. Listen to the user

```js
tf.on("panel.click", ({ row, action }) => {
  // action: "expand" or "collapse" for a row that opens,
  // "activate" for any other row (a click, Enter or Space)
});
tf.on("panel.closed", ({ by }) => {
  // by: "user" (its close button), or "replaced" (another tile's panel took its place)
});
```

The keyboard works as in a tree: Up and Down move between rows, Right and Left send `expand` and `collapse` (mirrored in right-to-left languages), and Enter sends the same as a click.

Nothing opens or closes until you show the panel again: keep the state in your tile, and redraw after each change.

## 4. Right-click menus

From **Tilefold 0.1.16**, rows can have a right-click menu. Name up to 8 menus in `menus`, each a list of up to 12 lines: items (`id`, `label` of up to 64 characters, and `tone: "error"` for something like Move to Trash) and `{ separator: true }`. A row opens the menu it names with `menu`, and the panel's own `menu` is for a right-click on the empty space under the rows.

```js
await tf.panel.show({
  title: "app",
  rows: [
    { id: "src", label: "src", icon: "folder", expandable: true, menu: "dir" },
    { id: "src/main.rs", label: "main.rs", icon: "file", depth: 1, menu: "file" },
  ],
  menus: {
    dir: [
      { id: "new-file", label: "New file" },
      { separator: true },
      { id: "trash", label: "Move to Trash", tone: "error" },
    ],
    file: [{ id: "open", label: "Open" }],
    space: [{ id: "new-file", label: "New file" }],
  },
  menu: "space",
});

tf.on("panel.menu", ({ row, item }) => {
  // row: the row's id, or null for the empty space; item: the item's id
});
```

Tilefold draws the menu, like the rows, at the pointer. The user also opens it with the ContextMenu key or Shift+F10 on a row, moves with the arrow keys, chooses with Enter and closes it with Escape. Only an item of the menu the row really opens reaches your tile. Older Tilefolds ignore `menus` and `menu`, so keep every action reachable another way too, such as a click or a command. Folder Tree's menus add, rename and trash files.

## 5. Edit a row in place

From **Tilefold 0.1.16**, `tf.panel.edit(row, { value?, selectTo? })` turns a row's label into a text field in place, as Finder does for a rename. It resolves to the text the user typed when they press Enter, or `null` when they press Escape, click away, or the row goes away. `value` is the text it starts with (the label by default), and `selectTo` is where the first selection ends, so `"notes"` of `notes.md` can be selected and the extension kept. One edit runs at a time; a new one cancels the last.

```js
tf.on("panel.menu", ({ row, item }) => {
  if (item !== "rename") return;
  // Not awaited: the user takes their time, and listeners have half a second.
  void tf.panel.edit(row, { selectTo: 5 }).then((name) => {
    if (name) return tf.fs.rename(row, name);
  });
});
```

## 6. Double-clicks

From **Tilefold 0.1.16**, a double-click on a row also reaches your tile as `panel.dblclick` with the row's id. It comes after the two `panel.click` events the clicks themselves send, so whatever a click does has already happened. Folder Tree opens a file on a click and renames it in place on a double-click. Older Tilefolds never send it, so keep the action reachable another way too.

```js
tf.on("panel.dblclick", ({ row }) => {
  void tf.panel.edit(row).then((name) => name && tf.fs.rename(row, name));
});
```

## Limits

At most 5,000 rows, 30 `show` calls a second, a title of 120 characters and a subtitle of 512. Malformed content fails with `TypeError` and the reason; too many updates with `RateLimitError`. `tf.panel` is missing before Tilefold 0.1.9:

```js
if (!tf.panel) return tf.log.warn("This tile needs Tilefold 0.1.9 or later");
```

The activity log records each time a panel is shown, hidden or closed by the user (`ui.tile.panel`), never its rows or the clicks.
