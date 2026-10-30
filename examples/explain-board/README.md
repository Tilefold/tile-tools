# Explain Board

A board docked beside your panes where the AI agent in one of your panes explains things by drawing on them. Ask it to explain a file, a function, an error or an idea. It shows the code or text on the board, then draws over it a step at a time: arrows that point at exact lines and columns, highlights, notes, boxes, small diagrams and 3D scenes you turn by dragging. Go back over any step, point at a line or a drawing, and ask about it. The agent hears your question the next time it reads the board.

It's a way to learn from what's in your panes with the agent you already use: no other AI, account or key. The agent draws through the tile's commands, as data the tile checks, never code.

## Using it

1. Copy this folder into your tiles folder (**Settings → Tiles → Open tiles folder**), then click **Reload tiles** and **Allow**.
2. In a pane, ask your agent something like: *"Explain `src/auth.ts` on Tilefold's Explain Board, step by step."* The first time, Tilefold asks you to let that pane run the board's commands.
3. The board opens beside your panes (in a window of its own before Tilefold 0.1.20, or after you press **Undock**). The agent shows the content, then draws one step at a time. What it says in each step shows above the board.
4. **Back** and **Next** (or the left and right arrow keys) go over the explanation again. **Fit to width** and **Actual size** switch between a board that fits the page and one at full size that scrolls.
5. To ask about something, click a line or a drawing to point at it, type your question and press **Ask**. Asking without a question asks what it is. If the agent is waiting for you, it answers right away. Otherwise tell it to read the board.

**Explain Board: Open**, **Close**, **Clear the board**, **Next step** and **Previous step** are in the command palette.

## What the agent can draw

The board is 1,000 units wide and grows downward. The content's lines sit at fixed places, so a line or a column always has the same spot, whatever the size of the window:

- line *n* is at y = 20 + (*n* − first line) × 22 and is 22 high;
- column *k* is at x = 56 + (*k* − 1) × 9.6.

Shapes point at content by line and column rather than by guessing pixels, and at each other by id. Colors come from a short palette (`accent`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `gray`) that the board maps to your theme, light or dark.

| Kind | Fields | What it is |
|---|---|---|
| `box`, `ellipse` | `x, y, w, h, label?, fill?` | A labeled shape for a diagram |
| `note` | `x, y, w?, text` | A sticky note; its height follows its text |
| `text` | `x, y, text, size?, align?` | A label anywhere |
| `arrow`, `line` | `from, to, label?, curve?, dashed?, both?` | `from` and `to` are `[x, y]`, `{ line, col?, side? }` or `{ shape, side? }`. An arrow at a whole line ends just after its text, and one at a shape ends on the side that faces the other end |
| `highlight` | `line` or `lines: [a, b]`, `cols?: [a, b]`, `label?` | A band over lines, or over some columns of them |
| `path` | `d, fill?, dashed?` | SVG path data (numbers and commands only) for anything else |
| `scene3d` | `x, y, w, h, objects, camera?, label?` | A 3D scene. Objects are `box` (`at`, `size`), `sphere` (`at`, `r`), `line` (`at`, `to`), `point` and `label`, in coordinates from −100 to 100 with y up. You turn it by dragging |

Every shape may have an `id` (drawing one with the same id again replaces it, so the agent can move or relabel it) and a `color`.

## The agent's commands

The agent finds them with Tilefold's `tile_list` and runs them with `tile_run`. Each one opens the board if it's closed. From the palette, they just open it.

| Command | Input | What the agent gets back |
|---|---|---|
| `show` (**Show content**) | `{ text, kind?: "code" \| "text", language?, from?, title?, say?, append? }` | Shows what to explain, as numbered lines starting at `from` (a file's own line numbers). It starts a new explanation: earlier drawings go. With `append`, adds lines and keeps them. Returns the content's place and line numbers |
| `draw` (**Draw**) | `{ shapes: [...], say?, clear? }` | With `say`, the shapes make a new step and the board moves on to it. Without, they join the last step. Returns the ids, the step and how many steps there are, or the reason a shape was refused (a field, a missing line or shape), as an error |
| `erase` (**Erase**) | `{ ids: [...] }`, `{ step }` or `{ all: true }` | Takes shapes off (with arrows that pointed at them). The content stays |
| `read` (**Read the board**) | `{ wait?: true, lines?: true }` | Everything as data: the canvas, the content's place and line numbers (with its text when `lines`), the steps, each shape with the box it takes and each arrow's ends, the user's last question and whether it's new, a short how-to, and what to do next. With `wait`, holds up to seven seconds for the user to ask something |

An agent explaining in a loop shows the content, draws a step or two, then reads with `{ wait: true }` to hear what the user asks next. A Draw takes up to 100 shapes. The board holds up to 300 shapes, 50 steps and 1,000 lines of content (60,000 characters), and refuses to grow past what one message to the page can carry.

## Settings and data

Explain Board has no settings. It keeps the board (the content, the drawings, the steps and your last question) in the tile's own storage on your computer, so closing it or quitting Tilefold loses nothing. **Clear the board** removes it. The activity log records only one-word actions: `opened`, `closed`, `shown`, `drew`, `erased`, `cleared` and `asked`. It never records the content, the drawings or your questions.

## Files

| File | What it does |
|---|---|
| `src/layout.js` | Where everything sits: the content's lines and columns, shapes' boxes, arrows' ends, the board's height |
| `src/scene.js` | Checking what an agent draws: every kind of shape and 3D object, the palette, the limits |
| `src/board.js` | The board and what changes it: show, draw, erase, steps, the user's asks, and the board as an agent reads it |
| `src/run.js` | The tile: the agent's commands, the palette's, the store, and the page's messages |
| `src/strings.js` | The page's text, by message key |
| `page-src/svg.js` | Each shape as SVG, in palette classes, with text never read as markup |
| `page-src/project.js` | A 3D scene as flat pieces: the camera, perspective, hidden faces and shading |
| `page-src/main.js` | The page: the board, the steps and their captions, pointing and asking, turning 3D scenes |

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-30 by Tilefold
