# Example tiles

Tiles to try and to start from, from a few lines to complete tiles with their own tests. Each folder has its sources in `src/`, its strings in `locales/` and a built `main.js`, so you can try one without building it: copy the folder into your tiles folder (**Settings → Tiles → Open tiles folder**), then click **Reload tiles** and **Allow**.

To build one yourself:

```sh
cd examples/hello
npx @tilefold/tile-tools build
```

## The examples

| Example | What it is | Needs Tilefold |
|---|---|---|
| `hello` | The smallest useful tile: a setting, a command and translated messages | any |
| `break-timer` | A break reminder written in TypeScript that survives a restart | any |
| `with-npm-package` | A tile that bundles an npm package | any |
| `tilefold-pet` | A pet that roams over your panes | 0.1.4 |
| `tilefall` | A falling-blocks game | 0.1.4 |
| `orbit-guard`, `brickfold`, `girder-jump` | Arcade games: a shooter, a brick breaker and a platformer | 0.1.4 |
| `service-status` | A service's status, from a public web page | 0.1.6 |
| `github-inbox` | Your GitHub notifications, with an API key | 0.1.6 |
| `shell-tips` | Shell tips written by Claude | 0.1.6 |
| `weather-card` | Today's weather on a card, with an optional summary by Claude | 0.1.6 |
| `pipeline-board` | Your CI pipelines on a card, with a sign-in | 0.1.6 |
| `tuneboard` | A music player card with a sign-in and a page of its own | 0.1.7 |
| `watchpane` | A YouTube player over your panes, with a control dock under it that you can drag anywhere and a list of videos beside it (in a small window of its own before Tilefold 0.1.11) | 0.1.10 |
| `folder-tree` | The folder you're working in, as a tree docked beside your panes, with what your coding agents are reading and changing in it and the recent files pinned at the bottom; also in a window of its own. Agents report through hooks in `hooks/` ([README](folder-tree/README.md)) | 0.1.9 (activity colours and pinned Recent: 0.1.11) |
| `web-view` | The web app you're building, in a browser beside your panes: one page per address (say one per localhost port) | 0.1.11 |

Each tile's commands are in the command palette under its name, and its settings in **Settings → Tiles**.

**Tiles that use an account** (an API key or a sign-in) show what to do on their card in Settings → Tiles, under **Keys**. Those that need more than that have a README in their folder.

## Making one your own

Copy an example's folder, give the tile your own `id` in `tile.json` (`you.my-tile`), change what you like and build it. The guides in [docs](../docs) explain every part of a tile.

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-14 by Tilefold
