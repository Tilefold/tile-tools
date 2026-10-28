// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — issue tracker tests
 *
 * The issue forms parse as GitHub issue forms, only apply labels that
 * labels.json defines, name every example tile, and keep private details and
 * blank issues out. The label sync script plans and applies label changes
 * correctly and never deletes a label.
 *
 * Modified 2026-10-26 (Quiz example): only folders with a tile.json count
 *   as example tiles.
 *
 * Last updated by: Tilefold
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  applyPlan,
  listLabels,
  planLabelChanges,
  readWantedLabels,
  validateLabels,
} from "../scripts/sync-labels.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FORMS_DIR = join(ROOT, ".github", "ISSUE_TEMPLATE");
const FORM_FILES = readdirSync(FORMS_DIR).filter((f) => f.endsWith(".yml") && f !== "config.yml");
const forms = FORM_FILES.map((file) => ({
  file,
  text: readFileSync(join(FORMS_DIR, file), "utf8"),
  form: parse(readFileSync(join(FORMS_DIR, file), "utf8")),
}));
const wanted = readWantedLabels();
const labelNames = new Set(wanted.map((l) => l.name));
// An example is a folder with a tile.json, as in the examples tests.
const exampleFolders = readdirSync(join(ROOT, "examples")).filter(
  (name) =>
    statSync(join(ROOT, "examples", name)).isDirectory() &&
    existsSync(join(ROOT, "examples", name, "tile.json")),
);

describe("labels.json", () => {
  it("is valid and has the areas, types and statuses the forms use", () => {
    expect(() => validateLabels(wanted)).not.toThrow();
    for (const name of [
      "area: tilefold app",
      "area: tile-tools",
      "type: bug",
      "type: idea",
      "status: triage",
    ]) {
      expect(labelNames.has(name)).toBe(true);
    }
  });

  it("refuses duplicates (ignoring case), bad colours and long descriptions", () => {
    const ok = { name: "a", color: "aabbcc", description: "" };
    expect(() => validateLabels([])).toThrow(/non-empty/);
    expect(() => validateLabels([ok, { ...ok, name: "A" }])).toThrow(/twice/);
    expect(() => validateLabels([{ ...ok, color: "#aabbcc" }])).toThrow(/hex/);
    expect(() => validateLabels([{ ...ok, color: "AABBCC" }])).toThrow(/hex/);
    expect(() => validateLabels([{ ...ok, description: "x".repeat(101) }])).toThrow(/100/);
    expect(() => validateLabels([{ ...ok, name: " " }])).toThrow(/name/);
  });
});

describe("issue chooser", () => {
  const config = parse(readFileSync(join(FORMS_DIR, "config.yml"), "utf8"));

  it("turns off blank issues and links to the docs and private security reports", () => {
    expect(config.blank_issues_enabled).toBe(false);
    const urls = config.contact_links.map((link) => link.url);
    expect(urls).toContain("https://github.com/Tilefold/tile-tools/tree/main/docs");
    expect(urls).toContain("https://github.com/Tilefold/tile-tools/security/advisories/new");
    for (const link of config.contact_links) {
      expect(link.name).toBeTruthy();
      expect(link.about).toBeTruthy();
    }
  });

  it("offers a bug and an idea form for both the app and Tile Tools", () => {
    expect(FORM_FILES.sort()).toEqual([
      "1-app-bug.yml",
      "2-app-idea.yml",
      "3-tile-tools-bug.yml",
      "4-tile-tools-idea.yml",
    ]);
  });
});

describe.each(forms)("issue form $file", ({ text, form }) => {
  it("has the fields GitHub requires and a copyright header", () => {
    expect(
      text.startsWith(
        "# Copyright (c) 2026 Tilefold\n# Author: Tilefold\n# Released under the MIT License.",
      ),
    ).toBe(true);
    expect(typeof form.name).toBe("string");
    expect(typeof form.description).toBe("string");
    expect(Array.isArray(form.body)).toBe(true);
    expect(form.body.some((item) => item.type !== "markdown")).toBe(true);
  });

  it("applies one area, one type and the triage status, all defined in labels.json", () => {
    for (const label of form.labels) expect(labelNames.has(label)).toBe(true);
    expect(form.labels.filter((l) => l.startsWith("area: "))).toHaveLength(1);
    expect(form.labels.filter((l) => l.startsWith("type: "))).toHaveLength(1);
    expect(form.labels).toContain("status: triage");
  });

  it("gives every field a unique id, a label and a required flag", () => {
    const fields = form.body.filter((item) => item.type !== "markdown");
    const ids = fields.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of fields) {
      expect(item.id).toMatch(/^[a-z][a-z-]*$/);
      expect(item.attributes.label).toBeTruthy();
      if (item.type !== "checkboxes") expect(typeof item.validations?.required).toBe("boolean");
      if (item.type === "dropdown") expect(item.attributes.options.length).toBeGreaterThan(1);
    }
  });

  it("asks for a search of existing issues and welcomes any language", () => {
    const checks = form.body.find((item) => item.type === "checkboxes");
    expect(checks.attributes.options[0].label).toMatch(/searched the existing issues/);
    expect(checks.attributes.options[0].required).toBe(true);
    expect(text).toMatch(/Write in whichever language you are most comfortable with/);
  });

  it("names no private repository, organisation or person", () => {
    expect(text).not.toMatch(/kdtech|@gmail|bitbucket/i);
  });
});

