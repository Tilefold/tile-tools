/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board — logic tests
 *
 * The pure parts: project paths and branches as the user types or pastes
 * them; the pipelines request (encoded path, newest four, the branch);
 * reading the answer; what each failure means (sign-in, not found,
 * Tilefold's refusal, rate limit); status groups, which pipelines just
 * finished and how long ago; and the pictures (escaped text, a row per
 * pipeline, the empty list, messages that wrap instead of cutting).
 */
import { describe, expect, it } from "vitest";
import {
  ROWS,
  cleanProject,
  cleanRef,
  failureOf,
  parsePipelines,
  pipelinesUrl,
} from "../examples/pipeline-board/src/gitlab/api.js";
import {
  GROUPS,
  ageOf,
  finishedSince,
  groupOf,
  isActive,
} from "../examples/pipeline-board/src/gitlab/status.js";
import {
  BOARD_W,
  HEADER_H,
  MESSAGE_H,
  ROW_H,
  renderList,
  renderMessage,
} from "../examples/pipeline-board/src/render/board.js";
import { MAX_SIDE } from "../examples/pipeline-board/src/render/svg.js";

/** A pipelines answer like GitLab's. */
export const PIPELINES = [
  { id: 1003, iid: 812, status: "running", ref: "main", updated_at: "2026-10-13T12:29:00Z" },
  {
    id: 1002,
    iid: 811,
    status: "failed",
    ref: "feature/login",
    updated_at: "2026-10-13T12:27:00Z",
  },
  { id: 1001, iid: 810, status: "success", ref: "main", updated_at: "2026-10-13T10:30:00Z" },
  { id: 1000, iid: 809, status: "manual", ref: "release", created_at: "2026-10-12T09:00:00Z" },
];

const named = (name) => Object.assign(new Error(name), { name });
const svgOf = (url) => decodeURIComponent(url.slice(url.indexOf(",") + 1));
const textOf = (url) =>
  [...svgOf(url).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(" ");

describe("what the user types", () => {
  it("accepts project paths, with subgroups, or a pasted project address", () => {
    expect(cleanProject(" gitlab-org/gitlab ")).toBe("gitlab-org/gitlab");
    expect(cleanProject("a/b/c.d_e-f")).toBe("a/b/c.d_e-f");
    expect(cleanProject("https://gitlab.com/gitlab-org/gitlab")).toBe("gitlab-org/gitlab");
    expect(cleanProject("https://gitlab.com/group/app/-/pipelines")).toBe("group/app");
    expect(cleanProject("group/app.git")).toBe("group/app");
  });

  it("refuses anything that isn't a project path", () => {
    for (const bad of ["", "justone", "a b/c", "../x", "a/b?x=1", 42, null]) {
      expect(cleanProject(bad), String(bad)).toBe("");
    }
  });

  it("keeps a valid branch name, or none", () => {
    expect(cleanRef(" release/17.5 ")).toBe("release/17.5");
    expect(cleanRef("bad name")).toBe("");
    expect(cleanRef("a:b")).toBe("");
    expect(cleanRef(undefined)).toBe("");
  });
});

describe("the request and its answer", () => {
  it("asks for the newest pipelines of an encoded project, on one branch if set", () => {
    const url = new URL(pipelinesUrl("group/sub/app", "main"));
    expect(url.origin).toBe("https://gitlab.com");
    expect(url.pathname).toBe("/api/v4/projects/group%2Fsub%2Fapp/pipelines");
    expect(url.searchParams.get("per_page")).toBe(String(ROWS));
    expect(url.searchParams.get("sort")).toBe("desc");
    expect(url.searchParams.get("ref")).toBe("main");
    expect(new URL(pipelinesUrl("g/a")).searchParams.has("ref")).toBe(false);
  });

  it("reads what the board shows and skips anything else", () => {
    const rows = parsePipelines([...PIPELINES, null, { id: "x" }, { id: 5 }]);
    expect(rows).toHaveLength(ROWS);
    expect(rows[0]).toEqual({
      id: 1003,
      iid: 812,
      status: "running",
      ref: "main",
      updatedAt: "2026-10-13T12:29:00Z",
    });
    expect(rows[3].updatedAt).toBe("2026-10-12T09:00:00Z");
    expect(parsePipelines([{ id: 5 }])[0]).toMatchObject({ iid: 5, status: "unknown", ref: "" });
    expect(parsePipelines({ message: "404" })).toEqual([]);
  });

  it("tells what each failure means", () => {
    expect(failureOf(named("CredentialMissingError"))).toBe("signed-out");
    expect(failureOf(named("PermissionDeniedError"))).toBe("denied");
    expect(failureOf(named("NetworkPolicyError"))).toBe("denied");
    expect(failureOf(named("RateLimitError"))).toBe("rate");
    expect(failureOf(named("TimeoutError"))).toBe("error");
    expect(failureOf(null, 401)).toBe("signed-out");
    expect(failureOf(null, 403)).toBe("not-found");
    expect(failureOf(null, 404)).toBe("not-found");
    expect(failureOf(null, 429)).toBe("rate");
    expect(failureOf(null, 500)).toBe("error");
  });
});

describe("statuses", () => {
  it("groups GitLab's statuses, unknown ones as waiting", () => {
    expect(["created", "preparing", "scheduled", "waiting_for_resource"].map(groupOf)).toEqual(
      Array(4).fill("pending"),
    );
    expect(["skipped", "canceling", "canceled"].map(groupOf)).toEqual(Array(3).fill("canceled"));
    expect(groupOf("something_new")).toBe("pending");
    expect(isActive("running")).toBe(true);
    expect(isActive("success")).toBe(false);
    for (const g of Object.values(GROUPS)) expect(g.text).toMatch(/^status-/);
  });

  it("finds the pipelines that finished since the last check, never new ones", () => {
    const before = new Map([
      [1, "running"],
      [2, "pending"],
      [3, "success"],
      [4, "running"],
    ]);
    const now = [
      { id: 1, iid: 11, ref: "main", status: "success" },
      { id: 2, iid: 12, ref: "dev", status: "failed" },
      { id: 3, iid: 13, ref: "main", status: "success" },
      { id: 4, iid: 14, ref: "x", status: "running" },
      { id: 5, iid: 15, ref: "new", status: "failed" },
    ];
    expect(finishedSince(before, now)).toEqual([
      { iid: 11, ref: "main", group: "success" },
      { iid: 12, ref: "dev", group: "failed" },
    ]);
  });

  it("says how long ago", () => {
    const now = Date.parse("2026-10-13T12:30:00Z");
    expect(ageOf("2026-10-13T12:29:40Z", now)).toEqual({ key: "age-now", n: 0 });
    expect(ageOf("2026-10-13T12:27:00Z", now)).toEqual({ key: "age-minutes", n: 3 });
    expect(ageOf("2026-10-13T10:00:00Z", now)).toEqual({ key: "age-hours", n: 2 });
    expect(ageOf("2026-10-10T12:00:00Z", now)).toEqual({ key: "age-days", n: 3 });
    expect(ageOf("never", now)).toEqual({ key: "age-unknown", n: 0 });
    expect(ageOf("2026-10-14T00:00:00Z", now)).toEqual({ key: "age-now", n: 0 });
  });
});

describe("pictures", () => {
  const row = {
    ref: "main <&>",
    number: "#812",
    status: "Running",
    age: "just now",
    color: "#3b82f6",
    running: true,
  };

  it("draws one row per pipeline within Tilefold's limits, with text escaped", () => {
    const board = renderList({
      project: "g/a",
      rows: [row, { ...row, running: false }],
      empty: "",
    });
    expect(board.w).toBe(BOARD_W);
    expect(board.w).toBeLessThanOrEqual(MAX_SIDE);
    expect(board.h).toBe(HEADER_H + 2 * ROW_H + 6);
    const svg = svgOf(board.image);
    expect(svg).toContain("main &lt;&amp;&gt;");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).not.toContain("<script");
  });

  it("says so when there are no pipelines", () => {
    const board = renderList({ project: "g/a", rows: [], empty: "No pipelines yet." });
    expect(board.h).toBe(HEADER_H + ROW_H + 6);
    expect(textOf(board.image)).toContain("No pipelines yet.");
  });

  it("wraps a message instead of cutting it", () => {
    const msg = renderMessage({
      title: "Pipeline Board may not reach GitLab",
      hint: "Allow it in Settings → Tiles, on Pipeline Board's card.",
      tone: "warn",
    });
    expect(msg.h).toBe(MESSAGE_H);
    const text = textOf(msg.image);
    expect(text).toContain("GitLab");
    expect(text).toContain("card.");
    expect(text).not.toContain("…");
  });
});
