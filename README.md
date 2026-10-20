# @tilefold/tile-tools

Everything you need to write Tilefold tiles: the `tilefold-tile` bundler, types for the `tf` API, complete documentation and example tiles to start from.

![Node](https://img.shields.io/badge/node-%E2%89%A522-339933) ![esbuild](https://img.shields.io/badge/esbuild-0.28-ffcf00) ![Tests](https://img.shields.io/badge/vitest-1365%20passing-6e9f18) ![Examples](https://img.shields.io/badge/examples-17-8b6cff) ![Locales](https://img.shields.io/badge/example%20locales-12-4c8bf5) ![License](https://img.shields.io/badge/license-MIT-blue) ![npm](https://img.shields.io/badge/npm-%40tilefold%2Ftile--tools-CB3837)

## Contents

- Identifiers
- Consuming it
- Tilefold and tiles
- Writing a tile
- Documentation
- Commands
- Tile layout
- Examples
- What can be bundled
- TypeScript
- Using it from a script
- Developing it
- Reporting issues
- License
- Test cases (TCs)
- Known blockers

## Identifiers

| What | Value |
|---|---|
| npm package | `@tilefold/tile-tools` |
| Command | `tilefold-tile` |
| Types for tiles | `@tilefold/tile-tools/tf` |
| Source | github.com/Tilefold/tile-tools |
| Bundler | esbuild 0.28 |
| Node.js | 22 or later |
| Tile API described | Tilefold 0.1.9 |

## Consuming it

Run it without installing anything:

```sh
npx @tilefold/tile-tools build
```

Or add it to the tile's own `package.json`, pinned to an exact version so every build of the tile uses the same bundler:

```sh
npm install --save-dev --save-exact @tilefold/tile-tools@0.2.0
npx tilefold-tile build
```

npm 11 may warn that esbuild's install script was not run. Tile Tools works without it, so you can ignore the warning or approve the script with `npm install-scripts approve esbuild`.

## Tilefold and tiles

**Tilefold** is a terminal app built around panes, folds of AI agents working side by side, and a document viewer. **Tiles** are its extensions: small pieces of JavaScript that add commands, settings, notices, pictures above the panes, panels beside them, web pages of their own, or calls to web services and to Claude.

A tile runs in a sandboxed worker and reaches Tilefold only through the `tf` object it is given. Anything that goes beyond the tile itself needs a permission the user agrees to, with the reason you give, and Tilefold records what tiles do in its activity log. Users manage tiles in **Settings → Tiles**: turn them on and off, change their settings and shortcuts, revoke permissions, read their log.

A tile ships as one file, `main.js`, because the worker can't load other files: whatever the user approves is exactly what runs. Tile Tools lets you keep the sources split up however you like and bundles them into that one file.

## Writing a tile

A tile is a folder with a `tile.json` and one JavaScript function:

```json
{
  "id": "you.status",
  "version": "1.0.0",
  "permissions": [{ "net:www.githubstatus.com": "to read GitHub's public status page" }]
}
```

```js
export default (tf) => {
  tf.command("Status: Check GitHub", () => {
    void check(); // start slow work and return: a command has ten seconds
  }, { id: "check" });

  async function check() {
    const res = await tf.net.fetch("https://www.githubstatus.com/api/v2/status.json");
    const { status } = await res.json();
    await tf.toast(`GitHub: ${status.description}`);
  }
};
```

What a tile can do:

| To | Call | Permission |
|---|---|---|
| Add palette commands with shortcuts | `tf.command` | none |
| Add settings (switch, number, text, drop-down) | `tf.setting`, `tf.settings.get` | none |
| React to the app (start, focus, idle, settings…) | `tf.on` | none |
| Speak the user's language (Fluent, 12 languages) | `tf.t` | none |
| Show notices, write a log, record activity | `tf.toast`, `tf.log`, `tf.audit` | none |
| Keep data across restarts | `tf.store` | none |
| Cover or lock the window | `tf.curtain` | `window.curtain`, `window.lock` |
| Hide the window from screen sharing | `tf.window.protect` | `window.protect` |
| Draw and animate pictures above the panes | `tf.overlay` | `window.overlay` |
| Show a panel docked beside the panes | `tf.panel` | `window.panel` |
| Play short sounds | `tf.sound.play` | `sound.play` |
| Call web APIs | `tf.net.fetch` | `net:<host>` |
| Use an API key or a sign-in, without ever seeing it | `auth` in tile.json, `tf.net.fetch(url, { auth })`, `tf.auth.has` | `net:<host>` |
| Ask Claude with the user's own key | `tf.ai.ask` | `ai.ask` |
| Show a web page of its own and talk to it | `tf.page`, `window.tilefold` in the page | `page`, `script:<host>` |
| Follow the pane's folder, list file names, open files in the viewer | `tf.pane.cwd`, `tf.fs.list`, `tf.viewer.open` | `pane.cwd`, `fs.list`, `viewer.open` |

The rules that matter most: register commands, settings and listeners at the top of the function, before any `await`; return from handlers quickly (half a second for events, ten seconds for commands); tell errors apart by `err.name`; check that a feature exists before using it, since older Tilefolds lack the newer ones; translate everything the user reads; and never put a key or token in your code.

## Documentation

| Guide | What it covers |
|---|---|
| [Your first tile](docs/getting-started.md) | From an empty folder to a working tile: layout, strings, building, loading, testing, sharing |
| [tile.json reference](docs/tile-json.md) | Every field and permission, keys and sign-ins, and when users are asked again |
| [The tf API](docs/tf-api.md) | How a tile runs, and every call and event |
| [Overlays and sounds](docs/overlays-and-sounds.md) | Pictures and animations above the panes, and short sounds |
| [Panels](docs/panels.md) | A panel docked beside the panes, drawn by Tilefold from your rows |
| [Network, keys and sign-ins](docs/network.md) | Calling web APIs, API keys and signing in to a service |
| [Tile pages](docs/tile-pages.md) | A tile's own web page, in a window or hidden, and talking to it |
| [Folders](docs/folders.md) | Following the user's folder, listing it and opening files in the viewer |
| [Asking Claude](docs/ai.md) | Questions to Claude with the user's key and confirmation |
| [Limits and errors](docs/limits-and-errors.md) | Every limit and every error name in one place |
| [Reporting issues and ideas](docs/reporting-issues.md) | Where to report Tilefold and Tile Tools bugs and ideas, the issue forms and the labels |

## Commands

| Command | What it does |
|---|---|
| `tilefold-tile build [folder]` | Bundles the entry and everything it imports into `folder/main.js` (default: the current folder, which must contain `tile.json`) |
| `build --watch` | Rebuilds on every save until Ctrl+C; a failed rebuild keeps the last good `main.js`. Then click **Reload tiles** in Tilefold |
| `build --check` | Writes nothing; exits 1 if `main.js` (or `page/main.js`) is not a fresh build of its sources. Meant for CI |
| `build --minify` | Smaller output. Readable output is the default, so people reviewing a tile can follow it |
| `build --entry lib/start.ts` | A different entry file, relative to the tile folder |
| `tilefold-tile validate [folder]` | Checks an existing `main.js` (hand-written or built) against Tilefold's rules |
| `tilefold-tile help`, `--version` | Usage and version |

Exit codes: 0 success, 1 a build or check failed, 2 bad arguments.

The build picks the entry (the first of `src/main.ts`, `src/main.js`, `src/main.mjs`, `src/index.ts`, `src/index.js`, `src/index.mjs`, unless `--entry` names one), bundles it as one ES module for the browser, keeps the entry's opening comment (your copyright notice) on top, and checks the result the way Tilefold does: at most 2 MiB, exactly one `export default`, no other `import` or `export`. Errors name the file, line and column. A tile with a `page-src/` folder also gets its page's code bundled into one script, `page/main.js`.

## Tile layout

```text
my-tile/
  tile.json
  locales/en/tile.ftl
  locales/de/tile.ftl     …one per language
  src/
    main.js        export default (tf) => { ... }
    timer.js
  main.js          written by the build; commit it, don't edit it
  page-src/        optional: a tile page's code, as several files
    main.js
  page/            optional: the tile page Tilefold serves
    index.html
    main.js        written by the build from page-src/
```

The entry exports only its default function; exporting other names is an error, because Tilefold would refuse them.

## Examples

`examples/` holds sixteen tiles, from a few lines to full tiles with their own test suites: games, cards that call web services, sign-ins, Claude, tile pages, a docked folder tree. Each one ships its built `main.js`, so you can copy its folder into your tiles folder and try it at once. [examples/README.md](examples/README.md) lists them, with what each one shows, the Tilefold it needs and how to set up the ones that use an account.

## What can be bundled

Anything that runs in a Web Worker: plain JavaScript, TypeScript, JSON, and npm packages written for the browser. Packages that need Node.js built-ins or the DOM fail to build or fail when the tile runs. Packages that use `fetch`, `XMLHttpRequest` or `WebSocket` fail too, because the sandbox removes them: reach the internet with `tf.net.fetch` instead, which needs a `net:` permission.

## TypeScript

```ts
import type { Tf } from "@tilefold/tile-tools/tf";

export default (tf: Tf) => {
  tf.on("user.idle", ({ minutes }) => {
    if (minutes === 10) void tf.toast(tf.t("take-a-break"));
  });
};
```

The types cover every call, event payload, request and answer, and list the error names. Features newer Tilefolds add are optional in the types, so TypeScript reminds you to check that they exist. The import is type-only, and the build strips it.

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

CI runs the tests on Node.js 22, 24 and 26 on Linux, macOS and Windows. The rules in `lib/rules.mjs` mirror the checks Tilefold makes when it loads a tile. `test/fake-host.mjs` runs a built tile against a fake Tilefold; copy it to test your own tiles.

## Reporting issues

This repository's Issues tab is the tracker for the Tilefold app as well as for Tile Tools and the example tiles. Each issue starts from a form (a bug or an idea, for the app or for Tile Tools and the examples), and the form sets its labels. Security problems go to the private **Report a vulnerability** form on the Security tab. You can write in any language. [Reporting issues and ideas](docs/reporting-issues.md) explains the forms and the labels.

## License

MIT. Tile Tools, its documentation and its examples are open source so tile authors can use them in their own projects and CI. Copy an example and make it your own.

**Your tiles are yours.** License a tile you write however you like, and put your copyright notice in the entry's opening comment: the build keeps it at the top of `main.js`.

**Tilefold itself** is licensed separately, under its End User License Agreement, which covers the app only: tiles are governed by their own licenses, and Tile Tools stays under MIT.

## Test cases (TCs)

Run with `npm test` (1365 tests in 63 files, all passing on 2026-10-19).

| Area | Covers |
|---|---|
| Rules | One default export, named exports and imports refused, size limit |
| Bundling | Entry choice, local imports, npm packages, TypeScript, tree-shaking, the notice on top, export rewriting, errors with their place, minify, page scripts |
| Commands and CLI | build, `--watch`, `--check`, validate, help, version, bad arguments and exit codes |
| Examples | Each ships a fresh build, has a valid tile.json (permissions with reasons, no secrets), uses exactly the messages it defines in every language, registers up front with command ids, has its own default shortcuts, and does what it promises (Folder Tree also: its agent hooks' markers, Claude Code and Codex input, installer and hook command) against the fake host |
| Fake host | The fake Tilefold behaves like the real one for settings, strings, storage, overlays, panels, pages, browsers (several pages per tile), sounds, network, keys, AI and folders |
| tf types | `lib/tf.d.ts` parses as TypeScript and declares every member, event and error name the documentation lists |
| Issue tracker | The issue forms parse, set one area, one type and `status: triage` from `labels.json`, and list every example tile; blank issues off; the label sync creates and corrects labels without deleting any, and a dry run changes nothing |
| Package | Public and MIT-licensed, the right files exported and packed, the MIT line in every shipped file |

## Known blockers

- Tile Tools 0.2.0 (the `tf` types, the docs and the examples) is prepared in this repository but not published; npm still has 0.1.0.
- Tilefold 0.1.10 is the current release. The panel's footer, section headings, tones, badges, trailing text and pulses (in [docs/panels.md](docs/panels.md), and Folder Tree's agent activity in the panel) need Tilefold 0.1.11, which isn't released yet; older ones show the panel without them.
- Most examples have been tried only against the fake host, not against their real service in a running Tilefold; [examples/README.md](examples/README.md) says which.
- `lib/tf.d.ts` is checked for syntax and coverage, not compiled against tiles with `tsc`.
- Publishing is manual for now (`npm publish` from the npm account `tilefold`).
- No `new` (scaffold a tile) command yet, and the command-line messages are English only.

Copyright (c) 2026 Tilefold
All rights reserved.
Last updated: 2026-10-19 by Tilefold
