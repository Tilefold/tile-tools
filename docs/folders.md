# Folders

From **Tilefold 0.1.9**, a tile can follow the folder the user is working in, list what is in it, and open files in Tilefold's document viewer. From **0.1.11** it can also see all the user's panes, and from **0.1.16** create, rename, move and trash files and folders there. Each permission is shown to the user, with your reason, before the tile runs:

| Permission | Lets the tile | Call |
|---|---|---|
| `pane.cwd` | Know the folder the focused pane is in, and hear when it changes | `tf.pane.cwd()`, the `pane.cwd` event |
| `pane.list` | See every pane: the name the user gave it, its folder, its session and which is focused (Tilefold 0.1.11) | `tf.pane.list()`, the `pane.list` event |
| `fs.list` | See the names and kinds in a folder, one level at a time. Never what's in a file | `tf.fs.list(path)` |
| `viewer.open` | Show a file in the document viewer, or open it ready to edit (0.1.16). The tile never receives the file's contents | `tf.viewer.open(path, { edit? })` |
| `fs.write` | Create empty files and folders, rename and move them (never over another), and move them to the Trash after Tilefold asks the user (Tilefold 0.1.16). Never what's in a file | `tf.fs.create`, `mkdir`, `rename`, `move`, `trash` |

The **Folder Tree** example (`examples/folder-tree`) uses all of them, and shows the tree in a [docked panel](panels.md).

## 1. Ask for the permissions

```json
"permissions": [
  { "pane.cwd": "to show the folder you're working in" },
  { "fs.list": "to show the files and folders in it" },
  { "viewer.open": "to open the file you click" }
]
```

Ask only for what you use. A tile that only shows the current folder's name needs `pane.cwd` alone.

## 2. Follow the focused pane

```js
let root = await tf.pane.cwd(); // "/Users/ada/projects/app", or null
tf.on("pane.cwd", (e) => {
  root = e.path; // switching panes or tabs, or a `cd`, sends it again
});
```

The folder comes from the shell's integration with Tilefold. For a pane without it, it is the folder the pane was opened in.

## Every pane (Tilefold 0.1.11)

```js
// [{ session: "01a1…", name: "Winnie", folder: "/Users/ada/game", focused: true }, …]
let panes = (await tf.pane.list?.()) ?? [];
tf.on("pane.list", (e) => {
  panes = e.panes; // a pane opened, closed, renamed, moved folder or took focus
});
```

- `name` is the name the user gave the pane, or `null`. Show it where you name a pane: it is how the user knows it.
- `session` is what programs in that pane see as `TILEFOLD_SESSION_ID` (null while no shell runs), so a tile can tell which pane a report from a program came from.
- `tf.pane.list` is missing before Tilefold 0.1.11; check for it, as above.

## 3. List a folder

```js
const { path, entries, truncated } = await tf.fs.list(root);
// path: the folder with links resolved; build child paths from it
// entries: [{ name: "src", kind: "dir" }, { name: "README.md", kind: "file" }, …]
const src = await tf.fs.list(`${path}/src`);
```

- `kind` is `dir`, `file`, `link` or `other`. A link isn't followed in the listing. List it or open it to find out where it leads; the same rule as below applies to its target.
- Entries come folders first, then by name, at most 2,000 of them. `truncated` says when there were more.
- Hidden names such as `.git` are included. Filter them yourself if you don't want them.

## 4. Open a file

```js
await tf.viewer.open(`${path}/README.md`);
```

The file opens in a tab of the document viewer, as if the user had opened it. The viewer shows Markdown, code and other text, and images; binary files (archives, PDFs…) and very large files aren't shown.

From Tilefold 0.1.16, `{ edit: true }` opens a Markdown or text file ready to edit: the user types and saves (⌘S) in the viewer. Your tile still never sees the text.

## 5. Change files (Tilefold 0.1.16)

With `fs.write`, a tile can add, rename, move and trash entries. Each call resolves to the entry's new path:

```js
const file = await tf.fs.create(dir, "notes.md");    // an empty file
await tf.viewer.open(file, { edit: true });          // the user types in the viewer
const docs = await tf.fs.mkdir(dir, "docs");         // a folder
const plan = await tf.fs.rename(file, "plan.md");    // a new name, same folder
await tf.fs.move(plan, docs);                        // another folder; a third argument renames too
const gone = await tf.fs.trash(plan);                // true, or false when the user says no
```

- **Nothing is ever replaced.** A name that's taken (compared without case on macOS) fails with `AlreadyExistsError`. Pick a free name first, as Folder Tree does with "untitled 2.md".
- **The Trash asks the user.** Tilefold shows its own dialog naming your tile and the entry; Escape or a click outside means no. Things in the Trash can be put back from Finder; nothing is erased.
- **Names** are one segment of at most 255 bytes, without `/`, `:`, control characters or characters that reverse text direction, and without spaces at either end (`InvalidNameError`).
- **Off limits:** anything inside a `.git` folder (`ProtectedPathError`), the folder a pane is in itself, and moving a folder into itself (`PathNotAllowedError`).
- At most 20 changes in any 10 seconds (`RateLimitError`).
- On an older Tilefold, `tf.fs.create` and the others are missing, and `fs.write` is shown as unavailable on the consent screen. Check before use:

```js
if (typeof tf.fs?.create !== "function") return tf.toast("This needs Tilefold 0.1.16 or later");
```

## Where a tile can reach

Listing and opening work only **inside a folder one of the user's panes is in**, and below it. With a single pane in `~/projects/app`, `~/projects/app/src` can be listed but `~/projects` can't. Tilefold resolves links before it checks, so a link inside the project that leads elsewhere is refused. When a pane closes, its folder is no longer reachable unless another pane is in it.

Tilefold checks this itself, and records every listing (`tile.fs.list`, with how many entries), every opened file (`tile.viewer.open`), every change (`tile.fs.create`, `tile.fs.rename`, `tile.fs.trash`, with the kind only), every answer to the Trash question (`ui.tile.trash.answer`) and every refusal (`tile.fs.denied`) in the activity log. Paths and names are never recorded.

## Errors

| `name` | When |
|---|---|
| `PathNotAllowedError` | The path is outside every pane's folder, or isn't absolute |
| `NotFoundError` | Nothing is at that path |
| `NotADirectoryError` | `tf.fs.list` was given a file |
| `NotAFileError` | `tf.viewer.open` was given a folder |
| `UnreadableError` | The folder can't be read |
| `AlreadyExistsError` | A change would replace another entry |
| `InvalidNameError` | A new name can't be used |
| `ProtectedPathError` | The path is inside `.git` |
| `RateLimitError` | More than 60 listing and opening calls, or 20 changes, in 10 seconds |
| `PermissionDeniedError` | The user didn't allow the permission |

`tf.pane`, `tf.fs` and `tf.viewer` are missing in a Tilefold older than 0.1.9. Check before using them:

```js
if (!tf.fs) return tf.log.warn("Folder Tree needs Tilefold 0.1.9 or later");
```
