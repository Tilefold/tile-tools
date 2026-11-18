# Manager Board

See what happens between you, your manager agents and the agents they start, on a board docked beside your panes: what you asked an agent and what it replied, messages between panes, the panes an agent asked to open and what you answered, heartbeat nudges, heartbeats that ended and schedule runs. It's a record you can go back through: nothing is ever removed from it. A Tasks view lists the same work as one row per task, which you can search and sort.

It needs Tilefold 0.1.27 or later.

## Using it

- **Manager Board: Open** opens the board beside your panes (in a window of its own after you press **Undock**). **Manager Board: Close** closes it.
- When you turn the tile on, Tilefold asks you to allow it to read your agents' timeline. Tilefold marks this as high risk, because the board shows what was said in your panes. The board can only read: it can't type into a pane or send a message.
- At the top, **Waiting on you** lists the panes that need an answer and the questions no one has read yet. **Now** shows each open agent pane, whether it's working, idle or needs you, and the last thing that happened in it. Click a pane's card to see only that pane's items, in every view: what it did and the messages sent to it. Click it again, or press × on the **Only …** chip, to see every pane. Click the **Now** heading to fold it out of the way (it still says how many panes are open), and switch how the panes show: **Cards** (each pane's state and what it did last), **Compact** (a small chip per pane, for a window with many agents) or **Flow**, a diagram of the panes with the managers on top and an arrow for the messages each one sent another, thicker for more messages and dashed for questions. Clicking a pane in any of them shows only its items. Messages that agents send each other have a teal color of their own in the Timeline and Lanes, so they stand apart from agents' replies.
- **Show** narrows the board to everything, one manager's team (the manager, the panes it opened or messaged, and the panes its heartbeats keep going), a project, or a fold. The kind buttons (**Said**, **Messages**, **Asks**, **Nudges**, **Heartbeats**, **Schedule runs**) and **Search** narrow it further.
- Each card shows one line. Click it (or press Enter or Space on it) to open it in place with the whole prompt, reply or message, and again to fold it. An agent's reply that came as several short lines is one card: folded, it shows its newest line and how many more it holds; open, every line with its time, the latest first. Under each of the agent's lines it lists what the agent did next, the latest first, such as the commands it ran and the files it read or changed (with Tilefold 0.1.38 or later, for Claude Code); a folded card says how many things it did. In the Tasks view, **Show full text** opens the whole request or reply.
- New events appear by themselves while the board is in view.

The board remembers the view, the scope, the kinds, the time window and the Tasks view's sort and state you picked.

## Three views

- **Timeline** lists everything newest first, grouped by hour. Each card says who did what to whom, and its state: whether you allowed a request, whether a message was read, how a heartbeat or a schedule run ended. **Load older** goes further back.
- **Tasks** lists one row per task: what an agent was asked and by whom (you, or a manager that handed it the work), the agent, the project, when it started, how long it took, whether it is working, waiting on you or done, and its last reply. It's newest first; **Sort** puts the oldest, the longest or each agent's or project's tasks together under a heading, **State** shows only the tasks working, waiting on you or done, and **Search** looks through the requests, replies, pane names, agents and projects. **Show full text** and **Show full reply** open the whole request or reply. Only a pane's newest task can still be going, and a task whose request is older than what's loaded says so until you load older events.
- **Lanes** shows the same events across the last hour, two hours or four hours, one lane each for you, the managers, the panes they opened, other panes, Tilefold's nudges and your schedules. Each event is a dot where it happened; a message is a line from the pane that sent it to the pane that got it. Click a dot to see its card.

## Exporting

**Export** saves the view as Markdown or JSON, with the full texts. Tilefold asks where to save the file; the board learns only the file's name. An export holds at most 5,000 events; if there are more, it keeps the newest and says so, and you can narrow the view to export the rest.

## Settings and data

The board keeps only your choices (the view, the scope, the kinds, the time window, the Tasks view's sort and state, how Now shows the panes and whether it is folded). It never keeps or records anything from the timeline itself; its activity log only notes that it opened, closed, changed view or exported.

## Files

| File | What it is |
|---|---|
| `src/run.js` | The tile: opens the board, keeps your choices, reads the timeline for the page |
| `src/strings.js` | The page's text, sent in your language |
| `page-src/main.js` | The page: the header, the filters, loading and new events |
| `page-src/model.js` | How events are joined, named, worded and laid out |
| `page-src/views.js` | The Timeline |
| `page-src/now.js` | Waiting on you, and Now: its heading, Cards and Compact |
| `page-src/flow.js` | Now's Flow diagram |
| `page-src/tasks.js` | How events become tasks, and how tasks are filtered, sorted and grouped |
| `page-src/tasksView.js` | The Tasks view |
| `page-src/lanes.js` | The Lanes view |
| `page/board.css` | The board's look, in Tilefold's colors |
| `page/now.css` | Relayed messages, the Now heading and its modes |

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-11-17 by Tilefold
