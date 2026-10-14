# Reporting issues and ideas

Bugs and ideas for **Tilefold** and for **Tile Tools** are all tracked here, on this repository's Issues tab: github.com/Tilefold/tile-tools/issues. The Tilefold app's source isn't public, so this one tracker is where to report problems with the app as well as with this package and its example tiles.

## Picking a form

Each new issue starts from a form. The form you pick sets the labels, so the issue reaches the right list straight away.

| Form | Use it for |
|---|---|
| Tilefold app: bug | Something in the app is broken: the terminal, panes, tabs, Composer, agents, settings, updates, the tile loader |
| Tilefold app: idea | A feature or an improvement for the app |
| Tile Tools or example tile: bug | The `tilefold-tile` command, the `tf` types, these docs, or one of the example tiles in `examples/` |
| Tile Tools or tiles: idea | A new command or option, something tiles should be able to do, a new example tile, better docs |

Not sure whether it's the app or a tile? Pick the form you think fits best. Issues are moved between areas during triage.

Security problems should never go in a public issue. Use **Report a vulnerability** on the Security tab, or the "Security problem" link in the issue chooser, and the report stays private.

## What makes a good report

- **The versions.** The Tilefold version is in About Tilefold (in the Tilefold menu) and in the status bar. Get the Tile Tools version from `npx tilefold-tile --version`.
- **What you saw and what you expected**, in a sentence or two.
- **Steps to reproduce**, or the smallest `tile.json` and code that shows the problem.
- **The activity log lines** around the problem, if Tilefold logged any.
- **Nothing private.** Remove tokens, API keys, passwords, host names and personal paths before you submit. Issues are public.

You can write in any language you're comfortable with.

## What the labels mean

| Label | Meaning |
|---|---|
| `area: tilefold app` / `area: tile-tools` / `area: example tile` / `area: docs` | Which part the issue is about |
| `type: bug` / `type: idea` / `type: question` | What kind of issue it is |
| `status: triage` | New; nobody has looked at it yet |
| `status: needs info` | The reporter needs to add detail; issues left in this state for a long time may be closed |
| `status: confirmed` | Reproduced, or the idea is accepted |
| `status: planned` | Scheduled for an upcoming release |
| `status: blocked` | Waiting on something outside the issue |
| `status: released` | Fixed or shipped in a published release; the issue says which one |
| `status: won't do` | Closed without a change; the issue gives the reason |

The issues are also tracked on the Tilefold project board (the Projects tab of the Tilefold organisation), which shows what's in triage, planned, in progress and done.

## For maintainers

The labels are defined in `.github/labels.json`. When that file changes on `main`, the `labels` workflow creates the labels that are missing and corrects colours and descriptions. It never deletes a label, and its run log lists every change. To run it by hand, open Actions → labels → Run workflow; tick "Only list what would change" to see the changes without making them. When you add an example tile, add it to the "Which part?" list in `.github/ISSUE_TEMPLATE/3-tile-tools-bug.yml` too. The tests fail until you do.
