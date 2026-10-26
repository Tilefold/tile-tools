# Quiz

A short quiz about working in a terminal, one question at a time, on a borderless card floating over your panes. Pick an answer and the card says whether it was right and why; at the end it gives your score.

## Using it

- **Quiz: Start or show** opens the quiz where you left it. Click an answer, or press its number or letter (1–4, A–D); **Enter** goes on to the next question, and **Escape** closes the card. Click into the card first, as a card over your panes doesn't take the keyboard on its own.
- **Quiz: Start over** begins again from the first question, and **Quiz: Close** puts the card away. Your progress is kept, even across a restart of Tilefold.
- **Moving the card:** it starts in a corner of the pane you're working in and follows you when you switch panes. Drag the bar above it (its grip) to put it anywhere in the window; it stays there until you run **Quiz: Put the card back in the pane** or choose another corner.

## Settings

In **Settings → Tiles → Quiz**:

- **Show the quiz:** on a card over the panes (the default), or in a panel beside the panes, where the questions and answers are rows drawn in your theme.
- **Corner of the pane for the card:** where the card starts.

The floating card needs Tilefold 0.1.11. From 0.1.7 to 0.1.10 the quiz opens in a window of its own, and the panel needs 0.1.9.

## How it's built

The quiz lives in the tile (`src/quiz.js`); the card's page (`page-src/`) only draws what the tile sends it and says what you clicked, and the panel gets rows for the same state (`src/view.js`), so both always agree. The card is the page docked in Tilefold's window, which has no frame, with its grip drawn as overlay items above it (`src/card.js`, `src/scene.js`): a docked page keeps the pointer, so the page itself can't be what you drag.

To make your own quiz, replace the questions in `src/questions.js` and their strings in `locales/`. Each question names its text and explanation by key and lists its choices, which stay the same in every language.

What you do is recorded in the tile's log in **Settings → Tiles**: opening and closing the quiz, each answer (which question and whether it was right), finishing, starting over and moving the card.

Copyright (c) 2026 Tilefold
Released under the MIT License.
Last updated: 2026-10-26 by Tilefold
