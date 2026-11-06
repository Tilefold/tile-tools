# Prompt Polish

Corrects the prompts you write to AI agents, in the language you choose. Write your prompt, press **Check**, and Claude fixes its spelling, grammar, spacing and punctuation (or, if you like, also clumsy phrasing). You see every change with a short reason, keep your own words wherever you prefer, and send the result to the agent in your pane. Code in backticks, file paths and links are never changed.

## Using it

- **Prompt Polish: Write a prompt** opens it over the pane you work in, right above the agent's input. Click into it to type (a page over your panes doesn't take the keyboard on its own).
- Write your prompt and press **Check** (or ⌘↩ / Ctrl+Enter). Tilefold shows you exactly what will go to Claude before anything is sent; choose **Send once**, or **Send, and don't ask again until Tilefold restarts**.
- The fixes show in place: removed text struck through, added text underlined, and a changed space as ␣. **Click a change to keep your own words there**; click it again to take the fix. **Show the result only** hides the marks. Under the text, each fix has its kind (spelling, grammar, spacing, punctuation, style) and why.
- **Send to agent** (or ⌘↩ again) puts the prompt on Tilefold's ask card at the top of the window. Press **Return** there to send it to the agent, edit it first, or drop it. Prompt Polish never types into your panes.
- **Send as is** skips the check. **Back to edit** returns to your text.

## One prompt per pane

Each pane has its own Prompt Polish, with its own prompt and fixes. You see the one for the pane you're working in: click another pane or switch tabs, and that pane's own prompt shows (or nothing, if you haven't opened Prompt Polish there); come back, and your text is where you left it. Run **Prompt Polish: Write a prompt** in each pane you want one in. So **Send to agent** always goes to the agent in that pane, which Tilefold's ask card offers first. **×** closes this pane's prompt; **Prompt Polish: Close** closes them all.

## Where it shows

The three small pictures in its header switch where it is, and it remembers your choice (choosing **Where Prompt Polish shows** in **Settings → Tiles → Prompt Polish** wins over it):

- **Over the agent's pane** (the default): a card across the pane you work in, just above its input, only as tall as it needs to be.
- **A button in the pane's corner**: a round **P** above the input. Click it to open the card, click again to fold it away. While fixes are waiting it shows how many. **–** in the header, or Escape, folds the card into this button from either view.
- **Beside the panes**: in the dock on the right, where your panes make room for it (Tilefold 0.1.20). It shows the prompt of the pane you're in. Tilefold's **Undock** brings it back over the pane.

If a pane is too small for the card, it opens beside the panes instead. On a Tilefold that can't dock pages it opens in a window of its own.

## Settings

In **Settings → Tiles → Prompt Polish**:

- **Language you write prompts in**: any of Tilefold's twelve languages, or the same as Tilefold. The reasons are written in Tilefold's language.
- **What to fix**: mistakes only, or also make it read naturally.
- **Where Prompt Polish shows**: as above.
- **Use the faster, cheaper model**: on by default; turn it off for Claude's larger model.

## What it needs

Your own Anthropic API key in **Settings → AI**: questions are billed to your Anthropic account, and the tile never sees the key. Tilefold masks anything that looks like a secret before it shows you the question.

## Privacy

Your prompts stay in the tile's memory while you work on them, one per pane. It goes only to Claude, after you agree in Tilefold's dialog, and to the ask card when you send it. It is never stored and never written to the activity log, which records only that a prompt was checked or sent, with counts.

## How it works

The tile asks Claude for JSON (the corrected text and a note per fix) and reads it field by field: control and direction-changing characters are taken out, lengths are bounded, and a correction that changed any code, path or link is refused (`src/answer.js`). The diff splits Latin text by words and other scripts by letters, so a Korean spacing fix or a Japanese particle is one change (`src/polish.js`). Where the card goes over the pane comes from the panes' rectangles Tilefold gives tiles, never from what is in them (`src/place.js`); the corner button is an overlay item (`src/button.js`). The page (`page-src/`) only draws what the tile sends and says what you clicked.

Needs Tilefold 0.1.23 (`tf.agent.ask`); over the pane from 0.1.11, beside the panes from 0.1.20.

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-11-06 by Tilefold
