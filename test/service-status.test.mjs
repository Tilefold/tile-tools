// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Service Status example — tests
 *
 * The status page logic on its own, then the built tile against the fake
 * Tilefold: a check on request reads the page through tf.net.fetch (no
 * credential), reports each status and each kind of failure by its error
 * name, says so on a Tilefold without networking, never runs two checks at
 * once, and timed checks stay quiet unless the status changes.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";
import {
  STATUS_URL,
  errorKey,
  parseStatus,
  statusKey,
} from "../examples/service-status/src/status.js";

const DIR = fileURLToPath(new URL("../examples/service-status/", import.meta.url));

/** An error as Tilefold throws it: told apart by `name`. */
const named = (name) => Object.assign(new Error(name), { name });

/** A status page answer. */
const page = (indicator, description = "") => ({
  status: 200,
  body: JSON.stringify({ status: { indicator, description } }),
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("status page logic", () => {
  it("reads the indicator and a trimmed, shortened description", () => {
    expect(parseStatus({ status: { indicator: "minor", description: "  Slow pushes " } })).toEqual({
      indicator: "minor",
      description: "Slow pushes",
    });
    const long = parseStatus({ status: { indicator: "major", description: "x".repeat(500) } });
    expect(long.description).toHaveLength(120);
    expect(parseStatus({ status: { indicator: "none" } })).toEqual({
      indicator: "none",
      description: "",
    });
  });

  it("refuses answers that are not a status", () => {
    for (const bad of [null, "text", {}, { status: null }, { status: { indicator: "" } }]) {
      expect(parseStatus(bad)).toBeNull();
    }
  });

  it("names a message for every indicator, and a neutral one for unknown ones", () => {
    expect(["none", "minor", "major", "critical"].map(statusKey)).toEqual([
      "status-none",
      "status-minor",
      "status-major",
      "status-critical",
    ]);
    expect(statusKey("maintenance")).toBe("status-unknown");
    expect(statusKey("__proto__")).toBe("status-unknown");
  });

  it("maps Tilefold's errors by name", () => {
    expect(errorKey(named("PermissionDeniedError"))).toBe("error-denied");
    expect(errorKey(named("NetworkPolicyError"))).toBe("error-denied");
    expect(errorKey(named("RateLimitError"))).toBe("error-rate");
    for (const n of ["TimeoutError", "NetworkError", "TooLargeError", "Error"]) {
      expect(errorKey(named(n))).toBe("error-failed");
    }
    expect(errorKey(undefined)).toBe("error-failed");
  });
});

describe("the tile", () => {
  it("registers its interval setting with labelled choices and its command", async () => {
    const host = await startTile(DIR, { net: () => page("none") });
    const setting = host.regs.find((r) => r.kind === "setting");
    expect(setting).toMatchObject({ key: "every", default: "0" });
    expect(setting.choices.map((c) => c.value)).toEqual(["0", "15", "60"]);
    expect(setting.choices[2].label).toBe("Every hour");
    expect(host.regs.filter((r) => r.kind === "command").map((r) => r.id)).toEqual(["check-now"]);
  });

  it("checks on request through tf.net.fetch, without a credential, and records the status", async () => {
    const host = await startTile(DIR, { net: () => page("none", "All Systems Operational") });
    await host.command("check-now");
    await host.advance(0);
    expect(host.requests).toEqual([
      { url: STATUS_URL, init: { headers: { accept: "application/json" } } },
    ]);
    expect(host.toasts).toEqual(["GitHub: all systems operational."]);
    expect(host.store.get("last")).toBe("none");
    expect(host.audits).toEqual([
      { action: "status-changed", details: { from: null, to: "none" } },
    ]);
  });

  it("reports problems with the page's own description", async () => {
    const host = await startTile(DIR, { net: () => page("major", "Actions are delayed") });
    await host.command("check-now");
    await host.advance(0);
    expect(host.toasts).toEqual(["GitHub: major outage (Actions are delayed)."]);
  });

  it("tells each kind of failure apart", async () => {
    const cases = [
      [
        () => ({ status: 503, body: "down" }),
        "Couldn't reach GitHub's status page. Try again later.",
      ],
      [
        () => ({ status: 200, body: "<html>" }),
        "GitHub's status page sent an answer Service Status doesn't understand.",
      ],
      [
        () => {
          throw named("PermissionDeniedError");
        },
        "Service Status may not reach www.githubstatus.com. Allow it in Settings → Tiles.",
      ],
      [
        () => {
          throw named("RateLimitError");
        },
        "Too many checks. Try again in a minute.",
      ],
      [
        () => {
          throw named("TimeoutError");
        },
        "Couldn't reach GitHub's status page. Try again later.",
      ],
    ];
    for (const [net, toast] of cases) {
      const host = await startTile(DIR, { net });
      await host.command("check-now");
      await host.advance(0);
      expect(host.toasts).toEqual([toast]);
      expect(host.store.has("last")).toBe(false);
    }
  });

  it("says so on a Tilefold without tile networking", async () => {
    const host = await startTile(DIR);
    await host.command("check-now");
    await host.advance(0);
    expect(host.toasts).toEqual([
      "This Tilefold can't let tiles use the internet yet. Update Tilefold to use Service Status.",
    ]);
  });

  it("returns from the command at once and never runs two checks together", async () => {
    let answer;
    const host = await startTile(DIR, {
      net: () => new Promise((resolve) => (answer = resolve)),
    });
    await host.command("check-now");
    await host.command("check-now");
    expect(host.requests).toHaveLength(1);
    answer(page("none"));
    await host.advance(0);
    expect(host.toasts).toHaveLength(1);
  });

  it("checks by itself on the chosen interval and speaks only when the status changes", async () => {
    let indicator = "none";
    const host = await startTile(DIR, {
      settings: { every: "15" },
      net: () => page(indicator, "Webhooks are delayed"),
    });
    await host.emit("app.ready");
    await host.advance(0);
    // The first check only notes the status.
    expect(host.requests).toHaveLength(1);
    expect(host.toasts).toEqual([]);

    await host.advance(15 * 60_000);
    expect(host.requests).toHaveLength(2);
    expect(host.toasts).toEqual([]);

    indicator = "minor";
    await host.advance(15 * 60_000);
    expect(host.toasts).toEqual(["GitHub: minor problems (Webhooks are delayed)."]);
    expect(host.audits.at(-1)).toEqual({
      action: "status-changed",
      details: { from: "none", to: "minor" },
    });

    // Turning the interval off stops the timed checks.
    await host.setSetting("every", "0");
    await host.advance(60 * 60_000);
    expect(host.requests).toHaveLength(3);
  });

  it("logs a failed timed check instead of showing a notice", async () => {
    const host = await startTile(DIR, {
      settings: { every: "60" },
      net: () => {
        throw named("NetworkError");
      },
    });
    await host.emit("app.ready");
    await host.advance(0);
    expect(host.toasts).toEqual([]);
    expect(host.warnings).toEqual(["status check failed: NetworkError: NetworkError"]);
  });

  it("speaks the user's language", async () => {
    const host = await startTile(DIR, { locale: "ja", net: () => page("none") });
    await host.command("check-now");
    await host.advance(0);
    expect(host.toasts).toEqual(["GitHub: すべてのシステムが正常です。"]);
  });
});
