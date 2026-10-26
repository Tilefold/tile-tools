# Quiz

Quizzes on a borderless card floating over your panes: a short quiz about working in a terminal to start with, and as many as you like made from your own files by the AI agent in a pane. Pick an answer and the card says whether it was right and why; at the end it gives your score and keeps your best.

## Using it

- **Quiz: Start or show** opens the card where you left it: the list of quizzes, or the quiz you were taking. **Quiz: Show all quizzes** goes to the list.
- In a quiz, click an answer, or press its number or letter (1–4, A–D); **Enter** goes on to the next question, and **Escape** closes the card. On the list, 1–9 open a quiz. Click into the card first, as a card over your panes doesn't take the keyboard on its own.
- The card's top bar has **☰** (back to the list), **☾/☀** (switch light or dark) and **×** (close).
- **Quiz: Start over** begins the quiz again from its first question. Each quiz keeps its own progress, even across a restart of Tilefold.
- **Moving the card:** it starts in a corner of the pane you're working in and follows you when you switch panes. Drag the bar above it (its grip) to put it anywhere in the window; it stays there until you run **Quiz: Put the card back in the pane** or choose another corner.

## Light or dark

The card follows your system's appearance. **Quiz: Switch light or dark**, or the **☾/☀** button, flips it and remembers your choice. To fix it for good, choose **Light** or **Dark** under **Appearance of the card** in **Settings → Tiles → Quiz**; choosing there wins over the last switch. (A tile can't see Tilefold's own theme, so **Automatic** follows the system, not Tilefold.)

## Quizzes from your own files

A tile can't read your files, but the AI agents in your panes can. Ask one, for example in Claude Code:

> Make quizzes from the files in ./notes with the Quiz tile. One quiz per chapter, ten questions each.

The agent reads the files (any kind it can read, PDFs included), writes the questions, and hands each quiz to the tile. The first time, Tilefold asks you to let that agent run the Quiz tile's commands. New quizzes appear in the list at once, each with how many questions it has and, once taken, your best score.

What the agent uses (it sees these with Tilefold's `tile_list`):

| Command | Takes | Does |
|---|---|---|
| `add-quiz` | `{ title, questions: [{ question, choices, answer, why }] }` | Adds a quiz: 1–30 questions, each with 2–6 different choices, `answer` the index of the right one (from 0) and `why` a short explanation. A quiz that doesn't check out is refused with what to fix |
| `list-quizzes` | nothing | Lists the quizzes, and those removed. Opens the list if the quiz is closed, and never pulls you out of a quiz you're taking |
| `remove-quiz` | `{ id }` | Removes a quiz from the list. It's only marked removed, never deleted |
| `restore-quiz` | `{ id }` | Brings a removed quiz back |

The library holds up to 50 quizzes. Quizzes are written in whatever language you ask the agent for; the card's own words are in your Tilefold language.

## Settings

In **Settings → Tiles → Quiz**:

- **Show the quiz:** on a card over the panes (the default), or in a panel beside the panes, where the list, the questions and the answers are rows drawn in your theme.
- **Corner of the pane for the card:** where the card starts.
- **Appearance of the card:** Automatic, Light or Dark.

The floating card needs Tilefold 0.1.11, and agents' quizzes 0.1.14. From 0.1.7 to 0.1.10 the quiz opens in a window of its own, and the panel needs 0.1.9.

## How it's built

The quizzes live in the tile (`src/quiz.js`, `src/library.js`, kept with `src/store.js`); the card's page (`page-src/`) only draws what the tile sends it and says what you clicked, and the panel gets rows for the same state (`src/view.js`), so both always agree. The card is the page docked in Tilefold's window, which has no frame, with its grip drawn as overlay items above it (`src/card.js`, `src/scene.js`): a docked page keeps the pointer, so the page itself can't be what you drag. The agents' commands are in `src/agent.js`.

What happens is recorded in the tile's log in **Settings → Tiles**: opening and closing, each answer (which quiz and question, and whether it was right), finishing, starting over, switching light or dark, moving the card, and quizzes added, removed or brought back (their id and size, never their text).

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-26 by Tilefold
