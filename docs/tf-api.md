# The tf API

A tile is one function. Tilefold calls it once with `tf`, the tile's only way to reach the app:

```js
export default (tf) => {
  tf.setting("name", "", tf.t("setting-name"));
  tf.command(tf.t("cmd-hello"), () => tf.toast(tf.t("hello", { name: tf.settings.get("name") })), {
    id: "say-hello",
  });
};
```

Everything else a Web Worker normally has for leaving its sandbox is removed: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `WebTransport`, `importScripts`, nested workers, `BroadcastChannel`, `indexedDB`, `caches` and `navigator.sendBeacon`. Timers, `Promise`, `Intl`, `TextEncoder`, `crypto.getRandomValues`, `atob` / `btoa` and the rest of the language are there.

For TypeScript, the types of everything below come with Tile Tools 0.2.0 and later: `import type { Tf } from "@tilefold/tile-tools/tf"`.

## How a tile runs

1. **The check (dry run).** When Tilefold loads a tile, it runs the function once in a dry run to learn what the tile adds. Handlers are never called, every `tf` call does nothing (and `tf.net.fetch` never settles), and the function must return within two seconds. Tilefold shows the user what the tile adds and asks for, and waits for them to allow it.
2. **The live run.** The tile's worker starts the first time it is needed: one of its commands runs, or an event it listens to happens. The function runs again, and must register **exactly the same things in the same order** as in the check. If it doesn't, the tile fails to start with "the tile registered different things than when it was checked".
3. **Handlers.** Tilefold calls your command and event handlers by id. Each one has a time budget: **half a second for an event, ten seconds for a command**. A handler that runs over its budget stops the tile's worker, because it may be stuck in a loop.
4. **Failures.** A tile that crashes three times within five minutes is turned off; the user turns it on again in Settings → Tiles. A listener that runs over its budget five times within ten minutes is skipped for the rest of the session.

So:

- **Register first.** Call `tf.command`, `tf.setting` and `tf.on` at the top of your function, before any `await`, and the same way every time. Don't register depending on settings, storage or the time of day.
- **Return quickly, work in the background.** A handler that starts something slow, such as a request, a question to Claude or an animation, should start it and return:

  ```js
  tf.command(tf.t("cmd-check"), () => {
    void check(); // check() is async and may take thirty seconds; the command returns at once
  }, { id: "check" });
  ```

- **Keep your own state in variables.** The worker keeps running between handler calls until Tilefold quits or the tile is turned off, so module-level variables and timers live on.
- **Use `tf.store` for what must survive a restart.**

## Registering

### tf.command(title, handler, options?)

Adds a command to the palette.

| Argument | |
|---|---|
| `title` | What the palette shows, at most 120 characters. Translate it with `tf.t` |
| `handler` | `() => void \| Promise<void>`, with ten seconds to finish |
| `options.id` | A short id, unique within the tile: a lowercase letter, then lowercase letters, digits or hyphens. Made from the title when left out, which breaks when the title is translated, so **always give one** |
| `options.key` | A default shortcut: one string for every platform, or `{ mac, other }` |

Shortcuts are modifiers (`Ctrl`, `Alt`, `Shift`, `Meta`) and one key, joined by `+`: `"Ctrl+Alt+N"`, `{ mac: "Alt+Meta+H", other: "Ctrl+Alt+H" }`. `Meta` is ⌘ on macOS. Keys are physical keys, so they work on any keyboard layout: `A`–`Z`, `0`–`9`, `F1`–`F12`, and names such as `ArrowUp`, `Enter`, `Tab`, `Comma`, `BracketLeft` and `Space`. Every shortcut needs `Ctrl`, `Alt` or `Meta` (or is a function key), so it can never swallow typing. Users can change the shortcut in Settings → Keyboard, where tile commands have their own group. Tiles never see key presses; a shortcut runs the command.

### tf.setting(key, default, description, options?)

Adds a setting under the tile's card in Settings → Tiles.

| Argument | |
|---|---|
| `key` | A letter, then letters, digits, `_`, `.` or `-`, at most 64 characters, unique within the tile |
| `default` | `true` / `false` gives a switch, a number gives a number box, text (at most 1,000 characters) gives a text box |
| `description` | The label, at most 200 characters. Translate it with `tf.t` |
| `options.choices` | A drop-down instead: 2 to 24 entries, each a string or `{ value, label }` (values at most 64 characters, labels at most 80). The default must be one of the values |

