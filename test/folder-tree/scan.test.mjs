// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — what a shell command really did
 *
 * A stamp taken before a call is found again after it, and only once;
 * stamps left behind are cleared. The files changed since a stamp are
 * found by find and by the walker alike, new ones told apart, and tools'
 * output folders skipped. A search's printed paths count as reads, only
 * for searches and only for files. Claude Code's Grep and Glob results
 * count as reads. The hook takes a stamp before a shell command and marks
 * what changed and what was found after it, falls back to the command's
 * names without a stamp, and the installer adds and removes both hooks.
 */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { actionsFrom } from "../../examples/folder-tree/hooks/agents.mjs";
import { AGENTS, withHook, withoutHook } from "../../examples/folder-tree/hooks/install.mjs";
import { callId, record } from "../../examples/folder-tree/hooks/record.mjs";
import {
  changedSince,
  outputReads,
  STAMP_MAX_AGE_MS,
  stampPath,
  startStamp,
  takeStamp,
  walkChanged,
} from "../../examples/folder-tree/hooks/scan.mjs";
import { decodeMarker } from "../../examples/folder-tree/src/marker.js";

const made = [];
/** A fresh temporary folder, removed after the test. */
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "foldertree-scan-"));
  made.push(dir);
  return dir;
};
afterEach(() => {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true });
});

/** Waits (busily, a few milliseconds) until the clock has passed `ms`. */
const until = (ms) => {
  while (Date.now() <= ms + 5);
};

/** The markers in a folder, decoded. */
const markers = (dir) =>
  readdirSync(join(dir, ".foldertree"))
    .filter((n) => n.startsWith("ft1."))
    .map((n) => decodeMarker(n))
    .map((m) => `${m.action} ${m.path}`)
    .sort();

describe("stamps", () => {
  it("are found again after the call, once", () => {
    const dir = scratch();
    expect(startStamp("call-1", { dir, now: 1_000_000 })).toBe(join(dir, "call-1"));
    expect(takeStamp("call-1", { dir })).toBe(1_000_000);
    expect(takeStamp("call-1", { dir })).toBeNull();
    expect(takeStamp("never", { dir })).toBeNull();
  });

  it("need an id, and keep it to a safe file name", () => {
    expect(stampPath("", "/s")).toBeNull();
    expect(stampPath(null, "/s")).toBeNull();
    expect(stampPath("a/../b c", "/s")).toBe(join("/s", "a____b_c"));
    expect(startStamp(undefined, { dir: scratch() })).toBeNull();
  });

  it("left behind are cleared when a new one is taken", () => {
    const dir = scratch();
    const now = Date.now();
    startStamp("old", { dir, now: now - STAMP_MAX_AGE_MS - 1000 });
    startStamp("new", { dir, now });
    expect(readdirSync(dir)).toEqual(["new"]);
  });

  it("are the same before and after a call", () => {
    const hook = { session_id: "s", tool_use_id: "t1" };
    expect(callId(hook)).toBe("s-t1");
    expect(callId({ call_id: "c" })).toBe("-c");
    expect(callId({})).toBeNull();
  });
});

describe("changed files", () => {
  /** A project with an old file, then a stamp, then changes. */
  const project = () => {
    const root = scratch();
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "node_modules", "x"), { recursive: true });
    writeFileSync(join(root, "src", "old.js"), "1");
    writeFileSync(join(root, "src", "same.js"), "1");
    const before = Date.now() - 60_000;
    utimesSync(join(root, "src", "same.js"), before / 1000, before / 1000);
    const since = Date.now();
    until(since);
    writeFileSync(join(root, "src", "old.js"), "2");
    writeFileSync(join(root, "src", "new.js"), "1");
    writeFileSync(join(root, "node_modules", "x", "i.js"), "1");
    return { root, since };
  };

  it("are found by walking, skipping tools' output", () => {
    const { root, since } = project();
    expect(walkChanged(root, since).sort()).toEqual([
      join(root, "src", "new.js"),
      join(root, "src", "old.js"),
    ]);
  });

  it.skipIf(process.platform === "win32")("are found by find too, new ones told apart", () => {
    const { root, since } = project();
    const found = changedSince(root, since, { walk: false });
    expect(found.map((f) => f.file).sort()).toEqual([
      join(root, "src", "new.js"),
      join(root, "src", "old.js"),
    ]);
    expect(found.find((f) => f.file.endsWith("new.js")).made).toBe(true);
  });

  it("scan the project even when it is named like a skipped folder", () => {
    const root = join(scratch(), "build");
    mkdirSync(root);
    const since = Date.now();
    until(since);
    writeFileSync(join(root, "a.js"), "1");
    expect(changedSince(root, since).map((f) => f.file)).toEqual([join(root, "a.js")]);
  });
});

