# tile.json reference

Every tile folder has a `tile.json` next to its `main.js`. It says who the tile is, what it may reach outside its sandbox, and which keys or sign-ins it needs. Tilefold reads it before running any code, shows the user what it asks for, and checks every call against what the user allowed.

## A complete example

```json
{
  "id": "you.weather",
  "version": "1.2.0",
  "name": "%tile-name%",
  "description": "%tile-description%",
  "permissions": [
    { "window.overlay": "to show today's forecast in the corner of your pane" },
    { "net:api.example-weather.com": "to read the forecast for the city you choose" },
    { "ai.ask": "to summarise the week's forecast in one sentence" }
  ],
  "auth": {
    "weather": {
      "type": "apiKey",
      "header": "X-Api-Key",
      "hosts": ["api.example-weather.com"],
      "label": "Example Weather API key"
    }
  }
}
```

## Fields

Only `id` and `version` are required. Any field not listed here makes the tile fail to load, so a typo can't silently do nothing.

| Field | Required | What it is |
|---|---|---|
| `id` | yes | `publisher.name`, both parts lowercase: a letter, then letters, digits or hyphens, at most 64 characters each (`you.weather`, `acme.k8s-guard`). The publisher `tilefold` is reserved for tiles that ship with Tilefold. Keep it stable: Tilefold keeps the tile's settings, storage, keys and the user's consent under this id |
| `version` | yes | A SemVer version such as `1.0.0` or `2.1.0-beta.1` |
| `name` | no | What Settings → Tiles shows (at most 80 characters). Defaults to a title made from the id (`you.k8s-guard` → "K8s Guard") |
| `description` | no | One or two sentences (at most 200 characters) |
| `permissions` | no | What the tile may reach outside its sandbox (below). A tile that asks for nothing can still register commands, settings and listeners, translate, show notices, log, keep its own storage and record its activity |
| `auth` | no | API keys and sign-ins the tile needs (below) |
| `$schema` | no | Ignored by Tilefold, so your editor can point at a JSON schema |

**Translated name and description.** Write `"%tile-name%"` and Tilefold shows the `tile-name` message from the tile's `locales/<lang>/tile.ftl` in the user's language. Any message key works between the `%` signs.

## Permissions

Each entry is either a plain string, `"window.curtain"`, or a one-key object with your reason, `{ "window.curtain": "to cover Tilefold when you step away" }`. Always give the reason: Tilefold shows it next to the permission when it asks the user, and a reason is often what decides whether people allow a tile. Reasons are cut at 200 characters. A tile may ask for at most 64 permissions.

| Permission | Lets the tile | Risk shown |
|---|---|---|
| `window.curtain` | Cover Tilefold with a privacy curtain (`tf.curtain`) | low |
| `window.lock` | Make that curtain a lock that only the user's unlock methods open (`tf.curtain.show({ lock: true })`) | medium |
| `window.protect` | Leave Tilefold's window out of screen sharing and screenshots (`tf.window.protect`) | low |
| `window.overlay` | Draw pictures above the panes (`tf.overlay`) | low |
| `sound.play` | Play short sounds (`tf.sound.play`) | low |
| `net:<host>` | Send requests to that host with `tf.net.fetch` | shown per host |
| `ai.ask` | Ask Claude with the user's own Anthropic key (`tf.ai.ask`) | medium |
| `page` | Show a web page of its own from `page/`, in a window or hidden (`tf.page`; Tilefold 0.1.7) | medium |
| `script:<host>` | Let that page run scripts from that host (Tilefold 0.1.7) | shown per host |
| `pane.cwd` | Know the folder the focused pane is in (`tf.pane.cwd`, the `pane.cwd` event; Tilefold 0.1.9) | medium |
| `fs.list` | See the names in folders inside the panes' folders, never file contents (`tf.fs.list`; Tilefold 0.1.9) | medium |
| `viewer.open` | Open a file from the panes' folders in the document viewer (`tf.viewer.open`; Tilefold 0.1.9) | low |
| `window.panel` | Show a panel docked beside the panes, drawn by Tilefold from rows (`tf.panel`; Tilefold 0.1.9) | low |
| `browser` | Open web pages, local ones included, in a browser window Tilefold draws; the tile steers it but can't read it (`tf.browser`; Tilefold 0.1.11) | high |