```js
tf.setting("corner", "bottom-right", tf.t("setting-corner"), {
  choices: [
    { value: "bottom-right", label: tf.t("corner-bottom-right") },
    { value: "bottom-left", label: tf.t("corner-bottom-left") },
  ],
});
```

### tf.settings.get(key)

The setting's current value, at once (not a promise): the user's value when it fits the setting's type, otherwise the default. When the user changes a setting, the tile gets `setting.changed` with `{ key }`.

### tf.on(event, handler)

Listens to an event. `handler(payload)` has half a second to finish. A tile may register at most 50 commands, 50 settings and 50 listeners.

| Event | When | Payload |
|---|---|---|
| `app.ready` | Tilefold has started and loaded its tiles; also after **Reload tiles** and after the user changes the language, when tiles are loaded again | `{}` |
| `window.focused` | Tilefold's window gains focus | `{}` |
| `window.blurred` | Tilefold's window loses focus | `{}` |
| `user.idle` | Once for every whole minute without keyboard or pointer input | `{ minutes }` |
| `user.active` | Input comes back after at least a minute idle | `{}` |
| `setting.changed` | The user changed one of this tile's settings | `{ key }` |
| `curtain.dismissed` | The user dismissed this tile's curtain | `{}` |
| `overlay.pointer` | The user clicked or dragged one of this tile's overlay items | `{ item, type, x, y }` |
| `overlay.layout` | The panes moved, opened, closed or changed focus | the layout |
| `overlay.hidden` | The user hid this tile's overlay | `{ by: "user" }` |
| `page.message` | The tile's page sent a message (`window.tilefold.post`) | `{ message }` |
| `page.closed` | The tile's page closed, whatever closed it | `{}` |
| `pane.cwd` | The focused pane's folder changed: another pane or tab, or a `cd` (needs `pane.cwd`; Tilefold 0.1.9) | `{ path }`, `null` when none is known |
| `pane.list` | A pane opened, closed, was renamed, moved folder or took focus (needs `pane.list`; Tilefold 0.1.11) | `{ panes }`: `[{ session, name, folder, focused }]` |
| `panel.click` | A row of the tile's docked panel was clicked (needs `window.panel`; Tilefold 0.1.9) | `{ row, action }`, action `activate`, `expand` or `collapse` |
| `panel.closed` | The user closed the tile's panel, or another tile's panel replaced it | `{ by }`, `user` or `replaced` |

Events carry only these facts. A tile never learns which key was pressed, where the pointer is outside its own items, or what a pane shows.

`tf.guard` and `tf.rewrite` (stopping or changing what happens) are planned and throw in this version.

## Strings: tf.t(key, args?)

Formats a message from the tile's `locales/<lang>/tile.ftl` in the user's language, falling back to English (`locales/en/tile.ftl`), and returns it at once. A missing key returns the key itself.

```ftl
# locales/en/tile.ftl
cmd-hello = Hello: Say hello
hello = Hello, { $name }!
unread = { $count ->
    [one] One unread message
   *[other] { $count } unread messages
}
```

```js
tf.t("hello", { name: "Ada" }); // "Hello, Ada!"
tf.t("unread", { count: 3 }); // "3 unread messages", numbers formatted for the user's language
```

