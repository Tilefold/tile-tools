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
 * `.foldertree` folder (marker.mjs). The pane's name is FOLDERTREE_PANE
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
import { projectRoot, writeMarker } from "./marker.mjs";

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
  const isFile = (f) => {
    try {
      return statSync(resolve(cwd, f)).isFile();
    } catch {
      return false;
    }
  };
  const pane = env.FOLDERTREE_PANE || AGENTS[agent] || agent || "agent";
  const written = [];
  for (const { action, file } of actionsFrom(hook, isFile)) {
    const abs = resolve(cwd, file);
    // The project is found from the file (it may be outside the agent's folder).
    try {
      const name = writeMarker(projectRoot(resolve(abs, "..")), { action, pane, file: abs });
      if (name) written.push(name);
    } catch {
      // A folder that can't be written to: skip it, never fail the agent.
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