**Network permissions.** `net:api.example.com` allows exactly that host. `net:*.example.com` allows every subdomain of `example.com`, but not `example.com` itself; ask for both if you need both. Hosts are lowercase domain names with at least two labels (use punycode for international names). These are refused, and Tilefold shows them as **not allowed**:

- `net:*` (every website);
- IP addresses, such as `net:192.168.1.10`;
- ports, such as `net:example.com:8443`;
- local names, such as `localhost` and names ending in `.local`, `.internal`, `.lan`, `.home.arpa` or `.arpa`.

**Permissions from later versions.** `run:`, `read:`, `write:`, `terminal.read`, `terminal.write`, `terminal.create`, `blocks.read`, `composer.read`, `composer.write`, `clipboard.read`, `clipboard.write`, `agent.run`, `mcp:` and `settings:` are recognised but not granted yet. A tile that asks for one loads and is told that it "needs a newer Tilefold". Anything else is an unknown permission and is never granted.

## auth: API keys and sign-ins

`auth` is an object of credentials, at most 8, keyed by a name you choose (lowercase letters, digits and hyphens, at most 32 characters). Your code refers to a credential by that name, `tf.net.fetch(url, { auth: "weather" })`, and Tilefold adds the secret to the request. The tile never sees it.

Every credential lists the `hosts` it may be sent to (1 to 8). Each host must also be covered by one of the tile's `net:` permissions, either exactly or by a `*.` pattern; otherwise the tile fails to load with `add "net:<host>" to permissions too`. A `label` (at most 80 characters) names the credential in Settings → Tiles; the name is used when there is none.

**`apiKey`: a key the user pastes.**

| Field | Required | What it is |
|---|---|---|
| `type` | yes | `"apiKey"` |
| `header` | yes | The header the key goes in, such as `"Authorization"` or `"X-Api-Key"`. `Host`, `Cookie`, `User-Agent`, connection headers and any `Proxy-` or `Sec-` header are refused |
| `scheme` | no | A word put before the key with one space, such as `"Bearer"` or `"Token"` |
| `hosts` | yes | Where the key may be sent |
| `label` | no | What Settings calls it, such as `"OpenAI API key"` |

**`oauth2-pkce`: the user signs in.** Tilefold runs an OAuth 2.0 authorization-code sign-in with PKCE in the user's browser, keeps the tokens in the system keychain, renews them, and sends `Authorization: Bearer <token>`.

| Field | Required | What it is |
|---|---|---|
| `type` | yes | `"oauth2-pkce"` |
| `authorizeUrl` | yes | The service's authorization address: `https`, a public host, the default port, no fragment |
| `tokenUrl` | yes | The service's token address (same rules) |
| `clientId` | yes | Your app's public client id; or `"user"`, so each user registers their own app; or `"dynamic"`, so Tilefold registers itself (RFC 7591) |
| `setupUrl` | with `"user"` only | A page where users create their own app; Settings links to it |
| `registrationUrl` | with `"dynamic"`, required then | The service's client registration address |
| `scopes` | no | Up to 32 scopes, each a word without spaces |
| `redirectPort` | no | A fixed loopback port from 1024 to 65535, for services that need the exact redirect address |
| `revokeUrl` | no | Where Tilefold revokes the token when the user signs out |
| `hosts` | yes | Where the token may be sent |
| `label` | no | What Settings calls the sign-in, such as `"Spotify"` |
| `page` | no | `true` gives the key or sign-in to the tile's page too (`window.tilefold.token`); needs the `page` permission. See [Tile pages](tile-pages.md) |

A `clientSecret` is always refused: a tile is a public client, and anything in a tile can be read by anyone who has it. [The network guide](network.md) covers the callback address and the three client-id modes.

## When the user is asked again

Tilefold remembers what the user allowed as a fingerprint of the tile's command ids, setting keys, the events it listens to, its permissions and its `auth` entries (header, scheme, hosts and sign-in settings). When a new version changes any of these, the tile waits for the user to allow it again. Changing titles, descriptions, translations or code alone does not ask again.

Changing where a key may be sent marks the saved key **Changed by the tile**, and the user enters it again, so a new version can't quietly send an old key somewhere new.

## Related

- [The `tf` API](tf-api.md)
- [Network, keys and sign-ins](network.md)
- [Asking Claude](ai.md)
- [Every limit and error name](limits-and-errors.md)

Copyright (c) 2026 Tilefold. Released under the MIT License.
