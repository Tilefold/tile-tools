# Promptsmith

Corrects the prompts you write to AI agents, in the language you choose. Click the **Polish** pill by your pane's input, write your prompt, press **Check**, and Claude (with your own Anthropic key) or the agent in your pane fixes its spelling, grammar, spacing and punctuation (or, if you like, also clumsy phrasing). You see every change with a short reason, keep your own words wherever you prefer, and send the result to the agent in your pane. Code in backticks, file paths and links are never changed.

## Using it

- A small **✦ Polish** pill sits at the right end of the pane's bottom row, by where you type. Click it when you want a prompt checked; it opens the card above it. (Click into the card to type: a page over your panes doesn't take the keyboard on its own.) **Promptsmith: Write a prompt** in the command palette opens it too.
- Write your prompt and press **Check** (or ⌘↩ / Ctrl+Enter). Tilefold shows you exactly what will go to Claude before anything is sent; choose **Send once**, or **Send, and don't ask again until Tilefold restarts**.
- The fixes show in place: removed text struck through, added text underlined, and a changed space as ␣. **Click a change to keep your own words there**; click it again to take the fix. **Show the result only** hides the marks. Under the text, each fix has its kind (spelling, grammar, spacing, punctuation, style) and why.
- **Send to agent** (or ⌘↩ again) puts the prompt on Tilefold's ask card at the top of the window, and the card folds back into the pill. Press **Return** on the ask card to send it to the agent, edit it first, or drop it. Promptsmith never types into your panes.
- **Send as is** skips the check. **Back to edit** returns to your text. While fixes wait, the pill shows how many.
- **Promptsmith: Close** hides the pill until you next use **Write a prompt**.

## In Tilefold's own input box

With **Settings → Agents → Write to agents in Tilefold's input box** on (Tilefold 0.1.27), you write to your agent in a box Tilefold draws under the terminal, and Promptsmith puts a **✦ Polish** button at its end once you've written something. Click it: the card opens above the box with your prompt in it, and the check starts right away. If you have your own cases, the card first asks what to fix. Pick **Mistakes only** or **Mistakes, and make it read naturally** and the check starts. Pick one of your cases and the card shows your prompt again with an **Apply “…”** button named for that case, so nothing changes until you press it. **Cancel** shows your prompt instead, to check as it is set. Go through the fixes as usual, then:

- **Use** puts the corrected prompt back in the box. Tilefold highlights every changed word and offers **Undo** (or ⌘Z / Ctrl+Z). Nothing is sent: read it and press Enter yourself.
- **Send to agent** does the same and sends it to your agent right away, as Enter would (if the agent is busy, it waits in the box).
- **Keep mine** closes the card and leaves the box as it was.

If you edit the box while the card is open, Use doesn't overwrite it: the card says so, and you click **✦ Polish** again. While the check runs, Tilefold shows a **×** beside the spinning button: click it to stop waiting, and the card closes. The pill isn't drawn over a pane that has this box, since the button is in the box itself, except after you fold a card that still has fixes: then the pill stays, so you can open the card again.

## One prompt per pane

