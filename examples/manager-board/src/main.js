/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — what you and your agents said and did, as a timeline
 *
 * A board docked beside your panes that shows, as one timeline, what
 * happens between you, your manager agents and the agents they start: what
 * you asked and what they replied, messages between panes, the panes an
 * agent asked to open and what you answered, heartbeat nudges and schedule
 * runs. Two views: Timeline (newest first, by hour) and Lanes (one lane per
 * participant, across time). Narrow it to a manager's team, a project or a
 * fold; read a long text in full; export the view as Markdown or JSON.
 *
 * It shows how a tile reads Tilefold's agents' timeline (tf.timeline, the
 * agent.timeline permission) and draws it on a page of its own.
 *
 * Needs Tilefold 0.1.27.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
import { runBoard } from "./run.js";

export default (tf) => {
  runBoard(tf);
};
