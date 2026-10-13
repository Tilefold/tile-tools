/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board — tile tests
 *
 * The built tile against the fake Tilefold, the way a user meets it: what
 * it registers; an older Tilefold; no project; signed out, then noticing a
 * sign-in within seconds; every request naming the `gitlab` sign-in and
 * carrying no token of its own; the board's rows; checking often while a
 * pipeline runs and rarely otherwise, and never while hidden; a notice (and
 * an activity record without the project) when a pipeline finishes, but
 * not for pipelines it never saw running; a refused sign-in, an unknown
 * project, Tilefold's refusal and GitLab's rate limit; a new project; and
 * coming back after a restart.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";
import { PIPELINES } from "./pipeline-board-logic.test.mjs";

const DIR = fileURLToPath(new URL("../examples/pipeline-board/", import.meta.url));

const named = (name) => Object.assign(new Error(name), { name });

/** A fake GitLab answering with `list()` each time (or a status). */
function gitlab(list = () => PIPELINES, status = 200) {
  return () => ({ status, body: JSON.stringify(status === 200 ? list() : { message: "no" }) });
}

const label = (host) => host.item("board").label;
const textOf = (host) => {
  const url = host.item("board").image;
  const svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(" ");
};

/** Starts the tile signed in, with a project, unless told otherwise. */
const start = (opts = {}) =>
  startTile(DIR, {
    net: gitlab(),
    credentials: ["gitlab"],
    settings: { project: "group/app" },
    ...opts,
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:30:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("registration and setup", () => {
  it("registers its settings and two commands, and sends nothing on its own", async () => {
    const host = await start();
    expect(host.regs.filter((r) => r.kind === "setting").map((r) => r.key)).toEqual([
      "project",
      "ref",
      "corner",
      "notify",
    ]);
    expect(host.regs.filter((r) => r.kind === "command").map((r) => r.id)).toEqual([
      "toggle",
      "refresh",
    ]);
    expect(host.requests).toEqual([]);
  });

  it("says this Tilefold is too old without tile networking", async () => {
    const host = await startTile(DIR, { settings: { project: "group/app" } });
    await host.command("toggle");
    expect(label(host)).toBe("Can't reach GitLab");
  });

  it("asks which project before anything else", async () => {
    const host = await start({ settings: {} });
    await host.command("toggle");
    expect(label(host)).toBe("Which project?");
    expect(host.requests).toEqual([]);
  });

  it("explains signing in, and starts within seconds of the user signing in", async () => {
    const host = await start({ credentials: [] });
    await host.command("toggle");
    expect(label(host)).toBe("Not signed in to GitLab");
    expect(textOf(host)).toContain("Keys");
    expect(host.requests).toEqual([]);
    host.credentials.add("gitlab");
    await host.advance(5_000);
    expect(host.requests).toHaveLength(1);
    expect(label(host)).toBe("Pipelines of group/app: latest Running");
  });
});

describe("the board", () => {
  it("lists the pipelines through the sign-in, without a token of its own", async () => {
    const host = await start({ settings: { project: "group/app", ref: "main" } });
    await host.command("toggle");
    expect(host.requests).toHaveLength(1);
    const { url, init } = host.requests[0];
    expect(url).toBe(
      "https://gitlab.com/api/v4/projects/group%2Fapp/pipelines?per_page=4&order_by=id&sort=desc&ref=main",
    );
    expect(init.auth).toBe("gitlab");
    expect(JSON.stringify(init)).not.toMatch(/authorization|bearer|token/i);
    const text = textOf(host);
    for (const part of [
      "group/app",
      "#812",
      "Running",
      "1 min ago",
      "Failed",
      "3 min ago",
      "Passed",
      "2 h ago",
      "Manual",
      "1 d ago",
    ]) {
      expect(text).toContain(part);
    }
  });

  it("checks every 30 seconds while something runs, every 2 minutes otherwise, never while hidden", async () => {
    let list = PIPELINES;
    const host = await start({ net: gitlab(() => list) });
    await host.command("toggle");
    await host.advance(30_000);
    expect(host.requests).toHaveLength(2);
    list = PIPELINES.map((p) => ({ ...p, status: "success" }));
    await host.advance(30_000);
    expect(host.requests).toHaveLength(3);
    await host.advance(60_000);
    expect(host.requests).toHaveLength(3);
    await host.advance(60_000);
    expect(host.requests).toHaveLength(4);
    await host.command("toggle");
    await host.advance(60 * 60_000);
    expect(host.requests).toHaveLength(4);
  });

  it("refreshes from the command and a click", async () => {
    const host = await start();
    await host.command("toggle");
    await host.command("refresh");
    await host.emit("overlay.pointer", { item: "board", type: "click", x: 1, y: 1 });
    await host.advance(0);
    expect(host.requests).toHaveLength(3);
  });

  it("starts over for a new project", async () => {
    const host = await start();
    await host.command("toggle");
    await host.setSetting("project", "https://gitlab.com/other/thing");
    await host.advance(0);
    expect(host.requests.at(-1).url).toContain("/projects/other%2Fthing/");
  });

  it("comes back after a restart", async () => {
    const host = await start({ store: { visible: true } });
    await host.emit("app.ready");
    await host.advance(0);
    expect(label(host)).toBe("Pipelines of group/app: latest Running");
  });
});

describe("finished pipelines", () => {
  it("says when a pipeline it saw running has finished, and records only the result", async () => {
    let list = PIPELINES;
    const host = await start({ net: gitlab(() => list) });
    await host.command("toggle");
    list = [{ ...PIPELINES[0], status: "failed" }, ...PIPELINES.slice(1)];
    await host.advance(30_000);
    expect(host.toasts).toEqual(["Pipeline #812 on main failed."]);
    expect(host.audits).toContainEqual({ action: "finished", details: { result: "failed" } });
    expect(JSON.stringify(host.audits)).not.toContain("group/app");
  });

  it("keeps quiet when notices are off, and about pipelines it never saw running", async () => {
    let list = [PIPELINES[0]];
    const host = await start({
      net: gitlab(() => list),
      settings: { project: "group/app", notify: false },
    });
    await host.command("toggle");
    list = [
      { ...PIPELINES[0], status: "success" },
      { ...PIPELINES[1], id: 9999 },
    ];
    await host.advance(30_000);
    expect(host.toasts).toEqual([]);
    expect(host.audits.filter((a) => a.action === "finished")).toHaveLength(1);
  });
});

describe("when things go wrong", () => {
  it("asks to sign in again when GitLab refuses the token", async () => {
    const host = await start({ net: gitlab(undefined, 401) });
    await host.command("toggle");
    expect(label(host)).toBe("Not signed in to GitLab");
  });

  it("names a project GitLab doesn't show the user", async () => {
    const host = await start({ net: gitlab(undefined, 404) });
    await host.command("toggle");
    expect(label(host)).toBe("Project not found");
    expect(textOf(host)).toContain("group/app");
  });

  it("says where to allow it when Tilefold refuses the request", async () => {
    const host = await start({
      net: () => {
        throw named("PermissionDeniedError");
      },
    });
    await host.command("toggle");
    expect(label(host)).toBe("Pipeline Board may not reach GitLab");
  });

  it("slows down to one check in five minutes after GitLab's rate limit", async () => {
    const host = await start({ net: gitlab(undefined, 429) });
    await host.command("toggle");
    expect(label(host)).toBe("GitLab asked to slow down");
    await host.advance(4 * 60_000);
    expect(host.requests).toHaveLength(1);
    await host.advance(60_000);
    expect(host.requests).toHaveLength(2);
  });

  it("says GitLab didn't answer, and recovers", async () => {
    let fail = true;
    const ok = gitlab();
    const host = await start({ net: () => (fail ? { status: 502, body: "" } : ok()) });
    await host.command("toggle");
    expect(label(host)).toBe("GitLab didn't answer");
    fail = false;
    await host.advance(120_000);
    expect(label(host)).toBe("Pipelines of group/app: latest Running");
  });
});
