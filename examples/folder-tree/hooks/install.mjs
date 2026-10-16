#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree hooks — setting them up
 *
 *   node hooks/install.mjs            add the hooks for Claude Code and Codex
 *   node hooks/install.mjs --claude   only Claude Code (or --codex: only Codex)
 *   node hooks/install.mjs --remove   take them out again
 *   node hooks/install.mjs --dry-run  say what would change, change nothing
 *
 * Adds two hooks that run record.mjs (from this folder, by its full path)
 * to ~/.claude/settings.json and ~/.codex/hooks.json: a PreToolUse one on
 * shell commands, which only takes a stamp and so is quick, and a
 * PostToolUse one on the tools that read or change files, which runs in
 * the background so the agent never waits for it. Without
 * --claude or --codex it sets up each agent whose folder (~/.claude,
 * ~/.codex) exists. Each file is copied to `<file>.foldertree-backup`
 * before it is changed; everything else in it is kept as it was. Running
 * it again replaces Folder Tree's hook rather than adding a second one,
 * so it is also how the hook follows the tile to a new folder.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** What marks a hook command as Folder Tree's. */
export const TAG = "--foldertree";
/** The record.mjs next to this file. */
const RECORD = join(dirname(fileURLToPath(import.meta.url)), "record.mjs");

/** The hook events Folder Tree adds a hook to. */
export const EVENTS = ["PreToolUse", "PostToolUse"];

/**
 * Each agent: its settings file and, per event, the tools to match and
 * the hook's extra fields.
 */
export const AGENTS = {
  claude: {
    name: "Claude Code",
    dir: ".claude",
    file: "settings.json",
    PreToolUse: { matcher: "Bash", extra: { timeout: 5 } },
    PostToolUse: {
      matcher: "Read|Edit|MultiEdit|Write|NotebookEdit|Grep|Glob|Bash",
      extra: { timeout: 10, async: true },
    },
  },
  codex: {
    name: "Codex",
    dir: ".codex",
    file: "hooks.json",
    PreToolUse: { matcher: "Bash", extra: { timeout: 5 } },
    PostToolUse: { matcher: "apply_patch|Bash", extra: { timeout: 10, async: true } },
  },
};

/** The hook command for `agent`, quoting the path for the shell. */
export const hookCommand = (agent, record = RECORD) =>
  `node "${record.replace(/"/g, '\\"')}" ${agent} ${TAG}`;

/** Whether a matcher group is Folder Tree's. */
const ours = (group) =>
  Array.isArray(group?.hooks) &&
  group.hooks.some((h) => typeof h?.command === "string" && h.command.includes(TAG));

/** `config` without Folder Tree's hooks (a new object). */
export function withoutHook(config) {
  const next = structuredClone(config ?? {});
  for (const event of EVENTS) {
    const list = next.hooks?.[event];
    if (!Array.isArray(list)) continue;
    const kept = list.filter((g) => !ours(g));
    if (kept.length) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  if (next.hooks && !Object.keys(next.hooks).length) delete next.hooks;
  return next;
}

/** `config` with Folder Tree's hooks for `agent` (replacing older ones). */
export function withHook(config, agent, record = RECORD) {
  const spec = AGENTS[agent];
  const next = withoutHook(config);
  next.hooks ??= {};
  for (const event of EVENTS) {
    next.hooks[event] ??= [];
    next.hooks[event].push({
      matcher: spec[event].matcher,
      hooks: [{ type: "command", command: hookCommand(agent, record), ...spec[event].extra }],
    });
  }
  return next;
}

/**
 * Sets up (or with `remove`, takes out) the hook for each agent in
 * `agents` under `home`. Returns a line per agent saying what happened.
 */
export function install({
  home = homedir(),
  agents,
  remove = false,
  dryRun = false,
  record = RECORD,
}) {
  const lines = [];
  const chosen = agents?.length
    ? agents
    : Object.keys(AGENTS).filter((a) => existsSync(join(home, AGENTS[a].dir)));
  if (!chosen.length) return ["No Claude Code or Codex settings found (~/.claude, ~/.codex)."];
  for (const agent of chosen) {
    const spec = AGENTS[agent];
    const file = join(home, spec.dir, spec.file);
    let config = {};
    if (existsSync(file)) {
      try {
        config = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        lines.push(`${spec.name}: ${file} isn't valid JSON; left as it is.`);
        continue;
      }
    }
    const next = remove ? withoutHook(config) : withHook(config, agent, record);
    if (JSON.stringify(next) === JSON.stringify(config)) {
      lines.push(`${spec.name}: nothing to change in ${file}.`);
      continue;
    }
    if (!dryRun) {
      mkdirSync(dirname(file), { recursive: true });
      if (existsSync(file)) copyFileSync(file, `${file}.foldertree-backup`);
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    }
    const verb = remove ? "removed the hooks from" : "added the hooks to";
    lines.push(`${spec.name}: ${dryRun ? "would have " : ""}${verb} ${file}.`);
  }
  if (!remove && !dryRun && chosen.includes("codex")) {
    lines.push("Codex asks you to review and trust the new hooks the next time it starts.");
  }
  return lines;
}

// Run as a command (not when imported by the tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  const agents = Object.keys(AGENTS).filter((a) => args.has(`--${a}`));
  const lines = install({ agents, remove: args.has("--remove"), dryRun: args.has("--dry-run") });
  for (const line of lines) console.log(line);
}