Messages are [Fluent](https://projectfluent.org). Variables, plurals and other selectors, message references and terms work. Like Fluent, `tf.t` wraps each variable in invisible isolation marks (U+2068, U+2069) when it is mixed with text, so right-to-left and left-to-right text don't mix up. Compare translated strings in tests with a pattern, not an exact string. Tilefold's languages are `en`, `es`, `fr`, `de`, `pt-BR`, `it`, `ja`, `ko`, `zh-CN`, `ru`, `ar` (right to left) and `hi`.

## Talking to the user

### tf.toast(message)

Shows a short notice, at most 300 characters. A tile may show 5 notices in 10 seconds; more fail with `RateLimitError`.

### tf.log.info(text) · tf.log.warn(text) · tf.log.error(text)

Writes a line (at most 1,000 characters) to the tile's **Log** in Settings → Tiles. For you and for curious users; not shown otherwise.

### tf.audit(action, details?)

Adds a record to Tilefold's activity log, which users can read and export. `action` is one word of letters, digits and hyphens with no dots (`"status-changed"`). It is recorded as `tile.<tile id>.<action>`, with your tile id and version. `details` is plain JSON, at most 4 KB.

Record what the tile **did** (checked, sent, changed). Never record secrets, and think twice before recording what the user typed or what a service sent back: a count is usually enough.

## Storage: tf.store

The tile's own key-value storage, kept by Tilefold across restarts and separate from every other tile's.

| Call | Returns |
|---|---|
| `tf.store.get(key)` | The value, or `null` when there is none |
| `tf.store.set(key, value)` | `null`. The value must be plain JSON (objects, arrays, strings, finite numbers, booleans, `null`) |
| `tf.store.delete(key)` | `true` when there was a value |

Keys are 1 to 128 visible characters without spaces. Don't keep API keys or tokens here; declare them in `tile.json` and let Tilefold keep them in the keychain.

## The window

### tf.curtain.show(options?) · tf.curtain.hide()

Needs `window.curtain`. Covers Tilefold with a blurred curtain, for example when the user steps away.

| Option | |
|---|---|
| `message` | A short message on the curtain (at most 200 characters) |
| `plain` | `true` for the blur only, without a message |
| `dim` | How dark the tint is, 0 to 100 |
| `lock` | `true` (needs `window.lock` too) makes it a lock that only the user's unlock methods open: their passcode, Touch ID or Mac password, set in Settings → Screen lock |

`hide()` takes down only this tile's curtain, and never a lock: a lock opens only for the user. When the user dismisses the curtain, the tile gets `curtain.dismissed`. Turning the tile off takes its curtain down, but not its lock. Locking fails with `LockNotSetUpError` when the user hasn't set up an unlock method, and with `NotSupportedError` where Tilefold has no screen lock.

### tf.window.protect(on)

Needs `window.protect`. `true` leaves Tilefold's window out of screen sharing, recordings and screenshots; `false` undoes it, but only if this tile turned it on. Turning the tile off undoes it too.

## Pictures and sounds

`tf.overlay` draws pictures and animations above the panes (`window.overlay`), and `tf.sound.play` plays short sounds (`sound.play`). Both are in [Overlays and sounds](overlays-and-sounds.md).

## The internet, keys and sign-ins

`tf.net.fetch(url, init?)` sends a request through Tilefold to a host the tile asked for with `net:<host>`. `tf.auth.has(name)` says whether the user has entered a key or signed in for a credential declared in `tile.json`. Both are in [Network, keys and sign-ins](network.md).

## A web page of its own

`tf.page.open(options?)`, `tf.page.close()` and `tf.page.post(message)` show the tile's own web page from its `page/` folder, in a window or hidden, and talk to it with messages (`page`, Tilefold 0.1.7). See [Tile pages](tile-pages.md).

## A docked panel

`tf.panel.show({ title, subtitle, rows })` docks a panel beside the panes that Tilefold draws from your rows, and `tf.panel.hide()` takes it away (`window.panel`, Tilefold 0.1.9). See [Panels](panels.md).

## Your folders

`tf.pane.cwd()` gives the folder the focused pane is in (`pane.cwd`), `tf.pane.list()` every pane with its name, folder and session (`pane.list`, Tilefold 0.1.11), `tf.fs.list(path)` lists the names in a folder (`fs.list`), and `tf.viewer.open(path)` shows a file in the document viewer (`viewer.open`), only inside folders the user's panes are in (Tilefold 0.1.9). See [Folders](folders.md).

## Asking Claude

`tf.ai.ask(prompt | { system, messages, maxTokens, model })` asks Claude with the user's own Anthropic key, after showing the user the question. See [Asking Claude](ai.md).

## Errors

Every `tf` call that fails rejects (or throws) an `Error` whose **`name`** says why. Check the name, never the message: messages may change and may be translated.

```js
try {
  await tf.curtain.show({ lock: true });
} catch (err) {
  if (err.name === "LockNotSetUpError") await tf.toast(tf.t("set-up-lock"));
  else throw err;
}
```

A call the user hasn't allowed fails with `PermissionDeniedError`, which is also recorded in the activity log. [Limits and errors](limits-and-errors.md) lists every name.

## Checking for features

A tile may run on an older Tilefold. `tf.net`, `tf.auth` and `tf.ai` are missing on a Tilefold without tile networking and AI, and `tf.page` before Tilefold 0.1.7, so check before using them and tell the user to update:

```js
if (!tf.net) return tf.toast(tf.t("update-tilefold"));
```

Copyright (c) 2026 Tilefold. Released under the MIT License.