Each pane has its own Promptsmith, with its own prompt and fixes. You see the one for the pane you're working in: click another pane or switch tabs, and that pane's own prompt shows (or nothing, if you haven't opened Promptsmith there); come back, and your text is where you left it. Run **Promptsmith: Write a prompt** in each pane you want one in. So **Send to agent** always goes to the agent in that pane, which Tilefold's ask card offers first. **×** closes this pane's prompt; **Promptsmith: Close** closes them all.

## Where it shows

The three small pictures in its header switch where it is, and it remembers your choice (choosing **Where Promptsmith shows** in **Settings → Tiles → Promptsmith** wins over it):

- **A Polish button by the pane's input** (the default): the pill, with the card opening above it when you click it, and folding back into it after you send (**–** in the header, or Escape, folds it too).
- **Over the agent's pane**: the card stays open across the pane you work in, just above its input, only as tall as it needs to be.
- **Beside the panes**: in the dock on the right, where your panes make room for it (Tilefold 0.1.20). It shows the prompt of the pane you're in. Tilefold's **Undock** brings it back over the pane.

Over the pane, drag the card by its header to move it anywhere in the pane; it never covers the input row. Double-click the header to fold the card to just its header bar, right where it is, and double-click again to see the whole card. **▢** in the header makes the card fill the pane, and clicking it again brings the card back where it was. Choosing another view puts the card back in its place.

If a pane is too small for the card, it opens beside the panes instead. On a Tilefold that can't dock pages it opens in a window of its own.

## What to fix, and your own cases

Click the chip in the card's header (such as **Mistakes only · English**) to pick what to fix: **Mistakes only**, **Mistakes, and make it read naturally**, or one of your own cases. The chip names your pick first, and hovering over it shows the whole name. Your pick stays until you pick again or change **What to fix** in Settings. A built-in mode checks a prompt already checked again right away; one of your cases takes you back to your prompt with an **Apply “…”** button, and the rework starts when you press it. With one of your cases, the spelling and grammar are fixed as usual, and the prompt is also reworked as that case says, for example adding what a video prompt should always state. Picking a case says the prompt is of that kind, so even a few words are reworked into a full prompt, with sensible details filled in where you gave none; while it works, the card names the case. What a case adds comes one sentence or line at a time, each with its own **✕** to drop it (your words stay) and **↺** to bring it back; clicking the text itself changes nothing, so a stray click can't undo the rework.

A case can also translate. Fill in **Also translate into** with the languages you want, in any language Claude or your agent can write, as codes or names separated by commas (for example `ja, vi, pt-PT, zh-TW` or `Japanese, Tiếng Việt, Swahili`; up to eight). As you type, the form shows what it reads, each language with its own name and code (such as **Tiếng Việt · vi**), and anything it doesn't recognize as a language. The corrected prompt stays in the language you wrote it in, and under the fixes the card shows **Translations**: one block per language, headed with its own name and code, with **Copy**, and **Use this** (it goes in Tilefold's input box) or **Send this** (it goes on the ask card). Code in backticks, file paths and links stay exactly as they are in every translation; one that changed them isn't shown.

The two built-in cases can translate too. With **Mistakes only** or **Mistakes, and make it read naturally** in use, **Edit “…”…** in the menu opens a small form with just their **Also translate into** field (their instructions are built in), and **Edit another case…** under it picks one of your own cases to edit instead. The languages are also in Settings, as **Mistakes only: also translate into** and **Mistakes, and make it read naturally: also translate into**. Leave them empty for no translations.

From the same menu, **Add your own…** opens a small form for a case's name and what to do, and **Edit…**, just above it, changes a case or removes it: the case in use, or, with none in use, the one you pick from your list. They're saved to **Your own cases of what to fix** in Settings, so you can also add and edit them there, one case at a time (Tilefold 0.1.27; on an older Tilefold, add them in Settings only).

## Settings

In **Settings → Tiles → Promptsmith**:

- **Language you write prompts in**: any of Tilefold's twelve languages, or the same as Tilefold. The reasons are written in Tilefold's language.
- **What to fix**: mistakes only, or also make it read naturally. This is where checks start; the card can pick another (below).
- **Your own cases of what to fix**: kinds of prompt you write often, each with what to do for it. Click **Add** for a new case, fill in its name and what to do, and **Save**; each case has **Edit** and **Remove** (Tilefold 0.1.27). On an older Tilefold it's one box: write each case's name on its first line and what to do on the lines under it, with a blank line between cases:

  ```
  Video editing
  Say the clip's length, its style and the music.

  Email to a client
  Keep it short and polite.
  Translate: ja, ko
  ```

  A line starting with **Translate:** names the languages to translate that case's prompts into.
- **Where Promptsmith shows**: as above.
- **Who checks your prompts**: Claude with your Anthropic key, and without one your polish agent (the default), or always your polish agent (see below).
- **Your polish agent**: which agent checks your prompts in a tab of its own: Claude Code (the default), Codex, Gemini CLI, Cursor Agent, Antigravity CLI or OpenCode. It must be installed.
- **Mistakes only: also translate into** and **Mistakes, and make it read naturally: also translate into**: the languages each built-in case also translates your prompt into, as codes or names (empty: none).
- **Card background over the pane**: solid, or see-through from 90% down to 10%, so you can see the pane under the card. Down to 60% the text keeps a solid surface; below that it fades too, with a soft halo around the letters, and **Text only** leaves nothing but the text over the pane. Only the card over the pane; beside the panes it's always solid (Tilefold 0.1.27).
- **Use the faster, cheaper model**: on by default; turn it off for Claude's larger model. Only for checks by Claude.

