#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Label sync — makes the repository's issue labels match .github/labels.json
 *
 * The issue forms in .github/ISSUE_TEMPLATE apply these labels, and GitHub
 * silently skips a label that doesn't exist, so the labels must be there
 * before the forms are useful. The labels workflow runs this script with the
 * workflow's token whenever labels.json changes on main.
 *
 * It creates missing labels and corrects the colour or description of
 * existing ones. It never deletes a label: labels it doesn't know about are
 * only reported, because removing one would strip it from every issue that
 * carries it.
 *
 * Every change is printed as one JSON line ({ event, name, ... }) so the
 * workflow log doubles as a record of what was changed and when.
 *
 * Usage:
 *   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/sync-labels.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API = "https://api.github.com";

/** Where the wanted labels live, relative to the repository root. */
export const LABELS_FILE = fileURLToPath(new URL("../.github/labels.json", import.meta.url));

/**
 * Reads and checks the wanted labels.
 * @param {string} [file] path to a labels.json
 * @returns {{ name: string, color: string, description: string }[]}
 */
export function readWantedLabels(file = LABELS_FILE) {
  const { labels } = JSON.parse(readFileSync(file, "utf8"));
  validateLabels(labels);
  return labels;
}

/**
 * Throws if the label list is one GitHub would refuse or that would be
 * ambiguous: names must be unique ignoring case (as GitHub compares them),
 * colours six hex digits without "#", descriptions at most 100 characters.
 * @param {unknown} labels
 */
export function validateLabels(labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error('labels.json: expected a non-empty "labels" array');
  }
  const seen = new Set();
  for (const label of labels) {
    const { name, color, description } = label ?? {};
    if (typeof name !== "string" || name.trim() === "" || name.length > 50) {
      throw new Error(`labels.json: bad label name ${JSON.stringify(name)}`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`labels.json: "${name}" is listed twice`);
    seen.add(key);
    if (typeof color !== "string" || !/^[0-9a-f]{6}$/.test(color)) {
      throw new Error(`labels.json: "${name}" needs a six-digit lower-case hex colour`);
    }
    if (typeof description !== "string" || description.length > 100) {
      throw new Error(`labels.json: "${name}" needs a description of 100 characters or fewer`);
    }
  }
}

/**
 * Works out what has to change. Pure, so it can be tested without GitHub.
 * Names are matched ignoring case, as GitHub does; a label whose name differs
 * only in case is renamed to the wanted spelling.
 *
 * @param {{ name: string, color: string, description: string }[]} wanted
 * @param {{ name: string, color: string, description?: string | null }[]} existing
 * @returns {{
 *   create: typeof wanted,
 *   update: { from: string, label: typeof wanted[number] }[],
 *   unchanged: string[],
 *   unknown: string[],
 * }}
 */
export function planLabelChanges(wanted, existing) {
  const byKey = new Map(existing.map((label) => [label.name.toLowerCase(), label]));
  const plan = { create: [], update: [], unchanged: [], unknown: [] };
  for (const label of wanted) {
    const current = byKey.get(label.name.toLowerCase());
    if (!current) {
      plan.create.push(label);
    } else if (
      current.name !== label.name ||
      current.color.toLowerCase() !== label.color ||
      (current.description ?? "") !== label.description
    ) {
      plan.update.push({ from: current.name, label });
    } else {
      plan.unchanged.push(label.name);
    }
    byKey.delete(label.name.toLowerCase());
  }
  // Whatever is left exists on GitHub but not in labels.json: report only.
  plan.unknown = [...byKey.values()].map((label) => label.name);
  return plan;
}

/**
 * Calls the GitHub REST API.
 * @param {string} token
 * @param {string} method
 * @param {string} path
 * @param {unknown} [body]
 * @param {typeof fetch} [fetchImpl]
 */
async function github(token, method, path, body, fetchImpl = fetch) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path}: ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

/**
 * Lists every label in the repository, a page of 100 at a time.
 * @param {string} token
 * @param {string} repo owner/name
 * @param {typeof fetch} [fetchImpl]
 */
export async function listLabels(token, repo, fetchImpl = fetch) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await github(
      token,
      "GET",
      `/repos/${repo}/labels?per_page=100&page=${page}`,
      undefined,
      fetchImpl,
    );
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

/**
 * Applies a plan to GitHub (or only prints it with dryRun) and logs one JSON
 * line per label.
 * @param {ReturnType<typeof planLabelChanges>} plan
 * @param {{ token: string, repo: string, dryRun?: boolean, log?: (line: string) => void, fetchImpl?: typeof fetch }} options
 */
export async function applyPlan(
  plan,
  { token, repo, dryRun = false, log = console.log, fetchImpl = fetch },
) {
  const record = (event, fields) => log(JSON.stringify({ event, repo, dryRun, ...fields }));
  for (const label of plan.create) {
    if (!dryRun) await github(token, "POST", `/repos/${repo}/labels`, label, fetchImpl);
    record("label.create", { name: label.name });
  }
  for (const { from, label } of plan.update) {
    if (!dryRun) {
      await github(
        token,
        "PATCH",
        `/repos/${repo}/labels/${encodeURIComponent(from)}`,
        { new_name: label.name, color: label.color, description: label.description },
        fetchImpl,
      );
    }
    record("label.update", { name: label.name, from });
  }
  for (const name of plan.unknown) record("label.unknown", { name });
  record("label.sync.done", {
    created: plan.create.length,
    updated: plan.update.length,
    unchanged: plan.unchanged.length,
    unknown: plan.unknown.length,
  });
}

/** Command-line entry: reads the environment, plans and applies. */
async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.error("sync-labels: set GITHUB_TOKEN and GITHUB_REPOSITORY (owner/repo)");
    process.exit(2);
  }
  const dryRun = process.argv.includes("--dry-run");
  const plan = planLabelChanges(readWantedLabels(), await listLabels(token, repo));
  await applyPlan(plan, { token, repo, dryRun });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`sync-labels: ${error.message}`);
    process.exit(1);
  });
}
