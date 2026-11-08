/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Agent Pack — the panel
 *
 * The panel docked beside the panes. On top, "Add your own agent": a name
 * field and a command field (each sent with Enter, after which Tilefold
 * empties it), the name and command typed so far, what clears the agent's
 * context (a click steps through /clear, /new and none), what to fix if
 * anything, and Add this agent. Below, "Ready-made": one row per preset,
 * with its command; a click offers it. Pure: builds the rows from the
 * draft, and names what a click on a row asks for.
 */
import { commandWords, draftProblem } from "./ownAgent.js";
import { PRESETS } from "./presets.js";

/** Row ids. */
export const ROW = {
  nameField: "own-name",
  commandField: "own-command",
  name: "own-name-now",
  command: "own-command-now",
  clear: "own-clear",
  problem: "own-problem",
  add: "own-add",
  start: "own-start-over",
};

/** Longest name or command shown in a row (a row's label holds at most 256 characters). */
const SHOWN = 120;

/** `text` cut to SHOWN characters, with an ellipsis when it was longer. */
const shorten = (text) => {
  const chars = [...text];
  return chars.length > SHOWN ? `${chars.slice(0, SHOWN - 1).join("")}…` : text;
};

/** The row id for a preset. */
export const presetRow = (id) => `preset:${id}`;

/**
 * What a click on `row` asks for: `{ kind: "add" }`, `{ kind: "clear" }`,
 * `{ kind: "start" }`, `{ kind: "preset", preset }`, or null for a row that
 * does nothing.
 *
 * @param {string} row
 */
export function clickTarget(row) {
  if (row === ROW.add) return { kind: "add" };
  if (row === ROW.clear) return { kind: "clear" };
  if (row === ROW.start) return { kind: "start" };
  if (row.startsWith("preset:")) {
    const preset = PRESETS.find((p) => presetRow(p.id) === row);
    return preset ? { kind: "preset", preset } : null;
  }
  return null;
}

/** The label for what clears the context. */
const clearLabel = (t, clear) =>
  t("own-clear", { how: clear === "" ? t("own-clear-none") : clear });

/**
 * The panel's content for the draft.
 *
 * @param {(key: string, args?: Record<string, string | number>) => string} t
 * @param {{ name: string, command: string, clear: string }} draft
 */
export function panelContent(t, draft) {
  const problem = draftProblem(draft);
  // A part not typed yet is shown as "not set", not as an error.
  const typed = draft.name.trim() !== "" || draft.command.trim() !== "";
  const showProblem =
    problem &&
    typed &&
    !(problem === "own-problem-name-empty" && !draft.name) &&
    !(problem === "own-problem-command-empty" && !draft.command);
  const rows = [
    { id: "own", label: t("own-section"), section: true },
    {
      id: ROW.nameField,
      label: t("own-name-field"),
      input: { kind: "text", placeholder: t("own-name-placeholder") },
    },
    {
      id: ROW.commandField,
      label: t("own-command-field"),
      input: { kind: "text", placeholder: t("own-command-placeholder") },
    },
    draft.name.trim()
      ? {
          id: ROW.name,
          label: t("own-name-now", { name: shorten(draft.name.trim()) }),
          icon: "info",
        }
      : { id: ROW.name, label: t("own-name-unset"), muted: true },
    draft.command.trim()
      ? {
          id: ROW.command,
          label: t("own-command-now", { command: shorten(commandWords(draft.command).join(" ")) }),
          icon: "info",
        }
      : { id: ROW.command, label: t("own-command-unset"), muted: true },
    { id: ROW.clear, label: clearLabel(t, draft.clear), hint: t("own-clear-hint") },
  ];
  if (showProblem) rows.push({ id: ROW.problem, label: t(problem), icon: "error", tone: "error" });
  rows.push(
    problem
      ? { id: ROW.add, label: t("own-add"), muted: true, hint: t("own-add-hint") }
      : { id: ROW.add, label: t("own-add"), tone: "accent" },
  );
  if (typed) rows.push({ id: ROW.start, label: t("own-start-over"), muted: true });
  rows.push({ id: "ready", label: t("ready-section"), section: true });
  for (const p of PRESETS) {
    rows.push({ id: presetRow(p.id), label: p.name, trail: p.command, hint: t("ready-hint") });
  }
  return { title: t("panel-title"), rows };
}
