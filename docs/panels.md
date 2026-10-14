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

## Limits

At most 5,000 rows, 30 `show` calls a second, a title of 120 characters and a subtitle of 512. Malformed content fails with `TypeError` and the reason; too many updates with `RateLimitError`. `tf.panel` is missing before Tilefold 0.1.9:

```js
if (!tf.panel) return tf.log.warn("This tile needs Tilefold 0.1.9 or later");
```

The activity log records each time a panel is shown, hidden or closed by the user (`ui.tile.panel`), never its rows or the clicks.
