# Network, keys and sign-ins

Tiles can't go online by themselves: `fetch`, `XMLHttpRequest` and `WebSocket` are removed from their sandbox. A tile names each host it needs in `tile.json`, the user allows them, and the tile calls `tf.net.fetch`. Tilefold sends the request itself, after checking it against what the user allowed, and records it in the activity log.

When a service needs an API key or a sign-in, the tile declares it in `tile.json`. The user enters the key or signs in through Tilefold, Tilefold keeps it in the system keychain, and Tilefold adds it to the tile's requests. **The tile never sees the key or token**, so it can't leak it, log it or send it anywhere else.

Three examples show the three cases:

| Example | Shows |
|---|---|
| `examples/service-status` | A public API with no key: `net:` and `tf.net.fetch` |
| `examples/github-inbox` | An API key the user pastes: `auth` with `apiKey`, `{ auth: "github" }`, `tf.auth.has` |
| `examples/tuneboard` | A sign-in: `auth` with `oauth2-pkce`, the user's own app (`clientId: "user"`) |

## 1. Ask for the host

```json
"permissions": [{ "net:api.example.com": "to read the forecast for the city you choose" }]
```

`net:*.example.com` covers every subdomain of `example.com` (not `example.com` itself). `net:*`, IP addresses, ports and local names such as `localhost` or `printer.local` are refused. The user sees **Connect to api.example.com over the internet** with your reason. The [tile.json reference](tile-json.md) has the exact rules.

## 2. Send requests

```js
const res = await tf.net.fetch("https://api.example.com/v1/forecast?city=Lisbon", {
  method: "POST", // GET (default), HEAD, POST, PUT, PATCH or DELETE
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ days: 3 }), // a string
});
if (res.ok) {
  const forecast = await res.json();
}
```

**Options:** `method`; `headers` as an object of strings (also a list of pairs or a `Headers` object), at most 64 headers; `body` as a string, at most 1 MB (send bytes as base64 text); `auth`, the name of a credential (step 3).

**The response** looks like a small `Response`:

| Field | |
|---|---|
| `status`, `statusText` | As the server sent them |
| `ok` | `true` for 200–299. A 404 or a 500 still resolves, with `ok` false |
| `url` | The final address, after redirects |
| `headers` | A plain object with lowercase names; repeated headers are joined with `, ` (`res.headers["retry-after"]`). `Set-Cookie` is never passed on |
| `text()`, `json()`, `bytes()` | The body as text, parsed JSON, or a `Uint8Array`. Each can be read more than once |

**What Tilefold enforces on every request:**

- only `https`, only hosts the user allowed, never a port other than 443;
- never an address on the user's own computer or network, even when a public name points there (the check is made on the resolved address);
- redirects are followed by Tilefold, at most 5, and each new host is checked again (a 303, or a 301 or 302 after a POST, turns the request into a GET, as browsers do);
- no cookies are kept, and no system proxy is used;
- you can't set `Host`, `Cookie`, `User-Agent`, `Content-Length`, connection headers or any `Proxy-` or `Sec-` header. Tilefold names your tile in `User-Agent`;
- the URL may be at most 8 KB, and each header value at most 8 KB;
- the response may be at most 4 MB and must arrive within 30 seconds;
- a tile may have 4 requests under way at once and send 60 a minute.

Each request is recorded in the activity log as `tile.net.fetch` with the host, the path **without** the query string, the result and the size; refusals as `tile.net.denied` with the reason. Bodies are never recorded. Still, don't put secrets in addresses; use a credential.

**In the dry run** (when Tilefold checks the tile) nothing is sent and `tf.net.fetch` never settles, so don't wait for a request at the top of your function.

## 3. Keys the user pastes (apiKey)

Declare the key in `tile.json`. Its hosts must also be `net:` permissions.

```json
"permissions": [{ "net:api.github.com": "to count your unread notifications" }],
"auth": {
  "github": {
    "type": "apiKey",
    "header": "Authorization",
    "scheme": "Bearer",
    "hosts": ["api.github.com"],
    "label": "GitHub token (classic, notifications scope)"
  }
}
```

The user sees **Use a key you enter in Settings → Tiles (GitHub token…), sent only to api.github.com** when they allow the tile, and pastes the key under **Keys** on the tile's card. Then:

```js
if (!(await tf.auth.has("github"))) {
  await tf.toast(tf.t("add-your-token")); // tell the user where to add it
  return;
}
const res = await tf.net.fetch("https://api.github.com/notifications", { auth: "github" });
if (res.status === 401) {
  // The service refused the key: ask the user to replace it.
}
```

Tilefold adds `Authorization: Bearer <key>` (the `header` you declared, with the `scheme` before the key) and marks the header as sensitive. Don't set that header yourself.

- `tf.auth.has(name)` tells whether the user has set the credential up. It never returns the key.
- A request naming a credential the user hasn't set up fails with `CredentialMissingError`.
- Naming a credential for a host it isn't bound to fails with `NetworkPolicyError`.
- If a new version of the tile changes where a key may be sent, the saved key shows **Changed by the tile** and isn't used until the user enters it again.
- Removing the tile removes its keys.

