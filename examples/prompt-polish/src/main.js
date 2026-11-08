/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — corrects the prompts you write to AI agents
 *
 * Write a prompt in the language you choose; Claude fixes its spelling,
 * grammar, spacing and punctuation (or also makes it read naturally),
 * with your own Anthropic key. You see every change with a reason, keep
 * your own words wherever you like, and send the result to the agent in
 * your pane from Tilefold's ask card. Code, file paths and links are never
 * changed. The page shows on a card over the agent's pane, behind a button
 * in its corner, or in the dock beside the panes.
 *
 * Needs Tilefold 0.1.23 (`tf.agent.ask`); over the pane from 0.1.11, beside
 * the panes from 0.1.20.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
import { runPolish } from "./run.js";
import { registerSettings } from "./settings.js";

export default (tf) => {
  registerSettings(tf);
  runPolish(tf);
};
