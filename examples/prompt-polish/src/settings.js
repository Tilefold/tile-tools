/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — settings and commands
 *
 * What the user chooses in Settings → Tiles → Prompt Polish: the language
 * they write prompts in, whether to fix mistakes only or also make the
 * prompt read naturally, where the page shows, and whether to use the
 * faster, cheaper model, and who checks: Claude with their own key, or the
 * agent in their pane. And the palette commands, each with a fixed id.
 *
 * Modified 2026-11-06 (no-key mode): the `checker` setting.
 * Modified 2026-11-06 (polish agent): the `helperAgent` setting, the
 *   agent Tilefold starts in a tab of its own to check prompts when there
 *   is no key (or always, with `checker` "agent").
 * Modified 2026-11-07 (see-through card): the `solid` setting, how solid
 *   the card's background is over the pane (100: not see-through).
 * Modified 2026-11-07 (text only): `solid` goes down to 10%, and to 0,
 *   "Text only" (only the card's text shows over the pane).
 * Modified 2026-11-07 (own cases): the `cases` setting, the user's own
 *   cases (cases.js), a text of several lines (Tilefold 0.1.27).
 */
import { parseCases } from "./cases.js";
import { LANGUAGES } from "./languages.js";
import { VIEWS, viewOf } from "./place.js";

/** The modes: fix mistakes only, or also make it natural. */
export const MODES = ["fix", "natural"];

/** Who checks prompts: Claude with the user's key (else the polish agent), or always the agent. */
export const CHECKERS = ["claude", "agent"];

/** How solid the card's background can be over the pane, in percent (0: text only). */
export const SOLIDS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

/** A known solid level, else fully solid. */
export const solidOf = (v) => (SOLIDS.includes(Number(v)) ? Number(v) : 100);

/** The agents the polish agent can be, with their names (not translated). */
export const HELPER_AGENTS = [
  { value: "claude", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini CLI" },
  { value: "cursor", label: "Cursor Agent" },
  { value: "agy", label: "Antigravity CLI" },
  { value: "opencode", label: "OpenCode" },
];

/** The label of each mode, view and checker. */
const MODE_KEYS = { fix: "setting-mode-fix", natural: "setting-mode-natural" };
const CHECKER_KEYS = { claude: "setting-checker-claude", agent: "setting-checker-agent" };
const VIEW_KEYS = {
  corner: "setting-view-corner",
  bottom: "setting-view-bottom",
  side: "setting-view-side",
};

/** The palette commands: their id and title key. */
export const COMMANDS = [
  { id: "open", title: "cmd-open" },
  { id: "close", title: "cmd-close" },
];

/** Registers the settings, up front as Tilefold expects. */
export function registerSettings(tf) {
  tf.setting("language", "auto", tf.t("setting-language"), {
    choices: [
      { value: "auto", label: tf.t("setting-language-auto") },
      ...LANGUAGES.map((l) => ({ value: l.code, label: l.native })),
    ],
  });
  tf.setting("mode", "fix", tf.t("setting-mode"), {
    choices: MODES.map((value) => ({ value, label: tf.t(MODE_KEYS[value]) })),
  });
  // The user's own cases: several lines (a Tilefold before 0.1.27 shows one line).
  tf.setting("cases", "", tf.t("setting-cases"), { multiline: true });
  tf.setting("view", "corner", tf.t("setting-view"), {
    choices: VIEWS.map((value) => ({ value, label: tf.t(VIEW_KEYS[value]) })),
  });
  tf.setting("checker", "claude", tf.t("setting-checker"), {
    choices: CHECKERS.map((value) => ({ value, label: tf.t(CHECKER_KEYS[value]) })),
  });
  tf.setting("helperAgent", "claude", tf.t("setting-helper-agent"), {
    choices: HELPER_AGENTS.map((a) => ({ ...a })),
  });
  tf.setting("solid", "100", tf.t("setting-solid"), {
    choices: SOLIDS.map((v) => ({
      value: String(v),
      label:
        v === 100
          ? tf.t("setting-solid-full")
          : v === 0
            ? tf.t("setting-solid-text-only")
            : tf.t("setting-solid-percent", { percent: v }),
    })),
  });
  tf.setting("fast", true, tf.t("setting-fast"));
}

/** Reads a setting; a missing one is undefined. */
const read = (settings, key) => {
  try {
    return settings.get(key);
  } catch {
    return undefined;
  }
};

/** The settings as the tile uses them, each checked. */
export function settingsOf(settings) {
  const mode = read(settings, "mode");
  return {
    language: read(settings, "language"),
    mode: mode === "natural" ? "natural" : "fix",
    cases: parseCases(read(settings, "cases")),
    view: viewOf(read(settings, "view")),
    fast: read(settings, "fast") !== false,
    checker: read(settings, "checker") === "agent" ? "agent" : "claude",
    helperAgent: helperAgentOf(read(settings, "helperAgent")),
    solid: solidOf(read(settings, "solid")),
  };
}

/** A known polish agent's id, else Claude Code's. */
export const helperAgentOf = (v) =>
  HELPER_AGENTS.some((a) => a.value === v) ? v : HELPER_AGENTS[0].value;

/** The polish agent's name, for the card. */
export const helperAgentName = (v) => HELPER_AGENTS.find((a) => a.value === helperAgentOf(v)).label;

/** The settings the card shows: the mode, and the polish agent's name. */
export const cardSettings = (c) => ({
  mode: c.mode,
  helperName: helperAgentName(c.helperAgent),
  solid: c.solid,
});

/** The view setting's label, for the page's view switch. */
export const viewLabelKey = (view) => VIEW_KEYS[viewOf(view)];
