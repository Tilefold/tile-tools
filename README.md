# @tilefold/tile-tools

Everything you need to write Tilefold tiles: the `tilefold-tile` bundler, types for the `tf` API, complete documentation, and nine example tiles from a few lines to a game, a Spotify card and a tile that asks Claude.

![Node](https://img.shields.io/badge/node-%E2%89%A522-339933) ![esbuild](https://img.shields.io/badge/esbuild-0.28-ffcf00) ![Tests](https://img.shields.io/badge/vitest-667%20passing-6e9f18) ![Examples](https://img.shields.io/badge/examples-9-8b6cff) ![Locales](https://img.shields.io/badge/example%20locales-12-4c8bf5) ![License](https://img.shields.io/badge/license-MIT-blue) ![npm](https://img.shields.io/badge/npm-%40tilefold%2Ftile--tools-CB3837)

## Contents

- Identifiers
- Consuming it
- Writing a tile
- Documentation
- Why one file
- Commands
- Tile layout
- Examples
- What can be bundled
- TypeScript
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
| Types for tiles | `@tilefold/tile-tools/tf` |
| Source | github.com/Tilefold/tile-tools |
| Bundler | esbuild 0.28 |
| Node.js | 22 or later |
| Tile API described | Tilefold 0.1.6 (tile networking, keys, sign-ins and AI) |

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

## Writing a tile

A tile is a folder with a `tile.json` and one JavaScript function. Tilefold runs the function in a sandboxed worker and hands it `tf`, the tile's only way to reach the app. Each thing that reaches beyond the tile itself needs a permission the user agrees to, with the reason you give:

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

What a tile can do in Tilefold 0.1.6:

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
| Play short sounds | `tf.sound.play` | `sound.play` |
| Call web APIs | `tf.net.fetch` | `net:<host>` |
| Use an API key or a sign-in, without ever seeing it | `auth` in tile.json, `tf.net.fetch(url, { auth })`, `tf.auth.has` | `net:<host>` |
| Ask Claude with the user's own key | `tf.ai.ask` | `ai.ask` |

The rules that matter most: register commands, settings and listeners at the top of the function, before any `await`; return from handlers quickly (half a second for events, ten seconds for commands); tell errors apart by `err.name`; translate everything the user reads; and never put a key or token in your code.

## Documentation

| Guide | What it covers |
|---|---|
| [Your first tile](docs/getting-started.md) | From an empty folder to a tile that calls a web API: layout, strings, building, loading, testing, sharing |
| [tile.json reference](docs/tile-json.md) | Every field, every permission, `auth` for keys and sign-ins, and when users are asked again |
| [The tf API](docs/tf-api.md) | How a tile runs, and every call: commands, settings, events, strings, notices, log, activity, storage, curtain, lock, screen-sharing protection |
| [Overlays and sounds](docs/overlays-and-sounds.md) | Scenes, items, sprite sheets, animations, layout and pointer events; sound clips and their limits |
| [Network, keys and sign-ins](docs/network.md) | `tf.net.fetch`, what Tilefold enforces, API keys, signing in to a service (the callback address, the user's own app, services that set Tilefold up by themselves), errors |
| [Asking Claude](docs/ai.md) | `tf.ai.ask`, the user's confirmation, models, masking, the daily allowance, errors |
| [Limits and errors](docs/limits-and-errors.md) | Every limit and every error name in one place |

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
  locales/de/tile.ftl     …one per language
  src/
    main.js        export default (tf) => { ... }
    timer.js
  main.js          written by the build; commit it, don't edit it
```

The entry exports only its default function; exporting other names is an error, because Tilefold would refuse them.

## Examples

Nine tiles in `examples/` show the common cases, from a few lines to full tiles with their own test suites. Each has its sources in `src/`, its strings in `locales/`, and the built `main.js` checked in, so you can try one without building it: copy its folder into your tiles folder (Settings → Tiles → Open tiles folder, usually `~/.tilefold/tiles/`), then click **Reload tiles** and **Allow**.

| Example | What it shows | Needs | Try |
|---|---|---|---|
| `examples/hello` | The basics in plain JavaScript: an entry that imports a helper module, a setting, a command with an id, translated messages with a variable | any | Set your name in its settings, then run **Hello: Say hello** |
| `examples/break-timer` | TypeScript across three files, timers, `tf.store` so a reminder survives a restart, an `app.ready` listener | any | Set the minutes, run **Break Timer: Start** |
| `examples/with-npm-package` | An npm package (`nanoid`) bundled into `main.js`, with the example's own `build`, `watch` and `check` scripts | any | Run **ID Maker: New ID** |
| `examples/tilefold-pet` | A pet that roams over your panes, naps, loves a pat and barks: overlays and sounds with the permissions they need, drop-down settings, handlers that return at once and work in the background, SVG drawn in code, twelve languages | 0.1.4 | Pat it, double-click it, drag it; pick **Tessa**, **Coco** or **Biscuit** |
| `examples/tilefall` | A game split the way a larger tile should be: a pure engine, SVG rendering and a thin tile layer; every move a command with a ⌃⌥ / Ctrl+Alt shortcut, on-screen buttons via overlay hit areas, a saved game, sounds | 0.1.4 | **Tilefall: New game** (⌃⌥N), then ⌃⌥← / ⌃⌥→, ⌃⌥↑ to rotate, ⌃⌥Enter to drop |
| `examples/service-status` | **The internet, no key.** `net:www.githubstatus.com` and `tf.net.fetch` against a public API; a command that starts the request and returns; errors by name; an interval setting that checks quietly and speaks only on a change; `tf.audit` of each change; twelve languages | 0.1.6 | Run **Service Status: Check GitHub now**, or pick an interval in its settings |
| `examples/github-inbox` | **An API key it never sees.** `auth` with `apiKey` (header, scheme, the one host it may go to); `tf.auth.has` before asking; `{ auth: "github" }` on the request; telling a missing token (`CredentialMissingError`) from a refused one (401/403); a count in the activity log, never titles; twelve languages | 0.1.6 | Add a GitHub token (classic, `notifications` scope) under **Keys** on its card, then run **GitHub Inbox: Check notifications** |
| `examples/shell-tips` | **Asking Claude.** `ai.ask` and `tf.ai.ask` with a system prompt, a conversation that continues the last tip, `maxTokens` and `model: "fast"`; the user's language named in the tile's own strings; "Don't send" treated as a choice, not a failure; one question at a time; the last tip kept in `tf.store`; twelve languages | 0.1.6 | Save your Anthropic key in Settings → AI, pick a topic, run **Shell Tips: New tip** |
| `examples/tuneboard` | **Signing in to a service.** A Spotify now-playing card with previous, play/pause, next and volume buttons and shortcuts. Its `tile.json` declares a Spotify sign-in that uses the user's own Spotify app; Tilefold runs the sign-in in the browser, keeps it in the keychain and adds it to the tile's requests, so the tile never holds a token. It checks Spotify only while the card is shown. From 0.3.0, when no Spotify app is open, ▶ plays inside Tilefold through Spotify's player in a hidden tile page; twelve languages | 0.1.6 (playing inside Tilefold: tile pages, not yet released) | Run **Tuneboard: Show or hide**; the sign-in steps are below |

To build one yourself:

```sh
cd examples/hello
npx @tilefold/tile-tools build          # or: node ../../bin/tilefold-tile.mjs build
```

For `with-npm-package`, run `npm install` in its folder first, then `npm run build`.

**Make the pet your own.** Each character is one file in `examples/tilefold-pet/src/characters/`: its name, walking pace, optional bark, and its poses drawn as small SVG pictures. Copy one, change the drawing, add it to the list in `characters/index.js` with a `setting-character-<id>` message in each `locales/<lang>/tile.ftl`, change the tile's `id` in `tile.json` to your own (`you.my-pet`), and build.

**A GitHub token for GitHub Inbox.** Create a classic personal access token at github.com → Settings → Developer settings → Personal access tokens, with only the `notifications` scope. In Tilefold, paste it under **Keys** on GitHub Inbox's card in Settings → Tiles and click **Save**. Tilefold keeps it in your keychain; the tile only learns that a token is there.

**Signing Tuneboard in to Spotify.** In Tilefold, open Settings → Tiles and find **Set up your own app** under **Keys** on Tuneboard's card. Click **Open setup page**, create an app at the Spotify developer dashboard, and paste the callback address Tilefold shows (use its **Copy** button) as the app's redirect URI. Paste the app's Client ID back into Tilefold and click **Sign in…**. Your browser opens Spotify's own sign-in page, and the card starts showing what is playing a few seconds after you agree. Controlling playback needs Spotify Premium. With a Tilefold that has tile pages, Tuneboard can also play by itself: run **Tuneboard: Play in Tilefold**, or press ▶ when no Spotify app is open, and a device named "Tilefold" appears in Spotify. Earlier Tilefold versions only remote-control a Spotify app already running somewhere.

Things the examples do on purpose, worth copying:

- **Register first.** Settings, commands and listeners are registered at the top of the tile's function, before any `await`. Tilefold checks what a tile adds once, before it runs, and ignores later registrations.
- **Give commands an id.** The title is translated; the id keeps the command and its shortcut stable across languages.
- **Return from handlers at once.** A handler has half a second, a command ten seconds, and a request or a question to Claude can take longer: start it with `void work()` and return.
- **One at a time.** A `busy` flag stops a second request or question from starting while one is under way.
- **Errors by name.** `err.name` (`CredentialMissingError`, `AiDeclinedError`…) decides what to tell the user; messages are never parsed.
- **Check for the feature.** `tf.net`, `tf.auth` and `tf.ai` are missing on older Tilefolds; the examples say "update Tilefold" instead of failing.
- **Keep Tilefold out of your logic.** `status.js`, `notifications.js`, `tips.js` and `timer.ts` know nothing about `tf`, so they are easy to read and test.

## What can be bundled

Anything that runs in a Web Worker: plain JavaScript, TypeScript, JSON, and npm packages written for the browser. Packages that need Node.js built-ins or the DOM fail to build or fail when the tile runs. Packages that use `fetch`, `XMLHttpRequest` or `WebSocket` fail too, because the sandbox removes them: reach the internet with `tf.net.fetch` instead, which needs a `net:` permission.

## TypeScript

Type your tile's `tf` from Tile Tools 0.2.0 on:

```ts
import type { Tf } from "@tilefold/tile-tools/tf";

export default (tf: Tf) => {
  tf.on("user.idle", ({ minutes }) => {
    if (minutes === 10) void tf.toast(tf.t("take-a-break"));
  });
};
```

The types cover every call, event payload, overlay item, request and answer, and list the error names. `tf.net`, `tf.auth` and `tf.ai` are optional, so TypeScript reminds you to check that they exist. The import is type-only, and the build strips it.

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

CI runs the tests on Node.js 22, 24 and 26 on Linux, macOS and Windows. The rules in `lib/rules.mjs` mirror the checks Tilefold makes when it loads a tile; the Tilefold app's own test suite checks the two still agree. `test/fake-host.mjs` runs a built tile against a fake Tilefold (settings, strings, notices, storage, overlays, sounds, network, keys and AI); copy it to test your own tiles.

## License

MIT. Tile Tools, its documentation and its examples are open source so tile authors can use them in their own projects and CI. Copy an example and make it your own.

**Your tiles are yours.** License a tile you write however you like, and put your copyright notice in the entry's opening comment: the build keeps it at the top of `main.js`. A `LICENSE` file in the tile's folder tells people what they may do with it.

**Tilefold itself** is licensed separately, under its End User License Agreement. From Tilefold 0.1.6 the app asks every user to accept it on first launch, and anyone can read it again under **Tilefold → License Agreement**. The agreement covers the app only. It says that tiles, including tiles written by other people, are governed by their own licenses, and that Tile Tools stays under MIT, so nothing in it limits what you do with your tiles or with this package.

## Test cases (TCs)

Run with `npm test` (667 tests in 31 files, all passing on 2026-10-13).

| Area | Covers |
|---|---|
| Rules | One default export, named exports and imports refused, size limit |
| Entry | Conventional order, named entry, missing entry, entry outside the folder |
| Finishing | Header and built-from line, export rewrite (multi-line and minified), legal comment kept once, named exports refused |
| Bundling | Local imports, npm packages, TypeScript, tree-shaking, syntax and resolve errors with location, minify |
| Commands | build writes and logs, `--check` fresh/stale/missing, folder without `tile.json`, validate, watch rebuilds and keeps the last good build |
| CLI | help, version, unknown command and option, extra argument, `--watch` with `--check`, named entry, stop function for a watch |
| Examples | Each ships a fresh build, has a valid tile.json (permissions with reasons, credentials only for hosts it asks for and never with a secret), uses exactly the messages it defines, registers up front with command ids; hello greets by name, break-timer rings, stops and resumes after a restart, with-npm-package makes IDs with the bundled nanoid |
| Example translations | Service Status, GitHub Inbox and Shell Tips in all twelve languages: the English keys exactly, the same variables, simple lines, and GitHub, Claude, Tilefold, host names and `tf.` calls kept as they are |
| Service Status | The status page read and checked, indicators and errors mapped by name; the tile asks through `tf.net.fetch` without a credential, reports each status and each failure, says so without tile networking, returns from the command at once and never overlaps checks, checks on an interval quietly and speaks on a change, stops when the interval is turned off, logs timed failures, speaks Japanese |
| GitHub Inbox | The request address, no Authorization header of its own, the page summary and messages, errors by name; the credential declared for api.github.com only; nothing sent without a token; the credential named on the request; the participating setting; a full page; refused, missing and lost tokens and Tilefold's other errors; no tile networking; no overlapping checks; German |
| Shell Tips | The question (system prompt, language, token limit, model), a conversation that continues the last tip, the topic fallback, tip clean-up, AI errors by name with "Don't send" kept quiet; the tile asks, shows, keeps and records a tip (count, not text), each AI error's notice, an empty answer, one question at a time while the user decides, the last tip shown again, no AI in this Tilefold, Japanese |
| Tilefold Pet | Run against the fake Tilefold with fake timers: appears on the focused pane's floor or stays hidden, roams, wanders to another pane, pat / play / drag / drop, naps and greets, commands, comes back after a restart, Korean and Japanese; characters, switching, barks by character and setting |
| Tilefall | Engine: every piece and rotation with wall kicks, seeded randomiser, board, line clears and scoring, levels and speed. Rendering of board, panel and buttons. Tile: settings and commands, the game loop, pause on blur, hide and resume, save and restore, sounds, buttons, every language's messages, a fresh build and source hygiene |
| Tuneboard | tile.json asks for Spotify's API host and declares the sign-in (the user's own app, no secret); every request goes through the `spotify` sign-in with no token of its own; Spotify's and Tilefold's errors mapped; sign-in noticed within seconds, a refused sign-in retried slowly, an old stored token cleared; requests Tilefold refuses (host not allowed) say where to allow it and are retried only now and then, through the real client; every card state, commands and shortcuts, polling, playing in a hidden tile page (ready, timeouts, errors, stopping), every language's messages, a fresh build and source hygiene |
| Fake host | `tf.net.fetch` answers and records requests with their credential, refuses a credential that isn't set up, `tf.auth.has`, `tf.ai.ask` records questions, fails without AI and can hold an answer back, notices and warnings recorded |
| tf types | `lib/tf.d.ts` parses as TypeScript and declares every `tf` member, every event and every error name the documentation lists |
| Package | Public and MIT-licensed, LICENSE shipped, bin/exports/types (including `./tf`) exist, only built files packed, MIT line in every shipped file |

## Known blockers

- Tilefold 0.1.6, which adds tile networking, keys, sign-ins and AI, is being released but is not on the update server yet (it still offers 0.1.5 as of 2026-10-13). Service Status, GitHub Inbox, Shell Tips and Tuneboard need it, and none of them has run in a real Tilefold yet: their tests use the fake host. The limits, error names and permissions in these docs were checked against the 0.1.6 source on 2026-10-13. Tuneboard's sign-in and playing in a tile page have run against a real Spotify account in a Tilefold development build (2026-10-13); Shell Tips has not asked the real Claude.
- Tuneboard 0.3.0 needs a Tilefold with tile pages, which is not released; Tilefold 0.1.6 refuses its `page` sign-in field. Don't merge it to `main` until that Tilefold ships.
- Tile Tools 0.2.0 (the `tf` types, the docs and the new examples) is prepared in this repository but not published; npm still has 0.1.0.
- `lib/tf.d.ts` is checked for syntax and coverage, not compiled against tiles with `tsc`.
- Publishing is manual for now (`npm publish` from the npm account `tilefold`); a CI workflow with trusted publishing and provenance is planned.
- No `new` (scaffold a tile) command yet.
- The command-line messages are English only.

Copyright (c) 2026 Tilefold
All rights reserved.
Last updated: 2026-10-13 by Tilefold
