// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * GitHub Inbox example — tests
 *
 * The GitHub logic on its own, then the built tile against the fake
 * Tilefold: without a token it asks the user to add one and sends nothing;
 * with one, every request names the "github" credential and never carries
 * an Authorization header of its own; the count, a full page, a refused
 * token, a missing token and Tilefold's other errors each get the right
 * notice; the activity record holds the count only.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";
import {
  HEADERS,
  PAGE_SIZE,
  errorKey,
  notificationsUrl,
  statusKey,
  summarize,
  summaryKey,
} from "../examples/github-inbox/src/notifications.js";

const DIR = fileURLToPath(new URL("../examples/github-inbox/", import.meta.url));

/** An error as Tilefold throws it: told apart by `name`. */
const named = (name) => Object.assign(new Error(name), { name });

/** A page of `n` notifications, newest first. */
const notifications = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: String(i), subject: { title: `Issue ${i + 1}` } }));

/** A GitHub answer with this body. */
const answer = (body, status = 200) => ({ status, body: JSON.stringify(body) });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("GitHub logic", () => {
  it("builds the notifications address, optionally for my threads only", () => {
    expect(notificationsUrl(false)).toBe("https://api.github.com/notifications?per_page=50");
    expect(notificationsUrl(true)).toBe(
      "https://api.github.com/notifications?per_page=50&participating=true",
    );
  });

  it("never sets an Authorization header itself", () => {
    expect(Object.keys(HEADERS).map((h) => h.toLowerCase())).not.toContain("authorization");
  });

  it("summarizes a page: count, more pages, the newest title cut to 80 characters", () => {
    expect(summarize([])).toEqual({ count: 0, more: false, newest: "" });
    expect(summarize(notifications(3))).toEqual({ count: 3, more: false, newest: "Issue 1" });
    expect(summarize(notifications(PAGE_SIZE)).more).toBe(true);
    const long = summarize([{ subject: { title: ` ${"t".repeat(200)} ` } }]);
    expect(long.newest).toHaveLength(80);
    expect(summarize([{ subject: null }]).newest).toBe("");
    expect(summarize({ message: "Bad credentials" })).toBeNull();
  });

  it("picks a message for the summary, the status and Tilefold's errors", () => {
    expect(summaryKey({ count: 0, more: false })).toBe("inbox-none");
    expect(summaryKey({ count: 2, more: false })).toBe("inbox-some");
    expect(summaryKey({ count: 50, more: true })).toBe("inbox-many");
    expect([401, 403, 404, 500].map(statusKey)).toEqual([
      "error-token",
      "error-token",
      "error-failed",
      "error-failed",
    ]);
    expect(errorKey(named("CredentialMissingError"))).toBe("error-no-token");
    expect(errorKey(named("CredentialStoreError"))).toBe("error-keychain");
    expect(errorKey(named("PermissionDeniedError"))).toBe("error-denied");
    expect(errorKey(named("NetworkPolicyError"))).toBe("error-denied");
    expect(errorKey(named("RateLimitError"))).toBe("error-rate");
    expect(errorKey(named("TimeoutError"))).toBe("error-failed");
  });
});

