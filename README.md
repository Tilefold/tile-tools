# @tilefold/tile-tools

Everything you need to write Tilefold tiles: the `tilefold-tile` bundler, types for the `tf` API, complete documentation and example tiles to start from.

![Node](https://img.shields.io/badge/node-%E2%89%A522-339933) ![esbuild](https://img.shields.io/badge/esbuild-0.28-ffcf00) ![Tests](https://img.shields.io/badge/vitest-1681%20passing-6e9f18) ![Examples](https://img.shields.io/badge/examples-20-8b6cff) ![Locales](https://img.shields.io/badge/example%20locales-12-4c8bf5) ![License](https://img.shields.io/badge/license-MIT-blue) ![npm](https://img.shields.io/badge/npm-%40tilefold%2Ftile--tools-CB3837)

## Contents

- Identifiers
- Consuming it
- Tilefold and tiles
- Writing a tile
- Documentation
- Commands
- Tile layout
- Examples
- Room relay
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
| Tile API described | Tilefold 0.1.20 |

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
| [Screensaver themes](docs/screensaver-themes.md) | Themes for Tilefold's screensaver, drawn on a canvas, from a tile that asks for nothing else |
| [Live tiles with other people](docs/room-relay.md) | The room relay's protocol, a page's side of it, and running your own relay |
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

`examples/` holds twenty tiles, from a few lines to full tiles with their own test suites: games, cards that call web services, sign-ins, Claude, tile pages, a docked folder tree, a quiz on a borderless card, screensaver themes, a two-player game through a room relay. Each one ships its built `main.js`, so you can copy its folder into your tiles folder and try it at once. [examples/README.md](examples/README.md) lists them, with what each one shows, the Tilefold it needs and how to set up the ones that use an account.

## Room relay

`relay/` is an open room relay: a small server that makes rooms with a code and passes messages between the people in each, for tiles that do something live together, such as Gomoku or a chat. It needs Node.js 22 or later and nothing installed:

```sh
node relay/server.mjs --port 8787
```

`relay/rooms.mjs` is the protocol itself, `relay/ws.mjs` a small WebSocket server on Node's own modules, and `relay/server.mjs` the command, with `GET /health` and a JSON-lines activity log that never holds names, codes or messages. Tiles reach a relay only over `wss://` on port 443, so a public one sits behind TLS. [Live tiles with other people](docs/room-relay.md) has the protocol, the page's side, and how to run and secure your own. The relay isn't part of the npm package.

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

Run with `npm test` (1681 tests in 81 files, all passing on 2026-10-28).

| Area | Covers |
|---|---|
| Rules | One default export, named exports and imports refused, size limit |
| Bundling | Entry choice, local imports, npm packages, TypeScript, tree-shaking, the notice on top, export rewriting, errors with their place, minify, page scripts |
| Commands and CLI | build, `--watch`, `--check`, validate, help, version, bad arguments and exit codes |
| Examples | Each ships a fresh build, has a valid tile.json (permissions with reasons, no secrets), uses exactly the messages it defines in every language, registers up front with command ids, has its own default shortcuts, and does what it promises (Gomoku also: five in a row in every direction, draws, refused moves, game codes, the relay client's reconnects and pings, two players through a fake relay with rematches and catching up after a drop, and its built page played by two windows; Quiz also: its card docked over the pane, moved by its top bar or grip and resized by its corner, docked beside the panes and back, in Tilefold's theme or light or dark, the panel, saved progress, quizzes added by agents and checked, and older Tilefolds; Folder Tree also: its agent hooks' markers, Claude Code and Codex input, installer and hook command, adding, renaming, moving and trashing files, its panel per tab, and its window's file tools in a DOM) against the fake host |
| Room relay | Rooms, codes and names; joining in any case; messages to the others only; full rooms, wrong apps, unknown codes and malformed frames; one room per connection; seats freed on leave and close; the frame allowance and size limit; rooms expiring after a day unused; `authorize` and the token in the address; an activity log without names, codes or messages; WebSocket frames at every length, the RFC 6455 handshake, split messages, unmasked frames refused, the heartbeat closing silent clients, wrong paths and origins turned away, `/health`; the command's options; and a whole Gomoku game between two boards over a real relay, one board leaving and coming back mid-game |
| Fake host | The fake Tilefold behaves like the real one for settings, commands with an agent's input and their results, strings, storage, overlays, panels (per tab too), pages, browsers (several pages per tile), screensaver themes, sounds, network, keys, AI, folders and file changes |
| tf types | `lib/tf.d.ts` parses as TypeScript and declares every member, event and error name the documentation lists |
| Issue tracker | The issue forms parse, set one area, one type and `status: triage` from `labels.json`, and list every example tile; blank issues off; the label sync creates and corrects labels without deleting any, and a dry run changes nothing |
| Package | Public and MIT-licensed, the right files exported and packed, the MIT line in every shipped file |

## Known blockers

- Tile Tools 0.2.0 (the `tf` types, the docs and the examples) is prepared in this repository but not published; npm still has 0.1.0.
- Most examples have been tried only against the fake host, not against their real service in a running Tilefold; [examples/README.md](examples/README.md) says which.
- `lib/tf.d.ts` is checked for syntax and coverage, not compiled against tiles with `tsc`.
- Gomoku has been played through Tilefold's relay at `play.tilefold.com` from its own client code, and in a browser against a local relay, but not yet as a tile inside a running Tilefold.
- Publishing is manual for now (`npm publish` from the npm account `tilefold`).
- No `new` (scaffold a tile) command yet, and the command-line messages are English only.

Copyright (c) 2026 Tilefold
All rights reserved.
Last updated: 2026-10-28 by Tilefold
