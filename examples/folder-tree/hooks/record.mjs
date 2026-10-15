#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree hooks — the hook command
 *
 * Run by an agent before each shell command (a PreToolUse hook) and after
 * each tool call (a PostToolUse hook):
 *
 *   node record.mjs <claude|codex> --foldertree
 *
 * Before a shell command it only takes a stamp (scan.mjs). After a call it
 * reads the hook's JSON from stdin and finds the files the tool read or
 * changed: from the tool's input (agents.mjs) and, for a shell command
 * with a stamp, every file under the project changed since the stamp and
 * every file a search printed (scan.mjs); without a stamp (an older
 * install) it falls back to the names in the command. It leaves a marker
 * for each in the project's
 * `.foldertree` folder (marker.mjs), and in the agent's own folder too when
 * the file is inside it. The tile reads markers only in the tree's folder
 * and the folders above it that a pane is in, so an agent started above
 * the project (a workspace of several repositories) or below its top
 * would otherwise go unseen. The pane's name is FOLDERTREE_PANE
 * when set, otherwise the agent's ("Claude Code", "Codex").
 *
 * It never stands in the agent's way: it prints nothing (an agent may
 * read a hook's output as context), always exits 0, and gives up on input
 * over 4 MB or after 5 seconds. `--foldertree` only marks the command as
 * Folder Tree's, so install.mjs can find it again.
 */
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { actionsFrom, commandDir, commandText, SHELL_TOOLS } from "./agents.mjs";
import { projectRoot, relPath, writeMarkers } from "./marker.mjs";
import { changedSince, outputReads, startStamp, takeStamp } from "./scan.mjs";

/** Biggest hook input read. */
const MAX_INPUT = 4 * 1024 * 1024;
/** Agent names shown when FOLDERTREE_PANE is not set. */
const AGENTS = { claude: "Claude Code", codex: "Codex" };

/** The hook's input, or null. */
function readInput() {
  return new Promise((done) => {
    const chunks = [];
    let size = 0;
    const stop = setTimeout(() => done(null), 5000);
    process.stdin.on("data", (c) => {
      size += c.length;
      if (size > MAX_INPUT) {
        clearTimeout(stop);
        done(null);
        process.stdin.destroy();
      } else chunks.push(c);
    });
    process.stdin.on("end", () => {
      clearTimeout(stop);
      try {
        done(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        done(null);
      }
    });
    process.stdin.on("error", () => done(null));
  });
}

/** What is at `abs`, for agents.mjs (null when nothing is). */
const info = (abs) => {
  try {
    const st = statSync(abs);
    return { file: st.isFile(), mtimeMs: st.mtimeMs, birthtimeMs: st.birthtimeMs };
  } catch {
    return null;
  }
};

/** The id of a tool call, the same before and after it (null when the agent gives none). */
export function callId(hook) {
  const id = hook?.tool_use_id ?? hook?.call_id ?? hook?.tool_call_id;
  if (typeof id !== "string" || !id) return null;
  return `${hook?.session_id ?? ""}-${id}`;
}

/** Whether `dir` is too broad to scan: the home folder or a disk's top. */
const broad = (dir, home) => dir === home || resolve(dir, "..") === dir;

/**
 * The actions of a shell call: the deletions and reads its text shows,
 * plus, when a stamp was taken before it, the files changed since then
 * under the project and those its search printed. Without a stamp, the
 * guesses from its text (`fallback`) stand.
 */
export function shellActions(hook, fallback, { cwd, since, home = process.env.HOME ?? "" }) {
  if (since === null) return fallback;
  const text = commandText(hook?.tool_input ?? {});
  const dir = commandDir(text, cwd);
  const root = projectRoot(dir);
  const changed = broad(root, home) ? [] : changedSince(root, since);
  const actions = changed.map(({ file, made }) => ({ action: made ? "a" : "e", file }));
  const done = new Set(actions.map((a) => a.file));
  for (const a of fallback) {
    if (a.action === "d" || (a.action === "r" && !done.has(resolve(cwd, a.file)))) actions.push(a);
  }
  const stdout = hook?.tool_response?.stdout ?? hook?.tool_response?.output;
  const isFile = (f) => info(f)?.file === true;
  for (const file of outputReads(text, stdout, dir, isFile)) {
    if (!done.has(file)) actions.push({ action: "r", file });
  }
  return actions;
}

/** Records the actions in `hook` for `agent`; returns the markers written. */
export function record(hook, agent, env = process.env, { stamps } = {}) {
  const cwd = typeof hook?.cwd === "string" && hook.cwd ? hook.cwd : process.cwd();
  const tool = String(hook?.tool_name ?? "");
  const shell = SHELL_TOOLS.has(tool);
  if (hook?.hook_event_name === "PreToolUse") {
    if (shell) startStamp(callId(hook), stamps);
    return [];
  }
  let actions = actionsFrom(hook, info);
  if (shell && !commandText(hook?.tool_input ?? {}).includes("*** Begin Patch")) {
    const since = takeStamp(callId(hook), stamps);
    actions = shellActions(hook, actions, { cwd, since, home: env.HOME ?? "" });
  }
  const pane = env.FOLDERTREE_PANE || AGENTS[agent] || agent || "agent";
  const written = [];
  const agentDir = resolve(cwd);
  for (const { action, file } of actions) {
    const abs = resolve(cwd, file);
    // The project is found from the file (it may be outside the agent's folder).
    const roots = [projectRoot(resolve(abs, ".."))];
    if (relPath(agentDir, abs) !== null) roots.push(agentDir);
    try {
      written.push(...writeMarkers(roots, { action, pane, file: abs }));
    } catch {
      // Never fail the agent.
    }
  }
  return written;
}

// Run as a command (not when imported by the tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const agent = process.argv[2] ?? "agent";
  readInput()
    .then((hook) => {
      if (hook) record(hook, agent);
    })
    .catch(() => {})
    .finally(() => process.exit(0));
}