## 4. Sign-ins (oauth2-pkce)

For services where users sign in, such as Spotify or GitHub's OAuth apps, declare an OAuth 2.0 sign-in with PKCE:

```json
"permissions": [{ "net:api.spotify.com": "to show what is playing" }],
"auth": {
  "spotify": {
    "type": "oauth2-pkce",
    "authorizeUrl": "https://accounts.spotify.com/authorize",
    "tokenUrl": "https://accounts.spotify.com/api/token",
    "clientId": "your-client-id",
    "scopes": ["user-read-playback-state"],
    "hosts": ["api.spotify.com"],
    "label": "Spotify"
  }
}
```

The tile's card then shows **Sign in…** under **Keys**. Tilefold opens the service's own page in the user's browser, so the password is typed there and never into Tilefold or your tile. When the user agrees, the browser comes back to a one-time listener on `127.0.0.1`, and Tilefold exchanges the code for tokens, keeps them in the keychain and shows **Signed in**. The user has five minutes to finish.

Use it like a key: `tf.net.fetch(url, { auth: "spotify" })`. Tilefold sends `Authorization: Bearer <access token>` and renews the token by itself when a request needs it. When renewing fails (the user revoked access, say), requests fail with `CredentialMissingError` until the user signs in again; `tf.auth.has` tells you whether they are signed in. **Sign out** forgets the tokens and, when you give a `revokeUrl`, ends the sign-in at the service too.

**The callback address.** Tilefold uses `http://127.0.0.1:<port>/callback`. The port comes from your tile id and the credential name, so it is the same on every computer and you register it with the service once. Find it on your tile's card in Settings → Tiles, under **Details for developers**. To choose the port yourself, set `redirectPort` (1024–65535). Services that accept any loopback port (as OAuth for native apps recommends) can register `http://127.0.0.1/callback`.

**Three ways to get a client id:**

| `clientId` | When | What the user does |
|---|---|---|
| Your app's id | You register one public app with the service, and it can serve all your users | Clicks **Sign in…** |
| `"user"`, with `setupUrl` | The service limits how many people one app may serve (Spotify's development mode, for example) | Follows **Set up your own app**: **Open setup page**, create an app there, **Copy** the callback address into it, paste the app's client id back, then **Sign in…**. Once |
| `"dynamic"`, with `registrationUrl` | The service lets apps register themselves (RFC 7591) | Clicks **Sign in…**; Tilefold registers itself the first time and keeps the client |

**Never ship a client secret.** Tilefold refuses a `clientSecret` in `tile.json`: anything in a tile can be read by anyone who has it. Register your app as a public client with PKCE.

## 5. Errors

Every failed request rejects with an `Error` whose `name` says why. Answers with an error status (404, 500…) are not errors: they resolve with `ok` false.

| `name` | Why | What to do |
|---|---|---|
| `PermissionDeniedError` | The host isn't one the user allowed, or the tile was turned off | Tell the user to allow it in Settings → Tiles |
| `NetworkPolicyError` | The request breaks a rule: `http:`, a port, an IP or local address, a forbidden header, or a credential sent to a host it isn't bound to | Fix the request; this is a bug in the tile |
| `CredentialMissingError` | The named key isn't set up, or the sign-in ended | Ask the user to add the key or sign in |
| `CredentialStoreError` | The keychain couldn't be read | Ask the user to enter the key again |
| `RateLimitError` | More than 4 requests at once or 60 a minute | Slow down; poll less often |
| `TimeoutError` | No complete answer within 30 seconds | Try again later |
| `TooLargeError` | The request body is over 1 MB or the answer over 4 MB | Ask for less (paging, filters) |
| `NetworkError` | No connection, DNS failure, TLS failure… | Try again later |
| `TypeError` | Bad arguments, such as a body that isn't a string | Fix the call |

```js
try {
  res = await tf.net.fetch(url, { auth: "github" });
} catch (err) {
  switch (err.name) {
    case "CredentialMissingError":
      return tf.toast(tf.t("add-your-token"));
    case "RateLimitError":
      return; // try again on the next tick
    default:
      return tf.toast(tf.t("could-not-connect"));
  }
}
```

## Good habits

- **Return from handlers at once.** A request can take 30 seconds and a command has 10: start the work with `void doIt()` and return.
- **Check `tf.net` exists** before using it, so the tile tells users of an older Tilefold to update instead of failing.
- **Poll gently.** Every few seconds at most, and only while it matters (while the tile's overlay is shown, say). Read `res.headers["retry-after"]` and back off when a service asks.
- **Keep keys out of code and storage.** Declare them in `auth`; never put them in `tf.store`, settings, URLs or logs.
- **Record what happened, not what was said.** A count or a status code in `tf.audit` is enough.

## Testing

`test/fake-host.mjs` in this repository runs a built tile against a fake Tilefold. Give it `net` to answer requests and `credentials` for the keys the user has set up; it records each request with the credential it names and fails one naming a missing credential with `CredentialMissingError`, as Tilefold does. The tests of the three examples above show how.

Copyright (c) 2026 Tilefold. Released under the MIT License.