## What it needs

Either of these:

- **Your own Anthropic API key** in **Settings → AI**: questions are billed to your Anthropic account, and the tile never sees the key. Tilefold masks anything that looks like a secret before it shows you the question.
- **No key: your polish agent checks it** (Tilefold 0.1.27). The first time you check a prompt without a key, Tilefold opens a new tab in the background, named Promptsmith, and starts your polish agent there. Your prompt goes to that agent, never to the one you work with, so its task isn't interrupted and nothing is added to its conversation. There's no ask card to confirm: the tab belongs to Promptsmith. The card says the agent is checking, and the fixes show as usual when it hands them back. The agent starts in a folder of Promptsmith's own, and the first time it asks a question or two there, such as whether you trust that folder: Tilefold brings its tab to the front, you answer with the arrow keys and Enter, and your prompt goes once it's ready. Leave the tab open and later checks are quicker. Close it whenever you like, and the next check opens a new one. The agent runs under your own subscription.

  Once your polish agent has checked a prompt (or with **Who checks your prompts** set to it), Promptsmith makes sure it's running whenever the card opens, and starts it in the background if it isn't, so it's ready by the time you've written your prompt (Tilefold 0.1.27). If something's off, run **Promptsmith: Show the polish agent** from the palette to bring its tab to the front (starting it if needed), for example to answer its first questions, or **Promptsmith: Restart the polish agent** to close its tab and start a new one. The card offers the same as **Show its tab** while the agent gets ready or works, and as **Show its tab** and **Restart it** when it didn't start.
- **On an older Tilefold, the agent in your pane checks it.** Choose **The agent in your pane** under **Who checks your prompts**, or press **Ask the agent instead** when Promptsmith says your key is missing. **Check** then puts a short request on Tilefold's ask card: correct this prompt, don't act on it, and hand it back. Press **Return** there to send it. The agent hands its corrections back to Promptsmith, and you see them the same way, with a reason for each. Sending the result is the ask card again, so it takes two Returns, and the request and the corrections use a little of the agent's conversation. The first time, Tilefold asks whether the agent may run Promptsmith's commands. **Cancel** stops waiting.

Version 1.1 added a command agents can run with data, 1.2 the **✦ Polish** button (the `input.actions` permission, rated high, because it reads what you wrote when you click it), and 1.3 the polish agent (the `agent.helper` permission, rated high, because it opens a tab with an agent and sends it your prompts), so Tilefold asks you to approve the tile again after updating.

## Privacy

Your prompts stay in the tile's memory while you work on them, one per pane. A prompt goes only to Claude, after you agree in Tilefold's dialog, or, if you chose it, to the agent in your pane through the ask card, and to the ask card when you send it. With the **✦ Polish** button, the tile reads your box only when you click it, with anything that looks like a key masked, and its correction goes back to the box only when you press **Use**. It is never stored and never written to the activity log, which records only that a prompt was checked, sent or used, with counts.

## How it works

The tile asks Claude for JSON (the corrected text and a note per fix) and reads it field by field: control and direction-changing characters are taken out, lengths are bounded, and a correction that changed any code, path or link is refused (`src/answer.js`). The diff splits Latin text by words and other scripts by letters, so a Korean spacing fix or a Japanese particle is one change (`src/polish.js`). Where the card goes over the pane comes from the panes' rectangles Tilefold gives tiles, never from what is in them (`src/place.js`); the Polish pill is an overlay item (`src/button.js`). The agent in your pane answers through the **Hand back** command, giving the request's one-time id: Promptsmith takes a hand-back once, only for a request it is waiting on and within ten minutes, and reads it exactly like Claude's answer (`src/agentCheck.js`, `src/agentRun.js`). The **✦ Polish** button is an input action: a click hands the tile the box's text and a one-time request, and **Use** answers it with `tf.input.replace`, which Tilefold applies only if the box still holds what you clicked (`src/inputAction.js`). The page (`page-src/`) only draws what the tile sends and says what you clicked.

Needs Tilefold 0.1.23 (`tf.agent.ask`); over the pane from 0.1.11, beside the panes from 0.1.20, the ✦ Polish button in Tilefold's input box from 0.1.27.

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-11-08 by Tilefold
