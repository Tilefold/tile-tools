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
 *   moves and deletes.
 * - A shell command (Claude Code's and Codex's Bash): a plain `cat`,
 *   `head`, `tail`, `less`, `nl`, `bat` or `sed -n` of files counts as
 *   reading them; a file the command names that changed in the last
 *   CHANGED_MS counts as edited (added when it was also made then); a
 *   file named after `rm` that is gone counts as deleted. Agents do much
 *   of their reading and editing this way (sed -i, heredocs, scripts), so
 *   without it most of their work would go unseen.
 * - Anything else with a `file_path` or `path` in its input counts as an
 *   edit when the tool's name says it writes, or a read when it says it
 *   reads.
 *
 * Nothing here touches the disk except `info`, passed in, so it is
 * tested directly.
 */
import { isAbsolute, resolve } from "node:path";

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
/** A named file changed this recently was changed by the command. */
export const CHANGED_MS = 30_000;
/** Most names looked up for one command. */
const MAX_LOOKUPS = 200;
/** Names that look like files: with a folder, or with an extension. */
const PATH_LIKE = /(?:~?[\w@+.-]*\/)+[\w@+.-]+|[\w@+-][\w@+.-]*\.[A-Za-z0-9]{1,10}\b/g;

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

/** Splits a command into its simple parts (between &&, ||, ;, | and lines). */
const parts = (command) => String(command ?? "").split(/&&|\|\||;|\||\n/);

/**
 * The names a part of a command only reads, or null when the part is not
 * a plain read (another command, a redirect, or sed without -n or with -i).
 */
function plainReadArgs(part) {
  if (/>/.test(part)) return null;
  const [cmd, ...args] = words(part.trim());
  if (!READERS.has(cmd)) return null;
  if (cmd !== "sed") return args;
  // sed reads files only when printing (-n); its script is the first word after.
  if (!args.includes("-n") || args.some((a) => /^-[a-zA-Z]*i/.test(a))) return null;
  return args.filter((a) => a !== "-n").slice(1);
}

/**
 * Files a shell command reads, when it is a plain reader such as
 * `cat a.js` or `sed -n '1,40p' a.js` (each part between &&, ; or |).
 * Only names `exists` says are files count.
 */
export function shellReads(command, exists) {
  const out = [];
  for (const part of parts(command)) {
    const rest = plainReadArgs(part);
    if (!rest) continue;
    for (const arg of rest) {
      if (arg.startsWith("-") || /[<>*?$`]/.test(arg)) continue;
      if (exists(arg)) out.push({ action: "r", file: arg });
    }
  }
  return out.slice(0, MAX_FILES);
}

/**
 * The folder a command's relative names are in: the last plain `cd <dir>`
 * in it (resolved against `cwd`), or `cwd`.
 */
export function commandDir(command, cwd) {
  let dir = cwd;
  for (const part of String(command ?? "").split(/&&|\|\||;|\n/)) {
    const [cmd, target, extra] = words(part.trim());
    if (cmd === "cd" && target && !extra && !/[$`*?]/.test(target)) dir = resolve(dir, target);
  }
  return dir;
}

/**
 * Files a shell command changed, added or deleted. `info(path)` gives
 * { file, mtimeMs, birthtimeMs } for an absolute path, or null when
 * nothing is there; `dir` is where relative names are; `now` the time.
 */
export function shellChanges(command, info, { dir, now = Date.now() }) {
  const text = String(command ?? "");
  const out = [];
  const seen = new Set();
  const add = (action, file) => {
    if (seen.has(file) || out.length >= MAX_FILES) return;
    seen.add(file);
    out.push({ action, file });
  };
  // Removed: names after `rm` that are no longer there.
  for (const part of parts(text)) {
    const [cmd, ...args] = words(part.trim());
    if (cmd !== "rm" && !(cmd === "git" && args[0] === "rm")) continue;
    for (const arg of cmd === "git" ? args.slice(1) : args) {
      if (arg.startsWith("-") || /[<>*?$`]/.test(arg)) continue;
      const abs = resolve(dir, arg);
      if (info(abs) === null) add("d", abs);
    }
  }
  // Changed: names that look like files and were written just now, outside
  // the parts that only read (a file read right after an edit is a read).
  const writing = parts(text)
    .filter((part) => !plainReadArgs(part))
    .join("\n");
  // An in-place editor replaces the file, so its new birth time is no addition.
  const inPlace = /\b(?:sed|perl|ruby)\b[^\n;&|]*\s-[a-zA-Z]*i/.test(text);
  const names = new Set(writing.match(PATH_LIKE) ?? []);
  let lookups = 0;
  for (const name of names) {
    if (lookups++ >= MAX_LOOKUPS) break;
    if (name.startsWith("~") || /^[a-z]+:\/\//i.test(name)) continue;
    const abs = isAbsolute(name) ? name : resolve(dir, name);
    const st = info(abs);
    if (!st?.file || now - st.mtimeMs > CHANGED_MS || st.mtimeMs - now > 1000) continue;
    add(!inPlace && now - st.birthtimeMs <= CHANGED_MS ? "a" : "e", abs);
  }
  return out;
}

/** The Bash or apply_patch command text, however the agent sends it. */
const commandText = (input) => {
  const c = input?.command ?? input?.cmd ?? input?.patch ?? input?.input;
  return Array.isArray(c) ? c.join(" ") : typeof c === "string" ? c : "";
};

/**
 * The file actions in a hook's input. `info(path)` describes what is at
 * an absolute path, or gives null (see shellChanges); it is only asked
 * about names in shell commands. `now` is the time, for the tests.
 */
export function actionsFrom(hook, info = () => null, now = Date.now()) {
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
    if (text.includes("*** Begin Patch")) return patchActions(text);
    const cwd = typeof hook?.cwd === "string" && hook.cwd ? hook.cwd : resolve(".");
    const dir = commandDir(text, cwd);
    const changed = shellChanges(text, info, { dir, now });
    const done = new Set(changed.map((c) => c.file));
    const reads = shellReads(text, (f) => info(resolve(dir, f))?.file === true)
      .map((r) => ({ action: "r", file: resolve(dir, r.file) }))
      .filter((r) => !done.has(r.file));
    return [...changed, ...reads].slice(0, MAX_FILES);
  }
  const file = input.file_path ?? input.path;
  if (typeof file !== "string" || !file) return [];
  if (/write|edit|create|save|patch|update/i.test(tool)) return [{ action: "e", file }];
  if (/read|view|open|get/i.test(tool)) return [{ action: "r", file }];
  return [];
}
