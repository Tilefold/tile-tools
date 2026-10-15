#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree hooks — the hook command
 *
 * Run by an agent after each tool call (a PostToolUse hook):
 *
 *   node record.mjs <claude|codex> --foldertree
 *
 * It reads the hook's JSON from stdin, finds the files the tool read or
 * changed (agents.mjs), and leaves a marker for each in the project's
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
import { actionsFrom } from "./agents.mjs";
import { projectRoot, relPath, writeMarkers } from "./marker.mjs";

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

/** Records the actions in `hook` for `agent`; returns the markers written. */
export function record(hook, agent, env = process.env) {
  const cwd = typeof hook?.cwd === "string" && hook.cwd ? hook.cwd : process.cwd();
  const info = (abs) => {
    try {
      const st = statSync(abs);
      return { file: st.isFile(), mtimeMs: st.mtimeMs, birthtimeMs: st.birthtimeMs };
    } catch {
      return null;
    }
  };
  const pane = env.FOLDERTREE_PANE || AGENTS[agent] || agent || "agent";
  const written = [];
  const agentDir = resolve(cwd);
  for (const { action, file } of actionsFrom(hook, info)) {
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
