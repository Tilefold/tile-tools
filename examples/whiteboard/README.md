# Whiteboard

A board docked beside your panes where the AI agent in one of your panes explains things by drawing on them. Ask it to explain a file, a function, an error or an idea. It shows the code or text on the board, then draws over it a step at a time: arrows that point at exact lines and columns, highlights, notes, boxes, small diagrams and 3D scenes you turn by dragging. Go back over any step, point at a line or a drawing, and ask about it. The agent hears your question the next time it reads the board.

It's a way to learn from what's in your panes with the agent you already use: no other AI, account or key. The agent draws through the tile's commands, as data the tile checks, never code.

## Using it

1. Copy this folder into your tiles folder (**Settings → Tiles → Open tiles folder**), then click **Reload tiles** and **Allow**.
2. In a pane, ask your agent something like: *"Explain `src/auth.ts` on Tilefold's Whiteboard, step by step."* The first time, Tilefold asks you to let that pane run the board's commands.
3. The board opens beside your panes (in a window of its own before Tilefold 0.1.20, or after you press **Undock**). The agent shows the content, then draws one step at a time. What it says in each step shows above the board.
4. **Back** and **Next** (or the left and right arrow keys) go over the explanation again. **Fit to width** and **Actual size** switch between a board that fits the page and one at full size that scrolls.
5. To ask about something, click a line or a drawing to point at it, type your question and press **Ask**. Asking without a question asks what it is. If the agent is waiting for you, it answers right away. Otherwise, on Tilefold 0.1.23 or later, your question opens Tilefold's ask card at the top of the window with a line saying what you pointed at: press **Return** there to send it to your agent, or edit it first. Nothing goes until you do. On an older Tilefold, tell the agent to read the board.

