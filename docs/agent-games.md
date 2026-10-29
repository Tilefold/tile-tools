# Games AI agents can play

An AI agent in one of the user's panes, such as Claude Code or Codex, can play a tile's game: against the user, for the user against someone else, or against another agent. It plays through the tile's own commands, which it finds with Tilefold's `tile_list` and runs with `tile_run` (see [Commands AI agents call with data](tf-api.md)). The Gomoku and TileGo examples (`examples/gomoku`, `examples/tilego`) play this way.

The agent gets the game as data and names its moves, rather than reading pixels and clicking. That makes it exact, and it lets the game check every move against its own rules, label the agent's moves, and decide what an agent may do.

## Two commands

Give the game two commands, and describe their input so an agent gets it right the first time:

| Command | Input | Returns |
|---|---|---|
| **Read the board** | `{ wait?: true }` | The game as data |
| **Play** (a move, a turn's choice) | The move, such as `{ cell: "H8" }` | The game after the move; throw an error with the reason when it can't be played |

A game with a stage after play gives that stage a command of its own, and says in **Read the board** when it has begun. In Go, both players mark the dead stones once both have passed; TileGo's **Mark dead stones** takes `{ dead: ["C3"], accept: true }`. A pass is just a move (`{ cell: "pass" }`).

What **Read the board** returns is what the agent knows, so make it complete:

- **Who the agent is**: its color or side, and whether it's playing against the user or for them.
- **Whose turn it is**, and whether the agent may move now.
- **The state** in a form that is easy to read: a list of moves in the game's own notation, and a small drawing as text rows when the board is two-dimensional.
- **The result** once there is one, and whether the agent won.
- **The rules in a line or two**, and **what to do next** ("Your move: run Play with { cell }", "Wait for the user"), so an agent that has never seen the game can play it.

Keep it well under the 64 KB a command may return.

## Waiting for the other side

An agent can't hear events: it only asks. So let **Read the board** wait: with `{ wait: true }`, it answers as soon as it's the agent's turn, or after a few seconds at most (a command has ten seconds in all). The agent then loops: read with `wait`, play, read with `wait` again. Without this, it would ask over and over.

## Which kind of game

An agent takes a few seconds for each action: it thinks, calls the command and reads the answer. Design for that.

| Kind of game | Examples | How the agent plays |
|---|---|---|
| **Turn-based** | Gomoku, Go, chess, cards, battleship, word games | Directly, one move per Play. The game waits for each player, so the seconds don't matter |
| **Rounds** | A tank battle where everyone picks their orders, then a round plays out | One choice per round. The game collects every player's choice, people's and agents' alike, then runs the round |
| **Fast real-time** | Ping pong, an arcade shooter | The agent sets a **strategy**, not moves: settings or a few rules the game understands ("follow the ball, aim for the far corner"), which the game applies every frame. Between points or rounds, the agent reads how it went and changes them |

For a strategy, take data the game understands, such as numbers, choices from a list, or simple rules, never code. A tile can't run code it's given, and it shouldn't try.

## Fair play and safety

- **Check every move** like any input from outside. The agent decides what it sends.
- **Say whose turn it is** in the refusal, so the agent knows to wait rather than try again.
- **Show the agent's moves** where the user can see them, and tell the user when the agent moved while they were looking elsewhere.
- **Record one-word actions** in the activity log, such as `agent-moved` or `agent-game`, never the moves or what anyone typed.
- The user lets each pane run the tile's commands once, the first time, and can say no.

## With other people

In a game over a room relay ([Live tiles with other people](room-relay.md)), an agent plays through the user's own copy of the tile: its moves go over the relay like the user's. So an agent can play for the user, or two users can each let their agent play, without the relay knowing.
