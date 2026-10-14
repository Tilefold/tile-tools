# Example tiles

Sixteen tiles that show the common cases, from a few lines to full tiles with their own test suites. Each has its sources in `src/`, its strings in `locales/` and the built `main.js` checked in, so you can try one without building it: copy its folder into your tiles folder (Settings → Tiles → Open tiles folder, usually `~/.tilefold/tiles/`), then click **Reload tiles** and **Allow**.

To build one yourself:

```sh
cd examples/hello
npx @tilefold/tile-tools build          # or: node ../../bin/tilefold-tile.mjs build
```

For `with-npm-package`, run `npm install` in its folder first, then `npm run build`.

## The examples

| Example | What it shows | Needs Tilefold | Try |
|---|---|---|---|
| `hello` | The basics in plain JavaScript: a helper module, a setting, a command with an id, translated messages with a variable | any | Set your name in its settings, then run **Hello: Say hello** |
| `break-timer` | TypeScript across three files, timers, `tf.store` so a reminder survives a restart, an `app.ready` listener | any | Set the minutes, run **Break Timer: Start** |
| `with-npm-package` | An npm package (`nanoid`) bundled into `main.js`, with its own `build`, `watch` and `check` scripts | any | Run **ID Maker: New ID** |
| `tilefold-pet` | A pet that roams over your panes: overlays and sounds, drop-down settings, background work, SVG drawn in code | 0.1.4 | Pat it, double-click it, drag it |
| `tilefall` | A game split into a pure engine, SVG rendering and a thin tile layer; commands with shortcuts, overlay buttons, a saved game, sounds | 0.1.4 | **Tilefall: New game** (⌃⌥N) |
| `orbit-guard`, `brickfold`, `girder-jump` | Three arcade games on a shared kit: a seeded engine, the board as one SVG, a button row, sounds made in code, the best score kept | 0.1.4 | **Orbit Guard** (⌃⌥I), **Brickfold** (⌃⌥F), **Girder Jump** (⌃⌥J): Show or hide |
| `service-status` | The internet without a key: `tf.net.fetch` against a public status page, errors by name, quiet interval checks | 0.1.6 | **Service Status: Check GitHub now** |
| `github-inbox` | An API key the tile never sees: `auth` with `apiKey`, `tf.auth.has`, a missing token told from a refused one | 0.1.6 | Add a token (below), then **GitHub Inbox: Check notifications** |
| `shell-tips` | Asking Claude: `tf.ai.ask` with a system prompt, a continued conversation, the fast model, "Don't send" as a choice | 0.1.6 | Save your Anthropic key in Settings → AI, then **Shell Tips: New tip** |
| `weather-card` | The internet and Claude on a card: two public hosts, an optional one-line summary, checks only while shown | 0.1.6 | Set a place (below), then **Weather Card: Show or hide** (⌃⌥W) |
| `pipeline-board` | A sign-in with the user's own app (GitLab), status notices, back-off on rate limits | 0.1.6 | Sign in (below), then **Pipeline Board: Show or hide** (⌃⌥L) |
| `tuneboard` | A sign-in (Spotify), a now-playing card, a player and a playlist window in a tile page | 0.1.7 | Sign in (below), then **Tuneboard: Show or hide** |
| `watchpane` | Someone else's player in a tile page opened with a web address, built from `page-src/` into one script | 0.1.9 | **Watchpane: Open** (⌃⌥Y), paste a YouTube link |
| `folder-tree` | A docked panel drawn by Tilefold from rows, following the pane's folder, listing folders and opening files in the viewer | 0.1.9 | **Folder Tree: Show or hide** (⌃⌥T) |

## Setting up the ones that need an account

**GitHub Inbox: a GitHub token.** Create a classic personal access token at github.com → Settings → Developer settings → Personal access tokens, with only the `notifications` scope. In Tilefold, paste it under **Keys** on GitHub Inbox's card in Settings → Tiles and click **Save**. Tilefold keeps it in your keychain; the tile only learns that a token is there.

**Weather Card: place and summary.** Type a city under **Place** in Weather Card's settings; the card looks it up once and remembers it. The one-line summary is off until you turn it on, needs your Anthropic key in Settings → AI, and Tilefold shows you the question before anything is sent.

**Pipeline Board: signing in to GitLab.** In Settings → Tiles, find **Set up your own app** under **Keys** on Pipeline Board's card. Click **Open setup page** to reach your GitLab applications, add an application, paste the callback address Tilefold shows as the redirect URI, untick **Confidential**, tick only `read_api` and save. Paste the **Application ID** back into Tilefold and click **Sign in…**. It reads gitlab.com only; for a self-managed GitLab, copy the tile and change the addresses in its `tile.json`.

**Tuneboard: signing in to Spotify.** In Settings → Tiles, find **Set up your own app** under **Keys** on Tuneboard's card. Click **Open setup page**, create an app at the Spotify developer dashboard, and paste the callback address Tilefold shows as the app's redirect URI. Paste the app's Client ID back into Tilefold and click **Sign in…**. Controlling playback needs Spotify Premium. **Tuneboard: Play in Tilefold** plays inside Tilefold as a device named "Tilefold"; **Tuneboard: Show playlists** opens your playlists in a window. Tuneboard 0.4.0 asks to read your playlists, so sign in again after updating. Playlists Spotify makes for you (such as Discover Weekly) may be listed but fail to play.

## Making them your own

**The pet.** Each character is one file in `tilefold-pet/src/characters/`: its name, pace, optional bark and its poses as small SVG pictures. Copy one, change the drawing, add it to `characters/index.js` with a `setting-character-<id>` message in each locale, give the tile your own `id`, and build.

**The arcade kit.** Orbit Guard, Brickfold and Girder Jump share six files (`tile/arcade.js`, `tile/layout.js`, `tile/settings.js`, `tile/sound.js`, `render/svg.js`, `engine/rng.js`), copied into each game so every folder works on its own; a test keeps the copies identical. A game brings a pure engine (`create(seed)` returning `{ state, act(action), step(ms) }`), a renderer that draws `state` as one SVG, and its moves with their keys, buttons and sounds. Copy a game, replace `engine/` and `render/board.js`, list your moves, and give it its own `id`.

**Shortcuts.** When two commands claim the same keys, the one loaded first wins, so every example has its own default and a test checks that no two share one. Users can change any of them in Settings → Keyboard.

## What has been tried for real

Every example is tested against a fake Tilefold (`test/fake-host.mjs`). Beyond that:

- Tuneboard has signed in, played and listed playlists against a real Spotify account in a Tilefold development build.
- Folder Tree has run in a development build of Tilefold 0.1.9.
- Watchpane's approach played a video in a test app; Watchpane itself is still to be tried in Tilefold 0.1.9. On 0.1.7 and 0.1.8 YouTube refuses its page (error 153).
- On Tilefold 0.1.6, Tuneboard 0.3.0 and later don't load; use Tuneboard 0.2.1 from this repository's history (commit `9ddcd9d`).
- Pipeline Board hasn't signed in to a real GitLab, Shell Tips and Weather Card haven't asked the real Claude, and the arcade games' speeds and timing are still to be tuned in a real Tilefold.
