/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — asking the agent
 *
 * When the user asks on the board and no agent is waiting to read it, the
 * tile brings the question to the agent through Tilefold's ask card
 * (`tf.agent.ask`, Tilefold 0.1.23, permission `agent.ask`). Tilefold
 * shows the question at the top of its window with a line saying where it
 * came from, and the user presses Return to send it. The tile never sends
 * anything to a pane itself.
 *
 * `aboutLine` is that line's text: the board, what the user pointed at,
 * and how to read the rest (an area marked on a 3D scene is put into
 * words by area.js). `askAgent` makes the ask and says how the
 * question went: "card" (the card is open), or "board" (it waits on the
 * board for the agent's next read: no question, an older Tilefold, a card
 * already open, or no pane to send to).
 */

import { areaWords } from "./area.js";

/** Text cut to `max` characters on one line. */
const clip = (s, max) => {
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

/** Most characters of the about line (Tilefold takes 600). */
export const ABOUT_MAX = 600;

/**
 * What the question is about, for the agent: the board's title, the line
 * or drawing pointed at, and that reading the board shows the rest.
 * @param {any} board
 * @param {{ line?: number, shape?: string }} asked
 */
export function aboutLine(board, asked) {
  const title = board.title ? ` "${clip(board.title, 80)}"` : "";
  let what = "";
  if (Number.isInteger(asked.line) && board.content) {
    const text = board.content.lines[asked.line - board.content.from] ?? "";
    what = `, pointing at line ${asked.line}${text.trim() ? `: ${clip(text, 160)}` : ""}`;
  } else if (typeof asked.shape === "string") {
    const shape = board.shapes.find((s) => s.id === asked.shape);
    const label = shape?.label ?? shape?.text;
    const kind = shape?.kind ?? "drawing";
    what = `, pointing at the ${kind} "${clip(asked.shape, 40)}"${label ? ` (${clip(label, 80)})` : ""}`;
    if (asked.area) what += `, at ${clip(areaWords(asked.area), 300)}`;
    else if (asked.part) what += `, at its part "${clip(asked.part, 80)}"`;
  }
  const read = "Run the Whiteboard's read command with tile_run to see the board.";
  return clip(`On the Whiteboard${title}${what}. ${read}`, ABOUT_MAX);
}

/**
 * Brings the user's question to the agent on Tilefold's ask card.
 * @param {any} tf
 * @param {any} board
 * @returns {Promise<"card" | "board">}
 */
export async function askAgent(tf, board) {
  const asked = board.asked;
  if (!asked?.question || typeof tf.agent?.ask !== "function") return "board";
  try {
    const r = await tf.agent.ask({ question: asked.question, about: aboutLine(board, asked) });
    return r?.shown ? "card" : "board";
  } catch {
    // Refused (not granted, too many asks): the question waits on the board.
    return "board";
  }
}
