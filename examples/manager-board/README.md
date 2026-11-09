# Manager Board

See what happens between you, your manager agents and the agents they start, on a board docked beside your panes: what you asked an agent and what it replied, messages between panes, the panes an agent asked to open and what you answered, heartbeat nudges, heartbeats that ended and schedule runs. It's a record you can go back through: nothing is ever removed from it.

It needs Tilefold 0.1.27 or later.

## Using it

- **Manager Board: Open** opens the board beside your panes (in a window of its own after you press **Undock**). **Manager Board: Close** closes it.
- When you turn the tile on, Tilefold asks you to allow it to read your agents' timeline. Tilefold marks this as high risk, because the board shows what was said in your panes. The board can only read: it can't type into a pane or send a message.
- At the top, **Waiting on you** lists the panes that need an answer and the questions no one has read yet. **Now** shows each open agent pane, whether it's working, idle or needs you, and the last thing that happened in it.
- **Show** narrows the board to everything, one manager's team (the manager, the panes it opened or messaged, and the panes its heartbeats keep going), a project, or a fold. The kind buttons (**Said**, **Messages**, **Asks**, **Nudges**, **Heartbeats**, **Schedule runs**) and **Search** narrow it further.
- Long texts show as a short summary. **Show full text** opens the whole prompt, reply or message.
- New events appear by themselves while the board is in view.

The board remembers the view, the scope, the kinds and the time window you picked.

## Two views

- **Timeline** lists everything newest first, grouped by hour. Each card says who did what to whom, and its state: whether you allowed a request, whether a message was read, how a heartbeat or a schedule run ended. **Load older** goes further back.
- **Lanes** shows the same events across the last hour, two hours or four hours, one lane each for you, the managers, the panes they opened, other panes, Tilefold's nudges and your schedules. Each event is a dot where it happened; a message is a line from the pane that sent it to the pane that got it. Click a dot to see its card.

## Exporting

**Export** saves the view as Markdown or JSON, with the full texts. Tilefold asks where to save the file; the board learns only the file's name. An export holds at most 5,000 events; if there are more, it keeps the newest and says so, and you can narrow the view to export the rest.

## Settings and data

The board keeps only your choices (the view, the scope, the kinds and the time window). It never keeps or records anything from the timeline itself; its activity log only notes that it opened, closed, changed view or exported.

## Files

| File | What it is |
|---|---|
| `src/run.js` | The tile: opens the board, keeps your choices, reads the timeline for the page |
| `src/strings.js` | The page's text, sent in your language |
| `page-src/main.js` | The page: the header, the filters, loading and new events |
| `page-src/model.js` | How events are joined, named, worded and laid out |
| `page-src/views.js` | Waiting on you, Now and the Timeline |
| `page-src/lanes.js` | The Lanes view |
| `page/board.css` | The board's look, in Tilefold's colors |

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-11-06 by Tilefold
