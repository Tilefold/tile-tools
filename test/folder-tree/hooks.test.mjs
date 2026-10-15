// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — hook tests
 *
 * The markers the hooks write read back the same in the tile (short and
 * long paths, any pane name), and nothing outside the project or from the
 * future is believed. Old markers and stale half-written ones are pruned,
 * fresh ones kept, and a .gitignore keeps them out of commits. The agents'
 * hook input becomes the right actions (Claude Code's tools, Codex's
 * patches and plain reads in shell commands). The installer adds the hook
 * once, keeps everything else, backs files up, takes the hook out again
 * and never touches a file it can't read. The hook command writes markers
 * at the project's top, prints nothing and always exits 0.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { actionsFrom, patchActions, shellReads } from "../../examples/folder-tree/hooks/agents.mjs";
import {
  hookCommand,
  install,
  TAG,
  withHook,
  withoutHook,
} from "../../examples/folder-tree/hooks/install.mjs";
import {
  KEEP,
  MAX_AGE_MS,
  markerName,
  prune,
  writeMarker,
} from "../../examples/folder-tree/hooks/marker.mjs";
import { record } from "../../examples/folder-tree/hooks/record.mjs";
import { watched } from "../../examples/folder-tree/hooks/watch.mjs";
import { decodeMarker, joinChunks } from "../../examples/folder-tree/src/marker.js";

const HOOKS = fileURLToPath(new URL("../../examples/folder-tree/hooks/", import.meta.url));
const made = [];
/** A fresh temporary folder, removed after the test. */
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "foldertree-"));
  made.push(dir);
  return dir;
};
afterEach(() => {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true });
});

const NOW = Date.UTC(2026, 9, 14, 12);

describe("markers", () => {
  it("read back in the tile as written, short paths and long", () => {
    const short = markerName({
      ts: NOW,
      nonce: "ab12",
      action: "e",
      pane: "Claude Code",
      rel: "src/a.js",
    });
    expect(short.chunks).toEqual([]);
    expect(decodeMarker(short.name, NOW)).toEqual({
      ts: NOW,
      nonce: "ab12",
      action: "e",
      pane: "Claude Code",
      path: "src/a.js",
      chunks: 0,
    });
    const rel = `${"deep/".repeat(60)}ファイル.ts`;
    const long = markerName({ ts: NOW, nonce: "zz99", action: "a", pane: "Ünïcode ✓", rel });
    const head = decodeMarker(long.name, NOW);
    expect(head).toMatchObject({ action: "a", pane: "Ünïcode ✓", path: null });
    expect(joinChunks(long.chunks, head.chunks)).toBe(rel);
    // Every name fits a file system's 255-byte limit.
    for (const n of [short.name, long.name, ...long.chunks])
      expect(Buffer.byteLength(n)).toBeLessThan(256);
  });

  it("are not believed from the future, outside the project or malformed", () => {
    const future = markerName({
      ts: NOW + 120_000,
      nonce: "ab12",
      action: "e",
      pane: "x",
      rel: "a",
    });
    expect(decodeMarker(future.name, NOW)).toBeNull();
    const escape = `ft1.${NOW.toString(36)}.ab12.e.eA.${Buffer.from("../etc/passwd").toString("base64url")}`;
    expect(decodeMarker(escape, NOW)).toBeNull();
    for (const bad of ["", ".gitignore", "ft1.x", "ft1.0mv8xc3mi.ab12.e.eA.~99"]) {
      expect(decodeMarker(bad, NOW)).toBeNull();
    }
    // A missing part means the long path isn't finished yet.
    const long = markerName({
      ts: NOW,
      nonce: "ab12",
      action: "e",
      pane: "x",
      rel: "x/".repeat(150) + "y",
    });
    expect(joinChunks(long.chunks.slice(1), long.chunks.length)).toBeNull();
  });

  it("are written in .foldertree with a .gitignore, inside the project only", () => {
    const root = scratch();
    const name = writeMarker(root, {
      action: "r",
      pane: "Codex",
      file: join(root, "src", "a.js"),
      now: NOW,
    });
    const dir = join(root, ".foldertree");
    expect(readdirSync(dir).sort()).toEqual([".gitignore", name].sort());
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain("*");
    expect(decodeMarker(name, NOW)).toMatchObject({ action: "r", pane: "Codex", path: "src/a.js" });
    expect(
      writeMarker(root, { action: "e", pane: "x", file: join(root, "..", "other.js") }),
    ).toBeNull();
    expect(writeMarker(root, { action: "x", pane: "x", file: join(root, "a.js") })).toBeNull();
    expect(writeMarker(root, { action: "e", pane: "x", file: join(dir, "loop") })).toBeNull();
  });

  it("are pruned past the newest KEEP, after a week, and stale halves only", () => {
    const root = scratch();
    const dir = join(root, ".foldertree");
    mkdirSync(dir);
    const old = markerName({
      ts: NOW - MAX_AGE_MS - 1,
      nonce: "0000",
      action: "e",
      pane: "x",
      rel: "old",
    });
    writeFileSync(join(dir, old.name), "");
    for (let i = 0; i < KEEP + 5; i++) {
      const m = markerName({
        ts: NOW - i * 1000,
        nonce: String(i).padStart(4, "0"),
        action: "e",
        pane: "x",
        rel: "a",
      });
      writeFileSync(join(dir, m.name), "");
    }
    mkdirSync(join(dir, ".tmp-fresh"));
    mkdirSync(join(dir, ".tmp-stale"));
    const longAgo = new Date(NOW - 3_600_000);
    utimesSync(join(dir, ".tmp-stale"), longAgo, longAgo);
    expect(prune(dir, NOW)).toBe(5 + 1 + 1);
    const left = readdirSync(dir);
    expect(left.filter((n) => n.startsWith("ft1.")).length).toBe(KEEP);
    expect(left).toContain(".tmp-fresh");
    expect(left).not.toContain(".tmp-stale");
    expect(left).not.toContain(old.name);
  });
});