describe("found files", () => {
  const files = new Set(["/w/src/a.js", "/w/b.md"]);
  const isFile = (f) => files.has(f);

  it("are what a search printed, with or without line numbers", () => {
    const out = "src/a.js:12:const x\nsrc/a.js:30-  y\n/w/b.md\nmissing.js:1:z\n";
    expect(outputReads("rg -n x", out, "/w", isFile)).toEqual(["/w/src/a.js", "/w/b.md"]);
    expect(outputReads("cd /w && git grep -l x", "b.md\n", "/w", isFile)).toEqual(["/w/b.md"]);
    expect(outputReads("LC_ALL=C /usr/bin/grep -rl x .", "src/a.js\n", "/w", isFile)).toEqual([
      "/w/src/a.js",
    ]);
  });

  it("count only for searches", () => {
    expect(outputReads("echo src/a.js", "src/a.js\n", "/w", isFile)).toEqual([]);
    expect(outputReads("rg x", "", "/w", isFile)).toEqual([]);
    expect(outputReads("rg x", undefined, "/w", isFile)).toEqual([]);
  });

  it("from Claude Code's Grep and Glob count as reads", () => {
    const hook = (tool_name, filenames) => ({ cwd: "/w", tool_name, tool_response: { filenames } });
    expect(actionsFrom(hook("Grep", ["src/a.js", "/w/b.md"]))).toEqual([
      { action: "r", file: "/w/src/a.js" },
      { action: "r", file: "/w/b.md" },
    ]);
    expect(actionsFrom(hook("Glob", ["x.ts", 3, ""]))).toEqual([{ action: "r", file: "/w/x.ts" }]);
    expect(actionsFrom(hook("Grep", undefined))).toEqual([]);
  });
});

describe("hook around a shell command", () => {
  it("marks what changed under the project and what a search found", () => {
    const root = scratch();
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "found.js"), "x");
    writeFileSync(join(root, "src", "edit.js"), "1");
    const stamps = { dir: join(scratch(), "stamps") };
    const base = { session_id: "s", tool_use_id: "t", cwd: root, tool_name: "Bash" };
    // A script that names no file, then a search.
    const command = "python3 tools/rewrite.py && rg -l x src";
    until(Date.now());
    const pre = { ...base, hook_event_name: "PreToolUse", tool_input: { command } };
    expect(record(pre, "claude", {}, { stamps })).toEqual([]);
    until(Date.now());
    writeFileSync(join(root, "src", "edit.js"), "2");
    writeFileSync(join(root, "src", "made.js"), "1");
    const post = {
      ...base,
      hook_event_name: "PostToolUse",
      tool_input: { command },
      tool_response: { stdout: "src/found.js\n" },
    };
    record(post, "claude", {}, { stamps });
    expect(markers(root)).toEqual(["a src/made.js", "e src/edit.js", "r src/found.js"]);
    expect(readdirSync(stamps.dir)).toEqual([]);
  });

  it("marks an in-place edit as an edit, though the editor replaced the file", () => {
    const root = scratch();
    mkdirSync(join(root, ".git"));
    writeFileSync(join(root, "a.js"), "1");
    const stamps = { dir: join(scratch(), "stamps") };
    until(Date.now());
    const command = "sed -i '' s/1/2/ a.js";
    const base = { session_id: "s", tool_use_id: "i", cwd: root, tool_name: "Bash" };
    record(
      { ...base, hook_event_name: "PreToolUse", tool_input: { command } },
      "claude",
      {},
      {
        stamps,
      },
    );
    until(Date.now());
    // Replaced, as sed -i does: a new file under the old name.
    rmSync(join(root, "a.js"));
    writeFileSync(join(root, "a.js"), "2");
    record(
      { ...base, hook_event_name: "PostToolUse", tool_input: { command } },
      "claude",
      {},
      {
        stamps,
      },
    );
    expect(markers(root)).toEqual(["e a.js"]);
  });

  it("falls back to the command's names without a stamp", () => {
    const root = scratch();
    mkdirSync(join(root, ".git"));
    writeFileSync(join(root, "a.js"), "1");
    const stamps = { dir: join(scratch(), "stamps") };
    const post = {
      session_id: "s",
      tool_use_id: "none",
      hook_event_name: "PostToolUse",
      cwd: root,
      tool_name: "Bash",
      tool_input: { command: "sed -i '' s/1/2/ a.js" },
    };
    record(post, "claude", {}, { stamps });
    expect(markers(root)).toEqual(["e a.js"]);
  });
});

describe("installer", () => {
  it("adds a quick hook before shell commands and a background one after", () => {
    const config = withHook({}, "claude", "/t/record.mjs");
    expect(config.hooks.PreToolUse).toEqual([
      {
        matcher: "Bash",
        hooks: [
          { type: "command", command: 'node "/t/record.mjs" claude --foldertree', timeout: 5 },
        ],
      },
    ]);
    expect(config.hooks.PostToolUse[0]).toMatchObject({
      matcher: AGENTS.claude.PostToolUse.matcher,
      hooks: [{ async: true }],
    });
    expect(config.hooks.PostToolUse[0].matcher).toContain("Grep|Glob");
    // Again: replaced, not added twice; then taken out, keeping others' hooks.
    const other = { matcher: "Bash", hooks: [{ type: "command", command: "other" }] };
    const twice = withHook(
      { hooks: { ...config.hooks, PreToolUse: [...config.hooks.PreToolUse, other] } },
      "claude",
      "/t/record.mjs",
    );
    expect(twice.hooks.PreToolUse).toHaveLength(2);
    expect(twice.hooks.PostToolUse).toHaveLength(1);
    expect(withoutHook(twice)).toEqual({ hooks: { PreToolUse: [other] } });
  });
});
