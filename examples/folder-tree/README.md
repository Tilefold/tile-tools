# Folder Tree

The folder your pane is in, as a tree docked beside your panes, with what your coding agents are doing in it: the files they are reading, editing, adding and deleting light up in the action's colour with the pane's name, busy folders say how many, and the recent files stay pinned at the bottom of the panel.

## Using it

- **Folder Tree: Show or hide** (⌃⌥T on macOS) docks the tree. Click a folder to open it, and a file to read it in the document viewer beside the tree. The tree follows you when you switch panes or `cd`.
- **Now**, at the top, lists the files agents are on at this moment, each pulsing: blue for reading, amber for editing, green for adding, red for deleting. It keeps its place and at least three rows' height even when no agent is busy, so the tree below doesn't jump.
- **Every pane:** what agents do in all your panes shows together, not only in the pane you're in. A file outside the tree's folder shows after its pane's folder name (`game/src/hud.js`).
- **Recent**, pinned to the bottom, shows the newest five. **Show all** lets it grow upward to half the panel, scrolling inside; **Show fewer** shrinks it back. Folder Tree remembers which you chose.
- **Folder Tree: Open window** shows the same in a window of its own.

## Changing files

From Tilefold 0.1.16, Folder Tree can also add, rename, move and trash files and folders, and you edit files right in the document viewer.

- **Right-click in the panel:** on a folder for **New file**, **New folder**, **Rename…** and **Move to Trash**; on a file for **Open**, **Edit**, **Rename…** and **Move to Trash**; on the empty space under the tree for a new file or folder in the tree's own folder. **New file** makes `untitled.md` (or `untitled 2.md`, …) and opens it in the document viewer ready to type (save with ⌘S); **New folder** makes `untitled folder`. The ContextMenu key or Shift+F10 opens the menu from the keyboard. The same are in the command palette as **Folder Tree: New file**, **New folder**, **Rename** and **Move to Trash**, which work on the row you last clicked.
- **Rename** opens the window with the name ready to change. **Move to Trash** moves the chosen file or folder to the Trash; Tilefold asks you first, and you can put it back from the Trash in Finder.
- **In the window** (Folder Tree: Open window): the **New file**, **New folder**, **Rename**, **Edit** and **Move to Trash** buttons above the tree; rename in place (Enter keeps the name, Escape doesn't); drag a file or folder onto another folder to move it, or onto the **Files** heading to move it to the tree's folder; **F2** renames and **⌘⌫** (or Delete) moves to the Trash.
- Nothing is ever replaced: a name that's taken is refused. Folders inside `.git`, and the folder a pane is in itself, can't be changed.
- Folder Tree still never reads or writes what's in a file; you type in Tilefold's document viewer. The activity log records each change by kind only, never a name.

On an older Tilefold the tree works as before, and these commands say they need Tilefold 0.1.16.

The colours, pulses, pinned Recent list, every pane and pane names need Tilefold 0.1.11. On 0.1.9 and 0.1.10 the panel shows the tree only, and only the focused pane's agents; the window has the rest.

## Showing what your agents do

Agents read and change files with their own tools and with shell commands. Folder Tree sees both:

- **File tools:** what Claude Code's Read, Edit, Write and NotebookEdit open or change, and the files its Grep and Glob find.
- **Shell commands:** just before a command runs, the hook notes the time; once it has run, every file in the project changed since then is marked as edited, or added when it is new, even when the command never names it (a script, a formatter, a code generator). Folders that only hold tools' output, such as `node_modules`, `target`, `dist` and `.git`, are skipped. Files a search prints (`rg`, `grep`, `find`, `fd`, `git grep`) and plain `cat`, `head`, `tail` or `sed -n` reads are marked as read, and files removed with `rm` as deleted.
- **Never in the way:** the hook before a command only notes the time, and the one after runs in the background, so the agent never waits for Folder Tree.

The tree finds agents wherever they work in what it shows: in its own folder, in the folders above it, and in the projects inside it (its subfolders are looked into every 30 seconds, and any folder you open counts too). So a tree opened on a folder holding several repositories shows the agents in each of them.

When two agents work in the same project at once, a file one of them changes while the other's command runs may be marked for both.

Folder Tree can't read your files, only their names. Agents tell it what they do through small hooks, which leave empty marker files whose names say who did what to which file. They are kept in a `.foldertree` folder at the top of the project (the repository), and also in the folder the agent was started in when that is somewhere else, so the tree finds them whether you open it on the project, on a folder above it holding several repositories, or on a folder inside it. Each `.foldertree` has its own `.gitignore` so markers never end up in a commit. The newest 300 from the last week are kept.

In the folder you copied Folder Tree to (for example `~/.tilefold/tiles/folder-tree`), run:

```sh
node hooks/install.mjs
```

- **Claude Code:** adds two hooks to `~/.claude/settings.json`, one before shell commands and one after its file tools and shell commands; they work from the next session. Agents already running when you install them don't show up until you restart them. Installed an earlier Folder Tree? Run it again to get both.
- **Codex:** adds the same two hooks to `~/.codex/hooks.json`; Codex asks you to trust them once.
- `--claude` or `--codex` sets up only one; `--dry-run` says what would change; `--remove` takes the hooks out again. Each settings file is copied to `<file>.foldertree-backup` first.
- Moved the tile? Run it again from the new folder: the hooks are replaced, not added twice.
- **Other agents:** run `node hooks/watch.mjs --pane "name"` in the project, beside the agent. It marks files as they are added, changed and deleted (it can't see reads).

Each agent is called by the name you gave its pane in Tilefold (rename a pane to "Winnie" and its agent shows as Winnie). A pane without a name shows the agent's name ("Claude Code", "Codex"), or the one you start it with: `FOLDERTREE_PANE=api claude`.

The **Folder Tree: Set up agent activity** command shows the same steps in the window, with a button to copy the command.

## Settings

| Setting | Default |
|---|---|
| Show what your coding agents are doing | On |
| Seconds an agent's action counts as happening now | 20 |
| Minutes a file stays marked in the tree after an agent used it | 30 |
| Show hidden files and folders | Off |
| Folders to leave out | `node_modules` |

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-23 by Tilefold
