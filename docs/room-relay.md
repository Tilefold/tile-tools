# Live tiles with other people: the room relay

A tile can do something live with other people, such as a game, a chat or a shared timer, through a **room relay**. A room relay is a small server that passes messages between the people in a room and knows nothing about what they mean. The Gomoku example (`examples/gomoku`) plays through one.

This page covers the protocol, how a tile reaches a relay, and how to run your own relay. The open relay in this repository's `relay/` folder speaks the protocol, and so does Tilefold's own relay at `wss://play.tilefold.com/rooms`.

## How a tile reaches a relay

Tiles can't open sockets: the tile's code has no `WebSocket`, and `tf.net.fetch` only makes requests. A tile's **page** can, though. Its page keeps one `WebSocket` open to the relay, and the page and the tile talk through `window.tilefold` (see [Tile pages](tile-pages.md)).

The page may connect only to a host the tile asks for, and the user allows:

```json
"permissions": [
  "page",
  { "net:play.example.com": "to pass your moves to the other player through the game server" }
]
```

The address must be `wss://` on the default port (443). Tilefold refuses plain `ws://`, other ports and local names, so a relay on your own machine needs TLS in front of it and a public name (below).

## The protocol (version 1)

Every frame is one JSON object as text.

| To the relay | From the relay |
|---|---|
| `{ op: "create", app, size, name }` | `{ op: "created", room, you }` |
| `{ op: "join", room, app, name }` | `{ op: "joined", room, you, members }` |
| `{ op: "send", data }` | `{ op: "message", from, data }` to everyone else in the room |
| `{ op: "leave" }` | `{ op: "member-joined", member }` and `{ op: "member-left", member }` to the others |
| `{ op: "ping" }` | `{ op: "pong" }` |
| | `{ op: "error", code }` |

- **`app`** names the kind of room, such as `"gomoku"` or `"chat"`: lowercase letters, digits, `.`, `_` and `-`, up to 64. A code from one tile's room can't put someone in another tile's room: joining with a different `app` answers `wrong-app`.
- **`size`** is how many people may be in the room at once, 2 to 8 (2 if left out). One more answers `room-full`.
- **`room`** is a six-character code from `ACDEFGHJKMNPQRTUVWXY34679`, with no look-alikes such as 0 and O. Joining accepts it in any case. Show it as `K7P-4QX` if you like, and strip the dash before joining.
- **`name`** is what the others see, trimmed and cut to 40 characters.
- **`you`, `from` and member ids** name connections, not people. Someone who reconnects gets a new id, so put a lasting id of your own in your messages if you need one (Gomoku sends a random player id in its `hi` message).
- **`members`** lists the others already in the room as `{ id, name }`.
- **`data`** is any JSON value. The relay passes it on unchanged and never looks inside.
- A connection is in **one room at most**: creating or joining another leaves the first, and the others there hear `member-left`.
- Closing the connection leaves the room too.

### Error codes

| Code | Why |
|---|---|
| `no-room` | No room has that code, or it expired |
| `room-full` | The room has `size` people in it already |
| `wrong-app` | The room is another kind (`app`) |
| `bad-request` | The frame isn't one of the above: not JSON, a missing field, `send` while in no room |
| `too-large` | The frame is longer than 16 KiB |
| `too-fast` | More than 30 frames in a burst, or 10 a second after that; or the relay has as many rooms as it can hold |
| `unauthorized` | The relay needs an account and this connection has none |

### Rooms coming and going

A room stays while anyone uses it. Once nobody has sent anything in it for **24 hours**, it expires and its code answers `no-room`. An empty room is kept until then, so a player whose connection dropped can come back to it.

## Writing the page's side

A dependable client does four things. Gomoku's `page-src/relay.js` does all four in about 150 lines, and you may copy it (MIT):

1. **Reconnect** after a drop, waiting longer each time (1, 2, 4, 8, then every 15 seconds), and tell the user while it's offline.
2. **Join again** after each reconnect, with the code you kept, since the new connection is in no room.
3. **Ping** about once a minute. A relay closes a connection that sends nothing through two of its heartbeats (a minute on the open relay).
4. **Catch up.** Messages sent while someone was away are not kept. When someone joins or comes back, have the boards (or chat windows) send each other what they have, as Gomoku's `sync` message does. Keep what the page needs to come back (the code and the state) through the tile (`tf.store`), so closing the page or quitting Tilefold doesn't lose it.

Anyone can send anything to a room they're in, so **check what arrives**. Gomoku replays each move against the rules before believing it.

Keep names, codes and messages out of the activity log. Record one-word actions instead, such as `created`, `won` or `left`.

## Running your own relay

The open relay needs Node.js 22 or later and nothing else installed:

```sh
node relay/server.mjs --port 8787
```

It listens on this machine only (`127.0.0.1`), at `ws://127.0.0.1:8787/rooms`. `GET /health` answers `{ ok, rooms, connections }` for a load balancer or a monitor. Each step goes to standard output as one JSON line, such as `{"ts":"…","action":"joined","app":"gomoku","members":2}`. Names, codes and messages are never written.

| Option | Environment | Default |
|---|---|---|
| `--port` | `PORT` | `8787` |
| `--host` | `HOST` | `127.0.0.1` |
| `--path` | `RELAY_PATH` | `/rooms` |
| | `ALLOW_ORIGINS` | every page origin (a comma-separated list limits it) |

Rooms live in the relay's memory: restarting it empties them, and the pages' reconnects then answer `no-room`. One relay process holds up to 10,000 rooms.

### Making it reachable from tiles

Tiles need `wss://` on port 443 with a real certificate, so put the relay behind something that adds TLS and passes WebSocket upgrades through. With [Caddy](https://caddyserver.com), which gets the certificate by itself, the whole configuration is:

```
games.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

Then point your tile at `wss://games.example.com/rooms` and ask for `net:games.example.com`. nginx works too (`proxy_http_version 1.1` and the `Upgrade` and `Connection` headers), as does a cloud load balancer that terminates TLS.

### Asking for an account

`createRooms({ authorize })` in `relay/rooms.mjs` decides who may create and join rooms. The open relay lets everyone in. It gets each connection's page `origin` and the `token` in its address, if any (`wss://games.example.com/rooms?token=…`, since a browser's WebSocket can't send headers). A relay that wants accounts checks the token there, and answers `unauthorized` when it's missing or wrong.