describe("bug forms", () => {
  it("ask the reporter to remove private details", () => {
    for (const { file, form } of forms.filter((f) => f.file.includes("bug"))) {
      const checks = form.body.find((item) => item.type === "checkboxes");
      expect(checks.attributes.options.map((o) => o.label).join(" "), file).toMatch(
        /removed anything private/,
      );
    }
  });

  it("list every example tile, and only those, under 'Which part?'", () => {
    const { form } = forms.find((f) => f.file === "3-tile-tools-bug.yml");
    const options = form.body.find((item) => item.id === "part").attributes.options;
    const listed = options.filter((o) => o.startsWith("Example: ")).map((o) => o.slice(9));
    expect(listed.sort()).toEqual([...exampleFolders].sort());
  });
});

describe("planLabelChanges", () => {
  const a = { name: "type: bug", color: "d73a4a", description: "Broken" };
  const b = { name: "type: idea", color: "a2eeef", description: "New" };

  it("creates what is missing and leaves what matches", () => {
    const plan = planLabelChanges([a, b], [{ ...a }]);
    expect(plan.create).toEqual([b]);
    expect(plan.update).toEqual([]);
    expect(plan.unchanged).toEqual(["type: bug"]);
    expect(plan.unknown).toEqual([]);
  });

  it("corrects colour, description and the spelling of the name", () => {
    expect(planLabelChanges([a], [{ ...a, color: "000000" }]).update).toEqual([
      { from: a.name, label: a },
    ]);
    expect(planLabelChanges([a], [{ ...a, description: null }]).update).toHaveLength(1);
    expect(planLabelChanges([a], [{ ...a, name: "Type: Bug" }]).update).toEqual([
      { from: "Type: Bug", label: a },
    ]);
  });

  it("treats GitHub's upper-case colours as the same colour", () => {
    expect(planLabelChanges([a], [{ ...a, color: "D73A4A" }]).unchanged).toEqual([a.name]);
  });

  it("reports labels it doesn't know about without deleting them", () => {
    const plan = planLabelChanges([a], [a, { name: "good first issue", color: "7057ff" }]);
    expect(plan.unknown).toEqual(["good first issue"]);
  });
});

/** A fake fetch that records requests and answers from a list of responses. */
function fakeFetch(responses = []) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      body: init.body ? JSON.parse(init.body) : undefined,
      headers: init.headers,
    });
    const next = responses.shift() ?? { status: 200, body: {} };
    return {
      ok: next.status < 400,
      status: next.status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    };
  };
  return { impl, calls };
}

describe("listLabels", () => {
  it("pages through 100 labels at a time with the token", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ name: `l${i}`, color: "000000" }));
    const { impl, calls } = fakeFetch([
      { status: 200, body: page1 },
      { status: 200, body: [{ name: "last", color: "000000" }] },
    ]);
    const labels = await listLabels("t0k", "Tilefold/tile-tools", impl);
    expect(labels).toHaveLength(101);
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.github.com/repos/Tilefold/tile-tools/labels?per_page=100&page=1",
      "https://api.github.com/repos/Tilefold/tile-tools/labels?per_page=100&page=2",
    ]);
    expect(calls[0].headers.Authorization).toBe("Bearer t0k");
  });

  it("names the request and status when GitHub refuses", async () => {
    const { impl } = fakeFetch([{ status: 403, body: { message: "nope" } }]);
    await expect(listLabels("t", "o/r", impl)).rejects.toThrow(/GET .*labels.*403/);
  });
});

describe("applyPlan", () => {
  const plan = {
    create: [{ name: "type: bug", color: "d73a4a", description: "Broken" }],
    update: [
      { from: "Old Name", label: { name: "type: idea", color: "a2eeef", description: "New" } },
    ],
    unchanged: ["status: triage"],
    unknown: ["wontfix"],
  };

  it("creates and patches labels, never deletes, and logs one JSON line each", async () => {
    const { impl, calls } = fakeFetch();
    const lines = [];
    await applyPlan(plan, {
      token: "t",
      repo: "o/r",
      log: (l) => lines.push(JSON.parse(l)),
      fetchImpl: impl,
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://api.github.com/repos/o/r/labels",
      "PATCH https://api.github.com/repos/o/r/labels/Old%20Name",
    ]);
    expect(calls[1].body).toEqual({ new_name: "type: idea", color: "a2eeef", description: "New" });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(lines.map((l) => l.event)).toEqual([
      "label.create",
      "label.update",
      "label.unknown",
      "label.sync.done",
    ]);
    expect(lines.at(-1)).toMatchObject({
      created: 1,
      updated: 1,
      unchanged: 1,
      unknown: 1,
      dryRun: false,
    });
  });

  it("changes nothing on a dry run but still logs the plan", async () => {
    const { impl, calls } = fakeFetch();
    const lines = [];
    await applyPlan(plan, {
      token: "t",
      repo: "o/r",
      dryRun: true,
      log: (l) => lines.push(l),
      fetchImpl: impl,
    });
    expect(calls).toEqual([]);
    expect(lines).toHaveLength(4);
  });
});
