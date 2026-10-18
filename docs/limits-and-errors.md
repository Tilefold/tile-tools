# Limits and errors

Every limit Tilefold puts on a tile, and every error name a `tf` call can fail with, in one place. The other guides explain each one where it matters.

## Limits

**The tile**

| What | Limit |
|---|---|
| `main.js` | At most 2 MiB, one `export default`, no other `import` or `export` (Tile Tools checks this when it builds) |
| The tile's function (check and start) | Must return within 2 seconds |
| A command handler | 10 seconds; longer stops the tile |
| An event handler | 0.5 seconds; longer stops the tile, and a listener that runs over 5 times within 10 minutes is skipped for the session |
| Crashes | 3 within 5 minutes turn the tile off |
| Commands, settings, listeners | 50 of each |
| Screensaver themes | 12 (a tile asking for `screensaver.theme` may ask for nothing else) |
| Permissions | 64 |
| Credentials (`auth`) | 8, each sent to 1–8 hosts |

**Registrations**

| What | Limit |
|---|---|
| Command title | 120 characters |
| Command id | A lowercase letter, then lowercase letters, digits or hyphens; 64 characters |
| Shortcut | 40 characters; needs Ctrl, Alt or Meta, or is a function key |
| Setting key | A letter, then letters, digits, `_`, `.` or `-`; 64 characters |
| Setting description | 200 characters |
| Text setting value | 1,000 characters |
| Setting choices | 2–24; values 64 characters, labels 80 |

**Calls**

| Call | Limit |
|---|---|
| `tf.toast` | 300 characters; 5 in any 10 seconds |
| `tf.log.*` | 1,000 characters a line |
| `tf.audit` | Action: one word without dots, 64 characters; details: plain JSON, 4 KB |
| `tf.store` | Keys: 1–128 visible characters without spaces; values: plain JSON |
| `tf.curtain.show` | Message: 200 characters; `dim` 0–100 |
| `tf.overlay` | 8 items; 256 px a side; about 1 MB of pictures per scene; bubble and label 80 characters; moves up to 20 seconds; sprite sheets up to 64 frames at 30 fps; 60 changes a second |
| `tf.sound.play` | 400,000 characters of data URL (about 300 KB); 2 a second and 30 a minute |
| `tf.net.fetch` | `https` on port 443 only; URL 8 KB; 64 headers, each value 8 KB; body 1 MB; answer 4 MB; 30 seconds; 5 redirects; 4 at once and 60 a minute |
| `tf.ai.ask` | 1–50 messages; 200,000 characters; `maxTokens` 1–16,000 (default 4,096); 50,000 tokens per tile per day (UTC); a question waits at most 5 minutes for the user; an answer at most 2 minutes |
| `tf.panel.show` | 5,000 rows; title 120 characters, subtitle 512, labels 256, row ids 1,024 (unique), hints 512; 30 a second |
| `tf.screensaver.theme` | Id: a lowercase letter, then lowercase letters, digits or hyphens, 64 characters; name 60 characters; at most 30 frames a second; a frame must finish within 2 seconds |
| `tf.browser` | `http` and `https` addresses only, without a user name or password; 4,096 characters; one window or docked view per page; page names 1 to 32 lowercase letters, digits and dashes |
| `tf.fs.list`, `tf.viewer.open` | Paths inside a folder one of the user's panes is in; path 4,096 characters; 2,000 entries a listing; 60 calls (both together) in any 10 seconds |
| Sign-in (`oauth2-pkce`) | 5 minutes in the browser |

## Errors

A failed call rejects (or throws) an `Error`. Tell errors apart by **`err.name`**, never by the message.

| `name` | Thrown by | Means |
|---|---|---|
| `PermissionDeniedError` | Any call that needs a permission | The user hasn't allowed it, or the tile was turned off. Also recorded in the activity log |
| `RateLimitError` | `tf.toast`, `tf.overlay`, `tf.sound.play`, `tf.net.fetch`, `tf.ai.ask`, `tf.panel.show`, `tf.fs.list`, `tf.viewer.open` | Too many calls; slow down |
| `TypeError` | Any call | Bad arguments: a non-JSON store value, a malformed scene or clip, a body that isn't a string, a malformed or expired question |
| `NotSupportedError` | `tf.overlay`, `tf.sound`, `tf.curtain` (lock), `tf.ai.ask`, `tf.pane.cwd`, `tf.viewer.open`, `tf.panel`, `tf.browser` | This Tilefold, or this platform, can't do it |
| `LockNotSetUpError` | `tf.curtain.show({ lock: true })` | The user has no unlock method set up |
| `NetworkPolicyError` | `tf.net.fetch` | The request breaks a rule: `http:`, a port, an IP or local address, a forbidden header, a credential for a host it isn't bound to |
| `CredentialMissingError` | `tf.net.fetch` | The named key isn't set up, or the sign-in ended |
| `CredentialStoreError` | `tf.net.fetch` | The keychain couldn't be read |
| `TimeoutError` | `tf.net.fetch` | No complete answer within 30 seconds |
| `TooLargeError` | `tf.net.fetch` | The body is over 1 MB, or the answer over 4 MB |
| `NetworkError` | `tf.net.fetch`, `tf.ai.ask` | No connection, or the service failed |
| `AiNotSetUpError` | `tf.ai.ask` | No Anthropic key saved, or Anthropic refused it |
| `AiDeclinedError` | `tf.ai.ask` | The user chose **Don't send** |
| `BudgetExceededError` | `tf.ai.ask` | The tile used today's allowance |
| `RefusedError` | `tf.ai.ask` | The model declined to answer |
| `PathNotAllowedError` | `tf.fs.list`, `tf.viewer.open` | The path isn't inside a folder one of the user's panes is in (links are followed first), or isn't absolute |
| `NotFoundError` | `tf.fs.list`, `tf.viewer.open` | Nothing is at that path |
| `BrowserError` | `tf.browser` | The address was refused (not `http` or `https`, or with a user name and password), or the window isn't open |
| `NotADirectoryError` | `tf.fs.list` | The path is a file, not a folder |
| `NotAFileError` | `tf.viewer.open` | The path is a folder, not a file |
| `UnreadableError` | `tf.fs.list` | The folder exists but can't be read |

`tf.guard` and `tf.rewrite` throw a plain `Error` in this version: they are not available yet.

Copyright (c) 2026 Tilefold. Released under the MIT License.
