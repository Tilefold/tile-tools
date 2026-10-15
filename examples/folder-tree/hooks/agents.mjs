/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree hooks — what an agent did
 *
 * Reads the JSON an agent gives a PostToolUse hook and returns the file
 * actions in it, as [{ action, file }] (file as the agent wrote it,
 * relative to `cwd` or absolute):
 *
 * - Claude Code: Read (r), Edit and MultiEdit (e), Write (a when it made
 *   the file, e otherwise), NotebookEdit (e).
 * - Codex: apply_patch, whose patch says which files it adds, updates,
 *   moves and deletes; and Bash, where a plain `cat`, `head`, `tail`,
 *   `less`, `nl`, `bat` or `sed -n` of files counts as reading them.
 * - Anything else with a `file_path` or `path` in its input counts as an
 *   edit when the tool's name says it writes, or a read when it says it
 *   reads.
 *
 * Nothing here touches the disk except `exists`, passed in, so it is
 * tested directly.
 */

/** Claude Code's tools that touch one file, and the input field naming it. */
const CLAUDE_TOOLS = {
  Read: ["r", "file_path"],
  Edit: ["e", "file_path"],
  MultiEdit: ["e", "file_path"],
  Write: ["e", "file_path"],
  NotebookEdit: ["e", "notebook_path"],
};
/** Commands that only read the files they name. */
const READERS = new Set(["cat", "head", "tail", "less", "more", "nl", "bat", "sed"]);
/** Most files taken from one command. */
const MAX_FILES = 20;

/** The patch's file actions: added, updated, moved (deleted + added) and deleted. */
export function patchActions(patch) {
  const out = [];
  let last = null;
  for (const line of String(patch ?? "").split(/\r?\n/)) {
    const m = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (m) {
      const action = { Add: "a", Update: "e", Delete: "d" }[m[1]];
      last = { action, file: m[2].trim() };
      out.push(last);
      continue;
    }
    const move = /^\*\*\* Move to: (.+)$/.exec(line);
    if (move && last) {
      last.action = "d";
      out.push({ action: "a", file: move[1].trim() });
      last = null;
    }
  }
  return out.slice(0, MAX_FILES);
}

/** Words of a simple shell command (quotes understood, nothing else). */
function words(command) {
  const out = [];
  const re = /'([^']*)'|"((?:[^"\\]|\\.)*)"|(\S+)/g;
  let m;
  while ((m = re.exec(command))) out.push(m[1] ?? m[2]?.replace(/\\(.)/g, "$1") ?? m[3]);
  return out;
}

/**
 * Files a shell command reads, when it is a plain reader such as
 * `cat a.js` or `sed -n '1,40p' a.js` (each part between &&, ; or |).
 * Only names `exists` says are files count.
 */
export function shellReads(command, exists) {
  const out = [];
  for (const part of String(command ?? "").split(/&&|\|\||;|\|/)) {
    const [cmd, ...args] = words(part.trim());
    if (!READERS.has(cmd)) continue;
    // sed reads files only when printing (-n); its script is the first word after.
    let rest = args;
    if (cmd === "sed") {
      if (!args.includes("-n")) continue;
      rest = args.filter((a) => a !== "-n").slice(1);
    }
    for (const arg of rest) {
      if (arg.startsWith("-") || /[<>*?$`]/.test(arg)) continue;
      if (exists(arg)) out.push({ action: "r", file: arg });
    }
  }
  return out.slice(0, MAX_FILES);
}

/** The Bash or apply_patch command text, however the agent sends it. */
const commandText = (input) => {
  const c = input?.command ?? input?.cmd ?? input?.patch ?? input?.input;
  return Array.isArray(c) ? c.join(" ") : typeof c === "string" ? c : "";
};

/**
 * The file actions in a hook's input. `exists(file)` tells whether a file
 * is there (for reads named in shell commands).
 */
export function actionsFrom(hook, exists = () => false) {
  const tool = String(hook?.tool_name ?? "");
  const input = hook?.tool_input ?? {};
  if (tool in CLAUDE_TOOLS) {
    const [action, field] = CLAUDE_TOOLS[tool];
    const file = input[field];
    if (typeof file !== "string" || !file) return [];
    const made = tool === "Write" && hook?.tool_response?.type === "create";
    return [{ action: made ? "a" : action, file }];
  }
  if (tool === "apply_patch") return patchActions(commandText(input));
  if (tool === "Bash" || tool === "shell" || tool === "exec_command") {
    const text = commandText(input);
    return text.includes("*** Begin Patch") ? patchActions(text) : shellReads(text, exists);
  }
  const file = input.file_path ?? input.path;
  if (typeof file !== "string" || !file) return [];
  if (/write|edit|create|save|patch|update/i.test(tool)) return [{ action: "e", file }];
  if (/read|view|open|get/i.test(tool)) return [{ action: "r", file }];
  return [];
}
