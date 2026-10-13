/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Package tests
 *
 * The tile as Tilefold will load it: tile.json follows Tilefold's rules,
 * asks for the overlay and Spotify's API host, and declares the Spotify
 * sign-in (the user's own app, no client secret, hosts within its
 * permissions), main.js is a fresh build
 * of the sources with the shape Tilefold accepts and no way to the network
 * except through the host, every message the code asks for exists in
 * English (and every English message is used), and every source file
 * carries its copyright header, stays under 500 lines and never points at
 * documentation from a comment.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleTile, checkMain } from "@tilefold/tile-tools";
import { describe, expect, it } from "vitest";
import { ROOT, messagesOf } from "./support/fake-tf.js";

/** Every .js or .mjs file under a folder (none when it does not exist). */
function jsFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsFiles(path);
    return /\.m?js$/.test(name) ? [path] : [];
  });
}

const tile = JSON.parse(readFileSync(join(ROOT, "tile.json"), "utf8"));
const sources = jsFiles(join(ROOT, "src"));
const scripts = jsFiles(join(ROOT, "scripts"));
const sourceText = sources.map((f) => readFileSync(f, "utf8")).join("\n");

describe("tile.json", () => {
  it("has only the fields Tilefold allows", () => {
    const allowed = ["id", "version", "name", "description", "permissions", "auth"];
    expect(Object.keys(tile).every((k) => allowed.includes(k))).toBe(true);
  });

  it("has a valid id and version", () => {
    expect(tile.id).toBe("example.tuneboard");
    expect(tile.id).toMatch(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/);
    expect(tile.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("takes its name and description from the locale files", () => {
    const en = messagesOf("en");
    expect(tile.name).toBe("%tile-name%");
    expect(tile.description).toBe("%tile-description%");
    expect(en.get("tile-name")).toBe("Tuneboard");
    expect(en.get("tile-description")).toContain("Spotify");
  });

  it("asks for the overlay and Spotify's API host, each with a reason", () => {
    const perms = tile.permissions.map((p) => Object.entries(p)[0]);
    expect(perms.map(([name]) => name)).toEqual(["window.overlay", "net:api.spotify.com"]);
    for (const [, reason] of perms) expect(reason.length).toBeGreaterThan(10);
    expect(sourceText).toContain("tf.overlay.show");
  });

  it("declares the Spotify sign-in with the user's own app and no secret", () => {
    expect(Object.keys(tile.auth)).toEqual(["spotify"]);
    const s = tile.auth.spotify;
    expect(s).toMatchObject({
      type: "oauth2-pkce",
      authorizeUrl: "https://accounts.spotify.com/authorize",
      tokenUrl: "https://accounts.spotify.com/api/token",
      clientId: "user",
      hosts: ["api.spotify.com"],
      label: "Spotify",
    });
    expect(s.setupUrl).toMatch(/^https:\/\/developer\.spotify\.com\//);
    expect(s.scopes).toEqual(["user-read-playback-state", "user-modify-playback-state"]);
    expect(s).not.toHaveProperty("clientSecret");
    for (const host of s.hosts) expect(tile.permissions.some((p) => `net:${host}` in p)).toBe(true);
  });
});

describe("main.js", () => {
  const main = readFileSync(join(ROOT, "main.js"), "utf8");

  it("is a fresh build of the sources", async () => {
    const { code } = await bundleTile(ROOT);
    expect(main).toBe(code);
  });

  it("has the shape Tilefold accepts", () => {
    expect(checkMain(main)).toEqual([]);
  });

  it("starts with the copyright header", () => {
    expect(main.startsWith("/**\n * Copyright (c) 2026 Tilefold")).toBe(true);
  });

  it("bundles the Spotify client and leaves signing in to Tilefold", () => {
    expect(main).toContain("https://api.spotify.com/v1/me/player");
    expect(main).toContain("auth.has(");
    // No sign-in, token or secret handling of its own.
    expect(main).not.toMatch(/accounts\.spotify\.com|refresh_token|code_verifier|client_secret/);
  });

  it("never reaches the network except through the host", () => {
    // Every request goes through the injected function; no global network API is touched.
    // `net.fetch(` (the host call) is allowed; a bare `fetch(` is not.
    expect(main).not.toMatch(
      /(?<![.\w])fetch\(|XMLHttpRequest|WebSocket|importScripts|globalThis\.fetch/,
    );
    expect(main).toContain("net.fetch(");
  });
});

describe("messages", () => {
  const en = messagesOf("en");

  /** Keys built at run time from a prefix (the rest comes from a table or a state). */
  const DYNAMIC = ["state-", "setting-corner-"];

  it("has every key the code names", () => {
    const named = new Set(
      [
        ...sourceText.matchAll(/["'`]((?:cmd|setting|state|card|button|tile)-[a-z0-9-]+)["'`]/g),
      ].map((m) => m[1]),
    );
    expect(named.size).toBeGreaterThan(20);
    for (const key of named) expect(en.has(key), key).toBe(true);
  });

  it("uses every English message", () => {
    for (const key of en.keys()) {
      if (key === "tile-name" || key === "tile-description") continue;
      const used =
        sourceText.includes(`"${key}"`) ||
        DYNAMIC.some((p) => key.startsWith(p) && sourceText.includes(p));
      expect(used, key).toBe(true);
    }
  });

  it("has a title and a hint for every state without a track", () => {
    for (const s of [
      "no-network",
      "denied",
      "signed-out",
      "connecting",
      "no-device",
      "premium",
      "error",
    ]) {
      expect(en.has(`state-${s}`), s).toBe(true);
      expect(en.has(`state-${s}-hint`), s).toBe(true);
    }
    for (const corner of ["bottom-right", "bottom-left", "top-right", "top-left"]) {
      expect(en.has(`setting-corner-${corner}`)).toBe(true);
    }
  });
});

describe("sources", () => {
  it("carry a copyright header and stay under 500 lines", () => {
    const files = [
      ...sources,
      ...scripts,
      ...jsFiles(fileURLToPath(new URL(".", import.meta.url))),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8").replace(/^#!.*\n/, "");
      const name = relative(ROOT, file);
      expect(text.startsWith("/**\n * Copyright (c) 2026 Tilefold"), name).toBe(true);
      expect(text.split("\n").length, name).toBeLessThan(500);
    }
  });

  it("never point at documentation from code comments", () => {
    for (const file of [...sources, ...scripts]) {
      expect(readFileSync(file, "utf8"), relative(ROOT, file)).not.toMatch(/see docs\/|\.md\b|§\d/);
    }
  });
});
