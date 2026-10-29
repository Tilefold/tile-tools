# Room relay

An open room relay for Tilefold tiles that do something live with other people: it makes rooms with a short code, lets a few people into each, and passes what one sends to the others. It knows nothing about what is sent, so one relay serves a game, a chat or anything else.

```sh
node relay/server.mjs --port 8787
```

It needs Node.js 22 or later and nothing installed. Tiles reach it only over `wss://` on port 443, so a public relay sits behind something that adds TLS, such as Caddy.

| File | What it does |
|---|---|
| `rooms.mjs` | The protocol: rooms, codes, joining, messages, limits, expiry, `authorize` |
| `ws.mjs` | A small WebSocket server on Node's own `http` and `crypto`, with a heartbeat |
| `server.mjs` | The command: options, `GET /health`, the sweep for unused rooms, the activity log |

[Live tiles with other people](../docs/room-relay.md) has the protocol, a page's side of it, the options, and how to make the relay reachable and ask for an account.

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-28 by Tilefold