**Whiteboard: Open**, **Close**, **Clear the board**, **Next step** and **Previous step** are in the command palette.

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
| `scene3d` | `x, y, w, h, objects, camera?, label?` | A 3D scene, drawn lit and shaded. Objects are `box` (`at`, `size`), `sphere` (`at`, `r`), `line` (`at`, `to`), `point`, `label`, `cylinder` (`at`, `to`, `r`, `r2`; a cone when `r2` is 0), `arrow` (`at`, `to`, `r`), `lathe` (a `profile` of `[radius, height]` spun round an `axis`, for bodies), `wing` (a real airfoil: `span`, `chord`, `thickness`, `camber`, `taper`, `sweep`, `dihedral`, `mirror`, `vertical`) and `tube` (smooth `points`, `r`, and `flow` to send beads along it), in coordinates from −100 to 100 with y up. Any object takes `color`, `label` (its part's name), `rot` and `opacity`. You turn it by dragging or with the arrow keys, zoom with the wheel or a pinch, put it back with a double-click or 0, and click a part to ask about it |

Every shape may have an `id` (drawing one with the same id again replaces it, so the agent can move or relabel it) and a `color`.

## The agent's commands

The agent finds them with Tilefold's `tile_list` and runs them with `tile_run`. Each board command opens the board if it's closed. From the palette, they just open it.

| Command | Input | What the agent gets back |
|---|---|---|
| `show` (**Show content**) | `{ text, kind?: "code" \| "text", language?, from?, title?, say?, append? }` | Shows what to explain, as numbered lines starting at `from` (a file's own line numbers). It starts a new explanation: earlier drawings go. With `append`, adds lines and keeps them. Returns the content's place and line numbers |
| `draw` (**Draw**) | `{ shapes: [...], say?, clear? }` | With `say`, the shapes make a new step and the board moves on to it. Without, they join the last step. Returns the ids, the step and how many steps there are, or the reason a shape was refused (a field, a missing line or shape), as an error |
| `erase` (**Erase**) | `{ ids: [...] }`, `{ step }` or `{ all: true }` | Takes shapes off (with arrows that pointed at them). The content stays |
| `read` (**Read the board**) | `{ wait?: true, lines?: true }` | Everything as data: the canvas, the content's place and line numbers (with its text when `lines`), the steps, each shape with the box it takes and each arrow's ends, the user's last question and whether it's new, a short how-to, and what to do next. With `wait`, holds up to seven seconds for the user to ask something. Lists the marks on your panes too, where Tilefold can draw them |
| `point` (**Point on screen**) | `{ marks: [...], say?, clear? }`, or `{ clear: true }` | Marks on your own panes and the document viewer, drawn by Tilefold (0.1.23 or later, permission `window.annotate`): `highlight`, `box`, `underline`, `arrow` or `note`, each `at` a place named by what's there. That's `{ pane, text }` or `{ pane, row }` on a pane's screen, where `pane` is its session (`$TILEFOLD_SESSION_ID` for the agent's own), the name you gave it, `"focused"` or 1 for the first pane in the tab. Or it's `{ file, line, text? }` in the file the viewer shows in Raw. Returns whether each mark was placed and what to do about the ones that weren't. What it `say`s goes on the board as a step |

An agent explaining in a loop shows the content, draws a step or two, then reads with `{ wait: true }` to hear what the user asks next. A Draw takes up to 100 shapes. The board holds up to 300 shapes, 50 steps and 1,000 lines of content (60,000 characters), and refuses to grow past what one message to the page can carry.

### Pointing on your panes

With **Point on screen**, the agent marks the real thing: the error in your build pane, a line of the file open in the viewer. Tilefold finds the text, keeps the mark on it as the pane scrolls, and never lets the tile see your panes; the tile learns only whether each mark was placed. Marks never take a click or a key. Hide them with **Hide or show tile overlays** (⌥⌘O), remove them with **Clear annotations** in the palette, or clear the board. On a Tilefold before 0.1.23 the command explains that it can't point, and the agent draws on the board instead.

## Settings and data

Whiteboard has no settings. It keeps the board (the content, the drawings, the steps and your last question) in the tile's own storage on your computer, so closing it or quitting Tilefold loses nothing. **Clear the board** removes it. **Clear the board** also takes away the marks on your panes. The activity log records only one-word actions: `opened`, `closed`, `shown`, `drew`, `erased`, `cleared`, `asked`, `pointed` and `unpointed`. It never records the content, the drawings, the marks or your questions.

## Files

| File | What it does |
|---|---|
| `src/layout.js` | Where everything sits: the content's lines and columns, shapes' boxes, arrows' ends, the board's height |
| `src/scene.js` | Checking what an agent draws: every kind of shape and 3D object, the palette, the limits |
| `src/board.js` | The board and what changes it: show, draw, erase, steps, the user's asks, and the board as an agent reads it |
| `src/run.js` | The tile: the agent's commands, the palette's, the store, and the page's messages |
| `src/askAgent.js` | Bringing your question to the agent on Tilefold's ask card (`tf.agent.ask`, permission `agent.ask`), with a line saying what you pointed at |
| `src/point.js` | Point on screen: marks on your panes through `tf.annotate`, and what the agent should do about the ones not placed |
| `src/strings.js` | The page's text, by message key |
| `page-src/svg.js` | Each shape as SVG, in palette classes, with text never read as markup |
| `page-src/three3d.js` | A 3D scene drawn for real with three.js (bundled into the page): lights, the camera and its controls, labels kept apart, flowing tubes, clicking a part |
| `page-src/meshes.js` | Each 3D object as meshes, the wing's airfoil among them |
| `page-src/glLayer.js` | The layer that keeps a real 3D view over each scene's frame as the board scrolls and scales |
| `page-src/project.js` | A 3D scene as flat pieces (where the page can't draw real 3D): the camera, perspective, hidden faces and shading |
| `page-src/main.js` | The page: the board, the steps and their captions, pointing and asking, turning 3D scenes |

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-31 by Tilefold
