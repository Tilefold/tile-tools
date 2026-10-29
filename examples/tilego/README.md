# TileGo

The game of Go against another developer or an AI agent, on a board docked beside your panes. Pick a board size, start a game, send the other player its code, and play: each move reaches the other board as it's played. Or play an AI agent in one of your panes, which reads the board and answers with its own moves. Close the board, or even quit Tilefold, and opening it again takes you back to the same game.

Like the Gomoku example, its page keeps a WebSocket open to a **room relay**, a small server that passes messages between the people in a room and knows nothing about Go. TileGo's rooms are its own: a Gomoku code can't open a TileGo game.

## Playing

- **TileGo: Play** opens the board beside your panes (in a window of its own before Tilefold 0.1.20, or after you press **Undock**).
- Enter your name (the other player sees it), pick the **board size** (9 × 9 for a quick game, 13 × 13, or the full 19 × 19), then **Start a game**. The board shows a code such as `K7P-4QX`: send it to the other player any way you like.
- The other player opens TileGo in their Tilefold, enters their name and the code, and presses **Join**. Their board takes the size you picked, and the game starts at once.
- Black moves first; the player who started the game plays black in the first game. The column letters (A to T, without I) run along the top and bottom of the board and the row numbers up both sides, so you can name a point as an agent does: `E5`. Click a point to place your stone, or use the arrow keys to move around the board and **Enter** or **Space** to play. The status line above the board says whose turn it is, and when the other player passed.
- A group of stones (stones of one color joined across or down, never diagonally) with no empty point next to it is captured and taken off the board. You can't play a stone that would leave its own group without an empty point unless it captures (no suicide), and you can't take back a single stone straight away where a single stone was just taken (ko): play elsewhere first.
- The bar above the board is a rough guess at who's ahead: black's share of it is black's chance of winning, and the line under it says the chances and about how many points the leader is up. It counts the stones, the areas each side has walled off, part of the open points nearer to each side's stones, and white's komi. It's no Go engine: it can't read a fight, and it doesn't know a group is dead until you mark it, so take it as a hint. The bar goes when the game is over.
- **Pass** when no move gains you anything. Two passes in a row end the play.
- **Undo** takes back your last move (a stone or a pass), and the other player's reply to it if they already answered, so it's your turn again. The other player sees your request with **Allow** and **Decline** (and a notice if they're working elsewhere); it happens on both boards only when they allow it. **Resign** gives the game up.

## Counting the score

When both players have passed, the board shows each side's area, and a band under it says what to do:

1. **Mark the dead stones.** Click a stone to mark its whole group dead, and click again to bring it back. Either player can mark, and each click shows on both boards. Dead stones fade under a cross.
2. **Accept the score.** The band shows the score as marked: each side's stones on the board plus the empty points (and dead stones) only it surrounds, with 7.5 points of komi for white. This is area scoring, as in the Chinese rules. When you've both accepted the same marks, the game is over and the board says who won and by how much. Thanks to the half point there's never a draw.
3. If you don't agree, change the marks: any change takes back both acceptances. To settle it by playing on, press **Undo**: it takes back the last pass, the marks are forgotten, and play goes on.

When a game ends, **Play again** asks for another on the same size, with the colors swapped; it starts once both of you press it. **Leave the game** (on the board, or **TileGo: Leave the game**) ends it for you and tells the other player.

While you're working in a pane, a notice tells you when the other player joins, moves, passes, accepts the score, asks for another game or leaves. You see none while the board has your attention. If either of you loses the connection, the board says so and reconnects by itself; nobody can move or mark until both are back, and the two boards then catch up.

## Playing against an AI agent

You can play against an AI agent in one of your panes, such as Claude Code or Codex, on this board alone, with no relay and no second player.

1. Pick the size and press **Play against an agent** in the lobby (or run **TileGo: Play against an agent**). You play black and move first; the agent plays white.
2. In a pane, ask the agent: *"Let's play Go in Tilefold's TileGo. You're white; read the board and play your move."* The first time, Tilefold asks you to let that pane run TileGo's commands.
3. Play your stones by clicking. The agent reads the board, waits for your move and answers with its own (or passes). After both passed, you both mark the dead stones and accept.

**Undo** takes your last move back at once, with the agent's reply if it already played. **Play again** starts another game on the same size with the colors swapped, and **Leave the game** goes back to the lobby. AI agents play Go much less well than they play Gomoku: a 9 × 9 board gives them the best game.

The agent plays through four commands, which it finds with Tilefold's `tile_list` and runs with `tile_run`:

| Command | Input | What the agent gets back |
|---|---|---|
| `versus` (**Play against an agent**) | none | Starts a game against the user, on the size picked in the lobby |
| `board` (**Read the board**) | `{ "wait": true }` (optional) | The game as data: the size, the agent's color, whose turn it is, the moves as point names (`"E5"`, `"pass"`), the board drawn as text rows (`X` black, `O` white, `x` and `o` for stones marked dead), the stones each side captured, the ko point, the score as marked and who accepted it, the result, the rules, and what to do next. With `wait`, it holds up to seven seconds until it's the agent's turn |
| `move` (**Play a point**) | `{ "cell": "E5" }` (a column letter, without I, and a row number from the bottom), or `{ "cell": "pass" }` | The board after the move, or the reason it can't be played (not your turn, a taken point, ko, suicide, play has ended), as an error |
| `score` (**Mark dead stones**) | `{ "dead": ["C3", "G7"] }` (one stone of each dead group; `[]` for none) and/or `{ "accept": true }` | The board with the marks, or the reason they can't be made (play hasn't ended, a point that isn't one), as an error |

In a game with another person, the same commands let an agent read the board for you, or play and mark for you on your turn. Agent moves, games against an agent and undos are recorded in the activity log as `agent-moved`, `agent-game`, `undid` and `undo-asked`, without the points. Needs Tilefold 0.1.14 or later and Tilefold's agent tools in the pane ([setting them up](../web-view/README.md) is the same as for Web View).

## What the relay sees

The relay passes the game's messages between the two boards: your names, the moves, the marks and the code. It needs no account. Tilefold's relay keeps a record that the room exists (its code, the kind of game, and when it was used), and your name only while you're in the room; it never stores the moves. A room nobody has used for a day is closed, and its code stops working. Tilefold's own activity log records only one-word actions, such as `created`, `scoring`, `won` or `left`, and never the names, codes or moves.

## Using your own relay

The tile plays through `wss://play.tilefold.com/rooms`. To use your own relay, change two things and build the tile:

1. `RELAY_URL` in `src/config.js`, for example `wss://games.example.com/rooms`. It must be `wss://` on the default port.
2. The permission in `tile.json`: `"net:games.example.com"` in place of `"net:play.tilefold.com"`.

Give the tile your own `id` too (`you.tilego`), so it doesn't clash with this example. Any server that speaks the room protocol works, such as the open relay in this repository's `relay/` folder; [Live tiles with other people](../../docs/room-relay.md) describes it. The moves and marks are messages between the two boards (`page-src/match.js` and `page-src/marks.js`), so the relay never needs to know the rules.

## Settings and data

TileGo has no settings. It keeps your player id (random, so the other board recognizes you when you come back), your name, and the game in progress in the tile's own storage on your Mac.

## Files

| File | What it does |
|---|---|
| `src/run.js` | The tile: opens the page, sends it its text and what was kept, keeps what it asks to, shows notices, passes agents' commands to the page |
| `src/strings.js` | The page's text, by message key |
| `src/config.js` | The relay's address |
| `page-src/game.js` | The rules: board sizes, point names, captures, suicide, ko, passes and the end of play |
| `page-src/score.js` | Dead stones a group at a time, areas, area scoring with komi, and the result |
| `page-src/estimate.js` | The rough guess at who's ahead: the lead and each side's winning chances |
| `page-src/code.js` | Game codes: six characters without look-alikes, shown as `K7P-4QX` |
| `page-src/relay.js` | The relay connection, with reconnects and pings, and the room protocol |
| `page-src/match.js` | A match between two players: rooms, the board size, turns, passes, rematches |
| `page-src/follow.js` | Taking in the other board's moves, and catching up after being away |
| `page-src/marks.js` | Marking the dead stones together over the relay and accepting the score |
| `page-src/undo.js` | Taking a move back: what comes off, which requests fit, asking and answering |
| `page-src/versus.js` | A game against an AI agent on one board |
| `page-src/agent-view.js` | The game as an agent reads it, and the points and passes it names |
| `page-src/agent-requests.js` | Answering an agent's commands: the board, a move, the dead stones |
| `page-src/board.js` | The board as a grid of points that works with the keyboard and screen readers, with its coordinates round it |
| `page-src/main.js` | The page: lobby, waiting for the other player, the game, the marking, and agents' requests |

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-29 by Tilefold