describe("agent input", () => {
  it("reads Claude Code's tools", () => {
    const tool = (tool_name, tool_input, tool_response) =>
      actionsFrom({ tool_name, tool_input, tool_response });
    expect(tool("Read", { file_path: "/p/a.js" })).toEqual([{ action: "r", file: "/p/a.js" }]);
    expect(tool("Edit", { file_path: "a.js" })).toEqual([{ action: "e", file: "a.js" }]);
    expect(tool("MultiEdit", { file_path: "a.js" })).toEqual([{ action: "e", file: "a.js" }]);
    expect(tool("Write", { file_path: "n.js" }, { type: "create" })).toEqual([
      { action: "a", file: "n.js" },
    ]);
    expect(tool("Write", { file_path: "n.js" }, { type: "update" })).toEqual([
      { action: "e", file: "n.js" },
    ]);
    expect(tool("NotebookEdit", { notebook_path: "x.ipynb" })).toEqual([
      { action: "e", file: "x.ipynb" },
    ]);
    expect(tool("Read", {})).toEqual([]);
    expect(tool("Grep", { pattern: "x" })).toEqual([]);
  });

  it("reads Codex's patches, moves included", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: src/new.js",
      "+hi",
      "*** Update File: src/a.js",
      "*** Move to: src/b.js",
      "@@",
      "*** Delete File: old.txt",
      "*** End Patch",
    ].join("\n");
    expect(patchActions(patch)).toEqual([
      { action: "a", file: "src/new.js" },
      { action: "d", file: "src/a.js" },
      { action: "a", file: "src/b.js" },
      { action: "d", file: "old.txt" },
    ]);
    expect(actionsFrom({ tool_name: "apply_patch", tool_input: { command: patch } })).toHaveLength(
      4,
    );
    // A patch sent through the shell counts too.
    expect(
      actionsFrom({ tool_name: "Bash", tool_input: { command: ["apply_patch", patch] } }),
    ).toHaveLength(4);
  });

  it("reads plain reads in shell commands, of files that exist", () => {
    const exists = (f) => ["a.js", "src/b.js", "my file.md"].includes(f);
    expect(shellReads("cat a.js && sed -n '1,20p' src/b.js | head -5", exists)).toEqual([
      { action: "r", file: "a.js" },
      { action: "r", file: "src/b.js" },
    ]);
    expect(shellReads(`cat "my file.md" missing.js`, exists)).toEqual([
      { action: "r", file: "my file.md" },
    ]);
    expect(shellReads("sed -i 's/a/b/' a.js; rm a.js; cat *.js", exists)).toEqual([]);
    expect(
      actionsFrom({ tool_name: "Bash", tool_input: { command: "head -n 3 a.js" } }, exists),
    ).toEqual([{ action: "r", file: "a.js" }]);
  });

  it("guesses other tools from their names", () => {
    expect(actionsFrom({ tool_name: "mcp__fs__write_file", tool_input: { path: "a" } })).toEqual([
      { action: "e", file: "a" },
    ]);
    expect(actionsFrom({ tool_name: "mcp__fs__read_file", tool_input: { path: "a" } })).toEqual([
      { action: "r", file: "a" },
    ]);
    expect(actionsFrom({ tool_name: "mcp__x__frobnicate", tool_input: { path: "a" } })).toEqual([]);
    expect(actionsFrom(null)).toEqual([]);
  });
});

