# Gomoku

Five in a row against another developer, on a board docked beside your panes. Start a game, send the other player its code, and play: each move reaches the other board as it's played. Close the board, or even quit Tilefold, and opening it again takes you back to the same game.

It's also an example of a tile that does something live with other people. Its page keeps a WebSocket open to a **room relay**, a small server that passes messages between the people in a room and knows nothing about Gomoku. The same relay could carry a chat or another game.

## Playing

- **Gomoku: Play** opens the board beside your panes (in a window of its own before Tilefold 0.1.20, or after you press **Undock**).
- Enter your name (the other player sees it), then **Start a game**. The board shows a code such as `K7P-4QX`: send it to the other player any way you like.
- The other player opens Gomoku in their Tilefold, enters their name and the code, and presses **Join**. The game starts at once.
- Black moves first; the player who started the game plays black in the first game. Click a point to place your stone, or use the arrow keys to move around the board and **Enter** or **Space** to play. The status line above the board says whose turn it is.
- The first to get five or more stones in an unbroken line (across, down or diagonally) wins. A full board with no line of five is a draw. **Resign** gives the game up.
- When a game ends, **Play again** asks for another; it starts once both of you press it, with the colors swapped.
- **Leave the game** (on the board, or **Gomoku: Leave the game**) ends it for you and tells the other player.

While you're working in a pane, a notice tells you when the other player joins, moves, asks for another game or leaves. You see none while the board has your attention.

If either of you loses the connection, the board says so and reconnects by itself. The game waits, and nobody can move until both are back. When you come back, the two boards compare their moves and catch up.

## Playing against an AI agent

You can play against an AI agent in one of your panes, such as Claude Code or Codex, on this board alone, with no relay and no second player.

1. Press **Play against an agent** in the lobby (or run **Gomoku: Play against an agent**). You play black and move first; the agent plays white.
2. In a pane, ask the agent: *"Let's play Gomoku in Tilefold. You're white; read the board and play your move."* The first time, Tilefold asks you to let that pane run Gomoku's commands.
3. Play your stones by clicking. The agent reads the board, waits for your move and answers with its own. Its stones appear on your board, and a notice tells you when it has played if you're working elsewhere.

**Play again** starts another game with the colors swapped, and **Leave the game** goes back to the lobby.

The agent plays through three commands, which it finds with Tilefold's `tile_list` and runs with `tile_run`:

| Command | Input | What the agent gets back |
|---|---|---|
| `versus` (**Play against an agent**) | none | Starts a game against the user |
| `board` (**Read the board**) | `{ "wait": true }` (optional) | The game as data: the agent's color, whose turn it is, the moves as point names (`"H8"`), the board drawn as text rows (`X` black, `O` white), the result with its winning line, the rules, and what to do next. With `wait`, it holds up to seven seconds until it's the agent's turn |
| `move` (**Play a point**) | `{ "cell": "H8" }`: column A–O, row 1–15 from the bottom | The board after the move, or the reason it can't be played (not your turn, a taken point), as an error |

In a game with another person, the same commands let an agent read the board for you, or play for you on your turn. Agent moves and games against an agent are recorded in the activity log as `agent-moved` and `agent-game`, without the points. Needs Tilefold 0.1.14 or later and Tilefold's agent tools in the pane ([setting them up](../web-view/README.md) is the same as for Web View).

## What the relay sees

The relay passes the game's messages between the two boards: your names, the moves, and the code. It needs no account. Tilefold's relay keeps a record that the room exists (its code, the kind of game, and when it was used), and your name only while you're in the room; it never stores the moves. A room nobody has used for a day is closed, and its code stops working. Tilefold's own activity log records only one-word actions, such as `created`, `won` or `left`, and never the names or codes.

## Using your own relay

The tile plays through `wss://play.tilefold.com/rooms`. A tile may reach only the hosts its `tile.json` asks for, so to use your own relay, change two things and build the tile:

1. `RELAY_URL` in `src/config.js`, for example `wss://games.example.com/rooms`. It must be `wss://` on the default port.
2. The permission in `tile.json`: `"net:games.example.com"` in place of `"net:play.tilefold.com"`.

Give the tile your own `id` too (`you.gomoku`), so it doesn't clash with this example.

Any server that speaks the room protocol works, such as the open relay in this repository's `relay/` folder (`node relay/server.mjs`, behind TLS). [Live tiles with other people](../../docs/room-relay.md) describes the protocol and how to run it: JSON frames to `create` a room (the relay answers with its code), `join` one with a code, `send` data to the others in the room, and `leave`, plus `ping`. The relay tells each member when someone joins or leaves. The moves themselves are messages between the two boards (`page-src/match.js`), so the relay never needs to know the rules.

## Settings and data

Gomoku has no settings. It keeps your player id (random, so the other board recognizes you when you come back), your name, and the game in progress in the tile's own storage on your Mac.

## Files

| File | What it does |
|---|---|
| `src/run.js` | The tile: opens the page, sends it its text and what was kept, keeps what it asks to, shows notices, passes agents' commands to the page |
| `src/strings.js` | The page's text, by message key |
| `src/config.js` | The relay's address |
| `page-src/game.js` | The rules: the board, whose turn it is, five in a row, a draw |
| `page-src/code.js` | Game codes: six characters without look-alikes, shown as `K7P-4QX` |
| `page-src/relay.js` | The relay connection, with reconnects and pings, and the room protocol |
| `page-src/match.js` | A match between two players: rooms, turns, catching up, rematches |
| `page-src/board.js` | The board as a grid of points that works with the keyboard and screen readers |
| `page-src/versus.js` | A game against an AI agent on one board |
| `page-src/agent-view.js` | The game as an agent reads it, and the points it names |
| `page-src/main.js` | The page: lobby, waiting for the other player, the game, and agents' requests |

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-29 by Tilefold
