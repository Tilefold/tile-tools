# Boards AI agents draw on

A tile can give the AI agent in one of the user's panes, such as Claude Code or Codex, a place to **explain by drawing**: a board beside the panes where it shows what it's explaining and draws over it, step by step, while the user follows along and asks about what they point at. The agent draws through the tile's commands, which it finds with Tilefold's `tile_list` and runs with `tile_run` (see [Commands AI agents call with data](tf-api.md)). The **Whiteboard** example (`examples/whiteboard`) is a complete one.

Like a game an agent plays ([Games AI agents can play](agent-games.md)), the board is data the agent reads and changes, never pixels it guesses at or code it sends. That makes its drawings exact, and lets the tile check every one.

## Five commands

| Command | Input | Returns |
|---|---|---|
| **Show content** | What to explain: `{ text, kind?, from?, title? }` | Where it landed on the board: the content's box, its first and last line numbers |
| **Draw** | `{ shapes: [...], say? }` | The ids of the shapes drawn, and the step; an error with the reason when a shape can't be drawn |
| **Erase** | `{ ids }`, `{ step }` or `{ all: true }` | What's left |
| **Read the board** | `{ wait?: true }` | Everything on the board as data, with the user's last question |
| **Point on screen** | `{ marks: [...], say? }` | Whether each mark on the user's own panes was placed, and what to do about the rest |

## Make places exact

The agent can't see the board: a tile's own page is hidden from agents' browser tools. So everything it needs to aim has to come out of **Read the board** as numbers, and the rules for where things go have to be fixed:

- **Lay out the content at known places.** Whiteboard puts each line of code 22 units below the last, in a monospaced font with every character 9.6 units wide, on a board 1,000 units wide. The page scales the whole board to fit; the units never change.
- **Let agents point at the content, not at pixels.** An arrow to `{ line: 12, col: 8 }` lands on that character, and one to `{ shape: "cache" }` lands on that box's nearest side. Keep the file's own line numbers (`from`), so the agent can use the ones it already knows.
- **Return each shape's box** and each arrow's ends in Read the board, so the agent can place the next thing beside the last without working it out.

## Steps, not a finished picture

An explanation is a sequence. Let each Draw that `say`s something start a new **step**: the board moves on to it, shows what the agent said above the drawing, and fades in its shapes. Keep every step, so the user can go **Back** over the explanation and **Next** again at their own pace. A user who missed a step can step back to it instead of asking again.

## Let the user ask

Clicking a line or a drawing points at it; a question typed with it goes to the tile, which keeps it and gives it to the agent in **Read the board**, with a number that grows with each question so the agent knows a new one from an old one. With `{ wait: true }`, Read the board answers as soon as the user asks, or after a few seconds at most (a command has ten seconds in all). So an agent can explain, then wait for the next question, without asking over and over.

## Data, never code

- **Check every shape** like any data from outside: the kinds you draw, numbers in range, text of a sensible length, and the ids an arrow names. Refuse with the field and what it should be (`shapes[2].x: a number from 0 to 1000`), so the agent fixes the call and tries again.
- **Colors from a palette** of names (`accent`, `red`, `blue`, …) the page maps to the user's theme, never colors the agent writes. Drawings stay readable in light and dark.
- **Free-form drawings as SVG path data only**: commands and numbers, nothing that could load or run.
- **Text as text.** Put what the agent wrote in text nodes, never in `innerHTML`.
- **Keep the board within limits**: a few hundred shapes and the size of one message to the page (256 KB), and say so when it's full.

## Point at the real thing

A board shows a copy. To point at what the user is actually looking at, such as the error in a pane or a line of the file in the document viewer, use `tf.annotate` (Tilefold 0.1.23, permission `window.annotate`). The agent names each place by what's there: `{ pane, text }` on a pane's screen, or `{ file, line }` in the viewer. Tilefold finds it and keeps the mark on it as the pane scrolls. The tile learns only whether each mark was placed, so pass the reasons on to the agent in words it can act on, as Whiteboard's **Point on screen** does. Put what the agent says on the board as well: marks are a visual aid, and the words are the explanation.

When the user asks on the board, an agent that is waiting in a read hears it at once. Otherwise bring the question to the agent with `tf.agent.ask` (Tilefold 0.1.23, permission `agent.ask`): Tilefold shows it on its ask card and the user presses Return to send it. Say in `about` what the user pointed at and how to read the board, so the agent can answer without guessing. Keep the question on the board as well, for an older Tilefold or a card the user dropped.

## Keep the board in the tile

Moving a page between the dock and a window loads it again, and the user may close it at any time. Keep the board in the tile (and its store), apply the agent's commands there, and send the page the whole board after each change: the page only draws it and passes on what the user does. Commands then answer at once, without waiting for the page.

## Privacy

Record one-word actions in the activity log, such as `shown`, `drew` or `asked`, never the content, the drawings or what the user typed. The user lets each pane run the tile's commands once, the first time, and can say no.

Copyright (c) 2026 Tilefold. Released under the MIT License.