describe("installer", () => {
  it("adds its hook once, keeping everything else, and takes it out again", () => {
    const config = {
      model: "x",
      hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "lint" }] }] },
    };
    const once = withHook(config, "claude", "/t/record.mjs");
    const twice = withHook(once, "claude", "/t/record.mjs");
    expect(twice).toEqual(once);
    expect(once.model).toBe("x");
    expect(once.hooks.PostToolUse).toHaveLength(2);
    expect(once.hooks.PostToolUse[1].hooks[0].command).toBe(hookCommand("claude", "/t/record.mjs"));
    expect(hookCommand("codex", "/t/record.mjs")).toContain(TAG);
    expect(withoutHook(once)).toEqual(config);
    expect(withoutHook(withHook({}, "codex", "/t/r.mjs"))).toEqual({});
  });

  it("sets up the agents it finds, backs files up, and can remove and dry-run", () => {
    const home = scratch();
    mkdirSync(join(home, ".claude"));
    writeFileSync(join(home, ".claude", "settings.json"), '{ "theme": "dark" }');
    expect(install({ home, record: "/t/record.mjs" })).toEqual([
      expect.stringContaining("Claude Code: added the hook"),
    ]);
    const settings = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8"));
    expect(settings.theme).toBe("dark");
    expect(settings.hooks.PostToolUse[0].matcher).toContain("Edit");
    expect(readFileSync(join(home, ".claude", "settings.json.foldertree-backup"), "utf8")).toBe(
      '{ "theme": "dark" }',
    );
    expect(install({ home, record: "/t/record.mjs" })[0]).toContain("nothing to change");

    // Codex, asked for by name, gets its folder made and the trust note.
    const lines = install({ home, agents: ["codex"], record: "/t/record.mjs" });
    expect(lines[0]).toContain("Codex: added the hook");
    expect(lines[1]).toContain("trust");
    const codex = JSON.parse(readFileSync(join(home, ".codex", "hooks.json"), "utf8"));
    expect(codex.hooks.PostToolUse[0]).toMatchObject({ matcher: "apply_patch|Bash" });

    expect(install({ home, remove: true, dryRun: true })[0]).toContain("would have removed");
    install({ home, remove: true });
    expect(JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8"))).toEqual({
      theme: "dark",
    });
  });

  it("leaves a settings file it can't read alone, and says when it finds no agent", () => {
    const home = scratch();
    expect(install({ home })[0]).toContain("No Claude Code or Codex");
    mkdirSync(join(home, ".claude"));
    writeFileSync(join(home, ".claude", "settings.json"), "{ not json");
    expect(install({ home })[0]).toContain("isn't valid JSON");
    expect(readFileSync(join(home, ".claude", "settings.json"), "utf8")).toBe("{ not json");
  });
});

describe("hook command", () => {
  it("marks at the project's top, named by FOLDERTREE_PANE or the agent", () => {
    const root = scratch();
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "src", "deep"), { recursive: true });
    const cwd = join(root, "src");
    const hook = { cwd, tool_name: "Edit", tool_input: { file_path: "deep/x.js" } };
    const [first] = record(hook, "claude", {});
    expect(decodeMarker(first)).toMatchObject({ pane: "Claude Code", path: "src/deep/x.js" });
    const [second] = record(hook, "codex", { FOLDERTREE_PANE: "api" });
    expect(decodeMarker(second)).toMatchObject({ pane: "api" });
    expect(readdirSync(join(root, ".foldertree")).length).toBe(3);
    expect(existsSync(join(cwd, ".foldertree"))).toBe(false);
  });

  it("prints nothing and exits 0, whatever it is given", () => {
    const root = scratch();
    for (const input of [
      "not json",
      "",
      JSON.stringify({ cwd: root, tool_name: "Read", tool_input: { file_path: "a" } }),
    ]) {
      const run = spawnSync(process.execPath, [join(HOOKS, "record.mjs"), "claude", TAG], {
        input,
        encoding: "utf8",
      });
      expect(run.status).toBe(0);
      expect(run.stdout).toBe("");
    }
    expect(readdirSync(join(root, ".foldertree")).filter((n) => n.startsWith("ft1."))).toHaveLength(
      1,
    );
  });

  it("watches files but never .git, node_modules or its own markers", () => {
    expect(watched("src/a.js")).toBe(true);
    expect(watched(".git/index")).toBe(false);
    expect(watched("web\\node_modules\\x.js")).toBe(false);
    expect(watched(".foldertree/ft1.x")).toBe(false);
  });
});
