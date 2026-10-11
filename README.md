# @tilefold/tile-tools

Write a Tilefold tile as many files (JavaScript, TypeScript or npm packages) and bundle them into the single `main.js` Tilefold loads.

![Node](https://img.shields.io/badge/node-%E2%89%A522-339933) ![esbuild](https://img.shields.io/badge/esbuild-0.28-ffcf00) ![Tests](https://img.shields.io/badge/vitest-68%20passing-6e9f18) ![License](https://img.shields.io/badge/license-MIT-blue) ![npm](https://img.shields.io/badge/npm-%40tilefold%2Ftile--tools-CB3837)

## Contents

- Identifiers
- Consuming it
- Why one file
- Commands
- Tile layout
- Examples
- What can be bundled
- Using it from a script
- Developing it
- License
- Test cases (TCs)
- Known blockers

## Identifiers

| What | Value |
|---|---|
| npm package | `@tilefold/tile-tools` |
| Command | `tilefold-tile` |
| Source | github.com/Tilefold/tile-tools |
| Bundler | esbuild 0.28 |
| Node.js | 22 or later |

## Consuming it

Run it without installing anything:

```sh
npx @tilefold/tile-tools build
```

Or add it to the tile's own `package.json`, pinned to an exact version so every build of the tile uses the same bundler:

```sh
npm install --save-dev --save-exact @tilefold/tile-tools@0.1.0
npx tilefold-tile build
```

npm 11 may warn that esbuild's install script was not run. Tile Tools works without it, so you can ignore the warning or approve the script with `npm install-scripts approve esbuild`.

## Why one file

Tilefold runs a tile in a sandboxed Web Worker that can't load files. Whatever you approve in Settings → Tiles is exactly what runs. So a tile ships as one bundled file, while you keep its sources split up however you like.

## Commands

| Command | What it does |
|---|---|
| `tilefold-tile build [folder]` | Bundles the entry and everything it imports into `folder/main.js` (default: the current folder, which must contain `tile.json`) |
| `build --watch` | Rebuilds on every save until Ctrl+C; a failed rebuild keeps the last good `main.js`. Then click **Reload tiles** in Tilefold |
| `build --check` | Writes nothing; exits 1 if `main.js` is not a fresh build of its sources. Meant for CI |
| `build --minify` | Smaller output. Readable output is the default, so people reviewing a tile can follow it |
| `build --entry lib/start.ts` | A different entry file, relative to the tile folder |
| `tilefold-tile validate [folder]` | Checks an existing `main.js` (hand-written or built) against Tilefold's rules |
| `tilefold-tile help`, `--version` | Usage and version |

Exit codes: 0 success, 1 a build or check failed, 2 bad arguments.

The build:

1. picks the entry: the first of `src/main.ts`, `src/main.js`, `src/main.mjs`, `src/index.ts`, `src/index.js`, `src/index.mjs`, unless `--entry` names one;
2. bundles it with esbuild as one ES module for the browser (ES2022), with non-ASCII characters escaped so no invisible character reaches the file;
3. puts the entry's opening comment (your copyright notice) on top, followed by a "Built by @tilefold/tile-tools" line;
4. turns esbuild's `export { x as default };` into `export default x;`, which every Tilefold version accepts;
5. checks the result the way Tilefold does: at most 2 MiB, exactly one `export default`, no other `import` or `export`.

Errors name the file, line and column, for example `src/main.js:12:5: Could not resolve "./tmer.js"`.

## Tile layout

```text
my-tile/
  tile.json
  locales/en/tile.ftl
  src/
    main.js        export default (tf) => { ... }
    timer.js
  main.js          written by the build; commit it, don't edit it
```

The entry exports only its default function; exporting other names is an error, because Tilefold would refuse them.

## Examples

Four tiles in `examples/` show the common cases, from a few lines to a full overlay tile. Each has its sources in `src/`, English strings in `locales/en/tile.ftl`, and the built `main.js` checked in, so you can try one without building it: copy its folder into your tiles folder (Settings → Tiles → Open tiles folder, usually `~/.tilefold/tiles/`), then click **Reload tiles** and **Allow**.

| Example | What it shows | Try |
|---|---|---|
| `examples/hello` | The basics in plain JavaScript: an entry that imports a helper module, a setting, a command with an id, translated messages with a variable | Set your name in its settings, then run **Hello: Say hello** from the palette |
| `examples/break-timer` | TypeScript across three files (entry, a timer module, the types of the `tf` calls it uses), timers, `tf.store` so a reminder survives a restart, an `app.ready` listener | Set the minutes, run **Break Timer: Start** |
| `examples/with-npm-package` | An npm package (`nanoid`) installed with npm and bundled into `main.js`; the example's own `package.json` with `build`, `watch` and `check` scripts | Run **ID Maker: New ID** |
| `examples/tilefold-pet` | A complete tile: a pet that roams over your panes, naps, loves a pat and (if it's a dog) barks. Overlays (`tf.overlay`) and sounds (`tf.sound.play`) with the permissions they need and why, drop-down settings, event handlers that return at once and work in the background, three characters drawn as SVG in code, and all twelve of Tilefold's languages. Needs Tilefold 0.1.4 or later | Allow it, pat it, double-click it, drag it; pick **Tessa**, **Coco** or **Biscuit** in its settings |

To build one yourself:

```sh
cd examples/hello
npx @tilefold/tile-tools build          # or: node ../../bin/tilefold-tile.mjs build
```

For `with-npm-package`, run `npm install` in its folder first, then `npm run build`.

**Make the pet your own.** Each character is one file in `examples/tilefold-pet/src/characters/`: its name, walking pace, optional bark, and its poses drawn as small SVG pictures. Copy one, change the drawing, add it to the list in `characters/index.js` with a `setting-character-<id>` message in each `locales/<lang>/tile.ftl`, change the tile's `id` in `tile.json` to your own (`you.my-pet`), and build. `src/characters/index.js` describes the shape a character must have.

Things the examples do on purpose, worth copying:

- **Register first.** Settings, commands and listeners are registered at the top of the tile's function, before any `await`. Tilefold checks what a tile adds once, before it runs, and ignores later registrations.
- **Give commands an id.** The title is translated; the id keeps the command and its shortcut stable across languages.
- **Keep event handlers quick.** A handler has half a second, a command ten seconds.
- **Keep Tilefold out of your logic.** `greeting.js` and `timer.ts` know nothing about `tf`, so they are easy to read and test.

To translate an example, add `locales/<lang>/tile.ftl` with the same keys; Tilefold picks the user's language and falls back to English.

## What can be bundled

Anything that runs in a Web Worker: plain JavaScript, TypeScript, JSON, and npm packages written for the browser. Packages that need Node.js built-ins, the DOM or the network either fail to build or fail when the tile runs, because the sandbox removes `fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts` and similar globals.

## Using it from a script

```js
import { build, bundleTile } from "@tilefold/tile-tools";

const code = await build({ folder: "my-tile" }); // exit code, logs to the console
const { code: text, entry, warnings } = await bundleTile("my-tile"); // in memory
```

## Developing it

```sh
git clone https://github.com/Tilefold/tile-tools.git
cd tile-tools
npm install
npm test                 # Vitest
npm pack --dry-run       # what would be published
node bin/tilefold-tile.mjs build path/to/a/tile
```

CI runs the tests on Node.js 22, 24 and 26 on Linux, macOS and Windows. The rules in `lib/rules.mjs` mirror the checks Tilefold makes when it loads a tile; the Tilefold app's own test suite checks the two still agree.

## License

MIT. Tile Tools is open source so tile authors can use it in their own projects and CI. Tilefold itself is licensed separately.

## Test cases (TCs)

Run with `npm test` (68 tests, all passing on 2026-10-10).

| Area | Covers |
|---|---|
| Rules | One default export, named exports and imports refused, size limit |
| Entry | Conventional order, named entry, missing entry, entry outside the folder |
| Finishing | Header and built-from line, export rewrite (multi-line and minified), legal comment kept once, named exports refused |
| Bundling | Local imports, npm packages, TypeScript, tree-shaking, syntax and resolve errors with location, minify |
| Commands | build writes and logs, `--check` fresh/stale/missing, folder without `tile.json`, validate, watch rebuilds and keeps the last good build |
| CLI | help, version, unknown command and option, extra argument, `--watch` with `--check`, named entry, stop function for a watch |
| Examples | Each ships a fresh build, has a valid tile.json (permissions with reasons), uses exactly the messages it defines, registers up front with command ids; hello greets by name, break-timer rings, stops and resumes after a restart, with-npm-package makes IDs with the bundled nanoid |
| Tilefold Pet | Run against a fake Tilefold (`test/fake-host.mjs`) with fake timers: appears on the focused pane's floor or stays hidden, roams the pane or the bottom, back and front views, wanders to another pane, pat / play / drag / drop, naps and greets, commands, comes back after a restart, Korean and Japanese messages; characters listed with translated labels, own names and art, switching recorded, unknown falls back to Tessa; WAV barks once and twice, Biscuit lower than Coco, quiet when Bark is off, Tessa never barks |
| Package | Public and MIT-licensed, LICENSE shipped, bin/exports/types exist, only built files packed, MIT line in every shipped file |

## Known blockers

- Publishing is manual for now (`npm publish` from the npm account `tilefold`); a CI workflow with trusted publishing and provenance is planned.
- No `new` (scaffold a tile) command yet.
- Messages are English only.

Copyright (c) 2026 Tilefold
All rights reserved.
Last updated: 2026-10-10 by Tilefold