describe("the tile", () => {
  it("declares the credential for api.github.com only, with no secret in tile.json", () => {
    const manifest = JSON.parse(readFileSync(`${DIR}tile.json`, "utf8"));
    expect(manifest.auth.github).toMatchObject({
      type: "apiKey",
      header: "Authorization",
      scheme: "Bearer",
      hosts: ["api.github.com"],
    });
    expect(Object.keys(manifest.permissions[0])).toEqual(["net:api.github.com"]);
  });

  it("asks for a token, and sends nothing, until the user has entered one", async () => {
    const host = await startTile(DIR, { net: () => answer([]) });
    await host.command("check");
    await host.advance(0);
    expect(host.requests).toEqual([]);
    expect(host.toasts).toEqual([
      "Add a GitHub token under Keys on GitHub Inbox's card in Settings → Tiles.",
    ]);
  });

  it("names the credential on the request and counts the unread notifications", async () => {
    const host = await startTile(DIR, {
      credentials: ["github"],
      net: () => answer(notifications(3)),
    });
    await host.command("check");
    await host.advance(0);
    expect(host.requests).toEqual([
      {
        url: "https://api.github.com/notifications?per_page=50",
        init: { headers: { ...HEADERS }, auth: "github" },
      },
    ]);
    expect(host.toasts).toEqual(["3 unread GitHub notifications. Newest: Issue 1"]);
    // The record holds the count, never what the notifications are about.
    expect(host.audits).toEqual([{ action: "inbox-checked", details: { count: 3, more: false } }]);
  });

  it("follows the setting for threads I take part in", async () => {
    const host = await startTile(DIR, {
      credentials: ["github"],
      settings: { participating: true },
      net: () => answer([]),
    });
    await host.command("check");
    await host.advance(0);
    expect(host.requests[0].url).toContain("participating=true");
    expect(host.toasts).toEqual(["No unread GitHub notifications."]);
  });

  it("says 'or more' when a full page came back", async () => {
    const host = await startTile(DIR, {
      credentials: ["github"],
      net: () => answer(notifications(PAGE_SIZE)),
    });
    await host.command("check");
    await host.advance(0);
    expect(host.toasts).toEqual(["50 or more unread GitHub notifications. Newest: Issue 1"]);
  });

  it("tells a refused token from a missing one and from other failures", async () => {
    const cases = [
      [() => answer({ message: "Bad credentials" }, 401), /^GitHub refused the token/],
      [() => answer({ message: "Not Found" }, 404), /^Couldn't read your GitHub notifications/],
      [() => ({ status: 200, body: "not json" }), /^Couldn't read your GitHub notifications/],
      [
        () => {
          throw named("CredentialStoreError");
        },
        /^Tilefold couldn't read the token/,
      ],
      [
        () => {
          throw named("NetworkPolicyError");
        },
        /^GitHub Inbox may not reach api\.github\.com/,
      ],
      [
        () => {
          throw named("RateLimitError");
        },
        /^Too many checks/,
      ],
    ];
    for (const [net, toast] of cases) {
      const host = await startTile(DIR, { credentials: ["github"], net });
      await host.command("check");
      await host.advance(0);
      expect(host.toasts).toHaveLength(1);
      expect(host.toasts[0]).toMatch(toast);
      expect(host.audits).toEqual([]);
    }
  });

  it("asks for the token again when Tilefold says it is missing", async () => {
    // tf.auth.has said yes, but the token was removed before the request.
    const host = await startTile(DIR, { credentials: ["github"], net: () => answer([]) });
    host.credentials.delete("github");
    const realHas = host.credentials.has.bind(host.credentials);
    host.credentials.has = (name) => (host.requests.length === 0 ? true : realHas(name));
    await host.command("check");
    await host.advance(0);
    expect(host.toasts).toEqual([
      "Add a GitHub token under Keys on GitHub Inbox's card in Settings → Tiles.",
    ]);
  });

  it("says so on a Tilefold without tile networking", async () => {
    const host = await startTile(DIR, { credentials: ["github"] });
    await host.command("check");
    await host.advance(0);
    expect(host.toasts[0]).toMatch(/^This Tilefold can't let tiles use the internet yet/);
  });

  it("never runs two checks together", async () => {
    let reply;
    const host = await startTile(DIR, {
      credentials: ["github"],
      net: () => new Promise((resolve) => (reply = resolve)),
    });
    await host.command("check");
    await host.command("check");
    expect(host.requests).toHaveLength(1);
    reply(answer([]));
    await host.advance(0);
    expect(host.toasts).toEqual(["No unread GitHub notifications."]);
  });

  it("speaks the user's language", async () => {
    const host = await startTile(DIR, {
      locale: "de",
      credentials: ["github"],
      net: () => answer(notifications(2)),
    });
    await host.command("check");
    await host.advance(0);
    expect(host.toasts).toEqual(["2 ungelesene GitHub-Benachrichtigungen. Neueste: Issue 1"]);
  });
});
